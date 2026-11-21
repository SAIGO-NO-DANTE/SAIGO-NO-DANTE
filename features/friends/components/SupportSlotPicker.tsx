'use client'

import { useMemo, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import useSWR from 'swr'
import { Check, Trash2 } from 'lucide-react'
import BaseModal from '@/components/ui/BaseModal'
import CharacterPickerFilters from '@/components/ui/CharacterPickerFilters'
import { pickGroup } from '@/components/ui/SearchRows'
import { identityIcon, pickerEntries, pickerFound } from '@/lib/search/picker-search'
import { translations } from '@/lib/i18n/translations'
import IdentityFrameCard from '@/components/cards/IdentityFrameCard'
import { fetchNoteAssets } from '@/features/notes/components/NoteBlockViewer'
import { SINNER_SLUGS } from '@/lib/constants/game'
import { getEgoGradeBannerUrl, getSinnerLogoUrl } from '@/lib/utils/images'
import { assetName, type NoteAssetData } from '@/features/notes'
import { compareReleaseDate } from '@/lib/utils/release-order'
import type { SupportedLang } from '@/lib/i18n/types'
import SupportStrips, { EGO_GRADES, type EgoGrade, type SupportSlot } from './SupportStrips'
import '@/components/ui/character-picker.css'
import styles from './SupportSlotPicker.module.css'

const RARITIES = [3, 2, 1].map(n => ({ value: String(n), label: '0'.repeat(n) }))

/**
 * Picks the identity of one strip and, unless identityOnly, the E.G.O set on it (one per grade). The frame is the site's
 * character picker (header, the shared filters on the left, identities grouped by sinner); every choice is applied at once,
 * so closing the window any way keeps it.
 */
export default function SupportSlotPicker({ index, value, onChange, onClose, title, identityOnly = false }: {
  index: number; value: SupportSlot | null; onChange: (slot: SupportSlot | null) => void; onClose: () => void
  title: string; identityOnly?: boolean
}) {
  const lang = useLocale() as SupportedLang, t = useTranslations('sinner'), tf = useTranslations('friends')
  const [query, setQuery] = useState(''), [grade, setGrade] = useState(''), [sinner, setSinner] = useState(value?.identity.sinner_id ?? '')
  const [slot, setLocal] = useState<SupportSlot | null>(value)
  const setSlot = (next: SupportSlot | null) => { setLocal(next); onChange(next) }
  const identities = useSWR('/api/notes/assets?kind=identity&catalog=1', fetchNoteAssets, { revalidateOnFocus: false })
  const egos = useSWR('/api/notes/assets?kind=ego&catalog=1', fetchNoteAssets, { revalidateOnFocus: false })
  const catalog = useMemo(() => (identities.data ?? []).filter(asset => asset.identity), [identities.data])
  const entries = useMemo(() => pickerEntries('identity', catalog, lang, asset => ({
    id: asset.id, label: assetName(asset, lang), names: { ko: asset.name, en: asset.name_en, ja: asset.name_jp }, sinner: asset.identity!.sinner_id, icon: identityIcon(asset.identity!),
  })), [catalog, lang])
  // Newest first; with a query the best match first.
  const { list, top } = useMemo(() => pickerFound(
    entries, catalog.filter(asset => (!sinner || asset.identity!.sinner_id === sinner) && (!grade || String(asset.identity!.rarity) === grade)).sort((a, b) => compareReleaseDate(a.identity!, b.identity!)), asset => asset.id, query,
  ), [entries, catalog, sinner, grade, query])
  const choose = (asset: NoteAssetData) => setSlot({ identityId: asset.id, identity: asset.identity!, name: assetName(asset, lang), egos: slot?.identity.sinner_id === asset.identity!.sinner_id ? slot.egos : {} })
  return <BaseModal open onClose={onClose} title={title} maxWidth="74rem" padding="0">
    <div className={`note-picker note-character-picker ${styles.picker}`}>
      <header className="note-picker-header">
        <h2>{title}</h2>
        <div className={styles.actions}>
          <button type="button" disabled={!slot} onClick={() => setSlot(null)} aria-label={tf('picker.clear')} title={tf('picker.clear')}><Trash2 size={19} aria-hidden="true" /></button>
          <button type="button" className={styles.apply} onClick={onClose}><Check size={18} strokeWidth={3} aria-hidden="true" />{tf('picker.apply')}</button>
        </div>
      </header>
      <div className={`character-picker-layout ${identityOnly ? '' : styles.withSide}`}>
        <CharacterPickerFilters query={query} onQuery={setQuery} grade={grade} onGrade={setGrade} groups={[pickGroup(translations['sinners.identities'][lang], top, choose)]} grades={RARITIES} count={list.length}
          sinner={sinner} onSinner={setSinner} sinners={SINNER_SLUGS.map(id => ({ id, name: t(id) }))} />
        <div className={`note-picker-results ${styles.results}`}>
          {SINNER_SLUGS.map(id => {
            const items = list.filter(asset => asset.identity!.sinner_id === id)
            if (!items.length) return null
            return <section key={id}>
              {/* eslint-disable-next-line @next/next/no-img-element -- small fixed-size game icon */}
              <h3><img src={getSinnerLogoUrl(id)} alt="" width={28} height={28} />{t(id)}<small>{items.length}</small></h3>
              <div className={styles.identities}>
                {items.map(asset => <button type="button" key={asset.id} aria-pressed={slot?.identityId === asset.id} onClick={() => choose(asset)}>
                  <IdentityFrameCard identity={asset.identity!} name={assetName(asset, lang)} selected={slot?.identityId === asset.id} sizes="7rem" />
                </button>)}
              </div>
            </section>
          })}
        </div>
        {!identityOnly && <div className={styles.side}>
          <SupportPreview slot={slot} index={index} />
          <div className={`${styles.egos} ${slot ? '' : styles.dim}`}>
            {EGO_GRADES.map(egoGrade => {
              const options = slot ? (egos.data ?? []).filter(asset => asset.sinnerId === slot.identity.sinner_id && asset.ego?.grade?.toUpperCase() === egoGrade) : []
              return <section key={egoGrade} className={styles.egoRow} data-grade={egoGrade}>
                <span className={styles.grade}>
                  {/* eslint-disable-next-line @next/next/no-img-element -- the game's own rank banner, fixed width */}
                  <img src={getEgoGradeBannerUrl(egoGrade)} alt={egoGrade} style={{ top: `calc(50% - ${BANNER_CENTRE[egoGrade] / 185 * BANNER_WIDTH_REM}rem)` }} />
                </span>
                <div>{options.map(asset => asset.ego && <button type="button" key={asset.id} title={assetName(asset, lang)}
                  aria-label={assetName(asset, lang)} aria-pressed={slot?.egos[egoGrade] === asset.id} style={{ backgroundImage: asset.ego.image_url ? `url("${asset.ego.image_url}")` : undefined }}
                  onClick={() => slot && setSlot({ ...slot, egos: toggled(slot.egos, egoGrade, asset.id) })} />)}</div>
              </section>
            })}
          </div>
        </div>}
      </div>
    </div>
  </BaseModal>
}

/**
 * Where the banner sits inside each 185 px wide rank-banner image (rows from the top): the images differ in height and
 * padding, so they are lined up by the banner itself, not by the image box.
 */
const BANNER_CENTRE: Record<EgoGrade, number> = { ZAYIN: 38.5, TETH: 38, HE: 41, WAW: 48.5, ALEPH: 39.5 }
const BANNER_WIDTH_REM = 4.6

/** One E.G.O per grade: choosing the set one again takes it off. */
const toggled = (egos: SupportSlot['egos'], grade: EgoGrade, id: string): SupportSlot['egos'] => {
  const next = { ...egos }
  if (next[grade] === id) delete next[grade]
  else next[grade] = id
  return next
}

/** The slot as it will look in the line-up. */
function SupportPreview({ slot, index }: { slot: SupportSlot | null; index: number }) {
  const slots = Array.from({ length: 12 }, (_, at) => at === index ? slot : null)
  return <div style={{ display: 'grid' }}><div style={{ gridArea: '1 / 1' }}><SinglePreview slots={slots} index={index} /></div></div>
}
function SinglePreview({ slots, index }: { slots: (SupportSlot | null)[]; index: number }) {
  // Only this slot's strip: the others are hidden, the shared component keeps the look identical.
  return <div style={{ overflow: 'hidden' }} data-only={index}>
    <style>{`[data-only="${index}"] > div > :not(:nth-child(${index + 1})) { display: none }`}</style>
    <SupportStrips slots={slots} />
  </div>
}
