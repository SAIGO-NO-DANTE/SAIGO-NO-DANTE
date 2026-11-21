// What the game's own effect texts say about skill damage, read from the Korean source text (ego_gifts.effect_base,
// keyword_meta.description). Gifts carry their numbers nowhere else in the extracted data (limbus-asset-extractor/site-sync/docs/provenance.md).

import type { SupportedLang } from '@/lib/i18n/types'
import type { KeywordInfo } from '@/lib/keywords/catalog'
import { type SavedModifier } from './damage-types'
import { MAX_MODIFIER_OPTIONS } from './damage'
import { type AbilityEffect } from './damage-types'
import { effectSummary, readAbilities, readGiftModifiers, type GiftModifier, type KeywordAbility } from './damage-abilities'

// The first three are the attack types (physical resistance), the rest the sins.
const ATTRIBUTES = ['참격', '관통', '타격', '분노', '색욕', '나태', '탐식', '우울', '오만', '질투']
// "한 턴 동안 관통 스킬로 받는 피해가 수치에 비례하여 증가 (최대 10)"; the general keyword names no attribute, a sin is "나태 속성 스킬로".
const PROPORTIONAL = new RegExp(`(?:(${ATTRIBUTES.join('|')})(?: 속성)? )?스킬로 (받는|가하는) 피해가 수치에 비례하여 (증가|감소)(?:\\s*\\(최대 (\\d+)\\))?`)
// "대상의 참격 내성을 (스택 * 0.1) 증가"; the game also writes "관통 속성 내성". Only a resistance it names: "모든 내성" is not one value to raise.
const WEAKENING = new RegExp(`(${ATTRIBUTES.join('|')})(?: 속성)? 내성을 \\((?:스택|수치)\\s*[*xX×]\\s*(\\d+(?:\\.\\d+)?)\\)\\s*증가`)
// "In proportion to the count" is 10% a stack in the game data (TakeAtkDamageMultiplierByStack / AtkDamageMultiplierByStack ±0.1); the text does not say it.
const PROPORTION = 10
export const MAX_STACKS = 10

/** Who carries an effect: the attacker (damage dealt) or the target (damage taken, resistances). */
type Side = 'self' | 'target'
/** perStack: percent for damage, a resistance value for physical and sin. */
export type StackEffect = { target: 'damage' | 'physical' | 'sin'; perStack: number; max: number; side: Side }

// Listed by kind (Fragile, Protection, Damage Up, Damage Down, weakenings), and within a kind the general keyword first, then attack types, then sins.
function readStack(text: string): { effect: StackEffect; rank: number } | null {
  const proportional = PROPORTIONAL.exec(text)
  if (proportional) {
    const [, attribute, verb, word, max] = proportional
    const taken = verb === '받는', more = word === '증가'
    return {
      effect: { target: 'damage', perStack: more ? PROPORTION : -PROPORTION, max: max ? Number(max) : MAX_STACKS, side: taken ? 'target' : 'self' },
      rank: ((taken ? 0 : 2) + (more ? 0 : 1)) * 100 + ATTRIBUTES.indexOf(attribute) + 1,
    }
  }
  const weakening = WEAKENING.exec(text)
  if (!weakening) return null
  const attribute = ATTRIBUTES.indexOf(weakening[1])
  return { effect: { target: attribute < 3 ? 'physical' : 'sin', perStack: Number(weakening[2]), max: MAX_STACKS, side: 'target' }, rank: 400 + attribute + 1 }
}

/**
 * The keywords whose effect is their stack count, known by the sentence of their Korean text, not by their name: damage
 * dealt or taken "in proportion to the count" changes by 10% a stack (Protection, Fragile, Damage Up and Down, general,
 * per attack type and per sin), and a weakening raises its resistance by the amount it states. A keyword the game adds
 * with either sentence is a stack keyword without a change here.
 */
export const stackEffect = (text: string): StackEffect | null => readStack(text)?.effect ?? null

export const mentionsDamage = (text: string) => text.includes('피해')

