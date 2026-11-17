# Native 기도문 JSON 감사

감사일: 2026-11-17. 실제 iOS·Android 파일을 읽었으며 native 프로젝트의 파일은 변경하지 않았다.

## 파일 위치와 동일성

사용자가 처음 지정한 아래 두 경로는 현재 존재하지 않는다.

- `/Users/codeit/Desktop/코드잇/PrayTime/PrayTime/Resources/prayer_guides_ko.json`
- `/Users/codeit/Desktop/코드잇/PrayTime/android/PrayTimeAndroid/app/src/main/assets/prayer_guides_ko.json`

파일명 검색으로 확인한 실제 프로젝트 루트는 다음과 같다. 경로의 한글은 macOS의 분해형 표기이며 `MacBook Air` 사이에는 원본 경로의 공백이 포함된다.

```text
/Users/codeit/Desktop/데스크탑 - 코드잇의 MacBook Air/코드잇/PrayTime
```

실제 읽은 파일은 이 루트 아래의 두 파일이다.

| 플랫폼 | 프로젝트 상대 경로 |
|---|---|
| iOS | `PrayTime/Resources/prayer_guides_ko.json` |
| Android | `android/PrayTimeAndroid/app/src/main/assets/prayer_guides_ko.json` |

두 파일은 파싱 결과뿐 아니라 **전체 바이트가 동일**하다. 저장소의 `data/prayer_guides_ko.json`도 native iOS 파일의 바이트를 그대로 복사했다.

| 항목 | 결과 |
|---|---|
| 크기 | 각 89,690 bytes |
| 인코딩 | UTF-8, BOM 없음 |
| 파일 끝 개행 | 없음; 복사본에서도 유지 |
| SHA256 | `0b03acfc60e5f0c880286be194dea92860c1b575a1cc56a5664466f45cb6eb45` |
| iOS ↔ Android 바이트 차이 | 0 |
| 최상위 | 객체 100개 배열 |
| ID | `guide_001` … `guide_100`, 원본 배열 순서대로, 100개 고유 |
| 객체 키 | 모든 레코드에 같은 8개 필드; 추가·누락·중복 JSON 키 없음 |
| 값 검증 | 전부 비어 있지 않은 string; null 없음 |

## 전 필드

문자 길이는 Unicode 문자열의 문자 수다. 현재 내용은 모두 NFC이며 앞뒤 공백·개행은 없다. Importer는 이러한 특징을 이용해 문자열을 변환하지 않는다.

| 원본 필드 | 타입 | 고유값 | 길이 최소–최대 | 의미 |
|---|---|---:|---:|---|
| `category` | string | 8 | 1–4 | 짧은 분류 이름 |
| `category_full` | string | 8 | 6–15 | 원래의 긴 분류 이름 |
| `title_kr` | string | 100 | 21–41 | 한국어 제목 |
| `keyword_kr` | string | 63 | 1–3 | 단일 한국어 키워드 |
| `scripture_ref` | string | 89 | 6–13 | 성경 구절 참조 표기 |
| `scripture_kr` | string | 90 | 21–73 | 원본에 수록된 성경 구절 텍스트 |
| `prayer_kr` | string | 100 | 170–239 | 기도문 본문 |
| `id` | string | 100 | 9 | native 식별자 |

원본에는 UUID, 배열형 keywords, 이미지, 오디오, 작성 시각, 수정 시각, 게시 상태가 없다. 웹의 CMS 메타데이터를 native 필드로 오인하지 않는다.

## 카테고리

아래 순서는 native 배열에서 처음 등장한 순서다. 기도문 배열 자체는 카테고리별로 묶여 있지 않으므로 `source_order`로 원래 순서를 따로 보존한다.

| category | category_full | 개수 |
|---|---|---:|
| 마음 | 마음 관리 & 멘탈 케어 | 17 |
| 디지털 | 디지털 라이프 & 소비 습관 | 8 |
| 관계 | 인간관계 & 소통 | 19 |
| 일·성장 | 일터 & 학업 & 자기계발 | 18 |
| 신앙 | 신앙 & 영적 성숙 | 21 |
| 공동체 | 공동체 & 사회 | 6 |
| 돈 | 돈 & 현실 | 6 |
| 사명 | 영향력 & 사명 | 5 |
| 합계 | | 100 |

`category`와 `category_full`은 현재 일대일 관계다. 둘 중 하나를 버리거나 슬래시·앰퍼샌드·가운뎃점을 바꾸지 않는다.

## 내용 보존에 필요한 예외

`scripture_ref`는 고유 키가 아니다. 특히 같은 `사도행전 4:29`에도 원본 텍스트 두 종류가 있다.

| Native ID | scripture_kr |
|---|---|
| `guide_038` | 주님... 주님의 종들이 하나님의 말씀을 담대하게 말할 수 있게 해주십시오. |
| `guide_075` | 주님의 종들이 하나님의 말씀을 담대하게 말할 수 있게 해주십시오. |

참조별로 본문을 합치거나 임의로 통일하면 원본이 손실된다. 89개 참조와 90개 구절 텍스트는 그대로 유지한다. 이 감사는 native 파일의 내용과 구조를 확인한 것이며 특정 성경 번역본의 인용 정확성을 새로 검증한 결과는 아니다.

## 저장과 가져오기 검증

- `data/prayer_guides_ko.json`은 원본 바이트 스냅샷이다. 고정 SHA256이 다르면 importer는 연결 전에 중단한다.
- 8개 필드, 각 string의 비어 있지 않음, ID 고유성·순서, 8개 카테고리와 건수를 검사한다.
- `source_payload`에는 원본 8개 필드를 값 변경 없이 저장한다. JSONB 객체의 키 표시 순서는 원본 파일의 바이트 보존과 별개다.
- CMS 필드를 원본 8개 필드로 다시 투영해 문자열을 정확히 비교한다. trim, Unicode 정규화, 요약, 재번역, 키워드 분할을 하지 않는다.
- CMS가 편집한 제목·기도문·분류·키워드·성경 구절은 기존 `source_payload`와 독립적이다. 재가져오기에서는 이를 conflict로 보고하고 자동 덮어쓰지 않는다.
- native 원본이나 Mission 5 `beta_signups` 데이터는 이 importer의 대상이 아니다.

실제 로컬 검증·DB 실행 결과는 실행한 범위만 최종 QA 문서에 기록한다. 이 문서의 원본 감사 결과를 DB import 성공으로 간주하지 않는다.
