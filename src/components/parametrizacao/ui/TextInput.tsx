'use client'

import type { InputHTMLAttributes } from 'react'

type Props = InputHTMLAttributes<HTMLInputElement>

export function TextInput({ className, ...props }: Props) {
  return <input {...props} className={`creator-input rounded-2xl border px-4 py-3 font-bold ${className ?? ''}`} />
}
