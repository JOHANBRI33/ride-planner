import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "source.unsplash.com",
      },
      // Future: user-uploaded images via Cloudinary / Supabase Storage
      // { protocol: "https", hostname: "res.cloudinary.com" },
      // { protocol: "https", hostname: "*.supabase.co" },
    ],
  },
};

export default nextConfig;
