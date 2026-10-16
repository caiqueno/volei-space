// Regras puras da tela ao vivo do torcedor: uma falha isolada de rede não pode derrubar o placar já carregado.

export type EstadoFalhaAoVivo = {
  /** true: trocar a tela inteira por "Partida indisponível" (só quando nunca houve dados). */
  mostrarErroCompleto: boolean
  /** true: manter o último placar e avisar "Sem conexão. Tentando de novo". */
  mostrarAvisoSemConexao: boolean
}

export function decidirFalhaAoVivo(temPartidaCarregada: boolean): EstadoFalhaAoVivo {
  return temPartidaCarregada
    ? { mostrarErroCompleto: false, mostrarAvisoSemConexao: true }
    : { mostrarErroCompleto: true, mostrarAvisoSemConexao: false }
}

/** Espera antes de tentar de novo: 3 s, 6 s, 12 s, 24 s e no máximo 30 s. */
export function esperaNovaTentativaMs(tentativas: number) {
  const n = Math.max(1, Math.floor(tentativas))
  return Math.min(30_000, 3_000 * 2 ** (n - 1))
}

export const TEXTO_SEM_CONEXAO = 'Sem conexão. Tentando de novo'
