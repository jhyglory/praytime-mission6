# 실제 관리자 로그인 연결 · 2026-11-18

이 문서는 최초 소유자 로그인 연결의 검증 이력이다. 이후 멘토 접근 배포 `c0d950d`와
현재 고정 주소의 검증은 [MENTOR_ACCESS.md](MENTOR_ACCESS.md)를 따른다.

사용자가 디자인 승인 후 실제 로그인과 관리자 진입을 요청했다. 기존에 지정한 아이디와
비밀번호를 서버에서 검증하고 승인된 브랜드 폼에 세션을 연결했다. 실제 값은 이 문서나
앱 소스에 포함하지 않는다. 사용자별 회원 관리·Supabase Auth·DB schema는 추가하지 않았다.

## 배포와 실행 코드

- 브랜치: `feat/mission6-admin-session-login`.
- 기준: 승인된 UI `6b05380`과 승인 기록 `87d1e14`.
- 최종 실행 코드: `e2b22b5`.
- 최종 Preview: `dpl_DN8FE4jUAhfmLRv7VFK1SJBiTE36`.
- 고정 관리자 주소: `https://praytime-mission6-admin.vercel.app/admin/login`.
- 공개 Production은 기존 `dpl_3h6E7G52uUnL1vmsq2eMCBF7RkB2` / `8b9c08d`를 유지한다.
- 평가용 전용 진입 링크는 저장소 밖 비공개 안내 파일에만 보관한다.

Vercel 접근 제한은 유지했다. 일반 주소만 새 브라우저에서 열면 Vercel 로그인으로
이동한다. 실제 검증은 Vercel 계정이 없는 새 context에서 전용 링크로 provider 쿠키를
받고, query가 제거된 브랜드 로그인 페이지에서 시작했다. Basic 헤더나 자동화용
provider header로 앱 로그인을 대신하지 않았다.

## 코드 검사

| 검사 | 결과 |
| --- | --- |
| Lint | PASS |
| Typecheck / webpack Build | PASS |
| 전체 Unit | 13 files / 215 tests PASS |
| 세션 집중 검사 | 47/47 PASS |
| 프론트 요청 계약 | 26/26 PASS; 합성 fetch, 실인증으로 계상하지 않음 |
| 기존 CMS·기도 체험 E2E | 7/7 PASS; API intercept, 실제 DB 쓰기 없음 |

세션 검사는 서명/내용 변조·canonical base64url·8시간 만료·미래 시각·과도한 TTL,
호스트 결합·키/자격 교체·중복/과대 cookie·필수 속성·동일 Origin·실제 body 4KiB
제한·429·인스턴스 Map 크기 상한·Proxy 경로 예외·Basic API 호환을 포함한다.
프론트는 POST 200만으로 이동하지 않고 GET 세션 확인까지 성공해야 한다.

## 실제 브라우저 검증

최종 Preview와 고정 관리자 주소에서 각각 1440px·393px의 새 Chrome context로 확인했다.
Mock API 응답·HTTP Basic 자격·자체 로그인 성공 플래그는 사용하지 않았다.

- 비공개 provider 진입 → 깨끗한 `/admin/login` 200, Vercel 계정·Basic 팝업 없음.
- 잘못된 비밀번호는 실제 POST 401과 승인된 오류 문구, 세션 발급 없음.
- 실제 지정 아이디·비밀번호는 POST 200, GET 세션 확인 후 관리자 화면으로 이동.
- `__Host-pt_admin_session`: HttpOnly / Secure / SameSite=Lax / Path=/ /
  Domain 없음 / Max-Age 28,800초. 쿠키 값은 기록하지 않았다.
