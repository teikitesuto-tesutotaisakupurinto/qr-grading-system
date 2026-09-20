import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,

  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.firebasestorage.app",
      },
      {
        protocol: "https",
        hostname: "*.googleusercontent.com",
      },
    ],
  },

  experimental: {
    serverActions: {
      bodySizeLimit: "50mb",
    },
  },
};

export default nextConfig;
