import type { DeckSummary } from '@/components/cards/DeckCard'
import { THEME_KEYWORDS, normalizeThemeKeyword } from '@/lib/constants/keywords'
import { missingFormationCount } from '@/lib/collection'
import { DECK_MAIN_KEYWORDS } from '@/lib/decks/keyword-rules'
import type { DeckFilterSinner } from '../components/DeckIdentityFilterModal'

export const DECK_LIST_PAGE_SIZE = 12

const THEME_KEYWORD_SET = new Set<string>(THEME_KEYWORDS)
const PINNED_DECK_KEYWORDS = [...DECK_MAIN_KEYWORDS]

export type DeckSortKey = 'latest' | 'popular'

type DeckDerivedIndex = {
  egoIds: string[]
  /** Identities in the formation order (the board's affiliation facet reads these). */
  formedIdentityIds: string[]
}

export function buildDeckDerivedIndex(deck: DeckSummary): DeckDerivedIndex {
  return {
    egoIds: (deck.deck_egos ?? []).map(e => e.ego_id),
    formedIdentityIds: (deck.deck_identities ?? []).filter(slot => slot.slot_order < 99 && slot.identities?.id).map(slot => slot.identities!.id),
  }
}

export function mapDeck(d: { profiles?: { username?: string; avatar_url?: string | null; public_profile?: boolean } | null } & DeckSummary): DeckSummary {
  return { ...d, username: d.profiles?.username ?? undefined, avatar_url: d.profiles?.avatar_url ?? null, profile_public: d.profiles?.public_profile }
}

export function mergeDeckRows(existing: DeckSummary[], incoming: DeckSummary[]) {
  const byId = new Map<string, DeckSummary>()
  const orderedIds: string[] = []

  for (const deck of [...existing, ...incoming]) {
    if (!byId.has(deck.id)) orderedIds.push(deck.id)
    byId.set(deck.id, deck)
  }

  return orderedIds.map(id => byId.get(id)!)
}

export function normalizeSortKey(value: string): DeckSortKey {
  return value === 'popular' ? 'popular' : 'latest'
}

export function normalizeFormationCountParam(value: number | null) {
  return Number.isInteger(value) && value !== null && value >= 1 && value <= 12 ? value : null
}

export function normalizeInfoScoreParam(value: number | null) {
  return Number.isInteger(value) && value !== null && value >= 1 && value <= 3 ? value : null
}

export function appendCsvParam(params: URLSearchParams, name: string, values: Iterable<string>) {
  const serialized = [...values].filter(Boolean).join(',')
  if (serialized) params.set(name, serialized)
}

export type DeckServerQuery = {
  sort: DeckSortKey
  search: string
  contentType: string
  tags: ReadonlySet<string>
  mainKeywords: ReadonlySet<string>
  mainKeywordMode: 'or' | 'and'
  keywordTags: ReadonlySet<string>
  keywordTagMode: 'or' | 'and'
  formationCount: number | null
  minInfoScore: number | null
  identityIds: ReadonlySet<string>
  identityMode: 'or' | 'and'
}

/** The sorted query string the deck API is asked with; the list reloads when it changes. */
export function buildDeckServerQueryKey(query: DeckServerQuery) {
  const params = new URLSearchParams()
  params.set('sort', query.sort)
  if (query.search.trim()) params.set('q', query.search.trim())
  if (query.contentType) params.set('content_type', query.contentType)
  appendCsvParam(params, 'tags', query.tags)
  appendCsvParam(params, 'main_keywords', query.mainKeywords)
  if (query.mainKeywords.size > 0) params.set('main_keyword_mode', query.mainKeywordMode)
  appendCsvParam(params, 'keyword_tags', query.keywordTags)
  if (query.keywordTags.size > 0) params.set('keyword_tag_mode', query.keywordTagMode)
  if (query.formationCount !== null) params.set('formation_count', String(query.formationCount))
  if (query.minInfoScore !== null) params.set('min_info_score', String(query.minInfoScore))
  appendCsvParam(params, 'identity_ids', query.identityIds)
  if (query.identityIds.size > 0) params.set('identity_mode', query.identityMode)
  params.sort()
  return params.toString()
}

/** True when the query asks for anything besides the sort order (the server-rendered first page then no longer fits). */
export function hasServerBackedFilterParams(serverQueryKey: string) {
  const params = new URLSearchParams(serverQueryKey)
  params.delete('sort')
  params.delete('lang')
  return params.toString().length > 0
}

