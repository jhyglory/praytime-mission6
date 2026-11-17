# 기도 콘텐츠 데이터 모델과 Import

기준일: 2026-11-17. 실제 native JSON의 구조·해시·카테고리는 [JSON_AUDIT.md](JSON_AUDIT.md)에 기록한다.

## 기존 테이블 보존

Mission 6 기도 콘텐츠 프로젝트는 `cibcyeyznfmywacfiokh`이며 기존 `public.prayers` 테이블을 사용한다. 2026-11-12 생성된 native seed 100행의 UUID와 기존 생성 시각을 보존한다. 새 테이블로 옮겨 ID를 다시 발급하지 않는다.

작업 전 기존 100행을 `prayers-before-mission6-20261117.json`으로 백업했다. 백업 SHA256은 `e8416e98485815aaf5e9f625315b2a26213acf94e957cb72c19eb051a2d4b66d`다. 백업의 실제 위치는 작업공간 `work/`이며 환경 변수나 키를 포함하지 않는다. 사전 비교에서 기존 100행의 원본 payload와 7개 대응 콘텐츠 필드는 native 파일과 모두 같았다.

`status`와 `source_order`의 추가·기존 행 보완은 별도 검토된 migration에서 처리한다. Importer는 DDL이나 migration을 실행하지 않는다. 실행 전 실제 migration 적용 여부를 확인해야 한다.

| DB 필드 | 역할과 보존 규칙 |
|---|---|
| `id uuid` | 기존 서버 생성 PK 보존. 새 행에서도 importer가 UUID를 지정하지 않음 |
| `source_key text unique` | native 행은 `praytime:ko:guide_001` 형식. 중복 import 방지 기준 |
| `title text` | 최초 `title_kr`, 이후 CMS가 독립 편집 |
| `content text` | 최초 `prayer_kr`, 이후 CMS가 독립 편집 |
| `category text` | 최초 원본 짧은 분류 |
| `category_full text` | 최초 원본 전체 분류 |
| `keyword text` | 최초 `keyword_kr` 단일 문자열 |
| `scripture_ref text` | 원본 참조 표기. UNIQUE 아님 |
| `scripture_text text` | 최초 `scripture_kr`. 참조별 병합하지 않음 |
| `language text` | 한국어 native 행은 `ko` |
| `image_path text nullable` | 별도 CMS 이미지 선택. native에는 이미지 없음 |
| `source_payload jsonb` | native 행은 원본 8개 필드의 불변 provenance. 새 CMS 행의 최초 snapshot·재전송 확인 정보도 관리자 서버 내부에만 보존 |
| `source_order integer nullable` | native 배열 인덱스 0–99. CMS 직접 작성 행은 nullable |
| `status text` | `draft` 또는 `published`; 기본 `draft` |
| `created_at`, `updated_at` | 기존 값·갱신 동작 보존. `updated_at`은 게시 시 낙관적 경합 검사에도 사용 |

CMS 변경 API는 원본 `source_key`와 `source_payload`를 사용자 편집 필드로 받지 않는다. 공개 목록·상세에는 `published` 콘텐츠만 노출한다. 원본 provenance와 서버 키를 브라우저 응답에 포함하지 않는다.

새 CMS 작성 행의 `source_key`는 `praytime:ko:cms_<clientRequestUUID>`이며 payload의 `id`는 `cms_<clientRequestUUID>`다. 이 행의 최초 8개 콘텐츠 필드 snapshot에는 내부 재전송 검증용 `_cms_create_image_sha256`, `_cms_create_image_mime` 두 필드가 추가된다. 이미지는 `sha256(MIME + NUL + 원본 bytes)`로 비교하며 무표지 요청이면 두 값 모두 null이다. 같은 요청 ID에 다른 표지를 보내면 409로 거부하고 같은 요청만 재전송 성공으로 처리한다. 이 내부 필드도 API 응답에서는 제외하고 PATCH에서 변경하지 않는다. **Native 100행의 payload는 8개 원본 필드 그대로이며 이 내부 필드를 추가하지 않는다.**

