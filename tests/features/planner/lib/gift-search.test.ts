import { describe, expect, it } from 'vitest'
import { search } from '@/lib/search/engine'
import type { GiftData } from '@/lib/planner/types'
import { giftEntries, giftGrid } from '@/features/planner/lib/gift-search'

const gift = (game_id: number, name: string, keyword: string, grade: string, effect_base: string | null, extra: Partial<GiftData> = {}) =>
  ({ id: `g${game_id}`, game_id, name, name_en: null, name_jp: null, keyword, grade, image_url: null, effect_base, ...extra }) as GiftData
const gifts = [
  gift(1, '쐐기 파편', '출혈', '1', '적에게 출혈 3 부여'),
  gift(2, '불꽃 깃털', '화상', '2', '적에게 화상 2 부여'),
  gift(3, '유리 조각', '진동', '1', '적의 화상 피해 증가'),
  gift(4, '화상 부적', '공통', '1', '<style="highlight">[Combustion]</style> 3 부여'),
]
const entries = giftEntries(gifts, { names: { Combustion: '화상' }, locale: 'ko' })
const ids = (list: readonly GiftData[]) => list.map(g => g.game_id)
const grid = (query: string, extra: Partial<Parameters<typeof giftGrid>[2]> = {}) => giftGrid(gifts, entries, { query, inKeyword: () => true, gradeOrder: ['1', '2'], ...extra })

describe('gift entries', () => {
  it('search the plain text of raw effects: names instead of [Id], no tags', () => {
    expect(search(entries, '화상 3 부여').map(hit => hit.entry.href)).toContain('g4')
    expect(entries[3].text).not.toContain('style')
  })

  it('fall back to the ids until the names are loaded, and read the older stored effect as written', () => {
    const early = giftEntries(gifts, { names: undefined, locale: 'ko' })
    expect(early[3].text).toContain('[Combustion]')
    expect(early[1].text).toBe('적에게 화상 2 부여')
  })

  it('read the effect in the page language when the gift has one', () => {
    const [en] = giftEntries([gift(5, '가', '화상', '1', '한글', { name_en: 'Gift', effect_base_en: 'English effect' })], { locale: 'en' })
    expect(en).toMatchObject({ label: 'Gift', text: 'English effect' })
  })
})

describe('the gift grid', () => {
  it('finds a gift by its effect word, with the gifts named so first', () => {
    const { byGrade, top } = grid('화상')
    expect(ids(byGrade.get('1')!)).toEqual([4, 3])
    expect(ids(byGrade.get('2')!)).toEqual([2])
    // the gifts found only by an effect are in the grid, not among the names
    expect(top.map(row => row.item.game_id)).toEqual([4, 2])
  })

  it('finds a gift from a typo and from its initials', () => {
    expect(ids(grid('쇄기').byGrade.get('1')!)).toEqual([1])
    expect(ids(grid('ㅂㄲㄱㅌ').byGrade.get('2')!)).toEqual([2])
  })

  it('keeps the keyword sidebar ANDed with the search', () => {
    const { byGrade, shown } = grid('화상', { inKeyword: g => g.keyword === '진동' })
    expect(ids(byGrade.get('1')!)).toEqual([3])
    expect(byGrade.get('2')).toEqual([])
    expect(shown).toBe(1)
  })

  it('keeps the grade groups, in the grade order, with the best match first inside each', () => {
    const { byGrade } = grid('화상', { gradeOrder: ['2', '1'] })
    expect([...byGrade.keys()]).toEqual(['2', '1'])
    expect(ids(byGrade.get('2')!)).toEqual([2])
    expect(ids(byGrade.get('1')!)).toEqual([4, 3])
  })

  it('with no query lists every gift of the keyword in the list order and suggests nothing', () => {
    const { byGrade, shown, top } = grid('', { inKeyword: g => g.keyword !== '진동' })
    expect(ids(byGrade.get('1')!)).toEqual([1, 4])
    expect(shown).toBe(3)
    expect(top).toEqual([])
  })

  it('does not suggest a gift whose card is disabled', () => {
    const { byGrade, top } = grid('화상', { pickable: g => g.game_id !== 4 })
    expect(ids(byGrade.get('1')!)).toEqual([4, 3])
    expect(top.map(row => row.item.game_id)).toEqual([2])
  })
})
