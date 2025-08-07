import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    // We run type checks in CI; ignore during build to prevent unrelated errors from blocking deploy
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
