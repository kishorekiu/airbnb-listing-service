import Listing from "../models/Listing.js";
import Reservation from "../models/Reservation.js";
import { redis } from "../config/redis.js";
import mongoose from "mongoose";

/**
 * Fetch a paginated, filtered feed of listings.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export const getListingsFeed = async (req, res, next) => {
  try {
    const limit = parseInt(/** @type {string} */(req.query.limit)) || 12;
    const { cursor, category, locationValue, guestCount, startDate, endDate } = req.query;

    const isGranularSearch = Boolean(locationValue || guestCount || startDate);

    let cacheKey = cursor
      ? `listings:cursor:${cursor}:limit:${limit}`
      : `listings:cursor:initial:limit:${limit}`;

    if (category) cacheKey += `:category:${category}`;

    // STEP A: Cache Check
    if (!isGranularSearch) {
      try {
        const cachedPayload = await redis.get(cacheKey);
        if (cachedPayload) {
          console.log(`⚡ CACHE HIT for ${cacheKey}`);
          return res.status(200).json({ source: 'redis', ...cachedPayload });
        }
      } catch (/** @type {any} */ redisError) {
        console.error(`⚠️ Redis Error (Bypassing cache): ${redisError?.message}`);
        // Do NOT throw. Let it gracefully fall back to MongoDB.
      }
    }

    console.log(`🐌 CACHE MISS for ${cacheKey} - Hitting MongoDB`);

    // STEP B: Base MongoDB Query
    /** @type {Record<string, any>} */
    let query = {};

    if (category) query.category = category;
    if (locationValue) query.locationValue = locationValue;
    if (guestCount) query.guestCount = { $gte: Number(guestCount) };

    // STEP C: Date Overlap with GRACEFUL DEGRADATION
    if (startDate && endDate) {
      try {
        const parsedStartDate = new Date(/** @type {string} */(startDate));
        const parsedEndDate = new Date(/** @type {string} */(endDate));

        const overLappingDates = await Reservation.find({
          startDate: { $lt: parsedEndDate },
          endDate: { $gt: parsedStartDate }
        });

        const conflictingIds = overLappingDates.map(res => res.listingId.toString());

        if (conflictingIds.length > 0) {
          query._id = { $nin: conflictingIds };
        }
      } catch (/** @type {any} */ dateError) {
        // If the Reservation DB fails, we log it, but we DO NOT crash the feed!
        console.error(`⚠️ Reservation Filter Degraded: ${dateError?.message}`);
      }
    }

    // STEP D: Cursor Merging
    if (cursor && cursor !== 'null') {
      if (!query._id || typeof query._id !== 'object') {
        query._id = {};
      }
      query._id.$lt = new mongoose.Types.ObjectId(/** @type {string} */(cursor));
    }

    // STEP E: Execute Fetch
    const listings = await Listing.find(query)
      .sort({ _id: -1 })
      .limit(limit)
      .lean();

    const nextCursor = listings.length === limit ? listings[listings.length - 1]._id : null;
    const cacheData = { data: listings, nextCursor };

    // STEP F: Dual-Write
    if (!isGranularSearch) {
      // Background async save (don't force the user to wait for Redis to save)
      redis.set(cacheKey, cacheData, { ex: 604800 }).catch(err =>
        console.error(`⚠️ Redis Save Error: ${err?.message}`)
      );
    }

    res.status(200).json({ source: 'mongodb', ...cacheData });

  } catch (error) {
    // Pass fatal errors to the global error handler
    next(error);
  }
};

/**
 * Fetch a single listing by ID.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export const getListingById = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (typeof id !== "string" || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid listing ID format" });
    }

    const cacheKey = `listing:id:${id}`;

    try {
      const cachedData = await redis.get(cacheKey);
      if (cachedData) return res.status(200).json({ source: 'redis', data: cachedData });
    } catch (/** @type  */ redisErr) {
      console.error(`⚠️ Redis Error: ${redisErr?.message}`);
    }

    const listing = await Listing.findById(id).lean();

    if (!listing) {
      return res.status(404).json({ error: "Listing not found" });
    }

    redis.set(cacheKey, listing, { ex: 604800 }).catch(e => console.error("Redis save failed", e));

    res.status(200).json({ source: 'mongodb', data: listing });

  } catch (error) {
    next(error);
  }
};