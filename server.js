
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { Redis } from "@upstash/redis";
import Listing from "./models/listing";
import mongoose from "mongoose";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN
})

app.get("/api/v1/listings", async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 12;
    const redisCacheKey = `listings:page:${page}:limit: ${limit}`;

    const cachedData = await redis.get(redisCacheKey);

    if (cachedData) {
      console.log(`⚡ CACHE HIT for ${cacheKey}`);
      return res.status(200).json({ source: "redis", data: cachedData })
    }

    console.log(`🐌 CACHE MISS for ${cacheKey} - Hitting MongoDB`);

    const skip = (page - 1) * limit;
    const listings = await Listing.find({})
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    await redis.set(redisCacheKey, listings, { ex: 300 });

    return res.status(200).json({ source: "mondodb", data: listings });

  } catch (e) {
    console.error("Lisitng fetch error", e);
    return res.status(500).json({ error: "Internal server error" })
  }
})

const PORT = process.env.PORT || 8080;

mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    console.log("Connected to MongoDB Atlas");
    app.listen(PORT, () => console.log(`Listing Microservice running on port: ${PORT}`))
  })
  .catch((e) => console.error("MongoDB connection error", e))