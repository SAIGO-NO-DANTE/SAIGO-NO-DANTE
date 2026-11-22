import { describe, expect, it } from 'vitest'
import { expandIndex, fold, search, snippet, type IndexEntry } from '@/lib/search/engine'

const ryoshuCtx = [{ field: 'sinner' as const, text: '료슈' }, { field: 'sinner' as const, text: 'Ryōshū' }, { field: 'sinner' as const, text: '良秀' }]
const rodionCtx = [{ field: 'sinner' as const, text: '로쟈' }, { field: 'sinner' as const, text: 'Rodion' }, { field: 'alias' as const, text: 'Rodya' }]

const entries: IndexEntry[] = [
  { type: 'sinner', href: '/sinners/ryoshu', label: '료슈', names: { ko: '료슈', en: 'Ryōshū', ja: '良秀' } },
  { type: 'sinner', href: '/sinners/rodion', label: '로쟈', names: { ko: '로쟈', en: 'Rodion', ja: 'ロージャ' }, context: [{ field: 'alias', text: 'Rodya' }] },
  { type: 'identity', href: '/i/1', label: 'LCB 수감자', names: { ko: 'LCB 수감자', en: 'LCB Sinner', ja: 'LCB囚人' }, context: ryoshuCtx },
  { type: 'identity', href: '/i/2', label: '검계 살수', names: { ko: '검계 살수', en: 'Kurokumo Clan Wakashu', ja: '黒雲会 若衆' }, context: ryoshuCtx },
  { type: 'identity', href: '/i/3', label: 'LCB 수감자', names: { ko: 'LCB 수감자', en: 'LCB Sinner', ja: 'LCB囚人' }, context: rodionCtx },
  { type: 'ego', href: '/e/1', label: '적안', names: { ko: '적안', en: 'Red Eyes', ja: '赤眼' }, context: ryoshuCtx },
  { type: 'keyword', href: '/k/burn', label: '화상', names: { ko: '화상', en: 'Burn', ja: '火傷' } },
  { type: 'keyword', href: '/k/long', label: '레이피어로 몸에 10개 이상의 구멍을 내야할 때는…', names: { ko: '레이피어로 몸에 10개 이상의 구멍을 내야할 때는…' } },
  { type: 'egoGift', href: '/g/1', label: '불꽃 깃털', names: { ko: '불꽃 깃털' }, context: [{ field: 'keyword', text: '화상' }, { field: 'keyword', text: 'Burn' }] },
  { type: 'sinner', href: '/sinners/yi-sang', label: '이상', names: { ko: '이상', en: 'Yi Sang', ja: 'イサン' } },
  { type: 'sinner', href: '/sinners/meursault', label: '뫼르소', names: { ko: '뫼르소', en: 'Meursault', ja: 'ムルソー' } },
  { type: 'page', href: '/decks', label: '덱 게시판', names: { ko: '덱 게시판', en: 'Deck Board', ja: 'デッキ掲示板' }, context: [{ field: 'alias', text: '편성' }] },
]

const hrefs = (q: string) => search(entries, q).map(h => h.entry.href)

describe('fold', () => {
  it('drops separators, case, width and latin diacritics, and maps back to the original', () => {
    const f = fold('Ryōshū LCB')
    expect(f.text).toBe('ryoshulcb')
    expect(f.map[6]).toBe(7)
  })
  it('folds katakana to hiragana', () => {
    expect(fold('ロージャ').text).toBe(fold('ろーじゃ').text)
  })
})

