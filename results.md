# 하단막대 버튼 점검 보고서

작성일: 2026-05-27  
점검 대상: `GlobalBottomBar` 컴포넌트 (App.jsx), 기본 메뉴 및 각 페이지별 개별 메뉴 버튼 전체

---

## 1. 기본 메뉴 (isIndividualMenu = false)

| 버튼 | 동작 | 상태 |
|------|------|------|
| 기도 | `navigate('/')` + 개별 메뉴 전환 | ✅ 정상 |
| 미사 | `navigate('/mass')` + 개별 메뉴 전환 | ✅ 정상 |
| 성경 | `navigate('/list/신약')` + 개별 메뉴 전환 | ✅ 정상 |
| 설정 | `setIsSettingsOpen(true)` | ✅ 정상 |
| ◉ (전환) | 개별 메뉴 열기 | ✅ 정상 |

### 기본 메뉴 발견된 문제점

#### 🔴 문제 1: 기도 버튼 — `isIndividualMenu`가 초기화되지 않아 빈 화면 발생 가능
- **위치**: App.jsx L387~391
- **원인**: 기도, 미사, 성경 버튼을 누르면 `setIsIndividualMenu(true)`를 호출하는데, 이 시점에 GlobalBottomBar가 개별 메뉴를 렌더링하려 한다. 하지만 `isMassPage`, `isPrayerPage`, `isBiblePage` 값은 `useLocation()` 기반으로 실제 라우팅이 완료된 후에 갱신된다. 따라서 페이지 전환 직후 찰나에 `isIndividualMenu=true`이지만 아직 위치가 업데이트되지 않아 **`isMassPage`, `isPrayerPage`, `isBiblePage`가 모두 false인 상태**가 되고, 개별 메뉴 렌더링 조건이 맞지 않아 아무 버튼도 없는 빈 하단 막대가 노출될 수 있다.

---

## 2. 기도 개별 메뉴 (isPrayerPage = true)

| 버튼 | 동작 | 상태 |
|------|------|------|
| 추천 (별 아이콘) | `/`로 이동 후 `showPrayerCategories=false`로 전환 | ⚠️ 조건부 문제 |
| 목록 (리스트 아이콘) | `showPrayerCategories` 토글 | ⚠️ 버그 있음 |
| 검색 | `isPrayerSearchMode` 토글 | ✅ 정상 |
| TTS | `handleGlobalTtsToggle` 호출 | ✅ 정상 |

### 기도 개별 메뉴 발견된 문제점

#### 🔴 문제 2: 목록 버튼 — 다시 눌렀을 때 `selectedPrayerCategoryId`가 null이 되어 빈 화면 노출
- **위치**: App.jsx L719~726
  ```js
  onClick={() => { navigate('/'); setShowPrayerCategories(prev => !prev); setSelectedPrayerId(null); setSelectedPrayerCategoryId(null); }}
  ```
- **원인**: 목록 버튼을 눌러 `showPrayerCategories=true`가 됐을 때, `setSelectedPrayerCategoryId(null)`이 함께 호출된다. 그 결과 PrayersList.jsx L530의 조건 `selectedPrayerCategoryId === null`이 true가 되어 "기도 분류를 선택해 주세요" 안내 메시지만 뜨는 빈 화면이 나온다. 사용자는 하단의 카테고리 탭바를 다시 눌러야만 목록이 나타난다.
- **해결 방안**: 목록 버튼 클릭 시 `setSelectedPrayerCategoryId(null)` 대신 기존에 선택된 카테고리를 유지하거나 기본값 `1`로 설정해야 한다.

#### 🟡 문제 3: 추천 버튼 — `/prayers/:id` 경로에서 누르면 화면이 빈 상태로 깜빡임
- **위치**: App.jsx L711~718
- **원인**: `/prayers/:id` 상세 화면에서 추천 버튼을 누르면 `navigate('/')`를 통해 PrayersList로 이동하는데, 이 경우 `showPrayerCategories`, `selectedPrayerCategoryId`, `selectedPrayerId` 등의 전역 상태가 그대로 남아 있을 수 있다. 상세 페이지에서 카테고리 모드를 켠 채로 이동할 경우 (`showPrayerCategories=true`, `selectedPrayerId`는 있는데 해당 기도가 추천 목록에 없는 경우) PrayersList가 추천 홈 화면이 아닌 의도치 않은 모드로 렌더링될 수 있다.

