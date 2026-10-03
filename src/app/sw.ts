/// <reference lib="webworker" />
// Service worker (built by @serwist/next into public/sw.js).
//
// Rules: never store or cache user data, never touch IndexedDB, never call
// skipWaiting automatically (Serwist activates on a SKIP_WAITING message).
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { Serwist } from "serwist";
import { OFFLINE_FALLBACK_PATH, templatePathFor } from "../lib/routing/routes";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const NAVIGATION_TIMEOUT_MS = 5000;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  precacheOptions: { cleanupOutdatedCaches: true },
  skipWaiting: false,
  clientsClaim: true,
  navigationPreload: false,
});

async function fetchWithTimeout(request: Request): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), NAVIGATION_TIMEOUT_MS);
  try {
    return await fetch(request, { signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function offlineResponse(pathname: string): Promise<Response> {
  const templatePath = templatePathFor(pathname);
  const template = templatePath === null ? undefined : await serwist.matchPrecache(templatePath);
  return template ?? (await serwist.matchPrecache(OFFLINE_FALLBACK_PATH)) ?? Response.error();
}

// Navigations are network-first, so online users always get current HTML.
// When the network fails, any `/trips/<id>/<section>` URL is answered with the
// precached template for that section; the client reads the ID from the URL.
async function handleNavigation(request: Request): Promise<Response> {
  try {
    const response = await fetchWithTimeout(request);
    if (response.status < 500) return response;
  } catch {
    // Network unavailable or timed out.
  }
  return offlineResponse(new URL(request.url).pathname);
}

self.addEventListener("install", serwist.handleInstall);
self.addEventListener("activate", serwist.handleActivate);
self.addEventListener("message", serwist.handleCache);
self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.mode === "navigate" && new URL(request.url).origin === self.location.origin) {
    event.respondWith(handleNavigation(request));
    return;
  }
  // Precached static assets only; everything else goes to the network.
  serwist.handleFetch(event);
});
