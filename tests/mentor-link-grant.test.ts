import { createCipheriv, createHash, createHmac, randomBytes } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createMentorPrefillGrant, readMentorPrefillGrant, mentorPrefillCookieName,
  mentorPrefillCookie, mentorPrefillFromRequest,
} from "../src/lib/admin-login/mentor-prefill";
import { adminSessionCookieName, hasAdminSession } from "../src/lib/prayers/admin-session";
import { guardAdminRequest } from "../src/lib/prayers/admin-access";

// Synthetic public fixtures only; no environment file or real credential is read.
const OWNER = "grant-owner-fixture";
const OWNER_PASSWORD = "owner-only-synthetic-password";
const MENTOR = "grant-mentor-fixture";
const PASSWORD = " mentor-only:가짜-password ";
const SECRET = "unit-only-random-mentor-prefill-master-secret";
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const ORIGIN = "https://mentor-preview.example";
const NOW = Date.UTC(2026, 10, 18, 14, 0, 0);
const TTL = 7 * 24 * 60 * 60;
const NAMESPACE = "PrayTime mentor prefill v1\0";
const VARIABLES = ["CMS_ADMIN_MODE", "CMS_DEMO_ENV", "CMS_DEPLOYMENT_PROTECTION", "CMS_ADMIN_USERNAME", "CMS_ADMIN_PASSWORD_SHA256", "CMS_ADMIN_ACCESS_KEY", "CMS_ADMIN_SESSION_SECRET", "CMS_MENTOR_USERNAME", "CMS_MENTOR_PASSWORD_SHA256", "VERCEL", "VERCEL_ENV"];

beforeEach(() => {
  VARIABLES.forEach(name => vi.stubEnv(name, undefined));
  vi.stubEnv("CMS_ADMIN_MODE", "protected-demo");
  vi.stubEnv("CMS_DEMO_ENV", "true");
  vi.stubEnv("CMS_DEPLOYMENT_PROTECTION", "verified");
  vi.stubEnv("CMS_ADMIN_USERNAME", OWNER);
  vi.stubEnv("CMS_ADMIN_PASSWORD_SHA256", hash(OWNER_PASSWORD));
  vi.stubEnv("CMS_ADMIN_SESSION_SECRET", SECRET);
  vi.stubEnv("CMS_MENTOR_USERNAME", MENTOR);
  vi.stubEnv("CMS_MENTOR_PASSWORD_SHA256", hash(PASSWORD));
  vi.stubEnv("VERCEL", "1");
  vi.stubEnv("VERCEL_ENV", "preview");
  vi.spyOn(Date, "now").mockReturnValue(NOW);
  vi.stubGlobal("fetch", vi.fn(() => { throw new Error("Prefill grant tests must not access a network or database"); }));
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

function grant() {
  const value = createMentorPrefillGrant(PASSWORD, ORIGIN, NOW);
  expect(value).not.toBeNull();
  return value!;
}
function request(token: string, headers: Record<string, string> = {}) {
  return new Request(`${ORIGIN}/admin/login?account=mentor`, {
    headers: { host: new URL(ORIGIN).host, cookie: `${mentorPrefillCookieName()}=${token}`, ...headers },
  });
}
/** Independently encrypt authenticated malformed fixtures to exercise payload validation. */
function encryptedFixture(changes: Record<string, unknown> = {}, omit?: string) {
  const payload: Record<string, unknown> = { v: 1, sub: "mentor", iat: NOW / 1000, exp: NOW / 1000 + TTL, aud: ORIGIN, username: MENTOR, password: PASSWORD, ...changes };
  if (omit) delete payload[omit];
  const key = createHmac("sha256", SECRET).update(NAMESPACE).update(MENTOR).update("\0").update(hash(PASSWORD)).digest();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(Buffer.from(NAMESPACE));
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(payload)), cipher.final()]);
  return Buffer.concat([Buffer.from([1]), iv, cipher.getAuthTag(), ciphertext]).toString("base64url");
}

