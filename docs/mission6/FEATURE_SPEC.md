# 미션 6 · 기도 가이드 CRUD 기능 명세

기준일: 2026-11-18 KST. 기존 README와 QA에 분산돼 있던 화면별 입력·행동·성공·실패를
제출 요구사항에 맞춰 한 문서로 보완했다. 구현이나 배포를 새로 완료했다는 의미는 아니다.
실제 실행 결과와 미실행 항목은 [최종 보고서](FINAL_REPORT.md), 과거 실행 이력은 [QA](QA.md)를 따른다.

## 1. 선정 기능과 사용자 흐름

핵심 CRUD는 **관리자의 기도 가이드 콘텐츠 관리**다. 관리자가 준비한 콘텐츠를 Supabase에
저장·게시하면 사용자가 같은 데이터를 읽고 잠깐 기도하는 흐름으로 서비스 가치를 검증한다.
최종 저장소는 Supabase Database와 Storage이며 Mock Data나 브라우저 저장소가 아니다.

- 관리자: 보호된 로그인 → 목록 → 상세 → 수정 → 상세/목록. 목록에서 새 기도문 등록으로 이동하며,
  목록 또는 상세에서 삭제 확인을 열 수 있다.
- 공개 사용자: 기존 랜딩의 기도 가이드 → 공개 목록 → 상세 → 기도 시작 → 일시정지/계속 → 완료.
- 초안은 관리자에게만 보이며 게시된 기도문만 공개 조회한다. 실제 개인정보, 개인 기도 제목,
  감정·타이머 기록은 저장하지 않는다. 이 웹 체험은 모바일 OS의 SNS 차단 기능이 아니다.

## 2. 화면별 기능 명세

| 화면·경로 | 입력·조회 대상 | 사용자 행동 | 성공 결과 | 실패·빈 상태 |
| --- | --- | --- | --- | --- |
| 관리자 목록 `/admin/prayers` | `page`, `category`, `status` 쿼리; 한 페이지 10개 | 분류·게시 상태 선택, 페이지 이동, 상세/등록/수정/삭제 선택 | DB 목록·총 개수·실제 분류 표시; 수정 시각 내림차순, 같은 시각은 ID 순서 | 로딩 표시; 조회 실패 안내·재시도; 결과 없음 안내·전체 목록 복귀; 접근 제한 유지 |
| 관리자 상세 `/admin/prayers/[id]` | UUID의 기도문·선택 이미지·생성/수정 시각 | 본문 확인, 수정 이동, 게시된 사용자 화면 열기, 삭제 확인 | 저장된 값 표시; 등록/수정 직후 완료 안내; 초안 여부 구분 | 잘못된 UUID는 입력 오류, 없는 ID는 404 안내; 연결 오류 재시도; 이미지 없는 글도 정상 표시 |
| 등록 `/admin/prayers/new` | 아래 입력 규칙의 콘텐츠·대표 이미지 1장·초안/게시 | 내용 작성, 이미지 선택·미리보기, 등록 또는 취소 | 서버 검증 후 DB 저장, 선택 파일 Storage 연결; 저장된 상세로 이동; 새로고침해도 유지 | 필수값·길이·파일 오류를 필드에 표시; 첫 오류로 포커스 이동; 저장 중 중복 제출 차단; 실패 시 입력 유지·안내 |
| 수정 `/admin/prayers/[id]/edit` | DB의 기존 값과 `updated_at`, 새 내용·이미지 교체/제거·게시 상태 | 기존 값을 수정·저장하거나 취소 | 기존 ID로 갱신; 상세와 공개 게시 데이터 반영; 연결 성공 후 이전 이미지 정리 | 초기 조회의 로딩·404·오류 처리; 저장 실패 시 입력 유지; 버전 충돌 409에서는 재저장 차단·최신 내용 확인 안내 |
| 삭제 확인 · 목록/상세의 Dialog | 대상 제목·ID·읽었던 `updated_at` | 삭제 버튼 → 취소 또는 최종 삭제 | 취소 시 데이터 유지·트리거 포커스 복귀; 확인 시 DB 삭제 후 목록 갱신/이동·연결 이미지 정리 | 처리 중 중복 클릭·닫기 제한; 실패·충돌 메시지를 Dialog에 표시; DB/파일 정리의 불확실성은 경고로 구분 |
| 공개 목록 `/prayers` | 게시된 한국어 기도문, `page`, `category`; 한 페이지 9개 | 분류·페이지 선택, 상세 열기 | native 순서 우선, 새 CMS 글은 생성 시각 내림차순으로 표시; 이미지 없는 카드는 브랜드 대체 화면 | 로딩·빈 목록·필터 결과 없음·조회 오류/재시도; 공개 쓰기와 초안 노출 불가 |
| 공개 상세 `/prayers/[id]` | 게시된 기도문·선택 성경 구절·대표 이미지 | 읽기, 목록 복귀, 기도 시작 | DB 본문과 연결 이미지 표시; 타이머 경로로 이동 | 삭제/미게시/없는 ID는 404 안내; 연결 오류 재시도; 선택 항목이 없으면 해당 영역 생략 |
| 기도 `/prayers/[id]/pray` 및 완료 `/prayers/[id]/complete` | 같은 게시 기도문; 브라우저 메모리의 경과 시간 | 시작·잠시 멈춤·계속·마치기, 다른 기도문/랜딩 이동 | 타이머 정지·재개, 완료 화면과 이동 경로 제공 | 시작 전 마치기 비활성화; 중복 완료 이동 차단; 콘텐츠 로딩·오류·404 처리; 페이지를 떠나면 타이머 종료 |

