import { createHash } from "node:crypto";
import { isIP } from "node:net";
import { getAdminAccessState, guardAdminMutationRequest } from "../prayers/admin-access";
import { authenticateAdminCredentials } from "../prayers/admin-credentials";
import { adminSessionConfigured, createAdminSession, hasAdminSession, adminSessionCookie } from "../prayers/admin-session";
import { prayerJSON } from "../prayers/errors";

const MAX_LOGIN_BODY_BYTES = 4096;

/** Bounded best-effort per-instance backoff, deliberately not a distributed counter. */
export function createLoginLimiter(limit = 5, windowMs = 60_000, maximumEntries = 1000) {
  const failures = new Map<string, { attempts: number; expires: number }>();
  return {
    consume(key: string, now: number) {
      for (const [entry, value] of failures) if (value.expires <= now) failures.delete(entry);
      const value = failures.get(key);
      if (!value && failures.size >= maximumEntries) return 60;
      if (value && value.attempts >= limit) return Math.max(1, Math.ceil((value.expires - now) / 1000));
      failures.set(key, { attempts: (value?.attempts ?? 0) + 1, expires: value?.expires ?? now + windowMs });
      return 0;
    },
    reset(key: string) { failures.delete(key); },
  };
}

function error(status: number, code: string, message: string, headers?: HeadersInit) {
  return prayerJSON({ error: { code, message } }, status, headers);
}

export function createAdminSessionApi({ now = Date.now, limiter = createLoginLimiter() } = {}) {
  const enabled = (request: Request) => {
    const state = getAdminAccessState(request.url);
    return state.enabled ? null : error(403, "ADMIN_DISABLED", state.reason);
  };
  return {
    async POST(request: Request): Promise<Response> {
      const denied = enabled(request) ?? guardAdminMutationRequest(request, MAX_LOGIN_BODY_BYTES);
      if (denied) return denied;
      if (!adminSessionConfigured()) return error(503, "LOGIN_NOT_CONFIGURED", "관리자 로그인 연결 설정을 확인해 주세요.");
      if (!/^application\/json(?:;|$)/i.test(request.headers.get("content-type") ?? "")) return error(415, "JSON_REQUIRED", "로그인 화면에서 다시 시도해 주세요.");
      const rawIP = process.env.VERCEL ? request.headers.get("x-vercel-forwarded-for")?.split(",")[0].trim() : "127.0.0.1";
      const key = createHash("sha256").update(rawIP && isIP(rawIP) ? rawIP : "unknown").digest("hex");
      const retry = limiter.consume(key, now());
      if (retry) return error(429, "LOGIN_RATE_LIMITED", "잠시 후 다시 로그인해 주세요.", { "Retry-After": String(retry) });
      let bytes: Uint8Array;
      try {
        if (!request.body) return error(400, "INVALID_LOGIN", "아이디와 비밀번호를 입력해 주세요.");
        const reader = request.body.getReader();
        const chunks: Uint8Array[] = [];
        let size = 0;
        try {
          while (true) {
            const chunk = await reader.read();
            if (chunk.done) break;
            size += chunk.value.byteLength;
            if (size > MAX_LOGIN_BODY_BYTES) { await reader.cancel(); return error(413, "REQUEST_TOO_LARGE", "로그인 요청 크기를 확인해 주세요."); }
            chunks.push(chunk.value);
          }
        } finally { reader.releaseLock(); }
        bytes = new Uint8Array(size);
        let offset = 0;
        for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
      } catch { return error(400, "INVALID_LOGIN", "로그인 화면에서 다시 시도해 주세요."); }
      let credentials: unknown;
      try { credentials = JSON.parse(new TextDecoder().decode(bytes)); }
      catch { return error(400, "INVALID_LOGIN", "로그인 화면에서 다시 시도해 주세요."); }
      if (!credentials || typeof credentials !== "object" || Array.isArray(credentials)
        || Object.keys(credentials).sort().join(",") !== "password,username"
        || !("username" in credentials) || !("password" in credentials)
        || typeof credentials.username !== "string" || typeof credentials.password !== "string"
        || credentials.username.trim().length > 80 || Buffer.byteLength(credentials.password) > 1024) {
        return error(400, "INVALID_LOGIN", "아이디와 비밀번호를 확인해 주세요.");
      }
      const principal = authenticateAdminCredentials(credentials.username.trim(), credentials.password);
      if (!principal) return error(401, "INVALID_CREDENTIALS", "아이디 또는 비밀번호를 확인해 주세요.");
      const token = createAdminSession(request, now(), principal);
      if (!token) return error(503, "LOGIN_NOT_CONFIGURED", "관리자 로그인 연결 설정을 확인해 주세요.");
      limiter.reset(key);
      return prayerJSON({ authenticated: true }, 200, { "Set-Cookie": adminSessionCookie(token) });
    },
    async GET(request: Request): Promise<Response> {
      const denied = enabled(request);
      if (denied) return denied;
      return hasAdminSession(request, now()) ? prayerJSON({ authenticated: true }) : error(401, "ADMIN_ACCESS_REQUIRED", "관리자 로그인이 필요합니다.");
    },
    async DELETE(request: Request): Promise<Response> {
      const denied = enabled(request) ?? guardAdminMutationRequest(request, MAX_LOGIN_BODY_BYTES);
      if (denied) return denied;
      return prayerJSON({ authenticated: false }, 200, { "Set-Cookie": adminSessionCookie(null) });
    },
  };
}
