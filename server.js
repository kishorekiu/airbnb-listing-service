import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { connectDB } from "./config/db.js";
import listingRoutes from "./routes/listingRoutes.js";
import { errorHandler } from "./middleware/errorHandler.js";

dotenv.config();

/** @type {any} */
const app = express();

// 1. Middlewares
app.use(cors());
app.use(express.json());

// 2. Connect to Database
connectDB();

// 3. Mount Routes
app.use("/api/v1/listings", listingRoutes);

// 4. Global Error Handler (Must be the last middleware)
app.use(errorHandler);

// 5. Start Server
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`🚀 Listing Microservice running on port: ${PORT}`);
});