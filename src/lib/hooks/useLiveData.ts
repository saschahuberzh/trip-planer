"use client";

import { liveQuery } from "dexie";
import { useEffect, useState, type DependencyList } from "react";

export type LiveData<T> =
  | { status: "loading" }
  | { status: "ready"; data: T }
  | { status: "error"; error: unknown };

/**
 * Subscribes to a local-data query (service/repository calls only) and re-runs it
 * whenever the underlying IndexedDB records change, including changes from other tabs.
 * Starts in "loading" on the server and before the first result.
 */
export function useLiveData<T>(query: () => Promise<T>, deps: DependencyList): LiveData<T> {
  const [state, setState] = useState<{ deps: DependencyList; value: LiveData<T> }>({
    deps,
    value: { status: "loading" },
  });

  useEffect(() => {
    const subscription = liveQuery(query).subscribe({
      next: (data) => setState({ deps, value: { status: "ready", data } }),
      error: (error: unknown) => {
        console.error("Failed to load local data", error);
        setState({ deps, value: { status: "error", error } });
      },
    });
    return () => subscription.unsubscribe();
    // The caller declares the query's dependencies, as with useEffect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  // Results of a previous query (other deps) are never shown as current.
  const current = state.deps.length === deps.length && state.deps.every((dep, i) => Object.is(dep, deps[i]));
  return current ? state.value : { status: "loading" };
}
