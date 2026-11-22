'use client'

import BackLink from '@/components/navigation/BackLink'
import { pendingNoteUploads, noteUploadInProgressMessage } from '@/lib/notes/images'

import { showError, showSuccess } from '@/lib/toast'
import { guestHeaders, getGuestCopy, guestPinProblem } from '@/features/account'
import GuestPinInput from '@/features/account/components/GuestPinInput'
import { deleteTempSlot, saveTempSlot, type TempSlot } from '@/lib/drafts/temp-slots'
import { DECK_DRAFTS_KEY, autosaveKey, isDeckDraft, loadDeckDraftSlots, type DeckDraft } from '@/features/notes'
import TempSaveMenu from '@/components/ui/TempSaveMenu'
import AutosaveRestoreModal from '@/components/ui/AutosaveRestoreModal'
import { useAutosaveDraft } from '@/features/notes/hooks/useAutosaveDraft'
import SeriesPicker from '@/features/community/components/SeriesPicker'

import { useState, useMemo, useEffect, useRef } from 'react'
import dynamic from 'next/dynamic'
import { useReducedMotion } from 'motion/react'
import * as m from 'motion/react-m'
import { useRouter } from '@/lib/i18n/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { useSession } from 'next-auth/react'
import { useQueryState, parseAsString } from 'nuqs'
import { Link } from '@/lib/i18n/navigation'
import {
  Sinner,
  Identity,
  EGO,
  Skill,
  Passive,
} from '@/lib/data/sinners'
// IdentityCard → IdentityTab 내부에서 직접 렌더링

import { encodeDeckCode, decodeDeckCode } from '@/lib/decks/deck-code-utils'
import { LCB_IDS } from '@/lib/constants/game'
import { builderSectionId, builderSections, contentTypeMessageKey, legacyTab } from '@/features/decks'
import { buildDeckInsightData, buildDeckSaveRows, useDeckBuilderModel, useDeckBuilderState, type EditMode, type ForkMode } from '@/features/decks/hooks/useDeckBuilder'
import Dropdown from '@/components/ui/Dropdown'
import Button from '@/components/ui/Button'
import ConfirmModal from '@/components/ui/ConfirmModal'
import FormationSourceModal from '@/features/planner/components/FormationSourceModal'
import { deckFormationFromPlan } from '@/lib/planner/formation-transfer'
import type { EgoSlot, IdentitySlot } from '@/lib/planner/types'
import { CONTENT_TYPES } from '@/lib/constants/deck-tokens'
import { ArrowLeft, Check, Copy, Upload } from 'lucide-react'
import PlanSectionNav from '@/features/planner/components/PlanSectionNav'
import DeckSubTabs from '@/features/planner/components/DeckSubTabs'
import DeckMainKeywords from '@/features/planner/components/DeckMainKeywords'
import DeckSection from './_components/DeckSection'
import { IdentityTab, EgoTab, SkillsetTab } from '@/features/decks/components/DeckBuilderTabs'
import DeckInsights from '@/features/decks/components/DeckInsights'
import DeckResourceSummary from '@/features/decks/components/DeckResourceSummary'
import type { SupportedLang } from '@/lib/i18n/types'
import type { EgoGiftNote } from '@/lib/types'


// CONTENT_TYPES, ContentType, CONTENT_TYPE_COLORS → deck-tokens.ts에서 import


interface Props {
  sinners: Sinner[]
  identities: Identity[]
  egos: EGO[]
  skills: Skill[]
  passives: Passive[]
  egoGifts?: EgoGiftNote[]
  editMode?: EditMode
  forkMode?: ForkMode
}

const DeckNoteEditor = dynamic(() => import('@/features/decks/components/DeckNoteEditor'), {
  ssr: false,
  loading: () => null,
})

