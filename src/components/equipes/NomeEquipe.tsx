import { normalizarNomeEquipe } from '@/lib/nome-equipe'

type Props = {
  nome?: string | null
  className?: string
  vazio?: string
}

export function NomeEquipe({ nome, className, vazio = 'Equipe' }: Props) {
  const texto = normalizarNomeEquipe(nome ?? '') || normalizarNomeEquipe(vazio)
  return <span className={['nome-equipe', className].filter(Boolean).join(' ')}>{texto}</span>
}
