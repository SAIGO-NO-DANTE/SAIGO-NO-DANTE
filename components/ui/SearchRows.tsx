import type { ReactNode } from 'react'
import { SuggestCut, SuggestRow, nameMarks, type SuggestGroup } from '@/components/ui/SearchBox'
import type { Hit } from '@/lib/search/engine'

/** A suggestion group of name rows for hits whose entries carry their picture (`icon`); `right` overrides the note at the right edge (the entry's `sublabel`). */
export function nameGroup(title: string, hits: readonly Hit[], onPick: (hit: Hit) => void, right?: (hit: Hit) => ReactNode): SuggestGroup {
  return {
    title,
    rows: hits.map(hit => ({
      key: hit.entry.href,
      onPick: () => onPick(hit),
      body: <SuggestRow image={hit.entry.icon} name={hit.entry.label} marks={nameMarks(hit)} right={right ? right(hit) : hit.entry.sublabel} />,
    })),
  }
}

/** A suggestion group of text rows: the entry's name over the text around the match (hits with a `snippet`). */
export function cutGroup(title: string, hits: readonly Hit[], onPick: (hit: Hit) => void): SuggestGroup {
  return {
    title,
    rows: hits.map(hit => ({
      key: `t${hit.entry.href}`,
      onPick: () => onPick(hit),
      body: <SuggestCut image={hit.entry.icon} name={hit.entry.label} {...hit.snippet!} />,
    })),
  }
}
