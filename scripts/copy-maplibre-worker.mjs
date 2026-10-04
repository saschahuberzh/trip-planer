// Copies MapLibre's worker module (and the shared chunk it imports) into
// public/vendor/maplibre-gl/<version>/. MapLibre derives its worker URL from
// import.meta.url, which doesn't survive bundling, so the app sets it explicitly
// (see src/components/map/maplibreSetup.ts). The folder is generated; not committed.
import { copyFileSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
const packageDir = dirname(require.resolve("maplibre-gl/package.json"));
const { version } = JSON.parse(readFileSync(join(packageDir, "package.json"), "utf8"));
const vendorRoot = join(process.cwd(), "public", "vendor", "maplibre-gl");
const target = join(vendorRoot, version);

rmSync(vendorRoot, { recursive: true, force: true });
mkdirSync(target, { recursive: true });
for (const file of ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"]) {
  copyFileSync(join(packageDir, "dist", file), join(target, file));
}
console.log(`MapLibre ${version} worker copied to public/vendor/maplibre-gl/${version}/`);
