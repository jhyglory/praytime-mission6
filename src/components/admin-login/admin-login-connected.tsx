"use client";

import { useRouter } from "next/navigation";
import { AdminLoginForm } from "./admin-login-form";
import { AdminLoginAuthenticationError, type AdminLoginAuthenticator } from "@/lib/admin-login/contracts";

/** Confirm the issued HttpOnly session before opening the protected administrator UI. */
export const authenticateAdminSession: AdminLoginAuthenticator = async (credentials, signal) => {
  try {
    const response = await fetch("/api/admin/session", {
      method: "POST",
      credentials: "same-origin",
      cache: "no-store",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ username: credentials.username.trim(), password: credentials.password }),
      signal,
    });
    if (response.status === 401) throw new AdminLoginAuthenticationError("invalid-credentials");
    if (response.status === 429) throw new AdminLoginAuthenticationError("rate-limited");
    if (response.status !== 200) throw new AdminLoginAuthenticationError("unavailable");
    const payload: unknown = await response.json();
    if (!payload || typeof payload !== "object" || !("authenticated" in payload) || payload.authenticated !== true) {
      throw new AdminLoginAuthenticationError("unavailable");
    }
    const confirmation = await fetch("/api/admin/session", {
      method: "GET",
      credentials: "same-origin",
      cache: "no-store",
      headers: { Accept: "application/json" },
      signal,
    });
    if (confirmation.status !== 200) throw new AdminLoginAuthenticationError("unavailable");
    const session: unknown = await confirmation.json();
    if (!session || typeof session !== "object" || !("authenticated" in session) || session.authenticated !== true) {
      throw new AdminLoginAuthenticationError("unavailable");
    }
  } catch (reason) {
    if (signal.aborted || reason instanceof AdminLoginAuthenticationError) throw reason;
    throw new AdminLoginAuthenticationError("unavailable");
  }
};

export function AdminLoginConnected() {
  const router = useRouter();
  return <AdminLoginForm authenticate={authenticateAdminSession} onAuthenticated={() => {
    router.replace("/admin/prayers");
    router.refresh();
  }} />;
}
