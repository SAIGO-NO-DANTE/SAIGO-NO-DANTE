import type { SupportedLang } from './types'

interface LocalizableEntity {
  name_kr: string
  name_en?: string | null
  name_jp?: string | null
}

export function getLocalizedName(entity: LocalizableEntity, lang: SupportedLang): string {
  if (lang === 'en' && entity.name_en) return entity.name_en
  if (lang === 'ja' && entity.name_jp) return entity.name_jp
  return entity.name_kr
}

/** The same as getLocalizedName for a row whose Korean name column is `name` (gifts, themes, events). */
export function localizeRowName(row: { name: string; name_en?: string | null; name_jp?: string | null }, lang: SupportedLang): string {
  return getLocalizedName({ name_kr: row.name, name_en: row.name_en, name_jp: row.name_jp }, lang)
}

/* ── Affiliation localization ── */

const AFFILIATION_MAP: Record<string, { en: string; ja: string }> = {
  // Names from the game's UnitKeyword localization (LimbusAssets, 2026-09-24).
  '시지프': { en: 'Sisyphe', ja: 'シーシュポス' },
  '르누아르': { en: 'Le Noir', ja: 'ル・ノワール' },
  '르루주': { en: 'Le Rouge', ja: 'ル・ルージュ' },
  '7대 패밀리': { en: 'Le Sette Famiglie', ja: '七大ファミリー' },
  'S사': { en: 'S Corp.', ja: 'S社' },
  'LCD': { en: 'LCD', ja: 'LCD' },
  '해결사': { en: 'Fixer', ja: 'フィクサー' },
  '가씨 가문': { en: 'Jia Family', ja: 'ジア家' },
  '갈고리 사무소': { en: 'Hook Office', ja: '鈎事務所' },
  '거미집': { en: 'The House of Spiders', ja: '蜘蛛の巣' },
  '검계': { en: 'Blade Lineage', ja: '剣契' },
  '검지': { en: 'The Index', ja: '人差し指' },
  '기술해방연합': { en: 'Technology Liberation Alliance', ja: '技術解放連合' },
  '데드레빗츠': { en: 'The Dead Rabbits', ja: 'デッドラビッツ' },
  '도서관 옛 손님': { en: 'Library Patron', ja: '図書館の旧客' },
  '디에치 협회': { en: 'Dieci Association', ja: 'ディエーチ協会' },
  '라만차랜드': { en: 'La Manchaland', ja: 'ラ・マンチャランド' },
  '로보토미 본사': { en: 'Lobotomy Corp. Headquarters', ja: 'ロボトミー本社' },
  '료.고.파': { en: 'R.B.', ja: 'りょ・ミ・パ' },
  '리우 협회': { en: 'Liu Association', ja: 'リウ協会' },
  '림버스 컴퍼니': { en: 'Limbus Company', ja: 'リンバス・カンパニー' },
  '마리아치': { en: 'Los Mariachis', ja: 'マリアッチ' },
  '마침표 사무소': { en: 'Full-Stop Office', ja: '終止符事務所' },
  '멀티크랙 사무소': { en: 'MultiCrack Office', ja: 'マルチクラック事務所' },
  '밤의 송곳': { en: 'Night Awls', ja: '夜の錐' },
  '불주먹 사무소': { en: 'Firefist Office', ja: '炎拳事務所' },
  '새벽 사무소': { en: 'Dawn Office', ja: '夜明事務所' },
  '섕크 협회': { en: 'Cinq Association', ja: 'センク協会' },
  '세븐 협회': { en: 'Seven Association', ja: 'セブン協会' },
  '송곳니 사냥 사무소': { en: 'Fanghunt Office', ja: '牙狩事務所' },
  '시 협회': { en: 'Shi Association', ja: 'シ協会' },
  '신체파': { en: 'School of Corporism', ja: '身体派' },
  '소지': { en: 'The Pinky', ja: '小指' },
  '쌍갈고리 해적단': { en: 'Twinhook Pirates', ja: '双鉤海賊団' },
  '쐐기 사무소': { en: 'Wedge Office', ja: '楔事務所' },
  '야수파': { en: 'School of Fauvism', ja: '野獣派' },
  '약지': { en: 'The Ring', ja: '薬指' },
  '어금니 사무소': { en: 'Molar Office', ja: '奥歯事務所' },
  '엄지': { en: 'The Thumb', ja: '親指' },
  '에드가 가문': { en: 'Edgar Family', ja: 'エドガー家' },
  '와일드헌트': { en: 'The Wild Hunt', ja: 'ワイルドハント' },
  '외우피 협회': { en: 'Öufi Association', ja: 'ウーフィ協会' },
  '워더링하이츠': { en: 'Wuthering Heights', ja: 'ワザリング・ハイツ' },
  '유로지비': { en: 'Yurodiviye', ja: 'ユロージヴィ' },
  '장미스패너 공방': { en: 'Rosespanner Workshop', ja: 'バラのスパナ工房' },
  '점묘파': { en: 'School of Pointillism', ja: '点描派' },
  '정사무소': { en: "Jeong's Office", ja: '定事務所' },
  '제뱌찌 협회': { en: "Devyat' Association", ja: 'ヂェーヴィチ協会' },
  '중지': { en: 'The Middle', ja: '中指' },
  '츠바이 협회': { en: 'Zwei Association', ja: 'ツヴァイ協会' },
  '콩콩이파': { en: 'Tingtang Gang', ja: 'ぽんぽん派' },
  '피쿼드호': { en: 'The Pequod', ja: 'ピークォド号' },
  '협력 사무소 - 외우피': { en: 'Associate Office - Öufi', ja: '協力事務所 - ウーフィ' },
  '혈귀': { en: 'Bloodfiend', ja: '血鬼' },
  '흑수': { en: 'Heishou Pack', ja: '黒獣' },
  '흑수 - 묘': { en: 'Heishou Pack - Mao Branch', ja: '黒獣 - 卯' },
  '흑수 - 미': { en: 'Heishou Pack - Wei Branch', ja: '黒獣 - 未' },
  '흑수 - 사': { en: 'Heishou Pack - Si Branch', ja: '黒獣 - 巳' },
  '흑수 - 오': { en: 'Heishou Pack - Wu Branch', ja: '黒獣 - 午' },
  '흑수 - 유': { en: 'Heishou Pack - You Branch', ja: '黒獣 - 酉' },
  '흑수 필두': { en: 'Heishou Pack Adept', ja: '黒獣 筆頭' },
  '흑운회': { en: 'Kurokumo Clan', ja: '黒雲会' },
  'G사': { en: 'G Corp.', ja: 'G社' },
  'H사': { en: 'H Corp.', ja: 'H社' },
  'J사': { en: 'J Corp.', ja: 'J社' },
  'K사': { en: 'K Corp.', ja: 'K社' },
  'LCB': { en: 'LCB', ja: 'LCB' },
  'LCA': { en: 'LCA', ja: 'LCA' },
  'LCC': { en: 'LCC', ja: 'LCC' },
  'LCCB': { en: 'LCCB', ja: 'LCCB' },
  'LCE': { en: 'LCE', ja: 'LCE' },
  'LCE?': { en: 'LCE?', ja: 'LCE?' },
  '23구 뒷골목': { en: 'District 23 Backstreets', ja: '23区裏路地' },
  '20구 유로지비': { en: 'District 20 Yurodivy', ja: '20区ユロージヴィ' },
  'N사': { en: 'N Corp.', ja: 'N社' },
  'N사 광신도': { en: 'N Corp. Fanatic', ja: 'N社の狂信者' },
  'R사': { en: 'R Corp.', ja: 'R社' },
  'T사': { en: 'T Corp.', ja: 'T社' },
  'W사': { en: 'W Corp.', ja: 'W社' },
  '구 G사': { en: 'Old G Corp.', ja: '旧G社' },
  '구 L사': { en: 'Old L Corp.', ja: '旧L社' },
}