- 실제 관리자 100건·첫 페이지 10행과 새로고침 200, 로그인 상태의 로그인 경로는 목록으로 이동.
- UI 로그아웃 DELETE 200 → 앱 쿠키 삭제 → 로그인 화면. Provider 쿠키는 유지한다.
- 로그아웃 후 세션/CMS API 401·데이터 없음, 관리자 페이지는 500 없이 로그인으로 이동.
- 각 호스트의 실행은 로그인 POST 3회·로그아웃 DELETE 2회 이외 쓰기 0이었다.
  기도문·Storage 파일은 등록/수정/삭제하지 않았고 원본 100개를 보존했다.
- Basic challenge·credential header·외부 navigation·local/session Storage·pageerror·
  예상하지 않은 console/font/network 오류·가로 overflow는 모두 0이었다.
- 의도적으로 발생시킨 401 네트워크 진단 9건은 예상한 인증/접근 거부로 별도 기록했다.
  이를 정상 인증 흐름의 오류 0과 혼동하지 않는다. 모든 QA 브라우저는 종료했다.

원본: 저장소 밖 `work/mission6-session-login/preview-fixed/`, `stable/`의 결과 JSON과
실제 로그인 빈 폼·관리자 1440/393 캡처. 접근용 query·비밀번호·cookie 값은 출력하지 않았다.

## 발견하고 수정한 오류

초기 후보 `c0db101`은 실제 로그인·쿠키·목록·로그아웃까지 동작했지만, 무세션 페이지
이동에서 500이 발생했다. Proxy의 상대 Location을 Next adapter가 기준 URL 없이 파싱한
것이 원인이었다. `request.nextUrl.clone()`에서 고정 내부 경로·query/hash 제거를 적용하고
`NextResponse.redirect`로 절대 URL을 반환하도록 수정했다. 최종 두 호스트에서 무세션
재진입과 로그인 상태의 역방향 이동을 다시 확인해 모두 통과했다.

첫 브라우저 runner의 전역 alert locator는 Next route announcer와 충돌했다. 폼 내부로
한정했고 Preview toolbar의 외부 GET 자산을 잘못 차단한 진단도 runner에서 바로잡았다.
이 초기 시도들은 보존했으며 제품 런타임의 mock/fallback으로 숨기지 않았다.

## 보안 경계와 제약

- 공개 Production의 관리자·세션 endpoint는 disabled이며 실제 CMS 서버 키와 새 세션
  서명키는 Preview 전용 encrypted 설정이다. 미션 5·신청 DB·native 파일은 변경하지 않았다.
- 로그인/로그아웃은 정확한 endpoint에서만 실행한다. 기도문 API는 기존 데이터 경계에서
  세션 또는 명시적 Basic을 검증하고, 관리자 페이지는 세션을 요구한다.
- 앱 로그인 실패 카운터는 인스턴스별 5회/60초다. 전역·분산 제한이 아니다.
- 고정 관리자 host + `/api/admin/session` + POST만 대상으로 WAF 10회/60초 규칙을
  설정했다. Provider 쿠키 없는 11회 요청은 모두 401로 먼저 거부되어, Preview에서 실제
  rate-limit 429 효과는 검증하지 못했다. 설정 확인을 강제 제한 성공으로 계상하지 않는다.
- 서명 토큰의 복사본 개별 철회는 만료 전까지 제공하지 않는다. 자격/서명키 교체는 현재
  설정을 쓰는 토큰을 무효화하며, 옛 immutable 배포의 환경은 별도로 퇴역/관리해야 한다.
- 실물 기기·Safari·OS 가상 키보드·회원별 권한·모바일 앱 인증은 NOT RUN/미구현이다.
- 이번 연결 이후 768px·360px의 추가 검증은 Chrome context 시작 장애로 NOT RUN이다.
  실제 페이지나 로그인 요청에 도달하지 않았고 검증용 프로세스를 정리했다. 초기 UI의
  네 viewport 디자인 검증과 이번 실제 인증 1440/393 검증을 구분한다.

[현재 접근 방법](ACCESS.md) · [인증 구조와 다음 단계](ADMIN_LOGIN_AUTH_PLAN.md)
