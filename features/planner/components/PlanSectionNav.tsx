'use client'

import { useEffect, useRef, useState } from 'react'

type Section = { id: string; label: string; count?: number | null }

/**
 * The plan page's section tabs. The current section is this component's own state: held by the page, every section
 * passed while scrolling redrew the whole plan, hundreds of gift cards included (owner 2026-11-12: scrolling a plan
 * exported from Assist with many gifts lags).
 */
export default function PlanSectionNav({ sections, label, className, onSelect }: { sections: Section[]; label: string; className?: string; onSelect?: (id: string) => void }) {
  const sectionKey = sections.map(section => section.id).join()
  const [active, setActive] = useState(sections[0]?.id)
  // 스크롤 위치에 맞춰 구역 목차의 현재 항목을 표시한다: 화면 위 30% 선을 지난 마지막 구역
  useEffect(() => {
    const ids = sectionKey.split(',')
    let frame = 0
    const update = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const line = window.innerHeight * 0.3
        let current = ids[0]
        for (const id of ids) {
          const top = document.getElementById(id)?.getBoundingClientRect().top
          if (top != null && top <= line) current = id
        }
        setActive(current)
      })
    }
    update()
    window.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update)
    return () => { cancelAnimationFrame(frame); window.removeEventListener('scroll', update); window.removeEventListener('resize', update) }
  }, [sectionKey])

  // 모바일의 가로 목차에서 현재 항목이 보이도록 목차만 가로로 스크롤한다
  const listRef = useRef<HTMLOListElement>(null)
  useEffect(() => {
    const list = listRef.current
    const link = list?.querySelector<HTMLElement>('[aria-current]')
    if (!list || !link) return
    const left = link.offsetLeft - list.offsetLeft
    if (left < list.scrollLeft || left + link.offsetWidth > list.scrollLeft + list.clientWidth) {
      list.scrollTo({ left: Math.max(0, left - 16) })
    }
  }, [active])

  // 해시를 남기지 않고 이동해 BackLink의 뒤로 가기 기록을 그대로 둔다
  const go = (id: string) => {
    onSelect?.(id)
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    document.getElementById(id)?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' })
    setActive(id)
  }

  return (
    <nav aria-label={label} className={className}>
      <ol ref={listRef}>
        {sections.map(section => (
          <li key={section.id} className="shrink-0">
            <a href={`#${section.id}`} aria-current={active === section.id ? 'location' : undefined} onClick={event => { event.preventDefault(); go(section.id) }}>
              {section.label}
              {section.count != null && <span>{section.count}</span>}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  )
}
