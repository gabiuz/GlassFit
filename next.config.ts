import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // PRD-F1, BLD-S6: Vercel Services does not expose the Next.js image
  // optimization endpoint, so public assets must be served directly.
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
