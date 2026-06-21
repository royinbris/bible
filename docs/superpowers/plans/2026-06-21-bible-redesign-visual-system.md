# 성경 앱 재디자인 — 비주얼 시스템 (Plan A) 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** "따뜻한 종이(A)" 디자인 방향의 색·타이포 토큰을 도입하고, 읽기 화면과 주요 화면을 새 토큰으로 재디자인한다. 연속 연결 스크롤(앱 핵심)은 그대로 유지한다.

**Architecture:** `src/index.css`의 CSS 변수(`:root` / `[data-theme='dark']`)를 새 팔레트로 교체하는 것을 1차 수단으로 한다. 코드가 이 변수들을 광범위하게 참조하므로(`--text-color` 95회 등) 변수 교체만으로 대부분 화면이 바뀐다. 그다음 변수를 따르지 않는 하드코딩 색상을 변수로 치환한다.

**Tech Stack:** React 19 + Vite, react-router-dom 7, 순수 CSS 변수 테마(이미 존재하는 `data-theme` 토글). Playwright e2e(`npm run test:e2e`).

## Global Constraints

- 라우트 경로·데이터 로직(미사 API, 한권읽기, TTS, localforage)은 변경하지 않는다.
- 설정 시트의 모든 조절 항목(테마·언어·글자 크기·두께·줄간격·구절 간격·여백·글꼴)을 유지한다. 새 값은 기본값일 뿐 사용자 설정이 우선.
- 읽기 화면은 모든 장이 끊김 없이 하나로 연속 스크롤된다(앱의 핵심). 장 분리 네비게이션을 추가하지 않는다.
- 라이트/다크 양쪽 모두에서 동작해야 한다.
- 기능 추가 없음. 순수 디자인.
- 이 프로젝트엔 단위 테스트 러너가 없다. 검증은 `npm run lint`, `npm run build`, `npm run test:e2e`, 그리고 `npm run dev` 육안 확인으로 한다.
- 커밋은 각 Task 끝에서 수행하되, 커밋 메시지는 한국어로 작성한다.

## 토큰 정의 (전 Task 공통 참조)

### 라이트 (`:root`)
| 변수 | 새 값 |
|------|-------|
| `--bg-color` | `#F4EEE3` |
| `--text-color` | `#3B322A` |
| `--text-muted` | `#A8987F` |
| `--primary-color` | `#9C5A38` |
| `--secondary-bg` | `#FBF7F0` |
| `--border-color` | `rgba(156,90,56,0.14)` |
| `--bible-card-bg` | `#FBF7F0` |
| `--header-bg` | `rgba(244,238,227,0.9)` |
| `--accent-soft` | `#C08A4E` (신규) |
| `--chapter-num` | `#C99B6A` (신규) |
| `--highlight` | `#F3D9A8` (신규) |

### 다크 (`[data-theme='dark']`)
| 변수 | 새 값 |
|------|-------|
| `--bg-color` | `#21242B` |
| `--text-color` | `#F0EBE0` |
| `--text-muted` | `#8A7E63` |
| `--primary-color` | `#C9A24B` |
| `--secondary-bg` | `#2B2F37` |
| `--border-color` | `rgba(201,162,75,0.16)` |
| `--bible-card-bg` | `#2B2F37` |
| `--header-bg` | `rgba(33,36,43,0.9)` |
| `--accent-soft` | `#C9A24B` |
| `--chapter-num` | `#C9A24B` |
| `--highlight` | `rgba(201,162,75,0.25)` |

참고: `--text-muted`는 현재 `:root`에 정의돼 있지 않지만 코드에서 31회 참조된다(브라우저가 빈 값으로 처리 중). 이번에 정식 정의한다.

---

## Task 1: 라이트 모드 팔레트 토큰 교체

**Files:**
- Modify: `app/src/index.css:8-46` (`:root` 블록)

**Interfaces:**
- Produces: 위 "라이트" 표의 CSS 변수값. 이후 모든 Task가 이 변수를 사용.

- [ ] **Step 1: `:root` 변수값 교체**

`app/src/index.css`의 `:root` 블록에서 아래 값으로 변경하고 신규 3개를 추가한다.

