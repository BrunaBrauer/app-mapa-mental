import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Evita reutilizar artefatos CSS obsoletos entre builds restaurados pela Vercel.
  experimental: { turbopackFileSystemCacheForBuild: false },
};

export default nextConfig;
