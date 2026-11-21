import { describe, expect, it } from 'vitest'
import { keywordFilterEntries, keywordFilterRows } from '@/features/catalog/lib/keyword-suggestions'

const catalog = {
  화상: { nameEn: 'Burn', nameJp: '火傷' },
  출혈: { nameEn: 'Bleed', nameJp: '出血' },
  진동: { nameEn: 'Tremor', nameJp: '振動' },
  침잠: { nameEn: 'Sinking', nameJp: '沈潜' },
}
const entries = keywordFilterEntries(catalog, 'ko', key => `${key}.webp`)
const found = (query: string, selected: string[] = [], entriesOf = entries) => keywordFilterRows(entriesOf, query, new Set(selected)).map(row => row.keyword)

describe('the keyword filter search', () => {
  it('finds a keyword by its initials, a typo and its name in another language', () => {
    expect(found('ㅎㅅ')).toEqual(['화상'])
    expect(found('화샹')).toEqual(['화상'])
    expect(found('bleed')).toEqual(['출혈'])
    expect(found('burn', [], keywordFilterEntries(catalog, 'en', () => null))).toEqual(['화상'])
  })

  it('shows the keyword in the page language with its picture, and stands for it by its filter key', () => {
    const en = keywordFilterEntries(catalog, 'en', () => null)
    expect(en[0]).toMatchObject({ type: 'keyword', href: '화상', label: 'Burn' })
    expect(entries[0]).toMatchObject({ label: '화상', icon: '화상.webp' })
  })

  it('marks a keyword that is already a filter, and still lists it, so a pick can tell it is added', () => {
    expect(keywordFilterRows(entries, '화상', new Set(['화상']))).toMatchObject([{ keyword: '화상', added: true }])
    expect(keywordFilterRows(entries, '화상', new Set())).toMatchObject([{ keyword: '화상', added: false }])
  })

  it('lists at most six, best first, and nothing for an empty query', () => {
    const many = keywordFilterEntries(Object.fromEntries(Array.from({ length: 9 }, (_, i) => [`불꽃${i}`, {}])), 'ko', () => null)
    expect(found('불꽃', [], many)).toHaveLength(6)
    expect(found('  ')).toEqual([])
  })
})
