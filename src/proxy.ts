import { NextResponse, type NextRequest } from "next/server";
import { getAdminAccessState, guardAdminRequest } from "@/lib/prayers/admin-access";
import { hasAdminSession } from "@/lib/prayers/admin-session";

export function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const state = getAdminAccessState(request.url);
  if (state.enabled && path === "/admin/login" && ["GET", "HEAD"].includes(request.method)) {
    if (hasAdminSession(request)) return new Response(null, { status: 303, headers: { Location: "/admin/prayers", "Cache-Control": "no-store" } });
    return NextResponse.next();
  }
  // This exact endpoint verifies mode, origin, body limits and credentials itself.
  if (state.enabled && path === "/api/admin/session" && ["GET", "POST", "DELETE"].includes(request.method)) return NextResponse.next();
  const isPage = !path.startsWith("/api/");
  const denied = guardAdminRequest(request, { sessionOnly: isPage });
  if (!denied) return NextResponse.next();
  if (!isPage) return denied;
  if (denied.status === 401) return new Response(null, { status: 303, headers: { Location: "/admin/login", "Cache-Control": "no-store" } });
  const headers = new Headers(denied.headers);
  headers.set("Content-Type", "text/html; charset=utf-8");
  return new Response('<!doctype html><html lang="ko"><meta name="viewport" content="width=device-width, initial-scale=1"><title>PrayTime 관리자 접근</title><body><main style="max-width:42rem;margin:12vh auto;padding:2rem;font-family:system-ui;line-height:1.8"><h1>관리자 접근이 제한되어 있습니다</h1><p>로컬 개발 환경 또는 접근이 보호된 미리보기에서 관리자 기능을 사용할 수 있습니다.</p><p>관리자 로그인은 안내받은 평가용 전용 접속 링크를 통해 이용해 주세요.</p><a href="/prayers">공개 기도문 보기</a> · <a href="/">PrayTime 홈</a></main></body></html>', { status: denied.status, headers });
}

export const config = { matcher: ["/admin/:path*", "/api/admin/:path*"] };
