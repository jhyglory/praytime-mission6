# Mission 6 — STEP 1 Baseline

검증일: 2026-11-09 (Asia/Seoul). 범위는 미션 5 보존과 미션 6 개발 환경 분리다.
CRUD 및 이후 단계는 구현하지 않는다. 아래 결과는 이번 복제본에서 실행한 검사만 기록한다.

## 1. 프로젝트 개요와 기준

- 원본: https://github.com/jhyglory/praytime-mission5
- 원본 구현 브랜치: `feature/mission-5-landing`
- 원본 최신 구현 SHA: `6318f53aee405bd62b84e346ca0d9777940a93b9`
- 원본 기본 브랜치: `main`, SHA `3a6f3b479dd6b0ce9ab59a772ac93d5f7ba84024`
  (트리에 `README.md`만 있으므로 복제 기준으로 사용하지 않았다.)
- 기존 PR: https://github.com/jhyglory/praytime-mission5/pull/1
  — 시작 시 OPEN, 미병합. 이 작업에서 수정·병합·종료하지 않는다.
- 기존 Production: https://praytime-mission5.vercel.app/
  — 배포·환경 변수·DNS를 변경하지 않는다.

시작 시 현재 채팅 디렉터리는 Git 저장소가 아니었고, 기존 로컬 미션 5 저장소는
원본 구현 SHA와 동일하며 미커밋 변경사항이 없었다. GitHub 연결 도구와 인증된
GitHub CLI 양쪽에서 목표 저장소가 아직 없음을 확인했다.

## 2. 새 저장소와 브랜치

- 목표 공개 저장소: https://github.com/jhyglory/praytime-mission6
- 기준 브랜치: `main` — README만 있는 원본 main 대신 최신 구현 전체에서 시작한다.
- 작업 브랜치: `feature/mission-6-crud` — STEP 1 완료 시 main과 같은 커밋에서 준비한다.
- 로컬 위치: 이 문서가 속한 `praytime-mission6` 프로젝트 루트.
- `origin` fetch/push: `https://github.com/jhyglory/praytime-mission6.git`

원격의 구현 브랜치를 별도 디렉터리로 복제하여 기존 Git 이력을 유지했다. 기존
작업 디렉터리의 실제 `.env*`, `.vercel` 바인딩, `node_modules`, 빌드 산출물은
복사하지 않았다. 원본 저장소에 대한 push, force push, reset, rebase는 수행하지 않는다.
소스 이력은 재작성하지 않으며, STEP 1 문서만 새 커밋으로 추가한다.

## 3. 재활용한 기술과 코드·에셋

원본 추적 파일은 총 529개다. 원본의 `src` 59개, `public` 180개, `docs` 255개,
`tests` 16개, `config` 1개 및 루트 설정을 보존한다.

- `src/app`: App Router, 페이지·레이아웃·메타데이터, 사전예약 Route Handler.
- `src/components`: 역할별 랜딩 섹션, Radix 기반 shadcn/ui Button·Accordion,
  시간 선택 wheel, 공유 아이콘, 모션 컴포넌트와 사진 배정 JSON.
- `src/lib`: Zod 스키마, 신청 handler/store, 동의 기록, Privacy·메타데이터,
  공유 모션 유틸리티.
- `public`: 기존 이미지·실제 로고·favicon·OG·SVG·모션 자료, SNS 사진 80장,
  고해상도 이미지 2개, Inter/Pretendard 로컬 폰트.
- `tests`: Unit 7개 파일, E2E 8개 스펙, 카피 fixture 1개를 그대로 보존한다.
- `config`, `docs`, package/lockfile, TypeScript·Next·Tailwind/PostCSS·ESLint·Vitest·
  Playwright·shadcn 설정 및 `.gitignore`를 보존한다.
- 기존 `supabase` 문서·migration 파일 2개도 보존하되 실행하지 않는다.

`package.json`의 `praytime-mission5` 이름, README의 미션 5 소개와 링크,
`signup_source: mission5_landing`은 기존 실행·문서·저장 계약 보존을 위해 유지한다.
이전 문서의 배포 승인이나 PASS 기록은 미션 5의 이력이며 이번 작업의 승인·검증이 아니다.
`AGENTS.md` 맨 앞에 현재 미션 6 범위를 추가하고 기존 지침 본문은 그대로 보존했다.

## 4. 기존 랜딩 기능과 변경 금지 사항

| 구간 | 보존한 기능 |
| --- | --- |
| Header | 실제 로고, 기존 navigation·anchor·현재 구간 표시 |
| Hero | 원본 고해상도 artwork, 기존 A안 문구·CTA·focus 동작 |
| ONE QUESTION | 기존 문구, 1200ms 두 문장 stagger·reduced-motion |
| WHY NOW | 34.3%/25.3%, 독립 진입·500ms 대기·1400ms count-up |
| Intro Transition | 고정 밝음→네이비 그라데이션, 4600ms/600ms timing, 실제 로고 |
| SNS Scene | 별도 장면, 80장 사진·교차 stream·상승 particles, 기존 reveal timing |
| THE GAP | 기존 샴페인 빛·1200ms 대기·5784.615ms motion, 동등한 두 선택지 |
| TIME SELECT | 기존 폰 mockup, 5/10/15분 tap·swipe·keyboard wheel |
| PRAYER | PAUSE→PRAY→CHOOSE 빛·문구 누적, 3900ms timing |
| FAQ | 기존 7개 문답, 독립 toggle·keyboard·ARIA·높이 애니메이션 |
| Beta Signup | 기존 8개 폼 그룹, 필수 동의·검증·중복·실패·성공 상태 |
| Footer | 기존 문구·Privacy URL·링크 |

