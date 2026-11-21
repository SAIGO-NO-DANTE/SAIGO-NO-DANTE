import { describe, expect, it } from 'vitest'
import type { EGO, Identity } from '@/lib/data/sinners'
import { searchNames } from '@/features/catalog/lib/catalog-suggestions'
import { keywordStatEntries, sinnerEgoEntries, sinnerIdentityEntries } from '@/features/catalog/lib/sinner-search'
import { lastWord, replaceLastWord } from '@/lib/search/query'

const identity = (id: string, name_kr: string, extra: Partial<Identity> = {}) =>
  ({ id, sinner_id: 'yi-sang', name_kr, rarity: 2, keywords: [], ...extra }) as Identity
const ego = (id: string, name_kr: string, extra: Partial<EGO> = {}) =>
  ({ id, sinner_id: 'yi-sang', name_kr, grade: 'WAW', keywords: null, image_url: null, ...extra }) as EGO
const ids = (hits: { entry: { href: string } }[]) => hits.map(hit => hit.entry.href)

const identities = [
  identity('1', '쐐기 사무소 이상'),
  identity('2', '거미집 검지 아비', { affiliation: '시지프', association_list: ['르누아르'], skill_keyword_list: ['출혈', '진동'] }),
  identity('3', '남부 세븐 협회', { keywords: ['화상'] }),
]

describe('identity search on a sinner page', () => {
  const entries = sinnerIdentityEntries(identities, 'ko')

  it('finds an identity from a mistyped name and from its initials', () => {
    expect(ids(searchNames(entries, '쇄기').hits)).toEqual(['1'])
    expect(ids(searchNames(entries, 'ㄱㅁㅈ').hits)).toEqual(['2'])
  })

  it('finds it by its affiliation, in the page language too', () => {
    expect(ids(searchNames(entries, '시지프').hits)).toEqual(['2'])
    expect(ids(searchNames(sinnerIdentityEntries(identities, 'en'), 'sisyphe').hits)).toEqual(['2'])
  })

  it('finds it by the keywords its card shows: the skills\' list, else its own', () => {
    expect(ids(searchNames(entries, '출혈').hits)).toEqual(['2'])
    expect(ids(searchNames(entries, '화상').hits)).toEqual(['3'])
  })

  it('does not find every identity of the page through its sinner', () => {
    expect(searchNames(entries, '이상').hits.map(hit => hit.entry.href)).toEqual(['1'])
  })
})

describe('E.G.O search on a sinner page', () => {
  const entries = sinnerEgoEntries([ego('e1', '표상 방출기'), ego('e2', '적안', { keywords: ['출혈'] })], 'ko')

  it('finds an E.G.O by a typo, its initials and its keywords', () => {
    expect(ids(searchNames(entries, '표샹').hits)).toEqual(['e1'])
    expect(ids(searchNames(entries, 'ㅈㅇ').hits)).toEqual(['e2'])
    expect(ids(searchNames(entries, '출혈').hits)).toEqual(['e2'])
  })
})

describe('keyword suggestions', () => {
  const stats = [{ kw: '화상', count: 7 }, { kw: '출혈', count: 5 }, { kw: '화염', count: 1 }]
  const entries = keywordStatEntries(stats, kw => `/icons/${kw}.webp`)

  it('lists the keywords the last word may mean, with their pictures and how many rows have each', () => {
    const { names } = searchNames(entries, lastWord('거미집 화'), 5)
    expect(names.map(hit => [hit.entry.label, hit.entry.sublabel, hit.entry.icon])).toEqual([['화상', '7', '/icons/화상.webp'], ['화염', '1', '/icons/화염.webp']])
  })

  it('completes the last word only', () => {
    expect(replaceLastWord('거미집 화', '화상')).toBe('거미집 화상')
  })

  it('caps the group', () => {
    const many = keywordStatEntries(Array.from({ length: 9 }, (_, i) => ({ kw: `화${i}`, count: i })), () => undefined)
    expect(searchNames(many, '화', 5).names).toHaveLength(5)
  })
})
