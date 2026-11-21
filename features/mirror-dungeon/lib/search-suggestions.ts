import { search, type Hit, type IndexEntry } from '@/lib/search/engine'
import { lastWord } from '@/lib/search/query'
import { gameTextToPlain, mayBeRawGameText } from '@/lib/game-text/rich-text'
import { localizeRowName } from '@/lib/i18n/localize'
import type { SupportedLang } from '@/lib/i18n/types'
import { getThemePackCompositeImageUrl, getThemePackVisualConfig } from '@/lib/data/theme-pack-visuals'
import type { EgoGift, EgoGiftTheme, MdEvent, MdEventChoice } from '@/features/mirror-dungeon/types'

// The suggestion panels of the gift, pack and event searches: what to index and which hits each group shows.
// An entry's `href` is the id of the thing it stands for (a gift's id, a pack's id, an event's id).

type Named = { name: string; name_en?: string | null; name_jp?: string | null }
const names = (row: Named) => ({ ko: row.name, en: row.name_en, ja: row.name_jp })

// Found through its gifts' names only, not by its own: the row belongs under the gifts, not among the names.
const viaContext = (hit: Hit) => hit.reasons.length > 0 && hit.reasons.every(reason => reason.field === 'keyword')

/** One entry per gift; its keyword and base effect are searchable too, and `sublabel` is the keyword's name. */
export function giftEntries(gifts: readonly EgoGift[], lang: SupportedLang, keywordName: (keyword: string) => string, refNames?: Readonly<Record<string, string>>): IndexEntry[] {
  return gifts.map(gift => {
    const keyword = keywordName(gift.keyword)
    const raw = (lang === 'en' ? gift.effect_base_en : lang === 'ja' ? gift.effect_base_jp : null) ?? gift.effect_base
    return {
      type: 'egoGift',
      href: gift.id,
      label: localizeRowName(gift, lang),
      sublabel: keyword,
      icon: gift.image_url ?? undefined,
      names: names(gift),
      context: [{ field: 'keyword', text: keyword }],
      text: raw && mayBeRawGameText(raw) ? gameTextToPlain(raw, { names: refNames, locale: lang }) : raw ?? undefined,
    }
  })
}

/** One entry per gift keyword that has gifts, in `order`; `sublabel` is how many gifts have it. */
export function keywordEntries(gifts: readonly EgoGift[], order: readonly string[], keywordName: (keyword: string) => string): IndexEntry[] {
  const counts = new Map<string, number>()
  for (const gift of gifts) counts.set(gift.keyword, (counts.get(gift.keyword) ?? 0) + 1)
  return order.flatMap(key => key === '공통' || !counts.has(key) ? [] : [{ type: 'keyword' as const, href: key, label: keywordName(key), sublabel: String(counts.get(key)), names: { ko: key } }])
}

/** Gift names as pack or event entries hold them: the page language and Korean. */
const giftNameContext = (gifts: readonly EgoGift[], lang: SupportedLang) =>
  gifts.flatMap(gift => [...new Set([localizeRowName(gift, lang), gift.name])].map(text => ({ field: 'keyword' as const, text })))

/** The gifts some source (a pack, an event) gives; `sublabel` is how many sources give each. */
export function givenGiftEntries(idLists: readonly (readonly number[])[], giftByGameId: ReadonlyMap<number, EgoGift>, lang: SupportedLang): IndexEntry[] {
  const counts = new Map<number, number>()
  for (const ids of idLists) for (const id of new Set(ids)) counts.set(id, (counts.get(id) ?? 0) + 1)
  return [...counts].flatMap(([id, count]) => {
    const gift = giftByGameId.get(id)
    return gift ? [{ type: 'egoGift' as const, href: gift.id, label: localizeRowName(gift, lang), icon: gift.image_url ?? undefined, sublabel: String(count), names: names(gift) }] : []
  })
}

