'use client'

import { useDeferredValue, useMemo, useState } from 'react'
import Image from 'next/image'
import { parseAsString, parseAsStringLiteral, useQueryStates } from 'nuqs'
import { useLocale, useTranslations } from 'next-intl'
import { Hourglass, RotateCw } from 'lucide-react'
import IdentityFrameCard from '@/components/cards/IdentityFrameCard'
import IntentLink from '@/components/ui/IntentLink'
import SearchBox from '@/components/ui/SearchBox'
import { nameGroup } from '@/components/ui/SearchRows'
import EgoDisplayCard from '@/components/cards/EgoDisplayCard'
import { useMotionCatalog } from '@/features/motion/hooks/useMotionCatalog'
import { isMotionEgo, toMotionParam, type MotionEgo, type MotionIdentity } from '@/features/motion/lib/catalog'
import { motionIndex, motionMatches, motionRows, type MotionTarget } from '@/features/motion/lib/motion-suggestions'
import { QUERY_OPTIONS } from '@/lib/constants/query-options'
import { useRouter } from '@/lib/i18n/navigation'
import type { SupportedLang } from '@/lib/i18n/types'
import { search as findHits, type Hit } from '@/lib/search/engine'
import { sinnerName } from '@/lib/search/sinner-names'
import { getSinnerLogoUrl } from '@/lib/utils/images'
import { MotionBrowserSkeleton } from './SkillMotionSkeleton'

const TABS = ['identity', 'ego'] as const
const QUERY = { sinner: parseAsString, tab: parseAsStringLiteral(TABS).withDefault('identity') }
const focusRing = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gold-light)]'
const grid = 'grid grid-cols-[repeat(auto-fill,minmax(7.5rem,1fr))] gap-x-3 gap-y-4'

const motionWatchHref = (skill: string) => `/motion/skills/watch?skill=${skill}`

function IdentityCell({ sinnerId, identity, skill }: { sinnerId: string; identity: MotionIdentity; skill?: MotionIdentity['skills'][number] }) {
  const t = useTranslations('motionPage')
  const first = skill ?? identity.skills[0]
  return (
    <li>
      <IntentLink href={motionWatchHref(first ? toMotionParam(first.key) : identity.slug)} className={`relative block rounded-md transition-transform duration-150 active:scale-[0.98] motion-reduce:transition-none ${focusRing}`}>
        <IdentityFrameCard identity={{ sinner_id: sinnerId, rarity: identity.rarity ?? 3, game_id: identity.gameId, folder_name: identity.folderName }} name={identity.label} sizes="12rem" />
        {identity.pending && <span className="absolute right-1.5 top-1.5 grid h-7 w-7 place-items-center rounded-full bg-[rgba(5,4,3,0.8)] text-[var(--gold-light)]"><Hourglass className="h-4 w-4" role="img" aria-label={t('pendingTitle')} /></span>}
      </IntentLink>
      {skill && <p className="mt-1.5 truncate text-[0.8125rem] text-[var(--text-secondary)]">{skill.title}</p>}
    </li>
  )
}

function EgoCell({ sinnerId, ego, skill }: { sinnerId: string; ego: MotionEgo; skill?: MotionEgo['skills'][number] }) {
  const lang = useLocale() as SupportedLang
  const first = skill ?? ego.skills[0]
  return (
    <li>
      <EgoDisplayCard ego={{ grade: ego.grade, image_url: ego.image, sin_affinity: ego.sin }} name={ego.label} sinnerId={sinnerId} lang={lang} href={motionWatchHref(toMotionParam(first.key))} />
      {skill && <p className="mt-1.5 truncate text-[0.8125rem] text-[var(--text-secondary)]">{skill.title}</p>}
    </li>
  )
}

function Tab({ active, label, count, onClick }: { active: boolean; label: string; count: number; onClick: () => void }) {
  return (
    <button type="button" role="tab" aria-selected={active} onClick={onClick} className={`-mb-px border-b-2 px-1 pb-2 font-[family-name:var(--font-heading)] text-[1.0625rem] transition-colors duration-150 ${active ? 'border-[var(--gold)] text-[var(--gold-light)]' : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'} ${focusRing}`}>
      {label}<span className="ml-1.5 font-[family-name:var(--font-title)] text-[0.875rem] tabular-nums text-[var(--text-tertiary)]">{count}</span>
    </button>
  )
}

/** Where a card leads: the skill it shows, else the owner's first (a motion-less new identity leads to its slug). */
function cardHref({ owner, skill }: MotionTarget) {
  const first = skill ?? owner.skills[0]
  return motionWatchHref(first ? toMotionParam(first.key) : (owner as MotionIdentity).slug)
}

const matchCell = ({ sinnerId, owner, skill }: MotionTarget) => isMotionEgo(owner)
  ? <EgoCell key={`e${owner.egoId}`} sinnerId={sinnerId} ego={owner} skill={skill} />
  : <IdentityCell key={owner.slug} sinnerId={sinnerId} identity={owner} skill={skill} />

