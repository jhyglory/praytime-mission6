# Mission 6 배포와 평가자 접근

## 공개 기도 체험

- [PrayTime Mission 6](https://praytime-mission6.vercel.app/)
- [기도 가이드](https://praytime-mission6.vercel.app/prayers)
- [개발 브랜치와 README](https://github.com/jhyglory/praytime-mission6/tree/feat/mission6-prayer-cms)

공개 Production은 실제 published 기도문을 읽지만 관리자 화면/API는 403으로 차단한다.
서버 Secret은 이 Production에 배치하지 않았다. 미션 6 데모의 기존 사전예약 저장은
disabled이며, 미션 5 원본 Production·신청 저장소는 변경하지 않았다.

## 보호된 평가용 관리자

[관리자 Preview](https://praytime-mission6-e2emx9f46-glorifier1.vercel.app/admin/prayers)는
별도의 비민감 Demo이다. 프로젝트 접근 제한과 서비스 HTTP 게이트를 모두 통과해야 한다.
사용자별 계정·회원가입·앱 로그인·역할 테이블을 구현한 것이 아니다.

실제 접근 검증:

| 요청 | 결과 |
| --- | --- |
| 아무 접근 정보 없음 | Vercel 인증으로 302 |
| Vercel 접근만 통과 | 앱 게이트 401 |
| 잘못된 앱 게이트 키 | 401 |
| 두 제한을 모두 통과 | 관리자 목록 200, 실제 100개 조회 |
| 공개 Production의 관리자 API | 403 |

평가용 링크·게이트 키는 저장소와 공개 README에 포함하지 않는다. 소유자에게 별도로
전달한 로컬 `MISSION6_REVIEW_ACCESS.txt`에만 안내한다. Supabase Secret/Service Role과
Vercel 계정 토큰은 이 안내에도 들어 있지 않다.

비공개 평가 링크는 브라우저에 프로젝트 접근 쿠키를 설정한 뒤 앱 HTTP 게이트로 이동한다.
게이트의 사용자 이름과 비밀번호는 비공개 안내를 따른다. 평가자는 앱 회원가입 없이
CRUD를 확인할 수 있다. 브라우저가 인증을 기억하면 새 비공개 창에서 다시 확인한다.

## 권장 평가 순서

1. 별도의 비민감 QA 기도문을 새로 등록한다. 기존 native 100개를 삭제할 필요가 없다.
2. 초안으로 저장하고 새로고침·관리자 상세·목록을 확인한다.
3. 제목·본문·카테고리·성경 구절을 수정하고 대표 이미지를 업로드한다.
4. 게시 상태로 변경하고 사용자 상세/목록에서 실제 반영을 확인한다.
5. 사용자 기도 시작·정지·계속·마치기·완료 화면을 확인한다.
6. 이미지 교체/제거와 게시 중지를 확인한다. 게시 중지와 영구 삭제는 다르다.
7. 생성한 평가용 콘텐츠만 확인 Dialog를 거쳐 삭제하고 재조회한다.

평가 완료 후 공유 접근을 회수하거나 게이트 키를 교체하려면 Mission 6 프로젝트의
Deployment Protection/Preview 환경 설정에서 처리하고 새 Preview를 배포한다.
미션 5 프로젝트, 원본 native 파일, 신청 데이터, 공개 RLS를 변경하지 않는다.

## 배포 설정

- Vercel 프로젝트: `praytime-mission6` (기존 Mission 5와 독립).
- Node 24.x, install `npm ci`, build `npm run build -- --webpack`.
- Preview는 Standard Deployment Protection을 실제 확인한 뒤에만 보호된 Demo 모드를 사용한다.
- Production의 관리자 모드는 disabled다. Header/query만으로 켤 수 없다.
- Preview 서버용 키·접근 키는 encrypted 환경 변수이며 브라우저에 전달하지 않는다.
- 사용자 지정 게이트는 `CMS_ADMIN_USERNAME`과 `CMS_ADMIN_PASSWORD_SHA256`으로 설정한다.
  비밀번호 원문이나 digest는 저장소·브라우저에 포함하지 않는다. 사용자 지정 값이
  설정되면 기존 `demo` 공유 키는 허용하지 않으며, 불완전한 설정은 접근을 차단한다.
- 실제 HTTP·Storage 검증과 정리 결과는 [QA](QA.md)를 따른다.
- 실행 코드 SHA: `8b9c08dec498eee6741d30f865d19938486283eb`.
- Preview 실제 API/Storage 76개·브라우저 32개, 공개 Desktop/Mobile 및 Tablet 6개 검증을 완료했다.

공식 운영 참고: [Vercel Deployment Protection](https://vercel.com/docs/deployment-protection),
[보호된 배포의 자동화 접근](https://vercel.com/docs/deployment-protection/methods-to-bypass-deployment-protection/protection-bypass-automation).
