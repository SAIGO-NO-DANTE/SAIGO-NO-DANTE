import { describe, expect, it } from 'vitest'
import { BLOCK_LABELS } from '@/lib/notes/blocks'
import { matchBlockKinds } from '@/features/notes/lib/block-menu'
import { foundAssetIds } from '@/features/notes/lib/asset-search'
import type { NoteAssetData } from '@/features/notes/lib/assets'

describe('the / block menu', () => {
  it('lists every kind, in menu order, for a bare slash', () => {
    expect(matchBlockKinds('')).toEqual(Object.keys(BLOCK_LABELS))
  })

  it('finds a kind by its name in any language, by the key and by its initials', () => {
    expect(matchBlockKinds('기프')[0]).toBe('gift')
    expect(matchBlockKinds('theme')[0]).toBe('theme')
    expect(matchBlockKinds('スキル')).toEqual(['skill'])
    expect(matchBlockKinds('ego')[0]).toBe('ego')
    expect(matchBlockKinds('에고')[0]).toBe('ego')
    expect(matchBlockKinds('ㅋㅇㄷ')).toEqual(['keyword'])
  })

  it('finds a kind from a mistyped name and puts the best match first', () => {
    expect(matchBlockKinds('아코디온')).toEqual(['accordion'])
    expect(matchBlockKinds('테마')[0]).toBe('theme')
  })

  it('finds nothing for a word that is no block', () => {
    expect(matchBlockKinds('zzzz')).toEqual([])
  })
})

describe('the asset picker search', () => {
  const asset = (id: string, name: string, name_en?: string, name_jp?: string) => ({ id, kind: 'gift', name, name_en, name_jp }) as NoteAssetData
  const assets = [asset('1', '화상 반지', 'Burn Ring', '火傷の指輪'), asset('2', '출혈 목걸이', 'Bleed Necklace'), asset('3', '안개 속의 편광')]

  it('keeps every asset for no query', () => {
    expect(foundAssetIds(assets, '')).toBeNull()
    expect(foundAssetIds(assets, '  ')).toBeNull()
  })

  it('finds assets by a name in any language, initials, a typo and the name without spaces', () => {
    expect([...foundAssetIds(assets, '화상')!]).toEqual(['1'])
    expect([...foundAssetIds(assets, 'burn')!]).toEqual(['1'])
    expect([...foundAssetIds(assets, '火傷')!]).toEqual(['1'])
    expect([...foundAssetIds(assets, 'ㅊㅎㅁㄱㅇ')!]).toEqual(['2'])
    expect([...foundAssetIds(assets, '출핼목걸이')!]).toEqual(['2'])
    expect([...foundAssetIds(assets, '안개속의편강')!]).toEqual(['3'])
  })

  it('finds nothing for an unknown name', () => {
    expect(foundAssetIds(assets, '없는 기프트')!.size).toBe(0)
  })
})
