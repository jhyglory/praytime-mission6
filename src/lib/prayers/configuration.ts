import { PrayerError } from "./errors";
import type { PrayerScope } from "./repository";

function configurationError(): never {
  throw new PrayerError(503, "CMS_NOT_CONFIGURED", "기도문 저장소 설정이 준비되지 않았습니다. 관리자에게 연결 설정을 확인해 주세요.");
}

function legacyRole(key: string): unknown {
  try { return JSON.parse(Buffer.from(key.split(".")[1], "base64url").toString("utf8")).role; }
  catch { return null; }
}

/** Pure validation; only server.ts reads credentials from the process environment. */
export function validatePrayerConfiguration(rawUrl: string | undefined, key: string | undefined, scope: PrayerScope): { url: string; key: string } {
  if (!rawUrl || !key) return configurationError();
  let url: URL;
  try { url = new URL(rawUrl); } catch { return configurationError(); }
  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash || !["", "/"].includes(url.pathname)) return configurationError();
  // A mistaken CMS binding must never reach the existing Mission 5 signup project.
  if (url.hostname === "yxiubxjpapiacvhbkxvd.supabase.co") return configurationError();
  const valid = scope === "public"
    ? key.startsWith("sb_publishable_") || (key.startsWith("eyJ") && legacyRole(key) === "anon")
    : key.startsWith("sb_secret_") || (key.startsWith("eyJ") && legacyRole(key) === "service_role");
  if (!valid) return configurationError();
  return { url: url.origin, key };
}
