import { lerTodasAsLinhas } from '@/lib/leitura-paginada'
import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { suspensaoAutomatica, type JogoDoAtleta } from '@/lib/sancoes'

type Presenca = { jogadorId?: number | null; presente?: boolean | null }

/** Recusa atleta suspenso que a súmula marca como presente. Falha de leitura não bloqueia a partida. */
export async function mensagemDeSuspensao(partida: { id?: number; categoriaCampeonatoId?: string | null }, presencas?: Presenca[] | null) {
  const partidaId = Number(partida.id)
  const presentes = (presencas ?? []).filter((item) => item.presente && item.jogadorId != null).map((item) => Number(item.jogadorId))
  if (!Number.isInteger(partidaId) || presentes.length === 0 || !partida.categoriaCampeonatoId) return null

  let jogos: Array<{ id: number; dataHora?: string | null; ocorrencias?: Array<{ jogadorId?: number | null; tipo?: string | null }> | null }>
  try {
    jogos = await lerTodasAsLinhas(() => supabase
      .from('Partida')
      .select('id,dataHora,ocorrencias:OcorrenciaPartida(jogadorId,tipo)')
      .eq('categoriaCampeonatoId', partida.categoriaCampeonatoId))
  } catch (error) {
    console.error('[sancoes] histórico não consultado', error)
    return null
  }

  const ordenados = [...jogos].sort((a, b) => String(a.dataHora ?? '').localeCompare(String(b.dataHora ?? '')) || Number(a.id) - Number(b.id))
  const indiceAtual = ordenados.findIndex((jogo) => Number(jogo.id) === partidaId)
  const anteriores = indiceAtual >= 0 ? ordenados.slice(0, indiceAtual) : ordenados.filter((jogo) => Number(jogo.id) !== partidaId)

  for (const jogadorId of presentes) {
    const historico: JogoDoAtleta[] = anteriores.map((jogo) => ({
      id: Number(jogo.id),
      sancoes: (jogo.ocorrencias ?? [])
        .filter((item: { jogadorId?: number | null }) => Number(item.jogadorId) === jogadorId)
        .map((item: { tipo?: string | null }) => String(item.tipo ?? '')),
    })).filter((jogo) => jogo.sancoes.length > 0)
    const suspensao = suspensaoAutomatica(historico)
    if (suspensao.suspenso) return suspensao.motivo
  }
  return null
}
