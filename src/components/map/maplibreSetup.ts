// Shared MapLibre setup; import this module instead of "maplibre-gl" directly.
import "maplibre-gl/dist/maplibre-gl.css";
import { getVersion, setWorkerUrl } from "maplibre-gl";

// MapLibre derives its worker URL from import.meta.url, which bundling breaks;
// scripts/copy-maplibre-worker.mjs publishes the worker under this path.
setWorkerUrl(`/vendor/maplibre-gl/${getVersion()}/maplibre-gl-worker.mjs`);

export * from "maplibre-gl";
