// Client-side service worker registration and update flow.
// A new service worker installs in the background and waits; it only
// activates after the user confirms (see activateWaitingWorker).

export const SERVICE_WORKER_URL = "/sw.js";

export type SkipWaitingMessage = { type: "SKIP_WAITING" };

export function isServiceWorkerEnabled(): boolean {
  return process.env.NODE_ENV === "production" && "serviceWorker" in navigator;
}

/**
 * Registers the service worker and reports a waiting (updated) worker.
 * Returns a cleanup function.
 */
export function registerServiceWorker(onUpdateWaiting: (worker: ServiceWorker) => void): () => void {
  let registration: ServiceWorkerRegistration | null = null;
  let disposed = false;

  const reportIfWaiting = (worker: ServiceWorker | null) => {
    // Without a controller this is the first install, not an update.
    if (!disposed && worker !== null && navigator.serviceWorker.controller !== null) {
      onUpdateWaiting(worker);
    }
  };

  const trackInstalling = (installing: ServiceWorker | null) => {
    installing?.addEventListener("statechange", () => {
      if (installing.state === "installed") reportIfWaiting(installing);
    });
  };

  const onUpdateFound = () => trackInstalling(registration?.installing ?? null);

  const onVisibilityChange = () => {
    if (document.visibilityState === "visible") {
      registration?.update().catch(() => {
        // Offline or server unreachable: try again on the next visibility change.
      });
    }
  };

  navigator.serviceWorker
    .register(SERVICE_WORKER_URL, { scope: "/", updateViaCache: "none" })
    .then((reg) => {
      if (disposed) return;
      registration = reg;
      reportIfWaiting(reg.waiting);
      // An update found during page load may already be installing.
      trackInstalling(reg.installing);
      reg.addEventListener("updatefound", onUpdateFound);
      document.addEventListener("visibilitychange", onVisibilityChange);
    })
    .catch((error: unknown) => {
      console.error("Service worker registration failed", error);
    });

  return () => {
    disposed = true;
    registration?.removeEventListener("updatefound", onUpdateFound);
    document.removeEventListener("visibilitychange", onVisibilityChange);
  };
}

/** Activates the waiting worker and reloads once it controls the page. */
export function activateWaitingWorker(worker: ServiceWorker): void {
  let reloading = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (reloading) return;
    reloading = true;
    window.location.reload();
  });
  const message: SkipWaitingMessage = { type: "SKIP_WAITING" };
  worker.postMessage(message);
}
