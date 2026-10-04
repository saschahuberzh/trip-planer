import Link from "next/link";
import type { ReactNode } from "react";
import { appRoutePath } from "@/lib/routing/routes";
import { buttonClass } from "./Button";

/** Placeholder cards while a screen's local data loads. */
export function ScreenSkeleton({ label = "Loading" }: { label?: string }) {
  return (
    <div className="mx-auto max-w-md space-y-4 px-4 py-5" aria-busy="true" aria-label={label}>
      {[0, 1, 2].map((key) => (
        <div key={key} className="h-36 animate-pulse rounded-3xl bg-slate-200/70" />
      ))}
    </div>
  );
}

/** A centred message card (errors, not found). */
export function ScreenMessage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mx-auto max-w-md px-4 py-6">
      <div className="rounded-3xl bg-white p-6 text-center shadow-sm ring-1 ring-slate-200">
        <h2 className="text-lg font-semibold">{title}</h2>
        <div className="mt-2 text-slate-600">{children}</div>
      </div>
    </section>
  );
}

/** Local data couldn't be read; nothing was changed. */
export function LoadError({ what }: { what: string }) {
  return (
    <ScreenMessage title={`${what} couldn't be loaded`}>Your data has not been changed. Try reloading the app.</ScreenMessage>
  );
}

export function TripNotFound() {
  return (
    <ScreenMessage title="Trip not found">
      This trip doesn&apos;t exist on this device. It may have been deleted.
      <Link href={appRoutePath({ name: "trips" })} className={buttonClass("primary", "mt-4 w-full")}>
        Back to trips
      </Link>
    </ScreenMessage>
  );
}
