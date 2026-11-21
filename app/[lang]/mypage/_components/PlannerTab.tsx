'use client'

import { useState } from 'react'
import { useLocale } from 'next-intl'
import useSWR from 'swr'
import { Plus } from 'lucide-react'
import { Link } from '@/lib/i18n/navigation'
import PlanCard, { type PlanSummary } from '@/components/cards/PlanCard'
import { buttonClass } from '@/components/ui/Button'
import Skeleton from '@/components/ui/Skeleton'
import { getCommunityCopy } from '@/features/community'
import SubTabs from '@/app/[lang]/mypage/_components/SubTabs'
import styles from '@/styles/components/CommunityProfile.module.css'
import { NoteCardPreview } from '@/features/notes/components/NoteChips'

export default function PlannerTab() {
  const t = getCommunityCopy(useLocale())
  const mine = useSWR<{ plans: PlanSummary[] }>('/api/planner?userId=me&limit=50')
  const liked = useSWR<{ plans: PlanSummary[] }>('/api/planner?votedBy=me&limit=50')
  const [subTab, setSubTab] = useState<'mine' | 'liked'>('mine')
  const myPlans = mine.data?.plans ?? []
  const likedPlans = liked.data?.plans ?? []
  const loading = mine.isLoading || liked.isLoading
  const list = subTab === 'mine' ? myPlans : likedPlans
  return (
    <>
      <div className={styles.tabsHead}>
        <SubTabs label={t.planner} value={subTab} onChange={setSubTab}
          options={[{ key: 'mine', label: t.myPlans, count: loading ? '' : myPlans.length }, { key: 'liked', label: t.likedPlans, count: loading ? '' : likedPlans.length }]} />
        <Link href="/planner" className={buttonClass({ variant: 'primary' })}><Plus size={17} aria-hidden="true" />{t.newPlan}</Link>
      </div>
      {loading ? (
        <div className={styles.list}>{Array.from({ length: 3 }, (_, i) => <Skeleton key={i} line className="h-48 rounded-lg" />)}</div>
      ) : list.length === 0 ? (
        <div className={styles.empty}>
          <p>{subTab === 'mine' ? t.emptyPlans : t.emptyLiked}</p>
          <Link href={subTab === 'mine' ? '/planner' : '/planner/community'} className={buttonClass({ variant: subTab === 'mine' ? 'primary' : 'secondary' })}>
            {subTab === 'mine' ? t.firstPlan : t.browsePlans}
          </Link>
        </div>
      ) : (
        <ul className={styles.list}>{list.map(plan => <li key={plan.id} className={styles.item}><PlanCard plan={plan} NotePreview={NoteCardPreview} /></li>)}</ul>
      )}
    </>
  )
}
