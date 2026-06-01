# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: e2e.spec.js >> Bible Web App E2E Tests >> 3. 미사 탭 진입 및 오버레이 클릭 시 무한루프 점검
- Location: tests/e2e.spec.js:34:3

# Error details

```
Error: locator.click: Error: strict mode violation: locator('button').filter({ hasText: '미사' }) resolved to 2 elements:
    1) <button>매일미사 전체 보기 →</button> aka getByRole('button', { name: '매일미사 전체 보기 →' })
    2) <button title="매일 미사" class="global-bottom-btn ">…</button> aka getByRole('button', { name: '미사', description: '매일 미사', exact: true })

Call log:
  - waiting for locator('button').filter({ hasText: '미사' })

```

# Page snapshot

```yaml
- generic [ref=e3]:
  - main [ref=e5]:
    - heading "5월 29일 (금)" [level=2] [ref=e6]
    - generic [ref=e7]:
      - generic [ref=e8]:
        - heading "오늘의 한권읽기" [level=3] [ref=e9]:
          - img [ref=e10]
          - text: 오늘의 한권읽기
        - button "전체보기" [ref=e13] [cursor=pointer]
      - paragraph [ref=e16]:
        - text: 생성된 한권읽기 일정이 없습니다.
        - text: 새로운 통독을 시작해보세요!
    - generic [ref=e17]:
      - generic [ref=e18]:
        - heading "오늘의 매일미사" [level=3] [ref=e19]:
          - img [ref=e20]
          - text: 오늘의 매일미사
        - button "매일미사 전체 보기 →" [ref=e22] [cursor=pointer]
      - generic [ref=e24] [cursor=pointer]:
        - generic [ref=e25]: 독서1
        - generic [ref=e26]: 창세 1-1
    - generic [ref=e27]:
      - generic [ref=e28]:
        - heading "지금 시간에 추천하는 기도" [level=3] [ref=e29]:
          - img [ref=e30]
          - text: 지금 시간에 추천하는 기도
        - button "더보기" [ref=e32] [cursor=pointer]
      - generic [ref=e34] [cursor=pointer]:
        - generic [ref=e35]:
          - generic [ref=e36]: 성호경
          - img [ref=e37]
        - generic [ref=e39]:
          - generic [ref=e40]: 주님의 기도
          - img [ref=e41]
        - generic [ref=e43]:
          - generic [ref=e44]: 성모송
          - img [ref=e45]
  - generic [ref=e47]:
    - button "홈" [ref=e48] [cursor=pointer]:
      - img [ref=e49]
      - generic [ref=e52]: 홈
    - button "기도" [ref=e53] [cursor=pointer]:
      - img [ref=e54]
      - generic [ref=e56]: 기도
    - button "미사" [ref=e57] [cursor=pointer]:
      - img [ref=e58]
      - generic [ref=e59]: 미사
    - button "성경" [ref=e60] [cursor=pointer]:
      - img [ref=e61]
      - generic [ref=e64]: 성경
    - button "설정" [ref=e65] [cursor=pointer]:
      - img [ref=e66]
      - generic [ref=e69]: 설정
    - button "◉" [ref=e70] [cursor=pointer]:
      - img [ref=e71]
      - generic [ref=e74]: ◉
```

# Test source