describe('search ranking', () => {
  it('a sinner name finds that sinner first, then their identities and E.G.O through the sinner context', () => {
    const r = hrefs('료슈')
    expect(r[0]).toBe('/sinners/ryoshu')
    expect(r).toEqual(expect.arrayContaining(['/i/1', '/i/2', '/e/1']))
    expect(r).not.toContain('/i/3')
  })
  it('ignores latin diacritics and finds aliases', () => {
    expect(hrefs('ryoshu')[0]).toBe('/sinners/ryoshu')
    expect(hrefs('rodya')[0]).toBe('/sinners/rodion')
    expect(hrefs('rodya')).toContain('/i/3')
  })
  it('exact > prefix > word start > contains, shorter names first', () => {
    expect(hrefs('이상')[0]).toBe('/sinners/yi-sang')
    expect(hrefs('이상').indexOf('/k/long')).toBeGreaterThan(0)
    expect(hrefs('수감자')).toEqual(expect.arrayContaining(['/i/1', '/i/3']))
  })
  it('does not match 초성-only or one-letter queries in the middle of a name', () => {
    expect(hrefs('ㄹㅅ')).toContain('/sinners/ryoshu')
    expect(hrefs('ㄹㅅ')).not.toContain('/k/long')
    expect(hrefs('l')).not.toContain('/sinners/meursault')
  })
  it('multi-word queries match across name and context', () => {
    const r = hrefs('료슈 LCB')
    expect(r[0]).toBe('/i/1')
    expect(r).not.toContain('/i/3')
  })
  it('gift keywords are context: the keyword itself ranks above its gifts', () => {
    const r = hrefs('화상')
    expect(r[0]).toBe('/k/burn')
    expect(r).toContain('/g/1')
  })
  it('falls back to similar names only when nothing matches', () => {
    expect(hrefs('검살')).toContain('/i/2')
    expect(hrefs('meursalt')).toContain('/sinners/meursault')
    expect(search(entries, '검살').every(h => h.reasons[0].field === 'fuzzy')).toBe(true)
  })
  it('pages are searchable by name and alias', () => {
    expect(hrefs('덱')[0]).toBe('/decks')
    expect(hrefs('편성')).toContain('/decks')
  })
})

describe('search reasons', () => {
  it('marks the matched letters of the shown label', () => {
    const hit = search(entries, 'lcb수감')[0]
    expect(hit.reasons[0]).toEqual({ field: 'label', text: 'LCB 수감자', ranges: [[0, 6]] })
  })
  it('names the field when the label itself did not match', () => {
    const hit = search(entries, 'red eye').find(h => h.entry.href === '/e/1')!
    expect(hit.reasons[0]).toEqual({ field: 'en', text: 'Red Eyes', ranges: [[0, 7]] })
    const ctx = search(entries, '료슈').find(h => h.entry.href === '/i/2')!
    expect(ctx.reasons[0]).toEqual({ field: 'sinner', text: '료슈', ranges: [[0, 2]] })
  })
  it('marks 초성 matches on the syllables they hit', () => {
    const hit = search(entries, 'ㅎㅅ').find(h => h.entry.href === '/k/burn')!
    expect(hit.reasons[0].ranges).toEqual([[0, 2]])
  })
  it('gives one reason per word for multi-word queries', () => {
    const hit = search(entries, '료슈 LCB')[0]
    expect(hit.reasons.map(r => r.field).sort()).toEqual(['label', 'sinner'])
  })
})

describe('expandIndex', () => {
  it('gives identities their sinner names and aliases as context and completes storage paths', () => {
    const [, identity] = expandIndex([
      { type: 'sinner', href: '/sinners/rodion', label: '로쟈', names: { ko: '로쟈', en: 'Rodion', ja: 'ロージャ' }, context: [{ field: 'alias', text: 'Rodya' }] },
      { type: 'identity', href: '/i/3', label: 'LCB 수감자', names: { ko: 'LCB 수감자' }, sinner: 'rodion', icon: 'identities/a.webp' },
    ], 'https://cdn')
    expect(identity.context).toEqual(['로쟈', 'Rodion', 'ロージャ', 'Rodya'].map(text => ({ field: 'sinner', text })))
    expect(identity.icon).toBe('https://cdn/identities/a.webp')
  })
})

const named = (label: string, extra: Partial<IndexEntry> = {}): IndexEntry =>
  ({ type: 'identity', href: `/n/${label}`, label, names: { ko: label }, ...extra })
const wedge = [named('쐐기 사무소 대표'), named('쐐기 사무소 해결사'), named('화상', { type: 'keyword' })]
const one = (e: IndexEntry, q: string) => search([e], q)[0]

