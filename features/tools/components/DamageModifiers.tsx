'use client'

import { useEffect, useMemo, useRef, useState, type Dispatch, type KeyboardEvent, type SetStateAction } from 'react'
import useSWR from 'swr'
import { useLocale, useTranslations } from 'next-intl'
import { Check, Minus, Pencil, Plus, Search, Trash2, X } from 'lucide-react'
import BaseModal from '@/components/ui/BaseModal'
import Dropdown from '@/components/ui/Dropdown'
import GiftArtwork from '@/components/ui/GiftArtwork'
import { GiftEnhanceMark, GiftEnhancePicker } from '@/features/mirror-dungeon/components/GiftCard'
import { EffectText } from '@/features/mirror-dungeon/components/GiftDetailModal'
import KeywordChip from '@/features/tools/components/KeywordChip'
import KeywordIcon from '@/components/ui/KeywordIcon'
import FloorGiftPickerModal from '@/features/planner/components/FloorGiftPickerModal'
import { useKeywords } from '@/components/providers/KeywordProvider'
import { getKeywordIconUrl } from '@/lib/constants/keywords'
import { localizeGiftKeyword } from '@/lib/i18n/gift-keyword'
import type { SupportedLang } from '@/lib/i18n/types'
import type { GiftData } from '@/lib/planner/types'
import { showWarning } from '@/lib/toast'
import { type ModifierTarget, type SavedModifier } from '@/features/tools/lib/damage-types'
import { clampModifierValue, coinChoices, MAX_MODIFIER_NAME, MAX_MODIFIER_OPTIONS, MAX_MODIFIERS, MAX_MODIFIER_VALUE, MODIFIER_TARGETS } from '@/features/tools/lib/damage'
import { type AbilityEffect } from '@/features/tools/lib/damage-types'
import { effectSummary } from '@/features/tools/lib/damage-abilities'
import { suggestDamageSources } from '@/features/tools/lib/damage-suggest'
import { DEFAULT_MAX_STACKS, findApplied, MAX_STACKS, type DamageSources, type DamageSuggestion, type SourceGroup, type StackEffect } from '@/features/tools/lib/damage-sources'
import NumberInput from './NumberInput'
import styles from './DamageCalculator.module.css'

// Who carries the effect, as the game shows status effects on a unit: the attacker, the run's gifts, the target.
const GROUPS: SourceGroup[] = ['self', 'gift', 'target']
const groupOf = (modifier: SavedModifier): SourceGroup | 'manual' => modifier.gift ? 'gift' : modifier.keyword ? modifier.side ?? 'self' : 'manual'
const dropdownStyle = {width:'100%',justifyContent:'space-between',minHeight:'2.75rem',padding:'.7rem',background:'var(--bg-deep)',borderColor:'var(--border)',fontSize:'.875rem',color:'var(--text-primary)'}
// A percent steps by 1 and shares its unit with the other percent; a multiplier and a resistance value step by 0.05.
const isPercent = (target: ModifierTarget) => target === 'damage' || target === 'resist'
// 35 → "+35%", -15 → "−15%"; a resistance value has no unit: 0.2 → "+0.2"
const signed = (value: number, target: ModifierTarget) => `${value < 0 ? '−' : '+'}${Math.abs(value)}${isPercent(target) ? '%' : ''}`

const fetchSources = async (url: string): Promise<DamageSources> => {
  const response = await fetch(url)
  if (!response.ok) throw new Error(String(response.status))
  const sources = await response.json()
  // A copy of another shape (an older one still held by the CDN) is a failed load, not a list.
  if (!Array.isArray(sources?.keywords) || !Array.isArray(sources?.gifts)) throw new Error('Unexpected response')
  return sources
}

/**
 * The modifiers of the damage calculator. Keywords and gifts sit as icon tiles in the group that carries them. A
 * group's "+" opens its candidates in a picker window (gifts in the planner's own gift picker), where a press applies
 * one and a second press takes it off again; a pressed tile opens its text and its value below. An ✕ only ever closes:
 * removing is a button that says so.
 */
