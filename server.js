
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { Redis } from "@upstash/redis";
import mongoose from "mongoose";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN
})

const listingSchema = new mongoose.Schema({
  title: String,
  description: String,
  imageSrc: [String],
  createdAt: Date,
  category: String,
  roomCount: Number,
  bathroomCount: Number,
  guestCount: Number,
  locationValue: String,
  userId: String,
  price: Number,
}, { collection: 'listings' }); // Explicitly bind to your existing Next.js collection

const Listing = mongoose.model('Listing', listingSchema);

// The Core Search & Feed Endpoint (Optimized with Cursors)
app.get("/api/v1/listings", async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 12;
    const cursor = req.query.cursor; // This will be undefined on the very first load

    // Create a unique cache key. If no cursor, it's the "initial" feed.
    const cacheKey = cursor
      ? `listings:cursor:${cursor}:limit:${limit}`
      : `listings:cursor:initial:limit:${limit}`;

    // STEP A: The Cache Check
    const cachedPayload = await redis.get(cacheKey);

    if (cachedPayload) {
      console.log(`⚡ CACHE HIT for ${cacheKey}`);
      // Return the cached data, but tag the source as redis
      return res.status(200).json({ source: 'redis', ...cachedPayload });
    }

    console.log(`🐌 CACHE MISS for ${cacheKey} - Hitting MongoDB`);

    // STEP B: The Fallback (O(1) MongoDB Query)
    let query = {};
    if (cursor && cursor !== 'null') {
      // Find documents where the _id is Less Than ($lt) the cursor
      query = { _id: { $lt: new mongoose.Types.ObjectId(cursor) } };
    }

    const listings = await Listing.find(query)
      .sort({ _id: -1 }) // Sort newest first
      .limit(limit)
      .lean();

    // Determine the next cursor (the _id of the very last item in this batch)
    // If we got fewer items than the limit, we've reached the end of the database
    const nextCursor = listings.length === limit ? listings[listings.length - 1]._id : null;

    // The data we want to save in Redis
    const cacheData = { data: listings, nextCursor };

    // STEP C: Dual-Write to Redis (5 minute TTL)
    await redis.set(cacheKey, cacheData, { ex: 300 });

    res.status(200).json({ source: 'mongodb', ...cacheData });

  } catch (error) {
    console.error("Listing Fetch Error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});
const PORT = process.env.PORT || 8080;

mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    console.log("Connected to MongoDB Atlas");
    app.listen(PORT, () => console.log(`Listing Microservice running on port: ${PORT}`))
  })
  .catch((e) => console.error("MongoDB connection error", e))