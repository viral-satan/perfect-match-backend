import express from "express";
import bcrypt from "bcryptjs";
import User from "../models/User.js";
import multer from "multer";
import path from "path";
import sharp from "sharp";
import fs from "fs";

const router = express.Router();

// ---------------- Uploads folder ----------------
const uploadsDir = path.join(process.cwd(), "uploads");

// ---------------- Multer setup ----------------
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname)),
});
const upload = multer({ storage });

// ---------------- Signup ----------------
router.post("/signup", async (req, res) => {
  const { email, gender, lookingFor, password } = req.body;

  try {
    const existingUser = await User.findOne({ email });
    if (existingUser)
      return res.status(400).json({ success: false, message: "User already exists" });

    const newUser = new User({ email, gender, lookingFor, password });
    await newUser.save();

    res.json({ success: true, userId: newUser._id });
  } catch (err) {
    console.error("Signup error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// ---------------- Login ----------------
router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ success: false, message: "User not found" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ success: false, message: "Incorrect password" });

    res.json({ success: true, userId: user._id, user });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// ---------------- Submit Answers ----------------
router.post("/answers/:userId", async (req, res) => {
  const { userId } = req.params;
  const { answers } = req.body;

  if (!answers || !Array.isArray(answers) || answers.length !== 20)
    return res.status(400).json({ success: false, message: "Answers must have 20 items" });

  try {
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    user.answers = answers;
    await user.save();

    res.json({ success: true, message: "Answers submitted successfully" });
  } catch (err) {
    console.error("Answers submission error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// ---------------- Photo Upload ----------------
router.post("/upload-photo/:userId", upload.single("photo"), async (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, message: "No file uploaded" });

  try {
    const user = await User.findById(req.params.userId);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    const inputPath = req.file.path;
    const resizedFilename = "resized-" + req.file.filename;
    const outputPath = path.join(uploadsDir, resizedFilename);

    await sharp(inputPath, { failOnError: false })
      .rotate()
      .resize(300, 300, { fit: "inside" })
      .toFile(outputPath);

    fs.unlinkSync(inputPath);

    user.photoUrl = resizedFilename;
    user.attractiveness = 10;
    await user.save();

    res.json({ success: true, message: "Photo uploaded and resized successfully!" });
  } catch (err) {
    console.error("Photo upload error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ---------------- Get Single User ----------------
router.get("/:userId", async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });
    res.json({ success: true, user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// ---------------- Batch Fetch Users ----------------
router.post("/batch", async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids)) return res.status(400).json({ success: false, message: "Invalid input" });

    const users = await User.find({ _id: { $in: ids } });
    res.json({ success: true, users });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

export default router;
