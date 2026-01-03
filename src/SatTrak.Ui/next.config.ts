import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'export',
  basePath: '/SatTrak',
  images: {
      unoptimized: true // Required for static export
  }
};

export default nextConfig;
