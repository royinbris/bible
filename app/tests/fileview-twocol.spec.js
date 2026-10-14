import { test, expect } from '@playwright/test';

test('맥북 넓이에서 2단 저장값이면 미리보기가 2컬럼', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.addInitScript(() => {
    localStorage.setItem('fileview_two_column', '1');
  });
  await page.goto('/fileview');
  await page.locator('button[title="미리보기 보기"]').click();
  const cols = await page.evaluate(
    () => getComputedStyle(document.querySelector('.preview-content')).columnCount
  );
  expect(cols).toBe('2');
});

test('아이폰 넓이에서 1단/2단 토글이 숨김', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/fileview');
  await expect(page.locator('button[title="1단/2단 전환"]')).toBeHidden();
});
