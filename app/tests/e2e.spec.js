import { test, expect } from '@playwright/test';

test.describe('Bible Web App E2E Tests', () => {
  
  test('1. 홈 화면 진입이 잘 되는지 확인', async ({ page }) => {
    await page.goto('/home');
    await expect(page).toHaveTitle(/bible|성경/i);
    const planHeader = page.locator('text=오늘의 한권읽기');
    await expect(planHeader).toBeVisible();
  });

  test('2. 기도 인트로 및 메뉴 이동 검증', async ({ page }) => {
    await page.goto('/prayers');
    
    // 인트로 레이어 감지
    const introOverlay = page.locator('.faith-intro-overlay');
    if (await introOverlay.isVisible()) {
      await introOverlay.click();
      await expect(introOverlay).not.toBeVisible();
    }
    
    // 하단바의 '목록' 버튼을 누르면 목록 필터 탭이 뜨는지 점검
    const listBtn = page.locator('button[title="기도문 목록"]');
    await listBtn.click();
    
    // 목록 버튼을 연달아 눌러도 추천으로 토글되지 않고 목록 모드가 그대로 유지되는지 검증
    await listBtn.click();
    
    // 목록 화면 표시 확인 (나의 기도 혹은 카테고리 탭 확인)
    const categoryTab = page.locator('button', { hasText: '주요' });
    await expect(categoryTab).toBeVisible();
  });

  test('3. 미사 탭 진입 및 오버레이 클릭 시 무한루프 점검', async ({ page }) => {
    // API Mocking 주입
    await page.route('**/api/mass*', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          readings: [
            { type: '독서1', bookId: 1, chapter: 1, verse: 1, bookName: '창세', range: '1-1', label: '독서1 창세 1-1' }
          ],
          meditation: '가짜 묵상 본문입니다.'
        })
      });
    });

    // 미사 HTML 프록시 Mocking 주입 (무한 펜딩 방지)
    await page.route('**/api/mass-html*', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'text/html',
        body: '<html><body>가짜 CBCK 미사 본문 HTML 입니다.</body></html>'
      });
    });

    // 홈 화면 진입 후 하단바 탭 클릭을 통해 미사 탭으로 정식 이동 (개별 메뉴 탭 노출 유도)
    await page.goto('/home');
    
    // 인트로 오버레이가 화면을 가리고 있다면 먼저 클릭하여 해제
    const introOverlay = page.locator('.faith-intro-overlay');
    if (await introOverlay.isVisible()) {
      await introOverlay.click();
    }
    
    const massTabBtn = page.locator('button', { hasText: '미사' });
    await massTabBtn.click();
    
    // 독서1 버튼이 활성화(disabled가 아님)될 때까지 최대 5초 대기
    await page.waitForFunction(() => {
      const btn = document.querySelector('button[title*="독서1"]');
      return btn && !btn.disabled;
    }, { timeout: 5000 });
    
    const reading1Btn = page.locator('button[title*="독서1"]');
    await reading1Btn.click();
    
    const overlaySheet = page.locator('.settings-sheet');
    await expect(overlaySheet).toBeVisible();
    
    // 1.5초 대기 후에도 오버레이 창이 풀풀거리며 닫히지 않고 잘 떠있는지 검증 (무한루프 방지 확인)
    await page.waitForTimeout(1500);
    await expect(overlaySheet).toBeVisible();
    
    // 닫기 버튼 클릭 (X 아이콘을 가진 마지막 버튼)
    const closeBtn = page.locator('.settings-sheet button').last();
    await closeBtn.click();
    
    // 닫혔는지 검증
    await expect(overlaySheet).not.toBeVisible();
  });

  test('4. 영어 미사 탭 진입 및 독서1 클릭 시 정상 작동 점검', async ({ page }) => {
    // API Mocking 주입
    await page.route('**/api/mass*', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          readings: [
            { type: '독서1', bookId: 67, chapter: 1, verse: 18, bookName: '1 Peter', range: '18-25', label: '독서1 1 Peter 18-25' }
          ]
        })
      });
    });

    await page.goto('/home');
    
    const introOverlay = page.locator('.faith-intro-overlay');
    if (await introOverlay.isVisible()) {
      await introOverlay.click();
    }
    
    // 미사 탭 진입
    const massTabBtn = page.locator('button', { hasText: '미사' });
    await massTabBtn.click();
    
    // 영어미사 버튼 클릭
    const englishMassBtn = page.locator('button[title="영어미사"]');
    await englishMassBtn.click();
    
    // 독서1 버튼이 활성화될 때까지 대기
    await page.waitForFunction(() => {
      const btn = document.querySelector('button[title*="독서1"]');
      return btn && !btn.disabled;
    }, { timeout: 5000 });
    
    const reading1Btn = page.locator('button[title*="독서1"]');
    await reading1Btn.click();
    
    // 오버레이 시트 가시성 점검
    const overlaySheet = page.locator('.settings-sheet');
    await expect(overlaySheet).toBeVisible();
    
    // 1.5초 후에도 정상 유지되는지 검증
    await page.waitForTimeout(1500);
    await expect(overlaySheet).toBeVisible();
  });

});
