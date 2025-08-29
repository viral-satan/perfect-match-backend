// server/routes/ratings.js
import express from "express";
import Rating from "../models/Rating.js";
import User from "../models/User.js";

const router = express.Router();

/**
 * POST /ratings
 * Body: { userId, matchId, rating }
 */
router.post("/", async (req, res) => {
  try {
    const { userId, matchId, rating } = req.body;

    if (!userId || !matchId || rating === undefined) {
      return res.status(400).json({ success: false, message: "Missing data" });
    }

    const rater = await User.findById(userId);
    const ratedUser = await User.findById(matchId);

    if (!rater || !ratedUser) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    // Check if the rater has already rated this user
    const existingRating = await Rating.findOne({ rater: userId, ratedUser: matchId });
    if (existingRating) {
      return res.status(400).json({ success: false, message: "You have already rated this user" });
    }

    // Save the new rating
    const newRating = new Rating({
      rater: userId,
      ratedUser: matchId,
      value: rating,
    });
    await newRating.save();

    // Recalculate average attractiveness including initial 10
    const allRatings = await Rating.find({ ratedUser: matchId });

    // Start with initial 10
    const total = allRatings.reduce((sum, r) => sum + r.value, 10);
    const average = total / (allRatings.length + 1); // +1 for the initial rating

    ratedUser.attractiveness = average;
    await ratedUser.save();

    res.json({ success: true, message: "Rating saved", newAttractiveness: ratedUser.attractiveness });
  } catch (err) {
    console.error("Error in /ratings:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

/**
 * GET /ratings/user/:userId
 * Returns all ratings submitted by the user
 */
router.get("/user/:userId", async (req, res) => {
  try {
    const ratings = await Rating.find({ rater: req.params.userId });
    res.json({ success: true, ratings });
  } catch (err) {
    console.error("Error fetching user ratings:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

export default router;
