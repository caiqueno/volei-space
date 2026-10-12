import { NextRequest } from 'next/server'
import { error, success } from '@/lib/api-response'
import { categoriaDaUrl } from '@/lib/isolamento-categoria'
import { lerTodasAsLinhas } from '@/lib/leitura-paginada'
import { escolherMvpDoCampeonato, partidaFinalUnica, type MvpDaFinal, type TotaisAtleta } from '@/lib/mvp-campeonato'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'

const TIPOS = ['ace', 'ACE', 'saque', 'SAQUE', 'attack', 'ATAQUE', 'ataque', 'block', 'BLOQUEIO', 'bloqueio']

// OcorrenciaPartida não tem coluna de criação nem de atualização.
const COLUNAS_LANCE = 'tipo,jogadorId,jogador:Jogador(id,nome),partida:Partida!inner(ligaId,categoriaCampeonatoId)'

type Classe = 'saque' | 'ataque' | 'bloqueio'

function classeDoPonto(tipo: string): Classe | null {
  const valor = tipo.toLowerCase()
  if (valor === 'ace' || valor === 'saque') return 'saque'
  if (valor === 'attack' || valor === 'ataque') return 'ataque'
  if (valor === 'block' || valor === 'bloqueio') return 'bloqueio'
  return null
}

export async function GET(req: NextRequest) {
  const params = new URL(req.url).searchParams
  const ligaId = Number(params.get('ligaId'))
  if (!Number.isInteger(ligaId) || ligaId <= 0) return error('Informe o campeonato.', 422)
  const categoria = categoriaDaUrl(params)
  if ('erro' in categoria) return error(categoria.erro, 422)

  const { data: liga, error: falhaLiga } = await supabaseAdmin.from('Liga').select('status').eq('id', ligaId).maybeSingle()
  if (falhaLiga) return error('Não foi possível carregar o ranking.', 500)
  const concluido = ['FINALIZADO', 'ENCERRADA'].includes(String(liga?.status ?? '').toUpperCase())
  if (!concluido) {
    const resposta = success({ concluido: false, mvp: null, pontos: 0 })
    resposta.headers.set('Cache-Control', 'no-store')
    return resposta
  }

  const totais = new Map<number, TotaisAtleta>()
  let lote: Array<{ tipo?: string | null; jogadorId?: number | null; jogador?: { id?: number; nome?: string } | Array<{ id?: number; nome?: string }> | null }>
  try {
    lote = await lerTodasAsLinhas(() => {
      let consulta = supabaseAdmin
        .from('OcorrenciaPartida')
        .select(COLUNAS_LANCE)
        .eq('partida.ligaId', ligaId)
        .in('tipo', TIPOS)
      if (categoria.id) consulta = consulta.eq('partida.categoriaCampeonatoId', categoria.id)
      return consulta.not('jogadorId', 'is', null)
    })
  } catch {
    return error('Não foi possível carregar o ranking.', 500)
  }
  for (const item of lote) {
    const classe = classeDoPonto(String(item.tipo ?? ''))
    const jogador = Array.isArray(item.jogador) ? item.jogador[0] : item.jogador
    if (!classe || !jogador?.id || !jogador.nome) continue
    const atual = totais.get(jogador.id) ?? { id: jogador.id, nome: jogador.nome, pontos: 0, saque: 0, ataque: 0, bloqueio: 0 }
    atual[classe] += 1
    atual.pontos += 1
    totais.set(jogador.id, atual)
  }

  let daFinal: MvpDaFinal | null = null
  try {
    daFinal = await lerMvpDaFinal(ligaId, categoria.id)
  } catch {
    return error('Não foi possível carregar o ranking.', 500)
  }
  const mvp = escolherMvpDoCampeonato(Array.from(totais.values()), daFinal)

  const resposta = success({
    concluido: true,
    mvp: mvp?.nome ?? null,
    equipe: mvp?.equipe ?? null,
    foto: mvp?.foto ?? null,
    pontos: mvp?.pontos ?? 0,
    saque: mvp?.saque ?? 0,
    ataque: mvp?.ataque ?? 0,
    bloqueio: mvp?.bloqueio ?? 0,
    origem: mvp?.origem ?? null,
  })
  resposta.headers.set('Cache-Control', 'no-store')
  return resposta
}

async function lerMvpDaFinal(ligaId: number, categoriaId: string | null): Promise<MvpDaFinal | null> {
  let consulta = supabaseAdmin
    .from('Partida')
    .select('id,rodada,categoriaCampeonatoId')
    .eq('ligaId', ligaId)
    .eq('fase', 'FINAL')
  if (categoriaId) consulta = consulta.eq('categoriaCampeonatoId', categoriaId)
  const { data: finais, error: falhaFinais } = await consulta
  if (falhaFinais) throw new Error('Não foi possível ler a final.')
  const final = partidaFinalUnica(finais ?? [], categoriaId)
  if (!final) return null

  const { data: destaques, error: falhaDestaque } = await supabaseAdmin
    .from('DestaquesPartida')
    .select('jogadorId,jogador:Jogador(id,nome,fotoRostoUrl,fotoUrl,equipe:Equipe(nome))')
    .eq('partidaId', final.id)
    .eq('tipo', 'MVP')
    .limit(1)
  if (falhaDestaque) throw new Error('Não foi possível ler o MVP da final.')
  const destaque = destaques?.[0]
  const jogador = primeiro(destaque?.jogador)
  if (!jogador?.id || !jogador.nome) return null
  const equipe = primeiro(jogador.equipe)
  return {
    jogadorId: jogador.id,
    nome: jogador.nome,
    equipe: equipe?.nome ?? null,
    fotoRostoUrl: jogador.fotoRostoUrl ?? null,
    fotoUrl: jogador.fotoUrl ?? null,
  }
}

function primeiro<T>(valor: T | T[] | null | undefined) {
  return Array.isArray(valor) ? valor[0] ?? null : valor ?? null
}
