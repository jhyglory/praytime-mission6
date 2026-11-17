import { createHash, timingSafeEqual } from "node:crypto";
import { MAX_CMS_REQUEST_BYTES } from "./schema";
import { prayerJSON } from "./errors";

export interface AdminAccessState {
  mode: "disabled" | "local" | "protected-demo";
  enabled: boolean;
  reason: string;
}

function demoGatewayConfiguration(): { username: string; passwordHash: string } | null {
  const username = process.env.CMS_ADMIN_USERNAME;
  const passwordHash = process.env.CMS_ADMIN_PASSWORD_SHA256;
  if (username || passwordHash) {
    if (!username || !/^[A-Za-z0-9._-]{1,80}$/.test(username) || !/^[a-f0-9]{64}$/i.test(passwordHash ?? "")) return null;
    return { username, passwordHash: passwordHash!.toLowerCase() };
  }
  const legacyKey = process.env.CMS_ADMIN_ACCESS_KEY;
  if (!legacyKey || legacyKey.length < 32) return null;
  return { username: "demo", passwordHash: createHash("sha256").update(legacyKey).digest("hex") };
}

/** Configuration state for server-rendered UI; authorization always uses guardAdminRequest. */
export function getAdminAccessState(requestUrl?: string | URL): AdminAccessState {
  const mode = process.env.CMS_ADMIN_MODE;
  if (mode === "local") {
    let isLocalUrl = !requestUrl;
    try { if (requestUrl) isLocalUrl = ["localhost", "127.0.0.1"].includes(new URL(requestUrl).hostname); } catch { isLocalUrl = false; }
    const enabled = !process.env.VERCEL && !process.env.VERCEL_ENV && isLocalUrl && process.env.CMS_DEMO_ENV === "true";
    return { mode, enabled, reason: enabled ? "로컬 관리자 모드입니다." : "관리자 기능은 로컬 개발 환경에서만 사용할 수 있습니다." };
  }
  if (mode === "protected-demo") {
    const enabled = process.env.VERCEL_ENV === "preview"
      && process.env.CMS_DEMO_ENV === "true"
      && process.env.CMS_DEPLOYMENT_PROTECTION === "verified"
      && demoGatewayConfiguration() !== null;
    return { mode, enabled, reason: enabled ? "접근이 보호된 미리보기 관리자 모드입니다." : "보호된 미리보기 환경이 확인되지 않아 관리자 기능을 사용할 수 없습니다." };
  }
  return { mode: "disabled", enabled: false, reason: "관리자 기능이 비활성화되어 있습니다. 로컬 또는 접근이 보호된 미리보기 환경에서만 사용할 수 있습니다." };
}

function hasDemoAccess(request: Request): boolean {
  const authorization = request.headers.get("authorization") ?? "";
  const match = /^Basic ([A-Za-z0-9+/]+={0,2})$/i.exec(authorization);
  let credentials = "";
  if (match && match[1].length <= 4096 && match[1].length % 4 === 0) {
    try { credentials = Buffer.from(match[1], "base64").toString("utf8"); } catch { /* Invalid credentials fail closed. */ }
  }
  const configuration = demoGatewayConfiguration();
  if (!configuration) return false;
  const separator = credentials.indexOf(":");
  if (separator < 1) return false;
  const digest = (value: string) => createHash("sha256").update(value).digest();
  const usernameMatches = timingSafeEqual(digest(credentials.slice(0, separator)), digest(configuration.username));
  const passwordMatches = timingSafeEqual(digest(credentials.slice(separator + 1)), Buffer.from(configuration.passwordHash, "hex"));
  return usernameMatches && passwordMatches;
}

function mutationOrigin(request: Request, mode: AdminAccessState["mode"]): string | null {
  const requestUrl = new URL(request.url);
  // Next's worker can normalize request.url to localhost. Host retains the actual
  // browser authority. This comparison happens only AFTER mode and Basic checks;
  // neither Host nor any forwarded header grants administrator access.
  const host = request.headers.get("host") ?? requestUrl.host;
  if (host.length > 259 || !/^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?(?::\d{1,5})?$/i.test(host)
    || host.includes("..") || /[\s,@/\\?#]/.test(host)) return null;
  try {
    if (mode === "local") {
      if (!["http:", "https:"].includes(requestUrl.protocol)) return null;
      const actual = new URL(`${requestUrl.protocol}//${host}`);
      const loopback = ["localhost", "127.0.0.1"];
      if (!loopback.includes(requestUrl.hostname) || !loopback.includes(actual.hostname) || actual.port !== requestUrl.port) return null;
      return actual.origin;
    }
    // Protected Vercel previews terminate TLS before the internal worker.
    return new URL(`https://${host}`).origin;
  } catch { return null; }
}

/** A custom header, query parameter, hostname header, or client UI flag never grants access. */
export function guardAdminRequest(request: Request, options: { mutation?: boolean } = {}): Response | null {
  const state = getAdminAccessState(request.url);
  if (!state.enabled) return prayerJSON({ error: { code: "ADMIN_DISABLED", message: state.reason } }, 403);
  if (state.mode === "protected-demo" && !hasDemoAccess(request)) {
    return prayerJSON({ error: { code: "ADMIN_ACCESS_REQUIRED", message: "보호된 관리자 미리보기의 접근 키가 필요합니다." } }, 401,
      { "WWW-Authenticate": 'Basic realm="PrayTime CMS", charset="UTF-8"' });
  }
  const mutation = options.mutation ?? !["GET", "HEAD", "OPTIONS"].includes(request.method);
  if (mutation) {
    const origin = request.headers.get("origin");
    if (!origin || origin !== mutationOrigin(request, state.mode) || request.headers.get("sec-fetch-site") === "cross-site") {
      return prayerJSON({ error: { code: "ORIGIN_REJECTED", message: "현재 관리자 화면에서 다시 요청해 주세요." } }, 403);
    }
    const length = request.headers.get("content-length");
    if (length && (!/^\d+$/.test(length) || Number(length) > MAX_CMS_REQUEST_BYTES)) {
      return prayerJSON({ error: { code: "REQUEST_TOO_LARGE", message: "요청 크기가 허용 범위를 초과했습니다." } }, 413);
    }
  }
  return null;
}
