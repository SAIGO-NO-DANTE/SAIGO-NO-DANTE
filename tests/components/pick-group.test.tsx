import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { pickGroup } from '@/components/ui/SearchRows'
import { pickerEntries, pickerFound } from '@/lib/search/picker-search'

vi.mock('next/image', () => ({ default: () => null }))

type Row = { id: string; name: string }
const rows: Row[] = [{ id: 'a', name: '불꽃 깃털' }, { id: 'b', name: '불꽃놀이' }]
const entries = pickerEntries('identity', rows, 'ko', row => ({ id: row.id, label: row.name, names: { ko: row.name }, sinner: 'faust' }))

describe('a picker suggestion group', () => {
  // The shorter name is the closer match.
  const { top } = pickerFound(entries, rows, row => row.id, '불꽃')

  it('has one row per found item, keyed by the item, and picking a row hands over the item', () => {
    const picked: Row[] = []
    const group = pickGroup('인격', top, row => picked.push(row))
    expect(group.title).toBe('인격')
    expect(group.rows.map(row => row.key)).toEqual(['b', 'a'])
    group.rows[1].onPick()
    expect(picked).toEqual([rows[0]])
  })

  it('names the sinner at the right edge unless the host says otherwise', () => {
    const plain = renderToStaticMarkup(<>{pickGroup('인격', top, () => {}).rows[0].body}</>)
    expect(plain).toContain('파우스트')
    const custom = renderToStaticMarkup(<>{pickGroup('인격', top, () => {}, row => `글 ${row.id}`).rows[0].body}</>)
    expect(custom).toContain('글 b')
    expect(custom).not.toContain('파우스트')
  })
})
