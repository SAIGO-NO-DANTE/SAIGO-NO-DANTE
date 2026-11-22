import type { ReactNode } from 'react'
import { builderSectionId, type BuilderSection } from '@/features/decks'

/** One section of the builder page: a heading and a hairline above, no box. */
export default function DeckSection({ section, title, children }: { section: BuilderSection; title: string; children: ReactNode }) {
  const id = builderSectionId(section)
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="deck-section">
      <h2 id={`${id}-title`} className="deck-section__title">{title}</h2>
      {children}
    </section>
  )
}
