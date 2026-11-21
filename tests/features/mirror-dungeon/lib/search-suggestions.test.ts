import { describe, expect, it } from 'vitest'
import type { EgoGift, EgoGiftTheme, MdEvent, MdEventChoice } from '@/features/mirror-dungeon/types'
import {
  choiceEntries, eventEntries, eventSuggestions, foundEventIds, giftEntries, giftSuggestions, givenGiftEntries, keywordEntries, packEntries, packSuggestions,
} from '@/features/mirror-dungeon/lib/search-suggestions'

const gift = (id: string, name: string, keyword: string, effect: string | null, extra: Partial<EgoGift> = {}): EgoGift => ({
  id, name, keyword, grade: '1', enhancement: false, price: null, buy_disabled: false, effect_base: effect, effect_plus: null, effect_plusplus: null,
  activation_condition: null, is_synthesis: false, image_url: null, game_id: Number(id), difficulty: null, convert_to: null, ...extra,
})
const same = (key: string) => key
const hrefs = (hits: { entry: { href: string } }[]) => hits.map(hit => hit.entry.href)
const ALL = () => true

const gifts = [
  gift('1', '쐐기 파편', '출혈', '적에게 출혈 3 부여'),
  gift('2', '불꽃 깃털', '화상', '적에게 화상 2 부여, 턴 시작 시 체력 회복'),
  gift('3', '유리 조각', '진동', '적의 화상 피해 증가'),
  gift('4', '화상 부적', '공통', '화상 피해 증가'),
]
const entries = giftEntries(gifts, 'ko', same)
const keywords = keywordEntries(gifts, ['공통', '화상', '출혈', '진동', '타격'], same)

describe('gift suggestions', () => {
  it('finds a gift from a mistyped name', () => {
    expect(hrefs(giftSuggestions(entries, keywords, '쇄기', ALL).names)).toEqual(['1'])
  })

  it('lists the gifts by name, then those through their keyword, and the effects of the rest', () => {
    const found = giftSuggestions(entries, keywords, '화상', ALL)
    expect(hrefs(found.names)).toEqual(['4', '2'])
    expect(hrefs(found.effects)).toEqual(['3'])
  })

  it('does not list a gift in the effects when its name is already listed', () => {
    const found = giftSuggestions(entries, keywords, '화상', ALL)
    // gift 4 holds the query in its effect too
    expect(gifts[3].effect_base).toContain('화상')
    expect(hrefs(found.effects)).not.toContain('4')
    expect(found.effects[0].snippet).toEqual({ before: '적의 ', hit: '화상', after: ' 피해 증가' })
  })

  it('completes the last word only, by keyword', () => {
    const found = giftSuggestions(entries, keywords, '적에게 화', ALL)
    expect(hrefs(found.keywords)).toEqual(['화상'])
  })

  it('leaves out gifts the host cannot pick', () => {
    expect(hrefs(giftSuggestions(entries, keywords, '쐐기', id => id !== '1').names)).toEqual([])
  })

  it('suggests nothing for an empty query', () => {
    expect(giftSuggestions(entries, keywords, '  ', ALL)).toEqual({ names: [], keywords: [], effects: [] })
  })

  it('caps the groups at 6 names, 6 keywords and 4 effects', () => {
    const many = [
      ...Array.from({ length: 8 }, (_, i) => gift(`1${i}`, `불꽃 검 ${i}`, `화${i}`, null)),
      ...Array.from({ length: 6 }, (_, i) => gift(`2${i}`, `철 ${i}`, '공통', '불꽃 피해')),
    ]
    const found = giftSuggestions(giftEntries(many, 'ko', same), keywordEntries(many, many.map(g => g.keyword), same), '불꽃', ALL)
    expect([found.names.length, found.effects.length]).toEqual([6, 4])
    expect(giftSuggestions(giftEntries(many, 'ko', same), keywordEntries(many, many.map(g => g.keyword), same), '화', ALL).keywords).toHaveLength(6)
  })

  it('reads the effect of the page language, and [Id] as the name it is given', () => {
    const raw = gift('5', 'Flare', '화상', '[Burn] 부여', { name_en: 'Flare', effect_base_en: 'Inflict [Burn]' })
    const en = giftEntries([raw], 'en', same, { Burn: 'Burn' })
    expect(en[0].text).toBe('Inflict Burn')
    expect(giftEntries([raw], 'ko', same, { Burn: '화상' })[0].text).toBe('화상 부여')
  })
})

