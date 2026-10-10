import type { OrigemPonto } from '@/lib/ponto-sumula'

/** Classe do pulso leve no atleta que fez ACE, toque (ataque) ou bloqueio. */
export function classeFeedbackPonto(origem: OrigemPonto | null | undefined) {
  if (origem === 'ace') return 'sumula-flash sumula-flash-ace'
  if (origem === 'attack') return 'sumula-flash sumula-flash-toque'
  if (origem === 'block') return 'sumula-flash sumula-flash-bloqueio'
  return ''
}
