/** Host comparison never grants access. It binds authenticated changes and sessions to their actual origin. */
export function adminRequestOrigin(request: Request, local: boolean): string | null {
  const requestUrl = new URL(request.url);
  const host = request.headers.get("host") ?? requestUrl.host;
  if (host.length > 259 || !/^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?(?::\d{1,5})?$/i.test(host)
    || host.includes("..") || /[\s,@/\\?#]/.test(host)) return null;
  try {
    if (local) {
      if (!["http:", "https:"].includes(requestUrl.protocol)) return null;
      const actual = new URL(`${requestUrl.protocol}//${host}`);
      const loopback = ["localhost", "127.0.0.1"];
      if (!loopback.includes(requestUrl.hostname) || !loopback.includes(actual.hostname) || actual.port !== requestUrl.port) return null;
      return actual.origin;
    }
    return new URL(`https://${host}`).origin;
  } catch { return null; }
}
