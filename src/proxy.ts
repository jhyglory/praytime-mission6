import { NextResponse, type NextRequest } from "next/server";
import { guardAdminRequest } from "@/lib/prayers/admin-access";

export function proxy(request: NextRequest) {
  const denied = guardAdminRequest(request);
  if (!denied) return NextResponse.next();
  if (request.nextUrl.pathname.startsWith("/api/")) return denied;
  // Keep the native browser Basic challenge; this is a gateway, not an app account system.
  const headers = new Headers(denied.headers);
  headers.set("Content-Type", "text/html; charset=utf-8");
  return new Response('<!doctype html><html lang="ko"><meta name="viewport" content="width=device-width, initial-scale=1"><title>PrayTime 관리자 접근</title><body><main style="max-width:42rem;margin:12vh auto;padding:2rem;font-family:system-ui;line-height:1.8"><h1>관리자 접근이 제한되어 있습니다</h1><p>로컬 개발 환경 또는 접근이 보호된 미리보기에서 관리자 기능을 사용할 수 있습니다.</p><p>미리보기 접근 키를 안내받았다면 브라우저의 인증창에 입력해 주세요.</p><a href="/prayers">공개 기도문 보기</a> · <a href="/">PrayTime 홈</a></main></body></html>', { status: denied.status, headers });
}

export const config = { matcher: ["/admin/:path*", "/api/admin/:path*"] };
