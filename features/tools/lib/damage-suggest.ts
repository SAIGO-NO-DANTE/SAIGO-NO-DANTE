import { search, type IndexEntry } from '@/lib/search/engine'
import { MAX_MODIFIER_OPTIONS } from './damage'
import { effectSummary } from './damage-abilities'
import { effectsModifier, keywordModifier, type DamageSources, type DamageSuggestion, type SourceGroup } from './damage-sources'

/**
 * What a typed name may mean: the keywords and gifts the shared search finds by their shown name (initials, a typo,
 * spacing), best match first. A gift is offered once, at its first level: its enhancement level is switched where the
 * gift is edited. With a `group`, only that group is searched, and before a name is typed all of it is offered.
 */
export function suggestDamageSources(sources: DamageSources, query: string, { group, limit = group ? Infinity : 8 }: { group?: SourceGroup; limit?: number } = {}): DamageSuggestion[] {
  const typed = query.trim()
  if (!typed && !group) return []
  const rows: DamageSuggestion[] = []
  // The Korean name is searched too, so a page in another language still finds what the game's Korean text calls it.
  const entries: IndexEntry[] = []
  const add = (row: DamageSuggestion, ko: string) => {
    rows.push(row)
    entries.push({ type: row.kind === 'gift' ? 'egoGift' : 'keyword', href: row.key, label: row.label, names: { ko } })
  }
  for (const keyword of group === 'gift' ? [] : sources.keywords) {
    if (group && keyword.side !== group) continue
    const effectsOnly = keyword.effects?.length ? effectSummary(keyword.effects, 1) : null
    add({
      key: `k:${keyword.name}:${keyword.side}`, kind: 'keyword', label: keyword.label, modifier: keywordModifier(keyword),
      ...(keyword.stack ? { perStack: keyword.stack.perStack } : {}),
      // A scaled effect is offered per stack, a flat one as its value.
      ...(effectsOnly && keyword.effects!.some(effect => effect.scaled) ? { perStack: effectsOnly.value } : {}),
      ...(keyword.effects && !keyword.effects.length ? { inert: true } : {}),
    }, keyword.name)
  }
  for (const gift of group && group !== 'gift' ? [] : sources.gifts) {
    const stage = gift.stages[0] ?? { level: 0, values: [] as number[] }
    const values = stage.values.slice(0, MAX_MODIFIER_OPTIONS)
    const giftArt = { id: gift.id, level: stage.level, image_url: gift.image_url, grade: gift.grade, keyword: gift.keyword }
    add({ key: `g:${gift.id}`, kind: 'gift', label: gift.label, modifier: gift.effects?.length
      ? effectsModifier(gift.label, gift.effects, { gift: giftArt })
      : { name: gift.label, value: values[0] ?? 0, options: values, target: 'damage', gift: giftArt } }, gift.name)
  }
  if (!typed) return rows.slice(0, limit)
  const byKey = new Map(rows.map(row => [row.key, row]))
  const found = search(entries, typed).map(hit => byKey.get(hit.entry.href)!)
  // This list is the whole result, not a hint: a name that merely holds the typed text stays in it, after the engine's
  // matches (the engine itself skips one Latin letter or a lone consonant inside a name).
  const seen = new Set(found), needle = typed.toLocaleLowerCase()
  return [...found, ...rows.filter(row => !seen.has(row) && row.label.toLocaleLowerCase().includes(needle))].slice(0, limit)
}
