"use client";
import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { useLocale } from "next-intl";
import { useRouter } from "@/lib/i18n/navigation";
import { useSearchParams } from "next/navigation";
import useSWR from "swr";
import { showSuccess, showError } from "@/lib/toast";
import { useHtmlFlag } from "@/hooks/useHtmlFlag";
import { claimGuestPosts, useGuestPosts } from "@/features/account/hooks/useGuestPosts";
import { getGuestCopy } from "@/features/account";
import MypageTabs, { RailSignOut, resolveMypageTab, type MypageTab } from "@/app/[lang]/mypage/_components/MypageTabs";
import ProfileRail, { ProfileMore } from "@/features/community/components/ProfileRail";
import ProfileTab from "@/app/[lang]/mypage/_components/ProfileTab";
import DecksTab from "@/app/[lang]/mypage/_components/DecksTab";
import PlannerTab from "@/app/[lang]/mypage/_components/PlannerTab";
import CollectionTab from "@/app/[lang]/mypage/_components/CollectionTab";
import { type DeckSummary } from "@/components/cards/DeckCard";
import AchievementGrid, { achievementProgress } from "@/features/community/components/AchievementGrid";
import { FollowList } from "@/features/community/components/Follows";
import Skeleton from "@/components/ui/Skeleton";
import { getCommunityCopy } from "@/features/community";
import { EASTER_EGGS, EGGS_KEY, readEggs, type EasterEgg } from "@/lib/easter-eggs";
import { writeJson } from "@/lib/utils/local-storage";
import BackLink from "@/components/navigation/BackLink";
import DanteLogo from "@/components/brand/DanteLogo";
import { ArrowLeft } from "lucide-react";
import type { CommunityProfile } from "@/features/community";
import "@/styles/components/community.css";
import styles from "@/styles/components/CommunityProfile.module.css";

type Profile = {
  username: string | null;
  collection_code: string | null;
  bio: string | null;
  avatar_url: string | null;
  created_at: string | null;
};
type ProfileData = {
  profile: Profile;
  decks: DeckSummary[];
  bookmarkedDecks: DeckSummary[];
  email: string;
  stats: { deckCount: number; planCount: number; bookmarkCount: number; totalVotesReceived: number };
};
async function fetcher(url: string) {
  const r = await fetch(url);
  if (!r.ok) throw Error();
  return r.json();
}

