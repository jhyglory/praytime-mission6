# PrayTime 미션 6 최종 완료 보고서

기준일: 2026-11-18 KST · 제출 마감: 2026-11-23

기존 랜딩을 보존하고 **관리자 기도문 CRUD → Supabase DB·Storage → 사용자 기도 체험**을 연결했다.
최종 제출용 구현 브랜치는 `feat/mission6-finalize`다. 이 문서는 초기 통합·로그인 단계의 과거 검증과
현재 최종 재검증을 구분한다. 실제 접근 비밀과 멘토 전용 링크는 공개 문서에 포함하지 않는다.

제출 기본 요구사항 1–8과의 대조 및 각 화면의 입력·행동·성공·실패는
[기능 명세](FEATURE_SPEC.md)에 정리했다. 완료 후 요구사항 재대조에서 여러 문서에 분산된
화면 명세를 한곳으로 모았으며, 이 보완은 실행 코드·DB·배포를 변경하지 않는다.

## A. 구현 결과

| WBS | 범위 | 상태 | 결과 |
| --- | --- | --- | --- |
| W01 | 기존 코드·디자인 분석 | 완료 | 기존 Next.js·토큰·폰트·에셋·신청 계약 보존 |
| W02 | 원본 기도 가이드·구조 설계 | 완료 | iOS·Android·저장소 JSON 100개/8개 필드/8분류 동일 |
| W03 | Supabase 연결 | 완료 | 별도 PrayTime CMS의 기존 prayers 재사용, 추가 migration·RLS |
| W04 | 목록·상세·등록 | 완료 | 실제 서버 조회·동적 라우트·검증·초안 등록 |
| W05 | 수정·삭제·영속성 | 완료 | 실제 DB 반영, 새로고침 유지, 충돌 보호·삭제 확인 |
| W06 | Storage 대표 이미지 | 완료 | private bucket, 업로드·교체·제거·파일 정리 |
| W07 | 폼·상태·페이지네이션 | 완료 | 빈 값·형식·2MB·중복·실패·빈 목록·404·최신 수정 정렬 |
| W08 | 사용자 기도 체험 | 완료 | 게시 콘텐츠만 목록·분류·상세·시작·일시정지·계속·완료 |
| W09 | 배포·접근 보호 | 완료 | 공개 읽기 전용, 별도 보호된 Demo 관리자 |
| W10 | QA·README | 완료 | 단위·UI 계약·실제 브라우저/DB/Storage 검증과 한계 구분 |
| W11 | 제출 준비 | 완료 | 보고서·구현 브랜치·접속 안내·검수 화면 정리 |

후속 요청으로 승인된 브랜드 로그인, 실제 서버 세션, 멘토 계정 및 전용 링크의 두 필드 자동 입력을
추가했다. 멘토 링크는 폼만 채우며 실제 로그인 버튼과 서버 자격 검증을 유지한다.
원래 미션에서 제외한 회원별 권한·정식 계정 관리·모바일 네이티브 개발은 확장하지 않았다.

## B. 주요 변경 파일과 이유

| 경로 | 목적 |
| --- | --- |
| `src/app/admin/prayers/**` · `src/components/prayers/` | 재사용 가능한 목록·폼·상세·삭제·상태 UI |
| `src/app/prayers/**` | 공개 기도 가이드·타이머·완료 화면 |
| `src/app/api/{admin/,}prayers/**` · `src/lib/prayers/` | 실제 DB·Storage 어댑터, 서버 검증·권한·오류 처리 |
| `src/app/admin/login/**` · `src/components/admin-login/` | 승인된 브랜드 폼과 실제 서버 세션 연결 |
| `src/lib/admin-login/` · `src/proxy.ts` | 보호된 Demo 로그인·입력용 grant와 관리자 경계 |
| `scripts/import-prayers.mjs` · `data/prayer_guides_ko.json` | 원본 보존·검증·멱등 Import |
| `supabase/migrations/20261117075425_mission6_prayer_cms.sql` | 기존 테이블을 보존한 추가 필드·제약·인덱스·RLS |
| `src/components/landing/voluntary-prayer-section.tsx` | 기존 기도 가이드 문구에 `/prayers` 링크만 연결 |
| `tests/` | CMS·Import·입력·세션·권한·UI 계약 검사 |
| `docs/mission6/` · `README.md` | 실행·접근·검증·제출 안내 |

