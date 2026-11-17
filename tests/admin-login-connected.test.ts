import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { authenticateAdminSession } from "../src/components/admin-login/admin-login-connected";
import { AdminLoginAuthenticationError } from "../src/lib/admin-login/contracts";

vi.mock("next/navigation", () => ({ useRouter: vi.fn() }));
vi.mock("../src/components/admin-login/admin-login-form", () => ({ AdminLoginForm: vi.fn() }));

// These synthetic fetch responses verify the frontend contract, not real authentication.
const credentials = { username: " unit-review-operator ", password: " test-only password: 한글 " };
const fetchMock = vi.fn<typeof fetch>();
const authenticated = () => Response.json({ authenticated: true });

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe("connected administrator login frontend contract", () => {
  it("sends the exact credentials and abort signal, then confirms the same-origin session", async () => {
    const signal = new AbortController().signal;
    fetchMock.mockResolvedValueOnce(authenticated()).mockResolvedValueOnce(authenticated());

    await expect(authenticateAdminSession(credentials, signal)).resolves.toBeUndefined();

    expect(fetchMock.mock.calls).toEqual([
      ["/api/admin/session", {
        method: "POST", credentials: "same-origin", cache: "no-store",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ username: "unit-review-operator", password: credentials.password }), signal,
      }],
      ["/api/admin/session", {
        method: "GET", credentials: "same-origin", cache: "no-store",
        headers: { Accept: "application/json" }, signal,
      }],
    ]);
    expect(credentials.password).toBe(" test-only password: 한글 ");
  });

  it("does not resolve until the GET confirmation succeeds", async () => {
    let confirm!: (response: Response) => void;
    const confirmation = new Promise<Response>(resolve => { confirm = resolve; });
    fetchMock.mockResolvedValueOnce(authenticated()).mockReturnValueOnce(confirmation);
    let finished = false;
    const login = authenticateAdminSession(credentials, new AbortController().signal).then(() => { finished = true; });

    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(finished).toBe(false);
    confirm(authenticated());
    await login;
    expect(finished).toBe(true);
  });

  it.each([
    [401, "invalid-credentials"], [429, "rate-limited"], [503, "unavailable"], [201, "unavailable"],
  ] as const)("maps POST %s to %s without requesting session confirmation", async (status, code) => {
    fetchMock.mockResolvedValueOnce(Response.json({ authenticated: false }, { status }));

    await expect(authenticateAdminSession(credentials, new AbortController().signal))
      .rejects.toMatchObject({ name: "AdminLoginAuthenticationError", code });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it.each([false, null, {}, { authenticated: false }, { authenticated: "true" }])(
    "rejects an unconfirmed POST payload %j before making GET", async payload => {
      fetchMock.mockResolvedValueOnce(Response.json(payload));

      await expect(authenticateAdminSession(credentials, new AbortController().signal))
        .rejects.toMatchObject({ code: "unavailable" });
      expect(fetchMock).toHaveBeenCalledTimes(1);
    },
  );

  it("rejects malformed POST JSON", async () => {
    fetchMock.mockResolvedValueOnce(new Response("invalid-json", { status: 200 }));

    await expect(authenticateAdminSession(credentials, new AbortController().signal))
      .rejects.toBeInstanceOf(AdminLoginAuthenticationError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it.each([401, 429, 503, 204])("treats GET %s as unavailable rather than invalid credentials", async status => {
    fetchMock.mockResolvedValueOnce(authenticated()).mockResolvedValueOnce(new Response(null, { status }));

    await expect(authenticateAdminSession(credentials, new AbortController().signal))
      .rejects.toMatchObject({ code: "unavailable" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it.each([false, null, {}, { authenticated: false }, { authenticated: "true" }])(
    "rejects an unconfirmed GET payload %j", async payload => {
      fetchMock.mockResolvedValueOnce(authenticated()).mockResolvedValueOnce(Response.json(payload));

      await expect(authenticateAdminSession(credentials, new AbortController().signal))
        .rejects.toMatchObject({ code: "unavailable" });
      expect(fetchMock).toHaveBeenCalledTimes(2);
    },
  );

  it("treats malformed GET JSON as unavailable", async () => {
    fetchMock.mockResolvedValueOnce(authenticated()).mockResolvedValueOnce(new Response("invalid-json"));

    await expect(authenticateAdminSession(credentials, new AbortController().signal))
      .rejects.toMatchObject({ code: "unavailable" });
  });

  it.each(["POST", "GET"])("maps a %s network failure to unavailable", async phase => {
    if (phase === "GET") fetchMock.mockResolvedValueOnce(authenticated());
    fetchMock.mockRejectedValueOnce(new TypeError("Synthetic fetch failure"));

    await expect(authenticateAdminSession(credentials, new AbortController().signal))
      .rejects.toMatchObject({ code: "unavailable" });
  });

  it.each(["POST", "GET"])("preserves cancellation during %s", async phase => {
    const controller = new AbortController();
    const aborted = new DOMException("Synthetic cancellation", "AbortError");
    if (phase === "GET") fetchMock.mockResolvedValueOnce(authenticated());
    fetchMock.mockImplementationOnce(async () => {
      controller.abort();
      throw aborted;
    });

    await expect(authenticateAdminSession(credentials, controller.signal)).rejects.toBe(aborted);
    for (const [, options] of fetchMock.mock.calls) expect(options?.signal).toBe(controller.signal);
  });
});
