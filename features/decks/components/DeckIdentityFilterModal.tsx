'use client'

import { useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import { X } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import type { Identity } from '@/lib/data/sinners'
import { getSinnerLogoUrl } from '@/lib/utils/images'
import BaseModal from '@/components/ui/BaseModal'
import CharacterPickerFilters from '@/components/ui/CharacterPickerFilters'
import IdentityFrameCard from '@/components/cards/IdentityFrameCard'
import { pickGroup } from '@/components/ui/SearchRows'
import { filterStyles } from '@/components/board/FilterControls'
import { compareReleaseDate } from '@/lib/utils/release-order'
import { identityIcon, pickerEntries, pickerFound } from '@/lib/search/picker-search'
import { translations } from '@/lib/i18n/translations'
import type { SupportedLang } from '@/lib/i18n/types'
import '@/components/ui/character-picker.css'

export type DeckFilterSinner = {
  id: string
  name_kr: string
  order_num: number
}

export type DeckFilterIdentity = Identity & {
  sinner?: DeckFilterSinner | null
}

const nameOf = (identity: DeckFilterIdentity, locale: string) => (locale === 'en' ? identity.name_en : locale === 'ja' ? identity.name_jp : null) || identity.name_kr

/**
 * The identity filter's picker of the deck and plan boards, built like the planner's identity picker: name search, grade
 * and the sinners down the left, the cards on the right. Another sinner is one press away without closing it ('' is every
 * sinner). A pressed card joins the filter and closes the window (the filter keeps one identity per sinner, so the pick
 * is done); pressing the chosen card takes it off and leaves the window open. Newest identities come first, as in the
 * planner's picker. Reset clears the search and the grade and takes off the picks in view, keeping the sinner.
 */
export default function DeckIdentityFilterModal({ open, sinnerId, sinners, identities, selectedIdentityIds, onToggleIdentity, onClearIdentities, onSinnerChange, onClose }: {
  open: boolean
  sinnerId: string
  sinners: readonly DeckFilterSinner[]
  identities: readonly DeckFilterIdentity[]
  selectedIdentityIds: ReadonlySet<string>
  onToggleIdentity: (identityId: string) => void
  /** Takes every pick off the filter. */
  onClearIdentities: () => void
  onSinnerChange: (sinnerId: string) => void
  onClose: () => void
}) {
  const locale = useLocale()
  const t = useTranslations('decks.identityFilter')
  const rootT = useTranslations()
  const [query, setQuery] = useState(''), [grade, setGrade] = useState('')
  useEffect(() => { if (open) { setQuery(''); setGrade('') } }, [open])
  const sinnerName = (id: string) => rootT(`sinner.${id}` as Parameters<typeof rootT>[0])
  const entries = useMemo(() => pickerEntries('identity', identities, locale as SupportedLang, identity => ({
    id: identity.id, label: nameOf(identity, locale), names: { ko: identity.name_kr, en: identity.name_en, ja: identity.name_jp }, sinner: identity.sinner_id, icon: identityIcon(identity),
  })), [identities, locale])
  // Newest first; with a query the best match first.
  const { list: shown, top } = useMemo(() => pickerFound(
    entries, identities.filter(identity => (!sinnerId || identity.sinner_id === sinnerId) && (!grade || String(identity.rarity) === grade)).sort(compareReleaseDate), identity => identity.id, query,
    // What is already in the filter is not suggested: picking it again would take it off.
    identity => !selectedIdentityIds.has(identity.id),
  ), [entries, identities, sinnerId, grade, query, selectedIdentityIds])
  // What pressing the card does: a pressed card joins the filter and closes the window, the chosen one comes off.
  const pick = (identityId: string) => { onToggleIdentity(identityId); if (!selectedIdentityIds.has(identityId)) onClose() }
  // The picks in view: this sinner's, or all of them when every sinner is shown.
  const picked = useMemo(() => identities.filter(identity => selectedIdentityIds.has(identity.id) && (!sinnerId || identity.sinner_id === sinnerId)).map(identity => identity.id),
    [identities, selectedIdentityIds, sinnerId])
  const reset = () => {
    setQuery(''); setGrade('')
    // The filter keeps one identity per sinner, so a sinner has one pick to toggle off; a hand-written URL with
    // two would keep one of them (each toggle reads the same selection).
    if (!sinnerId) onClearIdentities()
    else picked.forEach(onToggleIdentity)
  }
  const title = sinnerId ? t('title', { sinner: sinnerName(sinnerId) }) : t('fallbackTitle')

  return (
    <BaseModal open={open} onClose={onClose} maxWidth="64rem" title={title} description={t('description')}>
      <div className={filterStyles.picker}>
        <div className={filterStyles.pickerHead}>
          {sinnerId && <Image src={getSinnerLogoUrl(sinnerId)} alt="" width={24} height={24} />}
          {/* The window's heading is the dialog title BaseModal already gives it; this is its visible copy. */}
          <p>{title}{selectedIdentityIds.size > 0 && <b>{selectedIdentityIds.size}</b>}</p>
          <button type="button" onClick={onClose} aria-label={t('close')}><X size={20} aria-hidden="true" /></button>
        </div>
        <div className="character-picker-layout">
          <CharacterPickerFilters query={query} onQuery={setQuery} groups={[pickGroup(translations['sinners.identities'][locale as SupportedLang], top, identity => pick(identity.id))]} grade={grade} onGrade={setGrade} count={shown.length}
            grades={[3, 2, 1].map(n => ({ value: String(n), label: '0'.repeat(n) }))}
            sinner={sinnerId} onSinner={onSinnerChange} sinners={sinners.map(sinner => ({ id: sinner.id, name: sinnerName(sinner.id) }))}
            onReset={reset} canReset={Boolean(query || grade || picked.length)} />
          <div className={filterStyles.pickerResults}>
            {shown.length > 0 ? (
              <ul className={filterStyles.pickerGrid}>
                {shown.map(identity => {
                  const selected = selectedIdentityIds.has(identity.id)
                  const name = nameOf(identity, locale)
                  // With every sinner listed, identities of different sinners share names ("W사 3등급 정리 요원"): the sinner tells them apart.
                  const spoken = sinnerId ? name : `${sinnerName(identity.sinner_id)} ${name}`
                  return (
                    <li key={identity.id}>
                      <button type="button" aria-pressed={selected} aria-label={t(selected ? 'remove' : 'add', { identity: spoken })} onClick={() => pick(identity.id)}>
                        <IdentityFrameCard identity={identity} name={name} selected={selected} sizes="(max-width: 40rem) 30vw, 10rem" />
                      </button>
                    </li>
                  )
                })}
              </ul>
            ) : <p className={filterStyles.pickerEmpty}>{identities.length ? t('noResults') : t('loadFailed')}</p>}
          </div>
        </div>
      </div>
    </BaseModal>
  )
}
