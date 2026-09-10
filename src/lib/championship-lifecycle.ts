export type LeagueLifecycleStatus = 'EM_BREVE' | 'ATIVA' | 'ENCERRADA'

export function resolveLeagueLifecycleStatus(statuses: string[]): LeagueLifecycleStatus {
  if (statuses.length === 0) return 'EM_BREVE'
  const allFinished = statuses.every((status) => ['ENCERRADA', 'CANCELADA'].includes(status))
  const hasStarted = statuses.some((status) => ['EM_ANDAMENTO', 'ENCERRADA'].includes(status))
  return allFinished ? 'ENCERRADA' : hasStarted ? 'ATIVA' : 'EM_BREVE'
}
