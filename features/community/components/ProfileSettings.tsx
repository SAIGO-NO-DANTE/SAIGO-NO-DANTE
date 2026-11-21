'use client'
import { useId, useState } from 'react'
import { useLocale } from 'next-intl'
import Switch from '@/components/ui/Switch'
import { getCommunityCopy } from '@/features/community/lib/copy'
import type { CommunitySettings } from '@/features/community/lib/rules'
import { showError, showSuccess } from '@/lib/toast'
import { usePushSubscription } from '@/hooks/usePushSubscription'
import styles from '@/styles/components/CommunityProfile.module.css'

type Key = keyof CommunitySettings
const GROUPS: { title: 'visibilityGroup' | 'notifications'; rows: { key: Key; label: 'visibility' | 'publicFollowing' | 'publicFollowers' | 'notifyComments' | 'notifyFollows' | 'notifyPosts' }[] }[] = [
  { title: 'visibilityGroup', rows: [{ key: 'public_profile', label: 'visibility' }, { key: 'public_following', label: 'publicFollowing' }, { key: 'public_followers', label: 'publicFollowers' }] },
  { title: 'notifications', rows: [{ key: 'notify_comments', label: 'notifyComments' }, { key: 'notify_follows', label: 'notifyFollows' }, { key: 'notify_posts', label: 'notifyPosts' }] },
]

/**
 * The owner's visibility and notification switches. A switch changes at once and is saved; if saving fails it flips
 * back and says so. The list switches wait while the whole profile is private.
 */
export default function ProfileSettings({ initial, onSaved }: { initial: CommunitySettings; onSaved: () => Promise<void> }) {
  const locale = useLocale()
  const t = getCommunityCopy(locale)
  const id = useId()
  const push = usePushSubscription(locale === 'en' || locale === 'ja' ? locale : 'ko')
  async function togglePush(on: boolean) {
    if (!on) return push.disable()
    if (await push.enable()) showSuccess(t.pushOn)
    else showError(t.pushError)
  }
  const [values, setValues] = useState(initial)
  const [saving, setSaving] = useState<Key | null>(null)
  async function change(key: Key, value: boolean) {
    setValues(current => ({ ...current, [key]: value }))
    setSaving(key)
    try {
      const response = await fetch('/api/community/me', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ [key]: value }) })
      if (!response.ok) throw Error()
      await onSaved()
    } catch {
      setValues(current => ({ ...current, [key]: !value }))
      showError(t.saveError)
    } finally {
      setSaving(null)
    }
  }
  return (
    <>
      {GROUPS.map(group => (
        <section key={group.title} aria-labelledby={`${id}-${group.title}`} className={styles.group}>
          <h3 id={`${id}-${group.title}`} className={styles.groupTitle}>{t[group.title]}</h3>
          {group.title === 'notifications' && (
            <label htmlFor={`${id}-push`} className={`${styles.row} cursor-pointer`}>
              <span>{t.pushRow}</span>
              {push.state === 'denied' || push.state === 'unsupported'
                ? <span className="text-[var(--text-sm)] text-[var(--text-tertiary)]">{push.state === 'denied' ? t.pushBlocked : t.pushUnsupported}</span>
                : <Switch id={`${id}-push`} checked={push.state === 'on'} disabled={push.state === 'loading' || push.state === 'busy'} onChange={on => void togglePush(on)} />}
            </label>
          )}
          {group.rows.map(({ key, label }) => {
            const locked = (key === 'public_following' || key === 'public_followers') && !values.public_profile
            return (
              <label key={key} htmlFor={`${id}-${key}`}
                className={`${styles.row} transition-opacity duration-200 ${locked ? 'cursor-not-allowed opacity-45' : 'cursor-pointer'}`}>
                <span>{t[label]}</span>
                <Switch id={`${id}-${key}`} checked={values[key]} disabled={locked || saving === key} onChange={value => void change(key, value)} />
              </label>
            )
          })}
        </section>
      ))}
    </>
  )
}