/** One entry per pack; the names of its gifts are searchable too. */
export function packEntries(packs: readonly EgoGiftTheme[], giftByGameId: ReadonlyMap<number, EgoGift>, lang: SupportedLang): IndexEntry[] {
  return packs.map(pack => ({
    type: 'themePack',
    href: String(pack.id),
    label: localizeRowName(pack, lang),
    icon: (getThemePackVisualConfig(pack.id) ? getThemePackCompositeImageUrl(pack.id) : pack.image_url) ?? undefined,
    names: names(pack),
    context: giftNameContext(pack.ego_gift_ids.flatMap(id => giftByGameId.get(id) ?? []), lang),
  }))
}

/** One entry per event (name or title, description) with the names of its reward gifts searchable too. */
export function eventEntries(events: readonly MdEvent[], giftByGameId: ReadonlyMap<number, EgoGift>, lang: SupportedLang, title: (event: MdEvent) => string): IndexEntry[] {
  return events.map(event => ({
    type: 'event',
    href: String(event.id),
    label: title(event),
    icon: event.image_url ?? undefined,
    names: { ko: event.name, en: event.name_en, ja: event.name_jp },
    text: ((lang === 'en' ? event.desc_text_en : lang === 'ja' ? event.desc_text_jp : null) ?? event.desc_text) ?? undefined,
    context: giftNameContext((event.gift_ids ?? []).flatMap(id => giftByGameId.get(id) ?? []), lang),
  }))
}

/** One entry per choice with wording; it matches through its text only (an empty label never matches), `sublabel` is its event's title. */
export function choiceEntries(events: readonly MdEvent[], choicesByEventId: ReadonlyMap<number, readonly MdEventChoice[]>, title: (event: MdEvent) => string): IndexEntry[] {
  return events.flatMap(event => (choicesByEventId.get(event.id) ?? []).flatMap(choice => {
    const text = [choice.message, choice.message_desc].filter(Boolean).join(' ')
    return text ? [{ type: 'event' as const, href: `${event.id}:${choice.id}`, label: '', sublabel: title(event), names: {}, text }] : []
  }))
}

export interface GiftSuggestions { names: Hit[]; keywords: Hit[]; effects: Hit[] }

/**
 * Gift names (6; a typo sits below the exact hits), keywords the last word may mean (6) and gifts whose effect holds the
 * query without their name doing so (4). `usable` leaves out gifts the host cannot pick.
 */
export function giftSuggestions(gifts: IndexEntry[], keywords: IndexEntry[], query: string, usable: (giftId: string) => boolean): GiftSuggestions {
  if (!query.trim()) return { names: [], keywords: [], effects: [] }
  const hits = search(gifts, query).filter(hit => usable(hit.entry.href))
  return {
    names: hits.filter(hit => hit.kind !== 'text').slice(0, 6),
    keywords: search(keywords, lastWord(query)).slice(0, 6),
    effects: hits.filter(hit => hit.kind === 'text').slice(0, 4),
  }
}

/** Packs found by their own name (6) and the gifts some pack gives (6). */
export function packSuggestions(packs: IndexEntry[], gifts: IndexEntry[], query: string) {
  return { packs: search(packs, query).filter(hit => !viaContext(hit)).slice(0, 6), gifts: search(gifts, query).slice(0, 6) }
}

/** Events by name or description (5), choices by their wording (4) and reward gifts (3). */
export function eventSuggestions(events: IndexEntry[], choices: IndexEntry[], gifts: IndexEntry[], query: string) {
  return {
    events: search(events, query).filter(hit => !viaContext(hit)).slice(0, 5),
    choices: search(choices, query).slice(0, 4),
    gifts: search(gifts, query).slice(0, 3),
  }
}

/** Ids of the events the query finds, best first: the events themselves, then those with a choice that holds it. */
export function foundEventIds(events: IndexEntry[], choices: IndexEntry[], query: string): number[] {
  const ids = search(events, query).map(hit => Number(hit.entry.href))
  const seen = new Set(ids)
  for (const hit of search(choices, query)) {
    const id = Number(hit.entry.href.split(':')[0])
    if (!seen.has(id)) { seen.add(id); ids.push(id) }
  }
  return ids
}
