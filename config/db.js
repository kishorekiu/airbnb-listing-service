import mongoose from "mongoose";

export const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI || "");
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
  } catch ( /** @type {any} */ error) {
    console.error(`❌ MongoDB Connection Error: ${error?.message}`);
    process.exit(1); // Stop the server if the primary DB is dead
  }
};