import type { Metadata } from "next";
import { PrayerShell } from "@/components/prayers/prayer-shell";
import "../mission6.css";

export const metadata: Metadata = { title: "기도 가이드 관리 | PrayTime", robots: { index: false, follow: false } };

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <PrayerShell admin>{children}</PrayerShell>;
}
