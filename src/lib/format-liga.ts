export function formatLigaStatus(status?: string | null) {
  const map: Record<string, string> = {
    EM_BREVE: 'Em breve',
    ATIVA: 'Ativo',
    ENCERRADA: 'Encerrado',
    FINALIZADO: 'Finalizado',
  }
  return status ? map[status] ?? status : 'Em breve'
}

export function formatLigaFormato(formato?: string | null) {
  const map: Record<string, string> = {
    PONTOS_CORRIDOS: 'Pontos corridos',
    GRUPOS_MATA_MATA: 'Grupos + mata-mata',
    MATA_MATA: 'Mata-mata',
    COPA_CURTA: 'Mata-mata',
  }
  return formato ? map[formato] ?? formato : 'Formato a definir'
}
