import type { Metadata } from "next";
import { AdminFrame } from "@/components/admin-login/admin-frame";
import "../mission6.css";

export const metadata: Metadata = { title: "기도 가이드 관리 | PrayTime", robots: { index: false, follow: false } };

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminFrame>{children}</AdminFrame>;
}
