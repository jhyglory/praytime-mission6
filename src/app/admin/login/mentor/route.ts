import { getAdminAccessState } from "@/lib/prayers/admin-access";
import { adminRequestOrigin } from "@/lib/prayers/admin-request";
import { mentorPrefillCookie, readMentorPrefillGrant } from "@/lib/admin-login/mentor-prefill";

export const dynamic = "force-dynamic";

/** A prefill capability fills a form only; it never creates an administrator session. */
export function GET(request: Request): Response {
  const state = getAdminAccessState(request.url);
  const origin = adminRequestOrigin(request, false);
  const headers = new Headers({
    "Cache-Control": "private, no-store",
    "Referrer-Policy": "no-referrer",
    "X-Robots-Tag": "noindex, nofollow",
  });
  if (!state.enabled || state.mode !== "protected-demo" || !origin) {
    return new Response(null, { status: 403, headers });
  }
  const values = new URL(request.url).searchParams.getAll("entry");
  const token = values.length === 1 ? values[0] : "";
  const valid = readMentorPrefillGrant(token, origin) !== null;
  headers.set("Set-Cookie", mentorPrefillCookie(valid ? token : null));
  headers.set("Location", new URL("/admin/login?account=mentor", origin).href);
  return new Response(null, { status: 303, headers });
}
