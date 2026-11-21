import { describe, expect, it } from 'vitest'
import type { EGO, Identity } from '@/lib/data/sinners'
import { filterSinnerEgos, filterSinnerIdentities } from '@/features/catalog/lib/sinner-filter'
import { searchNames } from '@/features/catalog/lib/catalog-suggestions'
import { sinnerEgoEntries, sinnerIdentityEntries } from '@/features/catalog/lib/sinner-search'

const identity = (id: string, name_kr: string, rarity: number, game_id: string) => ({ id, sinner_id: 'yi-sang', name_kr, rarity, game_id, keywords: [] }) as unknown as Identity
const ego = (id: string, name_kr: string, game_id: string) => ({ id, sinner_id: 'yi-sang', name_kr, grade: 'WAW', game_id, keywords: null, image_url: null }) as unknown as EGO
const ids = (rows: { id: string }[]) => rows.map(row => row.id)

// game ids order the list: the newest (largest) first
const identities = [
  identity('a', '불꽃 사무소 이상', 3, '10110'),
  identity('b', '불꽃', 2, '10120'),
  identity('c', '유리 조각', 3, '10130'),
  identity('d', '불꽃 깃털', 3, '10140'),
]
const base = { sortOrder: 'newest' as const, ownershipFilter: 'all' as const, ownedIds: null }
const found = (query: string) => searchNames(sinnerIdentityEntries(identities, 'ko'), query).hits

describe('the identities of a sinner', () => {
  const list = (over: Record<string, unknown> = {}) => ids(filterSinnerIdentities(identities, { ...base, rarityFilter: null, hits: found('불꽃'), sortPicked: false, ...over }))

  it('lists only the identities found, best match first while no sort is picked', () => {
    expect(list()).toEqual(['b', 'd', 'a'])
  })

  it('keeps the picked sort (newest or oldest first) over the search order', () => {
    expect(list({ sortPicked: true })).toEqual(['d', 'b', 'a'])
    expect(list({ sortPicked: true, sortOrder: 'oldest' })).toEqual(['a', 'b', 'd'])
  })

  it('still ANDs the rarity and ownership filters', () => {
    expect(list({ rarityFilter: '3성' })).toEqual(['d', 'a'])
    expect(list({ ownershipFilter: 'owned', ownedIds: new Set(['a', 'b']) })).toEqual(['b', 'a'])
    expect(list({ ownershipFilter: 'unowned', ownedIds: new Set(['a', 'b']) })).toEqual(['d'])
  })

  it('lists every identity in date order when nothing is searched', () => {
    expect(list({ hits: null })).toEqual(['d', 'c', 'b', 'a'])
    expect(list({ hits: null, sortOrder: 'oldest' })).toEqual(['a', 'b', 'c', 'd'])
  })

  it('lists none when nothing was found', () => {
    expect(list({ hits: found('zzzz') })).toEqual([])
  })
})

describe('the E.G.O of a sinner', () => {
  const egos = [ego('e1', '표상 방출기', '20102'), ego('e2', '표상', '20101'), ego('e3', '적안', '20103')]
  const hits = searchNames(sinnerEgoEntries(egos, 'ko'), '표상').hits
  const list = (over: Record<string, unknown> = {}) => ids(filterSinnerEgos(egos, { ...base, hits, sortPicked: false, ...over }))

  it('lists only the E.G.O found, best match first while no sort is picked, else by the picked sort', () => {
    expect(list()).toEqual(['e2', 'e1'])
    expect(list({ sortPicked: true })).toEqual(['e1', 'e2'])
    expect(list({ sortPicked: true, sortOrder: 'oldest' })).toEqual(['e2', 'e1'])
  })

  it('still ANDs the ownership filter', () => {
    expect(list({ ownershipFilter: 'owned', ownedIds: new Set(['e1']) })).toEqual(['e1'])
  })
})
