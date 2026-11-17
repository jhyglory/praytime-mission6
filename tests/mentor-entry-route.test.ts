import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "../src/app/admin/login/mentor/route";
import { proxy } from "../src/proxy";
import { createMentorPrefillGrant, mentorPrefillCookieName } from "../src/lib/admin-login/mentor-prefill";
import { guardAdminRequest } from "../src/lib/prayers/admin-access";
import { adminSessionCookieName, hasAdminSession } from "../src/lib/prayers/admin-session";
import { createAdminSessionApi } from "../src/lib/admin-login/session-api";

const ORIGIN = "https://private-mentor.example";
const PASSWORD = "synthetic-entry-only-password";
const hash = (value: string) => createHash("sha256").update(value).digest("hex");

beforeEach(() => {
  vi.stubEnv("CMS_ADMIN_MODE", "protected-demo");
  vi.stubEnv("CMS_DEMO_ENV", "true");
  vi.stubEnv("CMS_DEPLOYMENT_PROTECTION", "verified");
  vi.stubEnv("VERCEL_ENV", "preview");
  vi.stubEnv("CMS_ADMIN_USERNAME", "unit-owner");
  vi.stubEnv("CMS_ADMIN_PASSWORD_SHA256", hash("synthetic-owner-password"));
  vi.stubEnv("CMS_ADMIN_SESSION_SECRET", "synthetic-private-prefill-master-secret-only");
  vi.stubEnv("CMS_MENTOR_USERNAME", "unit-mentor");
  vi.stubEnv("CMS_MENTOR_PASSWORD_SHA256", hash(PASSWORD));
});
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });

function token() { const result = createMentorPrefillGrant(PASSWORD, ORIGIN); expect(result).not.toBeNull(); return result!; }
function entry(query: string) { return new Request(`${ORIGIN}/admin/login/mentor?${query}`, { headers: { host: new URL(ORIGIN).host } }); }

describe("protected mentor entry route", () => {
  it("sets only a short-lived encrypted prefill cookie and redirects to a clean fixed login", () => {
    const grant = token();
    const response = GET(entry(`entry=${grant}&next=https://elsewhere.example&password=ignored`));
    expect(response.status).toBe(303);
    expect(response.headers.get("Location")).toBe(`${ORIGIN}/admin/login?account=mentor`);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(response.headers.get("Referrer-Policy")).toBe("no-referrer");
    const cookie = response.headers.get("Set-Cookie")!;
    expect(cookie).toContain(`${mentorPrefillCookieName()}=${grant}`);
    for (const part of ["HttpOnly", "Secure", "SameSite=Lax", "Path=/", "Max-Age=300"]) expect(cookie).toContain(part);
    expect(cookie).not.toContain(PASSWORD);
    expect(cookie).not.toContain(`${adminSessionCookieName()}=`);
    const request = new Request(`${ORIGIN}/api/admin/prayers`, { headers: { host: new URL(ORIGIN).host, cookie: cookie.split(";")[0] } });
    expect(hasAdminSession(request)).toBe(false);
    expect(guardAdminRequest(request)?.status).toBe(401);
  });

  it.each(["", "entry=garbage", "entry=a&entry=b", `entry=${"a".repeat(3000)}`])("clears a stale prefill cookie for an invalid or duplicate grant", query => {
    const response = GET(entry(query));
    expect(response.status).toBe(303);
    expect(response.headers.get("Set-Cookie")).toContain(`${mentorPrefillCookieName()}=;`);
    expect(response.headers.get("Set-Cookie")).toContain("Max-Age=0");
    expect(response.headers.get("Location")).toBe(`${ORIGIN}/admin/login?account=mentor`);
  });

  it("does not accept an encrypted grant for a different actual host", () => {
    const request = new Request(`http://localhost:8080/admin/login/mentor?entry=${token()}`, { headers: { host: "another-preview.example" } });
    const response = GET(request);
    expect(response.status).toBe(303);
    expect(response.headers.get("Set-Cookie")).toContain("Max-Age=0");
    expect(response.headers.get("Location")).toBe("https://another-preview.example/admin/login?account=mentor");
  });

  it.each([["CMS_ADMIN_MODE", "disabled"], ["VERCEL_ENV", "production"], ["CMS_DEPLOYMENT_PROTECTION", "unverified"], ["CMS_ADMIN_MODE", "local"]])("keeps the entry disabled outside verified Preview (%s)", (name, value) => {
    vi.stubEnv(name, value);
    const response = GET(entry("entry=untrusted"));
    expect(response.status).toBe(403);
    expect(response.headers.has("Set-Cookie")).toBe(false);
  });

  it("allows only exact entry GET/HEAD through the existing protected page proxy", () => {
    for (const method of ["GET", "HEAD"]) {
      const response = proxy(new NextRequest(`${ORIGIN}/admin/login/mentor`, { method }));
      expect(response.headers.get("x-middleware-next")).toBe("1");
      expect(response.headers.get("Referrer-Policy")).toBe("no-referrer");
    }
    for (const path of ["/admin/login/mentor/extra", "/admin/login/mentor-extra"]) expect(proxy(new NextRequest(`${ORIGIN}${path}`)).status).toBe(303);
    expect(proxy(new NextRequest(`${ORIGIN}/admin/login/mentor`, { method: "POST" })).status).toBe(303);
    vi.stubEnv("VERCEL_ENV", "production");
    expect(proxy(new NextRequest(`${ORIGIN}/admin/login/mentor`)).status).toBe(403);
  });

  it("clears the prefill cookie after real login and logout without replacing the auth cookie", async () => {
    const api = createAdminSessionApi();
    const response = await api.POST(new Request(`${ORIGIN}/api/admin/session`, {
      method: "POST", headers: { origin: ORIGIN, "content-type": "application/json" },
      body: JSON.stringify({ username: "unit-mentor", password: PASSWORD }),
    }));
    expect(response.status).toBe(200);
    const cookies = response.headers.getSetCookie();
    expect(cookies).toHaveLength(2);
    expect(cookies[0]).toContain(`${adminSessionCookieName()}=`);
    expect(cookies[1]).toContain(`${mentorPrefillCookieName()}=;`);
    expect(cookies[1]).toContain("Max-Age=0");
    const logout = await api.DELETE(new Request(`${ORIGIN}/api/admin/session`, { method: "DELETE", headers: { origin: ORIGIN } }));
    expect(logout.headers.getSetCookie()).toHaveLength(2);
    expect(logout.headers.getSetCookie().every(cookie => cookie.includes("Max-Age=0"))).toBe(true);
  });
});
