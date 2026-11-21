import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const strip = (file: string) => readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
const profile = strip('styles/components/CommunityProfile.module.css')
const badges = strip('features/community/components/AchievementGrid.module.css')
/** Every rule (any media block) whose selector names one of the classes. */
const rules = (css: string, names: string[]) => [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
  .filter(([, selector]) => names.some(name => new RegExp(`\\.${name}(?![\\w-])`).test(selector)))
  .map(([, selector, body]) => ({ selector: selector.trim(), body }))

// Decks and planner (switch, empty state, card list), and the badge tiles.
const PROFILE = ['tabsHead', 'sub', 'empty', 'list', 'item', 'itemAction', 'title', 'titleCount']
const BADGES = ['grid', 'badge', 'art', 'name', 'condition', 'progress', 'bar', 'count', 'bareGrid', 'bareArt']
const RADIUS = /^(var\(--radius-(sm|md|lg)\)|inherit|0|50%|var\(--radius-full\))$/

describe('decks, planner and badge styles', () => {
  const touched = [...rules(profile, PROFILE), ...rules(badges, BADGES)]

  it('finds the rules it checks', () => {
    for (const name of ['tabsHead', 'sub', 'empty', 'itemAction']) expect(rules(profile, [name]).length).toBeGreaterThan(0)
    for (const name of ['badge', 'art', 'bareArt']) expect(rules(badges, [name]).length).toBeGreaterThan(0)
  })

  it('has no gradient, no shadow and no drop-shadow glow', () => {
    for (const { selector, body } of touched) {
      expect(body, selector).not.toMatch(/gradient\(/)
      expect(body, selector).not.toMatch(/box-shadow/)
      expect(body, selector).not.toMatch(/drop-shadow|filter\s*:/)
    }
  })

  it('uses tokens for colour, not hex or rgba values', () => {
    for (const { selector, body } of touched) {
      expect(body, selector).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
      expect(body, selector).not.toMatch(/rgba?\(/)
    }
  })

  it('rounds corners only with the radius tokens', () => {
    for (const { selector, body } of touched) for (const [, value] of body.matchAll(/border-radius\s*:\s*([^;]+)/g)) expect(value.trim(), selector).toMatch(RADIUS)
  })

  it('has no dashed box and no leftover overlay, switch or panel classes', () => {
    expect(profile).not.toMatch(/dashed/)
    for (const name of ['seg', 'confirm', 'danger', 'panel']) expect(rules(profile, [name]), name).toHaveLength(0)
  })

  it('draws the badge tile without a background', () => {
    for (const { selector, body } of rules(badges, ['badge', 'bareGrid', 'bareArt'])) expect(body, selector).not.toMatch(/background\s*:/)
  })
})
