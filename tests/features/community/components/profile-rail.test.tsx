import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

vi.mock('next-intl', () => ({ useLocale: () => 'ko' }))
vi.mock('@/lib/i18n/navigation', () => ({
  Link: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) => <a href={href} className={className}>{children}</a>,
}))
vi.mock('@/lib/toast', () => ({ showError: vi.fn(), showSuccess: vi.fn() }))
vi.mock('@/features/community/components/Follows', () => ({ FollowSummary: () => <div data-follow-summary="" /> }))

import ProfileRail, { ProfileMore } from '@/features/community/components/ProfileRail'
import { communityCopy } from '@/features/community/lib/copy'
import type { CommunityProfile } from '@/features/community/lib/rules'

const ko = communityCopy.ko
const data = {
  profile: { id: 'u1', username: 'QA', bio: '소개 글', avatar_url: null, created_at: '2026-09-01T00:00:00Z', public_profile: true },
  stats: { points: 120, deck: 3, plan: 1, like: 5, contribution: 0 },
  decks: [], plans: [],
} as unknown as CommunityProfile

describe('profile rail', () => {
  const html = renderToStaticMarkup(<ProfileRail data={data} mine onOpenFollows={() => {}} />)

  it('has each test id once', () => {
    expect(html.match(/data-testid="community-profile"/g)).toHaveLength(1)
    expect(html.match(/data-testid="activity-points"/g)).toHaveLength(1)
  })

  it('writes the four figures as label and number pairs, without icons or tiles', () => {
    const list = html.match(/<dl[^>]*>[\s\S]*?<\/dl>/)![0]
    expect(list.match(/<dt>/g)).toHaveLength(4)
    expect(list.match(/<dd>/g)).toHaveLength(4)
    for (const [label, value] of [[ko.deck, 3], [ko.plan, 1], [ko.like, 5], [ko.contribution, 0]] as const) expect(list).toContain(`<dt>${label}</dt><dd>${value}</dd>`)
    expect(list).not.toContain('<svg')
  })

  it('keeps the public profile link and the copy button for the owner only', () => {
    expect(html).toContain(ko.view)
    expect(html).toContain(`aria-label="${ko.share}"`)
    const visitor = renderToStaticMarkup(<ProfileRail data={data} />)
    expect(visitor).not.toContain(ko.view)
    expect(visitor).not.toContain(`aria-label="${ko.share}"`)
    expect(visitor).toContain('data-follow-summary')
  })

  it('collapses to one row on a phone only on my page', () => {
    expect(html).toContain('data-compact')
    expect(renderToStaticMarkup(<ProfileRail data={data} />)).not.toContain('data-compact')
  })
})

describe('the rest of the summary for the phone (top of the badges tab)', () => {
  const more = renderToStaticMarkup(<ProfileMore data={data} mine onOpenFollows={() => {}} />)

  it('carries what the one-row summary drops, with no test id of its own', () => {
    expect(more).not.toContain('data-testid')
    expect(more).toContain('소개 글')
    expect(more).toContain('data-follow-summary')
    expect(more).toContain(ko.view)
    expect(more.match(/<dt>/g)).toHaveLength(4)
  })
})
