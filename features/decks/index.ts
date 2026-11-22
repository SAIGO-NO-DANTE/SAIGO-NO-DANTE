// 클라이언트에서도 쓸 수 있는 순수 코드만. 컴포넌트는 `@/features/decks/components/<이름>`으로 가져온다.
// `lib/decks/`에 남은 것: 키워드 규칙(`keyword-rules`)과 팀 코드(`team-code`, `deck-code-utils`, `formation-init`). `lib/planner`·`lib/meta`가 쓰고 pako를 끌어오므로, 이 입구에 두면 모든 라우트 첫 JS가 15KB 늘어 공용에 둔다.
export { computeAttackTypeCounts, computeDeckResources, computeSinProduction, fieldedEntries } from '@/lib/decks/deck-analysis'
export { insertDeckIdentities, isAwakenedUptie, normalizeUptie, rowsAtUptie, topUptieRows, topUptiePassives, topUptieSkills } from '@/lib/decks/deck-identity-uptie'
export { contentTypeMessageKey, localizeDeckKeyword } from '@/lib/decks/decks-types'
export { buildEditMode } from './lib/edit-mode'
export { QUERY_OPTIONS, parseCsvParam, serializeCsvParam, toDeckFilterIdentity } from './lib/filter-params'
export type { IdentityNameEntry } from './lib/filter-params'
export { trimDeckIdentity } from './lib/trim-deck-identity'
export { BOARD_SLOT_COUNT, adaptBoardIdentity, buildBoardSlots, buildNoteLookups, topKeywords } from './lib/deck-detail-model'
export type { SinnerEgo } from './lib/deck-detail-model'
export { buildStripSkills, toEgoSlotItems } from './lib/strip-skills'
export { builderSectionId, builderSections, legacyTab } from './lib/builder-sections'
export type { BuilderSection, FormationTab } from './lib/builder-sections'
