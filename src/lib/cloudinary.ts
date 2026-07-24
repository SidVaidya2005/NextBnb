import 'server-only'
import { v2 as cloudinary } from 'cloudinary'

// The ONLY place the Cloudinary Node SDK is configured — it holds
// CLOUDINARY_API_SECRET, so it must never be imported by a client component.
// `server-only` makes a client import a build-time error.
cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

export { cloudinary }
