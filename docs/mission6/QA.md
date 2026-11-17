# Mission 6 QA · 2026-11-17

현재 통합 검증 기록이다. 과거 미션 5/STEP 1 PASS, UI의 intercepted 응답,
실제 Supabase 결과를 구분한다. 계정 승인이 필요한 검사는 완료로 표시하지 않는다.

## 작업 기준과 보존

- 기준 SHA: `5d815a08365926566cc32c0a108634302e8e05b8`.
- 새 작업 브랜치: `feat/mission6-prayer-cms`.
- 이전 로컬 프로젝트는 Documents의 이동된 백업 폴더에서 clean 상태임을 확인했다.
  별도 새 작업 사본을 복제했으며 기존 미커밋 파일을 덮어쓰거나 삭제하지 않았다.
- 기존 랜딩에서는 `voluntary-prayer-section.tsx`의 기존 “기도 가이드” 문구만
  `/prayers` 링크로 연결했다. 문구·공간·모션과 기존 이미지/폰트는 유지했다.
- 미션 5 원본 저장소·PR·Production·Figma·native 파일·신청 DB는 수정하지 않았다.

## 실행한 코드 검사

| 검사 | 결과 | 근거 |
| --- | --- | --- |
| Node / npm | PASS | Node v24.22.0 / npm 11.19.1 |
| `npm ci` | PASS | lockfile 유지, 425 packages, audit 0 vulnerabilities |
| `npm run lint` | PASS | 종료 코드 0, warnings 0 |
| `npm run typecheck` | PASS | 종료 코드 0 |
| `npm run test` | PASS | 10 files / 129 tests |
| `npm run build -- --webpack` | PASS | 최종 UI 수정 후 다시 빌드; 모든 신규 라우트·Proxy 생성 |
| `npm run import:prayers -- --validate-only` | PASS | 실제 JSON 100개, 8개 카테고리, SHA 일치; DB 접근 없음 |
| 기존 + 신규 Browser E2E | PASS · 실행 구분 | 최초 71 PASS/3 locator FAIL → 해당 3개 PASS; 최종 신규 7개 PASS |
| 실제 공개 CMS HTTP/브라우저 | PASS | 3107 실제 GET; 100개 원문/8분류/pagination 및 1440/393 체험 |

Unit에는 기존 60개, importer 14개, CMS/backend 55개가 포함된다.
CMS 검사는 공개 필드 whitelist/draft 404, 관리자 환경·Demo·공유 게이트·CSRF,
제목/본문·MIME/magic/2MB·실제 스트림 크기, 요청 지문, 중복·동시 수정 충돌,
업로드 보상 처리, DB 응답 유실·정리 실패 경고를 검증한다.

UI contract E2E는 API 응답을 명시적으로 intercept한다. 이 결과는 폼·표시·조작
계약의 증거이며 실제 DB CRUD/Storage 성공의 증거로 사용하지 않는다.
기존 랜딩·신규 UI 모두 runtime mock fallback은 없다.

첫 전체 Browser 실행에서 기존 67개는 모두 PASS였다. 신규 7개 중 3개는 전역 alert
locator가 Next route announcer도 찾는 strict locator 오류였으며 실제 main의 alert로
범위를 한정했다. 해당 3개 재실행과 마지막 빌드의 신규 7개는 모두 PASS였다.
한 번의 최초 전체 실행이 74/74 PASS였다고 표시하지 않는다.

실제 공개 QA는 전체 100개 native 투영·9개씩 페이지 분리·8개 분류 수·상세 3개·
없는 UUID 404·관리자 disabled 403·private payload 미노출을 확인했다. Desktop/Mobile
목록→상세→타이머 정지/재개→완료는 실제 CMS GET을 사용했다. 초기에 홈 자동 prefetch가
만든 unused-preload 진단을 발견해 새 화면의 홈 링크 prefetch만 끈 뒤 재검증했다.
최종 1440/393 각각 GET 4개 모두 200, console/pageerror/preload/쓰기/overflow 0건이다.
기존 랜딩 CSS는 변경하지 않았고 모바일 CMS 폼 패널 폭 보정은 새 scoped CSS만 수정했다.

## 실제 원본·DB·RLS

- iOS/Android/저장소 JSON은 89,690 bytes이며 완전히 동일하다.
  SHA256: `0b03acfc60e5f0c880286be194dea92860c1b575a1cc56a5664466f45cb6eb45`.
- 별도 PrayTime CMS의 기존 `public.prayers` 100개와 native payload/7개 매핑 필드의
  비교 결과 차이 0건이었다. UUID 100개·source_key 100개를 보존했다.
- 변경 전 전체 행 백업은 저장소 밖 `work/prayers-before-mission6-20261117.json`이다.
  백업 SHA256: `e8416e98485815aaf5e9f625315b2a26213acf94e957cb72c19eb051a2d4b66d`.
- CLI가 생성한 추가 migration을 연결 도구로 적용했다. `status`, `source_order`,
  정렬 인덱스·수정 시각 trigger·열 권한·공개 읽기 RLS만 추가/정비했다.
  테이블 재생성·본문 덮어쓰기·신청 데이터 접근은 없었다.
- migration 후: draft 100개, source_order 0–99 100개, UUID 고유 100개.
- 실제 publishable SDK 조회: HTTP 200, 공개 count 0. draft가 공개되지 않았다.
  private `source_payload` 직접 조회는 HTTP 401로 거부됐다.
- 실제 `pg_policies`에는 published 기도문 SELECT와 해당 이미지 SELECT 두 개만 있다.
  공개 INSERT/UPDATE/DELETE 정책은 없다. RLS를 해제하지 않았다.
