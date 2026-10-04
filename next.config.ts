import { createHash, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import withSerwistInit from "@serwist/next";
import type { NextConfig } from "next";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants";
import { APP_ICON_PATHS } from "./src/lib/app";
import { PRECACHED_PAGE_PATHS } from "./src/lib/routing/routes";

/** Revision of a file in public/: its content hash, so changed files are re-fetched. */
function publicFileRevision(url: string): string {
  return createHash("sha256").update(readFileSync(join(process.cwd(), "public", url))).digest("hex").slice(0, 16);
}

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
    additionalPrecacheEntries: [
      ...[...PRECACHED_PAGE_PATHS, "/manifest.webmanifest"].map((url) => ({ url, revision: pageRevision })),
      // Icons (home screen, favicon, manifest) so an offline start shows them too.
      ...APP_ICON_PATHS.map((url) => ({ url, revision: publicFileRevision(url) })),
    ],
  })(nextConfig);
}

const packageVersion = (JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf8")) as { version: string }).version;

const nextConfig: NextConfig = {
  env: { NEXT_PUBLIC_APP_VERSION: packageVersion },
  async headers() {
    return [
      {
        // Updates must be detected: the browser always revalidates the service worker.
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
      {
        // Versioned path (scripts/copy-maplibre-worker.mjs): safe to cache forever.
        source: "/vendor/maplibre-gl/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
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