/** The picking page: the twelve sinners, identities or E.G.O as the site's cards, and a search over all of them. A card opens the watching page. */
export default function MotionBrowser() {
  const t = useTranslations('motionPage')
  const tSinner = useTranslations('sinner')
  const lang = useLocale() as SupportedLang
  const router = useRouter()
  const { sinners, error, retry } = useMotionCatalog()
  const [query, setQuery] = useQueryStates(QUERY, QUERY_OPTIONS)
  const [search, setSearch] = useState('')
  const needle = useDeferredValue(search.trim())
  const sinner = sinners?.find(s => s.id === query.sinner) ?? sinners?.[0]
  // A sinner's cards, once shown, stay (hidden) while another is: going back shows them at once, their art already drawn.
  const [seen, setSeen] = useState<readonly string[]>([])
  if (sinner && !seen.includes(sinner.id)) setSeen([...seen, sinner.id])
  // The search covers every sinner: the best match first, a skill's card shows the skill.
  const searching = needle !== ''
  const index = useMemo(() => (searching && sinners ? motionIndex(sinners, id => sinnerName(id, lang)) : null), [searching, sinners, lang])
  const hits = useMemo(() => (index ? findHits(index.entries, needle) : null), [index, needle])
  const matches = useMemo(() => (index && hits ? motionMatches(index, hits).map(matchCell) : null), [index, hits])
  const suggestions = useMemo(() => {
    if (!index || !hits) return []
    const open = (hit: Hit) => router.push(cardHref(index.targets.get(hit.entry.href)!))
    const rows = motionRows(hits)
    return [nameGroup(t('identities'), rows.identities, open), nameGroup(t('egos'), rows.egos, open), nameGroup(t('skills'), rows.skills, open)].filter(group => group.rows.length > 0)
  }, [index, hits, router, t])

  if (error && !sinners) {
    return (
      <div role="alert" className="flex flex-col items-center gap-3 rounded-lg border border-[#2e2417] bg-[var(--bg-panel)] px-6 py-16 text-center">
        <p className="text-[0.9375rem] text-[var(--text-primary)]">{t('listError')}</p>
        <button type="button" onClick={() => void retry()} className="inline-flex h-10 items-center gap-2 rounded-md border border-[var(--gold-dim)] bg-[#2a1f0c] px-4 text-[0.875rem] font-semibold text-[var(--gold-light)] hover:bg-[#35270e]">
          <RotateCw className="h-4 w-4" aria-hidden="true" />{t('retry')}
        </button>
      </div>
    )
  }
  if (!sinners || !sinner) return <MotionBrowserSkeleton />

  return (
    <div className="flex flex-col gap-5">
      <div role="tablist" aria-label={t('sinners')} className="grid max-w-[46rem] grid-cols-6 gap-1 sm:grid-cols-12">
        {sinners.map(s => {
          const active = s.id === sinner.id
          return (
            <button key={s.id} type="button" role="tab" aria-selected={active} title={tSinner(s.id)} aria-label={tSinner(s.id)} onClick={() => { setSearch(''); void setQuery({ sinner: s.id }) }}
              className={`group grid aspect-square place-items-center rounded-md transition-[background-color,transform] duration-150 active:scale-95 motion-reduce:transition-none ${active ? 'bg-[rgba(200,144,10,0.12)]' : 'hover:bg-[rgba(232,220,200,0.05)]'} ${focusRing}`}>
              <Image src={getSinnerLogoUrl(s.id)} alt="" width={48} height={48} className={`h-[68%] w-[68%] object-contain transition-opacity duration-150 ${active ? 'opacity-100' : 'opacity-55 group-hover:opacity-95'}`} />
            </button>
          )
        })}
      </div>

      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3 border-b border-[#2e2417]">
        <div role="tablist" aria-label={t('title')} className="flex gap-6">
          <Tab active={query.tab === 'identity'} label={t('identities')} count={sinner.identities.length} onClick={() => void setQuery({ tab: 'identity' })} />
          <Tab active={query.tab === 'ego'} label={t('egos')} count={sinner.egos.length} onClick={() => void setQuery({ tab: 'ego' })} />
        </div>
        <SearchBox value={search} onChange={setSearch} label={t('search')} clearLabel={t('clearSearch')} groups={suggestions} className="mb-2 w-full sm:w-72" />
      </div>

      {matches ? (
        matches.length ? <ul className={grid} aria-label={t('search')}>{matches}</ul>
          : <p className="py-16 text-center text-[0.9375rem] text-[var(--text-secondary)]">{t('noResults')}</p>
      ) : sinners.filter(s => seen.includes(s.id)).map(s => (
        <div key={s.id} hidden={s.id !== sinner.id}>
          <ul hidden={query.tab !== 'identity'} className={grid} aria-label={tSinner(s.id)}>{s.identities.map(identity => <IdentityCell key={identity.slug} sinnerId={s.id} identity={identity} />)}</ul>
          <ul hidden={query.tab !== 'ego'} className={grid} aria-label={tSinner(s.id)}>{s.egos.map(ego => <EgoCell key={ego.egoId} sinnerId={s.id} ego={ego} />)}</ul>
        </div>
      ))}
    </div>
  )
}
