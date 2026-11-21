import { GIFT_KEYWORD_COLORS } from '@/lib/constants/gift'
import { SIN_COLORS } from '@/lib/data/sinners'
import { getKeywordIconUrl } from '@/lib/constants/keywords'
import { rankItems } from '@/lib/search/rank-items'
import type { KeywordInfo } from '@/components/providers/KeywordProvider'

// DOM-free part of the note autocomplete: the token syntax, what to suggest for the text before the caret, and the pools.
export type AutocompleteSuggestion = {
  label: string
  type: 'keyword' | 'skill' | 'identity' | 'ego' | 'passive' | 'egogift'
  typeLabel?: string
  color: string
  iconUrl?: string
  iconFallbackUrl?: string
  imageUrl?: string
  token: string
  syntax?: 'inline' | 'block'
  /** Other names (languages) the item is found by. */
  aliases?: string[]
}

type TokenType = AutocompleteSuggestion['type']

type AutocompleteContext = {
  syntax: 'inline' | 'block' | 'word'
  mode: 'type' | 'value' | 'word' | 'closed'
  query: string
  replaceStart: number
  replaceEnd: number
  typeFilter?: TokenType
  blockFilter?: 'skill' | 'gift' | 'passive'
  sinnerName?: string
}

const TOKEN_TYPE_MAP: Record<string, TokenType> = {
  k: 'keyword',
  s: 'skill',
  i: 'identity',
  e: 'ego',
  p: 'passive',
  g: 'egogift',
}

const TOKEN_PREFIX_LABELS: Record<TokenType, string> = {
  keyword: '[k:',
  skill: '[s:',
  identity: '[i:',
  ego: '[e:',
  passive: '[p:',
  egogift: '[g:',
}

const TOKEN_TYPE_SUGGESTIONS: AutocompleteSuggestion[] = [
  { label: '인격', type: 'identity', typeLabel: '[i:', color: '#d0a85a', token: '[i:', syntax: 'inline' },
  { label: '스킬', type: 'skill', typeLabel: '[s:', color: '#d0a85a', token: '[s:', syntax: 'inline' },
  { label: '패시브', type: 'passive', typeLabel: '[p:', color: '#d0a85a', token: '[p:', syntax: 'inline' },
  { label: 'E.G.O', type: 'ego', typeLabel: '[e:', color: '#d0a85a', token: '[e:', syntax: 'inline' },
  { label: '키워드', type: 'keyword', typeLabel: '[k:', color: '#d0a85a', token: '[k:', syntax: 'inline' },
  { label: '기프트', type: 'egogift', typeLabel: '[g:', color: '#d0a85a', token: '[g:', syntax: 'inline' },
]

const BLOCK_TYPE_SUGGESTIONS: AutocompleteSuggestion[] = [
  { label: '스킬 프레임', type: 'skill', typeLabel: '{{skill:', color: '#d0a85a', token: '{{skill:', syntax: 'block' },
  { label: '패시브 설명', type: 'passive', typeLabel: '{{passive:', color: '#88a830', token: '{{passive:', syntax: 'block' },
  { label: '기프트 카드', type: 'egogift', typeLabel: '{{gift:', color: '#d0a85a', token: '{{gift:', syntax: 'block' },
]

// [ja, en] for the fixed Korean labels above
const LABEL_I18N: Record<string, [string, string]> = {
  '인격': ['人格', 'Identity'], '스킬': ['スキル', 'Skill'], '패시브': ['パッシブ', 'Passive'],
  '키워드': ['キーワード', 'Keyword'], '기프트': ['ギフト', 'Gift'], '스킬 프레임': ['スキル枠', 'Skill frame'],
  '패시브 설명': ['パッシブ説明', 'Passive text'], '기프트 카드': ['ギフトカード', 'Gift card'],
}
export const localizeLabel = (label: string, lang: string) => lang === 'ko' ? label : LABEL_I18N[label]?.[lang === 'ja' ? 0 : 1] ?? label

