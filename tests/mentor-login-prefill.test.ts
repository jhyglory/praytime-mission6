import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AdminLoginPage, { dynamic, metadata } from "../src/app/admin/login/page";
import { AdminLoginForm } from "../src/components/admin-login/admin-login-form";
import type { AdminLoginAuthenticator } from "../src/lib/admin-login/contracts";

const { getMentorCredentials, mentorPrefillFromRequest, requestHeaders } = vi.hoisted(() => ({
  getMentorCredentials: vi.fn(), mentorPrefillFromRequest: vi.fn(), requestHeaders: vi.fn(),
}));
vi.mock("../src/lib/prayers/admin-credentials", () => ({ getMentorCredentials }));
vi.mock("../src/lib/admin-login/mentor-prefill", () => ({ mentorPrefillFromRequest }));
vi.mock("next/headers", () => ({ headers: requestHeaders }));
vi.mock("../src/components/admin-login/admin-login-screen", () => ({ AdminLoginScreen: vi.fn() }));
vi.mock("../src/components/admin-login/admin-login-connected", () => ({ AdminLoginConnected: vi.fn() }));

// Synthetic credentials only; no environment files or real authentication are used.
beforeEach(() => {
  getMentorCredentials.mockReset().mockReturnValue({ username: "unit-mentor", passwordHash: "unit-only-private-hash" });
  mentorPrefillFromRequest.mockReset().mockReturnValue(null);
  requestHeaders.mockReset().mockResolvedValue(new Headers({ host: "unit-mentor.example.test", "x-forwarded-proto": "https", cookie: "unit-prefill=synthetic-grant" }));
  vi.stubGlobal("fetch", vi.fn(() => { throw new Error("No network requests are permitted in this prefill test"); }));
  // The Node test transform uses classic JSX; Next uses its configured JSX runtime.
  vi.stubGlobal("React", React);
});
afterEach(() => vi.unstubAllGlobals());

async function clientProps(params: Record<string, string | string[] | undefined>) {
  const result = await AdminLoginPage({ searchParams: Promise.resolve(params) });
  const page = result as React.ReactElement<{ children: React.ReactElement<{ initialUsername: string; initialPassword?: string }> }>;
  return page.props.children.props;
}

function inputs(initialUsername?: string, initialPassword?: string, authenticate?: AdminLoginAuthenticator) {
  const html = renderToStaticMarkup(React.createElement(AdminLoginForm, { initialUsername, initialPassword, authenticate }));
  const tags = html.match(/<input\b[^>]*>/g) ?? [];
  return {
    html,
    username: tags.find(tag => /autocomplete="username"/i.test(tag)),
    password: tags.find(tag => /autocomplete="current-password"/i.test(tag)),
  };
}

describe("mentor login prefill", () => {
  it("keeps the page dynamic and forbids referring URLs", () => {
    expect(dynamic).toBe("force-dynamic");
    expect(metadata.referrer).toBe("no-referrer");
  });

  it("awaits the query and passes only the configured username without a validated grant", async () => {
    expect(await clientProps({ account: "mentor" })).toEqual({ initialUsername: "unit-mentor" });
    expect(getMentorCredentials).toHaveBeenCalledExactlyOnceWith();
  });

  it.each([
    {}, { account: "owner" }, { account: "MENTOR" }, { account: " mentor" },
    { account: ["mentor"] }, { account: ["mentor", "owner"] },
    { username: "query-user", password: "query-password" },
    { grant: "synthetic-query-grant", password: "query-password" },
  ])("preserves the empty owner form and ignores other query values %j", async params => {
    expect(await clientProps(params)).toEqual({ initialUsername: "" });
    expect(getMentorCredentials).not.toHaveBeenCalled();
    expect(mentorPrefillFromRequest).not.toHaveBeenCalled();
    expect(requestHeaders).not.toHaveBeenCalled();
  });

  it("ignores arbitrary username/password query values on a mentor link", async () => {
    expect(await clientProps({ account: "mentor", username: "query-user", password: "query-password", grant: "synthetic-query-grant" }))
      .toEqual({ initialUsername: "unit-mentor" });
    expect(mentorPrefillFromRequest.mock.calls[0][0].url).toBe("https://localhost/admin/login");
  });

  it("passes only the validated grant's username and password scalars", async () => {
    mentorPrefillFromRequest.mockReturnValueOnce({ username: "unit-granted-mentor", password: "unit-only-granted-password" });

    expect(await clientProps({ account: "mentor" })).toEqual({ initialUsername: "unit-granted-mentor", initialPassword: "unit-only-granted-password" });
    expect(getMentorCredentials).not.toHaveBeenCalled();
    expect(requestHeaders).toHaveBeenCalledExactlyOnceWith();
    const [request] = mentorPrefillFromRequest.mock.calls[0];
    expect(request).toBeInstanceOf(Request);
    expect(request.url).toBe("https://localhost/admin/login");
    expect(request.headers.get("host")).toBe("unit-mentor.example.test");
    expect(request.headers.get("cookie")).toBe("unit-prefill=synthetic-grant");
  });

  it("uses an empty username when mentor credentials are unavailable", async () => {
    getMentorCredentials.mockReturnValueOnce(null);
    expect(await clientProps({ account: "mentor" })).toEqual({ initialUsername: "" });
  });

  it("renders only the initial username while leaving the password empty", () => {
    const rendered = inputs("unit-mentor");
    expect(rendered.username).toContain('value="unit-mentor"');
    expect(rendered.password).toContain('type="password"');
    expect(rendered.password).toContain('value=""');
    expect(rendered.html).not.toContain("unit-only-private-hash");
  });

  it("keeps both inputs empty by default", () => {
    const rendered = inputs();
    expect(rendered.username).toContain('value=""');
    expect(rendered.password).toContain('value=""');
  });

  it("renders an accepted password masked and editable without submitting or requesting anything", () => {
    const authenticate = vi.fn<AdminLoginAuthenticator>(async () => undefined);
    const rendered = inputs("unit-mentor", "unit-only-prefilled-password", authenticate);

    expect(rendered.username).toContain('value="unit-mentor"');
    expect(rendered.password).toContain('value="unit-only-prefilled-password"');
    expect(rendered.password).toContain('type="password"');
    expect(rendered.password).not.toMatch(/(?:disabled|readonly)=/i);
    expect(authenticate).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("escapes an initial username as input text", () => {
    const rendered = inputs('unit-mentor"><script>');
    expect(rendered.username).toContain('value="unit-mentor&quot;&gt;&lt;script&gt;"');
    expect(rendered.html).not.toContain("<script>");
  });
});
