# 관리자 로그인 UI와 향후 인증 연결 계획

## 현재 범위와 접근 경로

이번 변경은 브랜드 로그인 화면과 재사용 가능한 폼 UI다. Vercel 접근 제한,
HTTP Basic 게이트, 관리자 API 권한 검사, 환경 변수와 데이터베이스는 변경하지 않는다.
기존 접근 안내는 [ACCESS.md](ACCESS.md)를 따른다.

새 화면을 보호된 Preview에 추후 배포한다면 접근 순서는 다음과 같다. 이번 작업에서는
기존 Preview를 변경하지 않고 로컬에서만 화면을 검수한다.

`Vercel 접근 제한 → 공유 HTTP Basic 게이트 → /admin/login → 미연결 이메일 로그인 폼`

브라우저의 기본 인증창은 React 화면이 전달되기 전에 HTTP 게이트가 요청한다.
새 브랜드 화면은 그 게이트를 통과한 뒤 표시되므로 기본 인증창을 대체하지 않는다.
공유 게이트의 사용자 이름·비밀번호는 이메일 계정으로 자동 연결되지 않는다.
공개 Production의 관리자 차단과 명시적 로컬 Demo 조건도 그대로 유지한다.

## 라우팅과 화면 프레임

`/admin/login`은 기존 `/admin/:path*` proxy matcher 안에 있다. `/login` 별도 경로나
인증 예외를 만들지 않으며, proxy와 `guardAdminRequest`를 수정하지 않는다.
Proxy는 페이지 렌더링 전에 실행된다. [Next.js Proxy](https://nextjs.org/docs/app/api-reference/file-conventions/proxy)

`src/app/admin/layout.tsx`는 메타데이터와 `mission6.css`를 유지하고 `AdminFrame`으로
자식을 감싼다. 이 Client Component는 `usePathname() === "/admin/login"`일 때만
기존 `PrayerShell`을 생략한다. 이는 시각적 프레임 선택이며 접근 권한의 예외가 아니다.
나머지 관리자 경로는 기존 `PrayerShell admin` 구조를 사용하고 CRUD 라우트는 이동하지 않는다.

현재 설정에는 URL rewrite나 활성화된 Cache Components가 없다. 따라서 별도의
마운트 후 경로 교체 없이 현재 구조를 유지한다. 향후 rewrite를 추가하면 서버와
브라우저 경로 차이에 따른 hydration을, Cache Components를 켜면 동적 경로의
Suspense 필요성을 다시 검토한다. [usePathname 공식 문서](https://nextjs.org/docs/app/api-reference/functions/use-pathname)

## 폼과 연결 어댑터

현재 계약은 `src/lib/admin-login/contracts.ts`의 다음 타입이다.

```ts
type AdminLoginAuthenticator = (
  credentials: { email: string; password: string },
  signal: AbortSignal,
) => Promise<void>;
```

`AdminLoginForm`은 선택적 `authenticate` 어댑터를 받는다. 실제 페이지는 어댑터를
전달하지 않으므로 로그인 버튼을 비활성화하고 이메일 로그인이 준비 중임을 알린다.
이메일 형식·필수값·비밀번호 표시 전환은 UI 동작이며 신원 확인이 아니다.

- 기본 폼은 계정 정보를 전송하지 않고, Basic 헤더나 로컬 세션 플래그를 만들지 않는다.
- 로딩은 실제 어댑터 호출 중에만, 인증 오류는 실제 어댑터 실패 시에만 표시한다.
- 어댑터는 서버가 실제 세션을 검증한 뒤에만 resolve해야 한다. 그 이후에만
  `onAuthenticated` 콜백을 사용할 수 있으며, 콜백 자체가 API 권한을 부여하지 않는다.
- 화면을 벗어나면 `AbortSignal`로 요청 취소를 전달한다. 비밀번호는 변환하지 않으며
  URL·로그·localStorage·sessionStorage에 기록하지 않는다.
- 지연 후 성공 처리, 가짜 리다이렉트와 인증 상태 시뮬레이션은 넣지 않는다.
  상태 검토용 어댑터는 별도 테스트 하네스에서만 사용한다.

## 향후 인증 선택지

아래 두 방식은 설계 선택지이며 이번 UI 작업에서 구현하거나 활성화하지 않는다.

| 구분 | A. Supabase Auth | B. 서버 관리 세션 |
| --- | --- | --- |
| 적합한 목적 | 실제 관리자 계정, 향후 모바일 인증 재사용 | 제한된 운영자용 자체 로그인 |
| 폼 연결 | 이메일·비밀번호 인증 API | 승인된 자격 검증 endpoint |
| 추가 구성 | Auth 계정 정책, SSR 쿠키 갱신, 관리자 권한 | 안전한 쿠키, 세션 만료·철회·회전·로그아웃 |
| 주요 부담 | 로그인과 관리자 권한을 별도로 검증 | 자격·세션 보안을 애플리케이션이 책임짐 |

### A. Supabase Auth

기존 `@supabase/supabase-js`에 인증 흐름을 연결하고, Next.js SSR에는 현재 설치되지
않은 `@supabase/ssr` 및 쿠키 갱신 구성을 검토한다. 이메일 로그인은 실제
`signInWithPassword` 결과를 사용한다. 서버는 `getClaims`로 토큰을 검증하고,
최신 사용자 정보가 필요하면 `getUser`를 사용한다. 쿠키에서 읽은 `getSession`의
사용자 정보만으로 권한을 판단하지 않는다.
[Supabase SSR](https://supabase.com/docs/guides/auth/server-side/nextjs),
[비밀번호 로그인](https://supabase.com/docs/reference/javascript/auth-signinwithpassword)

로그인한 모든 사용자를 관리자로 취급해서는 안 된다. 승인된 관리자 목록 또는
서버가 관리하는 권한을 각 관리자 API에서 확인해야 한다. 사용자 수정이 가능한
`user_metadata`를 권한 근거로 쓰지 않는다. 계정 발급·회수·복구와 RLS/Storage
정책, 기존 서버용 키 사용 경계를 함께 설계해야 한다.
[Supabase RLS와 메타데이터](https://supabase.com/docs/guides/database/postgres/row-level-security)

### B. 서버 관리 세션

로그인 endpoint에서 자격을 확인하고, 서버가 발급한 세션을 `HttpOnly`, `Secure`,
`SameSite` 쿠키로 관리한다. DB 세션은 별도 저장소와 만료·철회 조회가 필요하고,
암호화된 stateless 쿠키는 즉시 철회 전략을 별도로 마련해야 한다. 로그인 시도 제한,
세션 회전·로그아웃·CSRF와 모든 데이터 요청의 권한 검사를 포함한다. Next.js는
직접 인증을 만드는 대신 검증된 인증 라이브러리 사용을 권장한다.
[Next.js 인증과 세션](https://nextjs.org/docs/app/guides/authentication)

이 방식을 선택하더라도 현재 공유 사용자 이름과 새 이메일 입력의 관계를 먼저
정의해야 한다. 클라이언트에서 기존 게이트 비밀번호와 비교하는 방식은 사용하지 않는다.

## 실제 연결 전 결정 사항

계정 기반 인증 도입, 인증용 데이터·환경 설정, 게이트 교체와 배포는 별도 작업 범위로
확정한다. 어떤 방식을 선택하든 서버 Secret/Service Role은 브라우저에 전달하지 않고,
세션 검증과 관리자 권한 확인을 데이터 처리 경계에서 수행한다. 보호 수단을 전환할 때는
새 접근 경로가 검증되기 전에 기존 Vercel·HTTP 게이트를 해제하지 않는다.
