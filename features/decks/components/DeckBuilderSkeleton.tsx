import Skeleton, { SkeletonLine, SkeletonPage } from '@/components/ui/Skeleton'
import { FormationBoardSkeleton } from '@/components/ui/DetailPageSkeleton'
import './deck-workspace.css'

/** 덱 작성/수정: 실제 페이지의 deck-workspace·deck-section 클래스를 그대로 써서 뒤로가기 줄, 제목·콘텐츠 유형 줄, 구역 이동 줄, 편성 구역(안쪽 탭과 편성 수 → 주요 키워드 → 보드 도구 줄 → 6×2 보드)이 같은 자리에 온다. */
export default function DeckBuilderSkeleton() {
  return <SkeletonPage className="min-h-[100dvh] pb-20 pt-24 sm:pt-28" style={{ background: 'var(--bg-deep)' }}>
    <div className="deck-workspace mx-auto max-w-6xl px-3 sm:px-6">
      <header className="deck-workspace-header">
        <div className="deck-workspace-top">
          <div className="min-w-0"><div className="deck-workspace-back flex items-center px-1"><SkeletonLine w="5rem" h="0.9375rem" /></div></div>
          <div className="deck-workspace-actions">
            <Skeleton line className="h-[var(--deck-touch)] w-[5.1rem] sm:w-[8.8rem]" />
            <Skeleton line className="h-[var(--deck-touch)] w-[var(--deck-touch)] sm:w-[7rem]" />
            <Skeleton className="h-[var(--deck-touch)] w-[4.9rem]" style={{ background: 'rgba(200,144,10,0.35)' }} />
          </div>
        </div>
        <div className="deck-workspace-guest h-14 sm:h-8"><SkeletonLine w="14rem" h="0.8125rem" /></div>
        <div className="deck-workspace-fields">
          <div className="deck-workspace-fields__title"><div className="flex h-[1.3rem] items-center"><SkeletonLine w="3.5rem" h="0.75rem" /></div><Skeleton line className="h-12" /></div>
          <div className="deck-workspace-fields__type"><div className="mb-1.5 flex h-[1.3rem] items-center"><SkeletonLine w="6rem" h="0.75rem" /></div><Skeleton line className="h-12" /></div>
        </div>
      </header>
      <div className="deck-section-nav">
        <div className="flex gap-1">{['3rem', '3rem', '4.5rem'].map((w, i) => <div key={i} className="flex h-12 items-center px-3" style={{ paddingLeft: i === 0 ? 0 : undefined }}><SkeletonLine w={w} h="0.9375rem" /></div>)}</div>
      </div>
      <div className="deck-section">
        <div className="deck-section__title flex items-center" style={{ height: '2.0625rem' }}><SkeletonLine w="3rem" h="1.375rem" /></div>
        <div className="deck-subtabs mb-6 flex items-center gap-1 border-b border-[var(--bg-card)]">
          {['3.5rem', '4rem', '5.5rem'].map((w, i) => <div key={i} className="flex h-[2.5rem] items-center px-4 max-sm:h-[var(--deck-touch)]" style={{ borderBottom: i === 0 ? '2px solid var(--gold)' : '2px solid transparent' }}><SkeletonLine w={w} h="0.9rem" /></div>)}
          <div className="ml-auto pr-2"><SkeletonLine w="3rem" h="0.875rem" /></div>
        </div>
        <div className="flex flex-wrap gap-1">{Array.from({ length: 10 }, (_, i) => <Skeleton key={i} line className="h-[2.25rem] w-20 shrink-0" />)}</div>
        <div className="mt-2 flex h-12 items-center justify-end"><SkeletonLine w="5.5rem" h="0.8125rem" /></div>
        <FormationBoardSkeleton className="mt-2" />
        <div className="mt-2 flex h-11 items-center justify-center rounded border border-[#5a4526]"><SkeletonLine w="6rem" h="0.9375rem" /></div>
      </div>
    </div>
  </SkeletonPage>
}
