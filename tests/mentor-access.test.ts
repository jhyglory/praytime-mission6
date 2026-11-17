import { createHash, createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  authenticateAdminCredentials, getAdminCredentials, getMentorCredentials,
  hasAdminBasicCredentials, verifyAdminCredentials,
} from "../src/lib/prayers/admin-credentials";
import { getAdminAccessState, guardAdminRequest } from "../src/lib/prayers/admin-access";
import { ADMIN_SESSION_SECONDS, adminSessionConfigured, adminSessionCookieName, createAdminSession, hasAdminSession } from "../src/lib/prayers/admin-session";
import { createAdminSessionApi } from "../src/lib/admin-login/session-api";

// Synthetic credentials only. This suite never loads .env files or accesses a service.
const OWNER = "owner-fixture";
const OWNER_PASSWORD = " owner-only:테스트-password ";
const MENTOR = "mentor-fixture";
const MENTOR_PASSWORD = " mentor-only:테스트-password ";
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const OWNER_HASH = hash(OWNER_PASSWORD);
const MENTOR_HASH = hash(MENTOR_PASSWORD);
const SECRET = "synthetic-mentor-session-master-secret-unit-only";
const NOW = Date.UTC(2026, 10, 18, 12, 0, 0);
const ORIGIN = "https://mentor-preview.example";
const ENDPOINT = `${ORIGIN}/api/admin/session`;
const VARIABLES = [
  "CMS_ADMIN_MODE", "CMS_DEMO_ENV", "CMS_DEPLOYMENT_PROTECTION", "CMS_ADMIN_USERNAME",
  "CMS_ADMIN_PASSWORD_SHA256", "CMS_ADMIN_ACCESS_KEY", "CMS_ADMIN_SESSION_SECRET",
  "CMS_MENTOR_USERNAME", "CMS_MENTOR_PASSWORD_SHA256", "VERCEL", "VERCEL_ENV",
  "VERCEL_URL", "VERCEL_BRANCH_URL", "VERCEL_PROJECT_PRODUCTION_URL",
];