describe("encrypted mentor credential prefill capability", () => {
  it("round-trips exact credentials with a fresh IV and opaque canonical token", () => {
    const first = grant();
    expect(first).not.toBe(grant());
    expect(first).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(first.length).toBeLessThanOrEqual(2048);
    const bytes = Buffer.from(first, "base64url");
    expect(bytes.toString("base64url")).toBe(first);
    expect(bytes[0]).toBe(1);
    expect(bytes.includes(Buffer.from(PASSWORD))).toBe(false);
    expect(bytes.includes(Buffer.from(hash(PASSWORD)))).toBe(false);
    expect(readMentorPrefillGrant(first, ORIGIN, NOW)).toEqual({ username: MENTOR, password: PASSWORD });
  });
  it("never mints a grant for owner credentials, a changed password, or oversized password bytes", () => {
    expect(createMentorPrefillGrant(OWNER_PASSWORD, ORIGIN, NOW)).toBeNull();
    expect(createMentorPrefillGrant(PASSWORD.trim(), ORIGIN, NOW)).toBeNull();
    const oversized = "한".repeat(342);
    vi.stubEnv("CMS_MENTOR_PASSWORD_SHA256", hash(oversized));
    expect(createMentorPrefillGrant(oversized, ORIGIN, NOW)).toBeNull();
    const boundary = "x".repeat(1024);
    vi.stubEnv("CMS_MENTOR_PASSWORD_SHA256", hash(boundary));
    const accepted = createMentorPrefillGrant(boundary, ORIGIN, NOW);
    expect(accepted).not.toBeNull();
    expect(readMentorPrefillGrant(accepted!, ORIGIN, NOW)?.password).toBe(boundary);
  });
  it.each([0, 1, 13, 29])("rejects tampering with envelope component at byte %i", offset => {
    const bytes = Buffer.from(grant(), "base64url");
    bytes[offset] ^= 1;
    expect(readMentorPrefillGrant(bytes.toString("base64url"), ORIGIN, NOW)).toBeNull();
  });
  it.each(["", "not.a.grant", "a".repeat(2049), "AA", "===="]) ("rejects malformed or oversized tokens (%#)", token => {
    expect(() => readMentorPrefillGrant(token, ORIGIN, NOW)).not.toThrow();
    expect(readMentorPrefillGrant(token, ORIGIN, NOW)).toBeNull();
  });
  it("rejects padded or noncanonical base64url", () => {
    const token = grant();
    expect(readMentorPrefillGrant(`${token}=`, ORIGIN, NOW)).toBeNull();
    expect(readMentorPrefillGrant(` ${token}`, ORIGIN, NOW)).toBeNull();
  });
  it.each(["http://mentor-preview.example", `${ORIGIN}/`, `${ORIGIN}/admin/login`, `${ORIGIN}?x=1`, `${ORIGIN}#fragment`, "https://user:password@mentor-preview.example"]) ("rejects noncanonical or insecure origins (%#)", origin => {
    const token = grant();
    expect(createMentorPrefillGrant(PASSWORD, origin, NOW)).toBeNull();
    expect(readMentorPrefillGrant(token, origin, NOW)).toBeNull();
  });
  it("rejects a different HTTPS audience rather than trying another host", () => {
    expect(readMentorPrefillGrant(grant(), "https://another-preview.example", NOW)).toBeNull();
  });
  it.each([
    { v: 2 }, { sub: "owner" }, { username: OWNER }, { role: "admin" },
    { password: "incorrect" }, { password: 123 }, { password: "" },
    { iat: NOW / 1000 + 31 }, { iat: -1 }, { iat: "now" },
    { exp: NOW / 1000 }, { exp: NOW / 1000 + TTL + 1 }, { exp: NOW / 1000 + 0.5 },
    { aud: "https://another-preview.example" },
  ])("rejects authenticated but invalid payload data (%#)", changes => {
    expect(readMentorPrefillGrant(encryptedFixture(changes), ORIGIN, NOW)).toBeNull();
  });
  it("rejects missing payload fields and invalid server timestamps", () => {
    expect(readMentorPrefillGrant(encryptedFixture({}, "password"), ORIGIN, NOW)).toBeNull();
    expect(createMentorPrefillGrant(PASSWORD, ORIGIN, Number.NaN)).toBeNull();
    expect(readMentorPrefillGrant(grant(), ORIGIN, Number.POSITIVE_INFINITY)).toBeNull();
  });
  it("expires at seven days, independently of the short browser cookie", () => {
    const token = grant();
    expect(readMentorPrefillGrant(token, ORIGIN, NOW + TTL * 1000 - 1)).not.toBeNull();
    expect(readMentorPrefillGrant(token, ORIGIN, NOW + TTL * 1000)).toBeNull();
  });
  it.each([
    ["CMS_MENTOR_USERNAME", "rotated-mentor"],
    ["CMS_MENTOR_PASSWORD_SHA256", hash("rotated-unit-password")],
    ["CMS_MENTOR_USERNAME", undefined], ["CMS_MENTOR_PASSWORD_SHA256", undefined],
    ["CMS_ADMIN_SESSION_SECRET", "rotated-unit-only-prefill-master-secret-value"],
  ])("revokes a capability when its key material changes (%#)", (name, value) => {
    const token = grant();
    vi.stubEnv(name, value);
    expect(readMentorPrefillGrant(token, ORIGIN, NOW)).toBeNull();
  });
  it("does not bind mentor capabilities to a still-valid owner's password", () => {
    const token = grant();
    vi.stubEnv("CMS_ADMIN_PASSWORD_SHA256", hash("new-unit-owner-password"));
    expect(readMentorPrefillGrant(token, ORIGIN, NOW)).not.toBeNull();
  });
  it.each([
    ["VERCEL_ENV", "production"], ["CMS_ADMIN_MODE", "disabled"],
    ["CMS_ADMIN_MODE", "local"], ["CMS_DEMO_ENV", "false"],
    ["CMS_DEPLOYMENT_PROTECTION", ""], ["CMS_ADMIN_SESSION_SECRET", "short"],
    ["CMS_MENTOR_USERNAME", OWNER],
  ])("fails closed outside valid protected Preview configuration (%#)", (name, value) => {
    const token = grant();
    vi.stubEnv(name, value);
    expect(createMentorPrefillGrant(PASSWORD, ORIGIN, NOW)).toBeNull();
    expect(readMentorPrefillGrant(token, ORIGIN, NOW)).toBeNull();
  });
});