이번 마감 단계에서는 애플리케이션 실행 코드를 변경하지 않았다. 최종 검증한 관리자 코드는
`6626ed7`, 공개 Production 코드는 `8b9c08dec498eee6741d30f865d19938486283eb`다.
마감 변경은 문서 정합성, 이 보고서와 검수용 캡처다.

기존 `globals.css`, 랜딩 페이지·레이아웃, 이미지·폰트, lockfile, 신청 backend는 기준선과 같다.
미션 5 저장소·PR·Production·신청 데이터·Figma 및 native 파일은 변경하지 않았다.

검수 화면:

| 화면 | 실제 캡처 |
| --- | --- |
| 공개 목록 Desktop | [1440px](screenshots/public-list-desktop.png) |
| 기도 타이머 Mobile | [393px](screenshots/prayer-timer-mobile.png) |
| 관리자 원본 100개 목록 | [1440px](screenshots/admin-list-desktop.png) |
| 멘토 두 필드 자동 입력 | [393px · 비밀번호 마스킹](screenshots/mentor-login-mobile.png) |

## C. 데이터베이스·Import·Storage

별도 PrayTime CMS 프로젝트의 기존 `public.prayers`를 사용한다.
원본 UUID·본문을 보존하며 테이블을 재생성하지 않았다.

| 항목 | 구조·상태 |
| --- | --- |
| 식별 | UUID `id`, unique `source_key`; native ID를 namespace 안에 보존 |
| 본문 | `title`, `content`, `category`, `category_full`, `keyword` |
| 성경·언어 | `scripture_ref`, `scripture_text`, `language` |
| CMS 메타데이터 | `status` draft/published, `image_path`, `created_at`, `updated_at` |
| 원본 보존 | private `source_payload`, native 배열용 `source_order` |
| 공개 권한 | published SELECT만, 공개 쓰기 불가·private payload 열 조회 불가 |
| Storage | `prayer-covers` private, 2,097,152 bytes, JPEG/PNG/WebP |

iOS·Android의 실제 파일은 macOS 분해형 디렉터리에서 다시 확인했다. 저장소 복사본과 각
89,690 bytes로 같으며 SHA256은 `0b03acfc60e5f0c880286be194dea92860c1b575a1cc56a5664466f45cb6eb45`다.
[실제 경로·필드 매핑](JSON_AUDIT.md) · [데이터 모델·이관 규칙](DATA_MODEL.md)

원본 100개는 이미 DB에 존재했고 기존 이관 단계에서 실제 `--apply --publish`와 재실행을 검증했다.
새 원본을 중복 생성한 것으로 표현하지 않는다. 이번에는 원본 검증·실제 read-only dry-run으로
내용 일치와 재실행 계획을 확인하며, native 행에 다시 쓰거나 덮어쓰지 않는다.

최종 실제 검증 후 전체/native/published/고유 source_key는 각각 100개, 카테고리는 8개다.
두 시도의 테스트 행은 모두 0개, Storage 객체도 기존과 같은 0개로 정리됐다.
원본 100개의 UUID·전체 기존 필드·타임스탬프를 포함한 DB 행 지문은 전후
`4db327b7fac76a1febdce1f5a67316f6`으로 같았다.
실제 Import dry-run은 unchanged 100, created/conflicts/failed/planned_create/planned_publish 0,
원본 투영 일치 100, 쓰기 0으로 종료했다.
보안·Health Advisor 경고는 각각 0건이며 prayers와 Storage objects의 RLS가 켜져 있다.
공개 INSERT/UPDATE/DELETE 정책은 없고 anon의 `source_payload` SELECT도 불가하다.

## D. QA

