import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { success, error } from '@/lib/api-response'
import { normalizarPartidaPublica, PARTIDA_PUBLICA_COLUNAS } from '@/lib/partida-publica'
import { consultarComVaga } from '@/lib/consulta-vaga'
import { idsForaDaVitrine } from '@/lib/campeonatos-publicos'
import { campeonatoDeTeste } from '@/lib/campeonato-teste'
import { campeonatoPublicado } from '@/lib/campeonato-publico'
import { campeonatoPublicadoDaLiga, idsCompeticoesPrivadas } from '@/lib/visibilidade-competicao'
import { aoVivoAtivo } from '@/lib/ao-vivo'
import { consumirLimiteAsync, ipDaRequisicao } from '@/lib/rate-limit'

/**
 * Lista PÚBLICA de partidas em andamento. Mesmas garantias do detalhe `/api/ao-vivo/[partidaId]`:
 * atrás de `AO_VIVO_ATIVO`, mesmo limite por IP (balde `ao-vivo:ip:`), e nunca expõe competição
 * privada, simulação, teste ou campeonato não publicado (rascunho). Com `ligaId`, liga privada ou
 * não publicada devolve lista vazia (resposta igual à de uma liga sem jogos).
 */
export const dynamic = 'force-dynamic'

const LIMITE_POR_MINUTO = 120
const COLUNAS = `${PARTIDA_PUBLICA_COLUNAS},pontosPorA,pontosPorB,liga:Liga!Partida_ligaId_fkey(id,nome,slug,descricao,simulacao,status)`

function semCache(resposta: NextResponse) {
  resposta.headers.set('Cache-Control', 'no-store')
  return resposta
}

export async function GET(req: NextRequest) {
  if (!aoVivoAtivo()) return semCache(error('Recurso não encontrado.', 404))

  const cota = await consumirLimiteAsync(`ao-vivo:ip:${ipDaRequisicao(req)}`, LIMITE_POR_MINUTO, 60_000, 'ABERTO')
  if (!cota.ok) {
    const limitada = error('Muitas requisições. Aguarde um instante.', 429)
    limitada.headers.set('Retry-After', String(cota.retryAfterSeconds))
    return semCache(limitada)
  }

  const params = new URL(req.url).searchParams
  const limite = Math.min(24, Math.max(1, Number(params.get('limite') ?? 12) || 12))
  const offset = Math.max(0, Number(params.get('offset') ?? 0) || 0)
  const ligaId = Number(params.get('ligaId'))
  const porLiga = Number.isInteger(ligaId) && ligaId > 0

  let ocultos: number[] = []
  try {
    if (porLiga) {
      const privadas = await idsCompeticoesPrivadas({ semCache: true })
      if (privadas.has(ligaId) || !(await campeonatoPublicadoDaLiga(ligaId))) {
        return semCache(success({ partidas: [], temMais: false }))
      }
    } else {
      ocultos = await idsForaDaVitrine()
    }
  } catch {
    return semCache(error('Não foi possível carregar as partidas ao vivo.', 500))
  }

  const { data, error: falha } = await consultarComVaga(COLUNAS, (colunas) => {
    let consulta = supabaseAdmin
      .from('Partida')
      .select(colunas)
      .eq('status', 'EM_ANDAMENTO')
      .order('dataHora', { ascending: true, nullsFirst: false })
      .order('rodada', { ascending: true })
      .order('id', { ascending: true })
    if (porLiga) consulta = consulta.eq('ligaId', ligaId)
    else if (ocultos.length) consulta = consulta.not('ligaId', 'in', `(${ocultos.join(',')})`)
    return consulta.range(offset, offset + limite)
  })
  if (falha) return semCache(error('Não foi possível carregar as partidas ao vivo.', 500))
  type LigaLinha = { nome?: string | null; slug?: string | null; descricao?: string | null; simulacao?: boolean | null; status?: string | null }
  const linhas = (data ?? []) as Array<{ liga?: LigaLinha | LigaLinha[] | null }>
  const ligaDe = (partida: { liga?: LigaLinha | LigaLinha[] | null }) => (Array.isArray(partida.liga) ? partida.liga[0] : partida.liga) ?? null
  const partidas = linhas
    .filter((partida) => !campeonatoDeTeste(ligaDe(partida)) && campeonatoPublicado(ligaDe(partida)))
    .map(normalizarPartidaPublica)
    .filter((partida) => partida && partida.liga?.simulacao !== true)
    .slice(0, limite)
  return semCache(success({ partidas, temMais: linhas.length > limite }))
}
