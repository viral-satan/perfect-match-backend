// server/index.js
import express from "express";
import http from "http";
import mongoose from "mongoose";
import dotenv from "dotenv";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { Server } from "socket.io";

import usersRouter from "./routes/users.js";
import matchesRouter from "./routes/matches.js";
import ratingsRouter from "./routes/ratings.js";
import messagesRouter from "./routes/messages.js";
import Message from "./models/Message.js";

dotenv.config();

// ---------------- Setup paths ----------------
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ---------------- Express + HTTP ----------------
const app = express();
const server = http.createServer(app);

// ---------------- Middleware ----------------
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// ---------------- Routes ----------------
app.use("/users", usersRouter);
app.use("/matches", matchesRouter);
app.use("/ratings", ratingsRouter);
app.use("/messages", messagesRouter);

// Root endpoint
app.get("/", (req, res) => {
  res.send("✅ Perfect Match backend is running on Render!");
});

// ---------------- Socket.IO ----------------
const io = new Server(server, { 
  cors: { 
    origin: "*", // allow all origins for testing; later restrict to your frontend URL
    methods: ["GET", "POST"]
  } 
});

// Track userId → set of socket IDs
const onlineUsers = new Map();

io.on("connection", (socket) => {
  console.log("🔌 User connected:", socket.id);

  // Join room for this user
  socket.on("joinRoom", (userId) => {
    if (!userId) return;
    if (!onlineUsers.has(userId)) onlineUsers.set(userId, new Set());
    onlineUsers.get(userId).add(socket.id);
    socket.join(userId);
    console.log(`📡 User ${userId} joined room. Active sockets:`, onlineUsers.get(userId));
  });

  // Handle sending a message
  socket.on("sendMessage", async (msg) => {
    const { sender, recipient, content } = msg;
    if (!sender || !recipient || !content || content.length > 100) return;

    try {
      // Save message to DB
      const newMessage = await Message.create({ sender, recipient, content });

      // Emit to sender and recipient rooms
      io.to(sender).emit("receiveMessage", newMessage);
      io.to(recipient).emit("receiveMessage", newMessage);
    } catch (err) {
      console.error("❌ Error sending message:", err);
    }
  });

  // Handle disconnect
  socket.on("disconnect", () => {
    console.log("⚠️ User disconnected:", socket.id);
    onlineUsers.forEach((socketsSet, userId) => {
      socketsSet.delete(socket.id);
      if (socketsSet.size === 0) onlineUsers.delete(userId);
    });
  });
});

// ---------------- MongoDB connection ----------------
const mongoUri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/perfectmatch";

mongoose
  .connect(mongoUri)
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error("❌ MongoDB connection error:", err));

// ---------------- Start server ----------------
const PORT = process.env.PORT || 5001;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