공통 목록·상세·폼·삭제·로딩·오류·빈 상태·페이지네이션을 재사용한다.
근거: [목록](../../src/components/prayers/prayer-list.tsx),
[상세](../../src/components/prayers/prayer-detail.tsx),
[등록·수정 폼](../../src/components/prayers/prayer-form.tsx),
[삭제](../../src/components/prayers/delete-prayer.tsx),
[공통 상태](../../src/components/prayers/prayer-states.tsx),
[타이머·완료](../../src/components/prayers/prayer-timer.tsx).

## 3. 입력·파일·API 계약

| 항목 | 현재 UI·서버 검증 규칙 |
| --- | --- |
| 제목·기도문 | 필수, trim 후 공백만 있는 값 거부. 각각 최대 120자·10,000자 |
| 카테고리 | UI에서는 기존 분류 선택 또는 직접 입력 필수, 최대 60자. API/DB는 기존 콘텐츠와의 호환을 위해 null도 허용하며 두 규칙을 동일하다고 표현하지 않음 |
| 선택 텍스트 | 카테고리 설명 120자, 키워드 100자, 성경 참조 160자, 말씀 본문 2,000자. 빈 선택값은 null |
| 게시·언어 | `draft`/`published`, 기본 `draft`; 현재 API 언어는 `ko`만 허용, 기본 `ko` |
| 파일 | 대표 이미지 1장, JPEG/PNG/WebP, 최대 2,097,152 bytes. 빈 파일·허용하지 않은 MIME·실제 파일 시그니처 불일치 거부. 파일 없이도 저장 가능 |
| 생성 | UUID `clientRequestId` 필수. 동일 요청 재전송의 중복 생성을 방지하며, 같은 ID에 다른 내용을 보내면 충돌 처리 |
| 수정·삭제 | 읽었던 ISO 날짜 `expectedUpdatedAt` 필수. DB 버전이 바뀌면 409로 거부하여 다른 변경을 덮어쓰지 않음 |
| 조회 | 양의 정수 `page`·`pageSize`, API 페이지 크기 최대 50. 중복 조회 인자·잘못된 상태/분류 길이 검증 |

등록·수정은 multipart의 `payload` JSON과 선택적 `cover` 파일을 받는다.
요청 전체는 이미지 최대 크기+64KiB, JSON payload는 48KiB로 제한한다.
수정에서 이미지 교체와 제거를 동시에 요청하면 거부한다. 새 파일과 DB 연결을 확인한 뒤
이전 파일을 정리하며, 저장 여부를 확인할 수 없으면 연결 가능 파일을 보존하고 점검을 안내한다.
Storage와 DB를 하나의 원자적 트랜잭션으로 보장하지 않는다.

| Route Handler | 메서드·역할 |
| --- | --- |
| `/api/prayers`, `/api/prayers/[id]` | GET 목록·상세, 게시 데이터만 읽기 |
| `/api/admin/prayers` | 보호된 GET 목록, POST 등록 |
| `/api/admin/prayers/[id]` | 보호된 GET 상세, PATCH 수정, DELETE 삭제 |

근거: [서버 검증](../../src/lib/prayers/schema.ts), [API 처리](../../src/lib/prayers/api.ts),
[실제 DB·Storage 어댑터](../../src/lib/prayers/repository.ts),
[API 라우트](../../src/app/api). Next.js Route Handler를 사용하며 별도 백엔드 프로젝트는 만들지 않았다.

## 4. 데이터 구조와 보존 규칙

별도 CMS 프로젝트의 기존 `public.prayers`를 재사용한다. 다음은 저장소의
[추가 migration](../../supabase/migrations/20261117075425_mission6_prayer_cms.sql)에 명시된
SQL 정의와 [기존 데이터 보존 규칙](DATA_MODEL.md)이다. `CREATE TABLE IF NOT EXISTS`는 기존
테이블을 재생성하지 않으며, 이번 작업에서도 기존 UUID·원문·생성 시각을 보존했다.

