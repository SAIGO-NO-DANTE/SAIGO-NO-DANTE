'use client'

import Image from 'next/image'
import { useLocale } from 'next-intl'
import { ArrowUpRight, Copy } from 'lucide-react'
import { Link } from '@/lib/i18n/navigation'
import { DEFAULT_AVATAR_URL } from '@/lib/constants/game'
import { getCommunityCopy } from '@/features/community/lib/copy'
import { ACHIEVEMENT_COPY, nextPointsBadge } from '@/features/community/lib/achievements'
import type { CommunityProfile } from '@/features/community/lib/rules'
import { FollowSummary } from '@/features/community/components/Follows'
import { showError, showSuccess } from '@/lib/toast'
import styles from '@/styles/components/CommunityProfile.module.css'

const STATS = ['deck', 'plan', 'like', 'contribution'] as const

type Props = {
  data: CommunityProfile
  /** My page: owner links, and the summary shrinks to one row on a phone (`ProfileMore` carries the rest). */
  mine?: boolean
  onOpenFollows?: (kind: 'following' | 'followers') => void
}

function About({ data: { profile }, mine, onOpenFollows }: Props) {
  const locale = useLocale()
  const t = getCommunityCopy(locale)
  async function share() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/${locale}/users/${profile.id}`)
      showSuccess(t.copied)
    } catch {
      showError(t.saveError)
    }
  }
  return (
    <>
      <p className={styles.bio} data-empty={!profile.bio || undefined}>{profile.bio || t.noBio}</p>
      <FollowSummary id={profile.id} onOpen={onOpenFollows} />
      {mine && <div className={styles.links}>
        {profile.public_profile ? (
          <>
            <Link href={`/users/${profile.id}`} className={styles.ghost}>{t.view}<ArrowUpRight aria-hidden="true" /></Link>
            <button type="button" className={`${styles.ghost} ${styles.icon}`} onClick={share} aria-label={t.share} title={t.share}><Copy aria-hidden="true" /></button>
          </>
        ) : (
          <span className={styles.ghost} aria-disabled="true">{t.private}</span>
        )}
      </div>}
    </>
  )
}

function Figures({ data: { stats } }: Props) {
  const locale = useLocale()
  const t = getCommunityCopy(locale)
  const badgeCopy = ACHIEVEMENT_COPY[locale === 'en' || locale === 'ja' ? locale : 'ko']
  const next = nextPointsBadge(stats.points)
  return (
    <>
      {next && <div className={styles.meter} aria-hidden="true"><span style={{ transform: `scaleX(${next.ratio})` }} /></div>}
      <p className={styles.next}>{next ? badgeCopy.nextBadge.replace('{remaining}', next.remaining.toLocaleString(locale)) : badgeCopy.allBadges}</p>
      <dl className={styles.stats}>
        {STATS.map(key => (
          <div key={key}>
            <dt>{t[key]}</dt>
            <dd>{stats[key].toLocaleString(locale)}</dd>
          </div>
        ))}
      </dl>
    </>
  )
}

/** The summary of my page and public profiles: identity, follows, activity score. No box; the rail's spacing sets it apart. */
export default function ProfileRail(props: Props) {
  const locale = useLocale()
  const t = getCommunityCopy(locale)
  const { profile, stats } = props.data
  return (
    <section className={styles.summary} data-testid="community-profile" data-compact={props.mine || undefined}>
      <div className={styles.who}>
        <Image src={profile.avatar_url || DEFAULT_AVATAR_URL} alt="" width={56} height={56} className={styles.avatar} />
        <div className="min-w-0">
          <h1 className={styles.name}>{profile.username || t.anonymous}</h1>
          <p className={styles.joined}>{t.joined} {new Date(profile.created_at).toLocaleDateString(locale, { year: 'numeric', month: 'short' })}</p>
        </div>
      </div>
      <div className={styles.about}><About {...props} /></div>
      <div className={styles.tally}>
        <p className={styles.scoreLabel}>{t.points}</p>
        <strong className={styles.points} data-testid="activity-points">{stats.points.toLocaleString(locale)}</strong>
        <div className={styles.figures}><Figures {...props} /></div>
      </div>
    </section>
  )
}

/** On a phone my page keeps only avatar, name and points in the rail; this carries the rest at the top of the badges tab. */
export function ProfileMore(props: Props) {
  return (
    <div className={styles.more}>
      <About {...props} />
      <Figures {...props} />
    </div>
  )
}
