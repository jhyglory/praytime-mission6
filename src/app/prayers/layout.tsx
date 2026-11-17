import type { Metadata } from "next";
import { PrayerShell } from "@/components/prayers/prayer-shell";
import "../mission6.css";

export const metadata: Metadata = { title: "기도 가이드 | PrayTime", description: "잠깐 멈추고, 기도하고, 다시 선택하는 PrayTime 기도 가이드입니다." };

export default function PrayerLayout({ children }: { children: React.ReactNode }) {
  return <PrayerShell>{children}</PrayerShell>;
}
