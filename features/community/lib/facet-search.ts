import type { IndexEntry } from '@/lib/search/engine'
import { getLocalizedAffiliation } from '@/lib/i18n/localize'
import type { SupportedLang } from '@/lib/i18n/types'
import { getAffiliationIconUrl } from '@/lib/constants/affiliation-icons'

/** One entry per affiliation of a board's facets, found by its name in any language; its `href` is the affiliation's key. */
export const affiliationEntries = (items: readonly { key: string }[], lang: SupportedLang): IndexEntry[] => items.map(({ key }) => ({
  type: 'keyword',
  href: key,
  label: getLocalizedAffiliation(key, lang),
  icon: getAffiliationIconUrl(key) ?? undefined,
  names: { ko: key, en: getLocalizedAffiliation(key, 'en'), ja: getLocalizedAffiliation(key, 'ja') },
}))
