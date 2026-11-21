import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

vi.mock('next-intl', () => ({ useLocale: () => 'ko' }))
vi.mock('next-auth/react', () => ({ signOut: vi.fn() }))
vi.mock('@/hooks/usePushSubscription', () => ({ forgetPushSubscription: vi.fn(), usePushSubscription: () => ({ state: 'off', enable: vi.fn(), disable: vi.fn() }) }))
vi.mock('@/features/account/components/AvatarPicker', () => ({ default: () => null }))
vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams() }))
vi.mock('@/components/ui/ConfirmModal', () => ({ default: () => null }))

import ProfileTab from '@/app/[lang]/mypage/_components/ProfileTab'
import MypageTabs, { resolveMypageTab } from '@/app/[lang]/mypage/_components/MypageTabs'
import { communityCopy } from '@/features/community/lib/copy'

const ko = communityCopy.ko
const settings = { public_profile: true, public_following: false, public_followers: true, notify_comments: true, notify_follows: false, notify_posts: true }
const html = renderToStaticMarkup(
  <ProfileTab profile={{ username: 'QA', bio: null, avatar_url: null }} email="qa@example.invalid" settings={settings} onProfileUpdate={async () => {}} onSettingsSaved={async () => {}} />,
)

describe('settings tab', () => {
  it('has four sections in order: profile, visibility, notifications, account', () => {
    const titles = [...html.matchAll(/<h3[^>]*>(.*?)<\/h3>/g)].map(match => match[1])
    expect(titles).toEqual([ko.profileSection, ko.visibilityGroup, ko.notifications, ko.account])
  })

  it('has no paragraph and every switch and field name', () => {
    expect(html).not.toMatch(/<p[\s>]/)
    for (const label of [ko.visibility, ko.publicFollowing, ko.publicFollowers, ko.notifyComments, ko.notifyFollows, ko.notifyPosts, ko.name, ko.bio, ko.save]) expect(html).toContain(label)
    expect(html.match(/role="switch"/g)).toHaveLength(7)
  })

  it('shows the account section with sign-out and withdraw as buttons', () => {
    expect(html).toContain(ko.logout)
    expect(html).toContain(ko.withdraw)
  })
})

describe('settings tab label', () => {
  it('is the short word in every language, and the old key still resolves', () => {
    expect([communityCopy.ko.profile, communityCopy.en.profile, communityCopy.ja.profile]).toEqual(['설정', 'Settings', '設定'])
    expect(resolveMypageTab('profile', null)).toBe('profile')
    const tabs = renderToStaticMarkup(<MypageTabs activeTab="profile" onTabChange={() => {}} counts={{}} />)
    expect(tabs).toContain('>설정<')
    expect(tabs).not.toContain('프로필 설정')
  })
})
