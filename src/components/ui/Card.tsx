import { HTMLAttributes } from 'react'

type Props = HTMLAttributes<HTMLDivElement> & { children: React.ReactNode }

export function Card({ children, className = '', ...props }: Props) {
  return (
    <div className={`bg-white rounded-xl shadow-sm border border-luva-border p-4 ${className}`} {...props}>
      {children}
    </div>
  )
}
