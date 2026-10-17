import type { Notificacao } from './tipos'

export function contarNaoLidas(lista: Notificacao[]): number {
  return lista.filter((n) => !n.lidaEm).length
}

/** Texto do contador no ícone: limita em 9+. */
export function textoContador(n: number): string {
  return n > 9 ? '9+' : String(n)
}

export function rotuloSino(n: number): string {
  if (n <= 0) return 'Notificações, nenhuma nova'
  return `Notificações, ${n} ${n === 1 ? 'nova' : 'novas'}`
}

const TITULOS: Record<string, string> = {
  CONVITE_USADO: 'Um atleta preencheu o convite',
  CONVITE_ACEITO: 'Um atleta preencheu o convite',
  IMPORTACAO_CONCLUIDA: 'Sua planilha foi importada',
  RESPONSAVEL_CONTATADO: 'O responsável de um atleta foi contatado',
  RESPONSAVEL_AUTORIZOU: 'Um responsável autorizou um atleta',
  CLUBE_EQUIPE_VINCULADA: 'Uma equipe entrou no clube',
}

export function tituloNotificacao(n: Pick<Notificacao, 'tipo' | 'payload'>): string {
  const base = TITULOS[n.tipo] ?? 'Novidade no seu time'
  const p = n.payload ?? {}
  const nome = typeof p.nome === 'string' ? p.nome : typeof p.atleta === 'string' ? p.atleta : ''
  return nome && n.tipo !== 'IMPORTACAO_CONCLUIDA' ? `${base}: ${nome}` : base
}
