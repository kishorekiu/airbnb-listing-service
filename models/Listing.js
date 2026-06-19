import mongoose from "mongoose";

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
}, { collection: 'listings' });

const Listing = mongoose.model('Listing', listingSchema);
export default Listing;