describe('hangul typos', () => {
  it('finds a name by jamo distance across the dropped space, as the lowest kind', () => {
    for (const q of ['쇄기사무소', '쇄기']) {
      const r = search(wedge, q)
      expect(r.map(h => h.entry.label)).toEqual(expect.arrayContaining(['쐐기 사무소 대표', '쐐기 사무소 해결사']))
      for (const h of r) {
        expect(h.kind).toBe('typo')
        expect(h.similarity).toBeGreaterThanOrEqual(0.3)
        expect(h.similarity).toBeLessThanOrEqual(0.45)
      }
    }
  })
  it('marks only the letters that equal the query, in order', () => {
    expect(search([named('쐐기 사무소 대표')], '쇄기')[0].reasons[0]).toEqual({ field: 'fuzzy', text: '쐐기 사무소 대표', ranges: [[1, 2]] })
  })
  it('adds typo hits below solid ones, and none with three solid hits', () => {
    const solid = ['쇄기 모음', '쇄기 둘', '쇄기 셋']
    const two = search([named('쐐기 사무소'), ...solid.slice(0, 2).map(l => named(l))], '쇄기')
    expect(two.map(h => h.kind)).toEqual(['prefix', 'prefix', 'typo'])
    const three = search([named('쐐기 사무소'), ...solid.map(l => named(l))], '쇄기')
    expect(three).toHaveLength(3)
    expect(three.some(h => h.kind === 'typo')).toBe(false)
  })
  it('keeps the budget: none under 4 jamo, 1 for 4-7, 2 from 8, and a tense/plain swap costs half', () => {
    expect(search([named('쏙')], '쇡')).toEqual([])
    expect(search([named('화산')], '화상')[0].kind).toBe('typo')
    expect(search([named('하산')], '화상')).toEqual([])
    expect(search([named('쐐기 삼무소')], '쇄기사무소')[0].kind).toBe('typo')
    expect(search([named('쐐기 삼문서')], '쇄기사무소')).toEqual([])
    expect(one(named('쐐기'), '쇄기').similarity).toBeCloseTo(0.4125)
    expect(one(named('세기'), '쇄기').similarity).toBeCloseTo(0.375)
  })
  it('does not start a typo match in the middle of a word', () => {
    expect(search([named('합성 재료 소모')], '료슈')).toEqual([])
    expect(search([named('강한 쐐기')], '쇄기')[0].kind).toBe('typo')
  })
  it('adds no typo hits when a name is exactly the query', () => {
    expect(search([named('화상'), named('박힌 화살')], '화상').map(h => h.entry.label)).toEqual(['화상'])
  })
  it('does not end a typo match in the middle of a syllable', () => {
    expect(search([named('1호선')], '호수')).toEqual([])
    expect(search([named('진동 폭발')], '진둥')[0].kind).toBe('typo')
  })
  it('keeps the english one-edit fallback', () => {
    const r = search(entries, 'meursalt')
    expect(r[0].entry.href).toBe('/sinners/meursault')
    expect(r[0].kind).toBe('typo')
  })
})

describe('a syllable still being typed', () => {
  it.each(['화ㅅ', '화사', '홧'])('%s finds 화상 without calling it a typo', q => {
    const hit = one(named('화상'), q)
    expect(hit).toBeDefined()
    expect(hit.kind).not.toBe('typo')
    expect(hit.reasons[0].ranges).toEqual([[0, 2]])
  })
  it('counts as the kind it would otherwise be', () => {
    expect(one(named('화상 피해'), '화사').kind).toBe('prefix')
    expect(one(named('강한 화상'), '화사').kind).toBe('word')
  })
  it('never calls a half-typed match exact, and ranks it under a whole one', () => {
    expect(one(named('화상'), '화ㅅ').kind).toBe('prefix')
    expect(search([named('화상 피해'), named('화사한 날')], '화사').map(h => h.entry.label)).toEqual(['화사한 날', '화상 피해'])
  })
  it('a single letter only reaches into the next syllable with its final consonant', () => {
    expect(search([named('일반'), named('이름')], '이').map(h => h.entry.label)).toEqual(['이름'])
    expect(one(named('하나'), '한').kind).toBe('prefix')
  })
  it('one whole syllable also matches inside a name, under the names that start with it', () => {
    expect(search([named('불꽃 깃털'), named('꽃잎')], '꽃').map(h => h.entry.label)).toEqual(['꽃잎', '불꽃 깃털'])
    expect(one(named('취약'), '약').kind).toBe('contains')
    // a Latin letter or a lone consonant still says too little to match mid-name
    expect(search([named('abc')], 'b')).toEqual([])
    expect(search([named('불꽃')], 'ㄲ')).toEqual([])
  })
})

