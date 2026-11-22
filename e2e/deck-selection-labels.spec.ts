import { test, expect } from '@playwright/test'
test.use({ channel: 'chrome' })
test.skip(({ browserName }) => browserName !== 'chromium', 'Installed Chrome')
test('deck creation numbers the formation and shows original EGO rank images', async ({ page }, info) => {
  test.setTimeout(90000)
  await page.goto('/ko/decks/new')
  // The site notice opens once per visitor after hydration and hides the page from the accessibility tree.
  const notice = page.getByRole('dialog').filter({ has: page.locator('[data-announcement-popup]') })
  await notice.getByRole('button', { name: '닫기' }).first().click()
  await expect(notice).toHaveCount(0)
  // A new deck holds every sinner's LCB identity; a click on its card puts it in the formation as number 1.
  await page.getByRole('button', { name: '이상 LCB 수감자 편성하기', exact: true }).click()
  const tile = page.getByRole('button', { name: '이상 LCB 수감자 편성 해제 1', exact: true })
  await expect(tile).toBeVisible()
  await expect(tile).toContainText('1')
  await page.screenshot({ path: info.outputPath('deck-selection.png'), fullPage: true })
  await page.getByRole('tab', { name: 'E.G.O', exact: true }).click()
  // The board shows the game's own rank letters (lit for the equipped grade), not generic grade icons.
  const rank = page.locator('img[src*="formation/letter-zayin-on.webp"]').first()
  await expect(rank).toBeVisible()
  await rank.evaluate((img: HTMLImageElement) => img.decode())
  await expect(page.locator('img[src*="icons%2Fgrade"],img[src*="icons/grade"]')).toHaveCount(0)
  await page.screenshot({ path: info.outputPath('deck-ego-ranks.png'), fullPage: true })
})
