# 관리자 로그인과 향후 계정 인증 계획

## 현재 범위

처음에는 인증을 연결하지 않는 브랜드 UI만 승인되었지만, 이후 사용자의 실제 로그인
요청으로 기존 관리자 ID와 서버 세션을 연결했다. 이전의 미연결 이메일 폼 설명은
현재 동작의 기준이 아니다. 개인별 계정·Supabase Auth 사용자·인증용 DB 테이블은
생성하지 않았으며, 기존 기도문·Storage 스키마도 이 인증 작업에서 변경하지 않는다.

이번 연결은 보호된 Preview를 대상으로 한다. Vercel 접근 제한을 유지하고 공개
Production의 관리자 차단·읽기 전용 정책을 바꾸지 않으며, 공개 Production 배포는
이번 작업 범위에 포함하지 않는다. 실제 접근 안내는 [ACCESS.md](ACCESS.md)를 따른다.

## 두 단계의 접근과 로그인

`비공개 진입으로 Vercel 보호 쿠키 설정 → /admin/login → 기존 ID·비밀번호 검증 → 8시간 서버 서명 쿠키 → 관리자 화면`

Vercel 제한은 애플리케이션보다 먼저 실행된다. 보호 쿠키나 플랫폼 접근 권한이
없으면 Vercel 로그인으로 이동하며, 앱 세션만 추가한다고 이 제한이 없어지지 않는다.
비공개 진입 링크는 보호를 해제하는 공개 설정이 아니며, 포함된 접근 토큰이나 실제
자격정보를 이 문서·README·Git에 기록하지 않는다.

브랜드 화면은 기존 공유 ID를 입력받는다. 이를 임의의 이메일 계정으로 바꾸거나
클라이언트에서 비밀번호를 비교하지 않는다. 정상 브라우저 흐름은 HTTP Basic 창
대신 브랜드 폼과 세션을 사용하며, 유효한 기존 Basic 헤더는 관리자 API의 호환
접근으로만 남겨 둔다.

## Proxy와 서버 경계

