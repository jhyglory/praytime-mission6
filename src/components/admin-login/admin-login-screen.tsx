import Image from "next/image";
import Link from "next/link";

export function AdminLoginScreen({ children }: { children: React.ReactNode }) {
  return <div className="admin-login">
    <a className="admin-login-skip" href="#admin-login-main">로그인 입력으로 건너뛰기</a>
    <aside className="admin-login-brand" aria-label="PrayTime 브랜드">
      <Link className="admin-login-brand-logo" href="/" prefetch={false} aria-label="PrayTime 소개로 돌아가기">
        <Image src="/assets/restored-intro/praytime-wordmark-desktop.svg" alt="PrayTime" width={277} height={45} />
      </Link>
      <div className="admin-login-brand-copy">
        <p className="admin-login-manifesto" lang="en"><span>PAUSE.</span>{" "}<span>PRAY.</span>{" "}<span>CHOOSE.</span></p>
        <p className="admin-login-brand-description">멈추고, 기도하고, <br className="admin-login-brand-break" />다시 선택합니다.</p>
      </div>
      <div className="admin-login-brand-art" aria-hidden="true">
        <Image
          className="admin-login-brand-image"
          src="/assets/high-resolution/hero-hq-fcbad7e4f361.png"
          alt=""
          fill
          loading="eager"
          sizes="(max-width: 599px) 1px, (max-width: 959px) 45vw, 50vw"
        />
      </div>
    </aside>
    <main className="admin-login-main" id="admin-login-main" tabIndex={-1}>
      <section className="admin-login-card" aria-labelledby="admin-login-title">
        <header className="admin-login-card-header">
          <p className="admin-login-eyebrow">PrayTime Admin</p>
          <h1 id="admin-login-title">관리자 로그인</h1>
          <p className="admin-login-description">PrayTime 콘텐츠 관리 시스템에 로그인하세요.</p>
        </header>
        {children}
      </section>
    </main>
  </div>;
}
