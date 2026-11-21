/** `@` mentions in a note: an identity or an E.G.O named inside a sentence. */
const MENTION_KINDS = ['identity', 'ego'] as const
export type MentionKind = typeof MENTION_KINDS[number]
export const isMentionKind = (value: unknown): value is MentionKind => MENTION_KINDS.includes(value as MentionKind)

export function mentionHref(kind: MentionKind, id: string, sinnerId: string): string {
  return kind === 'identity' ? `/sinners/${sinnerId}/identities/${id}` : `/sinners/${sinnerId}/ego/${id}`
}

/** How many mentions the list shows at once (it scrolls): enough for a whole family such as the nine 거미집 identities. */
export const MENTION_LIMIT = 12
const MAX_QUERY = 40

/**
 * The name being typed after the last `@`, spaces included (names such as "거미집 검지 아비" have them); `length` includes the `@`.
 * The `@` may follow a space, a bracket, a mention (`\ufffc`) or a Korean or Japanese word, but not a Latin letter or digit, so an
 * e-mail does not open the list. A space right after the `@`, a new line or a long run ends it; the caller closes the list when
 * nothing matches, so ordinary words written after an `@` stop it there.
 */
export function findMentionQuery(before: string): { query: string; length: number } | null {
  const at = before.lastIndexOf('@')
  if (at < 0 || /[A-Za-z0-9._%+-]/.test(before[at - 1] ?? '')) return null
  const query = before.slice(at + 1)
  if (query.length > MAX_QUERY || /^\s|\s\s|[\n\ufffc]/.test(query)) return null
  return { query, length: query.length + 1 }
}
