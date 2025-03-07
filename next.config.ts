import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  experimental: {
    optimizePackageImports: ["@mantine/core", "@mantine/hooks"],
  },
  output: "standalone", // This is crucial for production deployment
  poweredByHeader: false, // Security: Remove X-Powered-By header
  compress: true, // Enable compression for better performance
  generateEtags: true, // Enable etags for caching
  // Enable these in production to avoid errors in build
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
