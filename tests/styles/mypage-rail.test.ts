import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const css = readFileSync('styles/components/CommunityProfile.module.css', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
/** Every rule (any media block) whose selector names one of the classes. */
const rules = (names: string[]) => [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
  .filter(([, selector]) => names.some(name => new RegExp(`\\.${name}(?![\\w-])`).test(selector)))
  .map(([, selector, body]) => ({ selector: selector.trim(), body }))

// The rail's summary, its tab list and the settings tab. `.name`, `.links`, `.scoreLabel` are shared with the guest page and stay flat too.
const TOUCHED = ['summary', 'who', 'avatar', 'name', 'joined', 'about', 'bio', 'links', 'tally', 'scoreLabel', 'points', 'figures', 'meter', 'next', 'stats', 'more',
  'nav', 'navItem', 'navCount', 'settings', 'group', 'groupTitle', 'row', 'form']

describe('my page rail and settings styles', () => {
  const touched = rules(TOUCHED)

  it('finds the rules it checks', () => {
    for (const name of ['summary', 'stats', 'navItem', 'groupTitle']) expect(rules([name]).length).toBeGreaterThan(0)
  })

  it('has no gradient and no shadow', () => {
    for (const { selector, body } of touched) {
      expect(body, selector).not.toMatch(/gradient\(/)
      expect(body, selector).not.toMatch(/box-shadow/)
    }
  })

  it('uses tokens for colour, not hex values', () => {
    for (const { selector, body } of touched) expect(body, selector).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
  })

  it('draws no box around the summary or the tab list', () => {
    for (const name of ['summary', 'stats']) for (const { selector, body } of rules([name])) expect(body, selector).not.toMatch(/background|border(?!-top|-bottom)\s*:/)
    const list = rules(['nav']).filter(rule => !/navItem|navCount/.test(rule.selector))
    for (const { selector, body } of list) expect(body, `${selector} ${body}`).not.toMatch(/border-radius|background/)
  })
})