#### 🟡 문제 4: 검색 버튼 — 검색 결과에서 기도 선택 후 뒤로가면 빈 카테고리 화면
- **위치**: PrayersList.jsx L494~499
  ```js
  setIsPrayerSearchMode(false);
  setShowPrayerCategories(true);
  setSelectedPrayerCategoryId(prayer.categoryId || 1);
  setSelectedPrayerId(prayer.id);
  ```
- **원인**: 검색 결과를 눌러 인라인 카테고리 뷰에서 기도문을 보다가, 하단의 목록 버튼을 다시 누르면 `setSelectedPrayerCategoryId(null)`이 호출되어 빈 화면이 나온다 (문제 2와 동일한 원인).

---

## 3. 미사 개별 메뉴 (isMassPage = true)

| 버튼 | 동작 | 상태 |
|------|------|------|
| 한글미사 | `setMassActiveTab('ko')` | ✅ 정상 |
| 영어미사 | `setMassActiveTab('en')` | ✅ 정상 |
| 독서1 | `massReading1`이 있을 때 오버레이 열기 | ⚠️ 조건부 문제 |
| 독서2 | `massReading2`가 있을 때만 렌더링 | ✅ 정상 |
| 복음 | `massGospel`이 있을 때 오버레이 열기 | ⚠️ 조건부 문제 |
| 묵상 | `massMeditationText`가 있을 때 열기 | ⚠️ 조건부 문제 |
| TTS | `handleGlobalTtsToggle` | ✅ 정상 |

### 미사 개별 메뉴 발견된 문제점

#### 🟡 문제 5: 독서1/복음/묵상 — 데이터 로딩 전 버튼이 `opacity: 0.4`로 비활성화되어 눌리지 않음
- **위치**: App.jsx L641~691
- **원인**: `massReading1`, `massGospel`, `massMeditationText` 값은 DailyMass 페이지가 마운트된 이후에 BibleContext에 세팅된다. 처음 미사 페이지에 접속하거나 로딩이 늦을 경우 이 값들이 `null`이기 때문에 버튼이 비활성화(disabled) 상태로 보이고, 사용자는 버튼이 고장난 것처럼 느낀다. 실제로는 데이터 로딩 후 다시 눌러야 하는데 그런 안내가 없다.

#### 🔴 문제 6: 미사 개별 메뉴 표시 로직 — 미사가 아닌 페이지에서 개별 메뉴를 열었다가 미사로 이동 시 올바른 메뉴가 안 나올 수 있음
- **위치**: App.jsx L605~708 (isIndividualMenu 분기 로직)
- **원인**: `isIndividualMenu=true` 상태에서 어느 개별 메뉴를 보여줄지는 `isMassPage`, `isPrayerPage`, `isBiblePage` 3개의 `boolean` 값으로 결정된다. 그런데 `isBiblePage = !isMassPage && !isPrayerPage`로 정의되어 있어, `/home`, `/plan` 등의 경로도 `isBiblePage=true`로 인식된다. 따라서 한권읽기(`/plan`) 페이지에서 `◉` 버튼을 누르면 성경 개별 메뉴가 뜨는데, 이 메뉴의 "성경읽기" 버튼이 `/list/신약`으로 이동시켜 현재 읽던 한권읽기 문맥을 잃게 만든다.

---

## 4. 성경 개별 메뉴 (isBiblePage = true)

| 버튼 | 동작 | 상태 |
|------|------|------|
| 성경읽기 | `/list/신약`으로 이동 | ⚠️ 조건부 문제 |
| 한권읽기 | `setIsContinueMode(true)` + `/plan` 이동 | ✅ 정상 |
| 검색 | `/search`로 이동 | ✅ 정상 |
| TTS | `handleGlobalTtsToggle` | ⚠️ 조건부 문제 |

### 성경 개별 메뉴 발견된 문제점

#### 🟡 문제 7: 성경읽기 버튼 — 성경을 읽다가 누르면 읽던 위치를 잃고 처음(신약 목록)으로 이동
- **위치**: App.jsx L755~762
  ```js
  onClick={() => { navigate('/list/신약'); setIsIndividualMenu(false); }}
  ```