describe('a match through context only', () => {
  it('scores under every name match and over body text', () => {
    const sim = one(named('LCB 수감자', { context: [{ field: 'sinner', text: '료슈' }] }), '료슈').similarity
    expect(sim).toBeLessThan(0.6)
    expect(sim).toBeGreaterThan(0.5)
  })
})

describe('similarity and kind', () => {
  it('maps each way of matching to its value', () => {
    const cases: [IndexEntry, string, string, number][] = [
      [named('화상'), '화상', 'exact', 1],
      [named('화상 피해'), '화상', 'prefix', 0.9],
      [named('강한 화상'), '화상', 'word', 0.8],
      [named('아주화상'), '화상', 'contains', 0.7],
      [named('쐐기 사무소'), 'ㅆㄱ', 'initials', 0.6],
      [named('료슈', { context: [{ field: 'sinner', text: 'LCB' }] }), '료슈 lcb', 'words', 0.5],
      [named('불꽃', { text: '화상 3 부여' }), '부여', 'text', 0.4],
    ]
    for (const [e, q, kind, sim] of cases) expect([q, one(e, q).kind, one(e, q).similarity]).toEqual([q, kind, sim])
  })
  it('keeps the initials hit in the same list as names', () => {
    expect(search(wedge, 'ㅆㄱ').map(h => h.kind)).toEqual(['initials', 'initials'])
  })
})

describe('body text', () => {
  const gift = named('불꽃 깃털', { text: '공격 시 화상 3 부여' })
  const byName = named('부여의 증표')
  it('finds text below any name hit and carries the snippet', () => {
    const r = search([gift, byName], '부여')
    expect(r.map(h => h.entry)).toEqual([byName, gift])
    expect(r[1].kind).toBe('text')
    expect(r[1].snippet).toEqual({ before: '공격 시 화상 3 ', hit: '부여', after: '' })
    expect(r[0].snippet).toBeUndefined()
  })
  it('does not look in the text of an entry whose name matched', () => {
    expect(one(named('부여', { text: '부여 부여' }), '부여').kind).toBe('exact')
  })
})

describe('snippet', () => {
  it('starts without an ellipsis at the start of the text', () => {
    expect(snippet('화상 3 부여', '화상', 3)).toEqual({ before: '', hit: '화상', after: ' 3 …' })
  })
  it('wraps the middle in ellipses', () => {
    expect(snippet('0123456789 화상 0123456789', '화상', 3)).toEqual({ before: '…89 ', hit: '화상', after: ' 01…' })
  })
  it('is null when absent', () => {
    expect(snippet('화상 3 부여', '출혈')).toBeNull()
  })
  it('matches folded text but returns the original slices', () => {
    expect(snippet('Gain  Red   Eyes now', 'redeyes', 4)).toEqual({ before: '…in  ', hit: 'Red   Eyes', after: ' now' })
  })
})

describe('speed', () => {
  it('searches 2,000 entries well inside a keystroke', () => {
    const many = Array.from({ length: 2000 }, (_, i) => named(`쐐기 사무소 ${i} 해결사`, { href: `/p/${i}`, names: { ko: `쐐기 사무소 ${i} 해결사`, en: `Wedge Office Fixer ${i}` } }))
    search(many, '워밍')
    const t = performance.now()
    search(many, '쇄기사무소')
    search(many, '화사')
    expect(performance.now() - t).toBeLessThan(150) // ~10 ms here; the margin is for slow CI runners
  })
})