기존 matcher `/admin/:path*`, `/api/admin/:path*` 안에서 처리한다. 페이지 렌더링 전
Proxy 검사 외에도 각 관리자 API가 서버에서 권한을 확인한다.
[Next.js Proxy](https://nextjs.org/docs/app/api-reference/file-conventions/proxy)

보호된 Preview에서의 동작은 다음과 같다. 모든 예외보다 허용 환경 검증이 먼저다.

| 경로·메서드 | 동작 |
| --- | --- |
| `GET/HEAD /admin/login` | 허용 환경에서 브랜드 폼 표시. 이미 유효한 세션이면 고정 관리자 목록으로 이동 |
| `POST /api/admin/session` | 환경·Origin·요청 크기·시도 제한·기존 자격 검증 후 세션 쿠키 발급 |
| `GET /api/admin/session` | 실제 세션 유효 여부 확인. Basic 헤더나 UI 플래그만으로 성공하지 않음 |
| `DELETE /api/admin/session` | 같은 Origin을 확인하고 현재 브라우저의 세션 쿠키 제거 |
| 나머지 관리자 페이지 | 세션 필수. 없으면 고정 `/admin/login`으로 이동 |
| 기도문 관리자 API | 유효한 세션 또는 기존 Basic 자격 필요. 없으면 JSON 401 |

예외는 정확한 경로와 메서드로 한정한다. 인접 경로나 하위 경로까지 접두사로 허용하지
않는다. 일반 세션 흐름의 401에는 `WWW-Authenticate`를 보내지 않아 기본 인증창을
다시 띄우지 않는다. 이동 목적지는 고정 내부 경로이며 외부 `next` URL을 신뢰하지 않는다.

Preview는 기존 Demo·배포 보호 확인 조건을 만족해야 한다. 공개·미확인 환경은
계속 403으로 닫는다. 명시적 로컬 Demo의 기존 개발 접근 정책은 별도이며,
Vercel 환경이 아닌 loopback 개발 서버에만 허용한다.

## 세션 형식과 보관

최신 멘토 평가용 확장은 [MENTOR_ACCESS.md](MENTOR_ACCESS.md)를 따른다.
소유자 v1 세션의 형식·서명 파생 규칙은 그대로 유지하고, 선택적 멘토 자격은 별도
v2 / `sub: mentor` 서명을 사용한다. 기존 소유자 세션의 배포 후 유효성을 실제로 확인했다.
아래 기존 자격 설명은 소유자에 해당하며, 멘토는 별도 Preview 전용 이름·hash를 사용한다.
동일한 Demo 권한이며 회원별 역할이나 사용자 테이블은 추가하지 않는다.

`CMS_ADMIN_USERNAME`, `CMS_ADMIN_PASSWORD_SHA256`의 기존 서버 자격을 사용한다.
사용자 지정 자격이 없을 때의 legacy 설정 규칙도 유지하며, 불완전한 사용자 지정
설정은 legacy로 우회하지 않는다. 새 `CMS_ADMIN_SESSION_SECRET`은 32자 이상의
무작위 서버 비밀값이다. 실제 값·비밀번호 원문·digest는 브라우저에 전달하지 않는다.

세션은 고정 HMAC-SHA256 프로토콜로 서명한다. 서명키는 무작위 세션 secret과 현재
사용자 이름·비밀번호 hash에서 파생한다. 읽을 수 있는 payload에는 버전, 발급·만료
시각, 무작위 세션 ID, 실제 요청 Origin만 넣고 비밀번호 유래 fingerprint는 넣지 않는다.
서명은 암호화가 아니므로 민감한 내용을 payload에 넣어서는 안 된다.

검증은 canonical base64url, 토큰 길이, 고정 서명 길이와 constant-time 비교,
필수 필드·타입, 만료·미래 시각·최대 8시간 TTL, 현재 host의 audience를 확인한다.
Cookie 존재나 클라이언트 상태만으로 인증하지 않는다.

- HTTPS Preview 쿠키: `__Host-pt_admin_session`, `HttpOnly`, `Secure`, `SameSite=Lax`,
  `Path=/`, `Max-Age=28800`. `Domain`은 지정하지 않는다.
- `Path=/`는 관리자 페이지와 `/api/admin` 요청 모두에 필요하다.
- 명시적 loopback 로컬 모드만 별도 `pt_admin_session` 쿠키를 사용하며 Secure를 생략한다.
- 로그인·세션 응답은 `no-store`로 처리한다. 비밀번호·쿠키를 로그나 브라우저 저장소에
  기록하지 않는다. 로그인 발급 설정이 없으면 POST가 성공을 흉내 내지 않고 503을 반환한다.

## 실제 폼 연결

`AdminLoginAuthenticator`는 `{ username, password }`와 `AbortSignal`을 받는다.
현재 페이지는 `AdminLoginConnected`를 통해 실제 `/api/admin/session` 어댑터를
전달한다. 폼의 optional 어댑터 구조는 재사용을 위한 계약이며, 현재 페이지가
미연결 상태라는 뜻이 아니다.

어댑터는 서버의 실제 성공 응답과 쿠키 발급 뒤에만 완료한다. 그 뒤 고정 관리자
목록으로 이동하며, 이후 요청도 서버 세션 검사를 다시 거친다. 로딩·오류는 실제
요청 상태를 따른다. 가짜 지연·성공 플래그·리다이렉트 시뮬레이션은 사용하지 않는다.
비밀번호는 앞뒤 공백이나 문자를 바꾸지 않고 HTTPS 요청 본문으로 전달한다.

`AdminFrame`은 `/admin/login`에서만 시각적 `PrayerShell`을 생략한다. 이 분기는
권한 예외가 아니다. 다른 CRUD 경로의 화면 구조를 유지하며, 향후 rewrite나
Cache Components 도입 시 pathname 분기의 hydration·Suspense 조건을 재검토한다.
[usePathname 공식 문서](https://nextjs.org/docs/app/api-reference/functions/use-pathname)

## Origin·요청 제한과 로그인 시도 제한

로그인·로그아웃도 같은 Origin과 fetch metadata를 검사한다. Next 내부 URL이
localhost로 정규화되어도 실제 Host를 검증해 비교하며, Host나 forwarded 헤더가
관리자 권한을 부여하지는 않는다. 로그인은 JSON만 허용하고 선언된 크기와 실제
스트림 모두 4KiB로 제한한다.

애플리케이션의 IP 버킷은 인스턴스별 60초·5회 한도이며 성공 시 초기화한다.
만료 항목을 정리하고 최대 1,000개로 제한한다. Vercel에서는 플랫폼이 전달한
`x-vercel-forwarded-for`를 사용한다. 모듈 메모리 Map은 분산·영속 제한이 아니며
새 인스턴스나 재시작 후 같은 카운터가 유지된다고 보장하지 않는다.
[Vercel 요청 헤더](https://vercel.com/docs/headers/request-headers)

별도 WAF에는 관리자 stable host, 정확한 `/api/admin/session`, POST에만 적용하는
IP별 60초·10회 규칙을 설정했다. 이는 API에서 설정 수락을 확인한 구성이다.
보호 접근 쿠키·자동화 우회가 적용된 요청에서의 실제 차단 동작은 아직 확인되지
않았으므로 검증 완료된 보호 효과로 표현하지 않는다. Vercel WAF 카운터도 지역별이며
전 세계 단일 계정 카운터가 아니다.
[Vercel WAF Rate Limiting](https://vercel.com/docs/vercel-firewall/vercel-waf/rate-limiting)

## 로그아웃과 철회 한계

로그아웃은 현재 브라우저의 같은 이름·경로 쿠키를 만료시킨다. 세션별 DB나 폐기
목록이 없으므로 복사된 토큰을 개별 철회하는 기능은 없고, 유효 토큰은 최대 TTL까지
남을 수 있다. API 도구의 명시적 Basic 자격은 별도 호환 수단이며 쿠키 삭제로 제거되지 않는다.

현재 서버의 해당 계정 자격을 바꾸면 해당 계정의 이전 서명을 거부한다. 멘토 설정 변경은
소유자의 v1 세션에 영향을 주지 않는다. 공통 세션 secret 교체는 두 계정 모두에 적용된다.
그러나 기존 immutable 배포는 옛 환경을 보유할 수 있다. 환경 갱신·새 배포만으로
이전 모든 배포의 토큰까지 철회되었다고 간주하지 않으며, 교체 검증 후 이전 Demo
배포의 정리 여부를 별도로 관리한다.

## 미션 7 이후 선택지

아래는 현재 공유 ID 기반 세션을 넘어서는 별도 작업이다.

| 선택 | 필요한 범위 | 주요 고려 사항 |
| --- | --- | --- |
| Supabase Auth | 실제 계정·초대/복구, `@supabase/ssr`, 쿠키 갱신, 서버 신원·관리자 권한 확인 | 인증된 모든 사용자를 관리자로 취급하지 않음. RLS·Storage 권한도 함께 설계 |
| DB 관리 세션 | 세션 저장소, 만료·철회·장치별 로그아웃, 세션 ID 보호와 정리 | 개별 철회가 가능하지만 매 요청 검증과 저장소 운영이 추가됨 |
| 분산 시도 제한 | Redis 등 공유 저장소 또는 DB의 atomic counter·TTL | 엄격한 전역 한도가 필요할 때 별도 도입. 계정 전체 잠금의 가용성 영향 검토 |

Supabase Auth를 선택하면 실제 `signInWithPassword`와 서버 `getClaims` 검증을
사용하고, 최신 사용자 정보가 필요하면 `getUser`를 검토한다. 클라이언트 유래
`getSession` 사용자 정보나 수정 가능한 `user_metadata`만으로 관리자 권한을 판단하지 않는다.
[Supabase SSR](https://supabase.com/docs/guides/auth/server-side/nextjs),
[비밀번호 로그인](https://supabase.com/docs/reference/javascript/auth-signinwithpassword),
[RLS와 메타데이터](https://supabase.com/docs/guides/database/postgres/row-level-security)

개인별 인증·세션 저장소·권한 정책을 확장할 때는 별도 범위를 확정하고 검증된 인증
라이브러리 사용도 검토한다. 어떤 방식에서도 서버 Secret/Service Role은 브라우저에
노출하지 않으며, 기존 native 기도문과 운영 신청 데이터는 인증 실험에 사용하지 않는다.
[Next.js 인증과 세션](https://nextjs.org/docs/app/guides/authentication)
