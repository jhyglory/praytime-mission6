import { createHash, timingSafeEqual } from "node:crypto";

export type AdminPrincipal = "owner" | "mentor";
interface AdminCredentials { username: string; passwordHash: string }

function configuredCredentials(username: string | undefined, passwordHash: string | undefined): AdminCredentials | null {
  if (!username || !/^[A-Za-z0-9._-]{1,80}$/.test(username) || !/^[a-f0-9]{64}$/i.test(passwordHash ?? "")) return null;
  return { username, passwordHash: passwordHash!.toLowerCase() };
}

export function getAdminCredentials(): AdminCredentials | null {
  const username = process.env.CMS_ADMIN_USERNAME;
  const passwordHash = process.env.CMS_ADMIN_PASSWORD_SHA256;
  if (username || passwordHash) {
    return configuredCredentials(username, passwordHash);
  }
  const key = process.env.CMS_ADMIN_ACCESS_KEY;
  return key && key.length >= 32 ? { username: "demo", passwordHash: createHash("sha256").update(key).digest("hex") } : null;
}

export function getMentorCredentials(): AdminCredentials | null {
  const owner = getAdminCredentials();
  const mentor = configuredCredentials(process.env.CMS_MENTOR_USERNAME, process.env.CMS_MENTOR_PASSWORD_SHA256);
  return owner && mentor && owner.username !== mentor.username ? mentor : null;
}

function verifyCredentials(expected: AdminCredentials | null, username: string, password: string): boolean {
  if (!expected) return false;
  const digest = (value: string) => createHash("sha256").update(value).digest();
  const userMatches = timingSafeEqual(digest(username), digest(expected.username));
  const passwordMatches = timingSafeEqual(digest(password), Buffer.from(expected.passwordHash, "hex"));
  return userMatches && passwordMatches;
}

/** Basic compatibility remains owner-only. Mentor access is granted by its verified form session. */
export function verifyAdminCredentials(username: string, password: string): boolean {
  return verifyCredentials(getAdminCredentials(), username, password);
}

export function authenticateAdminCredentials(username: string, password: string): AdminPrincipal | null {
  const owner = verifyCredentials(getAdminCredentials(), username, password);
  const mentor = verifyCredentials(getMentorCredentials(), username, password);
  return owner ? "owner" : mentor ? "mentor" : null;
}

export function hasAdminBasicCredentials(request: Request): boolean {
  const match = /^Basic ([A-Za-z0-9+/]+={0,2})$/i.exec(request.headers.get("authorization") ?? "");
  if (!match || match[1].length > 4096 || match[1].length % 4 !== 0) return false;
  const decoded = Buffer.from(match[1], "base64").toString("utf8");
  const separator = decoded.indexOf(":");
  return separator > 0 && verifyAdminCredentials(decoded.slice(0, separator), decoded.slice(separator + 1));
}