Brand Color, Typography, Spacing, Layout, 반응형 디자인, Animation, UX Writing,
navigation, ARIA/ID, 서버 응답 계약, 기존 테스트를 변경하지 않는다.
OS 앱 제한 기능 자체는 이 랜딩에 구현되어 있지 않으며, STEP 1에서 추가하지 않는다.

## 5. 기존 Supabase 연동과 개인정보 보호

흐름은 `POST /api/beta-signup → Zod·origin·요청 크기·honeypot·Privacy 검증 →
서버 동의 메타데이터 → getSignupStore → beta_signups INSERT`다.
기존 store는 반환 행을 조회하는 `select()` 없이 INSERT만 수행하며 10초 timeout,
201 성공·23505 중복·실패를 구분한다. UI 성공은 실제 서버의
`201 + status=success + receipt=true` 계약을 따른다.

- 기존 `beta_signups`, UNIQUE(email), RLS, 동의 시각·Privacy hash·source 계약을 보존한다.
- 이 작업은 운영 테이블·신청자 데이터 조회, INSERT/UPDATE/DELETE, migration,
  RLS 변경, 새 프로젝트·테이블·Storage Bucket 생성을 수행하지 않는다.
- 실제 signup POST, 운영 환경 변수 변경, Secret/Service Role Key 사용을 하지 않는다.
- `.gitignore`는 `.env*`, `.vercel/`, `node_modules/`, `.next/`, 테스트 산출물을 제외한다.
  실제 환경 파일은 추적하지 않는다.
- 공유 예시는 추적된 `config/environment.example`이다. persistence는 `disabled`,
  키는 공란이며 공개 프로젝트 URL만 있다. `.env.example`도 `.env*` 규칙상
  무시되므로 공유 예시로 새로 만들 필요가 없다.
- Unit 신청 테스트는 환경 변수와 HTTP를 mock한다. E2E는 disabled local store 또는
  mocked transport만 사용하며 외부 요청을 차단한다.

로컬 실행은 프로젝트 루트에서 다음처럼 준비한다. 운영 키를 복사하지 않는다.

```bash
cp config/environment.example .env.local
# BETA_SIGNUP_PERSISTENCE=disabled 및 빈 키를 유지한다.
npm ci
npm run dev -- --port 3106
```

`.env.local` 생성은 개발자 선택이며 이번 복제본에는 생성하지 않았다. 기본 persistence도
disabled다. 원본 Production이 별도로 운영 중이라는 사실은 로컬 저장 활성화 승인이 아니다.

## 6. 개발 환경과 고정 버전

| 항목 | 검증 환경 / lockfile 버전 |
| --- | --- |
| Node.js | 요구 24.x / 실행 v24.22.0 |
| npm | 11.19.1 / lockfileVersion 3 |
| Next.js | 16.4.5 (App Router, webpack build) |
| React / React DOM | 19.3.1 / 19.3.1 |
| TypeScript | 5.9.3 |
| Tailwind / PostCSS adapter | 4.3.4 / 4.3.4 |
| Radix Accordion / Slot | 1.3.1 / 1.5.0 |
| Supabase JS | 2.119.0 |
| Zod | 4.6.7 |
| Vitest | 4.1.12 |
| Playwright | 1.64.1 |

새 dependency 설치, 버전 변경, lockfile 갱신, 프레임워크 교체는 하지 않는다.
새 checkout에서 Next 생성 타입이 필요할 경우 production build로 생성하며,
검사를 통과시키기 위해 소스나 테스트를 우회 수정하지 않는다.

## 7. STEP 1 검증 결과

아래 명령은 새 복제본에서 직접 실행했다. 핵심 QA 5개와 기존 E2E 전체가 통과했다.

| 검사 | 결과 | 근거 |
| --- | --- | --- |
| `npm ci` | PASS | 425 packages 설치, audit 0 vulnerabilities |
| `npm run lint` | PASS | 종료 코드 0 |
| `npm run typecheck` | PASS | 새 checkout에서 종료 코드 0 |
| `npm run test` | PASS | 7 files / 60 tests |
| `npm run build -- --webpack` | PASS | 종료 코드 0; 컴파일·타입 검사·정적 페이지·trace 완료 |
| Browser QA | PASS | 기존 8 specs / 67 passed / 0 failed / 0 skipped, 1회 전체 실행, 6.4분 |
| 원본 소스·에셋 보존 | PASS | 복제 직후 529개 파일 일치; 이후 차이는 AGENTS.md 안내와 이 신규 문서뿐 |
| 환경 파일 제외·비밀 키 검사 | PASS | 실제 env 추적 0, 원본 이력 987 blobs 정적 검사에서 실제 키 미발견 |
| 원격 main·작업 브랜치 | PASS | 공개 저장소 생성, 실제 src/app/page.tsx 확인, 두 브랜치 동일 기준 SHA 확인 |
| 원본 저장소·PR 상태 유지 | PASS | 두 원격 SHA 동일, 기존 로컬 clean, PR OPEN·미병합·updated_at 동일 재확인 |

