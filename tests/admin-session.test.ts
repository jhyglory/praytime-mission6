import { createHash, createHmac } from "node:crypto";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ADMIN_SESSION_SECONDS, adminSessionConfigured, adminSessionCookie, adminSessionCookieName,
  createAdminSession, hasAdminSession,
} from "../src/lib/prayers/admin-session";
import { guardAdminRequest } from "../src/lib/prayers/admin-access";
import { createAdminSessionApi, createLoginLimiter } from "../src/lib/admin-login/session-api";
import { proxy } from "../src/proxy";

// Public synthetic fixtures only. Never load a real environment file in this suite.
const USERNAME = "session-test-admin";
const PASSWORD = " unit-only:가짜-password ";
const PASSWORD_HASH = createHash("sha256").update(PASSWORD).digest("hex");
const SECRET = "synthetic-session-master-key-for-unit-tests-only";
const NOW = Date.UTC(2026, 10, 17, 12, 0, 0);
const ORIGIN = "https://cms-preview.example";
const ENDPOINT = `${ORIGIN}/api/admin/session`;
const VARIABLES = [
  "CMS_ADMIN_MODE", "CMS_DEMO_ENV", "CMS_DEPLOYMENT_PROTECTION", "CMS_ADMIN_USERNAME",
  "CMS_ADMIN_PASSWORD_SHA256", "CMS_ADMIN_ACCESS_KEY", "CMS_ADMIN_SESSION_SECRET",
  "VERCEL", "VERCEL_ENV", "VERCEL_URL", "VERCEL_BRANCH_URL", "VERCEL_PROJECT_PRODUCTION_URL",
];

