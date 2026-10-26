import type { NextConfig } from "next";

import { AUTHORISED_IMAGE_HOSTS } from "./lib/images";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  images: {
    // Only hosts ADR-001 authorises (none yet); see lib/images.ts.
    remotePatterns: AUTHORISED_IMAGE_HOSTS.map((hostname) => ({ protocol: "https", hostname })),
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
