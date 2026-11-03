import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  output: "standalone",
  outputFileTracingRoot: process.cwd(),
  // Public photographs sit under dark scrims, so a lower quality is invisible
  // and keeps the above-the-fold image light on slow connections.
  images: { qualities: [45, 60, 75] },
};

export default nextConfig;
