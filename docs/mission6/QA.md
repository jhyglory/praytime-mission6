# Mission 6 QA · 2026-11-17

이 문서는 CMS 초기 통합 검증의 이력이다. 이후 연결한 실제 관리자 로그인과 현재
접근 흐름은 [서버 세션 검증](ADMIN_SESSION_QA.md)을 따른다.

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
- STEP 1 당시 확인한 원본 구현은 `6318f53`이며 독립 미션 6 기준선은 위 SHA다.
  최종 확인 시 원본 구현 브랜치의 추가 커밋 `6b47e77`(스타일 리팩터링)을 확인했다.
  이번 CMS 범위에 원본 재동기화는 포함되지 않으므로 이 리팩터링은 가져오지 않았다.

## 실행한 코드 검사

| 검사 | 결과 | 근거 |
| --- | --- | --- |
| Node / npm | PASS | Node v24.22.0 / npm 11.19.1 |
| `npm ci` | PASS | lockfile 유지, 425 packages, audit 0 vulnerabilities |
| `npm run lint` | PASS | 종료 코드 0, warnings 0 |
| `npm run typecheck` | PASS | 종료 코드 0 |
| `npm run test` | PASS | 최초 129개, 게이트 변경 후 10 files / 134 tests |
| `npm run build -- --webpack` | PASS | 최종 UI·Origin 수정 후 빌드; 모든 신규 라우트·Proxy 생성 |
| `npm run import:prayers -- --validate-only` | PASS | 실제 JSON 100개, 8개 카테고리, SHA 일치; DB 접근 없음 |
| 기존 + 신규 Browser E2E | PASS · 실행 구분 | 최초 71 PASS/3 locator FAIL → 해당 3개 PASS; 최종 신규 7개 PASS |
| 실제 공개 CMS HTTP/브라우저 | PASS | 3107 실제 GET; 100개 원문/8분류/pagination 및 1440/393 체험 |

최초 Unit에는 기존 60개, importer 14개, CMS/backend 55개가 포함된다.
사용자 지정 게이트 검사 5개 추가 후 전체 134개를 다시 실행해 통과했다.
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
- 보안 Advisor: migration 후와 최종 점검에서 모두 경고 0건.
  최종 DB는 전체/게시/native/source_key 고유 개수 각각 100개이며, private bucket의
  2,097,152-byte 제한과 JPEG/PNG/WebP 설정 및 두 SELECT 정책을 재확인했다.
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

이 절은 최초 통합 배포의 검증 이력이다. 현재 관리자 주소와 사용자 지정 접근 정보 변경은
아래 「관리자 접근 정보 변경」 기록을 따른다.

공식 Vercel CLI가 기존 refresh 인증을 갱신해 초기 403을 해결했다. 별도 Mission 6
프로젝트를 Node 24 / webpack build / Standard Deployment Protection으로 생성했다.
처음 CLI deploy의 기본 대상이 새 프로젝트의 Production이었으며, 확인 시 이미 READY였다.
이 초기 배포는 관리자 disabled·서버 Secret 미배치의 읽기 전용이었다. 이후 평가용 배포는
`--environment preview`를 명시했고, 쓰기 활성화 전에 실제 접근 제한부터 확인했다.
기존 Mission 5 Production·환경 변수·DNS는 수정하지 않았다.

