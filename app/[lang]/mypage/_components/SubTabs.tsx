'use client'

import styles from '@/styles/components/CommunityProfile.module.css'

/** Underline switch between two lists of one tab (mine / saved); pressed buttons, the selected one gets the gold underline. */
export default function SubTabs<Key extends string>({ label, options, value, onChange }: {
  label: string
  options: { key: Key; label: string; count: number | string }[]
  value: Key
  onChange: (key: Key) => void
}) {
  return (
    <div className={styles.sub} role="group" aria-label={label}>
      {options.map(option => (
        <button key={option.key} type="button" aria-pressed={value === option.key} onClick={() => onChange(option.key)}>
          {option.label}<b>{option.count}</b>
        </button>
      ))}
    </div>
  )
}
