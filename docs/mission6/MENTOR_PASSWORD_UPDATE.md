# 멘토 비밀번호 변경 · 2026-11-18

이 문서는 비밀번호 변경과 브라우저 저장 지원 단계의 이력이다. 이후 사용자의 명시적 요청으로
전용 링크에서 두 필드를 채우도록 바꾼 현재 동작은 [MENTOR_LINK_PREFILL.md](MENTOR_LINK_PREFILL.md)를 따른다.

사용자가 지정한 새 멘토 비밀번호를 encrypted Preview 환경 변수에 반영했다.
실제 원문·hash는 Git에 기록하지 않으며, 저장소 밖 비공개 접속 안내를 갱신했다.
소유자 아이디·비밀번호·세션 서명키·CMS 서버 키는 변경하지 않았다.

## 자동 입력 범위

전용 링크는 아이디만 입력한다. 비밀번호 자동 입력은 사용자가 브라우저 비밀번호 관리자에
해당 사이트의 로그인 정보를 저장했을 때 동작한다. 사이트가 비밀번호 원문을 내려보내거나
URL·localStorage·sessionStorage에 비밀번호를 저장하지 않는다.

폼의 기존 `autocomplete=username` / `current-password`를 유지하고 안정적인
`name=username` / `password`를 추가했다. 처음에는 새 비밀번호를 입력하고 브라우저의
저장 또는 업데이트를 선택한다. 브라우저 설정·기기에 따른 자동 입력 자체는 사이트가 강제하지 않는다.
브라우저 vault 저장·자동 채움을 실제로 검증했다고 주장하지 않는다.

## 배포와 검사

- 브랜치: `feat/mission6-mentor-access`, 실행 코드: `b04577b`.
- 새 Preview: `dpl_HxvmNEN5XdvUa4TFoiB5pyb8qfXG`.
- 기존 고정 접속 링크를 유지한다. 공개 Production과 Vercel 보호 설정은 유지한다.
- Lint 및 관련 Unit 3 files / 47 tests: PASS.
- Preview webpack Build·TypeScript: READY / PASS.
- 실제 후보/고정 주소: 멘토·소유자 1440px 로그인·조회·새로고침·로그아웃 PASS.
- 이전 멘토 비밀번호 실제 401 거부 / 새 비밀번호 실제 200 로그인: 두 호스트 PASS.
- 배포 전 소유자 v1 세션 유지: 재인증 POST 없이 GET 확인 PASS.
- 공개 GET 200 / 100건, 관리자 GET·세션 POST 403: PASS.
- 소스 604개 및 실제 후보 페이지의 클라이언트 script 12개에서 알려진 민감값 11개 발견 0.

두 호스트 각각 로그인 POST 3회·로그아웃 DELETE 2회 이외 쓰기는 0이었다.
멘토 v2 / 소유자 v1, host-only·HttpOnly·Secure·Lax·Path=/·최대 8시간 쿠키,
입력 `name`·`autocomplete`·password type·빈 초기 비밀번호를 실제 브라우저에서 확인했다.
기존 소유자 세션만 복원한 별도 context에서 GET 세션 200·관리자 100건을 확인했다.
브라우저 저장소·Basic·credential header·외부 이동·pageerror·예상 밖 진단·가로 overflow는 0이다.
각 호스트의 의도적 401 console 진단 9건은 예상 오류로 구분했다.
임시 쿠키 파일과 이전 비밀번호 snapshot을 삭제하고 파일 부재를 확인했으며 브라우저를 종료했다.

검증 원본은 저장소 밖 `work/mission6-mentor-password-20261118/`에 보관한다.
`candidate/results.json`, `stable/results.json`과 각 PNG 4장,
`owner-after-rollout-results.json`, `private-cleanup-results.json`, `credential-scan.json`을 따른다.
이전 전체 260개 Unit과 1440/393px 검사는 [멘토 최초 배포](MENTOR_ACCESS.md)의 이력이며,
이번 비밀번호 변경에서 다시 실행한 검사와 구분한다.
이번에는 전체 CRUD·Storage 쓰기·추가 모바일 viewport·실물 기기·Safari·분산 WAF를 다시 검증하지 않았다.

[접근 방법](ACCESS.md) · [최초 멘토 접근 검증](MENTOR_ACCESS.md)
