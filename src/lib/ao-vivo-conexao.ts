// Regras puras da tela ao vivo do torcedor: uma falha isolada de rede não pode derrubar o placar já carregado.
// A nova tentativa fica por conta de useBancoAoVivo (consulta a cada 4 s e ao voltar a conexão).

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

export const TEXTO_SEM_CONEXAO = 'Sem conexão. Tentando de novo'