function getTokenParts(token: string): string[] {
  if (token.startsWith('{{skill:')) {
    return token.replace(/^\{\{skill:/, '').replace(/\}\}$/, '').split(':')
  }
  if (token.startsWith('{{gift:')) {
    return token.replace(/^\{\{gift:/, '').replace(/\}\}$/, '').split(':')
  }
  if (token.startsWith('{{passive:')) {
    return token.replace(/^\{\{passive:/, '').replace(/\}\}$/, '').split(':')
  }
  const body = token.replace(/^\[[a-z]:/, '').replace(/\]$/, '')
  return body.split(':')
}

export function getNoteAutocompleteContext(text: string, cursorPos: number): AutocompleteContext {
  const before = text.slice(0, cursorPos)
  const lastOpen = before.lastIndexOf('[')
  const lastClose = before.lastIndexOf(']')

  if (lastOpen >= 0) {
    const closeAfterOpen = text.indexOf(']', lastOpen + 1)
    if (closeAfterOpen >= 0 && cursorPos > lastOpen && cursorPos <= closeAfterOpen + 1) {
      return {
        mode: 'closed',
        syntax: 'inline',
        query: '',
        replaceStart: cursorPos,
        replaceEnd: cursorPos,
      }
    }
  }

  const lastBlockOpen = before.lastIndexOf('{{')
  const lastBlockClose = before.lastIndexOf('}}')

  if (lastBlockOpen >= 0) {
    const closeAfterOpen = text.indexOf('}}', lastBlockOpen + 2)
    if (closeAfterOpen >= 0 && cursorPos > lastBlockOpen && cursorPos <= closeAfterOpen + 2) {
      return {
        mode: 'closed',
        syntax: 'block',
        query: '',
        replaceStart: cursorPos,
        replaceEnd: cursorPos,
      }
    }
  }

  if (lastBlockOpen > lastBlockClose && lastBlockOpen > lastOpen) {
    const partial = before.slice(lastBlockOpen + 2)
    const typeQueryMatch = partial.match(/^([a-zA-Z]*)$/)
    if (typeQueryMatch) {
      return {
        mode: 'type',
        syntax: 'block',
        query: typeQueryMatch[1] ?? '',
        replaceStart: lastBlockOpen,
        replaceEnd: cursorPos,
      }
    }

    const tokenMatch = partial.match(/^(skill|passive|gift):([^{}\n]*)$/)
    if (tokenMatch) {
      const blockType = tokenMatch[1] as 'skill' | 'passive' | 'gift'
      const rawBody = tokenMatch[2]
      const bodyParts = rawBody.split(':')
      const query = bodyParts[bodyParts.length - 1] ?? ''
      return {
        mode: 'value',
        syntax: 'block',
        query,
        replaceStart: lastBlockOpen,
        replaceEnd: cursorPos,
        blockFilter: blockType,
        sinnerName: blockType === 'skill' && rawBody.includes(':') ? bodyParts[0]?.trim() : undefined,
      }
    }

    return {
      mode: 'closed',
      syntax: 'block',
      query: '',
      replaceStart: cursorPos,
      replaceEnd: cursorPos,
    }
  }

  if (lastOpen > lastClose && lastOpen > lastBlockOpen) {
    const partial = before.slice(lastOpen + 1)
    const typeQueryMatch = partial.match(/^([a-zA-Z.]*)$/)
    if (typeQueryMatch) {
      return {
        mode: 'type',
        syntax: 'inline',
        query: typeQueryMatch[1] ?? '',
        replaceStart: lastOpen,
        replaceEnd: cursorPos,
      }
    }

    const tokenMatch = partial.match(/^([speikg]):([^\]\n]*)$/)
    if (tokenMatch) {
      const tokenType = tokenMatch[1]
      const rawBody = tokenMatch[2]
      const bodyParts = rawBody.split(':')
      const query = bodyParts[bodyParts.length - 1] ?? ''
      return {
        mode: 'value',
        syntax: 'inline',
        query,
        replaceStart: lastOpen,
        replaceEnd: cursorPos,
        typeFilter: TOKEN_TYPE_MAP[tokenType],
        sinnerName: tokenType === 'i' && rawBody.includes(':') ? bodyParts[0]?.trim() : undefined,
      }
    }
  }

  const wordMatch = before.match(/(\S+)$/)
  const query = wordMatch ? wordMatch[1] : ''
  return {
    mode: 'word',
    syntax: 'word',
    query,
    replaceStart: cursorPos - query.length,
    replaceEnd: cursorPos,
  }
}

