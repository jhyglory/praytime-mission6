import { prayerApi } from "@/lib/prayers/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };
export async function GET(request: Request, context: Context) { return prayerApi.adminDetail(request, (await context.params).id); }
export async function PATCH(request: Request, context: Context) { return prayerApi.update(request, (await context.params).id); }
export async function DELETE(request: Request, context: Context) { return prayerApi.delete(request, (await context.params).id); }
