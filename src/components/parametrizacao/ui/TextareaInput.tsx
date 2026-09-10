'use client'

import type { TextareaHTMLAttributes } from 'react'

type Props = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'className'>

export function TextareaInput(props: Props) {
  return <textarea {...props} className="creator-input min-h-28 rounded-2xl border px-4 py-3 font-bold" />
}
