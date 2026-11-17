import type { Metadata } from "next";
import { AdminLoginConnected } from "@/components/admin-login/admin-login-connected";
import { AdminLoginScreen } from "@/components/admin-login/admin-login-screen";
import { getMentorCredentials } from "@/lib/prayers/admin-credentials";
import "./login.css";

export const metadata: Metadata = { title: "관리자 로그인 | PrayTime", robots: { index: false, follow: false } };

export default async function AdminLoginPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const initialUsername = params.account === "mentor" ? getMentorCredentials()?.username ?? "" : "";
  return <AdminLoginScreen><AdminLoginConnected initialUsername={initialUsername} /></AdminLoginScreen>;
}
