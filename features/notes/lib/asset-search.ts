import { search, type IndexEntry } from '@/lib/search/engine'
import type { NoteAssetData } from './assets'

// The picker's list is one SWR result; it is indexed once and every keystroke only matches.
const indexes = new WeakMap<readonly NoteAssetData[], IndexEntry[]>()

/** The ids of the assets whose names (in any language) the query finds, or null for no query: every asset stays. */
export function foundAssetIds(assets: readonly NoteAssetData[], query: string): Set<string> | null {
  if (!query.trim()) return null
  let index = indexes.get(assets)
  if (!index) {
    indexes.set(assets, index = assets.map(({ id, name, name_en, name_jp }) => ({ type: 'egoGift', href: id, label: name, names: { ko: name, en: name_en, ja: name_jp } })))
  }
  return new Set(search(index, query).map(hit => hit.entry.href))
}
