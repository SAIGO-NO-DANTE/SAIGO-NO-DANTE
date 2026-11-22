import { test, expect, type Page } from '@playwright/test'

test.use({ channel: 'chrome', ...(process.env.PLAYWRIGHT_STORAGE_STATE ? { storageState: process.env.PLAYWRIGHT_STORAGE_STATE } : {}) })
test.setTimeout(90000)
// The site notice opens once per visitor after hydration and hides the page from the accessibility tree. The corner X, not
// the footer button: on a phone the dev badge covers that one.
async function closeNotice(page: Page) {
  const notice = page.getByRole('dialog').filter({ has: page.locator('[data-announcement-popup]') })
  await notice.getByRole('button', { name: '닫기' }).first().click()
  await expect(notice).toHaveCount(0)
}

test('formation filters compose and reset when reopened', async ({ page }) => {
  await page.goto('/ko/decks/new')
  test.skip(page.url().includes('/login'), 'Requires an authenticated deck editor session')
  await closeNotice(page)
  // The first sinner's tile of the edit sheet opens the identity picker; each card in it is a list item.
  const openPicker = async () => {
    // The sheet is already open on a new deck; the bar says "완료" then.
    const edit = page.getByRole('button', { name: /^인격 편성(하기| 완료)$/ })
    if (await edit.getAttribute('aria-expanded') !== 'true') await edit.click()
    await page.getByRole('button', { name: /^변경 / }).first().click()
  }
  await openPicker()
  const dialog = page.getByRole('dialog')
  const cards = dialog.getByRole('listitem')
  await dialog.getByRole('button', { name: '0', exact: true }).click()
  await dialog.getByRole('combobox', { name: '이름으로 검색' }).fill('LCB')
  await expect(cards).toHaveCount(1)
  await expect(dialog.locator('select')).toHaveCount(0)
  await dialog.getByRole('combobox', { name: '이름으로 검색' }).fill('no-such-identity')
  await expect(dialog.getByText('조건에 맞는 인격이 없습니다', { exact: true })).toBeVisible()
  await dialog.getByRole('button', { name: '초기화' }).click()
  await expect(cards.first()).toBeVisible()
  await dialog.getByRole('button', { name: '00', exact: true }).click()
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
  await openPicker()
  await expect(dialog.getByRole('button', { name: '전체', exact: true })).toHaveAttribute('aria-pressed', 'true')
})

for (const kind of ['identity', 'ego'] as const) test(`note ${kind} catalog filters preserve insertion on mobile`, async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/ko/decks/new')
  test.skip(page.url().includes('/login'), 'Requires an authenticated deck editor session')
  await closeNotice(page)
  await page.getByRole('tab', { name: /덱 노트/ }).click()
  await page.getByRole('button', { name: '블록 삽입' }).click()
  await page.getByRole('menuitem', { name: kind === 'identity' ? /인격/ : /E.G.O/ }).click()
  await page.getByRole('button', { name: kind === 'identity' ? '인격 선택' : 'E.G.O 선택', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.locator('.note-picker-item').first()).toBeVisible()
  await dialog.getByRole('button', { name: '수감자 필터', exact: true }).click()
  await dialog.getByRole('button', { name: '료슈', exact: true }).click()
  await dialog.getByRole('button', { name: kind === 'identity' ? '000' : 'ZAYIN', exact: true }).click()
  await expect(dialog.locator('.note-picker-results section')).toHaveCount(1)
  await expect(dialog.locator('.note-picker-results h3')).toContainText('료슈')
  await expect(dialog.locator('select')).toHaveCount(0)
  // Three cards a row on a phone (character-picker.css), for identities and E.G.O alike.
  expect(await dialog.locator('.note-picker-grid').evaluate(el => getComputedStyle(el).gridTemplateColumns.split(' ').length)).toBe(3)
  const name = await dialog.locator('.note-picker-item').first().getAttribute('aria-label')
  await dialog.locator('.note-picker-item').first().click()
  await expect(dialog).toHaveCount(0)
  // An identity name is set in separate lines on the node, so the label's spaces may be missing in its text.
  const nameText = new RegExp(name!.split(/\s+/).map(word => word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('\\s*'))
  await expect(page.locator(`.note-asset-node--${kind}`)).toContainText(nameText)
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1)
})

test('catalog scope is limited to public character assets', async ({ request }) => {
  for (const kind of ['identity', 'ego']) {
    const response = await request.get(`/api/notes/assets?kind=${kind}&catalog=1`)
    expect(response.status()).toBe(200)
    const data = await response.json()
    expect(data.length).toBeGreaterThan(24)
    expect(data.every((row: { kind: string }) => row.kind === kind)).toBe(true)
    expect(JSON.stringify(data)).not.toMatch(/"(?:email|user_id|profile_id)":/)
  }
  const keywords = await request.get('/api/notes/assets?kind=keyword&catalog=1')
  expect((await keywords.json()).length).toBeLessThanOrEqual(24)
  expect((await request.get('/api/notes/assets?kind=profile&catalog=1')).status()).toBe(400)
})

test('failed character catalog can retry', async ({ page }) => {
  await page.route('**/api/notes/assets?kind=identity&catalog=1', route => route.fulfill({ status: 503, json: { error: 'Assets unavailable' } }))
  await page.goto('/ko/decks/new')
  test.skip(page.url().includes('/login'), 'Requires an authenticated deck editor session')
  await closeNotice(page)
  await page.getByRole('tab', { name: /덱 노트/ }).click()
  await page.getByRole('button', { name: '블록 삽입' }).click()
  await page.getByRole('menuitem', { name: /인격/ }).click()
  await page.getByRole('button', { name: '인격 선택', exact: true }).click()
  await expect(page.getByRole('button', { name: '불러오기 실패 · 다시 시도' })).toBeVisible()
  await page.unroute('**/api/notes/assets?kind=identity&catalog=1')
  await page.getByRole('button', { name: '불러오기 실패 · 다시 시도' }).click()
  await expect(page.locator('.note-picker-item').first()).toBeVisible()
})
