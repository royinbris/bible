import { test, expect } from '@playwright/test';

const SETTINGS_BASE = {
  fontSize: 18,
  fontWeight: 400,
  lineHeight: 1.7,
  verseSpacing: 0.8,
  horizontalPadding: 1.5,
  fontFamily: 'System Default',
  theme: 'system',
  bibleLanguage: 'ko',
  prayerTtsRate: 0.85,
};

test('그린 프리셋이면 data-bg=green + data-theme 강제 light + 배경색 적용', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.addInitScript((base) => {
    localStorage.setItem('user_settings', JSON.stringify({ ...base, bgPreset: 'green' }));
  }, SETTINGS_BASE);
  await page.goto('/home');
  await expect(page.locator('html')).toHaveAttribute('data-bg', 'green');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(bg).toBe('rgb(231, 239, 226)');
});

test('기본값이면 data-bg 속성이 없음', async ({ page }) => {
  await page.addInitScript((base) => {
    localStorage.setItem('user_settings', JSON.stringify({ ...base }));
  }, SETTINGS_BASE);
  await page.goto('/home');
  await expect(page.locator('html')).not.toHaveAttribute('data-bg');
});