export default function DeckBuilderClient({ sinners, identities, egos, skills, passives, egoGifts = [], editMode, forkMode }: Props) {
  const locale = useLocale()
  const sinnerT = useTranslations('sinner')
  const deckT = useTranslations('decks')
  const builderT = useTranslations('decks.builder')
  const tTempSaves = useTranslations('planner.tempSaves')
  const detailT = useTranslations('decks.detail')
  const tCopy = useTranslations('planner.detail')
  const router = useRouter()
  // The editor state first (it cleans ?formation= from the address), then the tab, the saved drafts, and last what is derived from the state.
  const builderState = useDeckBuilderState({ sinners, identities, egos, editMode, forkMode })
  const {
    deckSlots, setDeckSlots, egoSlots, setEgoSlots, formationOrder, setFormationOrder, title, setTitle, contentType, setContentType,
    description, setDescription, gacksungSlots, upties, setUpties, skillDistribution, setSkillDistribution,
  } = builderState
  // ?tab= keeps the formation's inner tab; an old link to the note tab scrolls to the note section once.
  const [tabParam, setTab] = useQueryState('tab', parseAsString.withDefault('identity'))
  const { tab, scrollTo } = legacyTab(tabParam)
  const [saving, setSaving] = useState(false)
  const [pin, setPin] = useState('')
  // undefined: the author did not touch the series picker, so the deck's series stays as it is
  const [seriesChoice, setSeriesChoice] = useState<string | null | undefined>(undefined)
  // toast는 Sonner가 글로벌로 처리 (showError from lib/toast)
  const [descPreview, setDescPreview] = useState(false)
  const [codeCopied, setCodeCopied] = useState(false)
  const { status: authStatus } = useSession()
  const [draftSlots, setDraftSlots] = useState<TempSlot<DeckDraft>[]>([])
  const reduceMotion = useReducedMotion()
  // The note editor is heavy: it loads when its section nears the screen, when the section bar is pressed, or when the deck already has a note.
  const [noteOpen, setNoteOpen] = useState(false)
  const noteHolder = useRef<HTMLDivElement>(null)
  const showNote = noteOpen || description.trim() !== ''
  // Once shown the editor stays: a note that is emptied (or an edit of a deck that had one) must not unmount it and lose what is typed next.
  useEffect(() => { if (description.trim() !== '') setNoteOpen(true) }, [description])

  useEffect(() => {
    setDraftSlots(loadDeckDraftSlots())
  }, [])

  useEffect(() => {
    if (!scrollTo) return
    setNoteOpen(true)
    requestAnimationFrame(() => document.getElementById(builderSectionId(scrollTo))?.scrollIntoView({ block: 'start' }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const holder = noteHolder.current
    if (showNote || !holder) return
    const observer = new IntersectionObserver(entries => { if (entries.some(entry => entry.isIntersecting)) setNoteOpen(true) }, { rootMargin: '0px 0px 600px 0px' })
    observer.observe(holder)
    return () => observer.disconnect()
  }, [showNote])

  const {
    skillsByIdentityId, passivesByIdentityId, deckKeywordCounts, effectiveMainKeywords, formationGiftKeywordCounts, allGiftKeywordCounts,
    handleMainKeywordToggle, handleFormationToggle, identityCount, draftState,
    applyDraft, applyImportedFormation, applyDecodedDeck,
  } = useDeckBuilderModel({ sinners, identities, egos, skills, passives, state: builderState })

  // Planner deck panels: keyword distribution, passives, attack types and sin resources.
  const deckInsights = useMemo(() => {
    const { resources, ...insights } = buildDeckInsightData({
      sinners, deckSlots, egoSlots, formationOrder, skillDistribution, skillsByIdentityId, passivesByIdentityId, locale,
      localizeSinnerName: sinnerId => sinnerT(sinnerId as Parameters<typeof sinnerT>[0]),
    })
    return { ...insights, summary: <DeckResourceSummary resources={resources} /> }
  }, [deckSlots, egoSlots, formationOrder, locale, passivesByIdentityId, sinners, sinnerT, skillDistribution, skillsByIdentityId])

  // A new guest deck takes a password, asked for when the browser's key is gone.
  const needsPin = authStatus === 'unauthenticated' && !editMode

  const handleSave = async () => {
    if (pendingNoteUploads.size) { showError(noteUploadInProgressMessage(locale)); return }
    if (!title.trim() || identityCount < 12 || !contentType) return
    const pinProblem = needsPin ? guestPinProblem(pin, locale) : null
    if (pinProblem) { showError(pinProblem); return }
    setSaving(true)
    const { identitySlots, egoRows } = buildDeckSaveRows({ sinners, deckSlots, gacksungSlots, upties, formationOrder, skillDistribution, egoSlots })
    const url = editMode ? `/api/decks/${editMode.deckId}` : '/api/decks'
    const method = editMode ? 'PATCH' : 'POST'
    const signedIn = authStatus === 'authenticated'
    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', ...guestHeaders(signedIn) },
        body: JSON.stringify({ title, description, tags: editMode?.tags ?? [], main_keywords: effectiveMainKeywords, content_type: contentType, identitySlots, egoSlots: egoRows, ...(needsPin ? { pin } : {}), ...(seriesChoice !== undefined ? { series_id: seriesChoice } : {}) }),
      })
      if (res.ok) {
        if (!signedIn) showSuccess(editMode ? getGuestCopy(locale).updated : getGuestCopy(locale).posted)
        autosave.clear()
        router.push(editMode ? `/decks/${editMode.deckId}` : '/decks', { locale: locale as SupportedLang })
      } else {
        const data = await res.json().catch(() => null)
        const fallback = editMode ? builderT('errors.updateFailed') : builderT('errors.saveFailed')
        // A server fault says nothing a visitor can act on; the translated line does.
        showError(res.status >= 500 ? fallback : data?.error ?? fallback)
      }
    } catch {
      showError(editMode ? builderT('errors.updateFailed') : builderT('errors.saveFailed'))
    } finally {
      setSaving(false)
    }
  }

  const handleSaveDraft = (slot: TempSlot<DeckDraft>) => {
    if (pendingNoteUploads.size) { showError(noteUploadInProgressMessage(locale)); return }
    const draft: DeckDraft = { ...draftState, savedAt: Date.now() }
    const slots = saveTempSlot(DECK_DRAFTS_KEY, slot.slotNumber, draft, title.trim() || tTempSaves('untitledDeck'), isDeckDraft)
    if (!slots) { showError(tTempSaves('saveFailed')); return }
    setDraftSlots(slots)
    showSuccess(tTempSaves(slot.draft ? 'overwritten' : 'savedToSlot', { slot: slot.slotNumber }))
  }

  const handleLoadDraft = (slot: TempSlot<DeckDraft>) => {
    if (slot.draft && applyDraft(slot.draft.state)) showSuccess(tTempSaves('loadedFromSlot', { slot: slot.slotNumber }))
  }
  const autosave = useAutosaveDraft({
    storageKey: autosaveKey('deck', editMode?.deckId), state: draftState, isState: isDeckDraft, ready: true, apply: applyDraft,
    savedAt: editMode?.updatedAt ? Date.parse(editMode.updatedAt) : null,
  })
  const handleDeleteDraft = (slot: TempSlot<DeckDraft>) => {
    setDraftSlots(deleteTempSlot(DECK_DRAFTS_KEY, slot.slotNumber, isDeckDraft))
    showSuccess(tTempSaves('deletedFromSlot', { slot: slot.slotNumber }))
  }

  // Import from one of my plans: asks first when a formation is already set.
  const tImport = useTranslations('planner.formationImport')
  const [importOpen, setImportOpen] = useState(false)
  const [pendingImport, setPendingImport] = useState<{ formation: ReturnType<typeof deckFormationFromPlan>; title: string } | null>(null)
  const applyImport = (formation: ReturnType<typeof deckFormationFromPlan>) => {
    applyImportedFormation(formation)
    showSuccess(tImport('applied'))
  }
  const handlePlanLoaded = (record: Record<string, unknown>) => {
    const planSlots = (Array.isArray(record.deck) ? record.deck : []) as IdentitySlot[]
    if (!planSlots.length) { showError(tImport('loadFailed')); return }
    const formation = deckFormationFromPlan(planSlots, (Array.isArray(record.egos) ? record.egos : []) as EgoSlot[])
    setImportOpen(false)
    if (formationOrder.length) setPendingImport({ formation, title: String(record.title ?? '') })
    else applyImport(formation)
  }

  // The board's tool row asks for this: false when the text is not a formation code (the row then shows its invalid state).
  // A code replaces the whole formation and the paste button reads the clipboard at once, which may hold an old code:
  // once anything was chosen it asks first, as the planner does.
  type DecodedDeck = NonNullable<Awaited<ReturnType<typeof decodeDeckCode>>>
  const tCode = useTranslations('planner.deckTab.identity')
  const [pendingCode, setPendingCode] = useState<DecodedDeck | null>(null)
  const applyCode = (result: DecodedDeck) => {
    applyDecodedDeck(result)
    setTab('identity')
  }
  const handleApplyCode = async (code: string) => {
    const result = await decodeDeckCode(code, sinners, identities, egos)
    if (!result) return false
    const untouched = formationOrder.length === 0 && Object.values(deckSlots).every(identity => !identity || identity.game_id === LCB_IDS[identity.sinner_id])
    if (untouched) applyCode(result)
    else setPendingCode(result)
    return true
  }

  const handleCopyCode = async () => {
    const code = await encodeDeckCode(sinners, identities, egos, deckSlots, egoSlots, formationOrder)
    try {
      await navigator.clipboard.writeText(code)
    } catch {
      showError(tCopy('copyDeckCodeFailed'))
      return
    }
    setCodeCopied(true)
    setTimeout(() => setCodeCopied(false), 2000)
  }

  const hasInsights = deckInsights.identities.length > 0
  const sectionLabels = { formation: detailT('sectionFormation'), analysis: builderT('tabs.analysis'), note: builderT('tabs.note') }

  return (
    <div className="min-h-[100dvh] pt-24 pb-20 sm:pt-28" style={{ background: 'var(--bg-deep)' }}>
      <FormationSourceModal kind="plan" open={importOpen} onClose={() => setImportOpen(false)} onLoaded={handlePlanLoaded} />
      <ConfirmModal open={pendingImport !== null} title={tImport('replaceTitle')} message={pendingImport?.title || tImport('untitled')}
        confirmLabel={tImport('replaceConfirm')} variant="warning"
        onConfirm={() => { if (pendingImport) applyImport(pendingImport.formation); setPendingImport(null) }} onCancel={() => setPendingImport(null)} />
      <ConfirmModal open={pendingCode !== null} title={tCode('codeReplaceTitle')} message={tCode('codeReplaceMessage')}
        confirmLabel={tCode('codeReplaceConfirm')} cancelLabel={tCode('codeCancel')} variant="warning"
        onConfirm={() => { if (pendingCode) applyCode(pendingCode); setPendingCode(null) }} onCancel={() => setPendingCode(null)} />
      <AutosaveRestoreModal savedAt={autosave.offer?.savedAt ?? null} onRestore={autosave.restore} onDiscard={autosave.discard} />
      <div className="deck-workspace mx-auto max-w-6xl px-3 sm:px-6">
        <header className="deck-workspace-header">
          <div className="deck-workspace-top">
            <div className="min-w-0">
              <BackLink href="/decks" locale={locale as SupportedLang} className="deck-workspace-back inline-flex items-center gap-1.5 rounded px-1 transition-colors" style={{ color: 'var(--text-muted)', fontSize: '0.9375rem' }}>
                <ArrowLeft style={{ width: '1rem', height: '1rem' }} /> {builderT('backToDecks')}
              </BackLink>
              <h1 className="sr-only">{editMode ? builderT('titleEdit') : builderT('titleNew')}</h1>
              <p className="sr-only">
                {builderT('description')}
              </p>
            </div>
            <div className="deck-workspace-actions">
              <TempSaveMenu title={tTempSaves('deckMenuLabel')} slots={draftSlots} onSave={handleSaveDraft} onLoad={handleLoadDraft} onDelete={handleDeleteDraft} />
              <Button
                size="sm"
                icon={codeCopied ? Check : Copy}
                onClick={handleCopyCode}
                disabled={identityCount < 12}
                variant="secondary"
                title={identityCount < 12 ? builderT('actions.copyDisabled') : undefined}
              >
                <span className="max-sm:sr-only">{codeCopied ? builderT('actions.copied') : builderT('actions.copyCode')}</span>
              </Button>
              <Button
                size="sm"
                icon={Upload}
                onClick={handleSave}
                disabled={authStatus === 'loading' || !title.trim() || identityCount < 12 || !contentType || saving}
                variant="primary"
                title={!contentType ? builderT('actions.contentRequired') : identityCount < 12 ? builderT('actions.identityRequired', { count: identityCount, total: sinners.length }) : undefined}
              >
                {saving ? builderT('actions.saving') : editMode ? builderT('actions.save') : builderT('actions.upload')}
              </Button>
            </div>
          </div>
          {/* 로그인 확인 전에도 줄 자리를 잡아 둔다(늦게 끼어들면 아래 편성판이 밀린다) */}
          {authStatus !== 'authenticated' && (
            <div className="deck-workspace-guest" style={authStatus === 'loading' ? { visibility: 'hidden' } : undefined}>
              <p>
                {getGuestCopy(locale).saveHint}{' '}
                <Link href="/guest" className="text-[var(--gold-light)] underline-offset-4 hover:underline">{getGuestCopy(locale).manage}</Link>
              </p>
              {!editMode && (
                <label className="flex items-center gap-2 font-semibold text-[var(--text-secondary)]">
                  {getGuestCopy(locale).pin}
                  <GuestPinInput value={pin} onChange={setPin} locale={locale} className="h-8 w-32 rounded px-3 outline-none"
                    style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-primary)', fontSize: '0.875rem' }} />
                </label>
              )}
            </div>
          )}

          <div className="deck-workspace-fields">
            <label className="deck-workspace-fields__title">
              <span className="font-mono" style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>{builderT('fields.title')}</span>
              <input
                type="text"
                placeholder={builderT('fields.titlePlaceholder')}
                value={title}
                onChange={e => setTitle(e.target.value)}
                className="min-h-12 w-full rounded px-3 outline-none"
                style={{
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border)',
                  color: 'var(--text-primary)',
                  fontSize: '1.25rem',
                  transition: 'border-color 0.2s',
                }}
                onFocus={e => (e.target.style.borderColor = 'var(--gold)')}
                onBlur={e => (e.target.style.borderColor = 'var(--border)')}
              />
            </label>

            <div className="deck-workspace-fields__type">
              <div className="mb-1.5 flex items-center gap-2">
                <span className="font-mono" style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>{builderT('fields.contentType')}</span>
                {!contentType && <span style={{ color: 'var(--warning)', fontSize: '0.875rem', opacity: 0.85 }}>{builderT('fields.required')}</span>}
              </div>
              <Dropdown value={contentType} onChange={setContentType} ariaLabel={builderT('fields.contentType')} options={[{value:'',label:builderT('fields.contentType')},...CONTENT_TYPES.map(ct=>({value:ct,label:deckT(`contentTypes.${contentTypeMessageKey(ct)}`)}))]} buttonStyle={{minHeight:'3rem',width:'100%',fontSize:'.9375rem'}} />
            </div>
            <SeriesPicker kind="deck" postId={editMode?.deckId} onChange={setSeriesChoice} />
          </div>
        </header>

        <PlanSectionNav
          label={detailT('sectionNav')}
          className="sticky-under-nav deck-section-nav"
          sections={builderSections(hasInsights).map(section => ({ id: builderSectionId(section), label: sectionLabels[section] }))}
          onSelect={id => { if (id === builderSectionId('note')) setNoteOpen(true) }}
        />

        <DeckSection section="formation" title={sectionLabels.formation}>
          <div className="deck-subtabs"><DeckSubTabs subTab={tab} onChange={key => setTab(key)} formationCount={formationOrder.length} /></div>

          {tab === 'identity' && (
            <m.section
              key="identity"
              initial={reduceMotion ? false : { opacity: 0, y: 8 }}
              animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            >
              <DeckMainKeywords counts={deckKeywordCounts} effectiveKeywords={effectiveMainKeywords} onToggle={handleMainKeywordToggle} label={deckT('filters.alwaysKeywords')} />
              <IdentityTab
                sinners={sinners}
                identities={identities}
                deckSlots={deckSlots}
                upties={upties}
                egoSlots={egoSlots}
                skillsByIdentityId={skillsByIdentityId}
                skillDistribution={skillDistribution}
                formationOrder={formationOrder}
                onFormationToggle={handleFormationToggle}
                onFormationReset={() => setFormationOrder([])}
                onApplyCode={handleApplyCode}
                onImport={{ label: tImport('fromPlan'), open: () => setImportOpen(true) }}
                onIdentitySelect={(identity, uptie) => {
                  if (!identity) return
                  setDeckSlots(prev => ({ ...prev, [identity.sinner_id]: identity }))
                  setUpties(prev => ({ ...prev, [identity.sinner_id]: uptie }))
                }}
              />
            </m.section>
          )}
          {tab === 'ego' && (
            <m.div
              key="ego"
              initial={reduceMotion ? false : { opacity: 0, y: 8 }}
              animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            >
              <EgoTab
                sinners={sinners}
                egos={egos}
                egoSlots={egoSlots}
                identities={identities}
                identityIds={Object.fromEntries(Object.entries(deckSlots).map(([sinnerId, identity]) => [sinnerId, identity?.id]))}
                lang={locale as SupportedLang}
                onEgoSelect={ego => {
                  setEgoSlots(prev => ({
                    ...prev,
                    [ego.sinner_id]: { ...(prev[ego.sinner_id] ?? {}), [ego.grade]: ego }
                  }))
                }}
                onEgoDeselect={(sinnerId, grade) => {
                  if (grade === 'ZAYIN') return
                  setEgoSlots(prev => {
                    const s = { ...(prev[sinnerId] ?? {}) }
                    delete s[grade]
                    return { ...prev, [sinnerId]: s }
                  })
                }}
              />
            </m.div>
          )}
          {tab === 'skillset' && (
            <m.div
              key="skillset"
              initial={reduceMotion ? false : { opacity: 0, y: 8 }}
              animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            >
              <SkillsetTab
                sinners={sinners}
                deckSlots={deckSlots}
                upties={upties}
                skillsByIdentityId={skillsByIdentityId}
                skillDistribution={skillDistribution}
                onDistributionChange={(sinnerId, dist) =>
                  setSkillDistribution(prev => ({ ...prev, [sinnerId]: dist }))
                }
              />
            </m.div>
          )}
        </DeckSection>

        {/* 키워드 분포 + 패시브 + 공격 유형/죄악 자원 (플래너와 같은 패널) */}
        {hasInsights && (
          <DeckSection section="analysis" title={sectionLabels.analysis}>
            <DeckInsights
              identities={deckInsights.identities}
              deployedIds={deckInsights.deployedIds}
              sinCounts={deckInsights.sinCounts}
              baseSinCounts={deckInsights.baseSinCounts}
              summary={deckInsights.summary}
            />
          </DeckSection>
        )}

        <DeckSection section="note" title={sectionLabels.note}>
          {/* The height is kept from the start, so the bar's scroll target does not move when the editor arrives. */}
          <div ref={noteHolder} className="deck-section__note">
            {showNote ? <DeckNoteEditor
              sinners={sinners}
              identities={identities}
              deckSlots={deckSlots}
              egoSlots={egoSlots}
              skillsByIdentityId={skillsByIdentityId}
              passivesByIdentityId={passivesByIdentityId}
              egoGifts={egoGifts}
              formationOrder={formationOrder}
              formationGiftKeywordCounts={formationGiftKeywordCounts}
              allGiftKeywordCounts={allGiftKeywordCounts}
              locale={locale as SupportedLang}
              description={description}
              setDescription={setDescription}
              descPreview={descPreview}
              setDescPreview={setDescPreview}
            /> : null}
          </div>
        </DeckSection>
      </div>

      {/* Toast는 Sonner가 글로벌로 처리 */}
    </div>
  )
}