/** One page request of the deck API. */
export function buildDeckPageParams(serverQueryKey: string, offset: number) {
  const params = new URLSearchParams(serverQueryKey)
  params.set('limit', String(DECK_LIST_PAGE_SIZE))
  params.set('offset', String(offset))
  return params
}

/** Per-deck indexes and the tag and keyword choices counted over the decks loaded so far. */
export function deriveDeckListData(decks: DeckSummary[]) {
  const byId = new Map<string, DeckDerivedIndex>()
  const tagFreq: Record<string, number> = {}
  const keywordCandidateFreq: Record<string, number> = {}

  for (const d of decks) {
    const index = buildDeckDerivedIndex(d)
    byId.set(d.id, index)
    for (const slot of d.deck_identities ?? []) {
      const identity = slot?.identities
      if (!identity || slot.slot_order >= 99) continue
      for (const rawKeyword of identity.keywords ?? []) {
        const kw = rawKeyword.trim()
        if (!kw) continue
        keywordCandidateFreq[kw] = (keywordCandidateFreq[kw] ?? 0) + 1
        const normalized = normalizeThemeKeyword(kw)
        if (normalized !== kw && THEME_KEYWORD_SET.has(normalized)) {
          keywordCandidateFreq[normalized] = (keywordCandidateFreq[normalized] ?? 0) + 1
        }
      }
    }
    for (const t of d.tags ?? []) {
      tagFreq[t] = (tagFreq[t] ?? 0) + 1
    }
  }

  return {
    byId,
    allTags: Object.entries(tagFreq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12)
      .map(([tag]) => tag),
    availableKeywords: [
      ...PINNED_DECK_KEYWORDS,
    ],
    keywordCandidates: Object.entries(keywordCandidateFreq)
      .sort((a, b) => {
        if (b[1] !== a[1]) return b[1] - a[1]
        return a[0].localeCompare(b[0], 'ko')
      })
      .map(([kw]) => kw),
  }
}

/** The distinct sinners of the identities, in their order. */
export function collectFilterSinners(identities: { sinner?: DeckFilterSinner | null }[]) {
  const byId = new Map<string, DeckFilterSinner>()
  for (const identity of identities) {
    if (!identity.sinner) continue
    byId.set(identity.sinner.id, identity.sinner)
  }
  return [...byId.values()].sort((a, b) => a.order_num - b.order_num)
}

type DeckListClientFilter = {
  filterOwnedIdentity: boolean
  filterOwnedEgo: boolean
  effectiveOwned: ReadonlySet<string> | null | undefined
  affiliation: readonly string[]
  ego: readonly string[]
  identityAffiliations: Record<string, string[]> | undefined
}

const hasAll = (selected: readonly string[], values: ReadonlySet<string>) => selected.every(value => values.has(value))

/** The filters that only the browser can apply: owned identities and E.G.O, and the board's affiliation and E.G.O facets. */
export function filterDeckList(decks: DeckSummary[], byId: Map<string, DeckDerivedIndex>, filter: DeckListClientFilter) {
  const { filterOwnedIdentity, filterOwnedEgo, effectiveOwned, affiliation, ego, identityAffiliations } = filter
  let list = decks

  if (filterOwnedIdentity && effectiveOwned) {
    // 카드 뱃지와 같은 기준: 편성 순서가 있는 인격만(대기 인격은 없어도 된다)
    list = list.filter(d => missingFormationCount((d.deck_identities ?? []).map(slot => ({ id: slot.identities?.id, slot_order: slot.slot_order })), effectiveOwned) === 0)
  }

  if (filterOwnedEgo && effectiveOwned) {
    list = list.filter(d => {
      const egoIds = byId.get(d.id)?.egoIds ?? []
      return egoIds.length === 0 || egoIds.every(id => effectiveOwned.has(id))
    })
  }

  if (affiliation.length) list = list.filter(d => hasAll(affiliation, new Set((byId.get(d.id)?.formedIdentityIds ?? [])
    .flatMap(id => identityAffiliations?.[id] ?? []))))
  if (ego.length) list = list.filter(d => hasAll(ego, new Set(byId.get(d.id)?.egoIds ?? [])))

  return list
}
