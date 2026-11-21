import { SINNER_ALIASES } from '@/lib/search/sinner-aliases'
import { translations } from '@/lib/i18n/translations'
import type { SupportedLang } from '@/lib/i18n/types'

const names = (sinnerId: string) => translations[`sinner.${sinnerId}` as keyof typeof translations] as { ko: string; en: string; ja: string } | undefined

/** Every name a sinner is searched by: the site's names in three languages, then the aliases. */
export const sinnerTexts = (sinnerId: string): string[] => {
  const n = names(sinnerId)
  return [...(n ? [n.ko, n.en, n.ja] : []), ...(SINNER_ALIASES[sinnerId] ?? [])]
}

/** The sinner's name in the page language (the id when the site has no name for it). */
export const sinnerName = (sinnerId: string, lang: SupportedLang) => names(sinnerId)?.[lang] ?? sinnerId