// Either "피해량 +(…)%" (a formula: its sign optional, its direction possibly the word after it) or a percent, with what may
// stand around it: 최대 before (also "최대 3, 30%"), a sign, 증가/감소 after.
const TOKEN = /(피해량?(?:이|을|가)?\s*([+＋\-−])?\s*\([^()]*\)\s*%(?:만큼)?\s*(증가|감소)?)|(최대\s*(?:\d+(?:\.\d+)?\s*,\s*)?)?([+＋\-−])?\s*(\d+(?:\.\d+)?)\s*%(?:\s*(증가|감소))?/g
// Damage of an effect (bleed, sinking …, also written as the game's [Keyword] placeholder), to SP or to a shield, not of the skill.
const EFFECT_DAMAGE = /(출혈|화상|파열|침잠|진동|정신력)\s*(피해|효과[로가와])|\[\w+\]\s*(피해|효과[로가와])|보호막에/
// It is the enemy who takes it.
const FOE = /(적|대상)(?:이|가|은)?\s*받는/
const direction = (sign: string | undefined, word?: string) => sign === '-' || sign === '−' || (!sign && word === '감소') ? -1 : 1

/**
 * value: the signed percent, null for a formula that states no maximum. taken: the damage its holder takes ("받는"), not
 * deals. foe: it is the enemy who takes it ("적이 받는"), so it raises what the attacker deals.
 */
type DamageChange = { value: number | null; taken: boolean; foe: boolean }

// While a line is read, a change also remembers its direction, for the maximum that may follow it.
type Found = DamageChange & { sign: number }

/**
 * The changes a text makes to skill damage, in the order written. A change that scales ("…당 +10% (최대 30%)",
 * "+(합 횟수 x 6)% (최대 30%)") counts as its stated maximum.
 */
// Pattern matching on game sentences; a wrong or missing value is corrected by the user in the calculator. If the game data ever carries gift ability values, read those instead.
export function damageChanges(text: string): DamageChange[] {
  const changes: DamageChange[] = []
  // A maximum written on its own line belongs to the line above it.
  for (const line of text.replace(/<[^>]+>/g, '').replace(/\n\s*(?=\(최대)/g, ' ').split('\n')) {
    if (!mentionsDamage(line)) continue
    // The change a following "(최대 N%)" belongs to.
    let open: Found | null = null
    const found: Found[] = []
    for (const match of line.matchAll(TOKEN)) {
      const [, formula, formulaSign, formulaWord, maximum, sign, number, word] = match
      if (maximum) {
        if (open) open.value = open.sign * Number(number)
        open = null
        continue
      }
      // A percent speaks of damage when "피해" stands in its own clause: "크리티컬 확률 +10%, 피해량 +20%" has one.
      const start = line.lastIndexOf(',', match.index) + 1
      const clause = line.slice(start, match.index + (formula ? formula.length : 0))
      // A bare percent right after "피해량" is an increase ("가하는 피해량 10% (최대 30%)").
      const by = formula ? direction(formulaSign, formulaWord) : sign || word ? direction(sign, word) : /피해량?\s*$/.test(clause) ? 1 : 0
      // "피해량의 10%만큼 회복" is a share of the damage, not a change of it.
      if (!by || !clause.includes('피해') || /의\s*$/.test(clause) || EFFECT_DAMAGE.test(clause)) { open = null; continue }
      // Taken, not dealt: "받는 피해량", or the clause before it sets the scene ("피해를 받을 때, 피해량 -25%").
      const taken = clause.includes('받는') || /피해를?\s*받(을 때|으면|을 경우)\s*,\s*$/.test(line.slice(0, start))
      found.push(open = { value: formula ? null : by * Number(number), taken, foe: taken && FOE.test(clause), sign: by })
    }
    for (const { value, taken, foe } of found) changes.push({ value, taken, foe })
    // A formula in a form the pattern does not read (nested brackets, the formula before the word, "N%씩") is still a
    // change: its stated maximum when it has one, else unknown, so it stays on offer for the user to give its value.
    if (!found.length && line.includes('피해량') && /\)\s*%|%\s*씩/.test(line) && !line.includes('피해량의') && !EFFECT_DAMAGE.test(line)) {
      const maximum = /최대\s*(\d+(?:\.\d+)?)\s*%/.exec(line)
      const taken = line.includes('받는')
      changes.push({ value: maximum ? (line.includes('감소') ? -1 : 1) * Number(maximum[1]) : null, taken, foe: taken && FOE.test(line) })
    }
  }
  return changes
}

