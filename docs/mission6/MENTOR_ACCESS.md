# 멘토 평가용 접근 · 2026-11-18

이 문서는 최초 멘토 계정 배포의 검증 이력이다. 이후 사용자가 지정한 비밀번호로 변경한
현재 배포와 브라우저 자동 입력 안내는 [MENTOR_PASSWORD_UPDATE.md](MENTOR_PASSWORD_UPDATE.md)를 따른다.

사용자가 멘토 계정, 전용 링크의 아이디 자동 입력, 배포와 링크 전달을 요청했다.
기존 소유자 자격·세션과 승인된 브랜드 화면을 유지하며 같은 보호된 Demo에 멘토 접근을 추가했다.

## 배포와 전달

- 브랜치: `feat/mission6-mentor-access`, 실행 코드: `c0d950d`.
- 최종 Preview: `dpl_A452LX6AurhAHXvSFp8coujLjRTX`.
- 고정 주소: `https://praytime-mission6-admin.vercel.app/admin/login?account=mentor`.
- 새 브라우저의 첫 접속에는 저장소 밖 비공개 `MENTOR_REVIEW_ACCESS.txt`의 `ENTRY_URL`을 사용한다.
  일반 주소에는 provider 접근 권한이 없으므로 Vercel 계정을 요구할 수 있다.
- 안내 파일은 권한 0600이며 전용 진입 링크·아이디·별도 생성한 비밀번호를 담는다.
  실제 비밀번호·hash·provider 토큰은 이 문서, Git, 앱 소스에 기록하지 않는다.
- 공개 Production은 기존 `dpl_3h6E7G52uUnL1vmsq2eMCBF7RkB2` / `8b9c08d` 그대로다.

## 동작과 경계

`전용 링크 → Vercel 보호 쿠키 → 아이디 자동 입력 → 비밀번호 입력 → 서버 검증 → 관리자 목록`

정확한 scalar `account=mentor`만 아이디 자동 입력에 사용한다. 다른 query나 중복 값으로
아이디·비밀번호·권한을 설정하지 않는다. 비밀번호는 항상 빈 값으로 시작하며 자동 POST나
로그인 성공 처리는 없다. 실제 POST와 GET 세션 확인 뒤 관리자 목록으로 이동한다.

선택적 `CMS_MENTOR_USERNAME`, `CMS_MENTOR_PASSWORD_SHA256`는 encrypted Preview 전용이다.
소유자와 이름이 충돌하거나 설정이 누락·불완전하면 멘토 로그인을 허용하지 않는다.
소유자 설정·비밀번호·공통 세션 secret은 변경하지 않았다.

소유자 v1의 payload·서명 규칙을 보존하고 멘토는 v2 / `sub: mentor`와 별도 파생 키를 쓴다.
최대 8시간, host-bound HMAC-SHA256 서명 검증과 HttpOnly·Secure·SameSite=Lax·host-only·
Path=/ 쿠키를 유지한다. 멘토 자격의 교체·제거는 소유자 세션을 무효화하지 않는다.
공통 서명키를 교체하면 두 계정 세션이 무효화된다. 개별 토큰 철회 기능은 없다.

멘토와 소유자는 같은 평가용 CMS 권한을 사용한다. 회원 관리·역할·Supabase Auth·인증 DB를
추가하지 않았다. 기존 도구용 HTTP Basic은 소유자 자격만 유지한다. Vercel 보호 설정,
공개 Production의 관리자 403, Supabase RLS·Storage·기도문 원본은 변경하지 않았다.

## 검증

| 검사 | 실제 결과 |
| --- | --- |
| Lint | PASS |
| TypeScript / webpack Build | PASS |
| 전체 Unit | 15 files / 260 tests PASS |
| 신규 멘토 인증·세션 검사 | 32/32 PASS |
| 신규 아이디 자동 입력 검사 | 13/13 PASS |
| 실제 후보 Preview | 멘토 1440/393px, 소유자 1440px PASS |
| 실제 고정 관리자 주소 | 멘토 1440/393px, 소유자 1440px PASS |
| 배포 전 소유자 세션 유지 | 기존 v1 쿠키만 복원, 재인증 POST 없이 GET 확인 PASS |
| 공개 경계 | published GET 200 / 100건, 관리자 GET·세션 POST 403 |
| 실제 비밀값 노출 검사 | 소스·49개 클라이언트 JS에서 알려진 민감값 10개 발견 0 |

각 배포의 새 Chrome context에서 provider 전용 진입 후 접근 query가 제거되고
`account=mentor`만 남는지 확인했다. 아이디 자동 입력·빈 비밀번호·자동 POST 0,
잘못된 비밀번호 401·오류 문구, 실제 로그인 200·GET 확인·no-store,
멘토 v2 / 소유자 v1 및 최대 28,800초 보안 쿠키를 확인했다.

관리자 100건·첫 페이지 10행·새로고침, 로그인 상태/무세션의 양방향 이동,
로그아웃과 이후 API 401도 통과했다. 각 호스트에서 로그인 POST 4회·로그아웃 DELETE 3회
이외 쓰기는 0, 기도문·Storage 변경은 0이었다. Basic·credential header·외부 이동·
브라우저 저장소 기록·pageerror·가로 overflow·예상 밖 console/network/font 오류는 0이다.
의도적 401의 console 진단 13건은 예상 오류로 구분했다.

고정 주소의 승격 전 소유자 v1 세션을 별도 보관했다가 승격 후 새 context에 복원했다.
POST·DELETE 0으로 GET 세션 200 및 관리자 페이지/API 200·100건을 확인했다.
검증용 쿠키 파일은 finally에서 삭제하고 파일 부재를 확인했으며 모든 브라우저를 종료했다.

비민감 원본 증거는 저장소 밖 `work/mission6-mentor-access/`의 `candidate/results.json`,
`stable/results.json`, 각 PNG 6장과 `owner-after-rollout-results.json`이다.
배포·환경 메타데이터는 `final-rollout-state.json`, `rollout-precheck.json`에 보관한다.

## 실행하지 않은 검사와 한계

이번 변경에서 기존 전체 CRUD·Storage 쓰기 검사를 다시 실행하지 않았다.
해당 기능의 이전 검증과 이번 실제 세션·조회 검증을 구분한다.
추가 768/360px·실물 기기·Safari·OS 가상 키보드·분산 WAF 429 동작은 이번에 검증하지 않았다.
앱 시도 제한은 인스턴스별이며 전역 강제 제한으로 표현하지 않는다.
이전 immutable 배포의 환경과 토큰은 별도로 관리해야 한다.

[접근 안내](ACCESS.md) · [인증 구조](ADMIN_LOGIN_AUTH_PLAN.md) · [이전 소유자 로그인 검증](ADMIN_SESSION_QA.md)
