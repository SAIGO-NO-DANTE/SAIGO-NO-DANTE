'use client'

import { useState } from 'react'
import { useLocale } from 'next-intl'
import { Plus, Trash2, X } from 'lucide-react'
import { Link } from '@/lib/i18n/navigation'
import DeckCard, { type DeckSummary } from '@/components/cards/DeckCard'
import Button, { buttonClass } from '@/components/ui/Button'
import ConfirmModal from '@/components/ui/ConfirmModal'
import { getCommunityCopy } from '@/features/community'
import SubTabs from '@/app/[lang]/mypage/_components/SubTabs'
import styles from '@/styles/components/CommunityProfile.module.css'
import { NoteCardPreview } from '@/features/notes/components/NoteChips'

/** Asks before deleting a deck: the dialog is titled with the deck and locks while the request runs. */
export function DeleteDeckDialog({ deck, onDelete, onClose }: {
  deck: DeckSummary | null
  onDelete: (id: string) => Promise<void>
  onClose: () => void
}) {
  const t = getCommunityCopy(useLocale())
  const [loading, setLoading] = useState(false)
  async function confirm() {
    if (!deck) return
    setLoading(true)
    try {
      await onDelete(deck.id)
    } finally {
      setLoading(false)
      onClose()
    }
  }
  return (
    <ConfirmModal open={deck !== null} variant="danger" title={deck?.title} message={t.deleteDeckAsk} confirmLabel={t.delete} cancelLabel={t.cancel}
      loading={loading} onConfirm={confirm} onCancel={onClose} />
  )
}

export default function DecksTab({ decks, bookmarkedDecks, onDeleteDeck, onRemoveBookmark }: {
  decks: DeckSummary[]
  bookmarkedDecks: DeckSummary[]
  onDeleteDeck: (id: string) => Promise<void>
  onRemoveBookmark: (id: string) => Promise<void>
}) {
  const t = getCommunityCopy(useLocale())
  const [subTab, setSubTab] = useState<'mine' | 'saved'>('mine')
  const [deleting, setDeleting] = useState<DeckSummary | null>(null)
  const list = subTab === 'mine' ? decks : bookmarkedDecks
  return (
    <>
      <div className={styles.tabsHead}>
        <SubTabs label={t.decks} value={subTab} onChange={setSubTab}
          options={[{ key: 'mine', label: t.myDecks, count: decks.length }, { key: 'saved', label: t.savedDecks, count: bookmarkedDecks.length }]} />
        <Link href="/decks/new" className={buttonClass({ variant: 'primary' })}><Plus size={17} aria-hidden="true" />{t.newDeck}</Link>
      </div>
      {list.length === 0 ? (
        <div className={styles.empty}>
          <p>{subTab === 'mine' ? t.emptyDecks : t.emptySaved}</p>
          <Link href={subTab === 'mine' ? '/decks/new' : '/decks'} className={buttonClass({ variant: subTab === 'mine' ? 'primary' : 'secondary' })}>
            {subTab === 'mine' ? t.firstDeck : t.browseDecks}
          </Link>
        </div>
      ) : (
        <ul className={styles.list}>
          {list.map(deck => (
            <li key={deck.id} className={styles.item}>
              <DeckCard deck={deck} NotePreview={NoteCardPreview} />
              {subTab === 'saved'
                ? <Button size="sm" variant="secondary" icon={X} className={styles.itemAction} onClick={() => onRemoveBookmark(deck.id)} aria-label={t.removeBookmark} title={t.removeBookmark} />
                : <Button size="sm" variant="secondary" icon={Trash2} className={styles.itemAction} onClick={() => setDeleting(deck)} aria-label={t.deleteDeck} title={t.deleteDeck} />}
            </li>
          ))}
        </ul>
      )}
      <DeleteDeckDialog deck={deleting} onDelete={onDeleteDeck} onClose={() => setDeleting(null)} />
    </>
  )
}
