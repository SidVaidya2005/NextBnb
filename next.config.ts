import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  images: {
    // Cloudinary delivers user-uploaded listing photos; Unsplash serves seed
    // images (public_id = null). Both are whitelisted for next/image + CldImage.
    remotePatterns: [
      { protocol: 'https', hostname: 'res.cloudinary.com' },
      { protocol: 'https', hostname: 'images.unsplash.com' },
    ],
  },
}

export default nextConfig