## 손실 없는 대응

| Native 필드 | 웹 대응 |
|---|---|
| `id` | `source_key`의 `praytime:ko:` 뒤 식별자, 그리고 `source_payload.id` |
| `category` | `category`, `source_payload.category` |
| `category_full` | `category_full`, `source_payload.category_full` |
| `title_kr` | `title`, `source_payload.title_kr` |
| `keyword_kr` | `keyword`, `source_payload.keyword_kr` |
| `scripture_ref` | `scripture_ref`, `source_payload.scripture_ref` |
| `scripture_kr` | `scripture_text`, `source_payload.scripture_kr` |
| `prayer_kr` | `content`, `source_payload.prayer_kr` |

원본 ID는 UUID로 강제 변환하지 않는다. 텍스트는 원래 공백·문장부호·한글 코드 포인트를 그대로 보존하며 현재 길이의 최댓값을 미래 CMS 콘텐츠의 길이 제한으로 삼지 않는다. `source_order`는 `guide_NNN`의 숫자에서 1을 뺀 값이다.

## 실행 환경

Node.js 24.x와 lockfile의 기존 `@supabase/supabase-js`를 사용한다. 별도 패키지나 Supabase CLI가 필요하지 않다.

서버 환경 변수는 저장소 루트의 Git-ignored `.env.local` 또는 프로세스 환경에만 둔다. Node 내장 `process.loadEnvFile()`로 파일을 읽으며 실제 값은 로그에 출력하지 않는다.

```dotenv
PRAYER_SUPABASE_URL=https://cibcyeyznfmywacfiokh.supabase.co
PRAYER_SUPABASE_SECRET_KEY=
```

키는 `sb_secret_` 형식의 서버 키 또는 기존 `service_role` JWT만 허용한다. `NEXT_PUBLIC_` 환경 변수를 사용하지 않는다. 기존 사전예약의 `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_ANON_KEY`는 읽거나 대체하지 않는다.

읽기 전용 dry-run을 포함해 연결 대상은 위 Mission 6 기도 콘텐츠 URL 하나로 제한한다. Mission 5 프로젝트, HTTP, 사용자 정보가 들어간 URL, 경로·query·hash가 붙은 URL은 거부한다. 프로젝트 우회 옵션은 없다.

## 명령

저장소 루트에서 실행한다.

```bash
# 파일·해시·100개 구조만 검사. 환경 파일·DB·네트워크에 접근하지 않음.
node scripts/import-prayers.mjs --validate-only

# 기본 동작: 자격 증명이 있으면 기존 행을 읽고 계획만 출력. 쓰기 없음.
node scripts/import-prayers.mjs
node scripts/import-prayers.mjs --dry-run

# 게시 계획까지 읽기 전용으로 확인.
node scripts/import-prayers.mjs --dry-run --publish

# 명시적 쓰기: 없는 native 행만 새 draft로 추가.
node scripts/import-prayers.mjs --apply

# 명시적 게시: 새 행은 published, 기존의 원본과 정확히 같은 draft는 상태만 게시.
node scripts/import-prayers.mjs --apply --publish
```

자격 증명이 전혀 없는 기본 dry-run은 파일 감사만 수행하고 `database: NOT_CHECKED_NO_CREDENTIALS`를 출력한다. 이 결과로 DB에 100개가 존재한다고 주장하지 않는다. `--apply`는 두 서버 환경 변수가 없으면 실패한다. 하나만 있는 부분 설정도 거부한다.

## 재실행·수정·경합 처리

