import type { Hit, IndexEntry } from '@/lib/search/engine'
import { sinnerTexts } from '@/lib/search/sinner-names'
import { isMotionEgo, type MotionEgo, type MotionIdentity, type MotionSinner, type MotionSkill } from './catalog'

// The search box of the skill motion page. An entry's `href` is `i:<slug>` (identity), `e:<E.G.O id>` or `s:<skill key>`.

/** A card of the list: an identity or E.G.O, with the skill when the search found that skill. */
export type MotionTarget = { sinnerId: string; owner: MotionIdentity | MotionEgo; skill?: MotionSkill }
export type MotionIndex = { entries: IndexEntry[]; targets: ReadonlyMap<string, MotionTarget> }

const ownerKey = (owner: MotionIdentity | MotionEgo) => isMotionEgo(owner) ? `e:${owner.egoId}` : `i:${owner.slug}`

/**
 * Identities and E.G.O (found by name, and by their sinner's name below those), and the skills of both (by title,
 * `sublabel` is whose skill it is, `icon` its owner's picture). `sinnerLabel` is the sinner's name in the page language.
 */
export function motionIndex(sinners: readonly MotionSinner[], sinnerLabel: (sinnerId: string) => string): MotionIndex {
  const entries: IndexEntry[] = []
  const targets = new Map<string, MotionTarget>()
  for (const sinner of sinners) {
    const context = sinnerTexts(sinner.id).map(text => ({ field: 'sinner' as const, text }))
    const add = (owner: MotionIdentity | MotionEgo) => {
      const icon = (isMotionEgo(owner) ? owner.image : owner.portrait) ?? undefined
      const key = ownerKey(owner)
      entries.push({ type: isMotionEgo(owner) ? 'ego' : 'identity', href: key, label: owner.label, sublabel: sinnerLabel(sinner.id), icon, names: {}, context })
      targets.set(key, { sinnerId: sinner.id, owner })
      for (const skill of owner.skills) {
        // type 'event': the lowest tie-break, under the names
        entries.push({ type: 'event', href: `s:${skill.key}`, label: skill.title, sublabel: owner.label, icon, names: {} })
        targets.set(`s:${skill.key}`, { sinnerId: sinner.id, owner, skill })
      }
    }
    sinner.identities.forEach(add)
    sinner.egos.forEach(add)
  }
  return { entries, targets }
}

/** Identities (4), E.G.O (4) and skills (4) for the suggestion panel. */
export function motionRows(hits: readonly Hit[]) {
  const of = (...types: IndexEntry['type'][]) => hits.filter(hit => types.includes(hit.entry.type)).slice(0, 4)
  return { identities: of('identity'), egos: of('ego'), skills: of('event') }
}

/** The cards the hits stand for, best first, one per owner: the skill shows only when the owner's own name was not found. */
export function motionMatches({ targets }: MotionIndex, hits: readonly Hit[]): MotionTarget[] {
  const named = new Set(hits.filter(hit => !hit.entry.href.startsWith('s:')).map(hit => hit.entry.href))
  const seen = new Set<string>()
  return hits.flatMap(hit => {
    const target = targets.get(hit.entry.href)!
    const key = ownerKey(target.owner)
    if (seen.has(key)) return []
    seen.add(key)
    return [named.has(key) ? { sinnerId: target.sinnerId, owner: target.owner } : target]
  })
}
