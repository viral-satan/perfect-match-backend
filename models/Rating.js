import mongoose from "mongoose";

const ratingSchema = new mongoose.Schema({
  rater: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  ratedUser: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  value: { type: Number, required: true, min: 1, max: 10 }
}, { timestamps: true });

// Ensure one rating per user per match
ratingSchema.index({ rater: 1, ratedUser: 1 }, { unique: true });

export default mongoose.models.Rating || mongoose.model("Rating", ratingSchema);
