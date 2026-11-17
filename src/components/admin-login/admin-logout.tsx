"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";

export function AdminLogout() {
  const router = useRouter();
  const errorId = useId();
  const busy = useRef(false);
  const controller = useRef<AbortController | null>(null);
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => () => controller.current?.abort(), []);

  async function logout() {
    if (busy.current) return;
    busy.current = true;
    const request = new AbortController();
    controller.current = request;
    setPending(true);
    setFailed(false);

    try {
      const response = await fetch("/api/admin/session", {
        method: "DELETE",
        credentials: "same-origin",
        cache: "no-store",
        headers: { Accept: "application/json" },
        signal: request.signal,
      });
      if (response.status !== 200) throw new Error("Logout unavailable");
      const payload: unknown = await response.json();
      if (!payload || typeof payload !== "object" || !("authenticated" in payload) || payload.authenticated !== false) {
        throw new Error("Logout not confirmed");
      }
      if (request.signal.aborted) return;
      router.replace("/admin/login");
      router.refresh();
    } catch {
      if (request.signal.aborted) return;
      busy.current = false;
      setPending(false);
      setFailed(true);
    }
  }

  return <div className="m6-admin-logout-group">
    <button
      className="m6-admin-logout"
      type="button"
      disabled={pending}
      aria-busy={pending}
      aria-describedby={failed ? errorId : undefined}
      onClick={logout}
    >{pending ? "로그아웃 중…" : "로그아웃"}</button>
    {failed && <p className="m6-admin-logout-error" role="alert" id={errorId}>
      로그아웃하지 못했습니다. 다시 시도해 주세요.
    </p>}
  </div>;
}