beforeEach(() => {
  VARIABLES.forEach(name => vi.stubEnv(name, undefined));
  vi.stubEnv("CMS_ADMIN_MODE", "protected-demo");
  vi.stubEnv("CMS_DEMO_ENV", "true");
  vi.stubEnv("CMS_DEPLOYMENT_PROTECTION", "verified");
  vi.stubEnv("CMS_ADMIN_USERNAME", OWNER);
  vi.stubEnv("CMS_ADMIN_PASSWORD_SHA256", OWNER_HASH);
  vi.stubEnv("CMS_ADMIN_SESSION_SECRET", SECRET);
  vi.stubEnv("CMS_MENTOR_USERNAME", MENTOR);
  vi.stubEnv("CMS_MENTOR_PASSWORD_SHA256", MENTOR_HASH);
  vi.stubEnv("VERCEL", "1");
  vi.stubEnv("VERCEL_ENV", "preview");
  vi.spyOn(Date, "now").mockReturnValue(NOW);
  vi.stubGlobal("fetch", vi.fn(() => { throw new Error("Mentor unit tests must never use the network or a database"); }));
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

const issuanceRequest = () => new Request(`${ORIGIN}/admin/login`);
const payload = (token: string): Record<string, unknown> => JSON.parse(Buffer.from(token.split(".")[0], "base64url").toString("utf8"));
function sessionToken(principal: "owner" | "mentor") {
  const token = createAdminSession(issuanceRequest(), NOW, principal);
  expect(token).not.toBeNull();
  return token!;
}
function requestWithCookie(token: string, path = "/api/admin/prayers") {
  return new Request(`${ORIGIN}${path}`, { headers: { cookie: `${adminSessionCookieName()}=${token}` } });
}
function basicRequest(username: string, password: string) {
  return new Request(`${ORIGIN}/api/admin/prayers`, {
    headers: { authorization: `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}` },
  });
}
function loginRequest(username = MENTOR, password = MENTOR_PASSWORD, extra: Record<string, unknown> = {}, query = "") {
  return new Request(`${ENDPOINT}${query}`, {
    method: "POST", headers: { origin: ORIGIN, "content-type": "application/json" },
    body: JSON.stringify({ username, password, ...extra }),
  });
}
function cookieFromResponse(response: Response) {
  return response.headers.get("Set-Cookie")!.split(";")[0];
}

/** Independent compatibility fixture for the already-issued owner v1 protocol. */
function signFixture(data: Record<string, unknown>, principal: "owner" | "mentor") {
  const namespace = principal === "owner" ? "PrayTime CMS session v1\0" : "PrayTime CMS mentor session v2\0";
  const username = principal === "owner" ? OWNER : MENTOR;
  const passwordHash = principal === "owner" ? OWNER_HASH : MENTOR_HASH;
  const key = createHmac("sha256", SECRET).update(namespace).update(username).update("\0").update(passwordHash).digest();
  const encoded = Buffer.from(JSON.stringify(data)).toString("base64url");
  return `${encoded}.${createHmac("sha256", key).update(encoded).digest("base64url")}`;
}
function existingOwnerV1() {
  return signFixture({ v: 1, iat: NOW / 1000, exp: NOW / 1000 + ADMIN_SESSION_SECONDS, sid: "0123456789abcdef0123456789abcdef", aud: ORIGIN }, "owner");
}

describe("owner and mentor credential boundaries", () => {
  it("authenticates each complete pair without changing the owner's configuration", () => {
    expect(authenticateAdminCredentials(OWNER, OWNER_PASSWORD)).toBe("owner");
    expect(authenticateAdminCredentials(MENTOR, MENTOR_PASSWORD)).toBe("mentor");
    expect(authenticateAdminCredentials(OWNER, MENTOR_PASSWORD)).toBeNull();
    expect(authenticateAdminCredentials(MENTOR, OWNER_PASSWORD)).toBeNull();
    expect(getAdminCredentials()).toEqual({ username: OWNER, passwordHash: OWNER_HASH });
    expect(getMentorCredentials()).toEqual({ username: MENTOR, passwordHash: MENTOR_HASH });
  });
  it("keeps the existing verifier and Basic API fallback owner-only", () => {
    expect(verifyAdminCredentials(OWNER, OWNER_PASSWORD)).toBe(true);
    expect(verifyAdminCredentials(MENTOR, MENTOR_PASSWORD)).toBe(false);
    expect(hasAdminBasicCredentials(basicRequest(OWNER, OWNER_PASSWORD))).toBe(true);
    expect(hasAdminBasicCredentials(basicRequest(MENTOR, MENTOR_PASSWORD))).toBe(false);
    expect(guardAdminRequest(basicRequest(OWNER, OWNER_PASSWORD))).toBeNull();
    expect(guardAdminRequest(basicRequest(MENTOR, MENTOR_PASSWORD))?.status).toBe(401);
  });
  it.each([
    [undefined, MENTOR_HASH], [MENTOR, undefined], ["", MENTOR_HASH],
    ["bad:mentor", MENTOR_HASH], [" mentor ", MENTOR_HASH],
    [MENTOR, "f".repeat(63)], [MENTOR, "z".repeat(64)], [OWNER, MENTOR_HASH],
  ])("disables only invalid or colliding optional mentor configuration (%#)", (username, passwordHash) => {
    const owner = existingOwnerV1();
    vi.stubEnv("CMS_MENTOR_USERNAME", username);
    vi.stubEnv("CMS_MENTOR_PASSWORD_SHA256", passwordHash);
    expect(getMentorCredentials()).toBeNull();
    expect(adminSessionConfigured("mentor")).toBe(false);
    expect(createAdminSession(issuanceRequest(), NOW, "mentor")).toBeNull();
    expect(authenticateAdminCredentials(MENTOR, MENTOR_PASSWORD)).toBeNull();
    expect(authenticateAdminCredentials(OWNER, OWNER_PASSWORD)).toBe("owner");
    expect(getAdminAccessState(ORIGIN).enabled).toBe(true);
    expect(hasAdminSession(requestWithCookie(owner), NOW)).toBe(true);
  });
  it("treats a completely absent mentor as optional and preserves owner access", () => {
    vi.stubEnv("CMS_MENTOR_USERNAME", undefined);
    vi.stubEnv("CMS_MENTOR_PASSWORD_SHA256", undefined);
    expect(getMentorCredentials()).toBeNull();
    expect(authenticateAdminCredentials(MENTOR, MENTOR_PASSWORD)).toBeNull();
    expect(authenticateAdminCredentials(OWNER, OWNER_PASSWORD)).toBe("owner");
    expect(hasAdminSession(requestWithCookie(existingOwnerV1()), NOW)).toBe(true);
  });
  it("checks collisions against the resolved legacy owner identity too", () => {
    const legacy = "synthetic-legacy-owner-key-longer-than-32-characters";
    vi.stubEnv("CMS_ADMIN_USERNAME", undefined);
    vi.stubEnv("CMS_ADMIN_PASSWORD_SHA256", undefined);
    vi.stubEnv("CMS_ADMIN_ACCESS_KEY", legacy);
    vi.stubEnv("CMS_MENTOR_USERNAME", "demo");
    expect(getMentorCredentials()).toBeNull();
    expect(authenticateAdminCredentials("demo", legacy)).toBe("owner");
    expect(authenticateAdminCredentials("demo", MENTOR_PASSWORD)).toBeNull();
    expect(hasAdminBasicCredentials(basicRequest("demo", legacy))).toBe(true);
  });
  it("does not let mentor configuration bypass a missing owner configuration", () => {
    vi.stubEnv("CMS_ADMIN_USERNAME", undefined);
    vi.stubEnv("CMS_ADMIN_PASSWORD_SHA256", undefined);
    expect(getMentorCredentials()).toBeNull();
    expect(authenticateAdminCredentials(MENTOR, MENTOR_PASSWORD)).toBeNull();
    expect(getAdminAccessState(ORIGIN).enabled).toBe(false);
  });
});

describe("principal-specific session compatibility and revocation", () => {
  it("continues issuing exact owner v1 tokens and accepts an independently signed old cookie", () => {
    const issued = sessionToken("owner");
    expect(Object.keys(payload(issued)).sort()).toEqual(["aud", "exp", "iat", "sid", "v"]);
    expect(payload(issued).v).toBe(1);
    const old = existingOwnerV1();
    expect(hasAdminSession(requestWithCookie(old), NOW)).toBe(true);
    expect(guardAdminRequest(requestWithCookie(old), { sessionOnly: true })).toBeNull();
  });
  it("issues mentor-only v2 tokens with no readable credentials or hashes", () => {
    const issued = sessionToken("mentor");
    const data = payload(issued);
    expect(Object.keys(data).sort()).toEqual(["aud", "exp", "iat", "sid", "sub", "v"]);
    expect(data).toMatchObject({ v: 2, sub: "mentor", aud: ORIGIN, exp: NOW / 1000 + ADMIN_SESSION_SECONDS });
    for (const sensitive of [OWNER, OWNER_PASSWORD, OWNER_HASH, MENTOR, MENTOR_PASSWORD, MENTOR_HASH, SECRET]) {
      expect(JSON.stringify(data)).not.toContain(sensitive);
    }
    expect(hasAdminSession(requestWithCookie(issued), NOW)).toBe(true);
    expect(guardAdminRequest(requestWithCookie(issued), { sessionOnly: true })).toBeNull();
  });
  it.each([
    ["CMS_MENTOR_USERNAME", "mentor-rotated"],
    ["CMS_MENTOR_PASSWORD_SHA256", hash("new synthetic mentor password")],
    ["CMS_MENTOR_USERNAME", undefined],
    ["CMS_MENTOR_PASSWORD_SHA256", undefined],
  ])("revokes mentor cookies after %s changes while preserving owner v1 cookies", (name, value) => {
    const owner = existingOwnerV1();
    const mentor = sessionToken("mentor");
    vi.stubEnv(name, value);
    expect(hasAdminSession(requestWithCookie(mentor), NOW)).toBe(false);
    expect(hasAdminSession(requestWithCookie(owner), NOW)).toBe(true);
    expect(authenticateAdminCredentials(OWNER, OWNER_PASSWORD)).toBe("owner");
  });
  it("preserves mentor sessions when a valid owner password rotates", () => {
    const owner = existingOwnerV1();
    const mentor = sessionToken("mentor");
    vi.stubEnv("CMS_ADMIN_PASSWORD_SHA256", hash("new synthetic owner password"));
    expect(hasAdminSession(requestWithCookie(owner), NOW)).toBe(false);
    expect(hasAdminSession(requestWithCookie(mentor), NOW)).toBe(true);
  });
  it("revokes both principals when the shared random session secret rotates", () => {
    const owner = existingOwnerV1();
    const mentor = sessionToken("mentor");
    vi.stubEnv("CMS_ADMIN_SESSION_SECRET", "rotated-synthetic-session-master-secret-unit-only");
    expect(hasAdminSession(requestWithCookie(owner), NOW)).toBe(false);
    expect(hasAdminSession(requestWithCookie(mentor), NOW)).toBe(false);
  });
  it("cannot relabel a mentor token as owner or smuggle a principal into a valid v1 signature", () => {
    const mentor = sessionToken("mentor");
    const [encoded, signature] = mentor.split(".");
    expect(encoded).toBeTruthy();
    const changed = Buffer.from(JSON.stringify({ ...payload(mentor), sub: "owner" })).toString("base64url");
    expect(hasAdminSession(requestWithCookie(`${changed}.${signature}`), NOW)).toBe(false);
    expect(hasAdminSession(requestWithCookie(signFixture({ ...payload(existingOwnerV1()), sub: "mentor" }, "owner")), NOW)).toBe(false);
  });
  it.each([{ sub: "owner" }, { sub: "__proto__" }, { sub: ["mentor"] }, { v: 1 }])("rejects correctly signed invalid mentor selectors (%#)", changes => {
    const malformed = signFixture({ ...payload(sessionToken("mentor")), ...changes }, "mentor");
    expect(hasAdminSession(requestWithCookie(malformed), NOW)).toBe(false);
  });
  it("retains expiry and audience checks on the new mentor protocol", () => {
    const mentor = sessionToken("mentor");
    expect(hasAdminSession(requestWithCookie(mentor), NOW + ADMIN_SESSION_SECONDS * 1000)).toBe(false);
    expect(hasAdminSession(new Request("https://other-preview.example/api/admin/prayers", {
      headers: { cookie: `${adminSessionCookieName()}=${mentor}` },
    }), NOW)).toBe(false);
    const expired = signFixture({ ...payload(mentor), exp: NOW / 1000 }, "mentor");
    expect(hasAdminSession(requestWithCookie(expired), NOW)).toBe(false);
  });
});

describe("mentor form authentication", () => {
  it("authenticates mentor by password, creates its own session and permits the same protected CMS guard", async () => {
    const handlers = createAdminSessionApi({ now: () => NOW });
    const response = await handlers.POST(loginRequest());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ authenticated: true });
    const cookie = cookieFromResponse(response);
    const issued = cookie.slice(cookie.indexOf("=") + 1);
    expect(payload(issued)).toMatchObject({ v: 2, sub: "mentor" });
    expect(response.headers.get("Set-Cookie")).toContain("HttpOnly");
    expect(response.headers.get("Set-Cookie")).toContain("Secure");
    const verified = await handlers.GET(new Request(ENDPOINT, { headers: { cookie } }));
    expect(verified.status).toBe(200);
    expect(guardAdminRequest(new Request(`${ORIGIN}/api/admin/prayers`, { headers: { cookie } }))).toBeNull();
    expect(guardAdminRequest(new Request(`${ORIGIN}/api/admin/prayers`, {
      method: "POST", headers: { cookie, origin: ORIGIN },
    }))).toBeNull();
    expect(getAdminCredentials()).toEqual({ username: OWNER, passwordHash: OWNER_HASH });
  });
  it("does not let a query hint change the authenticated principal or log a caller in", async () => {
    const handlers = createAdminSessionApi({ now: () => NOW });
    const hinted = await handlers.GET(new Request(`${ENDPOINT}?account=mentor`));
    expect(hinted.status).toBe(401);
    expect(hinted.headers.get("Set-Cookie")).toBeNull();
    const ownerLogin = await handlers.POST(loginRequest(OWNER, OWNER_PASSWORD, {}, "?account=mentor"));
    expect(ownerLogin.status).toBe(200);
    expect(payload(cookieFromResponse(ownerLogin).split("=")[1]).v).toBe(1);
    const mentorLogin = await handlers.POST(loginRequest(MENTOR, MENTOR_PASSWORD, {}, "?account=owner"));
    expect(mentorLogin.status).toBe(200);
    expect(payload(cookieFromResponse(mentorLogin).split("=")[1])).toMatchObject({ v: 2, sub: "mentor" });
  });
  it("rejects client-supplied principal fields rather than trusting the selected account", async () => {
    for (const extra of [{ principal: "owner" }, { sub: "owner" }, { account: "mentor" }]) {
      const response = await createAdminSessionApi({ now: () => NOW }).POST(loginRequest(MENTOR, MENTOR_PASSWORD, extra));
      expect(response.status).toBe(400);
      expect(response.headers.get("Set-Cookie")).toBeNull();
    }
  });
  it("does not turn a partial mentor setup into a global outage or an owner fallback login", async () => {
    vi.stubEnv("CMS_MENTOR_PASSWORD_SHA256", undefined);
    const handlers = createAdminSessionApi({ now: () => NOW });
    const failed = await handlers.POST(loginRequest());
    expect(failed.status).toBe(401);
    expect(failed.headers.get("Set-Cookie")).toBeNull();
    expect((await handlers.POST(loginRequest(OWNER, OWNER_PASSWORD))).status).toBe(200);
  });
  it("leaves public production closed even for a valid mentor cookie or password", async () => {
    const mentor = sessionToken("mentor");
    vi.stubEnv("VERCEL_ENV", "production");
    const handlers = createAdminSessionApi({ now: () => NOW });
    expect((await handlers.POST(loginRequest())).status).toBe(403);
    expect((await handlers.GET(requestWithCookie(mentor, "/api/admin/session"))).status).toBe(403);
    expect(guardAdminRequest(requestWithCookie(mentor))?.status).toBe(403);
  });
});