const valuesOf = (changes: DamageChange[]) => [...new Set(changes.flatMap(change => change.value === null ? [] : [change.value]))]

/** The percents by which a text changes skill damage, signed, without repeats (a formula without a maximum has none). */
export const damageValues = (text: string) => valuesOf(damageChanges(text))

/** The ego_gifts columns the list is built from. */
export type GiftSourceRow = {
  game_id: number | null; name: string; name_en: string | null; name_jp: string | null
  grade: string | null; keyword: string | null; image_url: string | null
  effect_base: string | null; effect_plus: string | null; effect_plusplus: string | null
  effect_base_en: string | null; effect_plus_en: string | null; effect_plusplus_en: string | null
  effect_base_jp: string | null; effect_plus_jp: string | null; effect_plusplus_jp: string | null
  /** ego_gifts.modifiers: the gift's damage numbers as the game holds them (null / absent: read the sentences). */
  modifiers?: GiftModifier[] | null
}

/** The most stacks a keyword without a stated maximum is offered up to. */
export const DEFAULT_MAX_STACKS = 99

export type DamageSources = {
  /** name: the Korean keyword name (the catalog key). */
  keywords: {
    name: string; label: string; text: string; values: number[]; stack: StackEffect | null; side: Side
    /** Read from the keyword's game values (keyword_meta.abilities); a keyword with these has no `stack`. */
    effects?: AbilityEffect[]
    /** Abilities that touch damage and are not in the interpretation table: shown as not calculated. */
    unsupported?: number
    maxStack?: number
  }[]
  /** stages: one per enhancement level the gift has (0 base, 1 +, 2 ++). */
  gifts: {
    id: string; name: string; label: string; grade: string | null; keyword: string | null; image_url: string | null; stages: { level: number; text: string; values: number[] }[]
    /** Read from ego_gifts.modifiers; when present the stage values are not used. */
    effects?: AbilityEffect[]
  }[]
}

const inLanguage = (lang: SupportedLang, ko: string, en?: string | null, ja?: string | null) => (lang === 'en' ? en : lang === 'ja' ? ja : null) || ko

/**
 * The keywords and gifts the calculator offers: those whose text changes skill damage. Values always come from the
 * Korean text (damageChanges); names and texts are shown in `lang`, Korean where a translation is missing.
 * - Stack keywords come first. Any other keyword is on the side of what it changes: damage it deals on the attacker's,
 *   damage it takes on the target's, and on both, each with its own values, when it changes both.
 * - A gift counts what the attacker deals and what the enemy takes, not what allies take.
 */
