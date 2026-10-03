import { randomUUID } from "node:crypto";
import withSerwistInit from "@serwist/next";
import type { NextConfig } from "next";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants";
import { PRECACHED_PAGE_PATHS } from "./src/lib/routing/routes";

function withServiceWorker(nextConfig: NextConfig): NextConfig {
  // Page HTML embeds the build ID, so every build gets a new revision.
  const pageRevision = randomUUID();
  return withSerwistInit({
    swSrc: "src/app/sw.ts",
    swDest: "public/sw.js",
    // Registered by UpdatePrompt to control the update flow.
    register: false,
    reloadOnOnline: false,
    cacheOnNavigation: false,
    additionalPrecacheEntries: [...PRECACHED_PAGE_PATHS, "/manifest.webmanifest"].map((url) => ({
      url,
      revision: pageRevision,
    })),
  })(nextConfig);
}

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },
};

// The service worker is disabled in development; Serwist's webpack hook would
// also prevent `next dev` from using Turbopack.
export default function config(phase: string): NextConfig {
  return phase === PHASE_DEVELOPMENT_SERVER ? nextConfig : withServiceWorker(nextConfig);
}
