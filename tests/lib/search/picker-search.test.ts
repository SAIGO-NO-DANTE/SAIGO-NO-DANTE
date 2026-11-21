import { describe, expect, it } from 'vitest'
import { identityIcon, pickerEntries, pickerFound } from '@/lib/search/picker-search'

type Row = { id: string; sinner?: string; name: string; en?: string; icon?: string }
const read = (row: Row) => ({ id: row.id, label: row.name, names: { ko: row.name, en: row.en }, sinner: row.sinner, icon: row.icon })
const idOf = (row: Row) => row.id
const ids = (rows: readonly Row[]) => rows.map(row => row.id)

const rows: Row[] = [
  { id: '1', sinner: 'faust', name: '쐐기 사무소 파우스트', en: 'Wedge Office Faust' },
  { id: '2', sinner: 'ryoshu', name: 'LCB 수감자' },
  { id: '3', sinner: 'faust', name: '료슈를 닮은 자' },
  { id: '4', sinner: 'yi-sang', name: '새벽 사무소 이상', icon: 'dawn.webp' },
]
const entries = pickerEntries('identity', rows, 'ko', read)

describe('picker entries', () => {
  it('name the sinner at the right edge in the page language, and carry the picture', () => {
    const ja = pickerEntries('identity', rows, 'ja', read)
    expect(ja[0]).toMatchObject({ type: 'identity', href: '1', label: '쐐기 사무소 파우스트', sublabel: 'ファウスト' })
    expect(ja[3].icon).toBe('dawn.webp')
    expect(entries[0].icon).toBeUndefined()
  })

  it('leave the sinner out when the rows have none (a picker of one sinner)', () => {
    const [one] = pickerEntries('ego', [{ id: 'e', name: '적안' }], 'ko', read)
    expect(one).toMatchObject({ type: 'ego', href: 'e' })
    expect(one.sublabel).toBeUndefined()
    expect(one.context).toBeUndefined()
  })
})

describe('identity icon', () => {
  it('is the normal art of the identity, and none without an art folder', () => {
    expect(identityIcon({ sinner_id: 'yi-sang', folder_name: 'Dawn Office', game_id: '10116' })).toContain('/sinners/yi-sang/identities/Dawn%20Office/10116_normal.webp')
    expect(identityIcon({ sinner_id: 'yi-sang', folder_name: null, game_id: null })).toBeUndefined()
  })
})

describe('picker search', () => {
  it('finds an item from a typo, from its initials and from another language', () => {
    expect(ids(pickerFound(entries, rows, idOf, '쇄기').list)).toEqual(['1'])
    expect(ids(pickerFound(entries, rows, idOf, 'ㅆㄱㅅㅁㅅ').list)).toEqual(['1'])
    expect(ids(pickerFound(entries, rows, idOf, 'wedge').list)).toEqual(['1'])
  })

  it('finds the items of a sinner by her name, below the items named so', () => {
    const { list, top } = pickerFound(entries, rows, idOf, '료슈')
    expect(ids(list)).toEqual(['3', '2'])
    expect(top.map(row => row.item.id)).toEqual(['3', '2'])
    expect(top[0].hit.entry.href).toBe('3')
  })

  it('lists at most the cap in the panel and every found item in the grid', () => {
    const many = Array.from({ length: 9 }, (_, i) => ({ id: `n${i}`, name: `불꽃 인격 ${i}` }))
    const found = pickerFound(pickerEntries('identity', many, 'ko', read), many, idOf, '불꽃')
    expect([found.list.length, found.top.length]).toEqual([9, 6])
  })

  it('keeps the grid to the items the host shows, so its other filters stay ANDed', () => {
    const visible = rows.filter(row => row.sinner !== 'ryoshu')
    expect(ids(pickerFound(entries, visible, idOf, '료슈').list)).toEqual(['3'])
  })

  it('does not suggest an item the host cannot pick, though its card stays in the grid', () => {
    const found = pickerFound(entries, rows, idOf, '료슈', row => row.id !== '3')
    expect(ids(found.list)).toEqual(['3', '2'])
    expect(found.top.map(row => row.item.id)).toEqual(['2'])
  })

  it('leaves the grid as it came, and suggests nothing, for an empty query', () => {
    const found = pickerFound(entries, rows, idOf, '  ')
    expect(found.list).toBe(rows)
    expect(found.top).toEqual([])
  })
})
