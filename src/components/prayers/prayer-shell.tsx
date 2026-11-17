/* eslint-disable @next/next/no-img-element -- Reuses the original local SVG wordmark. */
import Link from "next/link";
import { AdminLogout } from "@/components/admin-login/admin-logout";

export function PrayerShell({ children, admin = false }: { children: React.ReactNode; admin?: boolean }) {
  return <div className={`m6-shell${admin ? " m6-shell--admin" : ""}`}>
    <a className="m6-skip" href="#m6-main">본문으로 건너뛰기</a>
    <header className="m6-header">
      <div className="m6-header-inner">
        <Link href="/" prefetch={false} className="m6-brand" aria-label="PrayTime 처음으로">
          <img src="/assets/restored-intro/praytime-wordmark-desktop.svg" width="168" height="28" alt="PrayTime" />
        </Link>
        {admin && <span className="m6-admin-label">CONTENT MANAGER</span>}
        <nav aria-label={admin ? "콘텐츠 관리 메뉴" : "기도 체험 메뉴"}>
          <Link href={admin ? "/admin/prayers" : "/prayers"}>{admin ? "기도문 관리" : "기도 가이드"}</Link>
          <Link href={admin ? "/prayers" : "/"} prefetch={admin ? undefined : false}>{admin ? "사용자 화면 보기" : "PrayTime 소개"}</Link>
          {admin && <AdminLogout />}
        </nav>
      </div>
    </header>
    <main id="m6-main" className="m6-main" tabIndex={-1}>{children}</main>
    <footer className="m6-footer"><span>PAUSE · PRAY · CHOOSE</span><p>{admin ? "기도의 시간을 준비하는 콘텐츠 관리 공간" : "잠깐 멈추고, 기도하고, 다시 선택합니다."}</p></footer>
  </div>;
}