export function getLocalizedAffiliation(affiliation: string, lang: SupportedLang): string {
  const key = affiliation.trim()
  if (lang === 'ko') return key
  return AFFILIATION_MAP[key]?.[lang] ?? key
}

export function getLocalizedAffiliations(affiliations: string[], lang: SupportedLang): string[] {
  return affiliations
    .map(affiliation => affiliation.trim())
    .filter(Boolean)
    .map(affiliation => getLocalizedAffiliation(affiliation, lang))
}

/* ── Keyword name/description localization ── */

interface LocalizableKeyword {
  nameEn?: string | null
  nameJp?: string | null
  descEn?: string | null
  descJp?: string | null
}

export function getLocalizedKeywordName(koreanName: string, info: LocalizableKeyword | undefined, lang: SupportedLang): string {
  if (!info) return koreanName
  if (lang === 'en' && info.nameEn) return info.nameEn
  if (lang === 'ja' && info.nameJp) return info.nameJp
  return koreanName
}

export function getLocalizedKeywordDesc(koreanDesc: string, info: LocalizableKeyword | undefined, lang: SupportedLang): string {
  if (!info) return koreanDesc
  if (lang === 'en' && info.descEn) return info.descEn
  if (lang === 'ja' && info.descJp) return info.descJp
  return koreanDesc
}
