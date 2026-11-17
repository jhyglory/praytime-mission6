import type { Metadata } from "next";
import { headers } from "next/headers";
import { AdminLoginConnected } from "@/components/admin-login/admin-login-connected";
import { AdminLoginScreen } from "@/components/admin-login/admin-login-screen";
import { getMentorCredentials } from "@/lib/prayers/admin-credentials";
import { mentorPrefillFromRequest } from "@/lib/admin-login/mentor-prefill";
import "./login.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "관리자 로그인 | PrayTime", robots: { index: false, follow: false }, referrer: "no-referrer" };

export default async function AdminLoginPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  let initialUsername = "";
  let initialPassword: string | undefined;
  if (params.account === "mentor") {
    const request = new Request("https://localhost/admin/login", { headers: await headers() });
    const prefill = mentorPrefillFromRequest(request);
    initialUsername = prefill?.username ?? getMentorCredentials()?.username ?? "";
    if (prefill) initialPassword = prefill.password;
  }
  return <AdminLoginScreen><AdminLoginConnected initialUsername={initialUsername} {...(initialPassword !== undefined ? { initialPassword } : {})} /></AdminLoginScreen>;
}
