import type { NextConfig } from "next";

import { AUTHORISED_IMAGE_HOSTS } from "./lib/images";
import { apiOriginFrom, securityHeaders } from "./lib/security-headers";

const development = process.env.NODE_ENV === "development";
// Matches lib/api/client.ts: development falls back to the local API.
const apiOrigin =
  apiOriginFrom(process.env.NEXT_PUBLIC_API_BASE_URL) ?? (development ? "http://localhost:8000" : null);

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders({ apiOrigin, imageHosts: AUTHORISED_IMAGE_HOSTS, development }),
      },
    ];
  },
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
