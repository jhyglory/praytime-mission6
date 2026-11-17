import { MAX_CMS_REQUEST_BYTES } from "./schema";
import { prayerJSON } from "./errors";
import { getAdminCredentials, hasAdminBasicCredentials } from "./admin-credentials";
import { hasAdminSession } from "./admin-session";
import { adminRequestOrigin } from "./admin-request";

export interface AdminAccessState {
  mode: "disabled" | "local" | "protected-demo";
  enabled: boolean;
  reason: string;
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
      && getAdminCredentials() !== null;
    return { mode, enabled, reason: enabled ? "접근이 보호된 미리보기 관리자 모드입니다." : "보호된 미리보기 환경이 확인되지 않아 관리자 기능을 사용할 수 없습니다." };
  }
  return { mode: "disabled", enabled: false, reason: "관리자 기능이 비활성화되어 있습니다. 로컬 또는 접근이 보호된 미리보기 환경에서만 사용할 수 있습니다." };
}

/** A custom header, query parameter, hostname header, or client UI flag never grants access. */
export function guardAdminRequest(request: Request, options: { mutation?: boolean; sessionOnly?: boolean } = {}): Response | null {
  const state = getAdminAccessState(request.url);
  if (!state.enabled) return prayerJSON({ error: { code: "ADMIN_DISABLED", message: state.reason } }, 403);
  if (state.mode === "protected-demo" && !hasAdminSession(request) && (options.sessionOnly || !hasAdminBasicCredentials(request))) {
    return prayerJSON({ error: { code: "ADMIN_ACCESS_REQUIRED", message: "관리자 로그인이 필요합니다." } }, 401);
  }
  const mutation = options.mutation ?? !["GET", "HEAD", "OPTIONS"].includes(request.method);
  if (mutation) {
    return guardAdminMutationRequest(request);
  }
  return null;
}

/** Same-origin and body envelope only. This does not authorize access to CMS data. */
export function guardAdminMutationRequest(request: Request, maximum = MAX_CMS_REQUEST_BYTES): Response | null {
  const state = getAdminAccessState(request.url);
  if (!state.enabled) return prayerJSON({ error: { code: "ADMIN_DISABLED", message: state.reason } }, 403);
  const origin = request.headers.get("origin");
  if (!origin || origin !== adminRequestOrigin(request, state.mode === "local") || request.headers.get("sec-fetch-site") === "cross-site") {
    return prayerJSON({ error: { code: "ORIGIN_REJECTED", message: "현재 관리자 화면에서 다시 요청해 주세요." } }, 403);
  }
  const length = request.headers.get("content-length");
  if (length && (!/^\d+$/.test(length) || Number(length) > maximum)) {
    return prayerJSON({ error: { code: "REQUEST_TOO_LARGE", message: "요청 크기가 허용 범위를 초과했습니다." } }, 413);
  }
  return null;
}