```css
:root {
  --bg-color: #F4EEE3;
  --text-color: #3B322A;
  --text-muted: #A8987F;
  --primary-color: #9C5A38;
  --secondary-bg: #FBF7F0;
  --border-color: rgba(156, 156, 156, 0.14);
  --bible-card-bg: #FBF7F0;
  --header-bg: rgba(244, 238, 227, 0.9);
  --font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  --serif-font: 'Noto Serif KR', 'Nanum Myeongjo', serif;
  --font-size: 18px;
  --header-height: 64px;
  --card-radius: 20px;
  --card-shadow: 0 8px 24px rgba(0, 0, 0, 0.05);
  --status-bar-bg: var(--bg-color);

  --accent-soft: #C08A4E;
  --chapter-num: #C99B6A;
  --highlight: #F3D9A8;

  --nav-bg: #FBF7F0;
  --nav-border: rgba(156, 90, 56, 0.14);
  --nav-active-color: #9C5A38;

  --ot-bg: #FBF7F0;
  --ot-icon-bg: #FFFFFF;
  --ot-accent: #9C5A38;
  --nt-bg: #FBF7F0;
  --nt-icon-bg: #FFFFFF;
  --nt-accent: #9C5A38;
  --reading-bg: #F3E7D6;
  --reading-accent: #9C5A38;
  --mass-bg: #FBF7F0;
  --mass-icon-bg: #FFFFFF;
  --mass-accent: #9C5A38;
  --prayer-bg: #FBF7F0;
  --prayer-icon-bg: #FFFFFF;
  --prayer-accent: #9C5A38;
  --date-badge-bg: #EFE7D8;
  --date-badge-text: #9C5A38;
}
```

`--border-color`는 무채색 베이스로 두어 다양한 배경 위에서 자연스럽게 보이도록 한다.

- [ ] **Step 2: 빌드 확인**

Run: `cd app && npm run build`
Expected: 빌드 성공(에러 없음).

- [ ] **Step 3: 육안 확인**

Run: `cd app && npm run dev` 후 `http://localhost:5173/home` 접속.
Expected: 라이트 모드에서 배경이 크림색, 포인트가 점토색으로 바뀜. (섹션 강조색이 점토 계열로 통일)

- [ ] **Step 4: 커밋**

```bash
git add app/src/index.css
git commit -m "디자인: 라이트 모드 팔레트를 따뜻한 종이 토큰으로 교체"
```

---

## Task 2: 다크 모드 팔레트 토큰 교체

**Files:**
- Modify: `app/src/index.css:48-81` (`[data-theme='dark']` 블록)

**Interfaces:**
- Consumes: Task 1의 신규 변수 이름(`--accent-soft`, `--chapter-num`, `--highlight`).
- Produces: 위 "다크" 표의 CSS 변수값.

- [ ] **Step 1: 다크 블록 변수값 교체**

`[data-theme='dark']` 블록을 아래로 변경한다.

```css
[data-theme='dark'] {
  --bg-color: #21242B;
  --text-color: #F0EBE0;
  --text-muted: #8A7E63;
  --primary-color: #C9A24B;
  --secondary-bg: #2B2F37;
  --border-color: rgba(201, 162, 75, 0.16);
  --header-bg: rgba(33, 36, 43, 0.9);
  --card-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
  --status-bar-bg: var(--bg-color);

  --accent-soft: #C9A24B;
  --chapter-num: #C9A24B;
  --highlight: rgba(201, 162, 75, 0.25);

  --nav-bg: #1A1D23;
  --nav-border: rgba(201, 162, 75, 0.16);
  --nav-active-color: #C9A24B;

  --ot-bg: #2B2F37;
  --ot-icon-bg: #1A1D23;
  --ot-accent: #C9A24B;
  --nt-bg: #2B2F37;
  --nt-icon-bg: #1A1D23;
  --nt-accent: #C9A24B;
  --reading-bg: #2B2F37;
  --reading-accent: #C9A24B;
  --mass-bg: #2B2F37;
  --mass-icon-bg: #1A1D23;
  --mass-accent: #C9A24B;
  --prayer-bg: #2B2F37;
  --prayer-icon-bg: #1A1D23;
  --prayer-accent: #C9A24B;
  --date-badge-bg: #1A1D23;
  --date-badge-text: #C9A24B;
  --bible-card-bg: #2B2F37;
}
```

