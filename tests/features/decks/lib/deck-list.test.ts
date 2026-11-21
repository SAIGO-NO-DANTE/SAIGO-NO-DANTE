import { describe, expect, it } from 'vitest'
import type { DeckSummary } from '@/components/cards/DeckCard'
import {
  appendCsvParam, buildDeckDerivedIndex, buildDeckPageParams, buildDeckServerQueryKey, collectFilterSinners,
  deriveDeckListData, filterDeckList, hasServerBackedFilterParams, mapDeck, mergeDeckRows, normalizeFormationCountParam,
  normalizeInfoScoreParam, normalizeSortKey,
} from '@/features/decks/lib/deck-list'

const slot = (id: string | null, slot_order: number, keywords: string[] | null = []) => ({
  slot_order,
  gacksung: false,
  identities: id ? { id, sinner_id: 's1', folder_name: null, game_id: null, keywords, name_kr: id } : null,
})
const deck = (id: string, over: Partial<DeckSummary> = {}): DeckSummary => ({
  id, title: id, description: null, tags: [], vote_count: 0, view_count: 0, created_at: '2026-01-01', ...over,
})

describe('param normalizers', () => {
  it('keeps popular, everything else is latest', () => {
    expect([normalizeSortKey('popular'), normalizeSortKey('latest'), normalizeSortKey(''), normalizeSortKey('Popular')]).toEqual(['popular', 'latest', 'latest', 'latest'])
  })

  it('accepts whole numbers 1-12 for the formation count', () => {
    const out = [null, 0, 1, 12, 13, 2.5, NaN, -1].map(normalizeFormationCountParam)
    expect(out).toEqual([null, null, 1, 12, null, null, null, null])
  })

  it('accepts whole numbers 1-3 for the info score', () => {
    const out = [null, 0, 1, 3, 4, 1.5, NaN].map(normalizeInfoScoreParam)
    expect(out).toEqual([null, null, 1, 3, null, null, null])
  })

  it('sets a csv parameter only when something is left after dropping empty values', () => {
    const params = new URLSearchParams()
    appendCsvParam(params, 'a', new Set(['x', '', 'y']))
    appendCsvParam(params, 'b', [])
    appendCsvParam(params, 'c', [''])
    expect(params.toString()).toBe('a=x%2Cy')
  })
})

describe('deck rows', () => {
  it('maps the author profile and nulls a missing one', () => {
    expect(mapDeck({ ...deck('a'), profiles: { username: 'u', avatar_url: 'p', public_profile: false } })).toMatchObject({ username: 'u', avatar_url: 'p', profile_public: false })
    expect(mapDeck({ ...deck('a'), profiles: null })).toMatchObject({ username: undefined, avatar_url: null, profile_public: undefined })
    expect(mapDeck({ ...deck('a'), profiles: { username: 'u' } }).avatar_url).toBeNull()
  })

  it('merges by id: the first position stays, the newest row wins', () => {
    const a1 = deck('a', { title: 'old' })
    const a2 = deck('a', { title: 'new' })
    const out = mergeDeckRows([a1, deck('b')], [deck('c'), a2])
    expect(out.map(d => d.id)).toEqual(['a', 'b', 'c'])
    expect(out[0].title).toBe('new')
    expect(mergeDeckRows([], [])).toEqual([])
  })

  it('indexes E.G.O and the formed identities (slot order below 99, with an identity)', () => {
    const d = deck('a', {
      deck_egos: [{ ego_id: 'e1' }, { ego_id: 'e2' }],
      deck_identities: [slot('i1', 0), slot('i2', 99), slot(null, 1), slot('i3', 5)],
    })
    expect(buildDeckDerivedIndex(d)).toEqual({ egoIds: ['e1', 'e2'], formedIdentityIds: ['i1', 'i3'] })
    expect(buildDeckDerivedIndex(deck('b'))).toEqual({ egoIds: [], formedIdentityIds: [] })
  })
})

describe('server query', () => {
  const base = {
    sort: 'latest' as const, search: '', contentType: '', tags: new Set<string>(), mainKeywords: new Set<string>(), mainKeywordMode: 'or' as const,
    keywordTags: new Set<string>(), keywordTagMode: 'or' as const, formationCount: null, minInfoScore: null, identityIds: new Set<string>(), identityMode: 'or' as const,
  }

  it('is only the sort when nothing is filtered', () => {
    expect(buildDeckServerQueryKey(base)).toBe('sort=latest')
    expect(hasServerBackedFilterParams('sort=latest')).toBe(false)
    expect(hasServerBackedFilterParams('lang=ko&sort=popular')).toBe(false)
  })

  it('writes every filter with its mode only when it has values, sorted by name', () => {
    const key = buildDeckServerQueryKey({
      ...base, sort: 'popular', search: '  양 ', contentType: 'guide', tags: new Set(['t1', 't2']), mainKeywords: new Set(['화상']), mainKeywordMode: 'and',
      keywordTags: new Set(['k']), keywordTagMode: 'and', formationCount: 6, minInfoScore: 2, identityIds: new Set(['x', 'y']), identityMode: 'and',
    })
    expect(key).toBe('content_type=guide&formation_count=6&identity_ids=x%2Cy&identity_mode=and&keyword_tag_mode=and&keyword_tags=k&main_keyword_mode=and&main_keywords=%ED%99%94%EC%83%81&min_info_score=2&q=%EC%96%91&sort=popular&tags=t1%2Ct2')
    expect(hasServerBackedFilterParams(key)).toBe(true)
  })

  it('leaves a mode out when its list is empty, and a blank search', () => {
    expect(buildDeckServerQueryKey({ ...base, search: '   ', mainKeywordMode: 'and', keywordTagMode: 'and', identityMode: 'and' })).toBe('sort=latest')
  })

  it('adds the page window to the key', () => {
    expect(buildDeckPageParams('sort=latest', 24).toString()).toBe('sort=latest&limit=12&offset=24')
  })
})

