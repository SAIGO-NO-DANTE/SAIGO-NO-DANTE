import { describe, expect, it } from 'vitest'
import { type SavedModifier } from '@/features/tools/lib/damage-types'
import { coinDamage, coinModifiers, parseSavedModifiers } from '@/features/tools/lib/damage'
import { abilityPower, appliesTo, effectSummary, readAbilities, readGiftModifiers } from '@/features/tools/lib/damage-abilities'
import { buildDamageSources, keywordModifier, type GiftSourceRow } from '@/features/tools/lib/damage-sources'
import { suggestDamageSources } from '@/features/tools/lib/damage-suggest'

// Rows as the game's buff data writes them (keyword_meta.abilities).
const VULNERABLE = [{ ability: 'TakeAtkDamageMultiplierByStack', value: 0.1 }]
const PROTECTION = [{ ability: 'TakeAtkDamageMultiplierByStack', value: -0.1 }]
const BEE_STING = [{ ability: 'AtkResistAdderByStack', atk: 'SLASH', value: 0.2 }, { ability: 'AttributeResistAdderByStack', attribute: 'AMBER', value: 0.2 }]
const LAMANCHALAND = [{ ability: 'AtkDamageMultiplierByStack', value: 0.2 }, { ability: 'TakeAtkDamageMultiplierByStack', value: 0.2 }]
const ENHANCEMENT = [{ ability: 'AtkSkillPowerResultAdderAsStack', value: 1 }]
const FIXED = [{ ability: 'AtkDamageMultiplier', value: 0.05 }, { ability: 'GiveBuffOnRoundEnd' }, { ability: 'AtkDamageMultiplierGebura', value: 1 }]

describe('readAbilities', () => {
  it('reads a stack ability as a per-stack percent on the side that takes it', () => {
    expect(readAbilities(VULNERABLE).effects).toEqual([{ target: 'damage', side: 'target', value: 10, scaled: true }])
    expect(readAbilities(PROTECTION).effects[0].value).toBe(-10)
    expect(readAbilities(LAMANCHALAND).effects.map(effect => effect.side)).toEqual(['self', 'target'])
  })
  it('keeps what narrows an effect to one sin or attack type', () => {
    expect(readAbilities(BEE_STING).effects).toEqual([
      { target: 'physical', side: 'target', value: 0.2, scaled: true, atk: 'SLASH' },
      { target: 'sin', side: 'target', value: 0.2, scaled: true, attribute: 'AMBER' },
    ])
  })
  it('counts a flat ability once and an unknown damage-related one as not calculated, leaving turn logic out', () => {
    const { effects, unsupported } = readAbilities(FIXED)
    expect(effects).toEqual([{ target: 'damage', side: 'self', value: 5, scaled: false }])
    expect(unsupported).toBe(1)
  })
  it('does not use a subtracting coin\'s adder or a value that is not a number', () => {
    expect(readAbilities([{ ability: 'CoinScaleAdderByStack', coinOperator: 'SUB', value: -12 }, { ability: 'SkillPowerAdder' }]).effects).toEqual([])
    expect(readAbilities([{ ability: 'CoinScaleAdderByStack', coinOperator: 'ADD', value: -8 }]).effects[0]).toMatchObject({ target: 'coin_power', value: -8, scaled: true })
    expect(readAbilities(null)).toEqual({ effects: [], unsupported: 0 })
  })
  it('summarizes a keyword by its first kind of effect, scaled by the stacks', () => {
    expect(effectSummary(readAbilities(VULNERABLE).effects, 4)).toEqual({ target: 'damage', value: 40 })
    expect(effectSummary(readAbilities(ENHANCEMENT).effects, 3)).toEqual({ target: 'power', value: 3 })
  })
})

describe('gift modifiers', () => {
  it('reads damage and power entries of what the attacker deals and leaves damage taken out', () => {
    expect(readGiftModifiers([
      { target: 'damage', value: 0.005, per: 'coin' }, { target: 'power', value: 1 }, { target: 'take_damage', value: -0.1 }, { target: 'speed', value: 1 },
    ])).toEqual([
      { target: 'damage', side: 'self', value: 0.5, scaled: true },
      { target: 'power', side: 'self', value: 1, scaled: false },
    ])
    expect(readGiftModifiers(null)).toEqual([])
  })
})

