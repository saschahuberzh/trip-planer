import type { Metadata, Viewport } from "next";
import { DatabaseStatusBanner } from "@/components/database/DatabaseStatusBanner";
import { CloudBackupAgent } from "@/components/cloud/CloudBackupAgent";
import { GlobalNav } from "@/components/navigation/GlobalNav";
import { OfflineIndicator } from "@/components/pwa/OfflineIndicator";
import { UpdatePrompt } from "@/components/pwa/UpdatePrompt";
import { APP_DESCRIPTION, APP_NAME, APP_SHORT_NAME, THEME_COLOR } from "@/lib/app";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: APP_NAME, template: `%s · ${APP_SHORT_NAME}` },
  description: APP_DESCRIPTION,
  applicationName: APP_NAME,
  appleWebApp: { capable: true, title: APP_SHORT_NAME, statusBarStyle: "default" },
  formatDetection: { telephone: false },
  // Next.js only emits the standard "mobile-web-app-capable"; older iOS versions need this one
  // (newer ones also read `display: standalone` from the manifest).
  other: { "apple-mobile-web-app-capable": "yes" },
  icons: {
    icon: [
      { url: "/icons/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: THEME_COLOR,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="flex min-h-full flex-col pt-[env(safe-area-inset-top)] pr-[env(safe-area-inset-right)] pl-[env(safe-area-inset-left)]">
        <DatabaseStatusBanner />
        <OfflineIndicator />
        <main className="flex-1 pb-[calc(4rem+env(safe-area-inset-bottom))] lg:pb-0 lg:pl-56">{children}</main>
        <GlobalNav />
        <UpdatePrompt />
        <CloudBackupAgent />
      </body>
    </html>
  );
}
