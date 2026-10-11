import { supabaseAdmin } from '@/lib/supabase-admin'
import {
  presencaHerdadaDoAtleta,
  ultimaPartidaDaEquipe,
  type PartidaDaEquipe,
  type PresencaNaPartida,
} from '@/lib/presenca-herdada'

type AtletaElenco = { id?: number; equipeId?: number; presencaHerdada?: boolean | null }
type EquipeElenco = { id?: number; ultimaPartidaId?: number | null; jogadores?: AtletaElenco[] | null }
type PartidaComElenco = {
  id?: number
  ligaId?: number
  equipeAId?: number
  equipeBId?: number
  equipeA?: EquipeElenco | null
  equipeB?: EquipeElenco | null
}

const PAGINA = 1000
const TETO = 5000

/**
 * Anexa a presença da última partida de cada equipe na mesma liga.
 * Só lê. Não grava sugestão e não cobre presença já decidida neste jogo:
 * a tela é que escolhe qual das duas mostrar.
 */
export async function anexarPresencasHerdadas(partida: PartidaComElenco) {
  try {
    const ligaId = Number(partida?.ligaId)
    const partidaId = Number(partida?.id)
    const equipeAId = Number(partida?.equipeAId ?? partida?.equipeA?.id)
    const equipeBId = Number(partida?.equipeBId ?? partida?.equipeB?.id)
    if (![ligaId, partidaId, equipeAId, equipeBId].every((id) => Number.isInteger(id))) return

    const partidas = await lerPartidasDasEquipes(ligaId, partidaId, equipeAId, equipeBId)
    if (!partidas) return
    const ultimaA = ultimaPartidaDaEquipe({ equipeId: equipeAId, ligaId, partidaAtualId: partidaId, partidas })
    const ultimaB = ultimaPartidaDaEquipe({ equipeId: equipeBId, ligaId, partidaAtualId: partidaId, partidas })
    const ids = [ultimaA?.id, ultimaB?.id].filter((id): id is number => Number.isInteger(id))
    const presencas = ids.length ? await lerPresencas(ids) : []
    if (!presencas) return
    aplicar(partida.equipeA, equipeAId, ultimaA?.id ?? null, presencas)
    aplicar(partida.equipeB, equipeBId, ultimaB?.id ?? null, presencas)
  } catch (err) {
    console.error('[presenca] última partida indisponível', err)
  }
}

function aplicar(
  equipe: EquipeElenco | null | undefined,
  equipeId: number,
  ultimaPartidaId: number | null,
  presencas: PresencaNaPartida[],
) {
  if (!equipe) return
  equipe.ultimaPartidaId = ultimaPartidaId
  for (const jogador of equipe.jogadores ?? []) {
    const jogadorId = Number(jogador?.id)
    if (!Number.isInteger(jogadorId)) continue
    jogador.presencaHerdada = presencaHerdadaDoAtleta({
      jogadorId,
      equipeId,
      ultimaPartidaId,
      presencas,
    })
  }
}

async function lerPartidasDasEquipes(
  ligaId: number,
  partidaId: number,
  equipeAId: number,
  equipeBId: number,
): Promise<PartidaDaEquipe[] | null> {
  const linhas: PartidaDaEquipe[] = []
  let offset = 0
  const filtro = `equipeAId.eq.${equipeAId},equipeBId.eq.${equipeAId},equipeAId.eq.${equipeBId},equipeBId.eq.${equipeBId}`
  for (;;) {
    const { data, error } = await supabaseAdmin
      .from('Partida')
      .select('id,dataHora,equipeAId,equipeBId,ligaId,status')
      .eq('ligaId', ligaId)
      .neq('id', partidaId)
      .or(filtro)
      .range(offset, offset + PAGINA - 1)
    if (error) {
      console.error('[presenca] última partida indisponível', error)
      return null
    }
    const lote = data ?? []
    for (const linha of lote) {
      const id = Number(linha.id)
      const a = Number(linha.equipeAId)
      const b = Number(linha.equipeBId)
      if (!Number.isInteger(id) || !Number.isInteger(a) || !Number.isInteger(b)) continue
      linhas.push({
        id,
        equipeAId: a,
        equipeBId: b,
        ligaId: Number(linha.ligaId),
        dataHora: linha.dataHora ?? null,
        status: linha.status ?? null,
      })
    }
    if (lote.length < PAGINA || offset + PAGINA >= TETO) break
    offset += PAGINA
  }
  return linhas
}

async function lerPresencas(partidaIds: number[]): Promise<PresencaNaPartida[] | null> {
  const { data, error } = await supabaseAdmin
    .from('SumulaPresenca')
    .select('jogadorId,equipeId,presente,partidaId')
    .in('partidaId', partidaIds)
  if (error) {
    console.error('[presenca] última partida indisponível', error)
    return null
  }
  return (data ?? []).flatMap((linha) => {
    const partidaId = Number(linha.partidaId)
    const jogadorId = Number(linha.jogadorId)
    const equipeId = Number(linha.equipeId)
    if (!Number.isInteger(partidaId) || !Number.isInteger(jogadorId) || !Number.isInteger(equipeId)) return []
    return [{
      partidaId,
      jogadorId,
      equipeId,
      presente: linha.presente === true || linha.presente === false ? linha.presente : null,
    }]
  })
}