```ts
  1   | import { test, expect } from '@playwright/test';
  2   | 
  3   | test.describe('Bible Web App E2E Tests', () => {
  4   |   
  5   |   test('1. 홈 화면 진입이 잘 되는지 확인', async ({ page }) => {
  6   |     await page.goto('/home');
  7   |     await expect(page).toHaveTitle(/bible|성경/i);
  8   |     const planHeader = page.locator('text=오늘의 한권읽기');
  9   |     await expect(planHeader).toBeVisible();
  10  |   });
  11  | 
  12  |   test('2. 기도 인트로 및 메뉴 이동 검증', async ({ page }) => {
  13  |     await page.goto('/prayers');
  14  |     
  15  |     // 인트로 레이어 감지
  16  |     const introOverlay = page.locator('.faith-intro-overlay');
  17  |     if (await introOverlay.isVisible()) {
  18  |       await introOverlay.click();
  19  |       await expect(introOverlay).not.toBeVisible();
  20  |     }
  21  |     
  22  |     // 하단바의 '목록' 버튼을 누르면 목록 필터 탭이 뜨는지 점검
  23  |     const listBtn = page.locator('button[title="기도문 목록"]');
  24  |     await listBtn.click();
  25  |     
  26  |     // 목록 버튼을 연달아 눌러도 추천으로 토글되지 않고 목록 모드가 그대로 유지되는지 검증
  27  |     await listBtn.click();
  28  |     
  29  |     // 목록 화면 표시 확인 (나의 기도 혹은 카테고리 탭 확인)
  30  |     const categoryTab = page.locator('button', { hasText: '주요' });
  31  |     await expect(categoryTab).toBeVisible();
  32  |   });
  33  | 
  34  |   test('3. 미사 탭 진입 및 오버레이 클릭 시 무한루프 점검', async ({ page }) => {
  35  |     // API Mocking 주입
  36  |     await page.route('**/api/mass*', async route => {
  37  |       await route.fulfill({
  38  |         status: 200,
  39  |         contentType: 'application/json',
  40  |         body: JSON.stringify({
  41  |           success: true,
  42  |           readings: [
  43  |             { type: '독서1', bookId: 1, chapter: 1, verse: 1, bookName: '창세', range: '1-1', label: '독서1 창세 1-1' }
  44  |           ],
  45  |           meditation: '가짜 묵상 본문입니다.'
  46  |         })
  47  |       });
  48  |     });
  49  | 
  50  |     // 미사 HTML 프록시 Mocking 주입 (무한 펜딩 방지)
  51  |     await page.route('**/api/mass-html*', async route => {
  52  |       await route.fulfill({
  53  |         status: 200,
  54  |         contentType: 'text/html',
  55  |         body: '<html><body>가짜 CBCK 미사 본문 HTML 입니다.</body></html>'
  56  |       });
  57  |     });
  58  | 
  59  |     // 홈 화면 진입 후 하단바 탭 클릭을 통해 미사 탭으로 정식 이동 (개별 메뉴 탭 노출 유도)
  60  |     await page.goto('/home');
  61  |     
  62  |     // 인트로 오버레이가 화면을 가리고 있다면 먼저 클릭하여 해제
  63  |     const introOverlay = page.locator('.faith-intro-overlay');
  64  |     if (await introOverlay.isVisible()) {
  65  |       await introOverlay.click();
  66  |     }
  67  |     
  68  |     const massTabBtn = page.locator('button', { hasText: '미사' });
> 69  |     await massTabBtn.click();
      |                      ^ Error: locator.click: Error: strict mode violation: locator('button').filter({ hasText: '미사' }) resolved to 2 elements:
  70  |     
  71  |     // 독서1 버튼이 활성화(disabled가 아님)될 때까지 최대 5초 대기
  72  |     await page.waitForFunction(() => {
  73  |       const btn = document.querySelector('button[title*="독서1"]');
  74  |       return btn && !btn.disabled;
  75  |     }, { timeout: 5000 });
  76  |     
  77  |     const reading1Btn = page.locator('button[title*="독서1"]');
  78  |     await reading1Btn.click();
  79  |     
  80  |     const overlaySheet = page.locator('.settings-sheet');
  81  |     await expect(overlaySheet).toBeVisible();
  82  |     
  83  |     // 1.5초 대기 후에도 오버레이 창이 풀풀거리며 닫히지 않고 잘 떠있는지 검증 (무한루프 방지 확인)
  84  |     await page.waitForTimeout(1500);
  85  |     await expect(overlaySheet).toBeVisible();
  86  |     
  87  |     // 닫기 버튼 클릭 (X 아이콘을 가진 마지막 버튼)
  88  |     const closeBtn = page.locator('.settings-sheet button').last();
  89  |     await closeBtn.click();
  90  |     
  91  |     // 닫혔는지 검증
  92  |     await expect(overlaySheet).not.toBeVisible();
  93  |   });
  94  | 
  95  |   test('4. 영어 미사 탭 진입 및 독서1 클릭 시 정상 작동 점검', async ({ page }) => {
  96  |     // API Mocking 주입
  97  |     await page.route('**/api/mass*', async route => {
  98  |       await route.fulfill({
  99  |         status: 200,
  100 |         contentType: 'application/json',
  101 |         body: JSON.stringify({
  102 |           success: true,
  103 |           readings: [
  104 |             { type: '독서1', bookId: 67, chapter: 1, verse: 18, bookName: '1 Peter', range: '18-25', label: '독서1 1 Peter 18-25' }
  105 |           ]
  106 |         })
  107 |       });
  108 |     });
  109 | 
  110 |     await page.goto('/home');
  111 |     
  112 |     const introOverlay = page.locator('.faith-intro-overlay');
  113 |     if (await introOverlay.isVisible()) {
  114 |       await introOverlay.click();
  115 |     }
  116 |     
  117 |     // 미사 탭 진입
  118 |     const massTabBtn = page.locator('button', { hasText: '미사' });
  119 |     await massTabBtn.click();
  120 |     
  121 |     // 영어미사 버튼 클릭
  122 |     const englishMassBtn = page.locator('button[title="영어미사"]');
  123 |     await englishMassBtn.click();
  124 |     
  125 |     // 독서1 버튼이 활성화될 때까지 대기
  126 |     await page.waitForFunction(() => {
  127 |       const btn = document.querySelector('button[title*="독서1"]');
  128 |       return btn && !btn.disabled;
  129 |     }, { timeout: 5000 });
  130 |     
  131 |     const reading1Btn = page.locator('button[title*="독서1"]');
  132 |     await reading1Btn.click();
  133 |     
  134 |     // 오버레이 시트 가시성 점검
  135 |     const overlaySheet = page.locator('.settings-sheet');
  136 |     await expect(overlaySheet).toBeVisible();
  137 |     
  138 |     // 1.5초 후에도 정상 유지되는지 검증
  139 |     await page.waitForTimeout(1500);
  140 |     await expect(overlaySheet).toBeVisible();
  141 |   });
  142 | 
  143 | });
  144 | 
```