beforeEach(() => {
  VARIABLES.forEach(name => vi.stubEnv(name, undefined));
  vi.stubEnv("CMS_ADMIN_MODE", "protected-demo");
  vi.stubEnv("CMS_DEMO_ENV", "true");
  vi.stubEnv("CMS_DEPLOYMENT_PROTECTION", "verified");
  vi.stubEnv("CMS_ADMIN_USERNAME", USERNAME);
  vi.stubEnv("CMS_ADMIN_PASSWORD_SHA256", PASSWORD_HASH);
  vi.stubEnv("CMS_ADMIN_SESSION_SECRET", SECRET);
  vi.stubEnv("VERCEL", "1");
  vi.stubEnv("VERCEL_ENV", "preview");
  vi.spyOn(Date, "now").mockReturnValue(NOW);
  vi.stubGlobal("fetch", vi.fn(() => { throw new Error("Session unit tests must never use a network or database"); }));
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

function cookieRequest(token: string, url = `${ORIGIN}/api/admin/prayers`, headers: HeadersInit = {}) {
  return new Request(url, { headers: { host: new URL(url).host, cookie: `${adminSessionCookieName()}=${token}`, ...Object.fromEntries(new Headers(headers)) } });
}
function tokenPayload(token: string): Record<string, unknown> {
  return JSON.parse(Buffer.from(token.split(".")[0], "base64url").toString("utf8"));
}
/** Sign malformed data with a known fixture key, so rejection tests reach the payload validator. */
function signedPayload(payload: Record<string, unknown>) {
  const key = createHmac("sha256", SECRET).update("PrayTime CMS session v1\0")
    .update(USERNAME).update("\0").update(PASSWORD_HASH).digest();
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${encoded}.${createHmac("sha256", key).update(encoded).digest("base64url")}`;
}
function token() {
  const result = createAdminSession(new Request(`${ORIGIN}/admin/login`), NOW);
  expect(result).not.toBeNull();
  return result!;
}
function loginRequest(payload: unknown = { username: USERNAME, password: PASSWORD }, options: {
  url?: string; headers?: Record<string, string>; includeOrigin?: boolean; rawBody?: BodyInit;
} = {}) {
  const url = options.url ?? ENDPOINT;
  return new Request(url, {
    method: "POST",
    headers: {
      host: new URL(url).host, "content-type": "application/json",
      ...(options.includeOrigin === false ? {} : { origin: new URL(url).origin }),
      ...options.headers,
    },
    body: options.rawBody ?? JSON.stringify(payload),
  });
}
const api = () => createAdminSessionApi({ now: () => NOW });
const basic = () => `Basic ${Buffer.from(`${USERNAME}:${PASSWORD}`).toString("base64")}`;

describe("signed administrator sessions", () => {
  it("issues unique eight-hour tokens without exposing credentials in their readable payload", () => {
    const first = token();
    const second = token();
    expect(first).not.toBe(second);
    const payload = tokenPayload(first);
    expect(Object.keys(payload).sort()).toEqual(["aud", "exp", "iat", "sid", "v"]);
    expect(payload).toMatchObject({ v: 1, iat: NOW / 1000, exp: NOW / 1000 + ADMIN_SESSION_SECONDS, aud: ORIGIN });
    expect(payload.sid).toMatch(/^[a-f0-9]{32}$/);
    for (const sensitive of [USERNAME, PASSWORD, PASSWORD_HASH, SECRET]) expect(JSON.stringify(payload)).not.toContain(sensitive);
    expect(hasAdminSession(cookieRequest(first), NOW)).toBe(true);
  });
  it("rejects a modified payload and a modified signature without throwing", () => {
    const original = token();
    const [encoded, signature] = original.split(".");
    const changed = Buffer.from(JSON.stringify({ ...tokenPayload(original), exp: NOW / 1000 + 1 })).toString("base64url");
    expect(hasAdminSession(cookieRequest(`${changed}.${signature}`), NOW)).toBe(false);
    const forged = `${encoded}.${signature[0] === "A" ? "B" : "A"}${signature.slice(1)}`;
    expect(() => hasAdminSession(cookieRequest(forged), NOW)).not.toThrow();
    expect(hasAdminSession(cookieRequest(forged), NOW)).toBe(false);
  });
  it.each(["", "not-a-token", "a.b.c", "payload.short", "a".repeat(2050)])("rejects malformed or oversized cookie tokens (%#)", bad => {
    expect(() => hasAdminSession(cookieRequest(bad), NOW)).not.toThrow();
    expect(hasAdminSession(cookieRequest(bad), NOW)).toBe(false);
  });
  it("rejects noncanonical base64url even when its decoded signature bytes match", () => {
    const [encoded, signature] = token().split(".");
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
    const last = alphabet.indexOf(signature.at(-1)!);
    const alternate = signature.slice(0, -1) + alphabet[last + 1];
    expect(Buffer.from(alternate, "base64url")).toEqual(Buffer.from(signature, "base64url"));
    expect(hasAdminSession(cookieRequest(`${encoded}.${alternate}`), NOW)).toBe(false);
  });
  it.each([
    { exp: NOW / 1000 },
    { iat: NOW / 1000 + 31, exp: NOW / 1000 + 100 },
    { iat: -1, exp: NOW / 1000 + 1 },
    { iat: NOW / 1000, exp: NOW / 1000 + ADMIN_SESSION_SECONDS + 1 },
    { iat: NOW / 1000, exp: NOW / 1000 },
    { iat: "1763380800" },
    { exp: NOW / 1000 + 0.5 },
  ])("rejects authenticated but invalid timestamp data (%#)", changes => {
    expect(hasAdminSession(cookieRequest(signedPayload({ ...tokenPayload(token()), ...changes })), NOW)).toBe(false);
  });
  it("expires exactly at the server-issued boundary", () => {
    const request = cookieRequest(token());
    expect(hasAdminSession(request, NOW + ADMIN_SESSION_SECONDS * 1000 - 1)).toBe(true);
    expect(hasAdminSession(request, NOW + ADMIN_SESSION_SECONDS * 1000)).toBe(false);
  });
  it.each([
    { v: 2 }, { aud: "https://another-preview.example" }, { role: "admin" },
    { sid: ["1234567890abcdef1234567890abcdef"] }, { sid: null },
  ])("rejects authenticated but invalid payload shape (%#)", changes => {
    expect(hasAdminSession(cookieRequest(signedPayload({ ...tokenPayload(token()), ...changes })), NOW)).toBe(false);
  });
  it("rejects a token missing a required payload field", () => {
    const payload = tokenPayload(token());
    delete payload.sid;
    expect(hasAdminSession(cookieRequest(signedPayload(payload)), NOW)).toBe(false);
  });
  it.each([
    ["CMS_ADMIN_USERNAME", "different-admin"],
    ["CMS_ADMIN_PASSWORD_SHA256", createHash("sha256").update("different-unit-only-password").digest("hex")],
    ["CMS_ADMIN_SESSION_SECRET", "different-synthetic-unit-session-master-secret"],
  ])("revokes existing cookies after %s changes", (name, value) => {
    const request = cookieRequest(token());
    vi.stubEnv(name, value);
    expect(hasAdminSession(request, NOW)).toBe(false);
  });
  it("fails closed for missing or short signing secrets and partial credential configuration", () => {
    const original = token();
    for (const secret of [undefined, "short"]) {
      vi.stubEnv("CMS_ADMIN_SESSION_SECRET", secret);
      expect(adminSessionConfigured()).toBe(false);
      expect(hasAdminSession(cookieRequest(original), NOW)).toBe(false);
    }
    vi.stubEnv("CMS_ADMIN_SESSION_SECRET", SECRET);
    vi.stubEnv("CMS_ADMIN_PASSWORD_SHA256", undefined);
    vi.stubEnv("CMS_ADMIN_ACCESS_KEY", "synthetic-legacy-key-longer-than-32-characters");
    expect(adminSessionConfigured()).toBe(false);
    expect(createAdminSession(new Request(`${ORIGIN}/admin/login`), NOW)).toBeNull();
  });
  it("binds tokens to their actual host and rejects duplicate named cookies", () => {
    const value = token();
    expect(hasAdminSession(cookieRequest(value, "https://another-preview.example/api/admin/prayers"), NOW)).toBe(false);
    expect(hasAdminSession(new Request(`${ORIGIN}/api/admin/prayers`, {
      headers: { cookie: `${adminSessionCookieName()}=${value}; ${adminSessionCookieName()}=${value}` },
    }), NOW)).toBe(false);
    expect(hasAdminSession(new Request(`${ORIGIN}/api/admin/prayers`, {
      headers: { cookie: `theme=light; ${adminSessionCookieName()}=${value}; other=value` },
    }), NOW)).toBe(true);
  });
  it("emits a secure host-only cookie shared by page and API paths, and clears the same cookie", () => {
    const value = token();
    const header = adminSessionCookie(value);
    expect(header.startsWith("__Host-pt_admin_session=")).toBe(true);
    for (const flag of ["Path=/", "HttpOnly", "SameSite=Lax", "Secure", `Max-Age=${ADMIN_SESSION_SECONDS}`]) expect(header).toContain(flag);
    expect(header).not.toMatch(/Domain=/i);
    expect(adminSessionCookie(null)).toContain("__Host-pt_admin_session=; Path=/");
    expect(adminSessionCookie(null)).toContain("Max-Age=0");
  });
  it("supports explicit local mode with normalized localhost URLs while retaining host and port binding", () => {
    vi.stubEnv("CMS_ADMIN_MODE", "local"); vi.stubEnv("VERCEL", undefined); vi.stubEnv("VERCEL_ENV", undefined);
    const url = "http://localhost:3110/admin/login";
    const value = createAdminSession(new Request(url, { headers: { host: "127.0.0.1:3110" } }), NOW)!;
    expect(tokenPayload(value).aud).toBe("http://127.0.0.1:3110");
    expect(adminSessionCookie(value).startsWith("pt_admin_session=")).toBe(true);
    expect(adminSessionCookie(value)).not.toContain("; Secure");
    expect(hasAdminSession(cookieRequest(value, "http://localhost:3110/api/admin/prayers", { host: "127.0.0.1:3110" }), NOW)).toBe(true);
    expect(hasAdminSession(cookieRequest(value, "http://localhost:3110/api/admin/prayers", { host: "127.0.0.1:3111" }), NOW)).toBe(false);
    expect(hasAdminSession(cookieRequest(value, "http://localhost:3110/api/admin/prayers", { host: "attacker.example:3110" }), NOW)).toBe(false);
  });
});

describe("administrator session HTTP handlers", () => {
  it("logs in using the existing ID and exact password, then verifies the issued session", async () => {
    const handlers = api();
    const response = await handlers.POST(loginRequest());
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(response.headers.get("WWW-Authenticate")).toBeNull();
    const setCookie = response.headers.get("Set-Cookie")!;
    expect(setCookie).toContain("HttpOnly");
    expect(await response.json()).toEqual({ authenticated: true });
    const request = new Request(ENDPOINT, { headers: { cookie: setCookie.split(";")[0] } });
    const verified = await handlers.GET(request);
    expect(verified.status).toBe(200);
    expect(await verified.json()).toEqual({ authenticated: true });
    expect(guardAdminRequest(new Request(`${ORIGIN}/api/admin/prayers`, { headers: { cookie: setCookie.split(";")[0] } }))).toBeNull();
  });
  it("does not accept a trimmed password and never returns credential material", async () => {
    const response = await api().POST(loginRequest({ username: USERNAME, password: PASSWORD.trim() }));
    expect(response.status).toBe(401);
    expect(response.headers.get("Set-Cookie")).toBeNull();
    expect(response.headers.get("WWW-Authenticate")).toBeNull();
    const text = await response.text();
    for (const sensitive of [PASSWORD, PASSWORD_HASH, SECRET, USERNAME]) expect(text).not.toContain(sensitive);
  });
  it("rejects incomplete credentials, extra payload fields and malformed JSON", async () => {
    for (const payload of [null, [], {}, { username: USERNAME }, { username: USERNAME, password: PASSWORD, role: "admin" }, { username: USERNAME, password: 123 }]) {
      expect((await api().POST(loginRequest(payload))).status).toBe(400);
    }
    expect((await api().POST(loginRequest(undefined, { rawBody: "{broken-json" }))).status).toBe(400);
  });
  it("validates same origin and fetch metadata before processing credentials", async () => {
    const cases = [
      loginRequest(undefined, { includeOrigin: false }),
      loginRequest(undefined, { headers: { origin: "https://attacker.example" } }),
      loginRequest(undefined, { headers: { "sec-fetch-site": "cross-site" } }),
      loginRequest(undefined, { headers: { host: "cms-preview.example/unsafe" } }),
    ];
    for (const request of cases) {
      const response = await api().POST(request);
      expect(response.status).toBe(403);
      expect(response.headers.get("Set-Cookie")).toBeNull();
    }
  });
  it("supports Next's worker URL normalization for a valid protected-origin login", async () => {
    const response = await api().POST(loginRequest(undefined, {
      url: "http://localhost:3110/api/admin/session", headers: { host: "cms-preview.example", origin: ORIGIN },
    }));
    expect(response.status).toBe(200);
    expect(tokenPayload(response.headers.get("Set-Cookie")!.split(";")[0].split("=")[1]).aud).toBe(ORIGIN);
  });
  it("rejects unsupported media and bounds both declared and actual unadvertised bodies", async () => {
    expect((await api().POST(loginRequest(undefined, { headers: { "content-type": "text/plain" } }))).status).toBe(415);
    expect((await api().POST(loginRequest(undefined, { headers: { "content-length": "4097" } }))).status).toBe(413);
    const oversized = loginRequest(undefined, { rawBody: new Uint8Array(4097) });
    expect(oversized.headers.get("content-length")).toBeNull();
    expect((await api().POST(oversized)).status).toBe(413);
  });
  it("returns503 instead of fake success when the session signing configuration is absent", async () => {
    vi.stubEnv("CMS_ADMIN_SESSION_SECRET", undefined);
    const response = await api().POST(loginRequest());
    expect(response.status).toBe(503);
    expect((await response.json()).error.code).toBe("LOGIN_NOT_CONFIGURED");
    expect(response.headers.get("Set-Cookie")).toBeNull();
  });
  it("never enables login, session reads or logout on public production even with valid credentials", async () => {
    const value = token();
    vi.stubEnv("VERCEL_ENV", "production");
    const handlers = api();
    expect((await handlers.POST(loginRequest())).status).toBe(403);
    expect((await handlers.GET(cookieRequest(value, ENDPOINT))).status).toBe(403);
    expect((await handlers.DELETE(new Request(ENDPOINT, { method: "DELETE", headers: { origin: ORIGIN } }))).status).toBe(403);
  });
  it("requires a valid session for the status endpoint rather than trusting a Basic or fake UI flag", async () => {
    const response = await api().GET(new Request(ENDPOINT, { headers: { authorization: basic(), "x-admin-authenticated": "true" } }));
    expect(response.status).toBe(401);
    expect(response.headers.get("WWW-Authenticate")).toBeNull();
  });
  it("logs out by clearing the same scoped cookie and rejects cross-site logout", async () => {
    const handlers = api();
    const rejected = await handlers.DELETE(new Request(ENDPOINT, { method: "DELETE", headers: { origin: "https://attacker.example" } }));
    expect(rejected.status).toBe(403);
    expect(rejected.headers.get("Set-Cookie")).toBeNull();
    const accepted = await handlers.DELETE(new Request(ENDPOINT, { method: "DELETE", headers: { origin: ORIGIN } }));
    expect(accepted.status).toBe(200);
    expect(await accepted.json()).toEqual({ authenticated: false });
    expect(accepted.headers.get("Set-Cookie")).toContain("__Host-pt_admin_session=; Path=/");
    expect(accepted.headers.get("Set-Cookie")).toContain("Max-Age=0");
  });
  it("rate limits repeated failures, reports Retry-After and recovers after the window", async () => {
    let clock = NOW;
    const handlers = createAdminSessionApi({ now: () => clock });
    const wrong = { username: USERNAME, password: "wrong-unit-password" };
    for (let index = 0; index < 5; index++) expect((await handlers.POST(loginRequest(wrong))).status).toBe(401);
    const limited = await handlers.POST(loginRequest());
    expect(limited.status).toBe(429);
    expect(Number(limited.headers.get("Retry-After"))).toBeGreaterThan(0);
    expect(limited.headers.get("Set-Cookie")).toBeNull();
    clock += 60_000;
    expect((await handlers.POST(loginRequest())).status).toBe(200);
  });
  it("resets the failure budget after a successful login and ignores spoofed ordinary forwarded IP headers", async () => {
    const handlers = api();
    const wrong = { username: USERNAME, password: "wrong-unit-password" };
    for (let index = 0; index < 4; index++) expect((await handlers.POST(loginRequest(wrong))).status).toBe(401);
    expect((await handlers.POST(loginRequest())).status).toBe(200);
    for (let index = 0; index < 5; index++) {
      expect((await handlers.POST(loginRequest(wrong, { headers: { "x-forwarded-for": `198.51.100.${index + 1}` } }))).status).toBe(401);
    }
    expect((await handlers.POST(loginRequest())).status).toBe(429);
  });
  it("bounds limiter storage and frees expired entries", () => {
    const limiter = createLoginLimiter(2, 60_000, 2);
    expect(limiter.consume("a", NOW)).toBe(0);
    expect(limiter.consume("b", NOW)).toBe(0);
    expect(limiter.consume("c", NOW)).toBeGreaterThan(0);
    expect(limiter.consume("a", NOW)).toBe(0);
    expect(limiter.consume("a", NOW)).toBeGreaterThan(0);
    expect(limiter.consume("c", NOW + 60_000)).toBe(0);
  });
});

describe("protected routing and Basic compatibility", () => {
  it("renders the branded login after deployment protection without a browser Basic challenge", () => {
    const response = proxy(new NextRequest(`${ORIGIN}/admin/login`));
    expect(response.status).toBe(200);
    expect(response.headers.get("x-middleware-next")).toBe("1");
    expect(response.headers.get("WWW-Authenticate")).toBeNull();
  });
  it("requires a cookie for pages even when browser Basic credentials were cached", () => {
    const response = proxy(new NextRequest(`${ORIGIN}/admin/prayers`, { headers: { authorization: basic() } }));
    expect(response.status).toBe(303);
    expect(response.headers.get("Location")).toBe(`${ORIGIN}/admin/login`);
    expect(response.headers.get("WWW-Authenticate")).toBeNull();
    expect(proxy(new NextRequest(`${ORIGIN}/admin/prayers`, {
      headers: { cookie: `${adminSessionCookieName()}=${token()}` },
    })).headers.get("x-middleware-next")).toBe("1");
  });
  it("keeps API Basic compatibility while unauthenticated API requests receive JSON401 without a challenge", () => {
    expect(guardAdminRequest(new Request(`${ORIGIN}/api/admin/prayers`, { headers: { authorization: basic() } }))).toBeNull();
    const response = proxy(new NextRequest(`${ORIGIN}/api/admin/prayers`));
    expect(response.status).toBe(401);
    expect(response.headers.get("WWW-Authenticate")).toBeNull();
    expect(response.headers.get("Location")).toBeNull();
  });
  it("only exempts the exact login/session routes and never trusts next redirects", () => {
    for (const path of ["/admin/login-extra", "/admin/login/nested"]) {
      expect(proxy(new NextRequest(`${ORIGIN}${path}`)).status).toBe(303);
    }
    expect(proxy(new NextRequest(`${ORIGIN}/api/admin/session/extra`)).status).toBe(401);
    expect(proxy(new NextRequest(ENDPOINT, { method: "PATCH" })).status).toBe(401);
    const loggedIn = proxy(new NextRequest(`${ORIGIN}/admin/login?next=https://attacker.example`, {
      headers: { cookie: `${adminSessionCookieName()}=${token()}` },
    }));
    expect(loggedIn.status).toBe(303);
    expect(loggedIn.headers.get("Location")).toBe(`${ORIGIN}/admin/prayers`);
  });
  it("leaves direct login routes closed when the Preview mode or protection verification is absent", () => {
    for (const variable of ["CMS_DEMO_ENV", "CMS_DEPLOYMENT_PROTECTION"]) {
      vi.stubEnv(variable, "");
      expect(proxy(new NextRequest(`${ORIGIN}/admin/login`)).status).toBe(403);
      expect(proxy(new NextRequest(ENDPOINT)).status).toBe(403);
      vi.stubEnv(variable, variable === "CMS_DEMO_ENV" ? "true" : "verified");
    }
  });
});
