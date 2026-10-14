import { test, expect } from '@playwright/test';

const LONG_MD = Array.from({ length: 120 }, (_, i) => `# 제목 ${i + 1}\n\n문단 ${i + 1} 본문입니다. 충분히 긴 내용으로 스크롤을 만듭니다.\n`).join('\n');

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.addInitScript((md) => {
    localStorage.setItem('pending_markdown', md);
  }, LONG_MD);
  await page.goto('/fileview');
  await page.locator('button[title="미리보기 보기"]').click();
  await expect(page.locator('.preview-content')).toBeVisible();
});

async function scrollerTop(page) {
  return page.evaluate(() => document.querySelector('.preview-content').scrollTop);
}

test('미재생 화살표로 페이지 스크롤', async ({ page }) => {
  const scroller = page.locator('.preview-content');
  await scroller.evaluate((el) => el.scrollTo({ top: 0 }));
  const before = await scrollerTop(page);
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(700);
  const after = await scrollerTop(page);
  const clientH = await page.evaluate(() => document.querySelector('.preview-content').clientHeight);
  expect(after - before).toBeGreaterThan(clientH * 0.5);
  await page.keyboard.press('ArrowLeft');
  await page.waitForTimeout(700);
  const back = await scrollerTop(page);
  expect(back).toBeLessThan(after);
});

test('2단에서는 화살표로 가로 페이지 스크롤', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.addInitScript((md) => {
    localStorage.setItem('pending_markdown', md);
    localStorage.setItem('fileview_two_column', '1');
  }, LONG_MD);
  await page.goto('/fileview');
  await page.locator('button[title="미리보기 보기"]').click();
  const scroller = page.locator('.preview-content');
  const overflow = await scroller.evaluate((el) => el.scrollWidth - el.clientWidth);
  expect(overflow).toBeGreaterThan(200);
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(700);
  const dims = await scroller.evaluate((el) => ({ left: el.scrollLeft, w: el.clientWidth }));
  expect(dims.left).toBeGreaterThan(100);
  expect(Math.abs(dims.left - dims.w)).toBeLessThan(12);
  await page.keyboard.press('ArrowLeft');
  await page.waitForTimeout(700);
  const back = await scroller.evaluate((el) => el.scrollLeft);
  expect(back).toBeLessThan(overflow);
});

test('Space 단독 탭은 스크롤하지 않고 Space+화살표는 스크롤', async ({ page }) => {
  const scroller = page.locator('.preview-content');
  await scroller.evaluate((el) => el.scrollTo({ top: 0 }));
  await page.keyboard.press('Space');
  await page.waitForTimeout(300);
  expect(await scrollerTop(page)).toBe(0);
  await page.keyboard.down('Space');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.up('Space');
  await page.waitForTimeout(700);
  expect(await scrollerTop(page)).toBeGreaterThan(100);
});
