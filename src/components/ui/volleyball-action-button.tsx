'use client'

import Link from 'next/link'
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, CSSProperties } from 'react'

interface VolleyballActionButtonBaseProps {
  /** Linha principal, exibida em destaque dentro da bola. */
  title: string
  /** Linha secundária, opcional. */
  subtitle?: string
  /** Tamanho em px (largura = altura). Sem isso, usa a faixa responsiva padrão (148-190px). */
  size?: number
  className?: string
  'aria-label'?: string
}

type VolleyballActionButtonProps = VolleyballActionButtonBaseProps &
  (
    | ({ href: string } & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'title' | 'className' | 'href'>)
    | ({ href?: undefined } & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'title' | 'className'>)
  )

/**
 * Botão circular com a bola do logo como própria superfície (não um card com
 * imagem dentro) — reutilizado por qualquer ação de mesmo peso visual no
 * painel (ex.: "+ Novo Campeonato" e "Meus Campeonatos"). Renderiza <Link>
 * quando `href` é passado, senão <button>.
 */
export function VolleyballActionButton({ title, subtitle, size, className, ...rest }: VolleyballActionButtonProps) {
  const style: CSSProperties | undefined = size ? ({ '--volleyball-size': `${size}px` } as CSSProperties) : undefined
  const sharedClassName = ['volleyball-action-button', className].filter(Boolean).join(' ')
  const ariaLabel = rest['aria-label'] ?? [title, subtitle].filter(Boolean).join(' ')

  const copy = (
    <span className="volleyball-action-copy">
      <strong>{title}</strong>
      {subtitle && <span>{subtitle}</span>}
    </span>
  )

  if ('href' in rest && rest.href) {
    const { href, ...anchorProps } = rest as { href: string } & AnchorHTMLAttributes<HTMLAnchorElement>
    return (
      <Link href={href} style={style} className={sharedClassName} aria-label={ariaLabel} {...anchorProps}>
        {copy}
      </Link>
    )
  }

  const buttonProps = rest as ButtonHTMLAttributes<HTMLButtonElement>
  return (
    <button type="button" style={style} className={sharedClassName} aria-label={ariaLabel} {...buttonProps}>
      {copy}
    </button>
  )
}
