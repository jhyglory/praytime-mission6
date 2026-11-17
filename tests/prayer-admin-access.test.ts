import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getAdminAccessState, guardAdminRequest } from "../src/lib/prayers/admin-access";

const local = "http://127.0.0.1:3106";
const preview = "https://cms-preview.example";
const demoKey = "unit-only-demo-access-key-32-characters";
function enableDemo() {
  vi.stubEnv("CMS_ADMIN_MODE", "protected-demo");
  vi.stubEnv("VERCEL", "1");
  vi.stubEnv("VERCEL_ENV", "preview");
  vi.stubEnv("CMS_DEMO_ENV", "true");
  vi.stubEnv("CMS_DEPLOYMENT_PROTECTION", "verified");
  vi.stubEnv("CMS_ADMIN_ACCESS_KEY", demoKey);
}
const basic = (password = demoKey) => `Basic ${Buffer.from(`demo:${password}`).toString("base64")}`;

beforeEach(() => {
  for (const name of ["CMS_ADMIN_MODE", "CMS_ADMIN_ACCESS_KEY", "CMS_DEMO_ENV", "CMS_DEPLOYMENT_PROTECTION", "VERCEL", "VERCEL_ENV"]) vi.stubEnv(name, "");
  vi.stubEnv("CMS_DEMO_ENV", "true");
});
afterEach(() => vi.unstubAllEnvs());

describe("CMS access gateway", () => {
  it("defaults to disabled before any repository access", async () => {
    const denied = guardAdminRequest(new Request(`${local}/api/admin/prayers`));
    expect(denied?.status).toBe(403);
    expect((await denied!.json()).error.code).toBe("ADMIN_DISABLED");
  });
  it("allows local mode only at an actual local request URL", () => {
    vi.stubEnv("CMS_ADMIN_MODE", "local");
    expect(guardAdminRequest(new Request(`${local}/api/admin/prayers`))).toBeNull();
    expect(guardAdminRequest(new Request("https://attacker.example/api/admin/prayers", {
      headers: { host: "localhost", "x-forwarded-host": "127.0.0.1", "x-cms-admin": "true" },
    }))?.status).toBe(403);
  });
  it("also requires an explicitly isolated demo environment for local administration", () => {
    vi.stubEnv("CMS_ADMIN_MODE", "local");
    vi.stubEnv("CMS_DEMO_ENV", "false");
    expect(guardAdminRequest(new Request(`${local}/api/admin/prayers`))?.status).toBe(403);
  });
  it.each(["preview", "production"]) ("rejects local mode on Vercel %s even with spoofed local headers", environment => {
    vi.stubEnv("CMS_ADMIN_MODE", "local");
    vi.stubEnv("VERCEL_ENV", environment);
    expect(guardAdminRequest(new Request(`${local}/api/admin/prayers`))?.status).toBe(403);
  });
  it("fails closed when a preview protection flag is absent", () => {
    enableDemo();
    vi.stubEnv("CMS_DEPLOYMENT_PROTECTION", "");
    expect(guardAdminRequest(new Request(`${preview}/admin`, { headers: { authorization: basic() } }))?.status).toBe(403);
    expect(getAdminAccessState(preview).enabled).toBe(false);
  });
  it("never enables the demo on public production", () => {
    enableDemo();
    vi.stubEnv("VERCEL_ENV", "production");
    expect(guardAdminRequest(new Request(`${preview}/admin`, { headers: { authorization: basic() } }))?.status).toBe(403);
  });
  it("requires a long key before accepting credentials", () => {
    enableDemo();
    vi.stubEnv("CMS_ADMIN_ACCESS_KEY", "short");
    expect(guardAdminRequest(new Request(`${preview}/admin`, { headers: { authorization: basic("short") } }))?.status).toBe(403);
  });
  it("uses a native Basic challenge without returning the key", async () => {
    enableDemo();
    const denied = guardAdminRequest(new Request(`${preview}/admin`));
    expect(denied?.status).toBe(401);
    expect(denied?.headers.get("WWW-Authenticate")).toContain("Basic");
    expect(await denied!.text()).not.toContain(demoKey);
    expect(guardAdminRequest(new Request(`${preview}/admin`, { headers: { authorization: basic() } }))).toBeNull();
  });
  it.each(["wrong", "Bearer delegated", "Basic !!!", `Basic ${Buffer.from("someone:wrong").toString("base64")}`])("rejects invalid gateway credentials: %s", header => {
    enableDemo();
    expect(guardAdminRequest(new Request(`${preview}/api/admin/prayers`, {
      headers: { authorization: header, "x-admin-authorized": "true" },
    }))?.status).toBe(401);
  });
  it("requires same-origin mutations even with valid gateway credentials", () => {
    enableDemo();
    for (const origin of ["", "https://attacker.example", "null", "http://cms-preview.example"]) {
      expect(guardAdminRequest(new Request(`${preview}/api/admin/prayers`, {
        method: "POST", headers: { authorization: basic(), ...(origin ? { origin } : {}) },
      }))?.status).toBe(403);
    }
    expect(guardAdminRequest(new Request(`${preview}/api/admin/prayers`, {
      method: "POST", headers: { authorization: basic(), origin: preview },
    }))).toBeNull();
  });
  it("rejects cross-site fetch metadata and oversized declared bodies", () => {
    vi.stubEnv("CMS_ADMIN_MODE", "local");
    expect(guardAdminRequest(new Request(`${local}/api/admin/prayers`, {
      method: "POST", headers: { origin: local, "sec-fetch-site": "cross-site" },
    }))?.status).toBe(403);
    expect(guardAdminRequest(new Request(`${local}/api/admin/prayers`, {
      method: "POST", headers: { origin: local, "content-length": "9999999" },
    }))?.status).toBe(413);
  });
  it("accepts the real loopback Host after Next normalizes a request URL to localhost", () => {
    vi.stubEnv("CMS_ADMIN_MODE", "local");
    expect(guardAdminRequest(new Request("http://localhost:3106/api/admin/prayers", {
      method: "POST", headers: { host: "127.0.0.1:3106", origin: local },
    }))).toBeNull();
  });
  it.each([
    ["localhost:3107", "http://localhost:3107"],
    ["attacker.example:3106", "http://attacker.example:3106"],
    ["127.0.0.1:3106", "http://localhost:3106"],
    ["127.0.0.1:3106@attacker.example", "http://attacker.example"],
    ["127.0.0.1:3106/path", local],
    ["127.0.0.1:3106,attacker.example", local],
    ["local host:3106", local],
  ])("rejects malformed, remote or mismatched CSRF Host %s", (host, requestOrigin) => {
    vi.stubEnv("CMS_ADMIN_MODE", "local");
    expect(guardAdminRequest(new Request("http://localhost:3106/api/admin/prayers", {
      method: "POST", headers: { host, origin: requestOrigin },
    }))?.status).toBe(403);
  });
  it("uses HTTPS and the real Host for an authenticated preview after worker normalization", () => {
    enableDemo();
    expect(guardAdminRequest(new Request("http://localhost:3106/api/admin/prayers", {
      method: "POST", headers: { host: "cms-preview.example", origin: preview, authorization: basic(), "x-forwarded-host": "attacker.example" },
    }))).toBeNull();
    expect(guardAdminRequest(new Request("http://localhost:3106/api/admin/prayers", {
      method: "POST", headers: { host: "cms-preview.example", origin: "https://attacker.example", authorization: basic(), "x-forwarded-host": "attacker.example" },
    }))?.status).toBe(403);
  });
});
