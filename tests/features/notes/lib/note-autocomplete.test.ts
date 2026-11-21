import { describe, expect, it } from 'vitest'
import { getNoteAutocompleteSuggestions, type AutocompleteSuggestion } from '@/features/notes/lib/autocomplete'

const item = (type: AutocompleteSuggestion['type'], label: string, token: string, extra: Partial<AutocompleteSuggestion> = {}): AutocompleteSuggestion =>
  ({ label, type, token, color: '#fff', syntax: 'inline', ...extra })
const keyword = (label: string) => item('keyword', label, `[k:${label}]`)
const labels = (list: AutocompleteSuggestion[]) => list.map(s => s.label)
const at = (text: string, pool: AutocompleteSuggestion[]) => getNoteAutocompleteSuggestions(text, text.length, pool)

const keywords = ['화상', '출혈', '진동', '진동 폭발', '충전', '침잠', '호흡', '쐐기'].map(keyword)

describe('note autocomplete: what a token value finds', () => {
  it('lists the first six of the kind for an empty value, in pool order', () => {
    expect(labels(at('[k:', keywords))).toEqual(['화상', '출혈', '진동', '진동 폭발', '충전', '침잠'])
  })

  it('finds a name by what is typed so far, its initials, a typo and the name without its spaces', () => {
    expect(labels(at('[k:화ㅅ', keywords))).toEqual(['화상'])
    expect(labels(at('[k:ㅊㅎ', keywords))).toEqual(['출혈'])
    expect(labels(at('[k:출핼', keywords))).toEqual(['출혈'])
    expect(labels(at('[k:쇄기', keywords))).toEqual(['쐐기'])
    expect(labels(at('[k:진동폭발', keywords))).toEqual(['진동 폭발'])
  })

  it('puts names that start with the query first, then the ones with it further in', () => {
    const pool = ['불꽃 화상', '화상 방어', '화상'].map(keyword)
    expect(labels(at('[k:화상', pool))).toEqual(['화상', '화상 방어', '불꽃 화상'])
    expect(labels(at('[k:진동', keywords))).toEqual(['진동', '진동 폭발'])
  })

  it('shows at most six', () => {
    const many = Array.from({ length: 9 }, (_, i) => keyword(`불꽃 ${i}`))
    expect(at('[k:불꽃', many)).toHaveLength(6)
  })

  it('gives back the pool\'s own objects', () => {
    const [first] = at('[k:화상', keywords)
    expect(first).toBe(keywords[0])
  })

  it('keeps to the kind typed, and to the block kind inside {{ }}', () => {
    const pool = [keyword('화상'), item('egogift', '화상 반지', '[g:화상 반지]'), item('egogift', '화상 카드', '{{gift:화상 카드}}', { syntax: 'block' })]
    expect(labels(at('[k:화상', pool))).toEqual(['화상'])
    expect(labels(at('[g:화상', pool))).toEqual(['화상 반지'])
    expect(labels(at('{{gift:화상', pool))).toEqual(['화상 카드'])
  })

  it('keeps to one sinner when the token names her, and finds her items by her name', () => {
    const pool = [
      item('identity', '새벽 사무소', '[i:이상:새벽 사무소]'),
      item('identity', '새벽 사무소', '[i:파우스트:새벽 사무소]'),
      item('identity', '이상을 닮은 자', '[i:파우스트:이상을 닮은 자]'),
    ]
    expect(at('[i:이상:', pool).map(s => s.token)).toEqual(['[i:이상:새벽 사무소]'])
    expect(at('[i:이상:새벽', pool).map(s => s.token)).toEqual(['[i:이상:새벽 사무소]'])
    expect(at('[i:이상', pool).map(s => s.token)).toEqual(['[i:파우스트:이상을 닮은 자]', '[i:이상:새벽 사무소]'])
  })

  it('finds an item by its other names', () => {
    const pool = [item('identity', '붉은 눈', '[i:로쟈:붉은 눈]', { aliases: ['Red Eyes'] })]
    expect(labels(at('[i:red eyes', pool))).toEqual(['붉은 눈'])
  })

  it('offers the token kinds for [ and {{, and nothing inside a finished token or in plain words', () => {
    expect(at('[', keywords)).toHaveLength(6)
    expect(at('{{', keywords)).toHaveLength(3)
    expect(labels(at('[sk', keywords))).toEqual(['스킬'])
    expect(at('[k:화상]', keywords)).toEqual([])
    expect(at('그냥 화상', keywords)).toEqual([])
  })
})
