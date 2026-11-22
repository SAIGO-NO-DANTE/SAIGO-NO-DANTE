'use client'

import { useSuggestionState } from '@/hooks/useSuggestions'
import { LCB_IDS } from '@/lib/constants/game'
import { identitySuggestUrl, suggestionContext, type SuggestionResponse } from '@/lib/community/suggestion-types'
import { useMemo, useState } from 'react'
import {
  Sinner,
  Identity,
  EGO,
  Skill,
} from '@/lib/data/sinners'
import { localizeIdentityName } from '@/lib/decks/localize'
import { useLocale } from 'next-intl'
import type { SupportedLang } from '@/lib/i18n/types'
import { getLocalizedName } from '@/lib/i18n/localize'
import { SKILL_EXCHANGE_PRESETS } from '@/components/ui/SkillExchangePanel'
import type { SkillCountEdit } from '@/components/cards/EgoSlotRows'
import { buildStripSkills, toEgoSlotItems } from '@/features/decks/lib/strip-skills'
import {
  PlannerEgoBoard,
  PlannerEgoSelectModal,
  PlannerIdentityBoard,
  PlannerIdentitySelectModal,
  PlannerSkillBoard,
  type PlannerDeckEgo,
  type PlannerEgoBoardSlot,
  type PlannerIdentityBoardSlot,
} from '@/features/decks/components/PlannerDeckSelection'

function isPlaceholderName(value: string | null | undefined): boolean {
  const normalized = value?.trim()
  return !normalized || normalized === '-' || normalized === '—'
}

function getDeckBuilderSinnerName(sinner: Sinner, locale: SupportedLang): string {
  const localized = getLocalizedName(sinner, locale)
  if (!isPlaceholderName(localized)) return localized
  if (!isPlaceholderName(sinner.name_en)) return sinner.name_en!.trim()
  if (!isPlaceholderName(sinner.name)) return sinner.name.trim()
  return sinner.name_kr
}

/** The builder's identity board data: formation number, uptie, skills 1-3 with the deck's counts, and the chosen E.G.O (the strip under each card). */
function builderBoardSlots({ sinners, deckSlots, upties, formationOrder = [], skillsByIdentityId, skillDistribution, egoSlots = {}, locale }: {
  sinners: Sinner[]
  deckSlots: Record<string, Identity | undefined>
  upties: Record<string, number>
  formationOrder?: string[]
  skillsByIdentityId: Record<string, Skill[]>
  skillDistribution: Record<string, [number, number, number]>
  egoSlots?: Record<string, Record<string, EGO>>
  locale: SupportedLang
}) {
  return sinners.reduce<Record<string, PlannerIdentityBoardSlot>>((acc, sinner) => {
    const identity = deckSlots[sinner.id] ?? null
    const formIdx = formationOrder.indexOf(sinner.id)
    acc[sinner.id] = {
      sinnerId: sinner.id,
      identity,
      slotOrder: identity && formIdx >= 0 ? formIdx : null,
      uptie: upties[sinner.id],
      identityName: identity ? localizeIdentityName(identity, locale) : undefined,
      skills: identity ? buildStripSkills(identity, skillsByIdentityId[identity.id] ?? [], skillDistribution[sinner.id] ?? [3, 2, 1]) : undefined,
      egos: toEgoSlotItems(egoSlots[sinner.id] ?? {}, locale),
    }
    return acc
  }, {})
}

