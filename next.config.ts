import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // This repository lives beneath another npm project. Pin Turbopack to this
  // checkout so it does not treat the parent lockfile as the workspace root.
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