- 보안 Advisor: migration 후 경고 0건.
- 이후 원본 JSON·payload·모든 매핑 필드가 일치하는 행만 조건부 SQL로 공개했다.
  verified native templates 100개, published 전환 100개. 기도문 내용/ID는 그대로다.
  이는 연결 도구로 수행한 공개 상태 변경이며 importer CLI 성공으로 계상하지 않는다.

## Import 실행 상태

원본 100개는 작업 시작 전에 이미 DB에 이관되어 있었다. 이번 작업에서는 그 일치와
원본 보존을 실제로 확인했고 재실행 가능한 importer를 구현했다.

- 로컬 원본 검증·멱등/충돌/게시 경합/후검증 테스트: PASS.
- 실제 서버 키를 사용하는 CLI dry-run / `--apply --publish` / 동일 명령 재실행: **PASS**.
  각 실행의 native scoped count 100, 원본 일치 100, unchanged 100,
  created/published/conflicts/failed 모두 0이었다. 이미 이관·공개된 행을 중복 생성하지 않았다.
- 기존 CMS 수정 행은 원본으로 덮어쓰지 않는다. 같은 source_key에 blind upsert하지 않는다.

## Storage와 관리자 실연결

기존 `prayer-covers` bucket은 private, 2MB, JPEG/PNG/WebP 제한임을 실제로 확인했다.
버킷/Storage metadata에 직접 쓰지 않았다. 업로드·정리 코드는 Storage API만 사용한다.

| 시나리오 | 현재 결과 |
| --- | --- |
| 서버의 Create/Read/Update/Delete 로직·실패 경로 | Unit PASS |
| 관리자 폼·삭제 취소·중복 클릭·409 입력 보존 | UI contract E2E PASS |
| 실제 관리자 HTTP 등록·새로고침·수정·삭제 | PASS · 별도 QA 콘텐츠 2개로 실연결 |
| 실제 대표 이미지 업로드·교체·삭제·DB 연결 | PASS · 실제 PNG 업로드/교체/정리와 signed GET 바이트 검증 |
| private bucket/업로드 제한/RLS 설정 | 실제 metadata 확인 PASS |

Supabase 관리 연결은 SQL을 실행할 수 있지만 서버 키 반환 도구는 없다.
기존 CLI 로그인이 없어 최초 키 설정은 인증 필요로 종료됐다. 이후 사용자의 공식 CLI
로그인 승인을 받아 서버 키를 값 출력 없이 ignored `.env.local`에 저장했다(권한 600).
첫 live 관리자 시도는 Next worker가 request URL을 localhost로 정규화하여 정상 브라우저
Origin을 403으로 거부하는 문제를 발견했다. 생성 전 차단되어 변경/잔여는 0이었다.
기존 모드/인증을 먼저 확인한 뒤 검증된 실제 Host로 CSRF origin을 비교하도록 수정하고,
악성 Host·port·위조 forwarded header 거부 테스트를 추가했다. 수정 후 실제 HTTP를 재검증했다.

최종 live 관리자 결과는 **73 PASS / 0 FAIL**이다. 생성한 QA 행 2개만 등록·조회·수정·게시·
재조회·삭제했고 실제 PNG 업로드·교체·기존 파일 삭제·이미지 제거·서명 URL의 원본 70바이트를
확인했다. 동일 요청 재전송은 200/중복 0, 변경 본문·이미지 재전송과 stale 수정/삭제는 409,
빈 값 400·잘못된 MIME/magic 415·2MiB 초과 413·Origin 누락 403을 실제 HTTP로 검증했다.
관리자 최신 수정일 정렬과 pagination도 실연결로 확인했다.
최종 전체 행 100개이며 기존 native 100개의 UUID·전체 기존 필드 해시가 같았다.
QA 행 잔여 0, 파일 잔여 0, SDK fallback 정리 0이었다. 전용 3108 서버는 종료했다.
실제 Storage 장애를 강제로 유발하지는 않았고 장애/응답 유실 보상 경로는 Unit으로 검증했다.

## 배포·평가자 접근

- 기존 Vercel CLI 저장 인증으로 프로젝트 조회를 시도했으나 HTTP 403이었다.
- 공식 Vercel CLI가 기존 refresh 인증을 갱신해 정상화했다. 별도 Mission 6 프로젝트를
  Node 24 / webpack build / Standard Deployment Protection으로 생성했다.
- 현재 Preview와 Production 관리자 모드는 disabled다. 서버 Secret은 Preview에만
  설정했다. 아직 배포하지 않았으므로 Vercel 실환경 전체 흐름은 **NOT RUN**이다.
- 보호된 Preview의 실제 접근 제한을 먼저 확인한 뒤 평가용 Demo 쓰기를 허용한다.
  기존 Mission 5 Production과 DNS는 변경하지 않는다.
- 접근 제한을 검증하지 못한 배포는 `CMS_ADMIN_MODE=disabled`로 유지한다.
  보호된 평가용 Preview만 Demo 확인·서비스 접근 제한·비공개 게이트 키로 허용한다.
- 배포 URL이나 평가용 비밀정보를 임의로 만들어 기록하지 않는다.

## 제한

실물 기기·Safari·FPS·모바일 네이티브 API 연동은 NOT RUN이다.
서명 이미지 URL은 만료까지 유효할 수 있다. Storage/DB 사이의 원자적 트랜잭션은
없으므로 보상 처리 실패/결과 불확실 경고는 운영자가 점검해야 한다.
설치 시 기존 ESLint 지원 종료와 fsevents 선택 설치 스크립트 안내가 있었으며,
잠금 버전·승인 설정을 임의로 바꾸지 않았다.
