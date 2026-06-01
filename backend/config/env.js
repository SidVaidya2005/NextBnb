require("dotenv").config();

const NODE_ENV = process.env.NODE_ENV || "development";

if (!process.env.JWT_SECRET && NODE_ENV !== "test") {
  throw new Error("JWT_SECRET is required — set it in backend/.env");
}

const env = {
  PORT: parseInt(process.env.PORT, 10) || 8080,
  MONGO_URI: process.env.MONGO_URI || "mongodb://127.0.0.1:27017/wanderlust",
  JWT_SECRET: process.env.JWT_SECRET || "test-only-secret",
  FRONTEND_URL: process.env.FRONTEND_URL || "http://localhost:5173",
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || "",
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET || "",
  GOOGLE_CALLBACK_URL:
    process.env.GOOGLE_CALLBACK_URL ||
    "http://localhost:8080/auth/google/callback",
  GITHUB_CLIENT_ID: process.env.GITHUB_CLIENT_ID || "",
  GITHUB_CLIENT_SECRET: process.env.GITHUB_CLIENT_SECRET || "",
  GITHUB_CALLBACK_URL:
    process.env.GITHUB_CALLBACK_URL ||
    "http://localhost:8080/auth/github/callback",
  CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME || "",
  CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY || "",
  CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET || "",
  NODE_ENV,
};

module.exports = env;