1. DB 연결 전에 고정 원본 SHA256과 strict 8필드·100건·ID 순서·카테고리 개수를 검사한다.
2. `source_key`가 `praytime:ko:`로 시작하는 콘텐츠만 정렬된 500행 단위로 읽는다. 다른 콘텐츠는 변경하거나 삭제하지 않는다.
3. 동일 `source_key`의 payload, 7개 대응 콘텐츠 필드, `language`, `source_order`가 같으면 기존 UUID를 유지하고 skip한다.
4. CMS 편집, provenance 차이, 순서 차이, 중복 source key가 있으면 필드명만 conflict로 보고한다. **Conflict가 하나라도 있으면 apply 쓰기를 시작하지 않는다.** 원문이나 CMS 편집을 자동 복구하지 않는다.
5. 없는 행만 `onConflict: source_key`, `ignoreDuplicates: true`로 삽입한다. 감사된 native 파일은 100행이므로 한 번의 INSERT statement에 들어가며 이 삽입 자체는 원자적이다. 동시 생성된 같은 source key도 기존 행을 업데이트하지 않는다.
6. `--publish`를 명시하면 원본과 정확히 같은 기존 draft에 `{status: published}`만 전송한다. `id`, `source_key`, 읽었던 `updated_at`, 현재 `status: draft`가 모두 같을 때만 적용한다. 제목·기도문·payload·이미지는 이 UPDATE에 포함하지 않는다. 기존 published 상태를 draft로 되돌리지 않는다.
7. 게시에는 테이블의 `updated_at` 자동 갱신이 전제된다. 다른 CMS 편집이 먼저 일어나면 낙관적 조건이 맞지 않아 해당 행을 덮어쓰지 않는다. 게시 UPDATE는 행별로 실행되므로 중간 실패 시 일부 게시가 끝났을 수 있다. 실제 카운터와 후검증을 확인하고 재실행한다.
8. 적용 뒤 다시 읽어 native 100행의 존재, payload, 대응 필드, 순서를 검증한다. 경쟁 중 추가·편집된 행도 후검증에서 확인한다. 게시 요청 시 아직 남은 원본 draft도 검증한다.

이미지를 추가하거나 게시 상태를 바꾸는 것은 native 텍스트 편집이 아니므로 원본 투영 비교에서 제외한다. `--publish`가 없으면 기존 상태는 바뀌지 않는다. CMS에서 seed 행을 실제 삭제했다면 나중의 `--apply`는 해당 source key를 없는 행으로 판단해 다시 추가한다.

## 출력과 종료 코드

콘솔에는 JSON 요약만 출력하며 SDK 원문 오류·키·환경 변수 값·서버 내부 메시지는 출력하지 않는다. `--help`만 사용법 텍스트를 출력한다.

- `created`: 이번 실행에서 삽입 응답으로 확인한 행 수.
- `published`: 이번 실행에서 상태 변경 응답으로 확인한 기존 행 수.
- `unchanged`: 검증된 기존 행 중 이번 실행에서 삽입·게시하지 않은 수.
- `conflicts`: 원본 또는 CMS 내용이 달라 자동 처리를 보류한 수.
- `failed`: 후검증에서 없는 native 행 또는 게시가 남은 exact draft 수. 초기 설정·검증 실패 시 오류 요약의 1은 행 실패 건수가 아닌 명령 실패 표시다.
- `planned_create`, `planned_publish`: 사전 읽기에서 계산한 계획. 오프라인 감사는 `null`.
- `verification.exact`: native 100행의 원본 대응이 모두 정확한지 여부.
- `verification.publication_complete`: 게시 요청 후 아직 남은 exact draft가 없는지 여부.

종료 코드 `0`은 요청된 검증·적용 성공, `2`는 사전 conflict로 무변경 보류, `1`은 설정·검증·쓰기·후검증 실패다. 네트워크 응답이 유실된 쓰기는 실제 적용 여부가 불확실할 수 있으므로 후검증과 재실행 결과를 함께 확인한다. 실패 시 자동 DELETE나 내용 덮어쓰기 rollback은 수행하지 않는다.

구현은 현재 고정 SDK의 [upsert/ignoreDuplicates](https://supabase.com/docs/reference/javascript/upsert)와 정렬된 [range pagination](https://supabase.com/docs/reference/javascript/range)을 사용한다. 실제 live import 실행 여부·첫 실행과 재실행 카운터는 별도의 최종 QA 결과에만 기록한다.
