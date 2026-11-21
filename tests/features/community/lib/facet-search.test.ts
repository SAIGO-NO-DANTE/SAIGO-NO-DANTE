import { describe, expect, it } from 'vitest'
import { search } from '@/lib/search/engine'
import { affiliationEntries } from '@/features/community/lib/facet-search'
import { themePackEntries } from '@/lib/search/theme-pack-entries'

const affiliations = [{ key: '새벽 사무소', count: 12 }, { key: '검계', count: 3 }, { key: '어금니 사무소', count: 5 }]
const hrefs = (entries: ReturnType<typeof affiliationEntries>, query: string) => search(entries, query).map(hit => hit.entry.href)

describe('affiliation search', () => {
  const entries = affiliationEntries(affiliations, 'ko')

  it('finds an affiliation by its initials, a typo, and its name in another language', () => {
    expect(hrefs(entries, 'ㅅㅂㅅㅁㅅ')).toEqual(['새벽 사무소'])
    expect(hrefs(entries, '새벽 사무서')).toEqual(['새벽 사무소'])
    expect(hrefs(entries, 'molar')).toEqual(['어금니 사무소'])
  })

  it('stands for an affiliation by its key, which is what picking a row toggles, and shows its icon and name', () => {
    expect(entries.map(entry => entry.href)).toEqual(['새벽 사무소', '검계', '어금니 사무소'])
    expect(entries[0].icon).toContain('/assets/game-ui/affiliations/')
    expect(affiliationEntries(affiliations, 'en')[1].label).toBe('Blade Lineage')
  })

  it('has the same rows for themes: found by initials and a typo, standing for the pack id', () => {
    const themes = themePackEntries([{ id: 90001, name: '카지노 푸어', image_url: null }, { id: 90002, name: '기어오는 심연', image_url: null }], 'ko')
    expect(hrefs(themes, 'ㅋㅈㄴ')).toEqual(['90001'])
    expect(hrefs(themes, '기어오느 심연')).toEqual(['90002'])
  })
})