export default function DamageModifiers({ modifiers, setModifiers, coinCount }: { modifiers: SavedModifier[]; setModifiers: Dispatch<SetStateAction<SavedModifier[]>>; coinCount: number }) {
  const t = useTranslations('damage')
  const locale = useLocale() as SupportedLang
  const keywords = useKeywords()
  const [adding, setAdding] = useState<SourceGroup | null>(null)
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<number | null>(null)
  // The list is asked for once it is needed (a "+" or a tile is pressed), then kept: it only changes with a game data sync.
  const [wanted, setWanted] = useState(false)
  // Where the focus goes back to when a panel closes: the "+" of its group, or the tile that was edited.
  const slots = useRef<Partial<Record<SourceGroup, HTMLButtonElement | null>>>({})
  const tiles = useRef(new Map<number, HTMLButtonElement | null>())
  const { data, error, isLoading, mutate } = useSWR(wanted ? `/api/damage-sources/${locale}` : null, fetchSources, { revalidateOnFocus: false })

  // A picker holds the focus until its closing animation ends: its "+" takes the focus back once the window is gone.
  const opener = useRef<SourceGroup | null>(null)
  useEffect(() => {
    if (adding) { opener.current = adding; return }
    const group = opener.current
    if (!group) return
    opener.current = null
    let frame = requestAnimationFrame(function back() {
      if (document.querySelector('[role=dialog]')) frame = requestAnimationFrame(back)
      else slots.current[group]?.focus()
    })
    return () => cancelAnimationFrame(frame)
  }, [adding])

  const candidates = useMemo(() => data && adding && adding !== 'gift' ? suggestDamageSources(data, query, { group: adding }) : [], [data, adding, query])
  // The gift picker is the planner's: it takes the gifts in the shape of the planner's own list.
  const giftChoices = useMemo<GiftData[]>(() => (data?.gifts ?? []).map(gift => ({
    id: gift.id, game_id: Number(gift.id), name: gift.name, name_en: locale === 'en' ? gift.label : null, name_jp: locale === 'ja' ? gift.label : null,
    keyword: gift.keyword, grade: gift.grade, image_url: gift.image_url, effect_base: null, effect_plus: null, effect_plusplus: null, theme_ids: null, activation_condition: null,
  })), [data, locale])
  const appliedGifts = useMemo(() => new Set(modifiers.flatMap(modifier => modifier.gift ? [modifier.gift.id] : [])), [modifiers])
  const full = modifiers.length >= MAX_MODIFIERS
  const keywordLabel = (name: string) => (locale === 'en' ? keywords[name]?.nameEn : locale === 'ja' ? keywords[name]?.nameJp : null) || name
  // A gift's enhancement level is drawn on its artwork with the game's mark, so the "+" its name was saved with is not repeated.
  // Once the list is loaded a gift is named in the page's language, whatever language it was picked in.
  const labelOf = (modifier: Pick<SavedModifier, 'name'> & Partial<Pick<SavedModifier, 'keyword' | 'gift'>>) => modifier.keyword ? keywordLabel(modifier.keyword)
    : modifier.gift ? data?.gifts.find(gift => gift.id === modifier.gift?.id)?.label ?? modifier.name.replace(/\++$/, '') : modifier.name || t('unnamed')

  const update = (id: number, patch: Partial<SavedModifier>) => setModifiers(list => list.map(modifier => modifier.id === id ? { ...modifier, ...patch } : modifier))
  // A stack keyword's effect is the one the list read from its text. While the list is not there (still loading, or it
  // failed), the saved tile says enough to keep its count adjustable: its value is its count times the effect of one.
  const stackOf = (modifier: Pick<SavedModifier, 'keyword' | 'stacks' | 'value' | 'target'>): StackEffect | null => {
    if (!modifier.stacks) return null
    if (data) return data.keywords.find(keyword => keyword.name === modifier.keyword)?.stack ?? null
    return modifier.target === 'damage' || modifier.target === 'physical' || modifier.target === 'sin'
      ? { target: modifier.target, perStack: Math.round(modifier.value / modifier.stacks * 100) / 100, max: MAX_STACKS, side: 'self' } : null
  }
  // A saved count of a keyword that is no stack keyword (any more) is dropped once the list says so: its value stays, typed like any other.
  useEffect(() => {
    if (!data) return
    const stale = (modifier: SavedModifier) => !!modifier.stacks && !modifier.effects && !data.keywords.some(keyword => keyword.name === modifier.keyword && keyword.stack)
    setModifiers(list => list.some(stale) ? list.map(modifier => stale(modifier) ? { ...modifier, stacks: undefined } : modifier) : list)
  }, [data, setModifiers])
  // How far a count can go: a keyword read from the game's values by its own maximum (99 for a gift's count), a text-read stack keyword by its sentence; 0 when it has no count.
  const stackLimit = (modifier: SavedModifier) => modifier.effects
    ? modifier.stacks ? (modifier.keyword ? data?.keywords.find(keyword => keyword.name === modifier.keyword && keyword.effects)?.maxStack : undefined) ?? DEFAULT_MAX_STACKS : 0
    : stackOf(modifier)?.max ?? 0
  const setStacks = (modifier: SavedModifier, stacks: number) => {
    if (modifier.effects) {
      const count = Math.max(1, Math.min(stackLimit(modifier), stacks))
      update(modifier.id, { stacks: count, ...effectSummary(modifier.effects, count) })
      return
    }
    const stack = stackOf(modifier)
    if (!stack) return
    const count = Math.max(1, Math.min(stack.max, stacks))
    // 0.1 × 3 is 0.30000000000000004 in binary: kept to two places.
    // The target goes with the value: a stack keyword's effect is its own, whatever was saved beside it.
    update(modifier.id, { stacks: count, target: stack.target, value: Math.round(stack.perStack * count * 100) / 100 })
  }
  const add = (modifier: Omit<SavedModifier, 'id'>) => {
    if (full) { showWarning(t('full', { max: MAX_MODIFIERS })); return }
    setModifiers(list => list.length >= MAX_MODIFIERS ? list : [...list, { ...modifier, name: modifier.name.slice(0, MAX_MODIFIER_NAME), id: Math.max(0, ...list.map(other => other.id)) + 1 }])
  }
  // In the picker a press applies, and a press on what is applied takes it off again. The picker stays open for the next one.
  const toggle = (modifier: Omit<SavedModifier, 'id'>) => {
    const applied = findApplied(modifiers, modifier)
    if (applied) setModifiers(list => list.filter(other => other.id !== applied.id))
    else add(modifier)
  }
  const groupOfId = (id: number) => { const modifier = modifiers.find(other => other.id === id); return modifier ? groupOf(modifier) : 'manual' }
  const closeAdder = () => setAdding(null)
  const closeEditor = (id: number) => { setSelected(null); tiles.current.get(id)?.focus() }
  // The tile is gone with its effect: the focus goes to its group's "+".
  const remove = (id: number) => {
    const group = groupOfId(id)
    setModifiers(list => list.filter(other => other.id !== id))
    if (group !== 'manual') slots.current[group]?.focus()
  }
  const open = (group: SourceGroup) => { setAdding(group); setSelected(null); setQuery(''); setWanted(true) }
  const edit = (id: number) => { setSelected(current => current === id ? null : id); setAdding(null); setWanted(true) }
  // Escape closes a panel from anywhere inside it.
  const onEscape = (close: () => void) => (event: KeyboardEvent) => { if (event.key === 'Escape') { event.stopPropagation(); close() } }
  const giftSource = (modifier: SavedModifier) => data?.gifts.find(gift => gift.id === modifier.gift?.id)
  // The text as the game wrote it; EffectText draws its keywords with their icons, colours and tooltips.
  const sourceText = (modifier: SavedModifier) => modifier.keyword
    ? data?.keywords.find(keyword => keyword.name === modifier.keyword)?.text
    : giftSource(modifier)?.stages.find(stage => stage.level === modifier.gift?.level)?.text
  // Another enhancement level is another text: its values replace the choices, and its first value is applied.
  const setLevel = (modifier: SavedModifier, level: number) => {
    const source = giftSource(modifier)
    const stage = source?.stages.find(candidate => candidate.level === level)
    if (!source || !stage || !modifier.gift) return
    const options = stage.values.slice(0, MAX_MODIFIER_OPTIONS)
    // A gift read from the game's values has the same numbers at every level: only its text and artwork change.
    if (modifier.effects) { update(modifier.id, { name: (source.label + '+'.repeat(level)).slice(0, MAX_MODIFIER_NAME), gift: { ...modifier.gift, level } }); return }
    update(modifier.id, { name: (source.label + '+'.repeat(level)).slice(0, MAX_MODIFIER_NAME), gift: { ...modifier.gift, level }, options, value: options[0] ?? 0 })
  }
  const art = (modifier: Pick<SavedModifier, 'name'> & Partial<Pick<SavedModifier, 'keyword' | 'gift'>>, sizes = '48px') => {
    // The name stands next to the artwork wherever it is drawn, so the artwork itself is not named again.
    if (modifier.gift) return <GiftArtwork gift={{ ...modifier.gift, name: modifier.name }} displayName="" enhance={modifier.gift.level} sizes={sizes}>{modifier.gift.level > 0 && <GiftEnhanceMark level={modifier.gift.level} />}</GiftArtwork>
    const url = modifier.keyword ? getKeywordIconUrl(modifier.keyword, keywords[modifier.keyword]?.iconSlug) : null
    return url ? <KeywordIcon src={url} alt="" width={64} height={64} /> : <Pencil size={16} aria-hidden="true" />
  }
  // "+10% a stack", "−1 power"; a restriction to one sin or attack type is named after it.
  const effectLine = (effect: AbilityEffect) => {
    const target = effect.target === 'damage' ? (effect.side === 'self' ? 'damage' : 'takeDamage') : effect.target
    const only = effect.attribute ? t(`skillSinOption.${effect.attribute}`) : effect.atk ? t(`skillAtkOption.${effect.atk}`) : null
    return t('picker.effectLine', {
      target: t(`picker.effectTarget.${target}`), value: signed(effect.value, effect.target === 'damage' ? 'damage' : 'physical'),
      per: effect.scaled ? t('picker.perStackShort') : '', only: only ? t('picker.onlyFor', { name: only }) : '',
    })
  }
  const candidateValue = ({ perStack, modifier, inert }: DamageSuggestion) => inert ? t('picker.notCalculated') : perStack !== undefined ? t('picker.perStack', { value: signed(perStack, modifier.target) }) : modifier.options?.length ? signed(modifier.value, modifier.target) : null
  const numberInput = (modifier: SavedModifier, name: string) => (
    <span className={styles.modifierNumber}>
      <NumberInput label={`${name} ${t('customValue')}`} value={modifier.value} decimal step={isPercent(modifier.target) ? 1 : 0.05}
        min={clampModifierValue(-MAX_MODIFIER_VALUE, modifier.target)} max={MAX_MODIFIER_VALUE} onChange={value => update(modifier.id, { value })} />
      {isPercent(modifier.target) && <span aria-hidden="true">%</span>}
    </span>
  )
  const manual = modifiers.filter(modifier => groupOf(modifier) === 'manual')
  const pickedCount = adding ? modifiers.filter(modifier => groupOf(modifier) === adding).length : 0

  return <div className={styles.sides}>
    {GROUPS.map(group => {
      const groupName = t(`picker.group.${group}`)
      const applied = modifiers.filter(modifier => groupOf(modifier) === group)
      const chosen = applied.find(modifier => modifier.id === selected)
      const stack = chosen ? stackLimit(chosen) : 0
      const unsupported = chosen?.keyword ? data?.keywords.find(keyword => keyword.name === chosen.keyword)?.unsupported ?? 0 : 0
      return <section key={group} className={styles.side} aria-label={groupName}>
        <h4>{groupName}</h4>
        <div className={styles.tiles}>
          {applied.map(modifier => (
            <button key={modifier.id} type="button" ref={node => { tiles.current.set(modifier.id, node) }} className={styles.tile} aria-pressed={modifier.id === selected}
              onClick={() => edit(modifier.id)}>
              <span className={styles.tileArt}>{art(modifier)}{modifier.stacks && <span key={modifier.stacks} className={styles.badge}>{modifier.stacks}</span>}</span>
              <span className={styles.tileName}>{labelOf(modifier)}</span>
              <b key={modifier.value}>{signed(modifier.value, modifier.target)}</b>
            </button>
          ))}
          <button type="button" ref={node => { slots.current[group] = node }} className={styles.slot} aria-haspopup="dialog" aria-expanded={adding === group} aria-label={t('picker.addTo', { group: groupName })} onClick={() => open(group)}><Plus size={20} aria-hidden="true" /></button>
        </div>
        {chosen && (() => {
          const name = labelOf(chosen)
          const text = sourceText(chosen)
          const levels = giftSource(chosen)?.stages.map(candidate => candidate.level) ?? []
          const level = chosen.gift?.level ?? 0
          return <div className={styles.editor} onKeyDown={onEscape(() => closeEditor(chosen.id))}>
            <button type="button" className={`${styles.remove} ${styles.editorClose}`} aria-label={t('picker.close')} onClick={() => closeEditor(chosen.id)}><X size={18} aria-hidden="true" /></button>
            <div className={styles.editorHead}>
              <span className={styles.editorArt}>{art(chosen, '72px')}</span>
              <div className={styles.editorTitle}>
                <h5>{name}</h5>
                {chosen.gift?.keyword && <KeywordChip keyword={chosen.gift.keyword} label={localizeGiftKeyword(chosen.gift.keyword, locale)} size="md" />}
              </div>
            </div>
            <div className={styles.editorPart}>
              <div className={styles.editorPartHead}>
                <span>{t('picker.effect')}</span>
                {levels.length > 1 && <div className={styles.enhance}><GiftEnhancePicker level={level} max={Math.max(...levels) >= 2 ? 2 : 1} giftName={name} onChange={next => setLevel(chosen, next)} /></div>}
              </div>
              {text
                ? <EffectText key={level} text={text} color="#c8b898" />
                : <p className={styles.hint} role={error ? 'alert' : 'status'}>{error ? t('picker.loadError') : t('picker.loading')}</p>}
              {chosen.effects && <ul className={styles.effectList}>{chosen.effects.map((effect, index) => <li key={index}>{effectLine(effect)}</li>)}</ul>}
              {unsupported > 0 && <p className={styles.hint}>{t('picker.unsupported', { count: unsupported })}</p>}
            </div>
            <div className={`${styles.editorPart} ${styles.editorControls}`}>
              <span>{t('picker.value')}</span>
              {stack > 0 ? <>
                <div className={styles.stepper}>
                  <button type="button" aria-label={t('picker.decrease', { name })} disabled={chosen.stacks! <= 1} onClick={() => setStacks(chosen, chosen.stacks! - 1)}><Minus size={14} aria-hidden="true" /></button>
                  <b key={chosen.stacks} aria-live="polite">{chosen.stacks}</b>
                  <button type="button" aria-label={t('picker.increase', { name })} disabled={chosen.stacks! >= stack} onClick={() => setStacks(chosen, chosen.stacks! + 1)}><Plus size={14} aria-hidden="true" /></button>
                </div>
                <strong className={styles.modifierValue}>{signed(chosen.value, chosen.target)}</strong>
              </> : chosen.effects ? <strong className={styles.modifierValue}>{signed(chosen.value, chosen.target)}</strong> : <>
                {(chosen.options?.length ?? 0) > 1 && <div className={styles.options} role="group" aria-label={t('picker.choices', { name })}>
                  {chosen.options!.map(option => <button key={option} type="button" className={styles.chip} aria-pressed={option === chosen.value} onClick={() => update(chosen.id, { value: clampModifierValue(option, chosen.target) })}>{signed(option, chosen.target)}</button>)}
                </div>}
                {numberInput(chosen, name)}
              </>}
              <button type="button" className={styles.delete} onClick={() => remove(chosen.id)}><Trash2 size={15} aria-hidden="true" />{t('picker.delete')}</button>
            </div>
          </div>
        })()}
      </section>
    })}
    {/* Gifts are picked in the planner's gift picker, once the list is there; keywords, and the wait for the list, in a window of the same build. */}
    <FloorGiftPickerModal open={adding === 'gift' && !!data} title={t('picker.group.gift')} floorGifts={null} allGifts={giftChoices} selectedIds={appliedGifts}
      onToggle={gift => { const candidate = data && suggestDamageSources(data, '', { group: 'gift' }).find(row => row.key === `g:${gift.id}`); if (candidate) toggle(candidate.modifier) }}
      onClose={closeAdder} />
    <BaseModal open={!!adding && (adding !== 'gift' || !data)} onClose={closeAdder} title={adding ? t(`picker.group.${adding}`) : ''} maxWidth="48rem">
      {adding && <div className={styles.picker}>
        <div className={styles.pickerHead}>
          <h2>{t(`picker.group.${adding}`)}{pickedCount > 0 && <span>{pickedCount}</span>}</h2>
          <button type="button" className={styles.remove} aria-label={t('picker.close')} onClick={closeAdder}><X size={18} aria-hidden="true" /></button>
        </div>
        <div className={styles.pickerBody}>
          {adding !== 'gift' && <label className={styles.search}>
            <Search size={16} aria-hidden="true" />
            <input type="text" autoFocus aria-label={t('picker.search')} placeholder={t('picker.search')} value={query} onChange={event => setQuery(event.target.value)} />
          </label>}
          {isLoading && <p className={styles.hint} role="status">{t('picker.loading')}</p>}
          {error && <p className={styles.hint} role="alert">{t('picker.loadError')} <button type="button" className={styles.retry} onClick={() => mutate()}>{t('picker.retry')}</button></p>}
          {data && adding !== 'gift' && !candidates.length && <p className={styles.hint}>{t('picker.noResults')}</p>}
          {candidates.length > 0 && <div className={styles.candidates}>
            {candidates.map(candidate => {
              const picked = !!findApplied(modifiers, candidate.modifier)
              return <button key={candidate.key} type="button" className={styles.tile} aria-pressed={picked} aria-disabled={candidate.inert || undefined} onClick={() => { if (!candidate.inert) toggle(candidate.modifier) }}>
                <span className={styles.tileArt}>{art(candidate.modifier)}{picked && <span className={styles.picked}><Check size={12} strokeWidth={3} aria-hidden="true" /></span>}</span>
                <span className={styles.tileName}>{labelOf(candidate.modifier)}</span>
                <small>{candidateValue(candidate)}</small>
              </button>
            })}
          </div>}
        </div>
      </div>}
    </BaseModal>
    <section className={styles.side} aria-label={t('picker.group.manual')}>
      <h4>{t('picker.group.manual')}</h4>
      {manual.length > 0 && <ul className={styles.modifierList}>
        {manual.map(modifier => <li key={modifier.id} className={styles.modifier}>
          <input type="text" aria-label={t('customName')} placeholder={t('customName')} maxLength={MAX_MODIFIER_NAME} value={modifier.name} onChange={event => update(modifier.id, { name: event.target.value })} />
          <Dropdown ariaLabel={t('customTarget')} buttonStyle={dropdownStyle} value={modifier.target}
            options={MODIFIER_TARGETS.map(target => ({ value: target, label: t(`targetOption.${target}`) }))}
            // A percent, a multiplier and a resistance value are different units: switching starts from the neutral value.
            onChange={target => update(modifier.id, { target, value: target === 'final' ? 1 : isPercent(target) === isPercent(modifier.target) && modifier.target !== 'final' ? modifier.value : 0 })} />
          {/* A coin the skill no longer has stays listed while it is the saved choice, and says that it is not there: it applies to no coin until the count is raised again. */}
          <Dropdown ariaLabel={t('customCoin')} buttonStyle={dropdownStyle} value={String(modifier.coin ?? 0)}
            options={coinChoices(coinCount, modifier.coin).map(coin => ({ value: String(coin), label: !coin ? t('coinAll') : t(coin > coinCount ? 'coinMissing' : 'coin', { index: coin }) }))}
            onChange={coin => update(modifier.id, { coin: Number(coin) || undefined })} />
          {numberInput(modifier, modifier.name || t('unnamed'))}
          <button type="button" className={`${styles.remove} ${styles.trash}`} aria-label={t('remove', { name: modifier.name || t('unnamed') })} onClick={() => remove(modifier.id)}><Trash2 size={16} aria-hidden="true" /></button>
        </li>)}
      </ul>}
      <button type="button" className={styles.add} disabled={full} onClick={() => add({ name: '', value: 10, target: 'damage' })}><Plus size={16} aria-hidden="true" />{t('add')}</button>
    </section>
    {full && <p className={styles.hint}>{t('full', { max: MAX_MODIFIERS })}</p>}
  </div>
}
