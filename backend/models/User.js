const mongoose = require("mongoose");

// TODO: flesh out auth fields, roles, profile, etc.
const userSchema = new mongoose.Schema(
  {
    provider: { type: String, enum: ["google"], required: true },
    providerId: { type: String, required: true },
    email: { type: String },
    name: { type: String },
    avatar: { type: String },
  },
  { timestamps: true },
);

userSchema.index({ provider: 1, providerId: 1 }, { unique: true });

module.exports = mongoose.model("User", userSchema);
