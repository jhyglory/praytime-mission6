# Admin Login UI · 디자인 검수

검증일: 2026-11-17 (Asia/Seoul). 기준 `18dcaf5`, 작업 브랜치
`feat/mission6-admin-login-ui`. 이번 작업은 프론트엔드와 로컬 디자인 검수만 수행한다.
기존 배포·관리자 접속 주소·인증·DB·Storage는 변경하지 않는다.

## 미리보기

검수 경로는 `http://127.0.0.1:3110/admin/login`이다. 로그인 제출은 미연결 상태로
비활성화되어 있으며 입력한 값을 전송하지 않는다. 입력 검증과 비밀번호 표시는 동작한다.
개발용 미리보기를 다시 실행하려면 프로젝트 루트에서 다음 명령을 사용한다.

```sh
node scripts/preview-admin-login.mjs
```

이 스크립트는 loopback에만 바인딩하고 실행 프로세스의 기도 콘텐츠·신청 저장소 키를
공란으로 덮어쓴다. 실제 `.env.local`이나 배포 환경 변수는 수정하지 않는다.
현재 실행 중인 미리보기가 있다면 그 창을 사용하거나 종료한 뒤 새로 시작한다.

## 검증 결과

| 항목 | 결과 | 범위 |
| --- | --- | --- |
| Lint | PASS | 새 UI·개발 실행 스크립트 포함 |
| Typecheck | PASS | 전체 프로젝트 |
| Unit | PASS | 11 files / 140 tests; 기존 134개 + 입력 검증 6개 |
| 분리된 폼 컴포넌트 검사 | PASS | 15개; 네트워크 요청 0 |
| 1440×1000 | PASS | Desktop 2열·원본 로고/그래픽·단일 폼 |
| 768×1024 | PASS | 세로 구성·카드·입력 폭 |
| 393×852 | PASS | 간소화한 브랜드 영역·단일 폼 |
| 360×800 | PASS | 좁은 화면·44px 이상 입력/토글/CTA |
| 실제 기본 화면 | PASS | 제목 1개·빈 입력·미연결 안내·disabled CTA |
| 입력/비밀번호/키보드 | PASS | 로컬 정식 빌드에서 blur 오류·aria 연결·표시 전환·포커스 |
| webpack Build | PASS | 최종 로그인 경로·기존 경로 생성 |
| 기존 CMS/기도 체험 E2E | PASS | 7개; 별도 3106 / intercept 응답 / 실제 DB 쓰기 없음 |
| 안전한 미리보기 스크립트 | PASS | 별도 3112에서 로그인 200·공개/관리자 API 모두 503 CMS_NOT_CONFIGURED |
| 실제 자격 정보 노출 검사 | PASS | 소스 590개·클라이언트 JS 48개·실제 값 7개, 일치 0 |

초기 네 크기의 세로 스크롤과 가로 overflow는 0이었다. 짧은 높이 393×480에서는
자연스러운 세로 스크롤로 비밀번호·토글·CTA에 접근할 수 있음을 확인했다.
실물 기기나 OS 가상 키보드를 실행한 결과는 아니다.

실제 로그인 페이지는 인증 adapter를 전달하지 않는다. Loading과 인증 Error는
앱에서 가져오지 않는 저장소 밖의 컴포넌트 fixture에서만 검사했다. 실제 계정/서버와
연결한 로그인 성공·실패가 아니며, 성공 화면·관리자 이동·세션 플래그를 만들지 않았다.
검사에는 pending/입력 잠금, 중복 제출, 비밀번호 원문 보존, 명시적 인증 오류,
기타 오류의 내부 정보 비노출, 미연결 및 disabled 상태가 포함된다.

로컬 정식 빌드에서 처음 방문한 새 브라우저 context의 글꼴·콘솔 진단도 확인했다.
전체 기능 흐름에서 console warning/error/pageerror·쓰기 시도는 모두 0이었다.
Local/session Storage는 비어 있고 테스트 비밀번호를 저장하지 않았다. 폼 검증을 위해
입력한 값은 비민감 테스트 값뿐이며, 브라우저는 모두 종료했다. 사용자 검수용 3110
미리보기만 유지하고 E2E 서버와 보조 스크립트 서버는 종료했다.

## 보존 확인

- `src/proxy.ts`, `src/lib/prayers/admin-access.ts`, `src/app/globals.css`,
  `package.json`, `package-lock.json`은 기준과 byte 단위로 동일하다.
- 기존 CMS·기도 체험·신청 API·DB schema·Storage·원본 자산은 수정하지 않았다.
- `/admin/login`도 기존 `/admin/:path*` Proxy에 포함된다. 배포 환경에서는 기존
  Vercel 접근 제한과 HTTP Basic을 통과해야 한다. 로컬 검수는 기존 loopback 모드다.
- `AdminFrame`은 새 경로의 시각적 wrapper만 고르며 다른 관리자 경로는 기존
  `PrayerShell`을 그대로 사용한다. 새 인증/우회/Authorization header는 만들지 않았다.
- 실제 공유 게이트 자격을 새 이메일 폼에 복사하지 않는다. Local/session Storage,
  URL, 로그에 로그인 비밀을 저장하지 않는다.

## 진단 이력과 실행하지 않은 항목

- 컴포넌트 fixture의 첫 번들은 Node 환경 상수 정의 누락으로 시작되지 않았다.
  fixture 설정만 수정한 뒤 15개 검사를 통과했다. 제품 런타임 fallback은 추가하지 않았다.
- 개발 환경에서 미사용 preload 글꼴 경고가 관찰되었다. 로컬 정식 빌드의 새 context와
  전체 기능 흐름을 재검증해 해당 경고 0건을 확인했다. 실제 Pretendard/Inter는 정상 로드된다.
- 초기 reduced-motion 검사는 모든 요소가 정확히 0초여야 한다는 과도한 조건이었다.
  기존 전역 정책은 `.01ms !important`다. 실제 인터랙션의 duration이 이 이하이고
  실행 중인 애니메이션이 없는지 확인하는 기준으로 보정했다. 실제 4개 컨트롤 모두
  `.01ms`, 실행 중 animation 0으로 통과했으며 전역 정책은 변경하지 않았다.
- 보조 360×640 검사는 Chrome 기동 timeout으로 NOT RUN이다. 필수 네 viewport 결과와
  별개이며 기존 브라우저 프로세스는 정리했다.
- 실물 기기·Safari·OS 가상 키보드·실제 이메일 인증은 NOT RUN이다.
- 이번 작업에서 Production/공유 Preview 배포나 관리자 인증 교체를 수행하지 않았다.

원본 캡처와 결과는 저장소 밖 작업 폴더 `work/mission6-admin-login-ui/`의
`final/`, `functional/`, `form-state-results.json`에 보존한다.

## 검수 단계

사용자가 요청한 Checkpoint 3의 디자인 검수를 기다린다. 디자인 승인은 관리자 인증
교체나 Production 배포 승인이 아니다. [디자인 근거](ADMIN_LOGIN_DESIGN.md)와
[향후 인증 연결 계획](ADMIN_LOGIN_AUTH_PLAN.md)을 함께 검토할 수 있다.