export function buildDamageSources(
  keywords: Record<string, Pick<KeywordInfo, 'desc' | 'nameEn' | 'nameJp' | 'descEn' | 'descJp'> & { maxStack?: number }>,
  gifts: readonly GiftSourceRow[],
  lang: SupportedLang,
  abilities: Readonly<Record<string, readonly KeywordAbility[]>> = {},
): DamageSources {
  const stackRows: (DamageSources['keywords'][number] & { rank: number })[] = []
  const inertRows: DamageSources['keywords'] = []
  const keywordRows: DamageSources['keywords'] = []
  for (const [name, info] of Object.entries(keywords)) {
    const row = { name, label: inLanguage(lang, name, info.nameEn, info.nameJp), text: inLanguage(lang, info.desc, info.descEn, info.descJp) }
    const stack = readStack(info.desc)
    // The game's values come first: a keyword with an ability the table knows is offered by those, per side.
    const read = abilities[name] ? readAbilities(abilities[name]) : null
    if (read?.effects.length) {
      for (const side of ['self', 'target'] as const) {
        const own = read.effects.filter(effect => effect.side === side)
        if (own.length) stackRows.push({ ...row, values: [], stack: null, side, effects: own, unsupported: read.unsupported, maxStack: info.maxStack ?? DEFAULT_MAX_STACKS, rank: stack?.rank ?? 1000 })
      }
      continue
    }
    // A stack keyword is offered as its stacks only; were a text to hold the sentence and another damage percent, that percent would go unread. No keyword does (2026-10-05); offer both rows if one appears.
    if (stack) { stackRows.push({ ...row, values: [], stack: stack.effect, side: stack.effect.side, rank: stack.rank }); continue }
    const changes = damageChanges(info.desc)
    for (const side of ['self', 'target'] as const) {
      const own = changes.filter(change => change.taken === (side === 'target'))
      if (own.length) keywordRows.push({ ...row, values: valuesOf(own), stack: null, side })
    }
    if (read?.unsupported && !changes.length) inertRows.push({ ...row, values: [], stack: null, side: 'self', effects: [], unsupported: read.unsupported })
  }
  const giftRows: DamageSources['gifts'] = []
  for (const gift of gifts) {
    const texts = [
      [gift.effect_base, gift.effect_base_en, gift.effect_base_jp],
      [gift.effect_plus, gift.effect_plus_en, gift.effect_plus_jp],
      [gift.effect_plusplus, gift.effect_plusplus_en, gift.effect_plusplus_jp],
    ]
    const stages = texts.flatMap(([ko, en, ja], level) => {
      if (!ko) return []
      const changes = damageChanges(ko).filter(change => !change.taken || change.foe)
      return [{ level, text: inLanguage(lang, ko, en, ja), values: valuesOf(changes), changes: changes.length }]
    })
    const effects = readGiftModifiers(gift.modifiers)
    if (!effects.length && !stages.some(stage => stage.changes)) continue
    giftRows.push({
      ...(effects.length ? { effects } : {}),
      id: String(gift.game_id ?? gift.name), name: gift.name, label: inLanguage(lang, gift.name, gift.name_en, gift.name_jp),
      grade: gift.grade, keyword: gift.keyword, image_url: gift.image_url,
      stages: stages.map(({ level, text, values }) => ({ level, text, values })),
    })
  }
  return { keywords: [...stackRows.sort((a, b) => a.rank - b.rank).map(({ rank: _, ...row }) => row), ...keywordRows, ...inertRows], gifts: giftRows }
}

type NewModifier = Omit<SavedModifier, 'id'>

/** A keyword of the list as a modifier: a stack keyword starts at one stack (and its effect knows its own side), any other at the first value its text offers (0 when it offers none). */
export function keywordModifier({ name, label, values, stack, side, effects }: Omit<DamageSources['keywords'][number], 'text'>): NewModifier {
  if (effects?.length) return effectsModifier(label, effects, { keyword: name, side })
  return stack
    ? { name: label, keyword: name, stacks: 1, value: stack.perStack, target: stack.target, side: stack.side }
    : { name: label, keyword: name, value: values[0] ?? 0, options: values.slice(0, MAX_MODIFIER_OPTIONS), target: 'damage', side }
}

/** A modifier that carries its game-read effects: a count (stacks) when any of them is per stack. */
export function effectsModifier(name: string, effects: AbilityEffect[], extra: Partial<NewModifier>): NewModifier {
  const summary = effectSummary(effects, 1)
  return { name, effects, target: summary.target, value: summary.value, ...(effects.some(effect => effect.scaled) ? { stacks: 1 } : {}), ...extra }
}

export type DamageSuggestion = {
  key: string; kind: 'keyword' | 'gift'; label: string; modifier: NewModifier; /** A stack keyword's effect per stack. */ perStack?: number
  /** Nothing of it can be calculated: shown, not applicable. */
  inert?: boolean
}

export type SourceGroup = Side | 'gift'

/** What a candidate of a picker already stands for among the applied modifiers: the same gift, or the same keyword on the same side. */
export const findApplied = <T extends NewModifier>(modifiers: readonly T[], { gift, keyword, side }: NewModifier): T | undefined =>
  modifiers.find(other => gift ? other.gift?.id === gift.id : !!keyword && !other.gift && other.keyword === keyword && (other.side ?? 'self') === (side ?? 'self'))
