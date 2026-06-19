import mongoose, { Schema } from "mongoose";

const ReservationSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  listingId: { type: Schema.Types.ObjectId, ref: "Listing", required: true },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  totalPrice: { type: Number, required: true },
  createdAt: { type: Date, default: Date.now },
});

const Reservation = mongoose.model("Reservation", ReservationSchema);
export default Reservation;
