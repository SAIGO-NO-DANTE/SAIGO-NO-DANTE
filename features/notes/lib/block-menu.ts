import { BLOCK_LABELS, type BlockKind } from '@/lib/notes/blocks'
import { search, type IndexEntry } from '@/lib/search/engine'

const KINDS = Object.keys(BLOCK_LABELS) as BlockKind[]
// Built once: the labels in three languages, the key typed after the slash (/ego) and the Korean way to say E.G.O.
const ENTRIES: IndexEntry[] = KINDS.map(kind => {
  const [ko, ja, en] = BLOCK_LABELS[kind]
  return { type: 'page', href: kind, label: ko, names: { ko, ja, en }, context: [kind, ...(kind === 'ego' ? ['에고'] : [])].map(text => ({ field: 'alias' as const, text })) }
})

/** The block kinds the text typed after `/` finds, best match first; all of them, in menu order, for no text. */
export function matchBlockKinds(query: string): BlockKind[] {
  return query.trim() ? search(ENTRIES, query).map(hit => hit.entry.href as BlockKind) : KINDS
}