describe('keyword entries', () => {
  it('counts the gifts of each keyword in the given order, without the common one or empty ones', () => {
    expect(keywords.map(k => [k.href, k.sublabel])).toEqual([['화상', '1'], ['출혈', '1'], ['진동', '1']])
  })
})

const pack = (id: number, name: string, giftIds: number[], extra: Partial<EgoGiftTheme> = {}): EgoGiftTheme => ({
  id, name, ego_gift_ids: giftIds, specific_ego_gift_ids: [], image_url: null, difficulty: null, floor_info: null, is_hidden: false, hidden_rate: null, fixed_reward_gift_ids: null, ...extra,
})
const byGameId = new Map(gifts.map(g => [g.game_id!, g]))

describe('pack suggestions', () => {
  const packs = [pack(10, '기어오는 심연', [1, 2]), pack(11, '불꽃의 길', [2])]

  it('lists a pack by its own name and the gifts some pack gives, with how many', () => {
    const found = packSuggestions(packEntries(packs, byGameId, 'ko'), givenGiftEntries(packs.map(p => p.ego_gift_ids), byGameId, 'ko'), '불꽃')
    expect(hrefs(found.packs)).toEqual(['11'])
    expect(found.gifts.map(hit => [hit.entry.href, hit.entry.sublabel])).toEqual([['2', '2']])
  })

  it('keeps a pack that only holds the gift out of the pack names, but still finds it for the list', () => {
    const index = packEntries(packs, byGameId, 'ko')
    expect(hrefs(packSuggestions(index, [], '쐐기 파편').packs)).toEqual([])
    expect(hrefs(packSuggestions(index, [], '쇄기').packs)).toEqual([])
  })
})

const event = (id: number, name: string | null, desc: string, extra: Partial<MdEvent> = {}): MdEvent => ({
  id, name, desc_text: desc, event_type: null, source: null, image_url: null, theme_ids: null, gift_ids: null, variant_of: null, category: null, ...extra,
})
const choice = (id: number, event_id: number, message: string, message_desc: string | null = null): MdEventChoice => ({
  id, event_id, sort_order: id, message, message_desc, result_text: null, probability: null, next_event_id: null, effects: null,
})

describe('event suggestions', () => {
  const events = [event(1, '낡은 상자', '길가에 상자가 놓여 있다', { gift_ids: [2] }), event(2, '수상한 상인', '상인이 물건을 권한다'), event(3, null, '낡은 우물 앞에 선다')]
  const choices = new Map([[1, [choice(11, 1, '상자를 연다', '화상을 입을 수도 있다')]], [2, [choice(21, 2, '물건을 산다')]]])
  const title = (e: MdEvent) => e.name ?? e.desc_text ?? ''
  const eventIndex = eventEntries(events, byGameId, 'ko', title)
  const choiceIndex = choiceEntries(events, choices, title)
  const giftIndex = givenGiftEntries(events.map(e => e.gift_ids ?? []), byGameId, 'ko')

  it('lists events by name, then by description, and choices by their wording with the event as the name', () => {
    const found = eventSuggestions(eventIndex, choiceIndex, giftIndex, '상자')
    expect(hrefs(found.events)).toEqual(['1'])
    expect(found.choices.map(hit => [hit.entry.sublabel, hit.snippet?.hit])).toEqual([['낡은 상자', '상자']])
    expect(eventSuggestions(eventIndex, choiceIndex, giftIndex, '권한다').events[0].snippet?.hit).toBe('권한다')
  })

  it('keeps a choice out of the event names and an event that only gives the gift out of the event rows', () => {
    const found = eventSuggestions(eventIndex, choiceIndex, giftIndex, '불꽃 깃털')
    expect(found.events).toEqual([])
    expect(found.choices).toEqual([])
    expect(found.gifts.map(hit => [hit.entry.href, hit.entry.sublabel])).toEqual([['2', '1']])
  })

  it('finds an event by its choice and by its reward gift, the ones matched by name first', () => {
    expect(foundEventIds(eventIndex, choiceIndex, '화상')).toEqual([1])
    expect(foundEventIds(eventIndex, choiceIndex, '물건')).toEqual([2])
    expect(foundEventIds(eventIndex, choiceIndex, '불꽃 깃털')).toEqual([1])
    expect(foundEventIds(eventIndex, choiceIndex, '상')).toEqual([1, 2])
  })
})
