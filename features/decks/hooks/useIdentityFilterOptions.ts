'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { IDENTITY_FILTER_SELECT_LEGACY, IDENTITY_FILTER_SELECT_WITH_SKILL_KEYWORDS, type IdentityNameEntry } from '../lib/filter-params'

// What the deck and plan boards read beside the identity options (the sinner tiles, the formation count parameter). The
// boards take them from here and not from the entry file: the entry is read by every route, and each export added there
// adds to every route's first JS.
export { collectFilterSinners, normalizeFormationCountParam } from '../lib/deck-list'

/** Every identity for the filter picker and the search suggestions, read in the browser. Throws when the read fails. */
export async function loadIdentityFilterOptions(): Promise<IdentityNameEntry[]> {
  const { createClient: createBrowserClient } = await import('@/lib/supabase/client')
  const supabase = createBrowserClient()
  const buildQuery = (select: string) => supabase
    .schema('limbus')
    .from('identities')
    .select(select)
    .order('sinner_id')
    .order('rarity', { ascending: false })
    .order('name_kr')

  let { data, error } = await buildQuery(IDENTITY_FILTER_SELECT_WITH_SKILL_KEYWORDS)
  if (error && error.message.includes('skill_keyword_list')) {
    const legacyResult = await buildQuery(IDENTITY_FILTER_SELECT_LEGACY)
    data = legacyResult.data
    error = legacyResult.error
  }

  if (error) throw error
  return (data ?? []) as unknown as IdentityNameEntry[]
}

/**
 * The identities of the filter picker. Read on mount, or with `lazy` only when `ensureLoaded` is called (the plan board
 * calls it itself when it mounts). `ensureLoaded` shares one request and rejects when the read fails; a
 * mount read logs the failure instead.
 */
export function useIdentityFilterOptions({ lazy = false }: { lazy?: boolean } = {}) {
  const [identities, setIdentities] = useState<IdentityNameEntry[]>([])
  const requestRef = useRef<Promise<void> | null>(null)
  const ensureLoaded = useCallback(() => {
    if (identities.length > 0) return Promise.resolve()
    if (requestRef.current) return requestRef.current

    requestRef.current = (async () => {
      try {
        setIdentities(await loadIdentityFilterOptions())
      } finally {
        requestRef.current = null
      }
    })()

    return requestRef.current
  }, [identities.length])

  useEffect(() => {
    if (lazy) return
    ensureLoaded().catch(error => console.error('인격 필터 데이터 로드 실패:', error))
  }, [lazy, ensureLoaded])

  return { identities, ensureLoaded }
}
