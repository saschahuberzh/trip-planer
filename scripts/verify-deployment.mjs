// Checks a deployment for what the PWA needs (Phase 13, DEPLOY-003/004/006 preparation):
//   node scripts/verify-deployment.mjs https://your-app.vercel.app
//   node scripts/verify-deployment.mjs http://localhost:3000 --allow-http   (local production build)
// Exits with 1 if any check fails. Only reads public URLs; sends no data.
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

const [baseArg, ...flags] = process.argv.slice(2);
if (!baseArg) {
  console.error("Usage: node scripts/verify-deployment.mjs <base URL> [--allow-http]");
  process.exit(2);
}
const base = new URL(baseArg);
const allowHttp = flags.includes("--allow-http");
const results = [];
const check = (ok, label, detail = "") => results.push({ ok: Boolean(ok), label, detail });

async function get(path, init) {
  const url = new URL(path, base);
  try {
    return await fetch(url, { redirect: "manual", ...init });
  } catch (error) {
    return { ok: false, status: 0, headers: new Headers(), text: async () => "", arrayBuffer: async () => new ArrayBuffer(0), error };
  }
}

/** Width and height from a PNG header. */
function pngSize(buffer) {
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);
  const isPng = bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
  return isPng ? { width: view.getUint32(16), height: view.getUint32(20) } : null;
}

// 1. HTTPS (DEPLOY-003)
if (base.protocol === "https:") {
  check(true, "served over HTTPS");
  const http = new URL(base);
  http.protocol = "http:";
  const redirect = await fetch(http, { redirect: "manual" }).catch(() => null);
  check(
    redirect && redirect.status >= 300 && redirect.status < 400 && redirect.headers.get("location")?.startsWith("https://"),
    "plain HTTP redirects to HTTPS",
    redirect ? `${redirect.status} → ${redirect.headers.get("location") ?? "-"}` : "no response",
  );
} else {
  check(allowHttp, "served over HTTPS", allowHttp ? "skipped (--allow-http)" : "service workers and installation need HTTPS");
}

// 2. Start page with PWA meta tags
const home = await get("/");
const html = home.ok ? await home.text() : "";
check(home.status === 200, "start page loads", `HTTP ${home.status}`);
check(/<link rel="manifest" href="\/manifest\.webmanifest"/.test(html), "links the manifest");
check(/viewport-fit=cover/.test(html), "viewport-fit=cover (iPhone safe areas)");
check(/<link rel="apple-touch-icon"[^>]*href="\/icons\/apple-touch-icon\.png"/.test(html), "apple-touch-icon");
check(/name="apple-mobile-web-app-capable" content="yes"/.test(html), "apple-mobile-web-app-capable");
check(home.headers.get("x-content-type-options") === "nosniff", "security headers (nosniff)");

// 3. Manifest and icons (DEPLOY-004)
const manifestResponse = await get("/manifest.webmanifest");
let manifest = null;
try {
  manifest = manifestResponse.ok ? JSON.parse(await manifestResponse.text()) : null;
} catch {
  manifest = null;
}
check(manifest !== null, "manifest is valid JSON", `HTTP ${manifestResponse.status}`);
if (manifest) {
  check(manifest.display === "standalone", "manifest display: standalone");
  check(manifest.start_url === "/" && manifest.scope === "/", "manifest start_url and scope");
  check(Boolean(manifest.name && manifest.short_name), "manifest names", `${manifest.name} / ${manifest.short_name}`);
  for (const icon of manifest.icons ?? []) {
    const response = await get(icon.src);
    const size = response.ok ? pngSize(await response.arrayBuffer()) : null;
    check(
      size !== null && `${size.width}x${size.height}` === icon.sizes,
      `icon ${icon.src} (${icon.purpose ?? "any"})`,
      size ? `${size.width}x${size.height}` : `HTTP ${response.status}`,
    );
  }
  check((manifest.icons ?? []).some((icon) => icon.purpose === "maskable"), "maskable icon");
}

// 4. Service worker: no-cache headers so updates are detected (DEPLOY-001)
const sw = await get("/sw.js");
const swText = sw.ok ? await sw.text() : "";
const swCache = sw.headers.get("cache-control") ?? "";
check(sw.status === 200 && /javascript/.test(sw.headers.get("content-type") ?? ""), "sw.js is served as JavaScript", `HTTP ${sw.status}`);
check(/no-cache|no-store|max-age=0/.test(swCache), "sw.js is not cached", swCache || "no Cache-Control");

// 5. Every precached URL must exist, or the service worker can't install (offline would break).
const precached = [...swText.matchAll(/'url':'([^']+)'/g)].map((match) => match[1]);
check(precached.length > 0, "precache manifest found", `${precached.length} entries`);
const missing = [];
for (const url of [...new Set(precached)]) {
  const response = await get(url);
  if (response.status !== 200) missing.push(`${url} (${response.status})`);
}
check(missing.length === 0, "all precached URLs return 200", missing.length ? missing.slice(0, 5).join(", ") : `${precached.length} checked`);
for (const template of ["/trips/_template", "/trips/_template/plan", "/trips/_template/plan/_template", "/~offline"]) {
  check(precached.includes(template), `precaches ${template}`);
}

// 6. Map worker (module worker needs a JavaScript MIME type)
const require = createRequire(import.meta.url);
const { version } = JSON.parse(readFileSync(require.resolve("maplibre-gl/package.json"), "utf8"));
const worker = await get(`/vendor/maplibre-gl/${version}/maplibre-gl-worker.mjs`);
check(
  worker.status === 200 && /javascript/.test(worker.headers.get("content-type") ?? ""),
  "MapLibre worker is served as JavaScript",
  `HTTP ${worker.status} ${worker.headers.get("content-type") ?? ""}`,
);

// Report
let failed = 0;
for (const { ok, label, detail } of results) {
  if (!ok) failed++;
  console.log(`${ok ? "✓" : "✗"} ${label}${detail ? `  (${detail})` : ""}`);
}
console.log(failed === 0 ? `\nAll ${results.length} checks passed for ${base.origin}.` : `\n${failed} of ${results.length} checks failed.`);
process.exit(failed === 0 ? 0 : 1);