- [ ] **Step 2: 빌드 확인**

Run: `cd app && npm run build`
Expected: 빌드 성공.

- [ ] **Step 3: 육안 확인**

`npm run dev` → 설정에서 테마를 "다크"로 변경(또는 OS 다크모드) → 홈 확인.
Expected: 깊은 차콜 배경 + 은은한 금 포인트("어두운 성소").

- [ ] **Step 4: 커밋**

```bash
git add app/src/index.css
git commit -m "디자인: 다크 모드 팔레트를 어두운 성소 토큰으로 교체"
```

---

## Task 3: 읽기 화면 CSS 재정의 (세리프·위첨자 절번호·장 표시)

**Files:**
- Modify: `app/src/index.css:406-457` (`.verse-num`, `.verse-selected`, `.reader-subheading`, `.chapter-title`)

**Interfaces:**
- Consumes: `--accent-soft`, `--chapter-num`, `--highlight`, `--primary-color`, `--border-color`.

연속 스크롤 동작은 JSX(`loadMoreNext`/`loadMorePrev`)에 있고 이 Task는 CSS만 만지므로 핵심 동작은 영향받지 않는다.

- [ ] **Step 1: 절 번호를 위첨자 점토색으로**

`.verse-num` 규칙을 아래로 교체한다(하드코딩 `#78909c !important` 제거).

```css
.verse-num {
  display: inline;
  font-size: 0.62em;
  font-weight: 700;
  color: var(--accent-soft);
  vertical-align: super;
  line-height: 0;
  user-select: none;
  margin-right: 4px;
}
```

- [ ] **Step 2: 선택/형광펜 색을 토큰으로**

`.verse.verse-selected`와 다크 변형을 아래로 교체한다.

```css
.verse.verse-selected {
  background-color: var(--highlight) !important;
}

[data-theme='dark'] .verse.verse-selected {
  background-color: var(--highlight) !important;
}
```

- [ ] **Step 3: 소제목을 점토색·가운데 정렬로**

`.reader-subheading`와 다크 변형을 아래로 교체한다.

```css
.reader-subheading {
  color: var(--primary-color) !important;
  font-size: 0.92em !important;
  font-weight: 600 !important;
  font-family: var(--serif-font);
  letter-spacing: 0.04em;
  text-align: center;
  border-left: none;
  padding-left: 0;
  margin: 28px 0 14px 0;
  line-height: 1.4;
}

[data-theme='dark'] .reader-subheading {
  color: var(--primary-color) !important;
  border-left-color: transparent !important;
}
```

- [ ] **Step 4: 장 제목을 세리프·차분한 구분선으로**

`.chapter-title`와 다크 변형을 아래로 교체한다.

```css
.chapter-title {
  font-family: var(--serif-font);
  font-size: 1.5rem !important;
  font-weight: 700 !important;
  color: var(--text-color) !important;
  text-align: center !important;
  padding-bottom: 14px;
  border-bottom: 0.5px solid var(--border-color);
  margin-bottom: 28px !important;
  margin-top: 48px !important;
  display: block;
  min-width: 0;
}

[data-theme='dark'] .chapter-title {
  color: var(--text-color) !important;
  border-bottom-color: var(--border-color) !important;
}
```

- [ ] **Step 5: 빌드 확인**

Run: `cd app && npm run build`
Expected: 빌드 성공.

- [ ] **Step 6: 연속 스크롤 회귀 확인 (e2e)**

Run: `cd app && npm run test:e2e`
Expected: 기존 e2e 통과(읽기/스크롤 관련 테스트 그대로 동작).

- [ ] **Step 7: 육안 확인**

`npm run dev` → `/read/1/1` 접속 → 아래로 스크롤.
Expected: 세리프 본문, 작은 점토색 위첨자 절번호, 가운데 장 제목, 다음 장이 끊김 없이 이어짐.

