export function rotuloArbitroResponsavel(nomes: Array<string | null | undefined>, usouLink: boolean) {
  const nome = nomes.map((item) => String(item ?? '').trim()).find(Boolean)
  if (nome) return nome
  if (usouLink) return 'Árbitro do link'
  return 'Não registrado'
}

export function jogoJaIniciado(status?: string | null) {
  return ['EM_ANDAMENTO', 'ENCERRADA', 'WO', 'FINALIZADA', 'APROVADA'].includes(String(status ?? '').trim().toUpperCase())
}

export function destinoDepoisDoCodigo(partida: { id: number; status?: string | null; sumulaToken?: string | null }, tokenDoLink: string) {
  // Lançamento só existe com token da súmula; partida legada sem token fica na tela do árbitro.
  if (jogoJaIniciado(partida.status) && partida.sumulaToken) return `/sumula/${partida.sumulaToken}/lancar`
  return `/arbitro/partida/${tokenDoLink}`
}
