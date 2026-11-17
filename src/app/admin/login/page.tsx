import type { Metadata } from "next";
import { AdminLoginConnected } from "@/components/admin-login/admin-login-connected";
import { AdminLoginScreen } from "@/components/admin-login/admin-login-screen";
import "./login.css";

export const metadata: Metadata = { title: "관리자 로그인 | PrayTime", robots: { index: false, follow: false } };

export default function AdminLoginPage() {
  return <AdminLoginScreen><AdminLoginConnected /></AdminLoginScreen>;
}
