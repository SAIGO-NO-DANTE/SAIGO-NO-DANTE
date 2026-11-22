import { describe, expect, it } from 'vitest'
import { buildDamageSources, damageChanges, damageValues, findApplied, keywordModifier, mentionsDamage, stackEffect, type DamageSources, type GiftSourceRow } from '@/features/tools/lib/damage-sources'
import { suggestDamageSources } from '@/features/tools/lib/damage-suggest'

// Effect texts as the game writes them (ego_gifts.effect_base, keyword_meta.description, 2026-10-04).
const GIFTS = {
  artisticSense: '정신력 감소로 인하여 부정적 효과(사기저하, 패닉)를 얻은 적에게 입히는 피해량 35% 증가.\n\n[Sinking] 위력을 부여하거나 횟수를 증가시키는 스킬일 경우, 추가로 피해량 10% 증가 (특수 <noparse>침잠</noparse> 포함)\n\n정신력이 없는 적에게 [Sinking] 효과가 적용될 경우, 우울 속성 피해를 입히는 대신 이를 포함한 죄악 속성 중 가장 효과적인 속성 피해로 변경.',
  artisticSensePlusPlus: '<style="upgradeHighlight">정신력이 없거나 0 미만인 적에게 입히는 피해량 50% 증가.</style>\n\n[Sinking] 위력을 부여하거나 횟수를 증가시키는 스킬일 경우, 추가로 피해량 10% 증가 (특수 <noparse>침잠</noparse> 포함)',
  redNecktie: '[Combustion] 위력 또는 [Combustion] 횟수 또는 특수 화상을 부여하는 스킬 3의 합 위력 +2, 피해량 +30%',
  shadowHat: '턴 종료 시 흑수 - 묘 소속이면, 다음 턴에 [Agility] 2 얻음\n\n자신의 속도가 대상보다 빠르거나 일방 공격을 할 경우, (속도 차 / 3)만큼 참격 피해량 +10% (최대 30%)\n\n자신의 속도가 대상보다 빠르면, (속도 차 / 3)당 받는 피해량 -10% (최대 30%)',
  sourAroma: '[Vibration] 위력 또는 [Vibration] 횟수를 부여하는 스킬(본인 또는 아군을 대상으로 하는 경우 포함)의 공격 레벨 +2\n\n메인 공격 대상이 [Vibration] 상태이고 흐트러진 경우, 스킬로 가하는 피해량 +(흐트러짐 단계x7.5)%',
  violin: '스킬로 입힌 피해량의 10%만큼 자신의 체력 회복 (스킬당 최대 회복량 20)\n\n합 승리 시 [AttackUp] 1, [TakeHpHealIncrease] 1 얻음 (인격별 턴당 2회)\n\n타격 스킬의 피해량 +10%\n\n합에서 승리한 스킬로 가하는 피해량 +(합 횟수 x 6)% (최대 30%)',
  web: '사망한 거미집 소속 아군 인격 2명당, 최종 위력 +1, 코인 위력 +1, 가하는 피해량 10% (각각 최대 3, 30%)',
  hat: '검계 소속일 경우 효과가 강화되어 치명타로 가하는 피해량이 1.5배 증가',
  breath: '합 승리 또는 일방 공격시 사용하는 스킬 코인이 반드시 앞면으로 결정되고, 치명타로 가하는 피해량 +80% (전투 당 1회, E.G.O 스킬 제외)',
  grant: "턴 시작시, 모든 아군이 '분노 ~ 질투 피해량 증가' 중 무작위 효과 2가지를 1씩 얻음",
}
const KEYWORDS = {
  dokkaebi: '- 받는 피해 15% 감소\n- 스킬 사용 시 다음 턴에 신속 1 얻음 (턴당 2회)\n- 전투 종료 시 소멸하며, 호흡 횟수 2 얻음',
  inspiration: '그림 재료를 보유한 대상 공격 시 피해량 +10%',
  seventhBullet: '- 가하는 피해량 +200%\n- 대상의 잃은 체력 1%당 피해량 +2.5% (최대 200%)\n- 공격 시작 전 대상이나 자신의 관통 속성 내성이 2.0 미만이면, 이 공격에 한해 취약(x2.0)으로 변경함',
  gaze: '한 턴동안 관통, 타격 속성 스킬로 받는 피해 20% 증가. 표적이 찍힌 적 처치 시 처치한 아군의 정신력이 10 회복되며, 해당 아군이 N사 광신도면 다음 턴에 광신 1을 얻음',
  boldTouch: '- 최댓값 : 2\n- 수치 1당 출혈 효과와 침잠 효과로 받는 체력, 정신력 피해량 +10% (최대 20%, 소수점 버림)\n- 턴 종료 시 1 감소',
  traumaShield: '- 적에게 받는 정신력 피해 80% 감소\n- 침잠 피해 80% 감소\n- 턴 종료시 수치 1 감소',
  grudge: "- ‘육참’, ‘골단’의 마지막 코인 적중 시 (수치 / 10)%만큼 피해량이 증가하고, 이 효과 소멸",
  protection: '한 턴 동안 스킬로 받는 피해가 수치에 비례하여 감소 (최대 10)',
}
// The sentences that make a stack keyword (keyword_meta.description, 2026-10-05).
const STACK = {
  fragile: '한 턴 동안 스킬로 받는 피해가 수치에 비례하여 증가 (최대 10)',
  pierceFragile: '한 턴 동안 관통 스킬로 받는 피해가 수치에 비례하여 증가 (최대 10)',
  damageUp: '한 턴 동안 스킬로 가하는 피해가 수치에 비례하여 증가 (최대 10)',
  slashWeak: '대상의 참격 내성을 (스택 * 0.1) 증가',
}

