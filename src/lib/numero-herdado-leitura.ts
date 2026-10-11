import { supabaseAdmin } from '@/lib/supabase-admin'
import { numeroHerdado, type CamisaAnterior } from '@/lib/numero-camisa-partida'

type PartidaComElenco = {
  id?: number
  ligaId?: number
  equipeA?: { jogadores?: Array<{ id?: number; numeroHerdado?: number | null }> } | null
  equipeB?: { jogadores?: Array<{ id?: number; numeroHerdado?: number | null }> } | null
}

const PAGINA = 1000
const TETO = 20000

/**
 * Anexa em cada atleta a última camisa preenchida na mesma liga.
 * Não grava e não mexe no número já salvo neste jogo.
 * Se a consulta falhar, a súmula abre com o cadastro.
 */
export async function anexarNumerosHerdados(partida: PartidaComElenco) {
  try {
    const ligaId = Number(partida?.ligaId)
    const partidaId = Number(partida?.id)
    if (!Number.isInteger(ligaId) || !Number.isInteger(partidaId)) return
    const jogadores = [
      ...(partida.equipeA?.jogadores ?? []),
      ...(partida.equipeB?.jogadores ?? []),
    ]
    const ids = Array.from(new Set(jogadores.map((jogador) => Number(jogador?.id)).filter((id) => Number.isInteger(id))))
    if (!ids.length) return

    const linhas = await lerCamisasAnteriores(ligaId, partidaId, ids)
    if (!linhas) return
    for (const jogador of jogadores) {
      const jogadorId = Number(jogador?.id)
      if (!Number.isInteger(jogadorId)) continue
      jogador.numeroHerdado = numeroHerdado({
        jogadorId,
        ligaId,
        partidaAtualId: partidaId,
        numeroCadastro: null,
        numeroDesteJogo: null,
        anteriores: linhas,
      })
    }
  } catch (err) {
    console.error('[sumula] camisas anteriores indisponíveis', err)
  }
}

async function lerCamisasAnteriores(ligaId: number, partidaId: number, ids: number[]): Promise<CamisaAnterior[] | null> {
  const linhas: CamisaAnterior[] = []
  let offset = 0
  for (;;) {
    const { data, error } = await supabaseAdmin
      .from('SumulaPresenca')
      .select('id,jogadorId,numero,partidaId,partida:Partida!SumulaPresenca_partidaId_fkey!inner(ligaId,dataHora)')
      .in('jogadorId', ids)
      .not('numero', 'is', null)
      .neq('partidaId', partidaId)
      .eq('partida.ligaId', ligaId)
      .range(offset, offset + PAGINA - 1)
    if (error) {
      console.error('[sumula] camisas anteriores indisponíveis', error)
      return null
    }
    const lote = data ?? []
    for (const linha of lote) {
      const camisa = linhaParaCamisa(linha)
      if (camisa) linhas.push(camisa)
    }
    if (lote.length < PAGINA || offset + PAGINA >= TETO) break
    offset += PAGINA
  }
  return linhas
}

function linhaParaCamisa(linha: {
  id?: number | null
  jogadorId?: number | null
  numero?: unknown
  partidaId?: number | null
  partida?: { ligaId?: number | null; dataHora?: string | null } | Array<{ ligaId?: number | null; dataHora?: string | null }> | null
}): CamisaAnterior | null {
  const partida = Array.isArray(linha.partida) ? linha.partida[0] : linha.partida
  const jogadorId = Number(linha.jogadorId)
  const partidaId = Number(linha.partidaId)
  if (!Number.isInteger(jogadorId) || !Number.isInteger(partidaId)) return null
  return {
    jogadorId,
    partidaId,
    ligaId: partida?.ligaId == null ? null : Number(partida.ligaId),
    numero: linha.numero,
    dataHora: partida?.dataHora ?? null,
    presencaId: linha.id == null ? null : Number(linha.id),
  }
}