- **원인**: `/read/bookId/chapter` 에서 성경을 읽다가 이 버튼을 누르면 항상 `/list/신약` (신약 목록)으로 이동한다. 읽던 성경이 구약이면 구약 목록이 아닌 신약 목록으로 이동하게 된다. 독서 흐름을 방해한다.
- **해결 방안**: 현재 경로를 분석하여 구약/신약을 구분하거나, 히스토리나 `continueReadPos`를 이용해 마지막 위치로 이동하도록 개선 필요.

#### 🔴 문제 8: TTS 버튼 — `/list/`, `/book/`, `/search`, `/plan` 페이지에서 누르면 alert 또는 먹통
- **위치**: App.jsx L356~378, `handleGlobalTtsToggle`
  ```js
  const isPlayablePage = location.pathname.startsWith('/read/') ||
                         location.pathname.startsWith('/mass') ||
                         location.pathname.startsWith('/prayers') ||
                         location.pathname === '/';
  ```
- **원인**: 위에서 정의한 `isPlayablePage`에 포함되지 않는 페이지(`/list/`, `/book/`, `/plan`, `/search`)에서 TTS 버튼을 누르면 "성경 읽기, 매일미사 또는 기도문 상세 화면에서 낭독을 시작할 수 있습니다."라는 alert가 뜬다. 문제는 이 버튼이 여전히 성경 개별 메뉴에 노출되어 있어서 사용자가 "왜 안 되지?" 하고 혼란스러워한다.
- **해결 방안**: 현재 페이지가 TTS 불가능한 화면일 때 TTS 버튼 자체를 `opacity: 0.4` + `disabled` 처리하거나 아예 숨기도록 수정 필요.

---

## 5. 공통 / 전반적인 구조 문제

#### 🔴 문제 9: `◉` 전환 버튼 — 개별 메뉴에서 다시 누르면 기본 메뉴 대신 엉뚱한 상태가 남음
- **위치**: App.jsx L380~384
  ```js
  const handleCircleBtn = () => {
    setIsIndividualMenu(prev => !prev);
    setShowPrayerCategories(false);
  };
  ```
- **원인**: `◉` 버튼은 `setShowPrayerCategories(false)`를 함께 호출한다. 기도 목록 모드(`showPrayerCategories=true`)에서 `◉`를 눌러 기본 메뉴로 돌아갔다가 다시 기도 버튼을 누르면 `showPrayerCategories`가 false가 되어 추천 기도 홈으로 이동하는데, 사용자 입장에서는 "내가 보던 기도 목록이 사라졌다"고 느낄 수 있다. 상태 초기화 타이밍이 UX 흐름과 맞지 않는다.

#### 🟡 문제 10: 페이지 이동 시 개별 메뉴가 자동으로 닫히지 않음
- **위치**: App.jsx L290~295
- **원인**: `useEffect`에서 `location.pathname` 변경 시 `setIsBarsVisible(true)`만 하고 `setIsIndividualMenu(false)`는 하지 않는다. 따라서 기도 개별 메뉴가 열린 상태에서 다른 페이지(예: 성경읽기)로 이동해도 개별 메뉴 상태가 남아 있어, 예를 들어 기도 개별 메뉴 버튼들이 성경 읽기 화면 하단에 계속 표시되는 상황이 발생할 수 있다.

---

## 우선순위 요약

| 우선순위 | 문제 번호 | 증상 |
|---------|---------|------|
| 🔴 즉시 수정 | 문제 2 | 목록 버튼 → 빈 화면 (selectedPrayerCategoryId=null) |
| 🔴 즉시 수정 | 문제 8 | TTS 버튼 → alert 또는 먹통 (비활성화 표시 없음) |
| 🔴 즉시 수정 | 문제 6 | /plan 에서 개별 메뉴 열면 성경 메뉴 오인식 |
| 🟡 중요 | 문제 7 | 성경읽기 버튼 → 항상 신약 목록으로 이동 |
| 🟡 중요 | 문제 4 | 검색 후 뒤로가면 빈 카테고리 화면 |
| 🟡 중요 | 문제 5 | 미사 버튼 로딩 전 비활성 안내 없음 |
| ⚪ 낮음 | 문제 1 | 페이지 전환 직후 찰나의 빈 하단막대 |
| ⚪ 낮음 | 문제 3 | 상세→추천 이동 시 상태 오염 가능성 |
| ⚪ 낮음 | 문제 9 | ◉ 버튼으로 기도 목록 상태 초기화 |
| ⚪ 낮음 | 문제 10 | 페이지 이동 후 개별 메뉴 상태 유지 |
