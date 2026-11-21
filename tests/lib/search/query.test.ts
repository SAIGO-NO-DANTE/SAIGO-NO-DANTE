import { describe, expect, it } from 'vitest'
import { search, type IndexEntry } from '@/lib/search/engine'
import { keepFound, lastWord, replaceLastWord } from '@/lib/search/query'
import { sinnerName, sinnerTexts } from '@/lib/search/sinner-names'

const entry = (href: string, label: string): IndexEntry => ({ type: 'identity', href, label, names: { ko: label } })
const entries = [entry('a', '불꽃 깃털'), entry('b', '불꽃'), entry('c', '유리 조각')]
const items = [{ id: 'c' }, { id: 'a' }, { id: 'b' }, { id: 'x' }]

describe('the last word of a query', () => {
  it('is what a keyword suggestion completes, and replaceLastWord swaps only that word', () => {
    expect(lastWord('적에게 화')).toBe('화')
    expect(lastWord('  ')).toBe('')
    expect(replaceLastWord('적에게 화', '화상')).toBe('적에게 화상')
    expect(replaceLastWord('화', '화상')).toBe('화상')
    expect(replaceLastWord('  A  B  ', 'C')).toBe('A C')
  })
})

describe('keepFound', () => {
  const hits = search(entries, '불꽃')

  it('keeps only the items a hit stands for, best match first', () => {
    expect(keepFound(items, hits, item => item.id, false).map(item => item.id)).toEqual(['b', 'a'])
  })

  it('keeps the order the items came in when asked (the person picked a sort)', () => {
    expect(keepFound(items, hits, item => item.id, true).map(item => item.id)).toEqual(['a', 'b'])
  })

  it('returns nothing when nothing was found', () => {
    expect(keepFound(items, [], item => item.id, false)).toEqual([])
  })
})

describe('sinner names', () => {
  it('lists the names in three languages and the aliases', () => {
    expect(sinnerTexts('don-quixote')).toEqual(['돈키호테', 'Don Quixote', 'ドンキホーテ', '동키호테', 'Donqui'])
    expect(sinnerTexts('nobody')).toEqual([])
  })

  it('names a sinner in the page language, and falls back to the id', () => {
    expect(sinnerName('faust', 'ko')).toBe('파우스트')
    expect(sinnerName('faust', 'ja')).toBe('ファウスト')
    expect(sinnerName('nobody', 'en')).toBe('nobody')
  })
})
