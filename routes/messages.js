// server/routes/messages.js
import express from "express";
import User from "../models/User.js";
import Rating from "../models/Rating.js";
import Message from "../models/Message.js";

const router = express.Router();

// ---------------- Helper: Attractiveness similarity ----------------
function attractivenessSimilarity(diff) {
  const k = 0.27;
  const maxDiff = 10;
  return Math.log(1 + k * (maxDiff - diff)) / Math.log(1 + k * maxDiff);
}

// ---------------- Get matches that rated this user ----------------
router.get("/matches/:userId", async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    const ratingDocs = await Rating.find({ userId: user._id }).lean();
    if (!ratingDocs || ratingDocs.length === 0) return res.json({ success: true, matches: [] });

    const ratedUserIds = ratingDocs.map(r => r.ratedUser);
    const ratedUsers = await User.find({ _id: { $in: ratedUserIds } });

    const pointMap = [10, 7, 5, 3, 1];
    const matches = ratedUsers.map(other => {
      let answerScore = 0;
      if (user.answers.length === other.answers.length) {
        for (let i = 0; i < user.answers.length; i++) {
          const diff = Math.min(Math.abs(user.answers[i] - other.answers[i]), 4);
          answerScore += pointMap[diff];
        }
      }
      const maxAnswerScore = user.answers.length * 10;
      const answerPercent = (answerScore / maxAnswerScore) * 100;
      const weightedAnswer = answerPercent * 0.8;

      const absDiff = Math.abs(user.attractiveness - other.attractiveness);
      const weightedAttractiveness = attractivenessSimilarity(absDiff) * 20;

      return {
        userId: other._id,
        photoUrl: other.photoUrl,
        matchPercentage: Number((weightedAnswer + weightedAttractiveness).toFixed(1)),
      };
    });

    const filtered = matches
      .filter(m => m.matchPercentage >= 80)
      .sort((a, b) => b.matchPercentage - a.matchPercentage);

    res.json({ success: true, matches: filtered });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// ---------------- Send a new message via API ----------------
router.post("/send", async (req, res) => {
  const { senderId, recipientId, content } = req.body;

  if (!content || content.length > 100) {
    return res.status(400).json({ success: false, message: "Message must be 1–100 characters." });
  }

  try {
    const sender = await User.findById(senderId);
    const recipient = await User.findById(recipientId);
    if (!sender || !recipient) {
      return res.status(404).json({ success: false, message: "Sender or recipient not found" });
    }

    const newMessage = await Message.create({
      sender: senderId,
      recipient: recipientId,
      content,
    });

    res.json({ success: true, message: "Message sent successfully!", data: newMessage });
  } catch (err) {
    console.error("Error sending message:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// ---------------- Get all messages between two users ----------------
router.get("/:userId/:matchId", async (req, res) => {
  const { userId, matchId } = req.params;

  try {
    const messages = await Message.find({
      $or: [
        { sender: userId, recipient: matchId },
        { sender: matchId, recipient: userId },
      ],
    })
      .sort({ createdAt: 1 })
      .lean();

    res.json({ success: true, messages });
  } catch (err) {
    console.error("Error fetching messages:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

export default router;
