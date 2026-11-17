import { createHash, timingSafeEqual } from "node:crypto";

export function getAdminCredentials(): { username: string; passwordHash: string } | null {
  const username = process.env.CMS_ADMIN_USERNAME;
  const passwordHash = process.env.CMS_ADMIN_PASSWORD_SHA256;
  if (username || passwordHash) {
    if (!username || !/^[A-Za-z0-9._-]{1,80}$/.test(username) || !/^[a-f0-9]{64}$/i.test(passwordHash ?? "")) return null;
    return { username, passwordHash: passwordHash!.toLowerCase() };
  }
  const key = process.env.CMS_ADMIN_ACCESS_KEY;
  return key && key.length >= 32 ? { username: "demo", passwordHash: createHash("sha256").update(key).digest("hex") } : null;
}

export function verifyAdminCredentials(username: string, password: string): boolean {
  const expected = getAdminCredentials();
  if (!expected) return false;
  const digest = (value: string) => createHash("sha256").update(value).digest();
  const userMatches = timingSafeEqual(digest(username), digest(expected.username));
  const passwordMatches = timingSafeEqual(digest(password), Buffer.from(expected.passwordHash, "hex"));
  return userMatches && passwordMatches;
}

export function hasAdminBasicCredentials(request: Request): boolean {
  const match = /^Basic ([A-Za-z0-9+/]+={0,2})$/i.exec(request.headers.get("authorization") ?? "");
  if (!match || match[1].length > 4096 || match[1].length % 4 !== 0) return false;
  const decoded = Buffer.from(match[1], "base64").toString("utf8");
  const separator = decoded.indexOf(":");
  return separator > 0 && verifyAdminCredentials(decoded.slice(0, separator), decoded.slice(separator + 1));
}
