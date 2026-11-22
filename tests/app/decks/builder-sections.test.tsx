import { describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { renderToStaticMarkup } from 'react-dom/server'

vi.mock('next-intl', () => ({ useLocale: () => 'ko', useTranslations: () => (key: string) => key }))

import DeckSection from '@/app/[lang]/decks/new/_components/DeckSection'
import DeckSubTabs from '@/features/planner/components/DeckSubTabs'
import PlanSectionNav from '@/features/planner/components/PlanSectionNav'
import { builderSectionId, builderSections, legacyTab } from '@/features/decks/lib/builder-sections'

const builder = readFileSync(join(process.cwd(), 'app/[lang]/decks/new/DeckBuilderClient.tsx'), 'utf8')
const between = (source: string, from: string, to: string) => {
  const start = source.indexOf(from)
  expect(start, `${from} exists`).toBeGreaterThan(-1)
  return source.slice(start, source.indexOf(to, start))
}

describe('the header holds the post information and the upload actions only', () => {
  const header = between(builder, '<header', '</header>')

  it('the right side has the draft menu, the code copy and the upload button, in that order', () => {
    const actions = between(header, 'deck-workspace-actions', 'deck-workspace-fields')
    const at = (part: string) => actions.indexOf(part)
    expect(at('<TempSaveMenu')).toBeGreaterThan(-1)
    expect(at('<TempSaveMenu')).toBeLessThan(at('onClick={handleCopyCode}'))
    expect(at('onClick={handleCopyCode}')).toBeLessThan(at('onClick={handleSave}'))
    expect(actions).toContain('disabled={identityCount < 12}')
    expect(actions).toContain("title={identityCount < 12 ? builderT('actions.copyDisabled') : undefined}")
    for (const moved of ['handleApplyCode', 'setImportOpen', 'codeInput']) expect(actions, moved).not.toContain(moved)
  })

  it('the second row has the title, the content type and the series', () => {
    const fields = between(header, 'deck-workspace-fields', '</header>')
    for (const part of ['setTitle(', '<Dropdown', '<SeriesPicker']) expect(fields, part).toContain(part)
  })

  it('the guest hint only shows when not signed in and keeps its place while auth loads', () => {
    expect(header).toMatch(/authStatus !== 'authenticated' && \(/)
    expect(header).toMatch(/authStatus === 'loading' \? \{ visibility: 'hidden' \}/)
  })

  it('has no code field or plan import any more', () => {
    for (const moved of ['handleApplyCode', 'setImportOpen(true)', 'codeInput']) expect(header, moved).not.toContain(moved)
  })
})

describe('one scrolling page of three sections', () => {
  it('stacks formation, analysis, note in that order', () => {
    const at = (section: string) => builder.indexOf(`<DeckSection section="${section}"`)
    expect(at('formation')).toBeGreaterThan(-1)
    expect(at('formation')).toBeLessThan(at('analysis'))
    expect(at('analysis')).toBeLessThan(at('note'))
  })

  it('the formation section follows the planner: sub tabs with the count, the keyword strip, then the board with its own tool row', () => {
    const at = (section: string) => builder.indexOf(`<DeckSection section="${section}"`)
    const formation = builder.slice(at('formation'), at('analysis'))
    const order = ['<DeckSubTabs', '<DeckMainKeywords', '<IdentityTab'].map(part => formation.indexOf(part))
    expect(order.every(index => index > -1)).toBe(true)
    expect(order).toEqual([...order].sort((a, b) => a - b))
    expect(formation).toContain('formationCount={formationOrder.length}')
    // the keyword strip is on the identity tab only, as in the planner
    const identityTab = formation.slice(formation.indexOf("{tab === 'identity' && ("), formation.indexOf("{tab === 'ego' && ("))
    expect(identityTab).toContain('<DeckMainKeywords')
    // the board's own tool row takes the code and the plan import
    expect(formation).toContain('onApplyCode={handleApplyCode}')
    expect(formation).toMatch(/onImport=\{\{ label: tImport\('fromPlan'\), open: \(\) => setImportOpen\(true\) \}\}/)
    expect(formation).not.toContain('<UnderlineTabBar')
    expect(builder).not.toContain('FormationTools')
    expect(builder).not.toContain('setCodeInput')
  })

  it('a pasted code that is not a formation code reports false and changes nothing', () => {
    const apply = between(builder, 'const handleApplyCode = ', '\n\n')
    expect(apply).toMatch(/if \(!result\) return false/)
    expect(apply.indexOf('return false')).toBeLessThan(apply.indexOf('applyCode(result)'))
  })

  it('a code asks before it replaces a formation someone already chose', () => {
    const apply = between(builder, 'const handleApplyCode = ', '\n\n')
    // untouched = no formation order and every sinner still on the default identity
    expect(apply).toMatch(/if \(untouched\) applyCode\(result\)\s+else setPendingCode\(result\)\s+return true/)
    expect(builder).toMatch(/<ConfirmModal open=\{pendingCode !== null\}[^>]*codeReplaceTitle/)
  })

  it('has no four-tab bar and no tab hides the analysis', () => {
    expect(builder).not.toContain("tab === 'note'")
    expect(builder).not.toContain("tab !== 'note'")
    expect(builder).not.toMatch(/key: 'note'/)
  })

  it('the analysis section needs an identity', () => {
    expect(between(builder, '<DeckSection section="analysis"', '</DeckSection>')).toContain('<DeckInsights')
    expect(builder).toMatch(/hasInsights && \(\s*<DeckSection section="analysis"/)
  })

  it('keeps the note editor mounted once a note existed, so emptying the text does not lose the next typing', () => {
    expect(builder).toMatch(/useEffect\(\(\) => \{ if \(description\.trim\(\) !== ''\) setNoteOpen\(true\) \}, \[description\]\)/)
  })

  it('keeps the guest hint out of row 1 so the back link and the actions share a row', () => {
    const header = between(builder, '<header', '</header>')
    const top = between(header, 'deck-workspace-top', 'deck-workspace-guest')
    expect(top).toContain('deck-workspace-actions')
    expect(top).not.toContain('GuestPinInput')
  })

  it('the stylesheet gives touch targets 44px and scrolls to a heading under the bar in both navbar states', () => {
    const css = readFileSync(join(process.cwd(), 'features/decks/components/deck-workspace.css'), 'utf8')
    expect(css).toContain('--deck-touch:max(2.75rem,44px)')
    expect(css).toMatch(/\.deck-section\{scroll-margin-top:5\.5rem/)
    expect(css).toContain('.deck-subtabs [role="tab"]{min-height:var(--deck-touch)}')
  })

  it('the note editor mounts late and keeps its height until then', () => {
    expect(builder).toContain("dynamic(() => import('@/features/decks/components/DeckNoteEditor')")
    expect(builder).toContain('IntersectionObserver')
    expect(builder).toMatch(/showNote \? <DeckNoteEditor/)
  })
})

describe('the sections list', () => {
  it('lists the analysis only when there are identities', () => {
    expect(builderSections(true)).toEqual(['formation', 'analysis', 'note'])
    expect(builderSections(false)).toEqual(['formation', 'note'])
  })

  it('maps an old ?tab= value to the formation tab or the note section', () => {
    expect(legacyTab('ego')).toEqual({ tab: 'ego', scrollTo: null })
    expect(legacyTab('skillset')).toEqual({ tab: 'skillset', scrollTo: null })
    expect(legacyTab('identity')).toEqual({ tab: 'identity', scrollTo: null })
    expect(legacyTab('note')).toEqual({ tab: 'identity', scrollTo: 'note' })
    expect(legacyTab(null)).toEqual({ tab: 'identity', scrollTo: null })
    expect(legacyTab('nonsense')).toEqual({ tab: 'identity', scrollTo: null })
  })
})

describe('the section bar', () => {
  const nav = (hasInsights: boolean) => renderToStaticMarkup(
    <PlanSectionNav label="구역 이동" sections={builderSections(hasInsights).map(key => ({ id: builderSectionId(key), label: `label-${key}` }))} />,
  )

  it('lists the sections as links with names and marks the first as current', () => {
    const html = nav(true)
    expect(html).toContain('aria-label="구역 이동"')
    expect([...html.matchAll(/<a href="#(deck-[a-z]+)"/g)].map(match => match[1])).toEqual(['deck-formation', 'deck-analysis', 'deck-note'])
    expect(html.match(/aria-current="location"/g)).toHaveLength(1)
    expect(html).toContain('href="#deck-formation" aria-current="location"')
  })

  it('has no analysis entry without identities', () => {
    expect(nav(false)).not.toContain('deck-analysis')
  })

  it('is the planner\'s sticky bar, fed from the page', () => {
    expect(builder).toContain('<PlanSectionNav')
    expect(builder).toContain('sticky-under-nav')
  })
})

describe('the section parts', () => {
  it('a section has an id, a heading it is named by, and its content', () => {
    const html = renderToStaticMarkup(<DeckSection section="note" title="덱 노트"><p>내용</p></DeckSection>)
    expect(html).toContain('id="deck-note"')
    expect(html).toContain('aria-labelledby="deck-note-title"')
    expect(html).toMatch(/<h2 id="deck-note-title"[^>]*>덱 노트<\/h2>/)
    expect(html).toContain('<p>내용</p>')
  })

  it('the sub tabs list identity, E.G.O and skill exchange with the formation count at the right', () => {
    const html = renderToStaticMarkup(<DeckSubTabs subTab="ego" onChange={() => {}} formationCount={5} />)
    expect([...html.matchAll(/role="tab"[^>]*aria-selected="(true|false)"/g)].map(match => match[1])).toEqual(['false', 'true', 'false'])
    for (const name of ['subTabs.identity', 'subTabs.ego', 'subTabs.skillset']) expect(html).toContain(name)
    expect(html).toContain('>5 / 12</div>')
  })
})
