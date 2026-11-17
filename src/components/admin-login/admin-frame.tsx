"use client";

import { usePathname } from "next/navigation";
import { PrayerShell } from "@/components/prayers/prayer-shell";

/** Only the new login page has its own visual frame. The URL's security remains in Proxy. */
export function AdminFrame({ children }: { children: React.ReactNode }) {
  return usePathname() === "/admin/login" ? children : <PrayerShell admin>{children}</PrayerShell>;
}
