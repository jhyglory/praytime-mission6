import { createAdminSessionApi } from "@/lib/admin-login/session-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const session = createAdminSessionApi();
export const POST = session.POST;
export const GET = session.GET;
export const DELETE = session.DELETE;
