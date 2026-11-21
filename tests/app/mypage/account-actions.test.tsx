import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

vi.mock('next-intl', () => ({ useLocale: () => 'ko' }))
vi.mock('next-auth/react', () => ({ signOut: vi.fn() }))
vi.mock('@/hooks/usePushSubscription', () => ({ forgetPushSubscription: vi.fn() }))
vi.mock('@/features/account/components/AvatarPicker', () => ({ default: () => null }))
const search = vi.hoisted(() => ({ params: new URLSearchParams() }))
vi.mock('next/navigation', () => ({ useSearchParams: () => search.params }))
// The real dialog renders into a portal that static markup never reaches; the stub shows what it was given.
vi.mock('@/components/ui/ConfirmModal', () => ({
  default: (props: { open: boolean; title?: string; message: string; confirmLabel?: string }) => (
    <div data-confirm-open={String(props.open)} data-confirm-label={props.confirmLabel}>{props.title}{props.message}</div>
  ),
}))

import ProfileTab from '@/app/[lang]/mypage/_components/ProfileTab'
import MypageTabs, { RailSignOut, resolveMypageTab } from '@/app/[lang]/mypage/_components/MypageTabs'
import { deleteAccount } from '@/app/[lang]/mypage/_components/useAccountActions'
import { communityCopy } from '@/features/community/lib/copy'

const ko = communityCopy.ko
const profile = { username: 'QA', bio: null, avatar_url: null }
const renderProfile = () => renderToStaticMarkup(<ProfileTab profile={profile} email="qa@example.invalid" onProfileUpdate={async () => {}} onSettingsSaved={async () => {}} />)

beforeEach(() => { search.params = new URLSearchParams() })

describe('account section in the settings tab', () => {
  it('is always open: no details element, e-mail, sign-out and delete buttons without any interaction', () => {
    const html = renderProfile()
    expect(html).not.toContain('<details')
    expect(html).toContain(ko.account)
    expect(html).toContain(ko.accountEmail)
    expect(html).toContain('qa@example.invalid')
    expect(html).toMatch(new RegExp(`<button[^>]*>(?:<svg.*?</svg>)?${ko.logout}</button>`))
    expect(html).toMatch(new RegExp(`<button[^>]*>${ko.withdraw}</button>`))
  })

  it('keeps the confirm dialog closed until asked', () => {
    expect(renderProfile()).toContain('data-confirm-open="false"')
  })

  it('opens the confirm dialog straight away for the legal-update link (?withdraw=1)', () => {
    search.params = new URLSearchParams('tab=profile&withdraw=1')
    const html = renderProfile()
    expect(html).toContain('data-confirm-open="true"')
    expect(html).toContain(ko.withdrawWarning)
    expect(html).toContain(`data-confirm-label="${ko.confirm}"`)
  })

  it('says what is deleted in every language', () => {
    for (const lang of ['ko', 'en', 'ja'] as const) expect(communityCopy[lang].withdrawWarning.length).toBeGreaterThan(10)
    expect(ko.withdrawWarning).toMatch(/덱.*플랜.*댓글.*문의/)
    for (const lang of ['ko', 'en', 'ja'] as const) expect(communityCopy[lang].accountEmail).toBeTruthy()
  })
})

describe('rail sign-out', () => {
  const tabs = () => renderToStaticMarkup(<MypageTabs activeTab="decks" onTabChange={() => {}} counts={{}} />)

  it('is a button of its own, not one of the tabs', () => {
    expect(tabs()).not.toContain(ko.logout)
    expect(renderToStaticMarkup(<RailSignOut />)).toMatch(new RegExp(`^<button[^>]*type="button"[^>]*>(?:<svg.*?</svg>)?${ko.logout}</button>$`))
  })
})

describe('default tab', () => {
  it('falls back to decks, and honours a valid link or stored tab', () => {
    expect(resolveMypageTab(null, null)).toBe('decks')
    expect(resolveMypageTab('profile', null)).toBe('profile')
    expect(resolveMypageTab(null, 'follows')).toBe('follows')
    expect(resolveMypageTab('planner', 'follows')).toBe('planner')
    expect(resolveMypageTab('nope', null)).toBe('decks')
    expect(resolveMypageTab(null, 'nope')).toBe('decks')
  })
})

describe('deleting the account', () => {
  it('forgets the push subscription, then deletes, then signs out', async () => {
    const calls: string[] = []
    await deleteAccount({
      forget: async () => { calls.push('forget') },
      request: async () => { calls.push('delete'); return { ok: true } },
      leave: async () => { calls.push('signOut') },
    })
    expect(calls).toEqual(['forget', 'delete', 'signOut'])
  })

  it('does not sign out when the server refuses', async () => {
    const leave = vi.fn()
    await expect(deleteAccount({ forget: async () => {}, request: async () => ({ ok: false }), leave })).rejects.toThrow()
    expect(leave).not.toHaveBeenCalled()
  })
})
