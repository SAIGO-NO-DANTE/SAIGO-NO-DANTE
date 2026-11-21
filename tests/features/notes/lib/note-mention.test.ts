import { describe, expect, it } from 'vitest'
import { NOTE_PREFIX, assetRefs, hasBlocks, normalizeDocument, notePlainText, notePreviewText, parseBlockDocument } from '@/lib/notes/blocks'
import { tiptapContentToMarkdown } from '@/features/notes/lib/document'
import { MENTION_LIMIT, findMentionQuery, mentionHref } from '@/lib/notes/mention'
import { filterMentions } from '@/lib/notes/mention-search'

const doc = (...content: object[]) => ({ type: 'doc', content })
const mention = (attrs: object) => ({ type: 'noteMention', attrs })
const para = (...content: object[]) => ({ type: 'paragraph', content })

describe('mention nodes are saved', () => {
  it('keeps an identity and an E.G.O mention inside a sentence and cuts what is too long', () => {
    const d = normalizeDocument(doc(para(
      { type: 'text', text: '추천: ' }, mention({ kind: 'identity', id: 'abc', name: '로쟈' }),
      mention({ kind: 'ego', id: 'x'.repeat(300), name: 'n'.repeat(300) }),
    )))!
    const [, identity, ego] = d.content![0].content!
    expect(identity).toEqual(mention({ kind: 'identity', id: 'abc', name: '로쟈' }))
    expect(ego.attrs!.id).toHaveLength(150)
    expect(ego.attrs!.name).toHaveLength(100)
  })
  it('drops a mention of any other kind or without an id', () => {
    const d = normalizeDocument(doc(para(
      { type: 'text', text: 'a' }, mention({ kind: 'gift', id: 'g1', name: 'x' }), mention({ kind: 'identity', id: '', name: 'x' }), mention({ id: 'z' }),
    )))!
    expect(d.content![0].content).toEqual([{ type: 'text', text: 'a', marks: [] }])
  })
  it('saves as a block document, asks for the asset, and reads as its name in plain text', () => {
    const d = doc(para({ type: 'text', text: '봐요 ' }, mention({ kind: 'identity', id: 'i1', name: '로쟈' })))
    expect(hasBlocks(d)).toBe(true)
    const saved = tiptapContentToMarkdown(d)
    expect(saved.startsWith(NOTE_PREFIX)).toBe(true)
    const back = parseBlockDocument(saved)!
    expect(JSON.parse(assetRefs(back))).toEqual([{ kind: 'identity', id: 'i1' }])
    expect(notePlainText(saved).replace(/\s+/g, ' ')).toBe('봐요 로쟈')
    expect(notePreviewText(saved).replace(/\s+/g, ' ')).toBe('봐요 로쟈')
  })
})

