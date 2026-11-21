import { describe, expect, it } from 'vitest'
import { search } from '@/lib/search/engine'
import { keywordEntries, keywordRows } from '@/app/[lang]/keywords/_components/keyword-search'
import type { KeywordEntry } from '@/app/[lang]/keywords/_components/KeywordCard'

const keyword = (name: string, description: string, extra: Partial<KeywordEntry> = {}): KeywordEntry =>
  ({ name, description, max_stack: null, icon_slug: null, category: null, ...extra })

const keywords = [
  keyword('화상', '턴 종료 시 피해를 입힌다', { name_en: 'Burn', name_jp: '火傷' }),
  keyword('출혈', '코인을 굴릴 때 화상 피해를 입는다'),
  keyword('진동', '진동이 쌓이면 폭발한다'),
  keyword('쐐기', '충전한 힘을 한꺼번에 쏟아낸다'),
]
const index = keywordEntries(keywords, kw => kw.name, kw => kw.description ?? '', kw => `/icons/${kw.name}.webp`)
const hrefs = (hits: { entry: { href: string } }[]) => hits.map(hit => hit.entry.href)
const rows = (query: string) => keywordRows(search(index, query))

describe('keyword entries', () => {
  it('finds a keyword from a mistyped name, its initials and its names in other languages', () => {
    expect(hrefs(rows('쇄기').names)).toEqual(['쐐기'])
    expect(hrefs(rows('ㅈㄷ').names)).toEqual(['진동'])
    expect(hrefs(rows('burn').names)).toEqual(['화상'])
    expect(hrefs(rows('火傷').names)).toEqual(['화상'])
  })

  it('finds a keyword by its description, as a text row with the words around the match', () => {
    const { names, texts } = rows('폭발')
    expect(hrefs(names)).toEqual([])
    expect(texts.map(hit => [hit.entry.href, hit.snippet])).toEqual([['진동', { before: '진동이 쌓이면 ', hit: '폭발', after: '한다' }]])
  })

  it('does not list a keyword by its text when its name is already listed', () => {
    const { names, texts } = rows('화상')
    expect(hrefs(names)).toEqual(['화상'])
    // 화상 holds the word in no description of its own; 출혈 does, and is the only text row
    expect(hrefs(texts)).toEqual(['출혈'])
    const both = keywordEntries([keyword('화상', '화상을 입힌다')], kw => kw.name, kw => kw.description ?? '', () => null)
    expect(hrefs(keywordRows(search(both, '화상')).texts)).toEqual([])
  })

  it('shows the picture of the keyword', () => {
    expect(index[0]).toMatchObject({ label: '화상', icon: '/icons/화상.webp' })
  })

  it('caps the groups at 6 names and 4 texts', () => {
    const many = [
      ...Array.from({ length: 8 }, (_, i) => keyword(`불꽃 ${i}`, '')),
      ...Array.from({ length: 6 }, (_, i) => keyword(`철 ${i}`, '불꽃 피해')),
    ]
    const found = keywordRows(search(keywordEntries(many, kw => kw.name, kw => kw.description ?? '', () => null), '불꽃'))
    expect([found.names.length, found.texts.length]).toEqual([6, 4])
  })
})
