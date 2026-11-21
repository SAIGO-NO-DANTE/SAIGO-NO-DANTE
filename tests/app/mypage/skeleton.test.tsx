import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

vi.mock('next-intl', () => ({ useLocale: () => 'ko' }))
vi.mock('next-auth/react', () => ({ useSession: () => ({ status: 'loading' }) }))
vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams() }))
vi.mock('@/lib/i18n/navigation', () => ({ useRouter: () => ({ replace: vi.fn() }), Link: () => null }))
vi.mock('swr', () => ({ default: () => ({ data: undefined, error: undefined, isLoading: true, mutate: vi.fn() }) }))

import MypageClient, { MypageSkeleton } from '@/app/[lang]/mypage/MypageClient'

describe('my page skeleton', () => {
  const html = renderToStaticMarkup(<MypageSkeleton />)
  const bones = [...html.matchAll(/<div aria-hidden="true" data-skeleton="true" class="([^"]*)"/g)].map(match => match[1])

  it('announces itself as busy', () => {
    expect(html).toContain('role="status"')
    expect(html).toContain('aria-busy="true"')
  })

  it('draws the six tab rows of the rail, each 44px tall like the real tabs', () => {
    expect(bones.filter(bone => /\bh-11\b/.test(bone) && /\bshrink-0\b/.test(bone))).toHaveLength(6)
  })

  it('draws the rail summary (avatar and name line) and the default tab (switch, button, three cards)', () => {
    expect(bones.filter(bone => /\brounded-full\b/.test(bone))).toHaveLength(1)
    expect(bones.filter(bone => bone.includes('h-[17rem]'))).toHaveLength(3)
  })

  it('keeps the workspace marker on the page that shows it', () => {
    expect(readFileSync('app/[lang]/mypage/MypageClient.tsx', 'utf8')).toMatch(/useHtmlFlag\("with-mypage"\)/)
    expect(typeof MypageClient).toBe('function')
  })
})