| 필드 | SQL 타입·필수/기본값 및 처리 |
| --- | --- |
| `id` | `uuid` PK, SQL 생성 기본 `gen_random_uuid()`; CMS는 서버 생성 UUID 사용 |
| `source_key` | `text unique`, SQL nullable; native 원본 ID 또는 CMS 요청 ID의 namespace, UI에서 수정 불가 |
| `title`, `content` | `text not null`, 공백뿐인 값 불가. SQL 상한은 300/20,000자이며 신규 CMS API는 위의 더 짧은 상한 적용 |
| `category`, `category_full`, `keyword`, `scripture_ref`, `scripture_text` | nullable `text`; SQL 길이 상한은 각각 80/200/100/200/2,000자, CMS 검증은 위 입력 표 적용 |
| `language` | `text not null default 'ko'` |
| `status` | 추가한 `text not null default 'draft'`, `draft`/`published` 제약 |
| `image_path` | nullable `text`, 해당 기도문 UUID 하위의 서버 생성 파일 경로; 서명 URL 자체를 DB에 저장하지 않음 |
| `source_payload` | nullable `jsonb` object, 원본/최초 요청의 내부 provenance; 공개 API·anon 열 조회에서 제외 |
| `source_order` | 추가한 nullable `integer`; native 배열 순서 0–99, 새 CMS 글은 null |
| `created_at`, `updated_at` | `timestamptz not null default now()`; 갱신 trigger로 수정 시각 관리, 수정·삭제 버전 확인에 사용 |

환경 변수 이름·실행 방법은 [README](../../README.md#환경-변수),
원본 100개·8분류와 멱등 import 규칙은 [데이터 모델](DATA_MODEL.md)과 [원본 감사](JSON_AUDIT.md)에 있다.
실제 키·비밀번호·비공개 진입 링크는 이 문서와 Git에 기록하지 않는다.

미션 6의 일반 회원·사용자별 권한은 구현하지 않았다. 기존 공개 읽기 정책과 RLS를 유지하며,
후속 요청으로 추가한 관리자/멘토 로그인은 보호된 비민감 Demo의 평가 접근이다.
공개 Production의 관리자 쓰기는 비활성화돼 있다. [현재 접근 구조](ACCESS.md)

## 5. 제출 요구사항과 완료 근거

| 기본 요구사항 | 구현·증거 위치 |
| --- | --- |
| 1. 핵심 기능·화면 명세 | 본 문서 1–3절. 화면별 명세 표는 이번 대조에서 독립 문서로 보완 |
| 2. Supabase 구조·환경·컨텍스트 | 본 문서 4절, [DATA_MODEL](DATA_MODEL.md), [README](../../README.md), [프로젝트 지침](../../AGENTS.md) |
| 3. 실제 전체 CRUD | Route Handler/API/repository, 최종 보고서의 실제 등록·조회·수정·삭제 및 새로고침 검증 |
| 4. 화면·동적 라우트·재사용·페이지네이션 | 본 문서 2절 및 연결된 컴포넌트, `admin/prayers/[id]`·`prayers/[id]` 경로 |
| 5. 검증·중복 방지·로딩/오류/빈 상태·404 | 본 문서 2–3절, [최종 QA](FINAL_REPORT.md#d-qa) |
| 6. Storage 연동·형식/크기·파일 없는 화면 | 본 문서 3–4절, 실제 업로드·교체·공개 상세 바이트·제거/정리 검증 |
| 7. GitHub·Vercel·환경 변수·배포 검증 | [README](../../README.md#저장소와-배포), [최종 제출 안내](FINAL_REPORT.md#e-배포제출-안내). 공개 서비스와 보호된 CRUD Demo를 함께 안내 |
| 8. QA·README·비밀 제외 | [최종 QA](FINAL_REPORT.md#d-qa), [초기 QA 이력](QA.md), [README](../../README.md). 실제 DB/Storage 검증과 합성 오류 응답 테스트를 구분 |

파일 미첨부·실제 업로드/교체/제거는 배포 환경에서 확인했다. 실제 Storage 장애나 응답 유실을
강제로 발생시키는 검사는 하지 않았으며, 해당 실패·보상 처리 경로는 Unit/계약 테스트의
증거로 구분한다. 실물 기기·Safari 등 미실행 항목도 최종 보고서에 별도로 기록했다.

## 6. 심화 요구사항의 실제 범위

| 심화 항목 | 현재 구현 범위 |
| --- | --- |
| URL 쿼리 검색·필터·정렬 | 카테고리·관리자 게시 상태 필터와 페이지 구현. 검색·사용자가 선택하는 정렬은 미구현; 서버의 고정 정렬만 있음 |
| 무한 스크롤·낙관적 업데이트 | 미구현. 페이지네이션과 서버 응답 후 갱신 사용. `updated_at` 낙관적 경합 검사는 낙관적 UI 업데이트와 별개 |
| 여러 이미지·미리보기·파일 삭제 | 대표 이미지 **1장**의 미리보기·교체·제거·실제 파일 정리 구현. 여러 이미지 업로드는 미구현 |
| 댓글·좋아요 관계 테이블 | 미구현 |
| 데이터별 상세 metadata·OG | 미구현. 공개 기도 영역의 공통 제목·설명만 설정 |

심화 전체를 완료했다고 표현하지 않는다. 미션 6의 기본 CRUD MVP와 제출 준비는 완료했으며,
외부 과제 플랫폼의 실제 제출은 이 문서의 개발 완료와 별도다.
