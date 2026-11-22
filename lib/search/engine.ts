export type SearchType = 'sinner' | 'identity' | 'ego' | 'keyword' | 'egoGift' | 'themePack' | 'event' | 'page'
export type ContextField = 'sinner' | 'keyword' | 'alias'
/** 맞은 칸: 표시 이름(label), 다른 언어 이름(ko/en/ja), 맥락 칸, 비슷한 이름(fuzzy) */
type ReasonField = 'label' | 'ko' | 'en' | 'ja' | ContextField | 'fuzzy'

export interface IndexEntry {
  type: SearchType
  href: string
  label: string
  sublabel?: string
  icon?: string
  rarity?: number
  grade?: string | null
  names: { ko?: string | null; en?: string | null; ja?: string | null }
  /** 이름은 아니지만 이것으로도 찾는 글: 수감자 이름, 기프트 키워드, 별칭 */
  context?: { field: ContextField; text: string }[]
  /** 인격·E.G.O의 수감자 id. expandIndex가 그 수감자의 이름·별칭을 맥락으로 붙인다 */
  sinner?: string
  /** 본문(기프트 효과, 이벤트·선택지 글). 이름·맥락에 없고 여기에만 있는 검색어는 'text' 결과가 된다 */
  text?: string
}
export interface Reason { field: ReasonField; text: string; ranges: [number, number][] }
export type HitKind = 'exact' | 'prefix' | 'word' | 'contains' | 'initials' | 'words' | 'text' | 'typo'
export interface Snippet { before: string; hit: string; after: string }
/** similarity는 0~1, 화면이 줄을 세우고 구분하는 데 쓴다 */
export interface Hit { entry: IndexEntry; score: number; reasons: Reason[]; similarity: number; kind: HitKind; snippet?: Snippet }

