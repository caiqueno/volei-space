'use client'

import type { ButtonHTMLAttributes, ReactNode } from 'react'

type TrackProps = {
  label: string
  className?: string
}

export function LoadingTrack({ label, className }: TrackProps) {
  return (
    <div className={['action-bar is-loading', className].filter(Boolean).join(' ')} role="status" aria-live="polite" aria-busy="true">
      <span className="action-bar-fill" />
      <span className="action-bar-label">{label}</span>
    </div>
  )
}

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  loading?: boolean
  loadingLabel: string
  children: ReactNode
}

export function ActionBar({ loading = false, loadingLabel, children, className, type = 'button', ...rest }: Props) {
  if (loading) return <LoadingTrack label={loadingLabel} className={className} />

  return (
    <button type={type} className={className} {...rest}>
      {children}
    </button>
  )
}
