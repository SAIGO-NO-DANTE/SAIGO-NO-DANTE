import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

vi.mock('next-intl', () => ({ useLocale: () => 'ko' }))
vi.mock('next-auth/react', () => ({ useSession: () => ({ status: 'authenticated' }) }))
vi.mock('next/image', () => ({ default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} /> }))
vi.mock('@/lib/auth-return', () => ({ goToLogin: vi.fn() }))
vi.mock('@/lib/toast', () => ({ showError: vi.fn(), showSuccess: vi.fn() }))
vi.mock('@/components/ui/BaseModal', () => ({ default: () => null }))
vi.mock('@/lib/i18n/navigation', () => ({
  Link: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) => <a href={href} className={className}>{children}</a>,
}))
const person = (id: string, username: string, is_self = false) => ({ id, username, avatar_url: null, bio: null, is_following: false, is_self })
vi.mock('swr', () => ({
  default: () => ({ data: { owner: true, can_view: true, items: [person('a', 'Alpha'), person('b', 'Beta'), person('c', 'Gamma', true)] }, error: undefined, mutate: vi.fn() }),
  useSWRConfig: () => ({ mutate: vi.fn() }),
}))

import { FollowList } from '@/features/community/components/Follows'

describe('follow list', () => {
  const html = renderToStaticMarkup(<FollowList id="me" initialKind="followers" />)
  const rows = [...html.matchAll(/<li class="([^"]*)">/g)].map(match => match[1])

  it('keeps the named region, the list kind switch and one follow button per other person', () => {
    expect(html).toMatch(/<section[^>]*aria-label="팔로우 목록"/)
    expect(html.match(/aria-pressed="(true|false)"[^>]*>(?:<svg.*?<\/svg>)?(?:팔로잉|팔로워)</g)).toHaveLength(2)
    expect(html.match(/aria-label="(Alpha|Beta) 팔로우"/g)).toHaveLength(2)
  })

  it('lists each person as a row inside the region, with a hairline under every row but the last', () => {
    expect(rows).toHaveLength(3)
    for (const row of rows) {
      expect(row).toContain('border-b')
      expect(row).toContain('last:border-b-0')
    }
  })

  it('wraps no row in a box: no background, no radius', () => {
    for (const row of rows) expect(row).not.toMatch(/\bbg-|\brounded|\bshadow/)
    expect(html.match(/<ul class="([^"]*)"/)![1]).not.toMatch(/\bbg-|\brounded|\bborder\b|\bp-\d/)
  })
})