| 검사 | 결과·실행 범위 |
| --- | --- |
| 최신 Unit·Lint | 17 files / 328 tests PASS·Lint PASS. 바로 앞 단계와 실행 코드가 같아 해당 결과 재사용 |
| 이번 webpack Build·TypeScript | PASS, 신규 관리자·로그인·기도 라우트/Proxy 생성 |
| 이번 원본 `--validate-only` | PASS, 100개·8분류·SHA 일치, DB 쓰기 0 |
| 이번 Import 실제 dry-run | PASS, 서버 실연결·unchanged 100·중복/충돌/실패/쓰기 0 |
| 이번 runtime dependency audit | `npm audit --omit=dev --json` 0 vulnerabilities; dev 전체 audit 결과로 확대하지 않음 |
| 이번 UI 계약 E2E | 7/7 PASS, 21.4초. 전용 3116·비어 있는 backend 자격·명시적 API intercept |
| 이번 공개 Production 실제 흐름 | 1440/393px 랜딩→목록→상세→타이머 멈춤/계속→완료 PASS |
| 이번 추가 공개 화면 | 768/360px 목록·44px 분류 입력·가로 넘침 0 PASS |
| 이번 실제 관리자 CRUD·Storage | PASS, 별도 테스트 1행의 등록·수정·게시·이미지 교체/제거·UI 삭제·정리 |
| 최신 멘토 실제 로그인 | 1440/393px 두 값 자동 입력·버튼 클릭만 실제 인증 PASS |
| 공개 경계 | 관리자 페이지/API·session·mentor entry 403, 비밀 파일 4개 경로 404 |
| 실제 비밀값 검사 | 소스·문서·캡처 614개 및 client JS 50개에서 민감값 11개 발견 0 |

공개 Production은 실제 원문 100개·8분류·페이지 중복 없음·마음 17개를 확인했다.
콘솔/pageerror·실패 응답·쓰기·브라우저 저장·가로 넘침은 0이었다.
전용 브라우저와 3116 서버는 종료했다. 사용자 3000 서버를 재사용하지 않았다.

UI 계약 검사의 강제 빈 목록·503·409·저장 재시도·파일 검증은 합성 응답이며,
실제 Supabase 저장·이미지 정리의 증거와 구분한다. 최신 멘토 로그인/입력용 grant의
만료·변조·Host·쿠키·기존 소유자 세션 보존은 [별도 실제 검증](MENTOR_LINK_PREFILL.md)을 따른다.

이번 실제 관리자 검증의 첫 시도에서는 보조 포커스 검사를 기다리는 스크립트의 제한 시간이
초과돼 UI 삭제 단계 전에 안전 정리가 실행됐다. 앱 오류로 계상하지 않으며, 첫 기록을
보존하고 대기 없는 최종 시나리오로 재검증해 통과했다. 최종 제품 기능 실패는 0건이다.

최종 실제 관리자 실행은 멘토 전용 링크에서 두 필드를 채운 뒤 버튼 클릭만으로 로그인했다.
초안+PNG-A 등록 201 → 새로고침 유지·공개 404 → 제목/본문 수정+PNG-B 교체/게시 200 →
공개 1440/393px 본문·이미지 바이트 반영 → 이미지 제거/게시 중지·공개 404 →
삭제 취소·실제 UI 삭제 200 → 관리자 원본 100개 복구와 로그아웃을 확인했다.
최종 시도의 요청은 로그인 POST 1·기도문 POST 1·PATCH 2·기도문 DELETE 1·로그아웃 DELETE 1이며,
원본 행에 대한 쓰기는 0이었다. 이미지 A/B의 실제 Storage 메타데이터 교체·이전 파일 정리도 확인했다.
삭제 확인창은 1440/393px에서 중심 오차 x/y 각각 0px, 취소 버튼 초기 포커스와 트리거 복귀가 정상이다.
의도한 404 console 진단 4건 외 예상 밖 runtime/network/warning은 0이었고 브라우저는 종료했다.