- [ ] **Step 8: 커밋**

```bash
git add app/src/index.css
git commit -m "디자인: 읽기 화면 세리프·위첨자 절번호·장 표시 재정의"
```

---

## Task 4: Reader.jsx 인라인 하드코딩 색상 토큰화

**Files:**
- Modify: `app/src/pages/Reader.jsx:1120-1128` (verse-num 인라인 color), `app/src/pages/Reader.jsx:1124` (선택색)

**Interfaces:**
- Consumes: `--accent-soft`, `--highlight`.

- [ ] **Step 1: verse-num 인라인 색상을 토큰으로**

`Reader.jsx`의 verse-num `<span>` 인라인 스타일에서 하드코딩 색을 토큰으로 바꾼다.
현재:

```jsx
                      style={{ 
                        fontSize: `calc(${settings.fontSize}px - 2px)`,
                        color: isSelected ? '#808000' : '#78909c' 
                      }}
```

변경 후(위첨자는 CSS에서 처리하므로 인라인 fontSize 제거, 색만 토큰으로):

```jsx
                      style={{ 
                        color: isSelected ? 'var(--primary-color)' : 'var(--accent-soft)' 
                      }}
```

- [ ] **Step 2: 변경으로 생긴 미사용 없음 확인 + 린트**

Run: `cd app && npm run lint`
Expected: 신규 에러 없음.

- [ ] **Step 3: 빌드 확인**

Run: `cd app && npm run build`
Expected: 빌드 성공.

- [ ] **Step 4: 육안 확인**

`/read/1/1`에서 절을 탭해 선택 → 절번호 색이 점토 포인트로, 형광펜이 따뜻한 노랑(`--highlight`)으로.

- [ ] **Step 5: 커밋**

```bash
git add app/src/pages/Reader.jsx
git commit -m "디자인: 읽기 화면 절번호 인라인 색상 토큰화"
```

---

## Task 5: 홈 화면 인라인 색상 토큰화 + 강조색 통일

**Files:**
- Modify: `app/src/pages/Home.jsx` (섹션별 하드코딩 색상 `rgba(240,140,0,0.1)`, `var(--mass-accent,#8b5cf6)` 폴백, `var(--prayer-accent,#14b8a6)` 폴백, `var(--reading-accent-pink)` 등)

**Interfaces:**
- Consumes: `--primary-color`, `--text-muted`, `--secondary-bg`, `--border-color`, `--highlight`.

- [ ] **Step 1: 섹션 헤더 아이콘/링크 색을 점토로 통일**

`Home.jsx`에서 각 섹션(`한권읽기`/`미사`/`기도`)의 `stroke`·링크 `color`에 들어있는 하드코딩 폴백(`#8b5cf6`, `#14b8a6` 등)을 모두 `var(--primary-color)`로 통일한다. 예:

```jsx
stroke="var(--primary-color)"
```
```jsx
style={{ ..., color: 'var(--primary-color)', ... }}
```

미사 독서 뱃지의 분기 색상(`reading.type.includes('복음') ? 'var(--reading-accent-pink)' : 'var(--ot-accent)'`)도 단일 `var(--primary-color)`로, 뱃지 배경은 아래로 바꾼다.

```jsx
                    color: 'var(--primary-color)',
                    backgroundColor: 'var(--date-badge-bg)',
```

- [ ] **Step 2: 카드 배경/완료 뱃지 토큰화**

한권읽기 완료 뱃지 `backgroundColor: 'rgba(240, 140, 0, 0.1)'` → `'var(--date-badge-bg)'`, 그 글자색 → `'var(--primary-color)'`. 카드 컨테이너에 표면색이 필요하면 `var(--secondary-bg)` 사용.

- [ ] **Step 3: 린트 + 빌드**

Run: `cd app && npm run lint && npm run build`
Expected: 신규 에러 없음, 빌드 성공.

- [ ] **Step 4: 육안 확인 (라이트+다크)**

`/home`에서 세 섹션의 포인트가 점토(라이트)/금(다크)으로 통일됐는지 확인.