describe("temporary prefill cookie boundary", () => {
  it("uses an independent five-minute host-only HttpOnly cookie and clears it safely", () => {
    const token = grant();
    expect(mentorPrefillCookieName()).toBe("__Host-pt_mentor_prefill");
    expect(mentorPrefillCookieName()).not.toBe(adminSessionCookieName());
    const serialized = mentorPrefillCookie(token);
    for (const flag of ["HttpOnly", "Secure", "SameSite=Lax", "Path=/", "Max-Age=300"]) expect(serialized).toContain(flag);
    expect(serialized).not.toMatch(/Domain=/i);
    expect(mentorPrefillCookie(null)).toContain("Max-Age=0");
    expect(mentorPrefillCookie("bad; injected=value")).toContain(`${mentorPrefillCookieName()}=;`);
    expect(mentorPrefillCookie("bad; injected=value")).not.toContain("injected");
  });
  it("reads one matching cookie on its actual Host and rejects duplicate cookie names", () => {
    const token = grant();
    expect(mentorPrefillFromRequest(request(token), NOW)).toEqual({ username: MENTOR, password: PASSWORD });
    expect(mentorPrefillFromRequest(request(token, { cookie: `${mentorPrefillCookieName()}=${token}; ${mentorPrefillCookieName()}=${token}` }), NOW)).toBeNull();
    expect(mentorPrefillFromRequest(request(token, { host: "another-preview.example", "x-forwarded-host": new URL(ORIGIN).host }), NOW)).toBeNull();
    expect(mentorPrefillFromRequest(new Request(`${ORIGIN}/admin/login`, { headers: { cookie: `${mentorPrefillCookieName()}=${token}` } }), NOW)).toBeNull();
  });
  it("supports a normalized worker URL only through its explicitly validated real Host", () => {
    expect(mentorPrefillFromRequest(new Request("http://localhost:3000/admin/login", {
      headers: { host: new URL(ORIGIN).host, cookie: `${mentorPrefillCookieName()}=${grant()}` },
    }), NOW)).not.toBeNull();
  });
  it("never grants administrator access or substitutes for the app session", () => {
    const token = grant();
    const prefill = request(token);
    expect(mentorPrefillFromRequest(prefill, NOW)).not.toBeNull();
    expect(hasAdminSession(prefill, NOW)).toBe(false);
    expect(guardAdminRequest(prefill)?.status).toBe(401);
    expect(hasAdminSession(request(token, { cookie: `${adminSessionCookieName()}=${token}` }), NOW)).toBe(false);
  });
});
