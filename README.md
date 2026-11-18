# PrayTime · Mission 6

PrayTime은 SNS를 열기 전 잠깐 멈추고 기도한 뒤, 지금 필요한 사용인지 다시 선택하도록 돕는 기독교 기반 디지털 웰니스 서비스입니다. 이번 미션은 기존 랜딩을 보존하면서 **기도 가이드 CMS → Supabase → 사용자 웹 기도 체험**을 연결합니다.

웹 체험은 실제 iOS·Android의 SNS 차단·자동 재차단 기능이 아닙니다. 자유기도 원문·개인 기도 제목·감정·사용자별 기도 기록은 서버에 저장하지 않습니다.

## 저장소와 배포

- GitHub: [Mission 6 최종 구현 브랜치](https://github.com/jhyglory/praytime-mission6/tree/feat/mission6-finalize)
- 작업 브랜치: `feat/mission6-finalize` (전체 기능 최종 검증·제출 준비 완료)
- [최종 완료 보고서 A–F](docs/mission6/FINAL_REPORT.md): W01–W11, 실제 DB·Storage 재검증, 제출 링크와 검수 화면.
- 보존 기준: `5d815a08365926566cc32c0a108634302e8e05b8` ([STEP 1](docs/mission6/STEP1_BASELINE.md))
- 공개 Vercel: [PrayTime Mission 6](https://praytime-mission6.vercel.app/) · [기도 체험](https://praytime-mission6.vercel.app/prayers)
- 관리자: [보호된 로그인](https://praytime-mission6-admin.vercel.app/admin/login). 처음에는 비공개 전용 진입 링크로 Vercel 접근 쿠키를 받은 뒤 기존 아이디·비밀번호로 로그인합니다. [접근 구조와 평가 순서](docs/mission6/ACCESS.md)
- `main`의 STEP 1 기준선은 유지하며 실제 미션 6 코드는 위 작업 브랜치에 있습니다. 공개 배포 실행 코드 SHA는 `8b9c08dec498eee6741d30f865d19938486283eb`입니다. 관리자 게이트 변경과 Preview 검증 이력은 QA 문서를 따릅니다.
- Mission 5 저장소·PR #1·Production·신청 DB·Figma·native 앱 파일은 수정하지 않습니다.

## 구현 범위

- [화면별 기능 명세·기본 요구사항 1–8 대조](docs/mission6/FEATURE_SPEC.md): 각 화면의 입력·행동·성공·실패, 필수값과 실제 심화 구현 범위.
- 관리자: 목록·상세·등록·수정·삭제 확인, 카테고리·게시 상태, 대표 이미지, 페이지네이션.
- 사용자: 공개 목록·카테고리 선택·상세·기도 시작/일시정지/계속/마치기·완료 화면.
- 서버: Next.js Route Handlers, Zod 검증, 서버 전용 Supabase 어댑터, 요청 크기·이미지 형식 검증, 중복 요청·동시 수정 방지.
- 운영 보호: 공개 읽기는 published만, 관리자 접근 기본 비활성화, 별도 Demo에서만 쓰기.
- 기존 랜딩의 색·폰트·레이아웃·모션·카피·신청 계약을 유지합니다. PRAYER의 기존 “기도 가이드” 문구만 체험 링크로 연결했습니다.

## 사용 기술

Node.js 24.x, Next.js 16.4.5 App Router, React 19.3.1, TypeScript 5.9.3, Tailwind 4.3.4, 기존 Radix 기반 shadcn/ui, Supabase JS 2.119.0, Zod 4.6.7, Vitest 4.1.12, Playwright 1.64.1. 기존 패키지와 lockfile을 유지합니다. package 이름 `praytime-mission5`도 호환성을 위해 유지했습니다.

## 프로젝트 구조

```text
src/app/                     기존 랜딩, admin/prayers, prayers, api
src/components/landing/      보존한 랜딩
src/components/prayers/      CMS·공개 체험 공통 UI
src/lib/prayers/             계약·검증·게이트·서버·repository
src/proxy.ts                 관리자 HTTP 접근 게이트
data/prayer_guides_ko.json   native와 바이트 단위로 같은 원본 100개
scripts/import-prayers.mjs   검증·dry-run·멱등 import
supabase/migrations/         기존 이력 + Mission 6 추가 migration
tests/                      기존 검사 + CMS/API/import/UI 검사
docs/mission6/              설계·원본 감사·QA·접근 설정
```

## Supabase 데이터 모델

별도 **PrayTime CMS** 프로젝트의 기존 `public.prayers`를 재사용합니다. 원본과 일치하는 100개 행을 백업·비교한 뒤 additive migration을 적용했습니다. 테이블 재생성이나 원본 기도문 덮어쓰기는 하지 않습니다.

| 필드 | 설명 |
| --- | --- |
| id | 내부 UUID PK |
| source_key | 고유 원본 연결 키; native 문자열 ID 보존 |
| title / content | 제목 / 기도문 본문 |
| category / category_full | 짧은 카테고리 / 전체 이름 |
| keyword | 원본의 단일 키워드 문자열 |
| scripture_ref / scripture_text | 성경 참조 / 구절 원문 |
| language | 현재 ko |
| status | draft / published; 기본 draft |
| image_path | private bucket 내부의 안전한 UUID 경로 또는 null |
| source_payload | 원본 provenance; 공개 API/anon 열 권한에서 제외 |
| source_order | native 배열 순서 0–99; 새 CMS 행은 null |
| created_at / updated_at | 서버 시각; 수정 trigger |

새 CMS 등록의 private provenance에는 최초 생성 요청 지문도 저장해 동일 요청 ID로 다른 내용을 재전송하는 충돌을 구분합니다. 기존 native 100개 payload는 그대로 유지합니다.

[필드 매핑·원본 보존·import 규칙](docs/mission6/DATA_MODEL.md) · [두 플랫폼 JSON 감사](docs/mission6/JSON_AUDIT.md)

### Migration 실행

이번 프로젝트용 SQL은 `supabase/migrations/20261117075425_mission6_prayer_cms.sql`입니다. SQL Editor에서 **PrayTime CMS Demo 프로젝트**를 확인한 뒤 이 파일만 실행합니다. 이 작업에서는 연결된 Supabase migration 도구로 적용했습니다.

**기존 Mission 5 migration까지 일괄 실행하는 기본 `supabase db push`는 사용하지 마세요.** 기존 신청 DB에 연결하거나 이전 SQL을 다른 프로젝트에 적용하지 않습니다. 기존 데이터가 있으면 백업과 필드 비교부터 수행합니다.

## Storage

기존 `prayer-covers` bucket은 **private**, 허용 MIME은 JPEG/PNG/WebP, 최대 크기는 2MB입니다. bucket 생성·변경·파일 정리는 Storage API로 수행하며 storage 테이블에 직접 INSERT/DELETE하지 않습니다.

- 서버가 MIME·magic bytes·크기를 검증합니다.
- 경로: `prayers/<기도문 UUID>/<파일 UUID>.<jpg|png|webp>`.
- 새 이미지 업로드와 DB 연결 후에만 이전 파일을 정리합니다.
- DB 저장 실패·불확실한 응답에서는 참조 여부를 확인해 업로드 보상 처리 또는 수동 확인 경고를 제공합니다.
- 공개 사용자는 published 행에 연결된 표지만 짧은 서명 URL로 조회합니다. 기존 서명 URL은 게시 중지 뒤에도 만료까지 유효할 수 있습니다.
- 표지 없는 기도문도 정상적으로 사용할 수 있습니다.

새 Demo 프로젝트를 준비할 때만 Storage Dashboard/API에서 같은 이름의 private bucket을 생성하고 2MB·MIME 제한을 설정합니다. 공개 INSERT/UPDATE/DELETE 정책은 만들지 않습니다.

## 환경 변수

실제 값은 Git·README·브라우저에 기록하지 않습니다. [.env.example](.env.example)을 복사하고 서버 전용 키는 `NEXT_PUBLIC_` 접두사를 사용하지 않습니다.

| 이름 | 용도 |
| --- | --- |
| PRAYER_SUPABASE_URL | 별도 CMS Demo 프로젝트 URL |
| PRAYER_SUPABASE_PUBLISHABLE_KEY | RLS가 적용되는 공개 읽기 키 |
| PRAYER_SUPABASE_SECRET_KEY | 서버 전용 Secret 또는 legacy service_role |
| CMS_ADMIN_MODE | disabled / local / protected-demo |
| CMS_DEMO_ENV | 비민감 Demo 전용 확인; 관리자 모드에는 true 필요 |
| CMS_DEPLOYMENT_PROTECTION | 접근 제한을 실제 확인한 Preview에서만 verified |
| CMS_ADMIN_USERNAME | 보호된 Demo의 비공개 HTTP 게이트 사용자 이름 |
| CMS_ADMIN_PASSWORD_SHA256 | 게이트 비밀번호의 SHA-256 hex; 서버 전용 |
| CMS_ADMIN_SESSION_SECRET | 비밀번호와 별개인 32자 이상 랜덤 세션 서명 비밀; 서버 전용 |
| CMS_MENTOR_USERNAME | 선택적 멘토 평가용 아이디; Preview 전용 |
| CMS_MENTOR_PASSWORD_SHA256 | 별도 멘토 비밀번호의 SHA-256 hex; 서버 전용, 위 이름과 함께 설정 |
| CMS_ADMIN_ACCESS_KEY | 위 두 설정이 모두 비어 있을 때만 사용하는 기존 32자 이상 공유 키 |
| BETA_SIGNUP_PERSISTENCE | 로컬·QA에서는 disabled 유지 |
| SUPABASE_URL / SUPABASE_PUBLISHABLE_KEY / SUPABASE_ANON_KEY | 기존 신청 어댑터 전용; CMS와 혼용 금지 |
| SITE_URL | 배포 시 본인의 사이트 origin |

## 로컬 실행

```bash
node --version
npm ci
cp .env.example .env.local
# CMS Demo의 키를 .env.local에 저장
# CMS_ADMIN_MODE=local, CMS_DEMO_ENV=true 설정
npm run dev -- --port 3106
```

서버는 기본적으로 `127.0.0.1`에 바인딩됩니다. 환경 파일은 Git에서 제외됩니다. CMS 키가 없으면 명확한 연결 오류를 표시하고 가짜 데이터로 대체하지 않습니다.

## 기존 JSON Import

iOS·Android 실제 JSON은 100개가 완전히 같았으며 원본 8개 필드와 ID를 보존합니다. native 앱의 저장 방식과 파일은 변경하지 않습니다.

```bash
npm run import:prayers -- --validate-only
npm run import:prayers
npm run import:prayers -- --apply
# 원본과 정확히 일치하는 Demo 템플릿만 공개하려면:
npm run import:prayers -- --apply --publish
```

기본은 dry-run입니다. `--apply`만 DB에 쓰며, 허용된 CMS 프로젝트를 검사합니다. 동일 source_key는 중복 생성하지 않고, CMS에서 편집된 내용은 conflict로 보고하며 덮어쓰지 않습니다. `--publish`도 원본과 정확히 같은 draft만 상태를 변경합니다. 원본·DB 개수, 주요 필드, 생성/공개/동일/충돌/실패 개수를 실제 비교합니다.

## 관리자 사용

`/admin/prayers`에서 목록·필터·페이지를 확인하고 등록·상세·수정·삭제를 진행합니다. 삭제는 확인 Dialog에서만 실행되며, **게시 중지(draft)**와 영구 삭제는 구분합니다. 충돌 409에서는 입력을 보존하고 최신 데이터를 확인한 뒤 다시 저장합니다.

관리자는 loopback 로컬 또는 별도 보호된 Demo Preview에서만 동작합니다. 보호된 Preview는 비공개 진입 링크로 Vercel 접근 쿠키를 받은 뒤 `/admin/login`에서 아이디·비밀번호를 서버 검증합니다. 성공 시 HttpOnly·Secure·SameSite=Lax·host-only 쿠키를 발급하고 최대 8시간 후 만료합니다. 관리자 화면은 이 세션을 요구하고, API는 세션 또는 기존 소유자 도구용 Basic 인증을 검증합니다. 선택적 멘토 계정은 별도 비밀번호와 세션으로 같은 Demo를 평가합니다. 최신 요청에 따라 유효한 암호화 전용 링크에서만 아이디와 비밀번호를 모두 채우며, 로그인 버튼을 누르기 전에는 앱 세션을 발급하지 않습니다. [전용 링크와 최신 검증](docs/mission6/MENTOR_LINK_PREFILL.md). 회원 관리·역할·Supabase Auth는 추가하지 않았습니다.

공개/Production/접근 제한 미확인 배포에서는 `CMS_ADMIN_MODE=disabled`로 둡니다. 사용자가 보내는 임의 헤더나 query parameter로 쓰기를 켤 수 없습니다.

## 사용자 체험

랜딩 PRAYER의 **기도 가이드** 링크 → `/prayers` → 카테고리·기도문 선택 → 상세 → 기도 시작 → 타이머 → 기도 마치기 → 완료 화면입니다.

타이머는 시작·일시정지·계속이 가능하고 브라우저 안에서만 동작합니다. 완료 화면은 기도량이나 신앙 점수를 기록하지 않습니다. 개인 기도 내용을 입력받거나 저장하지 않습니다.

## QA와 현재 연결 상태

초기 실제 통합 검증은 [QA 이력](docs/mission6/QA.md)에 보존합니다. 과거 STEP 1 PASS를 이번 기능의 검증으로 대신하지 않습니다.

최종 마감 검증은 [FINAL_REPORT.md](docs/mission6/FINAL_REPORT.md)를 기준으로 합니다.
실제 관리자 등록·수정·게시·이미지 교체/제거·UI 삭제와 원본 100개/Storage 0 복구를 확인했습니다.
공개 1440/393px 전체 흐름 및 768/360px 목록, UI 계약 E2E 7개·webpack Build·실제 Import dry-run도 통과했습니다.

- JSON 파일 검증: PASS, 100개·8개 카테고리·원본 SHA 일치.
- DB migration 및 원본 비교: PASS, 기존 100개 UUID·원문 보존.
- 공개 RLS 실연결 검사: draft 100개에서 공개 조회 0개, private provenance 조회 거부 확인.
- 서버 키 연결 및 실제 Import dry-run/적용/재실행: PASS. 기존 100개 일치, 중복/충돌/실패 0개.
- 실제 공개 조회·카테고리·페이지네이션·기도 체험: PASS, Desktop/Mobile에서 실제 CMS GET 사용.
- 멘토 최초 구축: Lint·Typecheck·webpack Build 및 Unit 15 files / 260개 PASS. 후보·고정 주소에서 멘토/소유자 실제 로그인과 배포 전 소유자 세션 유지 PASS. [최초 검증](docs/mission6/MENTOR_ACCESS.md)과 [이전 비밀번호 변경 검사](docs/mission6/MENTOR_PASSWORD_UPDATE.md)를 최신 전용 링크 검증과 구분합니다.
- 최신 멘토 전용 링크: Unit 17 files / 328개·Lint·TypeScript PASS. [암호화 링크로 두 필드 자동 입력 및 실제 배포 검증](docs/mission6/MENTOR_LINK_PREFILL.md).
- 실제 관리자 HTTP·DB·Storage QA 73개: PASS. 별도 QA 행/이미지는 생성·검증 후 모두 정리했고 기존 100개를 보존했습니다.
- 보호된 Preview 실제 API·Storage 76개와 실제 브라우저 폼·기도 체험 32개: PASS.
- 공개 Production의 1440/393 실제 흐름 및 Tablet 768/1024 공개·관리자 반응형: PASS.
- 공개 Production 관리자 GET/POST 403, 비공개 파일 404, 실제 서버 키의 Preview 전용 배치를 확인했습니다.

## 알려진 제약과 다음 단계

- 관리자 로그인 UI는 별도 `feat/mission6-admin-login-ui` 브랜치에서 2026-11-17 사용자 디자인 승인을 받았습니다.
  이후 사용자의 실제 로그인 요청에 따라 기존 아이디로 서버 세션을 연결했습니다.
  [현재 전용 링크의 두 필드 자동 입력](docs/mission6/MENTOR_LINK_PREFILL.md) · [구조와 향후 인증 계획](docs/mission6/ADMIN_LOGIN_AUTH_PLAN.md).
- 세션은 stateless이므로 복사된 토큰의 개별 즉시 철회는 제공하지 않습니다. 해당 계정의 자격 교체는 해당 계정 세션을, 공통 서명키 교체는 두 계정 세션을 현재 배포에서 무효화합니다. 시도 제한의 앱 카운터는 인스턴스별이며 전역 강제 제한으로 간주하지 않습니다.
- 실제 운영 CMS에는 아직 사용자별 관리자 인증·역할·감사 로그가 없습니다. 현재 쓰기는 비민감 Demo에 한정합니다.
- 기존 사전예약 UI·어댑터는 보존하지만 미션 6 데모의 사전예약 저장은 disabled입니다. 기존 미션 5 Production은 변경하지 않았습니다.
- Storage와 DB는 한 트랜잭션이 아니므로 보상 처리와 정리 경고가 있습니다. 실패 경고가 남으면 관리자 점검이 필요합니다.
- 공개 표지는 짧은 서명 URL을 사용합니다. 게시 중지 직후의 즉시 URL 철회는 제공하지 않습니다.
- 실물 기기·Safari·실제 모바일 네이티브 연동은 별도 검증 항목입니다.
- Mission 7: 관리자 인증/역할, 회원 기능, 사용자별 RLS, 콘텐츠 버전·감사 기록, 모바일 읽기 API 계약과 앱 연동을 진행할 수 있습니다. 이번 미션에서 자동으로 시작하지 않습니다.

제출 마감: **2026-11-23**. 미완료 배포·실연결 검증은 완료로 표시하지 않습니다.