실제 증거는 저장소 밖 `work/mission6-final/`의 `admin/FINAL_RESULTS.json`,
`admin/attempt2/results.json`, `database/{before,after}.json`, `import-dry-run.json`,
`public/{summary,qa-results,extra-widths}.json`, `ui-contract-results.json`에 보관한다.
실패한 첫 스크립트 실행은 `admin/attempt1/`에 별도로 남겨 최종 PASS와 혼합하지 않는다.

직접 검증하지 않은 항목: 실물 기기·Safari·OS 가상 키보드·FPS·분산 WAF 실제 429,
실제 Storage 장애/응답 유실 강제 주입, 네이티브 앱 API 연동. Storage 장애·응답 유실·
보상 처리의 코드 경로는 Unit 증거로만 구분한다. 웹 타이머는 OS SNS 차단이 아니며
개인 기도 내용·감정·사용자별 기도 기록을 서버에 저장하지 않는다.

초기 실제 HTTP/DB/Storage 73·Vercel HTTP 76·브라우저 32 검사는 [초기 QA](QA.md)의 이력이다.
이를 이번 마감 시점의 새 실행 수로 합산하지 않는다.

## E. 배포·제출 안내

- GitHub 완성 코드: [feat/mission6-finalize](https://github.com/jhyglory/praytime-mission6/tree/feat/mission6-finalize)
- 공개 웹: [PrayTime Mission 6](https://praytime-mission6.vercel.app/)
- 사용자 기도 체험: [기도 가이드](https://praytime-mission6.vercel.app/prayers)
- 관리자 일반 주소: [보호된 로그인](https://praytime-mission6-admin.vercel.app/admin/login)
- 관리자 최종 배포: `dpl_FnSgetB1N4TYVJovoL26G84rnczZ` / `6626ed7`.
- 공개 Production: `dpl_3h6E7G52uUnL1vmsq2eMCBF7RkB2` / `8b9c08d`.

**평가자는 비공개 접속 안내의 `ENTRY_URL`을 사용한다.** 일반 관리자 주소는 새 브라우저에서
Vercel 계정을 요구할 수 있다. 전용 링크를 열면 보호 쿠키 설정 후 아이디와 비밀번호가 채워지고
로그인 버튼만 누르면 된다. 이 링크는 2026-11-25 02:54:50 KST까지 유효하며 제출 마감 이후까지
사용할 수 있다. 실제 링크·비밀번호는 저장소 밖 `MENTOR_REVIEW_ACCESS.txt`에만 보관한다.

평가 순서: 공개 기도 체험 확인 → 멘토 전용 링크 로그인 → 별도 샘플 기도문 등록 → 새로고침 →
수정·이미지·게시/공개 반영 확인 → 게시 중지 → 삭제 확인/취소/실행 → 로그아웃.
원본 100개 대신 본인이 만든 샘플로 CRUD를 평가한다.

현재 필요한 CMS 키·Storage·접근 보호는 구성돼 있어 추가 서버 설정은 없다.
비공개 전용 링크를 평가자에게 전달하는 작업과 과제 플랫폼의 실제 제출은 사용자가 진행한다.
`main`은 STEP 1 기준선을 유지하므로, 제출 GitHub URL은 위 **구현 브랜치**를 사용한다.
기존 Production을 바꾸거나 main을 병합하지 않았다.

## F. 미션 7에 남길 작업

- 정식 관리자 개인 계정·초대/복구·역할·감사 기록. 현재 두 계정은 보호된 Demo용이다.
- 개별 세션 철회·장치별 로그아웃·분산 로그인 시도 제한. 현재 토큰은 최대 8시간이며 개별 철회가 없다.
- 실제 회원 기능과 사용자별 RLS/Storage 권한. 현재 published 콘텐츠 읽기 정책을 유지한다.
- iOS·Android의 읽기 API 계약·캐시·버전·오프라인 동기화. 이번 native 저장 방식은 변경하지 않았다.
- 콘텐츠 버전·발행 이력 및 DB/Storage 실패 복구 운영 절차.

계정 방식은 Supabase Auth 또는 서버 관리 세션을 별도 범위로 설계한다.
회원별 권한·개인정보 보관·모바일 OS 제어를 미션 6 완료 범위에 포함하지 않는다.