| 배포 | 실행 코드 | 실제 결과 |
| --- | --- | --- |
| [공개 Production](https://praytime-mission6.vercel.app/) | `8b9c08d` | 기도 체험 공개, 관리자 disabled |
| 최초 보호된 Preview (현재 퇴역) | `8b9c08d` | 당시 Vercel 접근 제한 + 비공개 HTTP 게이트 + Demo CRUD |

Production deployment: `dpl_3h6E7G52uUnL1vmsq2eMCBF7RkB2`.
평가용 Preview deployment: `dpl_9qWUrpxSFibBXNxKUKwvadqzTnyA`.
공개 구현 코드의 전체 SHA: `8b9c08dec498eee6741d30f865d19938486283eb`.
최초 문서 마감 커밋 `1ae5203`은 실행 소스/에셋/lockfile을 변경하지 않았다.
이후 사용자 지정 관리자 게이트 변경은 아래 별도 검증 기록을 따른다.

- Preview 초기 disabled 배포에서 무인증 302, provider 접근 후 ADMIN_DISABLED 403,
  공개 실제 count 100을 확인한 뒤에만 보호된 Demo 모드를 활성화했다.
- 최종 Preview에서 무인증 302, provider 접근만 있으면 앱 401, 잘못된 Basic 키 401,
  두 제한을 통과하면 관리자 200/100개를 확인했다.
- **Vercel 실제 HTTP·DB·Storage 76/76 PASS**: 로컬 73개 시나리오와 접근 경계 3개.
  QA 행 2개만 생성·삭제했고, native 100개 전체 필드/UUID 해시 동일,
  QA 행 0/소유 파일 0/fallback 청소 0으로 복구했다.
- **Vercel 실제 Browser 32/32 PASS**: Mock 없이 실제 폼 등록·PNG 업로드·새로고침,
  수정/게시·공개 본문/이미지 반영·기도 타이머·완료·삭제 취소/확정·404를 확인했다.
  생성한 OWN UUID 1개만 사용했고 전체 100→100, 해당 Storage 파일 0개로 복구했다.
  Console/pageerror/warning/금지 요청은 0이었다.
- **공개 Production 실제 1440/393 PASS**: 실제 published 100개와 native 원문 일치,
  분류·페이지·상세·타이머·완료, 랜딩 8개 section/FAQ 7개/local font/원본 artwork,
  실제 PRAYER 진입 링크를 확인했다. 각 폭의 CMS GET 7개 모두 200,
  console/경고/쓰기/브라우저 저장/overflow/실패 응답은 0이었다.
- **Tablet 실제 6/6 PASS**: 768/1024의 공개 목록·보호 관리자 목록/등록폼에서
  패널/입력 9개/헤더/업로드 label/main H1/overflow/console을 GET-only로 확인했다.
- 공개 Production 관리자 화면/API GET과 관리자 POST는 403이었다.
  `/.env.local`, `/MISSION6_REVIEW_ACCESS.txt`는 404였다. 기존 Mission 5 HEAD는 200이었다.
- Provider 환경 변수 metadata에서 서버 Secret·게이트 키가 Preview 전용임을 확인했다.
  Production에는 공개 읽기 키만 있고 관리자 모드는 disabled다.
- 문서 마감 시 실제 키 5개를 기준으로 소스 578개·클라이언트 JS 46개를 검사하여
  키 일치 0건이었다. `.env.local`은 권한 600/ignored/untracked이며 비공개 평가 안내도 권한 600이다.
- 비공개 평가 링크가 접근 쿠키를 설정하고 앱 HTTP 게이트 401로 이동하는 것도 확인했다.
  링크·키는 저장소 밖 소유자용 안내 파일에만 저장했다. [공개 접근 안내](ACCESS.md).

스크린샷·진단 원본은 작업 디렉터리 `work/mission6-production-public`,
`work/mission6-vercel-ui`, `work/mission6-vercel-admin`, `work/mission6-tablet`에 보존했다.
검사 중 사용한 로컬 서버·브라우저는 모두 종료했고 기존 사용자 서버는 재사용하지 않았다.

## WBS 완료 상태

| ID | 작업 | 결과 |
| --- | --- | --- |
| W01 | 기존 코드·디자인 분석 | 완료 |
| W02 | 원본 기도 가이드·데이터 구조 | 완료 |
| W03 | 실제 Supabase 연결·기존 100개 보존 | 완료 |
| W04 | 관리자 목록·상세·등록 | 완료 |
| W05 | 수정·삭제·실제 영속성 | 완료 |
| W06 | private Storage 대표 이미지 | 완료 |
| W07 | 검증·상태·페이지네이션 | 완료 |
| W08 | 사용자 기도 체험 | 완료 |
| W09 | Preview 보호·공개 읽기 전용 배포 | 완료 |
| W10 | 실제 QA·README | 완료 |
| W11 | URL·평가 접근·제출 준비 | 완료 · 외부 과제 제출 자체는 하지 않음 |

## 제한

실물 기기·Safari·FPS·모바일 네이티브 API 연동은 NOT RUN이다.
서명 이미지 URL은 만료까지 유효할 수 있다. Storage/DB 사이의 원자적 트랜잭션은
없으므로 보상 처리 실패/결과 불확실 경고는 운영자가 점검해야 한다.
설치 시 기존 ESLint 지원 종료와 fsevents 선택 설치 스크립트 안내가 있었으며,
잠금 버전·승인 설정을 임의로 바꾸지 않았다.

## 관리자 접근 정보 변경 · 2026-11-17

사용자의 명시적 요청으로 평가용 HTTP 게이트의 사용자 이름과 비밀번호를 변경했다.
실제 값은 저장소 밖 비공개 접근 안내와 서버 전용 환경 설정에만 보관한다.
서버에는 비밀번호 원문 대신 `CMS_ADMIN_PASSWORD_SHA256`을 배치한다.
사용자 지정 설정이 있으면 기존 공유 키는 허용하지 않으며, 일부 설정만 있거나
형식이 잘못되면 403으로 차단한다. 사용자명·비밀번호 검사는 고정 길이 digest로 비교한다.

- 관리자 고정 주소: [관리자 Preview](https://praytime-mission6-admin.vercel.app/admin/prayers).
- 실행 코드: `7f70054`, Preview deployment: `dpl_HLW49z4HTByE1ozoPhcs88obTZJU`.
- Lint·Typecheck·webpack Build: PASS. 전체 Unit 10 files / 134 tests PASS.
  게이트 집중 검사 29개에는 새 자격 허용·이전 자격 거부·부분/잘못된 설정 차단이 포함된다.
- 새 배포 URL과 관리자 고정 주소에서 각각 실제 HTTP 13/13 PASS:
  provider 302·접근 정보 누락/이전 값/오답 401·새 자격 200·다른 Origin 쓰기 403,
  QA 전용 초안 등록·재조회·수정·삭제·404·공개 비노출을 확인했다. 각 실행은 100→100으로 복구했다.
- 고정 주소에서도 Vercel 접근 제한 302와 앱 게이트 401이 유지되는지 별도로 확인했다.
- 실제 브라우저 GET 8/8 PASS: 새 접근 정보로 관리자 200·실제 100개·등록폼 200,
  console/pageerror/warning/쓰기 시도 0. 브라우저는 종료했다.
- 이전 자격이 배포에 남아 있지 않도록 검증이 끝난 후 이전 관리자 Preview만 퇴역시켰다.
  공개 Production 및 기존 미션 5 배포·데이터는 변경하지 않았다.
- 실제 새 비밀번호·digest와 서버용 키를 소스 578개·클라이언트 JS 46개에서 검색해 일치 0건.
  실제 자격·전용 접근 링크를 공개 README나 Git에 기록하지 않았다.
- 원본 결과: 저장소 밖 `work/mission6-gateway-rotation-results.json`,
  `work/mission6-gateway-deployment-results.json`, `work/mission6-gateway-browser/results.json`.

## 삭제 확인창 중앙 정렬 · 2026-11-17

- 기존 실제 배포에서 기본 여백 초기화로 dialog의 computed margin이 0이며 x=0/y=0에
  표시되는 문제를 재현했다. 데스크톱·모바일 첫/마지막 행 4개에서 모두 확인했다.
- `.m6-dialog`에 viewport 기준 fixed/inset/margin과 내용 높이·최대 높이를 명시했다.
  기존 `<dialog>`와 삭제 확인·취소·포커스 처리 및 데이터 처리 코드는 그대로다.
- webpack Build PASS. 기존 삭제 확인·취소·삭제 후 새로고침 UI 계약 E2E 1개 PASS
  (API intercept; 실제 기도문을 삭제하는 테스트가 아님).
- 실제 Preview에서 1440×900·768×1024·393×852 첫/마지막 행 총 6개 모두
  화면 중심과의 가로·세로 오차 0px, viewport 안 표시, 취소/Escape·포커스 복귀 PASS.
  Console/error/warning/pageerror 및 쓰기 요청은 모두 0이다. 실제 데이터 삭제는 하지 않았다.
- 검증 후 관리자 고정 주소를 새 Preview `dpl_5mg53jMaccGNdqfXW66iFBtGnNNQ`
  (실행 코드 `60f63f1`)로 연결했다. 공개 Production과 미션 5 배포는 변경하지 않았다.
- 카테고리 문의도 읽기 전용으로 확인했다. 관리자/공개 100개의 category/category_full은
  native와 불일치 0이며 전체 8분류다. 기본 관리자 화면의 필터 값과 URL query는 비어 있고,
  실제 첫 페이지 10행에는 신앙·관계·마음·돈·일·성장 5분류가 표시되어 문의 현상은
  재현되지 않았다. 해당 사용자 화면의 URL/필터 상태를 요청했으며 데이터는 수정하지 않았다.
- 원본 결과와 캡처: 저장소 밖 `work/mission6-dialog-center/`.