- [ ] **Step 5: 커밋**

```bash
git add app/src/pages/Home.jsx
git commit -m "디자인: 홈 화면 색상 토큰화 및 강조색 점토 계열 통일"
```

---

## Task 6: 미사·기도·검색·한권읽기 화면 하드코딩 색상 토큰화

**Files:**
- Modify: `app/src/pages/DailyMass.jsx`, `app/src/pages/PrayersList.jsx`, `app/src/pages/PrayersDetail.jsx`, `app/src/pages/Search.jsx`, `app/src/pages/BibleReadingPlan.jsx`

**Interfaces:**
- Consumes: 공통 토큰(`--primary-color`, `--text-color`, `--text-muted`, `--secondary-bg`, `--border-color`, `--highlight`).

이 Task는 화면이 많으므로 파일별로 나눠 커밋한다. 각 파일에서 하드코딩 hex/rgba/네온 폴백 색을 의미에 맞는 토큰으로 치환한다. 색이 "포인트/강조"면 `--primary-color`, "보조 텍스트"면 `--text-muted`, "표면"이면 `--secondary-bg`, "경계"면 `--border-color`.

- [ ] **Step 1: 대상 색상 목록 추출**

Run:
```bash
cd app && grep -nE "#[0-9a-fA-F]{3,6}|rgba?\(" src/pages/DailyMass.jsx src/pages/PrayersList.jsx src/pages/PrayersDetail.jsx src/pages/Search.jsx src/pages/BibleReadingPlan.jsx
```
Expected: 치환 대상 라인 목록. (TTS 진행바 같은 기능적 색은 유지 가능 — 의미 없는 브랜드 네온만 토큰화)

- [ ] **Step 2: DailyMass 치환 + 커밋**

하드코딩 색을 토큰으로 치환.
Run: `cd app && npm run build`
```bash
git add app/src/pages/DailyMass.jsx
git commit -m "디자인: 미사 화면 색상 토큰화"
```

- [ ] **Step 3: PrayersList + PrayersDetail 치환 + 커밋**

```bash
git add app/src/pages/PrayersList.jsx app/src/pages/PrayersDetail.jsx
git commit -m "디자인: 기도 화면 색상 토큰화"
```

- [ ] **Step 4: Search + BibleReadingPlan 치환 + 커밋**

```bash
git add app/src/pages/Search.jsx app/src/pages/BibleReadingPlan.jsx
git commit -m "디자인: 검색·한권읽기 화면 색상 토큰화"
```

- [ ] **Step 5: 전체 회귀 (e2e)**

Run: `cd app && npm run test:e2e`
Expected: 기존 e2e 통과.

- [ ] **Step 6: 라이트/다크 육안 점검**

각 화면(`/mass`, `/prayers`, `/search`, `/plan`)을 라이트·다크에서 훑어 가독성·일관성 확인. 대비가 부족한 곳은 토큰 단계(예: 텍스트는 `--text-color`) 조정.

---

## 후속(별도 계획): 네비게이션 단순화 (Plan B)

`App.jsx`의 `GlobalBottomBar`(~1,200줄)는 네비게이션뿐 아니라 TTS·읽기기록·한권읽기·기도 하위모드(추천/목록/검색/관리)·설정을 함께 담고 있어, 4탭으로 단순화하려면 이 하위 액션들의 새 위치(화면 상단/인페이지 탭)를 먼저 설계해야 한다. 이는 본 비주얼 시스템과 독립적이므로 별도 스펙·계획으로 진행한다. 비주얼 재디자인을 먼저 배포해 확인한 뒤 착수 권장.

## Self-Review 메모

- 스펙 커버리지: 토큰(Task 1-2), 읽기 화면(Task 3-4), 홈/기타 화면 색상(Task 5-6) 커버. 네비게이션 단순화는 Plan B로 분리(스펙에 명시된 결정).
- 연속 스크롤 핵심: CSS만 만지는 Task들이라 JSX 무한 스크롤 로직 영향 없음. Task 3/6에 e2e 회귀 확인 포함.
- 설정 항목 유지: 색·기본값만 변경, 설정 휠/로직 미변경.