describe('deriveDeckListData', () => {
  it('counts tags (top 12) and keywords, folding sub-keywords into the theme keyword', () => {
    const decks = [
      deck('a', { tags: ['t1', 't2'], deck_identities: [slot('i1', 0, [' 화상 ', '', '충전']), slot('i2', 99, ['화상'])] }),
      deck('b', { tags: ['t1'], deck_identities: [slot('i3', 1, ['화상', '진동']), slot(null, 2, ['x'])] }),
    ]
    const out = deriveDeckListData(decks)
    expect(out.allTags).toEqual(['t1', 't2'])
    expect(out.keywordCandidates).toEqual(['화상', '진동', '충전'])
    expect(out.availableKeywords).toEqual(['참격', '관통', '타격', '화상', '파열', '침잠', '호흡', '진동', '충전', '출혈'])
    expect(out.byId.get('a')).toEqual({ egoIds: [], formedIdentityIds: ['i1'] })
  })

  it('keeps 12 tags, ordered by count and then by first appearance', () => {
    const tags = Array.from({ length: 15 }, (_, i) => `t${i}`)
    const out = deriveDeckListData([deck('a', { tags }), deck('b', { tags: ['t14'] })])
    expect(out.allTags).toHaveLength(12)
    expect(out.allTags[0]).toBe('t14')
  })

  it('is empty for no decks', () => {
    const out = deriveDeckListData([])
    expect(out.allTags).toEqual([])
    expect(out.keywordCandidates).toEqual([])
    expect(out.byId.size).toBe(0)
  })
})

describe('collectFilterSinners', () => {
  it('lists each sinner once in order and skips identities without one', () => {
    const s = (id: string, order_num: number) => ({ id, name_kr: id, order_num })
    expect(collectFilterSinners([{ sinner: s('b', 2) }, { sinner: null }, { sinner: s('a', 1) }, { sinner: s('b', 2) }, {}]).map(x => x.id)).toEqual(['a', 'b'])
  })
})

describe('filterDeckList', () => {
  const decks = [
    deck('a', { deck_egos: [{ ego_id: 'e1' }], deck_identities: [slot('i1', 0), slot('i9', 99)] }),
    deck('b', { deck_egos: [{ ego_id: 'e2' }], deck_identities: [slot('i2', 0)] }),
    deck('c', { deck_identities: [slot('i1', 0), slot('i2', 1)] }),
  ]
  const { byId } = deriveDeckListData(decks)
  const none = { filterOwnedIdentity: false, filterOwnedEgo: false, effectiveOwned: null, affiliation: [], ego: [], identityAffiliations: undefined }
  const ids = (list: DeckSummary[]) => list.map(d => d.id)

  it('returns the same list when no filter is on', () => {
    expect(filterDeckList(decks, byId, none)).toBe(decks)
  })

  it('does nothing for the owned filters without a collection', () => {
    expect(filterDeckList(decks, byId, { ...none, filterOwnedIdentity: true, filterOwnedEgo: true })).toBe(decks)
  })

  it('keeps decks whose formed identities are all owned (a waiting identity may be missing)', () => {
    expect(ids(filterDeckList(decks, byId, { ...none, filterOwnedIdentity: true, effectiveOwned: new Set(['i1']) }))).toEqual(['a'])
    expect(ids(filterDeckList(decks, byId, { ...none, filterOwnedIdentity: true, effectiveOwned: new Set(['i1', 'i2']) }))).toEqual(['a', 'b', 'c'])
  })

  it('keeps decks whose E.G.O are all owned, and decks without E.G.O', () => {
    expect(ids(filterDeckList(decks, byId, { ...none, filterOwnedEgo: true, effectiveOwned: new Set(['e1']) }))).toEqual(['a', 'c'])
    expect(ids(filterDeckList(decks, byId, { ...none, filterOwnedEgo: true, effectiveOwned: new Set<string>() }))).toEqual(['c'])
  })

  it('narrows by affiliation over the formed identities, and by E.G.O', () => {
    const identityAffiliations = { i1: ['W', 'X'], i2: ['Y'], i9: ['Z'] }
    expect(ids(filterDeckList(decks, byId, { ...none, affiliation: ['W'], identityAffiliations }))).toEqual(['a', 'c'])
    expect(ids(filterDeckList(decks, byId, { ...none, affiliation: ['W', 'Y'], identityAffiliations }))).toEqual(['c'])
    expect(ids(filterDeckList(decks, byId, { ...none, affiliation: ['Z'], identityAffiliations }))).toEqual([])
    expect(ids(filterDeckList(decks, byId, { ...none, affiliation: ['W'], identityAffiliations: undefined }))).toEqual([])
    expect(ids(filterDeckList(decks, byId, { ...none, ego: ['e2'] }))).toEqual(['b'])
    expect(ids(filterDeckList(decks, byId, { ...none, ego: ['e1', 'e2'] }))).toEqual([])
  })
})
