import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

vi.mock('next-intl', () => ({ useLocale: () => 'ko' }))
vi.mock('@/lib/i18n/navigation', () => ({
  Link: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) => <a href={href} className={className}>{children}</a>,
}))
vi.mock('@/components/cards/DeckCard', () => ({ default: ({ deck }: { deck: { title: string } }) => <article>{deck.title}</article> }))
vi.mock('@/components/cards/PlanCard', () => ({ default: () => <article /> }))
vi.mock('@/features/notes/components/NoteChips', () => ({ NoteCardPreview: () => null }))
vi.mock('swr', () => ({ default: () => ({ data: { plans: [] }, isLoading: false }) }))
// The real dialog renders into a portal that static markup never reaches; the stub records what it was given.
const dialog = vi.hoisted(() => ({ props: [] as Record<string, unknown>[] }))
vi.mock('@/components/ui/ConfirmModal', () => ({
  default: (props: Record<string, unknown>) => { dialog.props.push(props); return <div data-confirm-open={String(props.open)} /> },
}))

import DecksTab, { DeleteDeckDialog } from '@/app/[lang]/mypage/_components/DecksTab'
import PlannerTab from '@/app/[lang]/mypage/_components/PlannerTab'
import { communityCopy } from '@/features/community/lib/copy'
import type { DeckSummary } from '@/components/cards/DeckCard'

const ko = communityCopy.ko
const deck = { id: 'd1', title: '첫 번째 덱' } as DeckSummary
const noop = async () => {}

/** The two switch buttons of a group, in order: [name, aria-pressed]. */
function options(html: string, group: string) {
  const body = html.match(new RegExp(`<div[^>]*role="group"[^>]*aria-label="${group}"[^>]*>([\\s\\S]*?)</div>`))![1]
  return [...body.matchAll(/<button[^>]*aria-pressed="(true|false)"[^>]*>(.*?)<\/button>/g)].map(match => [match[2].replace(/<[^>]+>/g, ''), match[1]])
}

describe('decks tab', () => {
  const html = renderToStaticMarkup(<DecksTab decks={[]} bookmarkedDecks={[]} onDeleteDeck={noop} onRemoveBookmark={noop} />)

  it('switches between my decks and saved decks with pressed buttons; the first is selected', () => {
    expect(options(html, ko.decks)).toEqual([[`${ko.myDecks}0`, 'true'], [`${ko.savedDecks}0`, 'false']])
  })

  it('shows an empty list as one line of text and one button, with no icon', () => {
    expect(html.match(/<p[\s>]/g)).toHaveLength(1)
    expect(html).toContain(ko.emptyDecks)
    const links = [...html.matchAll(/<a href="([^"]*)"[^>]*>(.*?)<\/a>/g)].map(match => [match[1], match[2].replace(/<[^>]+>/g, '')])
    expect(links).toEqual([['/decks/new', ko.newDeck], ['/decks/new', ko.firstDeck]])
    // Only the header's "new deck" button carries an icon.
    expect(html.match(/<svg/g)).toHaveLength(1)
  })

  it('draws a card without any in-card confirmation overlay: just the delete button', () => {
    const withDeck = renderToStaticMarkup(<DecksTab decks={[deck]} bookmarkedDecks={[]} onDeleteDeck={noop} onRemoveBookmark={noop} />)
    expect(withDeck).toContain(`aria-label="${ko.deleteDeck}"`)
    expect(withDeck).not.toContain(ko.deleteDeckAsk)
    expect(withDeck).toContain('data-confirm-open="false"')
  })
})

describe('delete confirmation', () => {
  it('goes through the shared dialog: titled with the deck, danger, nothing loading yet', () => {
    dialog.props.length = 0
    renderToStaticMarkup(<DeleteDeckDialog deck={deck} onDelete={noop} onClose={() => {}} />)
    expect(dialog.props.at(-1)).toMatchObject({ open: true, variant: 'danger', title: '첫 번째 덱', message: ko.deleteDeckAsk, confirmLabel: ko.delete, cancelLabel: ko.cancel, loading: false })
  })

  it('stays closed without a deck', () => {
    dialog.props.length = 0
    renderToStaticMarkup(<DeleteDeckDialog deck={null} onDelete={noop} onClose={() => {}} />)
    expect(dialog.props.at(-1)).toMatchObject({ open: false })
  })
})

describe('planner tab', () => {
  const html = renderToStaticMarkup(<PlannerTab />)

  it('has the same switch: my plans / liked plans, the first selected', () => {
    expect(options(html, ko.planner)).toEqual([[`${ko.myPlans}0`, 'true'], [`${ko.likedPlans}0`, 'false']])
  })

  it('shows an empty list as one line of text and one button', () => {
    expect(html.match(/<p[\s>]/g)).toHaveLength(1)
    expect(html).toContain(ko.emptyPlans)
    expect(html).toContain(ko.firstPlan)
    expect(html.match(/<svg/g)).toHaveLength(1)
  })
})
