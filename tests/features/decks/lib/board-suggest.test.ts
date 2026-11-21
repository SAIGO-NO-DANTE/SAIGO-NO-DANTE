import { describe, expect, it } from 'vitest'
import { boardEntries, boardSuggestions } from '@/features/decks/lib/board-suggest'
import type { IdentityNameEntry } from '@/features/decks/lib/filter-params'
import { getActiveTerm } from '@/lib/utils/search'

const identity = (id: string, sinner_id: string, name_kr: string, over: Partial<IdentityNameEntry> = {}) =>
  ({ id, name: name_kr, name_kr, sinner_id, folder_name: null, game_id: null, rarity: 1, ...over }) as IdentityNameEntry
const ids = (hits: { entry: { href: string } }[]) => hits.map(hit => hit.entry.href)

const identities = [
  identity('1', 'faust', '쐐기 사무소 파우스트', { name_en: 'Wedge Office Faust', game_id: '10101', folder_name: 'Wedge Office' }),
  identity('2', 'ryoshu', 'LCB 수감자'),
  identity('3', 'faust', '료슈를 닮은 자'),
]
const keywordInfo = { 화상: { nameEn: 'Burn', nameJp: '火傷' }, 출혈: { nameEn: 'Bleed' } }
const keywords = { names: ['화상', '출혈', '진동'], info: keywordInfo, icon: (kw: string) => `icon/${kw}.webp` }
const entries = boardEntries(identities, keywords, 'ko')
// What the boards complete: the text after the last + or * (spaces stay inside it).
const found = (input: string, pool = entries) => boardSuggestions(pool, getActiveTerm(input).activeTerm)

describe('board suggestions', () => {
  it('finds an identity from a mistyped name, its initials and its English name', () => {
    expect(ids(found('쇄기').identities)).toEqual(['1'])
    expect(ids(found('ㅆㄱㅅㅁㅅ').identities)).toEqual(['1'])
    expect(ids(found('wedge').identities)).toEqual(['1'])
  })

  it('finds the identities of a sinner by her name, below the identities named so', () => {
    expect(ids(found('료슈').identities)).toEqual(['3', '2'])
  })

  it('finds a keyword in the page language and by its Korean name, and completes with the Korean name', () => {
    const en = boardEntries(identities, keywords, 'en')
    const [hit] = found('burn', en).keywords
    expect(hit.entry.label).toBe('Burn')
    expect(hit.entry.names.ko).toBe('화상')
    expect(ids(found('화ㅅ', en).keywords)).toEqual(['화상'])
    expect(ids(found('ㅊㅎ').keywords)).toEqual(['출혈'])
    expect(ids(found('출핼').keywords)).toEqual(['출혈'])
  })

  it('keeps the identities and the keywords in their own lists, five rows each', () => {
    const many = boardEntries(
      Array.from({ length: 9 }, (_, i) => identity(`n${i}`, 'faust', `불꽃 인격 ${i}`)),
      { names: Array.from({ length: 9 }, (_, i) => `불꽃${i}`), info: {}, icon: () => null },
      'ko',
    )
    const out = found('불꽃', many)
    expect([out.identities.length, out.keywords.length]).toEqual([5, 5])
    expect(out.identities.every(hit => hit.entry.type === 'identity')).toBe(true)
    expect(out.keywords.every(hit => hit.entry.type === 'keyword')).toBe(true)
  })

  it('completes the term after the last + or *, and a term with spaces', () => {
    expect(ids(found('화상 + 쇄기').identities)).toEqual(['1'])
    expect(ids(found('화상*쇄기').identities)).toEqual(['1'])
    expect(ids(found('a + b * 쇄기').identities)).toEqual(['1'])
    expect(ids(found('쐐기 파우').identities)).toEqual(['1'])
    expect(ids(found('쇄기 사무').identities)).toEqual(['1'])
  })

  it('offers nothing while the term is empty', () => {
    expect(found('')).toEqual({ identities: [], keywords: [] })
    expect(found('화상 + ')).toEqual({ identities: [], keywords: [] })
    expect(found('화상*  ')).toEqual({ identities: [], keywords: [] })
  })

  it('shows the sinner at the right edge, the identity picture only when it has both ids, and the keyword icon', () => {
    expect(entries[0]).toMatchObject({ sublabel: '파우스트' })
    expect(entries[0].icon).toContain('/sinners/faust/identities/Wedge%20Office/10101_normal.webp')
    expect(entries[1].icon).toBeUndefined()
    expect(boardEntries(identities, keywords, 'en')[1].sublabel).toBe('Ryōshū')
    expect(entries.find(entry => entry.href === '화상')!.icon).toBe('icon/화상.webp')
  })

  it('always labels an identity with the Korean name it enters into the search', () => {
    expect(boardEntries(identities, keywords, 'ja')[0]).toMatchObject({ label: '쐐기 사무소 파우스트', names: { ko: '쐐기 사무소 파우스트', en: 'Wedge Office Faust' } })
  })

  it('searches boards that offer only keywords', () => {
    const only = boardEntries([], keywords, 'ko')
    expect(ids(boardSuggestions(only, '화상').keywords)).toEqual(['화상'])
    expect(boardSuggestions(only, '화상').identities).toEqual([])
  })
})
