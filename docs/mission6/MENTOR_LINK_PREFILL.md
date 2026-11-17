# 멘토 전용 링크의 두 필드 자동 입력 · 2026-11-18

사용자가 브라우저 저장 방식 대신, 멘토 전용 링크를 열면 아이디와 비밀번호를 모두
채워 달라고 명시적으로 요청했다. 이전의 아이디 전용·빈 비밀번호 안내는 이번 요청에
한해 변경한다. 기존 소유자 자격·로그인 세션·Vercel 보호·CMS API 권한은 유지한다.

## 전달 방식

비공개 `MENTOR_REVIEW_ACCESS.txt`의 새 `ENTRY_URL`을 전달한다.
일반 `/admin/login?account=mentor` 주소만으로는 비밀번호를 채우지 않는다.

`암호화 전용 링크 → Vercel 보호 쿠키 → 입력용 쿠키 → 깨끗한 로그인 주소 → 두 필드 표시 → 로그인 버튼 → 실제 인증`

- `/admin/login/mentor?entry=...`의 entry는 AES-256-GCM 암호문이다. URL에 평문 비밀번호를 넣지 않는다.
- 발급 후 최대 7일, 정확한 배포 origin·현재 멘토 자격에만 유효하다. 만료·변조·다른 배포의 링크는 거부한다.
- 입력용 `__Host-pt_mentor_prefill`은 별도의 HttpOnly·Secure·SameSite=Lax·host-only·Path=/ 쿠키이며 300초 후 만료한다.
- 입력용 토큰을 주소창에서 제거하는 303 뒤 `/admin/login?account=mentor`에서만 두 값을 폼에 전달한다.
- 비밀번호는 password type으로 가려져 있으며 편집할 수 있다. 자동 제출이나 앱 세션 발급은 하지 않는다.
- 로그인 성공과 로그아웃에서 입력용 쿠키를 명시적으로 지운다. 실제 관리자 인증은 기존 POST·GET 확인을 유지한다.
- 일반 로그인 화면은 빈 상태이며, 단순 멘토 아이디 링크는 비밀번호를 비워 둔다.

전용 링크는 멘토 자격을 전달하는 비공개 접근 수단이다. 그 링크로 승인된 폼의 HTML/RSC와
클라이언트 상태에는 요청대로 멘토 비밀번호가 포함된다. 정적 JS에 비밀번호를 하드코딩하거나
앱 localStorage/sessionStorage에 저장하지 않는다. 로그인/입력용 응답은 private/no-store,
Referrer-Policy는 no-referrer이며 robots도 noindex다. 소유자 비밀번호는 이 기능에 사용하지 않는다.

새 평문 비밀번호 환경 변수·DB·Supabase Auth·RLS·Storage 변경은 없다.
기존 무작위 세션 secret과 멘토 자격에서 별도 namespace의 암호화 키를 파생한다.
멘토 자격이나 공통 secret을 교체하면 해당 입력용 grant가 무효화된다.
입력용 쿠키는 관리자 세션으로 인정하지 않으며, 실제 세션의 기존 8시간 규칙은 유지한다.

## 코드와 검증

- 브랜치: `feat/mission6-mentor-link-prefill`, 실행 코드: `6626ed7`.
- 최종 Preview 및 고정 관리자 주소: `dpl_FnSgetB1N4TYVJovoL26G84rnczZ`.
- 고정 호스트: `praytime-mission6-admin.vercel.app`; 전용 링크 만료는 2026-11-25 02:54:50 KST다.
- 공개 Production: 기존 `dpl_3h6E7G52uUnL1vmsq2eMCBF7RkB2` / `8b9c08d` 유지.

| 검사 | 결과 |
| --- | --- |
| 전체 Unit | 17 files / 328 tests PASS |
| 암호화·만료·자격·쿠키 경계 | 52/52 PASS |
| 신규 entry·Proxy·쿠키 정리 | 12/12 PASS |
| 폼·연결·검증 집중 검사 | 51/51 PASS |
| Lint·TypeScript | PASS |
| Preview webpack Build | READY / PASS |
| 실제 후보·고정 주소 | 멘토 1440/393px 및 소유자 1440px PASS |
| 기존 소유자 v1 세션 | 재인증 POST 없이 GET 세션·관리자 100건 PASS |
| 공개 경계 | published GET 200 / 100건, 관리자·세션·입력용 entry 403 |
| 소스·일반 페이지·정적 JS 비밀값 검사 | 소스 609개·실제 client script 12개·민감값 17개 발견 0 |

승인된 전용 링크의 HTML에만 요청한 멘토 비밀번호가 포함되며, 해당 페이지에 소유자 비밀번호·
hash·세션 secret·grant는 포함되지 않는 것을 별도로 확인했다. 일반 페이지에는 멘토 비밀번호도 없다.
전용 링크들의 URL에 평문 비밀번호가 없는지 확인했다.

각 호스트에서 일반 소유자 폼·단순 멘토 링크·잘못된/중복/변조/만료 grant는 비밀번호를 채우지
않고 관리자 API도 401이었다. 유효한 전용 링크에서는 두 값을 메모리에서 비교하고 비밀번호가
가려졌는지 확인했다. 로그인 POST·인증 쿠키가 없는 상태와 입력용 쿠키만으로 API 401인 상태를
확인한 뒤 값을 다시 입력하지 않고 버튼만 눌러 실제 POST 200·GET 확인·관리자 100건에 진입했다.

새로고침·로그아웃·세션 종료 후 거부, 멘토 v2/소유자 v1의 8시간 보안 쿠키,
로그인 성공과 로그아웃에서 입력용 쿠키 제거를 확인했다. 각 호스트의 로그인 POST 3회·
로그아웃 DELETE 3회 외 쓰기는 0이었다. pageerror·예상 밖 console/network/font 오류·
브라우저 저장소·Basic/credential header·외부 이동·가로 overflow는 0이었다.
의도적인 401 console 진단 22건은 예상 오류로 구분했다. 일반 페이지·정적 script 51개 응답에서
두 계정의 비밀번호는 0건이었다. 승인된 폼의 HTML을 이 비노출 검사와 혼동하지 않는다.

별도 새 context에 배포 전 소유자 v1 쿠키만 복원해 GET 200·관리자 100건을 확인했다.
재로그인 POST·DELETE 없이 검증했고, 임시 쿠키 jar와 입력용 fixture 파일은 finally에서 삭제한 뒤
파일 부재를 별도로 확인했다. 모든 브라우저를 종료했다.

원본 증거는 저장소 밖 `work/mission6-mentor-link-prefill/`에 보관한다.
`candidate/results.json`, `stable/results.json`과 각 PNG 6장,
`owner-after-rollout-results.json`, `private-cleanup-results.json`, `credential-scan.json`을 따른다.
실제 전용 링크·grant·쿠키·비밀번호는 Git 문서나 QA 로그에 기록하지 않는다.
실제 기도문·Storage 쓰기는 이번 확인에서 수행하지 않는다.
전체 CRUD/Storage 쓰기 E2E, 추가 768/360px·실물 기기·Safari·분산 WAF 429는 이번에 다시 실행하지 않았다.

[접근 안내](ACCESS.md) · [이전 비밀번호 변경 이력](MENTOR_PASSWORD_UPDATE.md)

구현 참고: [Node 24 Crypto API](https://nodejs.org/docs/latest-v24.x/api/crypto.html),
[Next.js headers와 동적 렌더링](https://nextjs.org/docs/app/api-reference/functions/headers).