const SEP = /[\s\-_.,·・:;'"!?()[\]{}「」『』【】<>~/&+…|*#]/
const CHO = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ'
const isCho = (c: string) => c >= 'ㄱ' && c <= 'ㅎ'
const onlyCho = (s: string) => /^[ㄱ-ㅎ]+$/.test(s)
const isSyllable = (c: string) => c >= '가' && c <= '힣'
const choOf = (c: string) => isSyllable(c) ? CHO[Math.floor((c.charCodeAt(0) - 0xac00) / 588)] : c

function foldChar(ch: string) {
  if (ch < '\x80') return ch.toLowerCase() // ASCII needs no normalizing; keeps the typo pass cheap
  if (isSyllable(ch) || (ch >= 'ㄱ' && ch <= 'ㆎ')) return ch
  const out = ch.normalize('NFKD').replace(/[̀-ͯ]/g, '').normalize('NFKC').toLowerCase()
  // 가타카나 → 히라가나
  return out.replace(/[ァ-ヶ]/g, k => String.fromCharCode(k.charCodeAt(0) - 0x60))
}

/** 공백·기호·대소문자·전각·라틴 장음 부호를 지우고 가타카나를 히라가나로. map[i]는 접은 글자 i의 원문 위치 */
export function fold(s: string): { text: string; map: number[] } {
  let text = ''
  const map: number[] = []
  for (let i = 0; i < s.length; i++) {
    if (SEP.test(s[i])) continue
    for (const c of foldChar(s[i])) { text += c; map.push(i) }
  }
  return { text, map }
}

const scriptOf = (c: string) => isSyllable(c) ? 'h' : /[a-z]/i.test(c) ? 'l' : /\d/.test(c) ? 'd' : 'o'
const isWordStart = (orig: string, at: number) =>
  at === 0 || SEP.test(orig[at - 1]) || scriptOf(orig[at - 1]) !== scriptOf(orig[at])

const JUNG = 'ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ'
// A double final is two letters (닭 -> ㄷㅏㄹㄱ) so a half-typed next syllable lines up.
const JONG = ['', 'ㄱ', 'ㄲ', 'ㄱㅅ', 'ㄴ', 'ㄴㅈ', 'ㄴㅎ', 'ㄷ', 'ㄹ', 'ㄹㄱ', 'ㄹㅁ', 'ㄹㅂ', 'ㄹㅅ', 'ㄹㅌ', 'ㄹㅍ', 'ㄹㅎ', 'ㅁ', 'ㅂ', 'ㅂㅅ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ']
/** Hangul syllables as the letters typed for them (화상 -> ㅎㅘㅅㅏㅇ); other characters as they are. */
const jamo = (s: string) => [...s].map(c => {
  if (!isSyllable(c)) return c
  const n = c.charCodeAt(0) - 0xac00
  return CHO[Math.floor(n / 588)] + JUNG[Math.floor(n % 588 / 28)] + JONG[n % 28]
}).join('')

const TIER = { exact: 1000, prefix: 800, word: 600, contains: 400 } as const
const KIND_OF: Record<number, HitKind> = { [TIER.exact]: 'exact', [TIER.prefix]: 'prefix', [TIER.word]: 'word', [TIER.contains]: 'contains' }
const SIMILARITY: Record<HitKind, number> = { exact: 1, prefix: 0.9, word: 0.8, contains: 0.7, initials: 0.6, words: 0.5, text: 0.4, typo: 0.3 }
type Match = { tier: number; score: number; ranges: [number, number][]; kind: HitKind }

/** 접은 검색어 q가 원문 text 어디에 맞는지. 초성만이거나 한글이 아닌 한 글자면 이름 가운데에는 맞추지 않는다(완성된 한글 한 글자는 맞춘다: "꽃" → "불꽃") */
function matchText({ text, f }: Field, q: string): Match | null {
  const allCho = onlyCho(q)
  const strict = allCho || (q.length === 1 && !isSyllable(q))
  const last = q.length - 1
  let best: Match | null = null
  outer: for (let i = 0; i + q.length <= f.text.length; i++) {
    let span = q.length, partial = false
    for (let j = 0; j < q.length; j++) {
      const h = f.text[i + j], c = q[j]
      if (h === c) continue
      if (isCho(c) && choOf(h) === c) { partial ||= !allCho; continue }
      // the last letter may be a syllable still being typed: its jamo only begin the next one or two syllables
      if (j < last || !isSyllable(c)) continue outer
      const tail = jamo(c), first = jamo(h).startsWith(tail)
      // one letter alone says too little about the syllable it will become: only its final may open the next one
      if (first ? last === 0 : !jamo(f.text.slice(i + j, i + j + 2)).startsWith(tail)) continue outer
      span += first ? 0 : 1
      partial = true
    }
    const tier = i === 0 ? (q.length === f.text.length && !partial ? TIER.exact : TIER.prefix)
      : isWordStart(text, f.map[i]) ? TIER.word : strict ? 0 : TIER.contains
    // a half-typed match keeps its tier but sits under the names that hold the letters whole
    if (tier && (!best || tier > best.tier)) best = { tier, score: tier - (partial ? 50 : 0), ranges: [[f.map[i], f.map[i + span - 1] + 1]], kind: allCho ? 'initials' : KIND_OF[tier] }
    if (best && best.tier >= TIER.prefix) break
  }
  // 같은 등급이면 짧은 이름(검색어가 더 많이 덮는 이름)이 앞
  if (best) best.score += 100 * q.length / f.text.length
  return best
}

type Folded = ReturnType<typeof fold>
type Field = { field: ReasonField; text: string; weight: number; f: Folded; jm?: { tj: Uint16Array; owner: number[] } }

// Folded once per entry (the index outlives every keystroke, entries are not edited in place).
const fieldCache = new WeakMap<IndexEntry, Field[]>()
function fields(e: IndexEntry): Field[] {
  let list = fieldCache.get(e)
  if (list) return list
  const raw: Omit<Field, 'f'>[] = [{ field: 'label', text: e.label, weight: 1 }]
  for (const lang of ['ko', 'en', 'ja'] as const) {
    const name = e.names[lang]
    if (name && name !== e.label) raw.push({ field: lang, text: name, weight: 1 })
  }
  for (const c of e.context ?? []) raw.push({ field: c.field, text: c.text, weight: 0.5 })
  fieldCache.set(e, list = raw.map(r => ({ ...r, f: fold(r.text) })))
  return list
}

// 한 항목 안에서는 등급만 비교해, 같은 등급이면 앞 칸(표시 이름)을 근거로 둔다
function bestField(e: IndexEntry, q: string): { score: number; reason: Reason; kind: HitKind; similarity: number } | null {
  let best: { tier: number; score: number; reason: Reason; kind: HitKind; similarity: number } | null = null
  for (const f of fields(e)) {
    const m = matchText(f, q)
    if (!m || (best && m.tier * f.weight <= best.tier)) continue
    // found through context (a sinner, a keyword), not by its own name: under every name match, over body text
    const similarity = f.weight < 1 ? 0.45 + 0.1 * SIMILARITY[m.kind] : SIMILARITY[m.kind]
    best = { tier: m.tier * f.weight, score: m.score * f.weight, kind: m.kind, similarity, reason: { field: f.field, text: f.text, ranges: m.ranges } }
  }
  return best
}

// 같은 점수일 때 앞에 둘 종류
const TYPE_BIAS: Record<SearchType, number> = { sinner: 6, page: 5, identity: 4, ego: 3, keyword: 2, egoGift: 1, themePack: 1, event: 0 }

// Plain/tense consonants and easily confused vowels: swapping within a group costs half an edit.
// Letters are compared as char codes; SOFT maps a compatibility jamo (offset from U+3130) to its group.
const SOFT = new Int8Array(0x60).fill(-1)
;['ㄱㄲ', 'ㄷㄸ', 'ㅂㅃ', 'ㅅㅆ', 'ㅈㅉ', 'ㅐㅔ', 'ㅒㅖ', 'ㅗㅘ', 'ㅜㅝ', 'ㅚㅙㅞ'].forEach((g, i) => { for (const c of g) SOFT[c.charCodeAt(0) - 0x3130] = i })
const swap = (a: number, b: number) => a === b ? 0 : SOFT[a - 0x3130] >= 0 && SOFT[a - 0x3130] === SOFT[b - 0x3130] ? 0.5 : 1
const codes = (s: string) => Uint16Array.from({ length: s.length }, (_, i) => s.charCodeAt(i))
let rows = [new Float64Array(128), new Float64Array(128)]
let from = [new Int32Array(128), new Int32Array(128)]

/**
 * Cheapest edit cost of q against any stretch of text, with where that stretch starts and ends; null above max.
 * owner[j] is the character letter j belongs to: the stretch ends where a character does, since half a syllable
 * ("호수" inside "호선") is another word, not a typo.
 */
function nearest(q: Uint16Array, text: Uint16Array, max: number, owner: number[]): { cost: number; start: number; end: number } | null {
  if (text.length >= rows[0].length) {
    rows = [new Float64Array(text.length * 2), new Float64Array(text.length * 2)]
    from = [new Int32Array(text.length * 2), new Int32Array(text.length * 2)]
  }
  let [prev, cur] = rows, [pf, cf] = from
  for (let j = 0; j <= text.length; j++) { prev[j] = 0; pf[j] = j }
  for (let i = 1; i <= q.length; i++) {
    cur[0] = i
    cf[0] = 0
    let low = i
    for (let j = 1; j <= text.length; j++) {
      const sub = prev[j - 1] + swap(q[i - 1], text[j - 1]), skip = prev[j] + 1, add = cur[j - 1] + 1
      const v = Math.min(sub, skip, add)
      cur[j] = v
      cf[j] = v === sub ? pf[j - 1] : v === skip ? pf[j] : cf[j - 1]
      if (v < low) low = v
    }
    if (low > max) return null
    ;[prev, cur, pf, cf] = [cur, prev, cf, pf]
  }
  let end = -1
  for (let j = 1; j <= text.length; j++) if (owner[j - 1] !== owner[j] && (end < 0 || prev[j] < prev[end])) end = j
  return end > 0 && prev[end] <= max ? { cost: prev[end], start: pf[end], end } : null
}

/** The letters of the name equal to the query's, in order, near where the match ended (a wrong letter stays unmarked). */
function equalLetters(f: Folded, q: string, endChar: number): [number, number][] {
  const ranges: [number, number][] = []
  let from = Math.max(0, endChar - q.length - 1)
  for (const c of q) {
    const k = f.text.indexOf(c, from)
    if (k < 0 || k > endChar) continue
    const at = f.map[k], prev = ranges[ranges.length - 1]
    if (prev && prev[1] === at) prev[1] = at + 1
    else ranges.push([at, at + 1])
    from = k + 1
  }
  return ranges
}

/** The name field closest to q by jamo edit distance (within max), with the matching letters marked. */
function typo(e: IndexEntry, q: string, qj: Uint16Array, max: number): { cost: number; reason: Reason } | null {
  let best: { cost: number; reason: Reason } | null = null
  for (const f of fields(e)) {
    if (f.weight < 1) continue
    if (!f.jm) {
      const owner: number[] = []
      f.f.text.split('').forEach((c, i) => { for (let k = jamo(c).length; k > 0; k--) owner.push(i) })
      f.jm = { tj: codes(jamo(f.f.text)), owner }
    }
    if (f.jm.tj.length < qj.length - max) continue
    const o = f.jm.owner, r = nearest(qj, f.jm.tj, max, o)
    // the stretch has to open a word: a short query one letter off would otherwise match across any two words
    if (!r || o[r.start] === o[r.start - 1] || !isWordStart(f.text, f.f.map[o[r.start]])) continue
    if (!best || r.cost < best.cost) best = { cost: r.cost, reason: { field: 'fuzzy', text: f.text, ranges: equalLetters(f.f, q, f.jm.owner[r.end - 1]) } }
  }
  return best
}

/** 글자가 순서대로 들어 있는 이름(2글자 이상). 아무것도 못 찾았을 때만 쓴다 */
function subsequence(e: IndexEntry, q: string): Reason | null {
  for (const f of fields(e)) {
    if (f.weight < 1) continue
    const ft = f.f, ranges: [number, number][] = []
    let j = 0
    for (let i = 0; i < ft.text.length && j < q.length; i++) {
      const h = ft.text[i], c = q[j]
      if (h !== c && !(isCho(c) && choOf(h) === c)) continue
      const at = ft.map[i], prev = ranges[ranges.length - 1]
      if (prev && prev[1] === at) prev[1] = at + 1
      else ranges.push([at, at + 1])
      j++
    }
    if (j === q.length) return { field: 'fuzzy', text: f.text, ranges }
  }
  return null
}

function aroundMatch(f: Folded, text: string, q: string, n: number): Snippet | null {
  const at = f.text.indexOf(q)
  if (at < 0) return null
  const from = f.map[at], to = f.map[at + q.length - 1] + 1
  const a = Math.max(0, from - n), b = Math.min(text.length, to + n)
  return { before: (a > 0 ? '…' : '') + text.slice(a, from), hit: text.slice(from, to), after: text.slice(to, b) + (b < text.length ? '…' : '') }
}

/** 접은 글로 찾고 원문 조각을 돌려준다: 맞은 곳 앞뒤 around자, 잘린 쪽에는 … */
export function snippet(text: string, query: string, around = 22): Snippet | null {
  const q = fold(query).text
  return q ? aroundMatch(fold(text), text, q, around) : null
}

/** 색인을 받은 뒤 한 번: 인격·E.G.O에 수감자 이름(세 언어)과 별칭을 맥락으로, 그림 뒷주소에 저장소 주소를 붙인다 */
export function expandIndex(entries: IndexEntry[], storageBase: string): IndexEntry[] {
  const sinners = new Map(entries.filter(e => e.type === 'sinner').map(e => [e.href.split('/').pop(), e]))
  return entries.map(e => {
    const icon = e.icon && !/^https?:/.test(e.icon) ? `${storageBase}/${e.icon}` : e.icon
    const s = e.sinner ? sinners.get(e.sinner) : undefined
    if (!s) return icon === e.icon ? e : { ...e, icon }
    const texts = [...new Set([s.names.ko, s.names.en, s.names.ja, ...(s.context ?? []).map(c => c.text)])].filter((t): t is string => !!t)
    return { ...e, icon, context: [...(e.context ?? []), ...texts.map(text => ({ field: 'sinner' as const, text }))] }
  })
}

const bodyFolds = new WeakMap<IndexEntry, Folded>()

export function search(entries: IndexEntry[], query: string): Hit[] {
  const trimmed = query.trim().slice(0, 80)
  const whole = fold(trimmed).text
  if (!whole) return []
  const words = trimmed.split(/\s+/).map(w => fold(w).text).filter(Boolean)
  const allCho = onlyCho(whole)
  const qj = codes(jamo(whole))
  // typo budget: 1 for 4-7 jamo, 2 from 8 (latin stays 1), none under 4 or for initials only
  const max = qj.length < 4 || allCho ? 0 : qj.length < 8 || /^[a-z]+$/.test(whole) ? 1 : 2

  const hits: Hit[] = []
  const rest: IndexEntry[] = []
  for (const entry of entries) {
    const one = bestField(entry, whole)
    if (one) { hits.push({ entry, score: one.score + TYPE_BIAS[entry.type], reasons: [one.reason], similarity: one.similarity, kind: one.kind }); continue }
    // 띄어 쓴 낱말이 모두 어딘가(이름이나 맥락)에 맞아야 한다
    const parts = words.length < 2 ? [] : words.map(w => bestField(entry, w))
    if (parts.length && parts.every(Boolean)) {
      const sum = parts.reduce((s, p) => s + p!.score, 0)
      hits.push({ entry, score: 300 + sum / (10 * parts.length) + TYPE_BIAS[entry.type], reasons: parts.map(p => p!.reason), similarity: SIMILARITY.words, kind: 'words' })
    } else rest.push(entry)
  }

  // body text: only for entries no name matched, scored under every name hit
  const solid = hits.length
  const unmatched: IndexEntry[] = []
  for (const entry of rest) {
    let sn: Snippet | null = null
    if (entry.text && whole.length > 1 && !allCho) {
      let f = bodyFolds.get(entry)
      if (!f) bodyFolds.set(entry, f = fold(entry.text))
      sn = aroundMatch(f, entry.text, whole, 22)
    }
    if (sn) hits.push({ entry, score: 150 + TYPE_BIAS[entry.type], reasons: [], similarity: SIMILARITY.text, kind: 'text', snippet: sn })
    else unmatched.push(entry)
  }

  // typos only top up a short list, and always sit below it; a name that is exactly the query was not mistyped
  if (max > 0 && solid < 3 && !hits.some(hit => hit.kind === 'exact')) {
    for (const entry of unmatched) {
      const t = typo(entry, whole, qj, max)
      if (t) hits.push({ entry, score: 110 - 10 * t.cost + TYPE_BIAS[entry.type], reasons: [t.reason], similarity: 0.45 - 0.075 * t.cost, kind: 'typo' })
    }
  }
  if (hits.length === 0 && whole.length >= 2) {
    for (const entry of entries) {
      const reason = subsequence(entry, whole)
      if (reason) hits.push({ entry, score: 100 + TYPE_BIAS[entry.type], reasons: [reason], similarity: SIMILARITY.typo, kind: 'typo' })
    }
  }
  return hits.sort((a, b) => b.score - a.score || a.entry.label.length - b.entry.label.length)
}
