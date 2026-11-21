"use client";
import { useMemo } from "react";
import useSWR from "swr";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/lib/i18n/navigation";
import { Layers, Map as MapIcon } from "lucide-react";
import ProfileRail from "./ProfileRail";
import AchievementGrid from "./AchievementGrid";
import DeckCard from "@/components/cards/DeckCard";
import PlanCard from "@/components/cards/PlanCard";
import Skeleton from "@/components/ui/Skeleton";
import { getCommunityCopy } from "@/features/community/lib/copy";
import { achievementProgress } from "@/features/community/lib/achievements";
import { useHtmlFlag } from "@/hooks/useHtmlFlag";
import type { CommunityProfile } from "@/features/community/lib/rules";
import { fetchJson } from "@/lib/utils/http";
import "@/styles/components/community.css";
import styles from "@/styles/components/CommunityProfile.module.css";
import { NoteCardPreview } from '@/features/notes/components/NoteChips'

const fetcher = (url: string) => fetchJson<CommunityProfile>(url);

/** Someone's profile: the same rail as my page, then the badges they earned and their latest decks and plans. */
export default function PublicProfile({ id }: { id: string }) {
  const locale = useLocale(),
    t = getCommunityCopy(locale),
    tSeries = useTranslations("series");
  useHtmlFlag("with-compact-footer");
  const { data, error, mutate } = useSWR(`/api/community/profiles/${id}`, fetcher, { shouldRetryOnError: false });
  // Hidden (easter egg) badges appear once found; unfound ones stay secret.
  const earned = useMemo(() => (data ? achievementProgress(data.stats, data.eggs ?? []).filter((badge) => badge.earned) : []), [data]);

  if (error)
    return (
      <div className={`${styles.page} ${styles.withNav}`}>
        <div className={`${styles.empty} lg:col-span-2`} role="alert">
          <p>{error.status === 404 ? t.unavailable : t.error}</p>
          {error.status !== 404 && <button type="button" className={styles.ghost} onClick={() => void mutate()}>{t.retry}</button>}
        </div>
      </div>
    );
  if (!data)
    return (
      <div className={`${styles.page} ${styles.withNav}`} role="status" aria-busy="true">
        <div className={`${styles.rail} sticky-under-nav`}>
          <Skeleton className="h-14 rounded-lg" />
          <Skeleton className="h-24 rounded-lg" />
          <Skeleton className="h-32 rounded-lg" />
        </div>
        <div className={styles.main}>
          <div className={styles.head}><Skeleton className="h-6 w-28" /></div>
          <Skeleton line className="h-40 rounded-xl" />
        </div>
      </div>
    );
  return (
    <div className={`${styles.page} ${styles.withNav}`}>
      <div className={`${styles.rail} sticky-under-nav`}>
        <ProfileRail data={data} />
      </div>
      <div className={styles.main}>
        {earned.length > 0 && (
          <section className={styles.section}>
            <div className={styles.head}>
              <h2 className={styles.title}>{t.badges}<span className={styles.titleCount}>{earned.length}</span></h2>
            </div>
            <AchievementGrid items={earned} bare />
          </section>
        )}
        {!!data.series?.length && (
          <section className={styles.section}>
            <div className={styles.head}>
              <h2 className={styles.title}>{tSeries("title")}<span className={styles.titleCount}>{data.series.length}</span></h2>
            </div>
            <ul className={styles.list}>
              {data.series.map((item) => (
                <li key={item.id} className={styles.item}>
                  <Link href={`/series/${item.id}`} className="flex items-center justify-between gap-3 rounded-lg border border-[var(--border)] bg-[var(--bg-panel)] px-4 py-3 transition-colors hover:border-[var(--gold-dim)]">
                    <span className="min-w-0 truncate font-[family-name:var(--font-heading)] text-[1rem] text-[var(--text-primary)]">{item.title}</span>
                    <span className="shrink-0 font-[family-name:var(--font-title)] text-[1.125rem] text-[var(--gold-light)]">{item.count}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
        <section className={styles.section}>
          <div className={styles.head}>
            <h2 className={styles.title}>{t.recentDecks}<span className={styles.titleCount}>{data.decks.length}</span></h2>
          </div>
          {data.decks.length ? (
            <ul className={styles.list}>{data.decks.map((deck) => <li key={deck.id} className={styles.item}><DeckCard deck={deck} NotePreview={NoteCardPreview} /></li>)}</ul>
          ) : (
            <div className={styles.empty}><Layers aria-hidden="true" /><p>{t.noDecks}</p></div>
          )}
        </section>
        <section className={styles.section}>
          <div className={styles.head}>
            <h2 className={styles.title}>{t.recentPlans}<span className={styles.titleCount}>{data.plans.length}</span></h2>
          </div>
          {data.plans.length ? (
            <ul className={styles.list}>{data.plans.map((plan) => <li key={plan.id} className={styles.item}><PlanCard plan={plan} NotePreview={NoteCardPreview} /></li>)}</ul>
          ) : (
            <div className={styles.empty}><MapIcon aria-hidden="true" /><p>{t.noPlans}</p></div>
          )}
        </section>
      </div>
    </div>
  );
}
