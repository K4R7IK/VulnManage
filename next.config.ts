import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  experimental: {
    optimizePackageImports: ["@mantine/core", "@mantine/hooks"],
  },
  output: "standalone",
  //eslint: {
  //  ignoreDuringBuilds: true,
  //},
  //typescript: {
  //  ignoreBuildErrors: true,
  //},
};

export default nextConfig;
