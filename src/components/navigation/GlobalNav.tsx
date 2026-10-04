"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { APP_NAME } from "@/lib/app";
import { SettingsIcon, SuitcaseIcon } from "@/components/ui/icons";

const ITEMS = [
  {
    href: "/",
    label: "Trips",
    Icon: SuitcaseIcon,
    isActive: (pathname: string) => pathname === "/" || pathname.startsWith("/trips/"),
  },
  { href: "/settings", label: "Settings", Icon: SettingsIcon, isActive: (pathname: string) => pathname.startsWith("/settings") },
] as const;

/**
 * Global navigation: a bottom bar on phones, a sidebar on large screens (SCREENS.md).
 * Active state depends only on the route shape, never on IDs.
 */
export function GlobalNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-10 border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:inset-y-0 lg:right-auto lg:w-56 lg:border-t-0 lg:border-r lg:bg-white lg:pt-[env(safe-area-inset-top)] lg:pb-0"
    >
      <Link href="/" className="hidden items-center gap-2.5 px-5 pt-6 pb-5 lg:flex">
        {/* eslint-disable-next-line @next/next/no-img-element -- tiny local icon, precached */}
        <img src="/icons/favicon-32.png" alt="" width={28} height={28} className="rounded-lg" />
        <span className="text-lg font-bold tracking-tight text-slate-900">{APP_NAME}</span>
      </Link>
      <ul className="mx-auto flex h-16 max-w-md lg:h-auto lg:max-w-none lg:flex-col lg:gap-1 lg:px-3">
        {ITEMS.map(({ href, label, Icon, isActive }) => {
          const active = isActive(pathname);
          return (
            <li key={href} className="flex-1 lg:flex-none">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex h-full items-center justify-center gap-3 text-sm font-medium lg:min-h-11 lg:justify-start lg:rounded-xl lg:px-3 ${
                  active ? "text-teal-700 lg:bg-teal-50" : "text-slate-500 lg:text-slate-700 lg:hover:bg-slate-100"
                }`}
              >
                <Icon className="hidden size-5 lg:block" />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