describe('typing @ finds identities and E.G.O', () => {
  it('reads the name typed after an @ at a word start', () => {
    expect(findMentionQuery('첫 문장 @로쟈')).toEqual({ query: '로쟈', length: 3 })
    expect(findMentionQuery('@')).toEqual({ query: '', length: 1 })
    expect(findMentionQuery('(@Rod')).toEqual({ query: 'Rod', length: 4 })
  })
  it('ignores an email, a space right after the @, another line and a name that is too long', () => {
    expect(findMentionQuery('mail me@example')).toBeNull()
    expect(findMentionQuery('@ 로쟈')).toBeNull()
    expect(findMentionQuery('@로쟈\n다음')).toBeNull()
    expect(findMentionQuery('@' + 'a'.repeat(41))).toBeNull()
  })
  it('keeps reading a name with spaces, so the words after the @ narrow the list until nothing matches', () => {
    expect(findMentionQuery('@거미집 검지 아비')).toEqual({ query: '거미집 검지 아비', length: 10 })
    expect(findMentionQuery('@로쟈 뒤에 글')).toEqual({ query: '로쟈 뒤에 글', length: 8 })
    expect(filterMentions(pool, '로쟈 뒤에 글', 6)).toEqual([])
  })
  it('opens right after a mention or a Korean word, where no e-mail can be', () => {
    expect(findMentionQuery('추천 \ufffc@')).toEqual({ query: '', length: 1 })
    expect(findMentionQuery('추천 \ufffc@거미')).toEqual({ query: '거미', length: 3 })
    expect(findMentionQuery('이상@')).toEqual({ query: '', length: 1 })
  })
  const pool = [
    { id: 'a', label: '붉은 눈 로쟈', aliases: ['Red Eyes Rodion', 'Rodion'] },
    { id: 'b', label: '로쟈', aliases: ['Rodion', 'ロージャ'] },
    { id: 'c', label: '이상', aliases: ['Yi Sang', 'イサン'] },
    { id: 'd', label: '이상', aliases: ['Yi Sang', 'イサン'] },
  ]
  it('matches a name in any language and puts names that start with the query first', () => {
    expect(filterMentions(pool, '로쟈', 6).map(p => p.id)).toEqual(['b', 'a'])
    // Both have the alias "Rodion" whole: the shorter name comes first (the engine's tie rule), no longer the pool order.
    expect(filterMentions(pool, 'rodion', 6).map(p => p.id)).toEqual(['b', 'a'])
    expect(filterMentions(pool, 'イサン', 6).map(p => p.id)).toEqual(['c', 'd'])
  })
  it('matches initials, a mistyped name and the name typed without its spaces', () => {
    expect(filterMentions(pool, 'ㄹㅈ', 6).map(p => p.id)).toEqual(['b', 'a'])
    expect(filterMentions(pool, '로자', 6).map(p => p.id)).toEqual(['b', 'a'])
    expect(filterMentions(pool, '붉은눈로쟈', 6).map(p => p.id)).toEqual(['a'])
  })
  it('stops at the limit, and lists the first entries of the pool for no query', () => {
    const many = Array.from({ length: 20 }, (_, i) => ({ id: `n${i}`, label: `거미집 ${i}`, aliases: [] as string[] }))
    expect(filterMentions(many, '거미집', MENTION_LIMIT)).toHaveLength(MENTION_LIMIT)
    expect(filterMentions(many, '', MENTION_LIMIT).map(p => p.id)).toEqual(many.slice(0, MENTION_LIMIT).map(p => p.id))
  })
  const spider = ['검지 아비|yi-sang|이상', '소지 제자|sinclair|싱클레어', '약지 아비|hong-lu|홍루', '약지 제자|faust|파우스트', '엄지 아비|rodion|로쟈'].map(row => {
    const [name, id, sinner] = row.split('|')
    return { id, label: '거미집 ' + name, aliases: [sinner] }
  })
  it('matches every word of a name with spaces, in any order and with or without the spaces, and the sinner\'s name', () => {
    expect(filterMentions(spider, '거미집 검지 아비 이상', 12).map(p => p.id)).toEqual(['yi-sang'])
    // 엄지 is one letter off 검지: a name that matches, then the typo below it.
    expect(filterMentions(spider, '거미집검지', 12).map(p => p.id)).toEqual(['yi-sang', 'rodion'])
    expect(filterMentions(spider, '아비 거미집', 12).map(p => p.id)).toEqual(['yi-sang', 'hong-lu', 'rodion'])
    expect(filterMentions(spider, '거미집 ', 12)).toHaveLength(5)
    expect(MENTION_LIMIT).toBeGreaterThanOrEqual(9)
  })
  it('lists the first entries for a bare @ and stops at the limit', () => {
    expect(filterMentions(pool, '', 3).map(p => p.id)).toEqual(['a', 'b', 'c'])
    expect(filterMentions(pool, '없는 이름', 6)).toEqual([])
  })
})

describe('where a mention links to', () => {
  it('goes to the identity page or the E.G.O page of its sinner', () => {
    expect(mentionHref('identity', 'i1', 'rodion')).toBe('/sinners/rodion/identities/i1')
    expect(mentionHref('ego', 'e1', 'faust')).toBe('/sinners/faust/ego/e1')
  })
})
