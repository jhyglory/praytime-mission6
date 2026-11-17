# Mission 6 배포와 관리자 접근

## 공개 기도 체험

- [PrayTime Mission 6](https://praytime-mission6.vercel.app/)
- [기도 가이드](https://praytime-mission6.vercel.app/prayers)
- [현재 구현 브랜치](https://github.com/jhyglory/praytime-mission6/tree/feat/mission6-mentor-access)

공개 Production은 published 기도문만 읽고 관리자 화면/API는 disabled다.
이 배포에 CMS 서버 Secret이나 새 세션 서명키를 배치하지 않았다. 미션 5 배포·신청 데이터는 변경하지 않았다.

## 보호된 관리자 로그인

[로그인 화면](https://praytime-mission6-admin.vercel.app/admin/login)은 별도 비민감 Demo Preview다.
처음에는 비공개 전용 진입 링크로 프로젝트 접근 쿠키를 받은 뒤 같은 브라우저에서 로그인한다.
그냥 일반 주소를 새 브라우저에서 열면 Vercel 로그인 화면이 먼저 나올 수 있다.
이는 앱 아이디·비밀번호 오류가 아니다. 전용 링크는 Vercel 계정 없이 접근 쿠키를 설정한다.

전용 링크와 기존 아이디·비밀번호는 저장소 밖 소유자용 `MISSION6_REVIEW_ACCESS.txt`에만 보관한다.
멘토용은 별도 `MENTOR_REVIEW_ACCESS.txt`에 보관하며, 첫 접속은 그 파일의 `ENTRY_URL`을 사용한다.
`/admin/login?account=mentor`라는 일반 주소만으로 Vercel 보호를 통과하지는 않는다.
공개 README, Git, 앱 소스에 쓰지 않는다. 이 안내에 Supabase 서버 키와 Vercel 계정 토큰은 포함하지 않는다.

실제 접근 순서:

`비공개 진입 링크 → Vercel 접근 쿠키 → 브랜드 로그인 → 서버 자격 검증 → 앱 세션 쿠키 → 관리자 목록`

기존에 정한 아이디를 사용하며 이메일 계정을 임의 생성하지 않는다. 성공 응답 후 브라우저가
실제 쿠키를 수용했는지 GET 세션 확인까지 통과해야 관리자 화면으로 이동한다.

멘토 전용 링크에서는 서버에 설정한 멘토 아이디만 자동 입력된다. 서버는 비밀번호 초깃값을
전달하지 않으며 자동 로그인 요청은 보내지 않는다. 비밀번호는 별도로 전달하며 URL에 넣지 않는다.
비밀번호 자동 입력은 본인 브라우저 비밀번호 관리자에 저장한 로그인 정보를 사용한다.
소유자와 멘토는 별도 자격·서명으로 같은 평가용 Demo CMS에 접근한다.

| 상태 | 동작 |
| --- | --- |
| Vercel 접근 쿠키 없음 | Vercel 접근 제한 유지 |
| Provider 통과, 앱 세션 없음 | 로그인 화면 200, 관리자 화면은 로그인으로 303 |
| 잘못된 아이디 또는 비밀번호 | 세션 발급 없이 401 |
| 서버 검증 성공 | HttpOnly·Secure·SameSite=Lax·host-only·Path=/ 쿠키, 최대 8시간 |
| 유효한 앱 세션 | 관리자 목록·API 접근 |
| 무세션 CMS API | 401, Basic 팝업 없음 |
| 명시적 기존 Basic API 요청 | 소유자 호환 도구용으로 유지; 멘토는 세션 로그인 사용 |
| 로그아웃 | 앱 쿠키 제거, 로그인 복귀; Vercel 접근 쿠키는 유지 |
| 공개 Production 관리자 API | 403 |

로그인 endpoint는 정확히 `/api/admin/session`이다. POST는 서버 자격 검증, GET은 세션 확인,
DELETE는 로그아웃이며 쓰기 요청에는 동일 Origin과 크기 제한을 적용한다. 이 endpoint 예외가
기도문 데이터 접근 권한을 부여하지 않는다. 공개 모드나 보호 미확인 배포에서는 endpoint도 차단한다.

## 평가 순서

1. 비공개 안내의 전용 진입 링크를 같은 브라우저에서 연다.
2. 멘토는 자동 입력된 아이디와 별도 비밀번호로 로그인한다. 소유자는 기존 자격을 사용한다.
3. 실제 목록과 새로고침을 확인한다. 콘텐츠 평가는 별도 비민감 QA 기도문으로 진행한다.
4. 로그아웃 후 관리자 화면과 API가 차단되는지 확인한다.
5. 다른 브라우저·다른 배포 hostname에서는 전용 진입과 로그인을 다시 수행한다.

## 설정과 한계

- Vercel 프로젝트는 기존 `praytime-mission6`, Node 24 / webpack을 유지한다.
- 관리자 실행 코드 `b04577b`, Preview `dpl_HxvmNEN5XdvUa4TFoiB5pyb8qfXG`.
- 브랜치 `feat/mission6-mentor-access`. 후보·고정 주소의 실제 로그인과 기존 소유자 세션 유지 PASS.
- 공개 Production은 기존 `8b9c08d`와 disabled 관리자 모드를 유지한다.
- 서버 자격 hash와 랜덤 `CMS_ADMIN_SESSION_SECRET`은 Preview 전용 encrypted 환경 변수다.
- 선택적 `CMS_MENTOR_USERNAME`, `CMS_MENTOR_PASSWORD_SHA256`도 Preview 전용 encrypted 설정이다.
  멘토 설정이 없거나 불완전하면 멘토 접근만 닫히며 기존 소유자 설정은 유지한다.
- 브라우저 localStorage/sessionStorage에 인증 비밀을 저장하지 않는다.
- 앱의 실패 카운터는 인스턴스별 5회/60초다. 정확한 관리자 host/session POST만 대상으로 한
  별도 Vercel WAF 10회/60초 규칙은 설정했지만 Preview에서의 실제 제한 효과는 확정하지 않았다.
- stateless 토큰의 복사본 개별 철회는 만료 전까지 제공하지 않는다. 계정별 자격 교체는 해당 계정의
  세션을, 공통 서명키 교체는 두 계정 세션을 무효화한다. 옛 immutable 배포도 별도로 관리한다.
- 회원별 권한·Supabase Auth·회원 관리·DB schema·Storage 변경은 하지 않았다.

[최신 비밀번호 변경·자동 입력 안내](MENTOR_PASSWORD_UPDATE.md) · [최초 멘토 접근 검증](MENTOR_ACCESS.md) · [이전 소유자 로그인 검증](ADMIN_SESSION_QA.md) · [구조와 다음 인증 단계](ADMIN_LOGIN_AUTH_PLAN.md)

공식 참고: [Vercel 보호 쿠키 진입](https://vercel.com/docs/deployment-protection/methods-to-bypass-deployment-protection/protection-bypass-automation),
[Next.js 인증](https://nextjs.org/docs/app/guides/authentication).
