# 관리자 로그인 UI 설계

초기 UI 승인 시점의 디자인 근거다. 이후 기존 아이디로 서버 세션을 연결했으며
현재 로그인 동작과 검증은 [실제 로그인 검증](ADMIN_SESSION_QA.md)을 따른다.

## 기준과 범위

작업 기준은 시작 전 clean 상태를 확인한 `18dcaf5`이며, 작업 브랜치는 `feat/mission6-admin-login-ui`다. 이번 변경은 `/admin/login`의 브랜드 스타일과 입력 UI에 한정한다. 기존 Proxy·관리자 인증·인가·세션·API 접근 정책·DB·Production 배포는 변경하지 않는다.

`AdminFrame`은 현재 경로가 `/admin/login`이면 전용 화면을, 나머지 관리자 경로에서는 기존 `PrayerShell`을 선택하는 client 컴포넌트다. 이 경로 분기는 시각적 프레임 선택이며 접근 권한을 부여하지 않는다. 로그인 경로에도 기존 접근 경계가 그대로 적용된다.

## 확인한 브랜드 근거

실제 원본: `/Users/codeit/Desktop/데스크탑 - 코드잇의 MacBook Air/코드잇/PrayTime/docs/PrayTime_BI_Brand_Book_v1.0.pdf`

61페이지, V1.0 / 2026.08. SHA256: `c60f3dd4495e1ab085fc03aeef453cb1e70e3ed220c655800b4a36450ba58c1e`. 관련 페이지의 텍스트와 렌더링을 함께 확인했다. 원본은 수정하거나 공개 업로드하지 않았다.

| 페이지 | 적용 기준 |
|---|---|
| 16 | Quiet·Grounded·Modern·Intentional: 정돈되고 차분하며 각 요소의 목적이 명확한 화면 |
| 23–25 | 로고 clear space는 Pause Mark 폭 1배, digital 최소 120px. 비율·방향 유지, 임의 재색·그림자·글로우·다른 폰트로 재제작 금지 |
| 30 | Signal Red `#FF4438`, Pause Blush `#FFF0ED`, Clean White `#FFFCFA`, Focus Black `#18181B`, Clear Lilac `#C9C7FF` |
| 34–35 | 한국어/UI는 NanumSquare 또는 Pretendard 동등 기하 산세리프. 굵은 제목, 짧은 행, 한국어 문장 흐름 우선 |
| 50 | Primary CTA 하나, 중요한 행동에만 Red. 둥근 카드·충분한 패딩·부드러운 배경과 정보 위계 |

## 기존 토큰과 화면 적용

`src/app/globals.css`의 기존 제품 토큰을 우선 재사용한다.

| 역할 | 현재 전역 값 | 로그인 화면 원칙 |
|---|---|---|
| Canvas | `--canvas: #171C26` | 사용자가 지정한 Navy와 일치하는 어두운 바탕 |
| Surface | `--surface: #202735` | 사용자가 지정한 Surface와 일치하는 카드·입력 영역 |
| Action | `--action: #FF4438` | 기존 브랜드 Red와 동일한 단일 로그인 CTA |
| Text | `--text: #F1F1EE` | 현재 제품 기본 밝은 텍스트. 책의 Clean White `#FFFCFA`와 구분 |
| Font | 기존 `--font-pretendard`, `--font-inter` | 로컬 폰트 재사용, 새 폰트·패키지 추가 없음 |

Navy와 Surface는 책 30페이지 core palette에 없는 이번 사용자 지정 색상이다. Lilac·Blush·Clean White가 필요한 경우 로그인 전용 CSS 범위에서 보조적으로 사용하며 전역 토큰을 교체하지 않는다. 책에 있는 Mint를 로그인 화면에 새로 도입하지 않는다.

## 구성과 자산

- 데스크톱은 브랜드 소개와 입력 카드의 어두운 2열 구성, 모바일은 세로 배치다. 좁은 화면에서는 장식이 입력을 밀어내지 않도록 축소하거나 숨긴다.
- 입력 카드는 하나이며 제목·짧은 안내·이메일·비밀번호·로그인 CTA 순서로 읽힌다. 비밀번호 표시 버튼은 보조 컨트롤이며 별도 Primary CTA로 취급하지 않는다.
- CTA는 기존 공유 `Button`을 사용한다. 입력 label·focus·오류 안내·disabled 표현을 유지하고 필요한 스타일만 전용 클래스에 둔다.
- 로고는 `/assets/restored-intro/praytime-wordmark-desktop.svg`, 브랜드 이미지는 `/assets/high-resolution/hero-hq-fcbad7e4f361.png` 원본을 재사용한다. 새 로고·이미지·SVG를 만들거나 원본 파일을 수정하지 않는다. 로고에 왜곡·재색·효과를 추가하지 않는다.
- 브랜드 문구는 짧고 자연스럽게 유지한다. 불필요한 동작·과장된 장식·성공 연출로 시선을 분산하지 않는다.

## 동작과 정직한 연결 상태

`AdminLoginForm`의 기본 `authenticate` adapter는 `undefined`다. 실제 `/admin/login`은 이 기본 상태로 렌더하며 로그인 버튼을 disabled로 두고, 이메일 로그인이 아직 연결되지 않았고 입력 정보를 전송하지 않는다는 안내를 표시한다. 이 화면이 기존 관리자 인증을 대체하거나 이미 연결된 것처럼 보이게 하지 않는다.

이메일·비밀번호는 `onBlur` 검증을 제공하고, 오류는 해당 입력과 연결한다. 비밀번호 표시·숨기기는 입력 값을 보존하며 버튼의 접근성 상태를 갱신한다. 실제 adapter가 연결된 경우 제출 시에도 검증하고 진행 중 중복 제출을 막는다.

Loading·인증 오류는 실제 adapter의 결과로만 표시한다. 컴포넌트 QA에서 상태를 확인해야 한다면 app route 밖의 명확히 격리된 fixture를 사용한다. 실제 경로에 query parameter·타이머·임의 버튼으로 가짜 로그인 성공·실패·loading을 주입하지 않는다. 새로운 인증 요청·세션 저장·우회 헤더·권한 플래그를 이 UI에서 만들지 않는다.

이 문서는 설계와 변경 경계를 기록한다. 실행한 QA 결과와 스크린샷은 별도 검증 기록에 추가하며, 여기에는 미실행 결과를 기재하지 않는다.
