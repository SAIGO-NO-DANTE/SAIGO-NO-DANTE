"use client";
import { useState } from "react";
import Image from "next/image";
import { useLocale } from "next-intl";
import { useSearchParams } from "next/navigation";
import { showSuccess, showError } from "@/lib/toast";
import AvatarPicker from "@/features/account/components/AvatarPicker";
import { DEFAULT_AVATAR_URL } from "@/lib/constants/game";
import { getCommunityCopy } from "@/features/community";
import { LogOut, Pencil } from "lucide-react";
import type { CommunityProfile } from "@/features/community";
import ProfileSettings from "@/features/community/components/ProfileSettings";
import Button from "@/components/ui/Button";
import ConfirmModal from "@/components/ui/ConfirmModal";
import { useAccountActions } from "@/app/[lang]/mypage/_components/useAccountActions";
import styles from "@/styles/components/CommunityProfile.module.css";

type Profile = {
  username: string | null;
  bio: string | null;
  avatar_url: string | null;
};
export default function ProfileTab({
  profile,
  email,
  settings,
  onProfileUpdate,
  onSettingsSaved,
}: {
  profile: Profile;
  email: string;
  settings?: CommunityProfile["settings"];
  onProfileUpdate: () => Promise<void>;
  onSettingsSaved: () => Promise<void>;
}) {
  const locale = useLocale(),
    t = getCommunityCopy(locale);
  const { logout, removeAccount: deleteNow } = useAccountActions();
  // Arriving from the legal update modal ("decline and delete"): open straight at the withdrawal confirmation.
  const askWithdraw = useSearchParams().get("withdraw") === "1";
  const [name, setName] = useState(profile.username || ""),
    [bio, setBio] = useState(profile.bio || "");
  // Deleting has its own flag: a profile save in flight must not lock the confirm dialog.
  const [deleting, setDeleting] = useState(false);
  const [busy, setBusy] = useState(false),
    [avatarOpen, setAvatarOpen] = useState(false),
    [withdraw, setWithdraw] = useState(askWithdraw);
  async function patch(url: string, data: unknown) {
    const r = await fetch(url, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!r.ok) throw Error();
  }
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await patch("/api/profile", { username: name, bio });
      window.dispatchEvent(new CustomEvent("username-changed", { detail: name.trim() }));
      await onProfileUpdate();
      showSuccess(t.saved);
    } catch {
      showError(t.saveError);
    } finally {
      setBusy(false);
    }
  }
  async function avatar(url: string) {
    setBusy(true);
    try {
      await patch("/api/profile", { avatar_url: url });
      await onProfileUpdate();
      setAvatarOpen(false);
      window.dispatchEvent(new CustomEvent("avatar-changed", { detail: url }));
      showSuccess(t.saved);
    } catch {
      showError(t.saveError);
    } finally {
      setBusy(false);
    }
  }
  async function removeAccount() {
    setDeleting(true);
    try {
      await deleteNow();
    } catch {
      showError(t.saveError);
      setWithdraw(false);
      setDeleting(false);
    }
  }
  return (
    <div className={styles.settings}>
      <section aria-labelledby="settings-profile" className={styles.group}>
        <h3 id="settings-profile" className={styles.groupTitle}>{t.profileSection}</h3>
        <div className="mb-3 flex items-center gap-4">
          <Image
            src={profile.avatar_url || DEFAULT_AVATAR_URL}
            alt=""
            width={56}
            height={56}
            className="h-14 w-14 rounded-full border border-[var(--border)] object-cover"
          />
          <button
            type="button"
            className="community-link"
            onClick={() => setAvatarOpen(true)}
            disabled={busy}
          >
            <Pencil size={15} />
            {t.editAvatar}
          </button>
        </div>
        <form onSubmit={save} className={styles.form}>
          <label>
            {t.name}
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              minLength={1}
              maxLength={20}
              required
              autoComplete="nickname"
            />
          </label>
          <label>
            {t.bio}
            <textarea
              aria-label={t.bio}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              maxLength={300}
              rows={4}
            />
            <span className="community-muted text-right">{bio.length} / 300</span>
          </label>
          <Button type="submit" variant="primary" className="justify-self-end" loading={busy}>
            {busy ? t.saving : t.save}
          </Button>
        </form>
      </section>
      {settings && <ProfileSettings initial={settings} onSaved={onSettingsSaved} />}
      <section aria-labelledby="settings-account" className={styles.group}>
        <h3 id="settings-account" className={styles.groupTitle}>{t.account}</h3>
        <div className="flex flex-wrap gap-x-3 gap-y-1 pb-2 text-[0.875rem] [overflow-wrap:anywhere]">
          <span className="community-muted">{t.accountEmail}</span>
          <span>{email}</span>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button icon={LogOut} onClick={logout}>
            {t.logout}
          </Button>
          <Button variant="ghost" className="text-[var(--error-text)]!" onClick={() => setWithdraw(true)}>
            {t.withdraw}
          </Button>
        </div>
      </section>
      <ConfirmModal
        open={withdraw}
        variant="danger"
        title={t.withdraw}
        message={t.withdrawWarning}
        confirmLabel={t.confirm}
        cancelLabel={t.cancel}
        loading={deleting}
        onConfirm={removeAccount}
        onCancel={() => setWithdraw(false)}
      />
      <AvatarPicker
        open={avatarOpen}
        currentUrl={profile.avatar_url}
        onSelect={avatar}
        onReset={() => avatar(DEFAULT_AVATAR_URL)}
        onClose={() => setAvatarOpen(false)}
      />
    </div>
  );
}