/** Same layout as the loaded page: summary and tab list in the rail (one row each on a phone), a titled panel on the right. */
export function MypageSkeleton() {
  return (
    <div className={styles.page} role="status" aria-busy="true">
      <div className={`${styles.rail} sticky-under-nav`}>
        <Skeleton className="h-10 w-40 rounded-lg" />
        <Skeleton className="h-10 rounded-lg lg:hidden" />
        <div className="hidden gap-3 lg:grid">
          <Skeleton className="h-14 rounded-lg" />
          <Skeleton className="h-24 rounded-lg" />
          <Skeleton className="h-32 rounded-lg" />
        </div>
        <Skeleton className="h-11 rounded-lg lg:hidden" />
        <div className="hidden gap-0.5 border-t border-[var(--border)] pt-3 lg:grid">
          {Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-11 rounded-lg" />)}
        </div>
      </div>
      <div className={styles.main}>
        <div className={styles.head}><Skeleton className="h-6 w-32" /></div>
        <Skeleton line className="h-[24rem] rounded-xl" />
      </div>
    </div>
  );
}

export default function MypageClient() {
  const { status } = useSession(),
    router = useRouter(),
    search = useSearchParams();
  const locale = useLocale();
  const t = getCommunityCopy(locale);
  const guestT = getGuestCopy(locale);
  const [followKind, setFollowKind] = useState<"following" | "followers">("following");
  const [activeTab, setActiveTab] = useState<MypageTab>("decks");
  const [eggs, setEggs] = useState<EasterEgg[]>([]);
  // A workspace like assist and support: no site navbar or footer; the rail's back link leads out.
  useHtmlFlag("with-mypage");
  useEffect(() => {
    setActiveTab(resolveMypageTab(search.get("tab"), localStorage.getItem("mypage-tab")));
  }, [search]);
  const { data, error, isLoading, mutate } = useSWR<ProfileData>(status === "authenticated" ? "/api/profile" : null, fetcher);
  const community = useSWR<CommunityProfile>(status === "authenticated" ? "/api/community/me" : null, fetcher);
  // Eggs found in this browser and on the account are merged both ways, so every browser shows the same badges.
  const accountEggs = community.data?.eggs;
  useEffect(() => {
    if (!accountEggs) return;
    const local = readEggs(localStorage);
    const missing = local.filter((egg) => !accountEggs.includes(egg));
    if (missing.length) void fetch("/api/profile/eggs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ eggs: missing }) }).catch(() => {});
    const merged = EASTER_EGGS.filter((egg) => local.includes(egg) || accountEggs.includes(egg));
    writeJson(EGGS_KEY, merged); // private mode: kept for this page only
    setEggs(merged);
  }, [accountEggs]);
  // Anonymous posts written in this browser before signing in can be moved to the account.
  const guest = useGuestPosts(status === "authenticated");
  const [claiming, setClaiming] = useState(false);
  const guestDecks = guest.posts.data?.decks.length ?? 0;
  const guestPlans = guest.posts.data?.plans.length ?? 0;
  async function claimGuest() {
    if (!guest.key) return;
    setClaiming(true);
    try {
      const moved = await claimGuestPosts(guest.key);
      guest.reloadKey();
      await Promise.all([mutate(), community.mutate()]);
      showSuccess(guestT.claimed(moved.decks, moved.plans));
    } catch {
      showError(guestT.claimFailed);
    } finally {
      setClaiming(false);
    }
  }
  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login");
  }, [status, router]);
  const badges = useMemo(() => (community.data ? achievementProgress(community.data.stats, eggs) : []), [community.data, eggs]);
  const earned = badges.filter((badge) => badge.earned).length;
  function openFollows(kind: "following" | "followers") {
    setFollowKind(kind);
    changeTab("follows");
  }
  function changeTab(tab: MypageTab) {
    setActiveTab(tab);
    localStorage.setItem("mypage-tab", tab);
    router.replace(`/mypage?tab=${tab}`, { scroll: false });
  }
  async function deleteDeck(id: string) {
    try {
      if (!(await fetch(`/api/decks/${id}`, { method: "DELETE" })).ok) throw Error();
      await Promise.all([mutate(), community.mutate()]);
      showSuccess(t.deleteSuccess);
    } catch {
      showError(t.saveError);
    }
  }
  async function removeBookmark(id: string) {
    try {
      if (!(await fetch(`/api/decks/${id}/bookmark`, { method: "POST" })).ok) throw Error();
      await mutate();
      showSuccess(t.bookmarkSuccess);
    } catch {
      showError(t.saveError);
    }
  }
  if (error || community.error)
    return (
      <div className={styles.page}>
        <div className={`${styles.empty} lg:col-span-2`} role="alert">
          <p>{t.error}</p>
          <button type="button" className={styles.ghost} onClick={() => { void mutate(); void community.mutate(); }}>{t.retry}</button>
        </div>
      </div>
    );
  if (status !== "authenticated" || isLoading || !data || !community.data) return <MypageSkeleton />;
  return (
    <div className={styles.page}>
      <div className={`${styles.rail} sticky-under-nav`}>
        <div className={styles.top}>
          <BackLink href="/" className={styles.back}><ArrowLeft aria-hidden="true" />{t.backToSite}</BackLink>
          <DanteLogo size="2rem" className="text-[var(--gold-light)]" />
          <RailSignOut />
        </div>
        <ProfileRail data={community.data} mine onOpenFollows={openFollows} />
        <MypageTabs activeTab={activeTab} onTabChange={changeTab}
          counts={{ badges: `${earned}/${badges.length}`, decks: data.stats.deckCount, planner: data.stats.planCount }} />
      </div>
      <div className={styles.main} role="tabpanel" id={`panel-${activeTab}`} aria-labelledby={`tab-${activeTab}`}>
        {guestDecks + guestPlans > 0 && (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-lg border border-[#5a4526] bg-[#17120c] px-4 py-2.5">
            <p className="m-0 min-w-0 text-[0.9375rem] text-[var(--text-primary)]">{guestT.notice(guestDecks, guestPlans)}</p>
            <button type="button" className={styles.primary} onClick={claimGuest} disabled={claiming}>{claiming ? guestT.claiming : guestT.claim}</button>
          </div>
        )}
        {activeTab === "badges" && (
          <>
            <ProfileMore data={community.data} mine onOpenFollows={openFollows} />
            <div className={styles.head}>
              <h2 className={styles.title}>{t.badges}<span className={styles.titleCount}>{earned}/{badges.length}</span></h2>
            </div>
            <AchievementGrid items={badges} />
          </>
        )}
        {activeTab === "decks" && <DecksTab decks={data.decks} bookmarkedDecks={data.bookmarkedDecks} onDeleteDeck={deleteDeck} onRemoveBookmark={removeBookmark} />}
        {activeTab === "planner" && <PlannerTab />}
        {activeTab === "collection" && <CollectionTab savedCode={data.profile.collection_code} />}
        {activeTab === "follows" && (
          <>
            <div className={styles.head}><h2 className={styles.title}>{t.follows}</h2></div>
            <div className={styles.panel}><FollowList key={followKind} id={community.data.profile.id} initialKind={followKind} /></div>
          </>
        )}
        {activeTab === "profile" && (
          <>
            <div className={styles.head}><h2 className={styles.title}>{t.profile}</h2></div>
            <ProfileTab profile={data.profile} email={data.email} settings={community.data.settings}
              onProfileUpdate={async () => { await Promise.all([mutate(), community.mutate()]); }} onSettingsSaved={async () => { await community.mutate(); }} />
          </>
        )}
      </div>
    </div>
  );
}
