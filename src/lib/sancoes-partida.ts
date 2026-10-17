import { lerTodasAsLinhas } from '@/lib/leitura-paginada'
import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { suspensaoAutomatica, tipoSancaoDaOcorrencia, type JogoDoAtleta } from '@/lib/sancoes'

type Presenca = { jogadorId?: number | null; presente?: boolean | null }
type OcorrenciaHistorico = { jogadorId?: number | null; tipo?: string | null; descricao?: string | null }
type JogoHistorico = { id: number; dataHora?: string | null; ocorrencias?: OcorrenciaHistorico[] | null }

/**
 * Histórico de sanções de um atleta nos jogos anteriores. O tipo vem de tipoSancaoDaOcorrencia: o
 * marcador [[SAN:...]] da descrição distingue penalidade, expulsão e desqualificação, que a tela
 * grava todas como CARTAO_VERMELHO. Nota antiga sem marcador continua valendo como expulsão.
 */
export function historicoDeSancoes(anteriores: JogoHistorico[], jogadorId: number): JogoDoAtleta[] {
  return anteriores.map((jogo) => ({
    id: Number(jogo.id),
    sancoes: (jogo.ocorrencias ?? [])
      .filter((item) => Number(item.jogadorId) === jogadorId)
      .map((item) => tipoSancaoDaOcorrencia(item))
      .filter((tipo): tipo is NonNullable<typeof tipo> => tipo != null),
  })).filter((jogo) => jogo.sancoes.length > 0)
}

/** Recusa atleta suspenso que a súmula marca como presente. Falha de leitura não bloqueia a partida. */
export async function mensagemDeSuspensao(partida: { id?: number; categoriaCampeonatoId?: string | null }, presencas?: Presenca[] | null) {
  const partidaId = Number(partida.id)
  const presentes = (presencas ?? []).filter((item) => item.presente && item.jogadorId != null).map((item) => Number(item.jogadorId))
  if (!Number.isInteger(partidaId) || presentes.length === 0 || !partida.categoriaCampeonatoId) return null

  let jogos: JogoHistorico[]
  try {
    jogos = await lerTodasAsLinhas(() => supabase
      .from('Partida')
      .select('id,dataHora,ocorrencias:OcorrenciaPartida(jogadorId,tipo,descricao)')
      .eq('categoriaCampeonatoId', partida.categoriaCampeonatoId))
  } catch (error) {
    console.error('[sancoes] histórico não consultado', error)
    return null
  }

  const ordenados = [...jogos].sort((a, b) => String(a.dataHora ?? '').localeCompare(String(b.dataHora ?? '')) || Number(a.id) - Number(b.id))
  const indiceAtual = ordenados.findIndex((jogo) => Number(jogo.id) === partidaId)
  const anteriores = indiceAtual >= 0 ? ordenados.slice(0, indiceAtual) : ordenados.filter((jogo) => Number(jogo.id) !== partidaId)

  for (const jogadorId of presentes) {
    const historico = historicoDeSancoes(anteriores, jogadorId)
    const suspensao = suspensaoAutomatica(historico)
    if (suspensao.suspenso) return suspensao.motivo
  }
  return null
}