describe('damage sources', () => {
  it('reads the plain damage percents of gift and keyword texts', () => {
    expect(damageValues(GIFTS.artisticSense)).toEqual([35, 10])
    expect(damageValues(GIFTS.artisticSensePlusPlus)).toEqual([50, 10])
    expect(damageValues(GIFTS.redNecktie)).toEqual([30])
    expect(damageValues(GIFTS.breath)).toEqual([80])
    expect(damageValues(KEYWORDS.dokkaebi)).toEqual([-15])
    expect(damageValues(KEYWORDS.inspiration)).toEqual([10])
    expect(damageValues(KEYWORDS.gaze)).toEqual([20])
  })
  it('takes the stated maximum of a damage change that scales', () => {
    expect(damageValues(GIFTS.shadowHat)).toEqual([30, -30])
    expect(damageValues(GIFTS.violin)).toEqual([10, 30])
    expect(damageValues(KEYWORDS.seventhBullet)).toEqual([200])
    // The maximum may follow a count ("최대 3, 30%") or stand on the next line.
    expect(damageValues(GIFTS.web)).toEqual([30])
    expect(damageValues('아군 1명당 가하는 피해량 +30% (최대 4, 120%, 소수점 버림)')).toEqual([120])
    expect(damageValues('- 정신력 차이 3당 피해량 +1%\n(최대 15%, 소수점 버림)')).toEqual([15])
    // A formula's direction is the word after it.
    expect(damageValues('- 기본 공격 스킬의 피해량이 (수치 x 10)%만큼 감소 (최대 30%)')).toEqual([-30])
    // A formula written without a sign still has its maximum.
    expect(damageValues('- 자신의 속도가 대상보다 빠르면, 피해량 (대상과의 속도 차이 x 3)% (최대 15%)')).toEqual([15])
    expect(damageValues('- 기본 공격 스킬의 피해량이 (수치 x 10)%만큼 증가 (최대 30%)')).toEqual([30])
  })
  it('leaves out what is not a skill damage percent', () => {
    // A formula without a maximum, a count with no sign, a multiplier, a keyword that is granted, heals, effect and SP damage.
    for (const text of [GIFTS.sourAroma, GIFTS.hat, GIFTS.grant, KEYWORDS.boldTouch, KEYWORDS.traumaShield, KEYWORDS.grudge, KEYWORDS.protection, '']) {
      expect(damageValues(text)).toEqual([])
    }
    expect(damageValues('크리티컬 확률 +10%, 피해량 +20%')).toEqual([20])
    // Damage an effect deals to a shield, written with the game's keyword placeholder.
    expect(damageValues('[Burst] 효과가 적이 보유한 보호막에 입히는 피해량 +100%')).toEqual([])
    expect(damageValues('아군이 받는 [Laceration] 피해량이 (편성된 수 x 10)% 감소 (최대 40%)\n적이 받는 [Laceration] 피해량이 (편성된 수 x 5)% 증가 (최대 20%)')).toEqual([])
    expect(damageValues('[Vibration] 위력을 부여하는 스킬로 적을 공격할 경우, 효과가 강화되어 피해량 +25%')).toEqual([25])
  })
  it('tells damage taken from damage dealt, and whose', () => {
    expect(damageChanges('가하는 피해량 +10%')).toEqual([{ value: 10, taken: false, foe: false }])
    expect(damageChanges(KEYWORDS.dokkaebi)).toEqual([{ value: -15, taken: true, foe: false }])
    expect(damageChanges('받는 피해량과 자신이 받는 회복량이 50% 감소')).toEqual([{ value: -50, taken: true, foe: false }])
    expect(damageChanges('턴 종료 시 모든 아군이 받는 피해 20% 증가')).toEqual([{ value: 20, taken: true, foe: false }])
    expect(damageChanges('흐트러진 적에게 받는 피해량 -10%')).toEqual([{ value: -10, taken: true, foe: false }])
    expect(damageChanges('표식이 있는 적이 받는 피해량 +10%')).toEqual([{ value: 10, taken: true, foe: true }])
    expect(damageChanges('- 받는 스킬 피해 -5%\n- 가하는 피해량 +5%')).toEqual([{ value: -5, taken: true, foe: false }, { value: 5, taken: false, foe: false }])
    // "When taking damage, …": the clause before the comma says whose damage it is.
    expect(damageChanges('[SuperCoin]의 피해량 +25%\n[SuperCoin]으로 피해를 받을 때, 피해량 -25%,')).toEqual([{ value: 25, taken: false, foe: false }, { value: -25, taken: true, foe: false }])
    // A formula without a maximum is a change whose value is unknown.
    expect(damageChanges(GIFTS.sourAroma)).toEqual([{ value: null, taken: false, foe: false }])
  })
  it('keeps a damage formula it cannot read as a change, with its maximum when one is stated', () => {
    const dealt = (value: number | null) => [{ value, taken: false, foe: false }]
    // Nested brackets, the formula before the word, "N%씩": none is the plain "피해량 +(…)%".
    expect(damageChanges('피해량 +(자신의 [Charge]와 특수 충전(위력 고정)의 합 x 4)% (최대 40%)')).toEqual(dealt(40))
    expect(damageChanges('(전투에 참여한 E.G.O 소속 인격 수 X 10)%만큼 가하는 피해량 증가 (최대 30%)')).toEqual(dealt(30))
    expect(damageChanges('([BloodDinner_Accumulation] / 10)%만큼 스킬 피해량 증가')).toEqual(dealt(null))
    expect(damageChanges('- 피해량 +(10 + (수치 x 5))%')).toEqual(dealt(null))
    expect(damageChanges(KEYWORDS.grudge)).toEqual(dealt(null))
    expect(damageChanges('- 가하는 피해량이 수치에 비례하여 20%씩 증가')).toEqual(dealt(null))
    expect(damageChanges('- 받는 피해량 10 + (과충전 수치 x 3)% 만큼 감소 (최대 25%)')).toEqual([{ value: -25, taken: true, foe: false }])
    // Still not a change of skill damage.
    expect(damageChanges('스킬로 입힌 피해량의 (수치 x 2)%만큼 체력 회복')).toEqual([])
    expect(damageChanges('[Burst] 효과로 받는 피해량이 (수치 x 5)% 증가')).toEqual([])
  })
  it('knows which texts speak of damage at all', () => {
    expect(mentionsDamage(GIFTS.sourAroma)).toBe(true)
    expect(mentionsDamage(KEYWORDS.protection)).toBe(true)
    expect(mentionsDamage('턴 종료 시 다음 턴에 신속 1 얻음')).toBe(false)
  })
  it('knows a stack keyword by the sentence of its text, whatever it is called', () => {
    const taken = (perStack: number) => ({ target: 'damage', perStack, max: 10, side: 'target' })
    const dealt = (perStack: number) => ({ target: 'damage', perStack, max: 10, side: 'self' })
    expect(stackEffect(KEYWORDS.protection)).toEqual(taken(-10))
    expect(stackEffect(STACK.fragile)).toEqual(taken(10))
    expect(stackEffect(STACK.damageUp)).toEqual(dealt(10))
    expect(stackEffect('한 턴 동안 스킬로 가하는 피해가 수치에 비례하여 감소 (최대 10)')).toEqual(dealt(-10))
    // Per attack type and per sin: "관통 스킬로", "나태 속성 스킬로".
    expect(stackEffect(STACK.pierceFragile)).toEqual(taken(10))
    expect(stackEffect('한 턴 동안 나태 속성 스킬로 가하는 피해가 수치에 비례하여 감소 (최대 10)')).toEqual(dealt(-10))
    // The most stacks are the stated maximum, 10 where none is stated.
    expect(stackEffect('한 턴 동안 스킬로 받는 피해가 수치에 비례하여 증가 (최대 5)')?.max).toBe(5)
    expect(stackEffect('한 턴 동안 스킬로 받는 피해가 수치에 비례하여 증가')?.max).toBe(10)
    // A weakening states its own amount, and its resistance tells physical from sin.
    expect(stackEffect(STACK.slashWeak)).toEqual({ target: 'physical', perStack: 0.1, max: 10, side: 'target' })
    expect(stackEffect('대상의 질투 내성을 (스택 * 0.1) 증가')).toEqual({ target: 'sin', perStack: 0.1, max: 10, side: 'target' })
    expect(stackEffect('대상의 타격 내성을 (수치 x 0.2) 증가')?.perStack).toBe(0.2)
    expect(stackEffect('대상의 관통 속성 내성을 (스택 * 0.1) 증가')?.target).toBe('physical')
    expect(stackEffect('대상의 모든 내성을 (스택 * 0.1) 증가')).toBeNull()
    for (const text of ['한 턴 동안 파열 효과로 받는 피해 수치당 1 감소', KEYWORDS.dokkaebi, KEYWORDS.gaze, '한 턴 동안 속도가 수치만큼 증가', '']) expect(stackEffect(text)).toBeNull()
    // The name decides nothing: a keyword the game adds later with the same sentence is a stack keyword, and "취약" with another text is not.
    const row = (desc: string) => ({ desc, nameEn: null, nameJp: null, descEn: null, descJp: null })
    const { keywords } = buildDamageSources({ '취약': row(KEYWORDS.gaze), '낙인': row(STACK.fragile) }, [], 'ko')
    expect(keywords.map(keyword => [keyword.name, keyword.stack?.perStack ?? null, keyword.side])).toEqual([['낙인', 10, 'target'], ['취약', null, 'target']])
  })
  it('lists the keywords and gifts that change damage, in the language asked for', () => {
    const keywords = {
      '보호': { desc: KEYWORDS.protection, nameEn: 'Protection', nameJp: '保護', descEn: 'Take less damage from skills for one turn (max 10)', descJp: null },
      '도깨비팔': { desc: KEYWORDS.dokkaebi, nameEn: 'Dokkaebi Arms', nameJp: 'ドッケビの腕', descEn: '- Take -15% damage', descJp: '- 被ダメージ量が15%減少' },
      '참격 내성 약화': { desc: '대상의 참격 내성을 (스택 * 0.1) 증가', nameEn: 'Slash Res. Down', nameJp: null, descEn: null, descJp: null },
      '영감': { desc: KEYWORDS.inspiration, nameEn: 'Spark of Inspiration', nameJp: '着想', descEn: 'Deal +10% damage against targets with Art Medium', descJp: null },
      '책임감': { desc: '- 가하는 피해량 +20%\n- 받는 피해량 +20%', nameEn: 'Sense of Duty', nameJp: null, descEn: null, descJp: null },
      '경혈 갑주': { desc: '- 공격 스킬 종료 시 가한 체력 피해량의 10%만큼 체력을 회복', nameEn: null, nameJp: null, descEn: null, descJp: null },
      '맺혀가는 응어리': { desc: KEYWORDS.grudge, nameEn: null, nameJp: null, descEn: null, descJp: null },
      '신속': { desc: '한 턴 동안 속도가 수치만큼 증가', nameEn: 'Haste', nameJp: 'クイック', descEn: 'Speed up', descJp: null },
    }
    const gift = (row: Partial<GiftSourceRow> & { name: string }): GiftSourceRow => ({
      game_id: null, name_en: null, name_jp: null, grade: null, keyword: null, image_url: null,
      effect_base: null, effect_plus: null, effect_plusplus: null, effect_base_en: null, effect_plus_en: null, effect_plusplus_en: null,
      effect_base_jp: null, effect_plus_jp: null, effect_plusplus_jp: null, ...row,
    })
    const gifts = [
      gift({ game_id: 9065, name: '미적 감각', name_en: 'Artistic Sense', grade: '4', keyword: 'Sinking', image_url: 'a.webp', effect_base: GIFTS.artisticSense, effect_base_en: 'Deal +35% damage', effect_plusplus: GIFTS.artisticSensePlusPlus }),
      gift({ game_id: 9100, name: '시큼한 주향', name_en: 'Sour Liquor Aroma', effect_base: GIFTS.sourAroma, effect_base_en: 'deal +(Stagger Level x 7.5)% damage' }),
      // What allies take is not what the attacker deals; what the enemy takes is.
      gift({ game_id: 9300, name: '결의', effect_base: '받는 피해량과 자신이 받는 회복량이 50% 감소' }),
      gift({ game_id: 9301, name: '표식', effect_base: '표식이 있는 적이 받는 피해량 +10%\n아군이 받는 피해 20% 증가' }),
      gift({ game_id: 9200, name: '먹어치우는 큐브', effect_base: '공격 종료 시 적이 사망했다면, 무작위 E.G.O 자원 1개 획득' }),
    ]
    const en = buildDamageSources(keywords, gifts, 'en')
    expect(en.keywords).toEqual([
      { name: '보호', label: 'Protection', text: 'Take less damage from skills for one turn (max 10)', values: [], stack: { target: 'damage', perStack: -10, max: 10, side: 'target' }, side: 'target' },
      { name: '참격 내성 약화', label: 'Slash Res. Down', text: '대상의 참격 내성을 (스택 * 0.1) 증가', values: [], stack: { target: 'physical', perStack: 0.1, max: 10, side: 'target' }, side: 'target' },
      // Damage "taken" is the target's; anything else is the attacker's.
      { name: '도깨비팔', label: 'Dokkaebi Arms', text: '- Take -15% damage', values: [-15], stack: null, side: 'target' },
      { name: '영감', label: 'Spark of Inspiration', text: 'Deal +10% damage against targets with Art Medium', values: [10], stack: null, side: 'self' },
      // Deals more and takes more: offered on both sides, each with its own value.
      { name: '책임감', label: 'Sense of Duty', text: '- 가하는 피해량 +20%\n- 받는 피해량 +20%', values: [20], stack: null, side: 'self' },
      { name: '책임감', label: 'Sense of Duty', text: '- 가하는 피해량 +20%\n- 받는 피해량 +20%', values: [20], stack: null, side: 'target' },
      // A formula that could not be read is still offered, for the user to type its value.
      { name: '맺혀가는 응어리', label: '맺혀가는 응어리', text: KEYWORDS.grudge, values: [], stack: null, side: 'self' },
    ])
    expect(en.gifts).toEqual([
      { id: '9065', name: '미적 감각', label: 'Artistic Sense', grade: '4', keyword: 'Sinking', image_url: 'a.webp', stages: [
        { level: 0, text: 'Deal +35% damage', values: [35, 10] },
        // No English text for this stage: the Korean one is shown rather than nothing.
        { level: 2, text: GIFTS.artisticSensePlusPlus, values: [50, 10] },
      ] },
      { id: '9100', name: '시큼한 주향', label: 'Sour Liquor Aroma', grade: null, keyword: null, image_url: null, stages: [{ level: 0, text: 'deal +(Stagger Level x 7.5)% damage', values: [] }] },
      { id: '9301', name: '표식', label: '표식', grade: null, keyword: null, image_url: null, stages: [{ level: 0, text: '표식이 있는 적이 받는 피해량 +10%\n아군이 받는 피해 20% 증가', values: [10] }] },
    ])
    const ja = buildDamageSources(keywords, gifts, 'ja')
    expect(ja.keywords.map(keyword => keyword.label)).toEqual(['保護', '참격 내성 약화', 'ドッケビの腕', '着想', '책임감', '책임감', '맺혀가는 응어리'])
    expect(ja.keywords[2].text).toBe('- 被ダメージ量が15%減少')
    expect(buildDamageSources(keywords, gifts, 'ko').gifts.map(row => row.label)).toEqual(['미적 감각', '시큼한 주향', '표식'])
  })
  it('lists the stack keywords by kind, the general one first, then attack types, then sins', () => {
    const texts: Record<string, string> = {
      '오만 취약': '한 턴 동안 오만 속성 스킬로 받는 피해가 수치에 비례하여 증가 (최대 10)', '참격 내성 약화': STACK.slashWeak, '보호': KEYWORDS.protection,
      '분노 보호': '한 턴 동안 분노 속성 스킬로 받는 피해가 수치에 비례하여 감소 (최대 10)', '취약': STACK.fragile,
      '참격 취약': '한 턴 동안 참격 스킬로 받는 피해가 수치에 비례하여 증가 (최대 10)', '피해량 증가': STACK.damageUp, '관통 취약': STACK.pierceFragile, '주시': KEYWORDS.gaze,
    }
    const keywords = Object.fromEntries(Object.entries(texts).map(([name, desc]) => [name, { desc, nameEn: null, nameJp: null, descEn: null, descJp: null }]))
    expect(buildDamageSources(keywords, [], 'ko').keywords.map(row => row.name)).toEqual(['취약', '참격 취약', '관통 취약', '오만 취약', '보호', '분노 보호', '피해량 증가', '참격 내성 약화', '주시'])
  })
  it('turns a keyword into a modifier: a stack keyword starts at 1, the others at their first value', () => {
    const row = { text: '', values: [] as number[], stack: null, side: 'self' as const }
    const fragile = { target: 'damage' as const, perStack: 10, max: 10, side: 'target' as const }
    // The stack effect is the one the list read from the text; the side is the effect's own.
    expect(keywordModifier({ ...row, name: '낙인', label: 'Brand', stack: fragile })).toEqual({ name: 'Brand', keyword: '낙인', stacks: 1, value: 10, target: 'damage', side: 'target' })
    expect(keywordModifier({ ...row, name: '참격 내성 약화', label: '참격 내성 약화', stack: { target: 'physical', perStack: 0.1, max: 10, side: 'target' } })).toEqual({ name: '참격 내성 약화', keyword: '참격 내성 약화', stacks: 1, value: 0.1, target: 'physical', side: 'target' })
    // A name alone makes no stack keyword.
    expect(keywordModifier({ ...row, name: '취약', label: '취약', values: [20], side: 'target' })).toEqual({ name: '취약', keyword: '취약', value: 20, options: [20], target: 'damage', side: 'target' })
    expect(keywordModifier({ ...row, name: '일곱번째 마탄', label: 'The Seventh Magic Bullet', values: [200, 50] })).toEqual({ name: 'The Seventh Magic Bullet', keyword: '일곱번째 마탄', value: 200, options: [200, 50], target: 'damage', side: 'self' })
    expect(keywordModifier({ ...row, name: '맺혀가는 응어리', label: '맺혀가는 응어리' })).toEqual({ name: '맺혀가는 응어리', keyword: '맺혀가는 응어리', value: 0, options: [], target: 'damage', side: 'self' })
  })
  it('knows what a picked candidate already stands for: the same gift, or the same keyword on the same side', () => {
    const gift = { id: '9065', level: 0, image_url: null, grade: null, keyword: null }
    const applied = [
      { id: 1, name: '책임감', value: 20, target: 'damage' as const, keyword: '책임감', side: 'target' as const },
      { id: 2, name: '미적 감각++', value: 50, target: 'damage' as const, gift: { ...gift, level: 2 } },
      { id: 3, name: '직접 입력', value: 10, target: 'damage' as const },
      { id: 4, name: '영감', value: 10, target: 'damage' as const, keyword: '영감' },
    ]
    // A keyword offered on both sides is applied on each side by itself.
    expect(findApplied(applied, { name: '책임감', value: 20, target: 'damage', keyword: '책임감', side: 'target' })?.id).toBe(1)
    expect(findApplied(applied, { name: '책임감', value: 20, target: 'damage', keyword: '책임감', side: 'self' })).toBeUndefined()
    // A gift is the same gift at any enhancement level; a side that was not saved is the attacker's.
    expect(findApplied(applied, { name: '미적 감각', value: 35, target: 'damage', gift })?.id).toBe(2)
    expect(findApplied(applied, { name: '영감', value: 10, target: 'damage', keyword: '영감', side: 'self' })?.id).toBe(4)
    // A typed modifier stands for no candidate, whatever it is called.
    expect(findApplied(applied, { name: '직접 입력', value: 10, target: 'damage' })).toBeUndefined()
  })
  it('suggests keywords and gifts by name, the closest names first', () => {
    const stack = { target: 'damage' as const, perStack: 10, max: 10, side: 'target' as const }
    const sources: DamageSources = {
      keywords: [
        { name: '참격 취약', label: '참격 취약', text: '', values: [], stack, side: 'target' },
        { name: '취약', label: '취약', text: '', values: [], stack, side: 'target' },
        { name: '주시', label: '주시', text: '', values: [20], stack: null, side: 'target' },
        { name: '영감', label: '영감', text: '', values: [10], stack: null, side: 'self' },
      ],
      gifts: [
        { id: '1', name: '취약점 분석기', label: '취약점 분석기', grade: '2', keyword: 'Burst', image_url: 'b.webp', stages: [{ level: 0, text: '', values: [15] }] },
        { id: '9065', name: '미적 감각', label: '미적 감각', grade: '4', keyword: 'Sinking', image_url: 'a.webp', stages: [
          { level: 0, text: '', values: [35, 10] }, { level: 1, text: '', values: [35, 10] }, { level: 2, text: '', values: [50, 10] },
        ] },
      ],
    }
    expect(suggestDamageSources(sources, '  ')).toEqual([])
    expect(suggestDamageSources(sources, '취약').map(row => row.label)).toEqual(['취약', '취약점 분석기', '참격 취약'])
    expect(suggestDamageSources(sources, '취약', { limit: 2 })).toHaveLength(2)
    expect(suggestDamageSources(sources, '취약')[0]).toEqual({ key: 'k:취약:target', kind: 'keyword', label: '취약', perStack: 10, modifier: { name: '취약', keyword: '취약', stacks: 1, value: 10, target: 'damage', side: 'target' } })
    // A gift is offered once, at its base level: the level is switched where the gift is edited.
    expect(suggestDamageSources(sources, '미적')).toEqual([
      { key: 'g:9065', kind: 'gift', label: '미적 감각', modifier: { name: '미적 감각', value: 35, options: [35, 10], target: 'damage', gift: { id: '9065', level: 0, image_url: 'a.webp', grade: '4', keyword: 'Sinking' } } },
    ])
    // The shared engine: initials, a typo and spacing find a name too, best match first.
    expect(suggestDamageSources(sources, 'ㅈ').map(row => row.label)).toEqual(['주시'])
    expect(suggestDamageSources(sources, 'ㅊㅇ').map(row => row.label)).toEqual(['취약', '취약점 분석기', '참격 취약'])
    expect(suggestDamageSources(sources, '취얀').map(row => row.label)).toEqual(['취약', '참격 취약', '취약점 분석기'])
    expect(suggestDamageSources(sources, '취약점분석기').map(row => row.label)).toEqual(['취약점 분석기'])
    // The list is the whole result: a name that only holds the typed letter stays in it, after the engine's matches.
    expect(suggestDamageSources(sources, '약').map(row => row.label)).toEqual(['취약', '참격 취약', '취약점 분석기'])
    expect(suggestDamageSources(sources, '취약', { group: 'target', limit: 1 }).map(row => row.label)).toEqual(['취약'])
    expect(suggestDamageSources(sources, '주')[0].modifier).toEqual({ name: '주시', keyword: '주시', value: 20, options: [20], target: 'damage', side: 'target' })
    // Inside one group: everything of the group before a name is typed, then only its matches.
    expect(suggestDamageSources(sources, '', { group: 'target' }).map(row => row.label)).toEqual(['참격 취약', '취약', '주시'])
    expect(suggestDamageSources(sources, '', { group: 'self' }).map(row => row.label)).toEqual(['영감'])
    expect(suggestDamageSources(sources, '', { group: 'gift' }).map(row => row.label)).toEqual(['취약점 분석기', '미적 감각'])
    expect(suggestDamageSources(sources, '취약', { group: 'target' }).map(row => row.label)).toEqual(['취약', '참격 취약'])
    expect(suggestDamageSources(sources, '취약', { group: 'gift' }).map(row => row.label)).toEqual(['취약점 분석기'])
    expect(suggestDamageSources(sources, '', { group: 'target', limit: 2 })).toHaveLength(2)
  })
})