/* ── 탭 1: 인격 편성 (플래너 패턴: 40% 변경 / 60% 편성 토글) ── */
export function IdentityTab({
  sinners, identities, deckSlots, upties, egoSlots, skillsByIdentityId, skillDistribution,
  formationOrder, onFormationToggle, onFormationReset, onApplyCode, onImport, onIdentitySelect,
}: {
  sinners: Sinner[]
  identities: Identity[]
  deckSlots: Record<string, Identity | undefined>
  /** sinnerId → uptie 1–4 (missing = 4) */
  upties: Record<string, number>
  egoSlots: Record<string, Record<string, EGO>>
  skillsByIdentityId: Record<string, Skill[]>
  skillDistribution: Record<string, [number, number, number]>
  formationOrder: string[]
  onFormationToggle: (sinnerId: string) => void
  onFormationReset: () => void
  onApplyCode: (code: string) => Promise<boolean>
  onImport: { label: string; open: () => void }
  onIdentitySelect: (identity: Identity, uptie: number) => void
}) {
  const [modalSinnerId, setModalSinnerId] = useState<string | null>(null)
  const locale = useLocale() as SupportedLang
  const modalSinner = modalSinnerId ? sinners.find(s => s.id === modalSinnerId) ?? null : null
  // Suggestions follow every identity already chosen on the board beside the slot being picked, with or without a formation number.
  const lcbIds = useMemo(() => new Set(identities.filter(identity => identity.game_id === LCB_IDS[identity.sinner_id]).map(identity => identity.id)), [identities])
  const chosenBeside = modalSinnerId
    ? suggestionContext(Object.fromEntries(Object.entries(deckSlots).map(([id, identity]) => [id, identity?.id])), formationOrder, modalSinnerId, identityId => lcbIds.has(identityId))
    : []
  const { data: suggestion, loading: suggestionLoading } = useSuggestionState<SuggestionResponse>(identitySuggestUrl(modalSinnerId, chosenBeside))
  const identityById = useMemo(() => new Map(identities.map(identity => [identity.id, identity])), [identities])
  const modalIdentities = modalSinnerId
    ? identities
        .filter(i => i.sinner_id === modalSinnerId)
        .sort((a, b) => b.rarity - a.rarity)
    : []
  const openIdentityModal = (sinnerId: string) => setModalSinnerId(sinnerId)
  const boardSlots = builderBoardSlots({ sinners, deckSlots, upties, formationOrder, skillsByIdentityId, skillDistribution, egoSlots, locale })

  return (
    <>
    <PlannerIdentityBoard
      sinners={sinners}
      slots={boardSlots}
      onOpenIdentityModal={openIdentityModal}
      onFormationToggle={onFormationToggle}
      onResetOrder={onFormationReset}
      onApplyCode={onApplyCode}
      onImport={onImport}
      getSinnerName={sinner => getDeckBuilderSinnerName(sinner as Sinner, locale)}
    />

    {/* ── 인격 선택 모달 (플래너 패턴) ── */}
    <PlannerIdentitySelectModal
      open={!!(modalSinnerId && modalSinner)}
      sinner={modalSinner}
      identities={modalIdentities}
      selectedIdentityId={modalSinnerId ? deckSlots[modalSinnerId]?.id ?? null : null}
      selectedUptie={modalSinnerId ? upties[modalSinnerId] ?? 4 : 4}
      suggestions={suggestion?.items}
      archetype={suggestion?.archetype}
      suggestionsLoading={suggestionLoading}
      partnerIdentity={id => identityById.get(id)}
      onClose={() => setModalSinnerId(null)}
      onSelect={(identity, uptie) => {
        onIdentitySelect(identity as Identity, uptie)
        setModalSinnerId(null)
      }}
      getSinnerName={sinner => getDeckBuilderSinnerName(sinner as Sinner, locale)}
    />
    </>
  )
}

