import { search, type IndexEntry } from '@/lib/search/engine'
import { sinnerTexts } from '@/lib/search/sinner-names'
import type { IdentityStat } from '@/lib/meta/types'

type KeywordNames = Record<string, { nameEn?: string | null; nameJp?: string | null } | undefined>

/**
 * The analysis identities that match `query`, best first, by the site search engine: names in all three languages,
 * the sinner's names and aliases, keywords (with their en/ja names from `keywords`), initial consonants, several
 * words and one typo. An empty query returns `rows` as given.
 */
export function searchIdentityRows(rows: IdentityStat[], query: string, keywords: KeywordNames = {}): IdentityStat[] {
  if (!query.trim()) return rows
  const entries: IndexEntry[] = rows.map(row => ({
    type: 'identity', href: row.identity_id, label: row.name_kr,
    names: { ko: row.name_kr, en: row.name_en, ja: row.name_jp },
    context: [
      ...sinnerTexts(row.sinner_id).map(text => ({ field: 'sinner' as const, text })),
      ...row.keywords.flatMap(keyword => [keyword, keywords[keyword]?.nameEn, keywords[keyword]?.nameJp])
        .filter((text): text is string => !!text).map(text => ({ field: 'keyword' as const, text })),
    ],
  }))
  const byId = new Map(rows.map(row => [row.identity_id, row]))
  return search(entries, query).map(hit => byId.get(hit.entry.href)!)
}
