// A flag do campeonato decide o status gravado. O default do banco é false:
// sem aprovação automática a inscrição fica SOLICITADA até o organizador decidir.

export function statusInicialDaInscricao(aprovacaoAutomatica: boolean | null | undefined) {
  return aprovacaoAutomatica === true ? 'APROVADA' : 'SOLICITADA'
}
