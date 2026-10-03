"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/", label: "Trips", isActive: (pathname: string) => pathname === "/" || pathname.startsWith("/trips/") },
  { href: "/settings", label: "Settings", isActive: (pathname: string) => pathname.startsWith("/settings") },
] as const;

/** Global bottom navigation. Active state depends only on the route shape, never on IDs. */
export function GlobalNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-10 border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur"
    >
      <ul className="mx-auto flex h-16 max-w-md">
        {ITEMS.map((item) => {
          const active = item.isActive(pathname);
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex h-full items-center justify-center text-sm font-medium ${
                  active ? "text-teal-700" : "text-slate-500"
                }`}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
