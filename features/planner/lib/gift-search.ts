import type { GiftData } from '@/lib/planner/types'
import type { IndexEntry } from '@/lib/search/engine'
import { pickerFound } from '@/lib/search/picker-search'
import { gameTextToPlain, mayBeRawGameText } from '@/lib/game-text/rich-text'
import { localizeRowName } from '@/lib/i18n/localize'
import type { SupportedLang } from '@/lib/i18n/types'

/**
 * One entry per gift: its names and keyword, and its base effect as `text`. Effects of raw game text are read as plain
 * text (`[Id]` as the name `names` gives it, tags dropped); older text as written. An entry's `href` is the gift's `id`.
 */
export function giftEntries(gifts: readonly GiftData[], { names, locale }: { names?: Readonly<Record<string, string>>; locale: SupportedLang }): IndexEntry[] {
  return gifts.map(gift => {
    const raw = (locale === 'en' ? gift.effect_base_en : locale === 'ja' ? gift.effect_base_jp : null) || gift.effect_base
    return {
      type: 'egoGift',
      href: gift.id,
      label: localizeRowName(gift, locale),
      icon: gift.image_url ?? undefined,
      names: { ko: gift.name, en: gift.name_en, ja: gift.name_jp },
      context: gift.keyword ? [{ field: 'keyword', text: gift.keyword }] : undefined,
      text: raw && mayBeRawGameText(raw) ? gameTextToPlain(raw, { names, locale }) : raw ?? undefined,
    }
  })
}

/**
 * The gift grid of a query: the gifts under the keyword filter (`inKeyword`) that it finds, grouped by grade in
 * `gradeOrder` (best match first inside a grade, list order for an empty query), how many there are, and `top`, the
 * first gifts to suggest by name (`pickable` leaves out those whose card is disabled; a gift found only by its effect is no name).
 */
export function giftGrid(gifts: readonly GiftData[], entries: IndexEntry[], { query, inKeyword, gradeOrder, pickable = () => true }: {
  query: string
  inKeyword: (gift: GiftData) => boolean
  gradeOrder: readonly string[]
  pickable?: (gift: GiftData) => boolean
}) {
  const { list, top } = pickerFound(entries, gifts.filter(inKeyword), gift => gift.id, query, (gift, hit) => hit.kind !== 'text' && pickable(gift))
  const byGrade = new Map<string, GiftData[]>(gradeOrder.map(grade => [grade, []]))
  for (const gift of list) {
    const grade = gift.grade ?? '1'
    if (!byGrade.has(grade)) byGrade.set(grade, [])
    byGrade.get(grade)!.push(gift)
  }
  return { byGrade, shown: list.length, top }
}
