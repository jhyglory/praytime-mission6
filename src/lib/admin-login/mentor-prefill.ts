import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { getAdminAccessState } from "../prayers/admin-access";
import { getMentorCredentials } from "../prayers/admin-credentials";
import { adminRequestOrigin } from "../prayers/admin-request";

const NAMESPACE = "PrayTime mentor prefill v1\0";
const GRANT_SECONDS = 7 * 24 * 60 * 60;
const COOKIE_SECONDS = 300;
const MAX_TOKEN_LENGTH = 2048;
const MAX_PASSWORD_BYTES = 1024;
const COOKIE_NAME = "__Host-pt_mentor_prefill";
const AAD = Buffer.from(NAMESPACE);
const PAYLOAD_KEYS = "aud,exp,iat,password,sub,username,v";

interface PrefillCredentials { username: string; password: string }

function context(origin: string) {
  let url: URL;
  try { url = new URL(origin); } catch { return null; }
  if (url.protocol !== "https:" || url.origin !== origin || origin.length > 512) return null;
  const state = getAdminAccessState(origin);
  if (state.mode !== "protected-demo" || !state.enabled) return null;
  const mentor = getMentorCredentials();
  const secret = process.env.CMS_ADMIN_SESSION_SECRET;
  if (!mentor || !secret || secret.length < 32) return null;
  const key = createHmac("sha256", secret).update(NAMESPACE)
    .update(mentor.username).update("\0").update(mentor.passwordHash).digest();
  return { key, mentor, origin };
}

function validPassword(password: unknown, expectedHash: string): password is string {
  if (typeof password !== "string" || !password || Buffer.byteLength(password) > MAX_PASSWORD_BYTES) return false;
  return timingSafeEqual(createHash("sha256").update(password).digest(), Buffer.from(expectedHash, "hex"));
}

function envelope(token: string): Buffer | null {
  if (typeof token !== "string" || !token || token.length > MAX_TOKEN_LENGTH || !/^[A-Za-z0-9_-]+$/.test(token)) return null;
  const bytes = Buffer.from(token, "base64url");
  // Version byte, 12-byte IV, 16-byte GCM tag, then nonempty ciphertext.
  if (bytes.length <= 29 || bytes[0] !== 1 || bytes.toString("base64url") !== token) return null;
  return bytes;
}

/** A credential-prefill capability only. It never creates an authenticated CMS session. */
export function createMentorPrefillGrant(password: string, origin: string, now = Date.now()): string | null {
  const configured = context(origin);
  const iat = Math.floor(now / 1000);
  const exp = iat + GRANT_SECONDS;
  if (!configured || !Number.isSafeInteger(iat) || !Number.isSafeInteger(exp) || iat < 0 || !validPassword(password, configured.mentor.passwordHash)) return null;
  const plaintext = Buffer.from(JSON.stringify({
    v: 1, sub: "mentor", iat, exp, aud: configured.origin,
    username: configured.mentor.username, password,
  }));
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", configured.key, iv);
  cipher.setAAD(AAD);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const token = Buffer.concat([Buffer.from([1]), iv, cipher.getAuthTag(), ciphertext]).toString("base64url");
  return token.length <= MAX_TOKEN_LENGTH ? token : null;
}

export function readMentorPrefillGrant(token: string, origin: string, now = Date.now()): PrefillCredentials | null {
  const configured = context(origin);
  const bytes = envelope(token);
  const seconds = Math.floor(now / 1000);
  if (!configured || !bytes || !Number.isSafeInteger(seconds) || seconds < 0) return null;
  try {
    const decipher = createDecipheriv("aes-256-gcm", configured.key, bytes.subarray(1, 13));
    decipher.setAAD(AAD);
    decipher.setAuthTag(bytes.subarray(13, 29));
    const plaintext = Buffer.concat([decipher.update(bytes.subarray(29)), decipher.final()]);
    const payload = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(plaintext));
    if (!payload || typeof payload !== "object" || Array.isArray(payload)
      || Object.keys(payload).sort().join(",") !== PAYLOAD_KEYS
      || payload.v !== 1 || payload.sub !== "mentor" || payload.aud !== configured.origin
      || payload.username !== configured.mentor.username
      || !Number.isSafeInteger(payload.iat) || !Number.isSafeInteger(payload.exp)
      || payload.iat < 0 || payload.iat > seconds + 30 || payload.exp <= seconds
      || payload.exp <= payload.iat || payload.exp - payload.iat > GRANT_SECONDS
      || !validPassword(payload.password, configured.mentor.passwordHash)) return null;
    return { username: configured.mentor.username, password: payload.password };
  } catch { return null; }
}

export function mentorPrefillCookieName(): string { return COOKIE_NAME; }

export function mentorPrefillCookie(token: string | null): string {
  const safeToken = token && envelope(token) ? token : null;
  return `${COOKIE_NAME}=${safeToken ?? ""}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${safeToken ? COOKIE_SECONDS : 0}`;
}

/** No cookie-name, owner-principal, alternate-host, or authentication fallback. */
export function mentorPrefillFromRequest(request: Request, now = Date.now()): PrefillCredentials | null {
  if (!request.headers.get("host")) return null;
  const origin = adminRequestOrigin(request, false);
  if (!origin) return null;
  const values = (request.headers.get("cookie") ?? "").split(";").flatMap(part => {
    const separator = part.indexOf("=");
    return separator >= 0 && part.slice(0, separator).trim() === COOKIE_NAME ? [part.slice(separator + 1).trim()] : [];
  });
  return values.length === 1 ? readMentorPrefillGrant(values[0], origin, now) : null;
}
