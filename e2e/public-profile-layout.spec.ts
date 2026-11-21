import { test, expect } from '@playwright/test'
test.use({ channel: 'chrome' })
const id = '00000000-0000-4000-8000-000000000001'
for (const width of [1440, 390]) test(`public profile panel and follow controls ${width}`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.route('**/api/auth/session', r => r.fulfill({ json: { user: { name: 'Viewer' }, expires: '2099-01-01' } }))
  let unavailable = false, following = false
  await page.route(`**/api/community/profiles/${id}`, r => r.fulfill(unavailable ? { status: 404, json: {} } : { json: {
    profile: { id, username: '차분한 히스클리프', bio: '거울 던전 편성을 공유합니다.', created_at: '2026-09-01', public_profile: true },
    stats: { points: 120, deck: 4, plan: 2, like: 12, contribution: 1 }, decks: [],
  } }))
  await page.route(`**/api/community/profiles/${id}/follows*`, r => {
    if (r.request().method() === 'POST') following = true
    return r.fulfill({ json: { owner: false, is_following: following, following_count: null, follower_count: 3, public_following: false, public_followers: true, can_view: true, items: [] } })
  })
  await page.goto(`/ko/users/${id}`)
  const panel = page.getByTestId('community-profile')
  await expect(panel.getByRole('heading', { name: '차분한 히스클리프' })).toBeVisible()
  await expect(panel.getByRole('button', { name: '팔로잉 비공개' })).toBeDisabled()
  const follow = panel.getByRole('button', { name: '팔로우', exact: true })
  await follow.focus()
  await follow.press('Enter')
  await expect(panel.getByRole('button', { name: '팔로잉', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(panel.getByRole('link', { name: '공개 프로필 보기' })).toHaveCount(0)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: `/tmp/limbus-public-profile-${width}.png`, fullPage: true })
  unavailable = true
  await page.reload()
  await expect(page.getByRole('alert').filter({ hasText: '공개된 프로필을 찾을 수 없습니다' })).toBeVisible()
  await expect(page.getByTestId('community-profile')).toHaveCount(0)
})
