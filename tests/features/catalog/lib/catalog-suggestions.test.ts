import { describe, expect, it } from 'vitest'
import { egoEntries, identityEntries, searchNames, sinnerContext } from '@/features/catalog/lib/catalog-suggestions'

const identity = (id: string, sinner_id: string, name_kr: string, extra: Record<string, unknown> = {}) =>
  ({ id, sinner_id, name: name_kr, name_kr, name_en: null, name_jp: null, folder_name: null, game_id: null, ...extra })
const ego = (id: string, sinner_id: string, name_kr: string, extra: Record<string, unknown> = {}) =>
  ({ id, sinner_id, name: name_kr, name_kr, name_en: null, name_jp: null, image_url: null, ...extra })
const ids = (hits: { entry: { href: string } }[]) => hits.map(hit => hit.entry.href)
const withSinner = (row: { sinner_id: string }) => sinnerContext(row.sinner_id)

const identities = [
  identity('1', 'faust', '쐐기 사무소 파우스트', { name_en: 'Wedge Office Faust', name_jp: '楔事務所ファウスト' }),
  identity('2', 'ryoshu', 'LCB 수감자'),
  identity('3', 'faust', '료슈를 닮은 자'),
  identity('4', 'yi-sang', '새벽 사무소 이상', { folder_name: 'Dawn Office', game_id: '10116' }),
]
const entries = identityEntries(identities, 'ko', withSinner)

describe('identity entries', () => {
  it('finds an identity from a mistyped name and from its initials', () => {
    expect(ids(searchNames(entries, '쇄기').hits)).toEqual(['1'])
    expect(ids(searchNames(entries, 'ㅆㄱㅅㅁㅅ').hits)).toEqual(['1'])
  })

  it('finds it by its names in the other languages and a syllable still being typed', () => {
    expect(ids(searchNames(entries, 'wedge').hits)).toEqual(['1'])
    expect(ids(searchNames(entries, '楔事務所').hits)).toEqual(['1'])
    expect(ids(searchNames(entries, '새벽 사무ㅅ').hits)).toContain('4')
  })

  it('finds the identities of a sinner by her name, below the identities named so', () => {
    expect(ids(searchNames(entries, '료슈').hits)).toEqual(['3', '2'])
  })

  it('shows the name in the page language, the sinner at the right edge and the picture of the identity', () => {
    const ja = identityEntries(identities, 'ja', withSinner)
    expect(ja[0]).toMatchObject({ label: '楔事務所ファウスト', sublabel: 'ファウスト' })
    expect(entries[0].icon).toBeUndefined()
    expect(entries[3].icon).toContain('/sinners/yi-sang/identities/Dawn%20Office/10116_normal.webp')
  })

  it('lists no more names than the cap, and all the hits for the list', () => {
    const many = identityEntries(Array.from({ length: 9 }, (_, i) => identity(`n${i}`, 'faust', `불꽃 인격 ${i}`)), 'ko', () => [])
    const found = searchNames(many, '불꽃')
    expect([found.hits.length, found.names.length]).toEqual([9, 6])
    expect(searchNames(many, '불꽃', 3).names).toHaveLength(3)
  })

  it('finds nothing for an empty query', () => {
    expect(searchNames(entries, '  ')).toEqual({ hits: [], names: [] })
  })
})

describe('E.G.O entries', () => {
  const egos = [ego('e1', 'ryoshu', '적안', { name_en: 'Red Eyes', image_url: 'ego/e1.webp' }), ego('e2', 'faust', '표상 방출기'), ego('e3', 'faust', '료슈의 검')]
  const found = egoEntries(egos, 'en', withSinner)

  it('names, pictures and finds like identities do', () => {
    expect(found[0]).toMatchObject({ type: 'ego', label: 'Red Eyes', icon: 'ego/e1.webp', sublabel: 'Ryōshū' })
    expect(ids(searchNames(found, 'red ayes').hits)).toEqual(['e1'])
    expect(ids(searchNames(found, 'ㅍㅅㅂㅊㄱ').hits)).toEqual(['e2'])
  })

  it('finds the E.G.O of a sinner by her name, below the E.G.O named so', () => {
    expect(ids(searchNames(found, '료슈').hits)).toEqual(['e3', 'e1'])
  })

  it('falls back to the name column when the Korean name is empty', () => {
    const [row] = egoEntries([ego('e4', 'faust', '', { name: 'Fallback' })], 'ko', () => [])
    expect(row).toMatchObject({ label: 'Fallback', names: { ko: 'Fallback' } })
  })
})
