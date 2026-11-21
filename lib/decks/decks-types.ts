type DeckKeywordInfo = {
  nameEn?: string | null
  nameJp?: string | null
}

const COMBAT_KEYWORD_LABELS: Record<string, { ko: string; en: string; ja: string }> = {
  slash: { ko: '참격', en: 'Slash', ja: '斬撃' },
  pierce: { ko: '관통', en: 'Pierce', ja: '貫通' },
  blunt: { ko: '타격', en: 'Blunt', ja: '打撃' },
}

const COMBAT_KEYWORD_ALIASES: Record<string, keyof typeof COMBAT_KEYWORD_LABELS> = {
  '참격': 'slash',
  slash: 'slash',
  '관통': 'pierce',
  pierce: 'pierce',
  '타격': 'blunt',
  blunt: 'blunt',
}

export function localizeDeckKeyword(
  keyword: string,
  info: DeckKeywordInfo | undefined,
  locale: string,
): string {
  const lang = locale === 'en' || locale === 'ja' ? locale : 'ko'
  const combatKey = COMBAT_KEYWORD_ALIASES[keyword]
  if (combatKey) return COMBAT_KEYWORD_LABELS[combatKey][lang]
  if (lang === 'en' && info?.nameEn) return info.nameEn
  if (lang === 'ja' && info?.nameJp) return info.nameJp
  return keyword
}

export function contentTypeMessageKey(contentType: string | null | undefined): string {
  switch (contentType) {
    case '스토리':
      return 'story'
    case '경험치 던전':
      return 'expDungeon'
    case '끈 던전':
      return 'threadDungeon'
    case '거던5층':
      return 'mirrorDungeon5'
    case '거던10층':
      return 'mirrorDungeon10'
    case '거던15층':
      return 'mirrorDungeon15'
    case '거굴철':
      return 'refractionRailway'
    case '사영 전투':
      return 'reflectrial'
    case '없음':
      return 'none'
    default:
      return 'none'
  }
}
