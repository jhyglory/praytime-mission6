import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AdminLoginPage from "../src/app/admin/login/page";
import { AdminLoginForm } from "../src/components/admin-login/admin-login-form";

const { getMentorCredentials } = vi.hoisted(() => ({ getMentorCredentials: vi.fn() }));
vi.mock("../src/lib/prayers/admin-credentials", () => ({ getMentorCredentials }));
vi.mock("../src/components/admin-login/admin-login-screen", () => ({ AdminLoginScreen: vi.fn() }));
vi.mock("../src/components/admin-login/admin-login-connected", () => ({ AdminLoginConnected: vi.fn() }));

// Synthetic credentials only; no environment files or real authentication are used.
beforeEach(() => {
  getMentorCredentials.mockReset().mockReturnValue({ username: "unit-mentor", passwordHash: "unit-only-private-hash" });
  // The Node test transform uses classic JSX; Next uses its configured JSX runtime.
  vi.stubGlobal("React", React);
});
afterEach(() => vi.unstubAllGlobals());

async function clientProps(params: Record<string, string | string[] | undefined>) {
  const result = await AdminLoginPage({ searchParams: Promise.resolve(params) });
  const page = result as React.ReactElement<{ children: React.ReactElement<{ initialUsername: string }> }>;
  return page.props.children.props;
}

function inputs(initialUsername?: string) {
  const html = renderToStaticMarkup(React.createElement(AdminLoginForm, { initialUsername }));
  const tags = html.match(/<input\b[^>]*>/g) ?? [];
  return {
    html,
    username: tags.find(tag => /autocomplete="username"/i.test(tag)),
    password: tags.find(tag => /autocomplete="current-password"/i.test(tag)),
  };
}

describe("mentor login username prefill", () => {
  it("awaits the query and passes only the configured username scalar to the client", async () => {
    expect(await clientProps({ account: "mentor" })).toEqual({ initialUsername: "unit-mentor" });
    expect(getMentorCredentials).toHaveBeenCalledExactlyOnceWith();
  });

  it.each([
    {}, { account: "owner" }, { account: "MENTOR" }, { account: " mentor" },
    { account: ["mentor"] }, { account: ["mentor", "owner"] },
    { username: "query-user", password: "query-password" },
  ])("preserves the empty owner form and ignores other query values %j", async params => {
    expect(await clientProps(params)).toEqual({ initialUsername: "" });
    expect(getMentorCredentials).not.toHaveBeenCalled();
  });

  it("ignores arbitrary username/password query values on a mentor link", async () => {
    expect(await clientProps({ account: "mentor", username: "query-user", password: "query-password" }))
      .toEqual({ initialUsername: "unit-mentor" });
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

  it("escapes an initial username as input text", () => {
    const rendered = inputs('unit-mentor"><script>');
    expect(rendered.username).toContain('value="unit-mentor&quot;&gt;&lt;script&gt;"');
    expect(rendered.html).not.toContain("<script>");
  });
});
