'use client'

import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode, type Ref } from 'react'
import { Search, X } from 'lucide-react'
import QuietImage from '@/components/ui/QuietImage'
import { markParts } from '@/lib/utils/global-search'
import type { Hit } from '@/lib/search/engine'
import styles from './SearchBox.module.css'

export interface SuggestGroup {
  title: string
  rows: { key: string; body: ReactNode; onPick: () => void }[]
}

/**
 * What a key does to the suggestion panel: the next open state and active row (-1 for none), `pick` when Enter takes the
 * active row. null leaves the key to the browser: typing, Tab, Enter without an active row, anything during IME composition.
 */
export function searchBoxKey(
  { open, active, count }: { open: boolean; active: number; count: number },
  key: string,
  composing: boolean,
): { open: boolean; active: number; pick?: true } | null {
  if (composing || count === 0) return null
  if (key === 'ArrowDown') return { open: true, active: open ? (active + 1) % count : 0 }
  if (key === 'ArrowUp') return { open: true, active: open && active > 0 ? active - 1 : count - 1 }
  if (key === 'Enter') return open && active >= 0 ? { open: false, active: -1, pick: true } : null
  if (key === 'Escape') return open ? { open: false, active: -1 } : null
  return null
}

export function SuggestPanel({ id, label, groups, active, onHover, onPick, ref }: {
  id: string
  label: string
  groups: SuggestGroup[]
  active: number
  onHover: (index: number) => void
  onPick: (index: number) => void
  ref?: Ref<HTMLDivElement>
}) {
  let index = 0
  // A click on the panel must not take the focus from the input, or the blur would close the panel before the pick.
  return (
    <div ref={ref} id={id} role="listbox" aria-label={label} className={styles.panel} onMouseDown={event => event.preventDefault()}>
      {groups.map((group, g) => (
        <div key={group.title} role="group" aria-labelledby={`${id}-title-${g}`}>
          <div id={`${id}-title-${g}`} className={styles.title}>{group.title}</div>
          {group.rows.map(row => {
            const at = index++
            return (
              <div key={row.key} id={`${id}-${at}`} role="option" aria-selected={at === active} className={styles.row} onMouseEnter={() => onHover(at)} onClick={() => onPick(at)}>
                {row.body}
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}

/** A search field with a Google-style suggestion panel under it. Empty `groups` or an empty value show no panel. */
export default function SearchBox({ value, onChange, label, clearLabel, groups, className }: {
  value: string
  onChange: (value: string) => void
  /** Placeholder, field name and panel name */
  label: string
  clearLabel: string
  groups: SuggestGroup[]
  /** Sizes the field (width, flex) */
  className?: string
}) {
  const id = useId()
  const input = useRef<HTMLInputElement>(null)
  const panel = useRef<HTMLDivElement>(null)
  const byKey = useRef(false)
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const rows = groups.flatMap(group => group.rows)
  const count = value.trim() ? rows.length : 0
  const shown = open && count > 0
  const at = active < count ? active : -1

  // The panel is wider than a narrow field: when it would run off the right edge it hangs from the field's right end
  // instead (as far as the left edge allows). The edges are the viewport's or those of an ancestor that clips (a modal's
  // scroll area, a scrolling column): the panel is never wider than that, and inside one it ends above its bottom edge
  // and scrolls its own rows instead of being cut.
  useLayoutEffect(() => {
    const el = panel.current, field = el?.parentElement?.getBoundingClientRect()
    if (!el || !field) return
    let left = 8, right = document.documentElement.clientWidth - 8, bottom = Infinity
    for (let node = el.parentElement?.parentElement; node && node !== document.body; node = node.parentElement) {
      if (getComputedStyle(node).overflowX === 'visible') continue
      const box = node.getBoundingClientRect()
      left = Math.max(left, box.left)
      right = Math.min(right, box.right)
      bottom = Math.min(bottom, box.bottom)
    }
    el.style.maxWidth = `${right - left}px`
    el.style.maxHeight = ''
    const top = el.getBoundingClientRect().top
    // Three rows stay reachable even in a short area; the area then scrolls for the rest.
    if (top + el.offsetHeight > bottom - 8) el.style.maxHeight = `${Math.max(120, bottom - 8 - top)}px`
    const over = field.left + el.offsetWidth - right
    el.style.transform = over > 0 ? `translateX(${-Math.max(over, Math.min(el.offsetWidth - field.width, field.left - left))}px)` : ''
  }, [shown, count])
  // Only a key move scrolls the row into view; the pointer resting on a half-visible row must not.
  useEffect(() => {
    if (byKey.current && at >= 0) document.getElementById(`${id}-${at}`)?.scrollIntoView({ block: 'nearest' })
    byKey.current = false
  }, [at, id])

  const pick = (index: number) => {
    setOpen(false)
    setActive(-1)
    rows[index].onPick()
  }
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    const next = searchBoxKey({ open: shown, active: at, count }, event.key, event.nativeEvent.isComposing || event.keyCode === 229)
    if (!next) return
    event.preventDefault() // Escape would also clear a search field
    byKey.current = true
    if (next.pick) return pick(at)
    setOpen(next.open)
    setActive(next.active)
  }

  return (
    <div className={`${styles.field} ${className ?? ''}`}>
      <Search size={14} aria-hidden className={styles.icon} />
      <input
        ref={input}
        type="search"
        role="combobox"
        aria-label={label}
        aria-expanded={shown}
        aria-controls={shown ? `${id}-list` : undefined}
        aria-autocomplete="list"
        aria-activedescendant={shown && at >= 0 ? `${id}-${at}` : undefined}
        data-suggest-open={shown || undefined}
        autoComplete="off"
        spellCheck={false}
        placeholder={label}
        value={value}
        onChange={event => { onChange(event.target.value); setOpen(true); setActive(-1) }}
        onFocus={() => setOpen(true)}
        onBlur={() => { setOpen(false); setActive(-1) }}
        onKeyDown={onKeyDown}
        className={styles.input}
      />
      {value && (
        <button type="button" aria-label={clearLabel} onClick={() => { onChange(''); input.current?.focus() }} className={styles.clear}>
          <X size={12} aria-hidden />
        </button>
      )}
      {shown && <SuggestPanel ref={panel} id={`${id}-list`} label={label} groups={groups} active={at} onHover={setActive} onPick={pick} />}
    </div>
  )
}

type Marks = [number, number][]

/** The letters of the name the hit matched (initials, a typo's equal letters), to mark in the row. */
export const nameMarks = ({ entry, reasons }: Hit): Marks => reasons.filter(reason => reason.text === entry.label).flatMap(reason => reason.ranges)

function Thumb({ image, poster, cover }: { image?: string | null; poster?: boolean; cover?: boolean }) {
  return (
    <span className={poster ? styles.poster : styles.thumb}>
      {image && <QuietImage src={image} alt="" fill sizes={poster ? '24px' : '32px'} className={poster || cover ? 'object-cover' : 'object-contain'} />}
    </span>
  )
}

/** A suggestion row: picture, name (with the matched letters marked) and a small note at the right edge. */
export function SuggestRow({ image, poster, cover, name, marks = [], right, rightColor }: {
  image?: string | null
  /** A tall pack picture instead of the square slot */
  poster?: boolean
  /** The picture is an illustration wider than the slot (an identity's art): fill the square instead of fitting inside it */
  cover?: boolean
  name: string
  marks?: Marks
  right?: ReactNode
  rightColor?: string
}) {
  return (
    <>
      <Thumb image={image} poster={poster} cover={cover} />
      <span className={styles.name}>{markParts(name, marks).map((part, i) => part.marked ? <mark key={i}>{part.text}</mark> : part.text)}</span>
      {right != null && <small className={styles.right} style={{ color: rightColor }}>{right}</small>}
    </>
  )
}

/** A suggestion row for a text match: the name over one line of the text with the matched part marked. */
export function SuggestCut({ image, name, before, hit, after }: { image?: string | null; name: string; before: string; hit: string; after: string }) {
  return (
    <>
      <Thumb image={image} />
      <span className={styles.cut}>
        <b>{name}</b>
        <span>{before}<mark>{hit}</mark>{after}</span>
      </span>
    </>
  )
}
