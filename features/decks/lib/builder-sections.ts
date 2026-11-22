export type BuilderSection = 'formation' | 'analysis' | 'note'
export type FormationTab = 'identity' | 'ego' | 'skillset'

/** The builder's sections top to bottom; the analysis needs at least one identity, so it has no entry before that. */
export const builderSections = (hasInsights: boolean): BuilderSection[] => (hasInsights ? ['formation', 'analysis', 'note'] : ['formation', 'note'])

export const builderSectionId = (section: BuilderSection) => `deck-${section}`

/** An old `?tab=` link: the board tabs are the formation section's inner tabs now, and `note` is the note section. */
export function legacyTab(param: string | null | undefined): { tab: FormationTab; scrollTo: 'note' | null } {
  if (param === 'ego' || param === 'skillset') return { tab: param, scrollTo: null }
  return { tab: 'identity', scrollTo: param === 'note' ? 'note' : null }
}
