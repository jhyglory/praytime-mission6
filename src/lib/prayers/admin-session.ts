import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { getAdminCredentials, getMentorCredentials, type AdminPrincipal } from "./admin-credentials";
import { adminRequestOrigin } from "./admin-request";

export const ADMIN_SESSION_SECONDS = 8 * 60 * 60;
const localCookie = "pt_admin_session";
const secureCookie = "__Host-pt_admin_session";
const MAX_TOKEN_BYTES = 2048;

function signingKey(principal: AdminPrincipal = "owner"): Buffer | null {
  const secret = process.env.CMS_ADMIN_SESSION_SECRET;
  const credentials = principal === "owner" ? getAdminCredentials() : principal === "mentor" ? getMentorCredentials() : null;
  if (!secret || secret.length < 32 || !credentials) return null;
  // Current credentials are key material, never a readable token fingerprint.
  // Changing either credentials or the random session secret invalidates prior tokens.
  return createHmac("sha256", secret).update(principal === "owner" ? "PrayTime CMS session v1\0" : "PrayTime CMS mentor session v2\0")
    .update(credentials.username).update("\0").update(credentials.passwordHash).digest();
}

export function adminSessionConfigured(principal: AdminPrincipal = "owner"): boolean { return signingKey(principal) !== null; }
export function adminSessionCookieName(): string { return process.env.CMS_ADMIN_MODE === "local" ? localCookie : secureCookie; }

function tokenFromRequest(request: Request): string | null {
  const name = adminSessionCookieName();
  const values = (request.headers.get("cookie") ?? "").split(";").flatMap(part => {
    const separator = part.indexOf("=");
    return separator >= 0 && part.slice(0, separator).trim() === name ? [part.slice(separator + 1).trim()] : [];
  });
  return values.length === 1 && values[0].length <= MAX_TOKEN_BYTES ? values[0] : null;
}

export function createAdminSession(request: Request, now = Date.now(), principal: AdminPrincipal = "owner"): string | null {
  const key = signingKey(principal);
  const aud = adminRequestOrigin(request, process.env.CMS_ADMIN_MODE === "local");
  if (!key || !aud) return null;
  const iat = Math.floor(now / 1000);
  const payload = Buffer.from(JSON.stringify({ v: principal === "mentor" ? 2 : 1, iat, exp: iat + ADMIN_SESSION_SECONDS, sid: randomBytes(16).toString("hex"), aud,
    ...(principal === "mentor" ? { sub: "mentor" } : {}),
  })).toString("base64url");
  return `${payload}.${createHmac("sha256", key).update(payload).digest("base64url")}`;
}

export function hasAdminSession(request: Request, now = Date.now()): boolean {
  const token = tokenFromRequest(request);
  const aud = adminRequestOrigin(request, process.env.CMS_ADMIN_MODE === "local");
  if (!token || !aud) return false;
  const pieces = token.split(".");
  if (pieces.length !== 2 || !/^[A-Za-z0-9_-]+$/.test(pieces[0]) || !/^[A-Za-z0-9_-]{43}$/.test(pieces[1])) return false;
  const payloadBytes = Buffer.from(pieces[0], "base64url");
  const signature = Buffer.from(pieces[1], "base64url");
  if (payloadBytes.toString("base64url") !== pieces[0] || signature.toString("base64url") !== pieces[1]) return false;
  try {
    const payload = JSON.parse(payloadBytes.toString("utf8"));
    if (payload === null || typeof payload !== "object" || Array.isArray(payload)) return false;
    const keys = Object.keys(payload).sort().join(",");
    const principal: AdminPrincipal | null = payload.v === 1 && keys === "aud,exp,iat,sid,v" ? "owner"
      : payload.v === 2 && payload.sub === "mentor" && keys === "aud,exp,iat,sid,sub,v" ? "mentor" : null;
    if (!principal) return false;
    const key = signingKey(principal);
    if (!key) return false;
    const expected = createHmac("sha256", key).update(pieces[0]).digest();
    if (signature.length !== expected.length || !timingSafeEqual(signature, expected)) return false;
    const seconds = Math.floor(now / 1000);
    return payload.aud === aud && typeof payload.sid === "string" && /^[a-f0-9]{32}$/.test(payload.sid)
      && Number.isSafeInteger(payload.iat) && Number.isSafeInteger(payload.exp)
      && payload.iat <= seconds + 30 && payload.iat >= 0 && payload.exp > seconds
      && payload.exp > payload.iat && payload.exp - payload.iat <= ADMIN_SESSION_SECONDS;
  } catch { return false; }
}

export function adminSessionCookie(token: string | null): string {
  const secure = process.env.CMS_ADMIN_MODE !== "local";
  return `${adminSessionCookieName()}=${token ?? ""}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${token ? ADMIN_SESSION_SECONDS : 0}${secure ? "; Secure" : ""}`;
}
