import { describe, expect, it } from 'vitest'
import { search } from '@/lib/search/engine'
import type { MotionEgo, MotionIdentity, MotionSinner, MotionSkill } from '@/features/motion/lib/catalog'
import { motionIndex, motionMatches, motionRows } from '@/features/motion/lib/motion-suggestions'

const skill = (key: string, title: string): MotionSkill => ({ key, skillId: 1, title, form: null, states: [] })
const identity = (slug: string, label: string, skills: MotionSkill[] = [], extra: Partial<MotionIdentity> = {}): MotionIdentity =>
  ({ slug, label, identityId: null, gameId: null, portrait: `/p/${slug}.webp`, rarity: 3, folderName: null, released: null, skills, ...extra })
const ego = (egoId: number, label: string, skills: MotionSkill[] = []): MotionEgo => ({ egoId, grade: 'WAW', label, image: `/e/${egoId}.webp`, sin: null, skills })

const sinners: MotionSinner[] = [
  { id: 'faust', identities: [identity('id10216', '쐐기 사무소 파우스트', [skill('id10216-1', '여명의 섬광'), skill('id10216-2', '쐐기 박기')]), identity('id10217', '남부 츠키 파우스트', [skill('id10217-1', '검은 구름')])], egos: [ego(20101, '표상 방출기', [skill('ego20101-1', '방출')])] },
  { id: 'ryoshu', identities: [identity('id10616', '검계 살수', [skill('id10616-1', '일섬')])], egos: [ego(20601, '적안', [skill('ego20601-1', '적안 개방')])] },
]
const label = (id: string) => (id === 'faust' ? '파우스트' : '료슈')
const index = motionIndex(sinners, label)
const hrefs = (hits: { entry: { href: string } }[]) => hits.map(hit => hit.entry.href)
const run = (query: string) => search(index.entries, query)

describe('motion entries', () => {
  it('finds an identity from a mistyped name and from its initials', () => {
    expect(hrefs(motionRows(run('쇄기')).identities)).toEqual(['i:id10216'])
    expect(hrefs(motionRows(run('ㅍㅅㅂㅊㄱ')).egos)).toEqual(['e:20101'])
  })

  it('finds a skill by its title and shows whose it is at the right edge', () => {
    const { skills } = motionRows(run('섬광'))
    expect(skills.map(hit => [hit.entry.href, hit.entry.label, hit.entry.sublabel])).toEqual([['s:id10216-1', '여명의 섬광', '쐐기 사무소 파우스트']])
  })

  it('finds the identities and E.G.O of a sinner by her name, below the ones named so', () => {
    const rows = motionRows(run('료슈'))
    expect(hrefs(rows.identities)).toEqual(['i:id10616'])
    expect(hrefs(rows.egos)).toEqual(['e:20601'])
    expect(rows.identities[0].entry.sublabel).toBe('료슈')
  })

  it('does not find the skills of a sinner by her name', () => {
    expect(motionRows(run('료슈')).skills).toEqual([])
  })

  it('caps the groups at 4 each', () => {
    const many: MotionSinner[] = [{ id: 'faust', egos: [], identities: Array.from({ length: 6 }, (_, i) => identity(`id${i}`, `불꽃 인격 ${i}`, [skill(`s${i}a`, '불꽃 베기'), skill(`s${i}b`, '불꽃 찌르기')])) }]
    const rows = motionRows(search(motionIndex(many, label).entries, '불꽃'))
    expect([rows.identities.length, rows.egos.length, rows.skills.length]).toEqual([4, 0, 4])
  })
})

describe('the cards a search lists', () => {
  const cards = (query: string) => motionMatches(index, run(query)).map(card => [card.sinnerId, 'egoId' in card.owner ? card.owner.egoId : card.owner.slug, card.skill?.title])

  it('lists the owner once, with the skill only when the skill is what was found', () => {
    expect(cards('섬광')).toEqual([['faust', 'id10216', '여명의 섬광']])
    // the name matches the identity as well as a skill: the card is the identity's
    expect(cards('쐐기')).toEqual([['faust', 'id10216', undefined]])
  })

  it('lists identities and E.G.O together, best match first', () => {
    expect(cards('파우스트')).toEqual([['faust', 'id10217', undefined], ['faust', 'id10216', undefined], ['faust', 20101, undefined]])
    expect(cards('적안')).toEqual([['ryoshu', 20601, undefined]])
  })

  it('lists no card for an unknown word', () => {
    expect(cards('zzzz')).toEqual([])
  })
})