export function getNoteAutocompleteSuggestions(
  text: string,
  cursorPos: number,
  pool: AutocompleteSuggestion[],
): AutocompleteSuggestion[] {
  const currentContext = getNoteAutocompleteContext(text, cursorPos)
  if (currentContext.mode === 'closed') return []
  if (currentContext.mode === 'word') return []
  if (currentContext.mode === 'type') {
    const query = currentContext.query.toLowerCase()
    const source = currentContext.syntax === 'block' ? BLOCK_TYPE_SUGGESTIONS : TOKEN_TYPE_SUGGESTIONS
    if (!query) return source
    return source.filter(s =>
      [s.label, ...(LABEL_I18N[s.label] ?? [])].some(label => label.toLowerCase().includes(query)) ||
      s.typeLabel?.toLowerCase().includes(query) ||
      s.token.toLowerCase().includes(query)
    )
  }
  if (currentContext.query.length < 1 && !currentContext.typeFilter && !currentContext.blockFilter) return []
  const typedPool = currentContext.syntax === 'block'
    ? pool.filter(s => s.syntax === 'block' && (
        currentContext.blockFilter === 'skill'
          ? s.type === 'skill'
          : currentContext.blockFilter === 'passive'
            ? s.type === 'passive'
            : s.type === 'egogift'
      ))
    : currentContext.typeFilter
      ? pool.filter(s => s.syntax !== 'block' && s.type === currentContext.typeFilter)
      : pool.filter(s => s.syntax !== 'block')
  const { query, sinnerName } = currentContext
  const ofSinner = sinnerName ? typedPool.filter(s => getTokenParts(s.token)[0] === sinnerName) : typedPool
  // The parts of the token (the sinner, the identity) find the item too, below the ones named so.
  return (query ? rankItems(ofSinner, query, s => getTokenParts(s.token)) : ofSinner).slice(0, 6)
}

export function getSuggestionMeta(suggestion: AutocompleteSuggestion): string | undefined {
  if (suggestion.token.startsWith('[@')) return suggestion.typeLabel
  const parts = getTokenParts(suggestion.token)
  const typeLabel = suggestion.typeLabel ?? TOKEN_PREFIX_LABELS[suggestion.type]
  if (suggestion.type === 'identity' && parts.length >= 2) return `${parts[0]} · ${typeLabel}`
  if ((suggestion.type === 'skill' || suggestion.type === 'ego') && parts.length >= 2) return `${parts[0]} · ${typeLabel}`
  return typeLabel
}

// ── 키워드 풀 생성 헬퍼 ──────────────────────────────────────────────────
export function buildKeywordPool(kwContext: Record<string, KeywordInfo>): AutocompleteSuggestion[] {
  return Object.entries(kwContext).filter(([, info]) => info.iconSlug).map(([kw, info]) => {
    const sinType = info.sinAffinity
    const sc = sinType ? (SIN_COLORS[sinType as keyof typeof SIN_COLORS] ?? '#c8900a') : '#c8900a'
    const iconSlug = info.iconSlug
    return {
      label: kw,
      type: 'keyword' as const,
      color: sc,
      iconUrl: getKeywordIconUrl(kw, iconSlug) ?? undefined,
      token: `[k:${kw}]`,
      syntax: 'inline',
    }
  })
}

// ── EGO 기프트 풀 생성 헬퍼 ──────────────────────────────────────────────
const EGO_GIFT_KW_COLORS = GIFT_KEYWORD_COLORS

export function buildEgoGiftPool(
  gifts: { name: string; keyword: string; image_url: string | null }[]
): AutocompleteSuggestion[] {
  return gifts.map(g => ({
    label: g.name,
    type: 'egogift' as const,
    typeLabel: '기프트',
    color: EGO_GIFT_KW_COLORS[g.keyword] ?? '#888',
    imageUrl: g.image_url ?? undefined,
    token: `[g:${g.name}]`,
    syntax: 'inline',
  }))
}
