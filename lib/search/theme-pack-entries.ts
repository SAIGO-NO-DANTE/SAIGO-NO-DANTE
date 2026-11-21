import type { IndexEntry } from '@/lib/search/engine'
import { localizeRowName } from '@/lib/i18n/localize'
import type { SupportedLang } from '@/lib/i18n/types'
import { getThemePackCompositeImageUrl, getThemePackVisualConfig } from '@/lib/data/theme-pack-visuals'

type Pack = { id: number | string; name: string; name_en?: string | null; name_jp?: string | null; image_url?: string | null }

/**
 * One entry per theme pack, its `href` the pack's id and its picture the one its card shows. `text` is more the pack is
 * found by (the names of its gifts): a pack found only through it is a text hit.
 */
export function themePackEntries<T extends Pack>(packs: readonly T[], lang: SupportedLang, text?: (pack: T) => string): IndexEntry[] {
  return packs.map(pack => ({
    type: 'themePack',
    href: String(pack.id),
    label: localizeRowName(pack, lang),
    icon: (getThemePackVisualConfig(Number(pack.id)) ? getThemePackCompositeImageUrl(Number(pack.id)) : pack.image_url) ?? undefined,
    names: { ko: pack.name, en: pack.name_en, ja: pack.name_jp },
    text: text?.(pack) || undefined,
  }))
}
