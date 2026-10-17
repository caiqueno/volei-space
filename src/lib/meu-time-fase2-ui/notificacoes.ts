import type { Notificacao } from './tipos'

export function contarNaoLidas(lista: Notificacao[]): number {
  return lista.filter((n) => !n.lidaEm).length
}

/** Texto do contador no ícone: limita em 9+. */
export function textoContador(n: number): string {
  return n > 9 ? '9+' : String(n)
}

/** Falhas em que insistir não adianta: sem sessão (401), sem permissão (403) ou recurso desligado. O sino para de tentar. */
export function falhaEncerraBuscaSino(tipo: string | undefined): boolean {
  return tipo === 'sem-sessao' || tipo === 'sem-permissao' || tipo === 'nao-habilitado'
}

export function rotuloSino(n: number): string {
  if (n <= 0) return 'Notificações, nenhuma nova'
  return `Notificações, ${n} ${n === 1 ? 'nova' : 'novas'}`
}

const TITULOS: Record<string, string> = {
  CONVITE_USADO: 'Um atleta preencheu o convite',
  CONVITE_ACEITO: 'Um atleta preencheu o convite',
  IMPORTACAO_CONCLUIDA: 'Sua planilha foi importada',
  IMPORTACAO_CONFIRMADA: 'Sua planilha foi importada',
  AJUSTE_PEDIDO: 'Pediram um ajuste na inscrição',
  RESPONSAVEL_CONTATADO: 'O responsável de um atleta foi contatado',
  RESPONSAVEL_AUTORIZOU: 'Um responsável autorizou um atleta',
  CLUBE_EQUIPE_VINCULADA: 'Uma equipe entrou no clube',
}

export function tituloNotificacao(n: Pick<Notificacao, 'tipo' | 'payload'>): string {
  const p = n.payload ?? {}
  if (typeof p.titulo === 'string' && p.titulo.trim()) return p.titulo
  const base = TITULOS[n.tipo] ?? 'Novidade no seu time'
  const nome = typeof p.nome === 'string' ? p.nome : typeof p.atleta === 'string' ? p.atleta : ''
  return nome && n.tipo !== 'IMPORTACAO_CONCLUIDA' ? `${base}: ${nome}` : base
}
