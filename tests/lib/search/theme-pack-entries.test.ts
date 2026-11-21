import { describe, expect, it } from 'vitest'
import { search } from '@/lib/search/engine'
import { themePackEntries } from '@/lib/search/theme-pack-entries'

const pack = (id: number, name: string, extra: Record<string, unknown> = {}) => ({ id, name, name_en: null, name_jp: null, image_url: `p${id}.webp`, ...extra })
const packs = [pack(90001, '카지노 푸어', { name_en: 'Casino Poor' }), pack(90002, '기어오는 심연'), pack(90003, '불꽃놀이')]
const entries = themePackEntries(packs, 'ko')
const hrefs = (query: string, list = entries) => search(list, query).map(hit => hit.entry.href)

describe('theme pack entries', () => {
  it('find a pack by its initials, a typo and another language, and stand for it by its id', () => {
    expect(hrefs('ㅋㅈㄴ')).toEqual(['90001'])
    expect(hrefs('카지너')).toEqual(['90001'])
    expect(hrefs('casino')).toEqual(['90001'])
    expect(entries.map(entry => entry.href)).toEqual(['90001', '90002', '90003'])
  })

  it('show the pack art, in the page language', () => {
    expect(entries[0]).toMatchObject({ type: 'themePack', label: '카지노 푸어', icon: 'p90001.webp' })
    expect(themePackEntries(packs, 'en')[0].label).toBe('Casino Poor')
  })

  it('find a pack by extra text the host gives (the names of its gifts) as a text hit', () => {
    const withGifts = themePackEntries(packs, 'ko', theme => theme.id === 90002 ? '유리 조각 불꽃 깃털' : '')
    expect(search(withGifts, '불꽃 깃털').map(hit => [hit.entry.href, hit.kind])).toEqual([['90002', 'text']])
    expect(hrefs('유리', withGifts)).toEqual(['90002'])
    expect(hrefs('유리', entries)).toEqual([])
  })
})
