'use client'

import { useMemo, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import useSWR from 'swr'
import { X } from 'lucide-react'
import BaseModal from '@/components/ui/BaseModal'
import CharacterPickerFilters from '@/components/ui/CharacterPickerFilters'
import { pickGroup } from '@/components/ui/SearchRows'
import { identityIcon, pickerEntries, pickerFound } from '@/lib/search/picker-search'
import { translations } from '@/lib/i18n/translations'
import type { SupportedLang } from '@/lib/i18n/types'
import IdentityFrameCard from '@/components/cards/IdentityFrameCard'
import { SINNER_SLUGS } from '@/lib/constants/game'
import { getSinnerLogoUrl } from '@/lib/utils/images'
import { compareReleaseDate } from '@/lib/utils/release-order'
import { assetName, type NoteAssetData } from '@/features/notes/lib/assets'
import { NoteAssetArtwork } from './NoteAssetArtwork'
import { fetchNoteAssets } from './NoteBlockViewer'
import '@/components/ui/character-picker.css'

export default function NoteCharacterPicker({ kind, onSelect, onClose }: {
  kind: 'identity' | 'ego'; onSelect: (asset: NoteAssetData) => void; onClose: () => void
}) {
  const lang = useLocale(), t = useTranslations('sinner')
  const tr = (ko: string, ja: string, en: string) => lang === 'ja' ? ja : lang === 'en' ? en : ko
  const [query, setQuery] = useState(''), [grade, setGrade] = useState(''), [sinner, setSinner] = useState('')
  const { data = [], error, isLoading, mutate } = useSWR(`/api/notes/assets?kind=${kind}&catalog=1`, fetchNoteAssets, { revalidateOnFocus: false })
  const entries = useMemo(() => pickerEntries(kind, data, lang as SupportedLang, a => ({
    id: a.id, label: assetName(a, lang), names: { ko: a.name, en: a.name_en, ja: a.name_jp }, sinner: a.identity?.sinner_id ?? a.sinnerId,
    icon: a.identity ? identityIcon(a.identity) : a.ego?.image_url ?? a.image_url,
  })), [kind, data, lang])
  // Newest first; with a query the best match first.
  const { list: filtered, top } = useMemo(() => pickerFound(
    entries, data.filter(a => (!sinner || (a.identity?.sinner_id ?? a.sinnerId) === sinner) && (!grade || String(a.identity?.rarity ?? a.grade) === grade)).sort((a, b) => compareReleaseDate(a.identity ?? a, b.identity ?? b)), a => a.id, query,
  ), [entries, data, sinner, grade, query])
  const title = kind === 'identity' ? tr('인격 추가', '人格を追加', 'Add identity') : tr('E.G.O 추가', 'E.G.Oを追加', 'Add E.G.O')
  const grades = kind === 'identity' ? [3, 2, 1].map(n => ({ value: String(n), label: '0'.repeat(n) })) : ['ZAYIN', 'TETH', 'HE', 'WAW', 'ALEPH'].map(value => ({ value, label: value }))
  return <BaseModal open onClose={onClose} title={title} maxWidth="62rem" zIndex={10000}>
    <div className={`note-picker note-character-picker note-character-picker--${kind}`}>
      <header className="note-picker-header"><h2>{title}</h2><button type="button" onClick={onClose} aria-label={tr('닫기', '閉じる', 'Close')}><X size={22} /></button></header>
      <div className="character-picker-layout">
      <CharacterPickerFilters query={query} onQuery={setQuery} grade={grade} onGrade={setGrade} grades={grades} count={filtered.length} groups={[pickGroup(kind === 'identity' ? translations['sinners.identities'][lang as SupportedLang] : 'E.G.O', top, onSelect)]} sinner={sinner} onSinner={setSinner} sinners={SINNER_SLUGS.map(id => ({ id, name: t(id) }))} />
      <div className="note-picker-results">
        {isLoading && <p role="status">{tr('불러오는 중…', '読み込み中…', 'Loading…')}</p>}
        {error && <button type="button" onClick={() => void mutate()}>{tr('불러오기 실패 · 다시 시도', '読み込み失敗・再試行', 'Load failed · Retry')}</button>}
        {!isLoading && !error && !filtered.length && <p className="note-picker-empty" role="status">{tr('검색 결과가 없습니다. 검색어나 필터를 바꿔보세요.', '結果がありません。検索やフィルターを変更してください。', 'No results. Try a different search or filter.')}</p>}
        {SINNER_SLUGS.map(id => {
          const items = filtered.filter(a => (a.identity?.sinner_id ?? a.sinnerId) === id)
          if (!items.length) return null
          return <section key={id}><h3><img src={getSinnerLogoUrl(id)} alt="" width={28} height={28} />{t(id)}<small>{items.length}</small></h3>
            <div className="note-picker-grid">{items.map(a => <button type="button" key={a.id} className="note-picker-item character-picker-ego-card" onClick={() => onSelect(a)} aria-label={assetName(a, lang)}>
              {kind === 'identity' ? a.identity && <IdentityFrameCard identity={a.identity} name={assetName(a, lang)} sizes="8rem" /> : <NoteAssetArtwork asset={a} compact />}
            </button>)}</div>
          </section>
        })}
      </div>
      </div>
    </div>
  </BaseModal>
}
