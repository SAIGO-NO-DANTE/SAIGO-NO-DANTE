import type { IndexEntry } from '@/lib/search/engine'
import type { EGO, Identity } from '@/lib/data/sinners'
import { getLocalizedAffiliations } from '@/lib/i18n/localize'
import type { SupportedLang } from '@/lib/i18n/types'
import { egoEntries, identityEntries } from './catalog-suggestions'
import { getRepresentativeKeywords } from './representative-keywords'

// The search box of a sinner's page: its own identities and E.G.O. Every row belongs to the sinner, so her name is no context.

const keywordContext = (keywords: readonly string[] | null | undefined) => (keywords ?? []).map(text => ({ field: 'keyword' as const, text }))

/** Identities searched by name, affiliation (as written and in the page language) and the keywords their card shows. */
export function sinnerIdentityEntries(identities: readonly Identity[], lang: SupportedLang): IndexEntry[] {
  return identityEntries(identities, lang, identity => {
    const affiliations = [identity.affiliation, ...(identity.association_list ?? [])].filter((text): text is string => Boolean(text))
    return [...[...affiliations, ...getLocalizedAffiliations(affiliations, lang)].map(text => ({ field: 'alias' as const, text })), ...keywordContext(getRepresentativeKeywords(identity))]
  })
}

/** E.G.O searched by name and keyword. */
export function sinnerEgoEntries(egos: readonly EGO[], lang: SupportedLang): IndexEntry[] {
  return egoEntries(egos, lang, ego => keywordContext(ego.keywords))
}

/** The keywords of the page's rows; `sublabel` is how many rows have each. */
export function keywordStatEntries(stats: readonly { kw: string; count: number }[], icon: (keyword: string) => string | undefined): IndexEntry[] {
  return stats.map(({ kw, count }) => ({ type: 'keyword', href: kw, label: kw, sublabel: String(count), icon: icon(kw), names: { ko: kw } }))
}
