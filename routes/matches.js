// server/routes/matches.js
import express from "express";
import User from "../models/User.js";

const router = express.Router();

// ---------------- Helpers ----------------

// Logarithmic attractiveness similarity
function attractivenessSimilarity(diff) {
  const k = 0.27;      // steepness control
  const maxDiff = 10;  // maximum difference
  const score = Math.log(1 + k * (maxDiff - diff)) / Math.log(1 + k * maxDiff);
  return Math.max(0, Math.min(1, score)); // clamp 0–1
}

// Map answer difference to points (new scale)
function answerPoint(diff) {
  const pointMap = [10, 8.5, 6.5, 4, 0]; // diff 0,1,2,3,>=4
  return diff >= 4 ? pointMap[4] : pointMap[diff];
}

// Compute match percentage between two users
function computeMatchPercentage(user, other) {
  // 1️⃣ Answer similarity
  let answerScore = 0;
  if (user.answers.length === other.answers.length) {
    for (let i = 0; i < user.answers.length; i++) {
      const diff = Math.min(Math.abs(user.answers[i] - other.answers[i]), 4);
      answerScore += answerPoint(diff);
    }
  }

  const maxAnswerScore = user.answers.length * 10; // max possible using top scale
  const answerPercent = (answerScore / maxAnswerScore) * 100;
  const weightedAnswer = answerPercent * 0.8; // 80% weight

  // 2️⃣ Attractiveness similarity (logarithmic)
  const absDiff = Math.abs(user.attractiveness - other.attractiveness);
  const weightedAttractiveness = attractivenessSimilarity(absDiff) * 20; // 20% weight

  // 3️⃣ Final %
  return (weightedAnswer + weightedAttractiveness).toFixed(1);
}

// ---------------- Routes ----------------

router.get("/:userId", async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    // Find potential matches: exclude self, mutual gender preference, must have photo
    const potentialMatches = await User.find({
      _id: { $ne: user._id },
      gender: { $in: user.lookingFor },
      lookingFor: { $in: [user.gender] },
      photoUrl: { $ne: "" },
    });

    // Compute match percentage for each potential match
    const matches = potentialMatches.map(other => ({
      userId: other._id,
      email: other.email,
      photoUrl: other.photoUrl,
      matchPercentage: computeMatchPercentage(user, other),
    }));

    // Sort descending by match percentage
    matches.sort((a, b) => Number(b.matchPercentage) - Number(a.matchPercentage));

    res.json({ success: true, matches });
  } catch (err) {
    console.error("Error fetching matches:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

export default router;