describe('applying the effects', () => {
  const modifier = (effects: ReturnType<typeof readAbilities>['effects'], stacks?: number): SavedModifier =>
    ({ id: 1, name: 'x', target: 'damage', value: 0, effects, ...(stacks ? { stacks } : {}) })
  it('turns stacks into the damage factor the formula takes', () => {
    const modifiers = coinModifiers([modifier(readAbilities(VULNERABLE).effects, 5)], 1)
    expect(modifiers).toEqual([{ target: 'damage', value: 0.5 }])
    expect(coinDamage({ power: 10, offenseLevel: 55, defenseLevel: 55, physicalResist: 1, sinResist: 1, modifiers }).damage).toBe(15)
  })
  it('applies a restricted resistance only to a skill of that attack type or sin', () => {
    const saved = [modifier(readAbilities(BEE_STING).effects, 2)]
    expect(coinModifiers(saved, 1)).toEqual([])
    expect(coinModifiers(saved, 1, { atk: 'SLASH' })).toEqual([{ target: 'physical', value: 0.4 }])
    expect(coinModifiers(saved, 1, { atk: 'SLASH', sin: 'AMBER' })).toHaveLength(2)
    expect(appliesTo({ atk: 'HIT' }, { atk: 'SLASH' })).toBe(false)
  })
  it('adds power effects to the skill and the heads coin, not to the damage factors', () => {
    const saved = [modifier(readAbilities(ENHANCEMENT).effects, 3), modifier(readAbilities([{ ability: 'PlusCoinScaleAdder', value: 1 }]).effects)]
    expect(abilityPower(saved)).toEqual({ power: 3, coinPower: 1 })
    expect(coinModifiers(saved, 1)).toEqual([])
  })
  it('keeps the effects of a saved modifier through the browser storage and drops a broken one', () => {
    const saved = modifier(readAbilities(BEE_STING).effects, 2)
    expect(parseSavedModifiers(JSON.stringify([saved]))[0].effects).toEqual(saved.effects)
    const broken = JSON.stringify([{ ...saved, effects: [{ target: 'nope', side: 'self', value: 1, scaled: true }, { target: 'damage', side: 'self', value: 5, scaled: true }] }])
    expect(parseSavedModifiers(broken)[0].effects).toEqual([{ target: 'damage', side: 'self', value: 5, scaled: true }])
  })
})

describe('the picker list', () => {
  const info = (desc = '') => ({ desc })
  const sources = buildDamageSources(
    { 취약: { ...info('한 턴 동안 스킬로 받는 피해가 수치에 비례하여 증가 (최대 10)'), maxStack: 10 }, 이상한: info(), 고정: info(), 몰라: info() },
    [{ game_id: 1, name: '동전', name_en: null, name_jp: null, grade: '1', keyword: null, image_url: null, effect_base: '보유한 동전당 가하는 피해량 +0.5%', effect_plus: null, effect_plusplus: null,
      effect_base_en: null, effect_plus_en: null, effect_plusplus_en: null, effect_base_jp: null, effect_plus_jp: null, effect_plusplus_jp: null,
      modifiers: [{ target: 'damage', value: 0.005, per: 'coin' }] } as GiftSourceRow],
    'ko',
    { 취약: VULNERABLE, 이상한: LAMANCHALAND, 고정: FIXED, 몰라: [{ ability: 'DamageSomethingNew', value: 1 }] },
  )
  it('offers a keyword by its game values, one row per side it acts on, with its own maximum', () => {
    const rows = sources.keywords.filter(row => row.name === '이상한')
    expect(rows.map(row => [row.side, row.effects?.length])).toEqual([['self', 1], ['target', 1]])
    expect(sources.keywords.find(row => row.name === '취약')).toMatchObject({ side: 'target', stack: null, maxStack: 10 })
    expect(sources.keywords[0].name).toBe('취약')
  })
  it('lists a keyword with only unknown damage abilities as not calculated', () => {
    const row = sources.keywords.find(candidate => candidate.name === '몰라')!
    expect(row).toMatchObject({ effects: [], unsupported: 1 })
    expect(suggestDamageSources(sources, '몰라', { group: 'self' })[0].inert).toBe(true)
  })
  it('starts a keyword with a per-stack effect at one stack and a flat one without a count', () => {
    const vulnerable = keywordModifier(sources.keywords.find(row => row.name === '취약')!)
    expect(vulnerable).toMatchObject({ stacks: 1, value: 10, target: 'damage', side: 'target' })
    expect(keywordModifier(sources.keywords.find(row => row.name === '고정')!).stacks).toBeUndefined()
  })
  it('uses a gift\'s modifiers in place of its sentence', () => {
    expect(sources.gifts[0].effects).toEqual([{ target: 'damage', side: 'self', value: 0.5, scaled: true }])
    const [gift] = suggestDamageSources(sources, '', { group: 'gift' })
    expect(gift.modifier).toMatchObject({ stacks: 1, value: 0.5, effects: sources.gifts[0].effects })
  })
})