QA 프로세스에 `BETA_SIGNUP_PERSISTENCE=disabled`, 빈 `SUPABASE_URL`,
`SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_ANON_KEY`를 명시했다.
기존 3000번 포트 서버는 보존하고 별도 3106번 포트를 사용한다.
브라우저 실행용 임시 설정·로그는 저장소 밖 `work/`에 둔다.

E2E는 1440/1280/1024/768/430/393/375/320px의 반응형·에셋·overflow,
normal/reduced-motion/no-JS, keyboard/touch, FAQ/wheel/anchor,
각 섹션 모션·SNS 두 주기·사진 무중복·particle 상승, reload를 확인했다.
폼 검사는 disabled 로컬 handler의 503과 intercepted mock 결과를 사용했다.
실제 운영 신청 POST나 신청자 데이터 접근은 없었다. 기존 3000번 서버는 재사용하지 않았다.

추가로 1440/393/360px의 reduced-motion 전체 페이지·Hero 캡처를 직접 열어 모든
섹션·주요 에셋·폼·Footer의 보존을 확인했다. 캡처에서 console/pageerror,
외부/API 요청 시도, 수평 overflow는 모두 0건이었다. 이 정지 화면은 normal-motion
재생 검증을 대체하지 않으며, 실제 재생은 위 E2E가 검증했다.
캡처 보조 스크립트는 clipping된 SNS 트랙의 비가시 lazy 이미지까지 기다리는 진단 때문에
종료 코드 1이었다. 이는 PASS로 계상하지 않았다. 저장된 캡처의 보이는 에셋은 정상이고,
기존 E2E의 8개 너비 에셋 검사도 통과했다. 이 제한 때문에 제품 소스나 테스트를 수정하지 않았다.
QA용 3106 서버는 종료했으며, 기존 서버는 그대로 두었다.

실물 기기, Safari, FPS 측정 및 새 배포 QA는 NOT RUN이다. 이번 단계에서는 배포하지 않는다.

비밀 키 정적 검사는 원본의 reachable objects 1,550개 중 987 blobs를 확인했다.
텍스트 782 blobs의 토큰·JWT·개인 키·자격 증명 URL 패턴을 검사했으며, 세 이력 버전에서
발견된 secret-prefix 문자열은 mocked HTTP 테스트의 가짜 sentinel이었다.
205 binary blobs는 OCR·내부 문자열 추출 대상에서 제외했다. 이 검사는 모든 형태의
비밀 정보 부재를 보증하는 검사가 아니며, 실제 키 유효성 확인·운영 접근은 하지 않았다.

설치 경고: 기존 ESLint 9.39.5 지원 종료 안내와 fsevents install-script 승인 안내가
출력됐다. 설치는 성공했고 audit 취약점은 0개다. 범위 밖 패키지 교체·승인 변경은 하지 않았다.
과거 docs/PR의 QA 결과는 이번 PASS 수에 포함하지 않는다.

## 8. 이후 단계 구분

| 단계 | 앞으로 수행할 항목 |
| --- | --- |
| STEP 2 | CRUD 핵심 기능 명세와 화면 설계 |
| STEP 3 | Supabase 테이블 구조 및 연결 |
| STEP 4 | Create / Read / Update / Delete 구현 |
| STEP 5 | CRUD 화면과 Pagination |
| STEP 6 | Supabase Storage |
| STEP 7 | QA |
| STEP 8 | Vercel 배포 및 README 최종화 |

STEP 2에서 CRUD 대상과 사용자 흐름을 먼저 확정한다. 이후 DB·권한·운영 환경 분리와
배포 방식을 해당 단계에서 판단하며, 현재 운영 신청자 데이터를 실험용으로 사용하지 않는다.
이 문서의 로드맵은 이후 단계의 자동 실행·DB 작업·배포 승인이 아니다.

## 9. 변경 범위와 인수 기준

- 신규 파일: `docs/mission6/STEP1_BASELINE.md`.
- 수정 파일: `AGENTS.md` 앞부분의 미션 6 범위 지침만 추가.
- 그 외 원본 528개 파일은 내용·경로를 그대로 보존한다.
- STEP 1 완료는 필수 QA와 환경·에셋 검사, 공개 저장소의 실제 소스가 포함된 main,
  작업 브랜치, commit/push, 원본 무변경을 확인한 뒤에만 판단한다.
- 실행하지 않은 검사와 실물 기기·Safari·FPS 등 확인하지 않은 범위는 PASS로 표시하지 않는다.
- STEP 1 이후에는 멈춘다. STEP 2는 자동으로 시작하지 않는다.
