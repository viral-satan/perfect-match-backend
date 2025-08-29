import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  gender: { type: String, required: true },
  lookingFor: { type: [String], required: true },
  password: { type: String, required: true },
  photoUrl: { type: String, default: '' },
  answers: { type: [Number], default: [] },
  attractiveness: { type: Number, default: 10 },
}, { timestamps: true });

// Hash password before saving
userSchema.pre("save", async function(next) {
  if (!this.isModified("password")) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

export default mongoose.models.User || mongoose.model("User", userSchema);