/* ── 탭 2: 에고 편성 ─────────────────────────────────── */
export function EgoTab({
  sinners, egos, egoSlots, identityIds, identities, lang, onEgoSelect, onEgoDeselect,
}: {
  sinners: Sinner[]
  egos: EGO[]
  identities: Identity[]
  /** sinnerId → the identity picked for that sinner (its E.G.O suggestions follow it). */
  identityIds: Record<string, string | undefined>
  egoSlots: Record<string, Record<string, EGO>>
  lang: SupportedLang
  onEgoSelect: (ego: EGO) => void
  onEgoDeselect: (sinnerId: string, grade: string) => void
}) {
  const [modalSinnerId, setModalSinnerId] = useState<string | null>(null)
  const modalSinner = modalSinnerId ? sinners.find(s => s.id === modalSinnerId) ?? null : null
  const modalIdentityId = modalSinnerId ? identityIds[modalSinnerId] : undefined
  const { data: suggestion, loading: suggestionLoading } = useSuggestionState<SuggestionResponse>(modalIdentityId ? `/api/discovery/suggest?type=ego&identity=${modalIdentityId}` : null)
  const identityById = useMemo(() => new Map(identities.map(identity => [identity.id, identity])), [identities])
  const modalEgos = modalSinnerId
    ? egos
        .filter(e => e.sinner_id === modalSinnerId)
    : []
  const boardSlots = sinners.reduce<Record<string, PlannerEgoBoardSlot>>((acc, sinner) => {
    acc[sinner.id] = {
      sinnerId: sinner.id,
      enabled: true,
      identityName: identityById.has(identityIds[sinner.id] ?? '') ? localizeIdentityName(identityById.get(identityIds[sinner.id]!)!, lang) : undefined,
      egosByGrade: egoSlots[sinner.id] ?? {},
    }
    return acc
  }, {})
  const selectedByGrade: Record<string, PlannerDeckEgo | undefined> = modalSinnerId ? (egoSlots[modalSinnerId] ?? {}) : {}

  return (
    <>
    <PlannerEgoBoard
      sinners={sinners}
      slots={boardSlots}
      onOpenEgoModal={setModalSinnerId}
      getSinnerName={sinner => getDeckBuilderSinnerName(sinner as Sinner, lang)}
    />

    {/* ── 에고 선택 모달 (수감자별, 전 등급 동시 표시) ── */}
    <PlannerEgoSelectModal
      open={!!(modalSinnerId && modalSinner)}
      sinner={modalSinner}
      egos={modalEgos}
      selectedEgosByGrade={selectedByGrade}
      suggestions={suggestion?.items}
      archetype={suggestion?.archetype}
      suggestionsLoading={suggestionLoading}
      partnerIdentity={id => identityById.get(id)}
      onClose={() => setModalSinnerId(null)}
      onSelect={ego => onEgoSelect(ego as EGO)}
      onDeselect={grade => {
        if (modalSinnerId) onEgoDeselect(modalSinnerId, grade)
      }}
      getSinnerName={sinner => getDeckBuilderSinnerName(sinner as Sinner, lang)}
    />
    </>
  )
}

/* ── 탭 4: 스킬 배분 ─────────────────────────────────── */
export function SkillsetTab({
  sinners, deckSlots, upties, skillsByIdentityId, skillDistribution, onDistributionChange,
}: {
  sinners: Sinner[]
  deckSlots: Record<string, Identity | undefined>
  upties: Record<string, number>
  skillsByIdentityId: Record<string, Skill[]>
  skillDistribution: Record<string, [number, number, number]>
  onDistributionChange: (sinnerId: string, dist: [number, number, number]) => void
}) {
  const locale = useLocale() as SupportedLang
  // The counts are edited on the cards themselves: − / + beside each skill and the presets under them (USER 2026-11-13).
  const edits: Record<string, SkillCountEdit> = {}
  for (const sinner of sinners) {
    if (!deckSlots[sinner.id]) continue
    const dist = skillDistribution[sinner.id] ?? [3, 2, 1]
    const total = dist[0] + dist[1] + dist[2]
    edits[sinner.id] = {
      canDecrease: idx => dist[idx] > 0,
      canIncrease: () => total < 6,
      onAdjust: (idx, delta) => {
        const next: [number, number, number] = [dist[0], dist[1], dist[2]]
        const value = next[idx] + delta
        if (value < 0 || total + delta > 6) return
        next[idx] = value
        onDistributionChange(sinner.id, next)
      },
      presets: SKILL_EXCHANGE_PRESETS,
      onPreset: preset => onDistributionChange(sinner.id, preset),
    }
  }
  if (!sinners.some(sinner => deckSlots[sinner.id])) return null
  return (
    <PlannerSkillBoard
      sinners={sinners}
      slots={builderBoardSlots({ sinners, deckSlots, upties, skillsByIdentityId, skillDistribution, locale })}
      getSinnerName={sinner => getDeckBuilderSinnerName(sinner as Sinner, locale)}
      edits={edits}
    />
  )
}
