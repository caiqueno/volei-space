import { NextRequest } from 'next/server'
import { error, success } from '@/lib/api-response'
import { categoriaDaUrl } from '@/lib/isolamento-categoria'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'

const TIPOS = ['ace', 'ACE', 'saque', 'SAQUE', 'attack', 'ATAQUE', 'ataque', 'block', 'BLOQUEIO', 'bloqueio']

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

  const totais = new Map<number, { nome: string; pontos: number; saque: number; ataque: number; bloqueio: number }>()
  let offset = 0
  for (;;) {
    let consulta = supabaseAdmin
      .from('OcorrenciaPartida')
      .select('tipo,jogadorId,jogador:Jogador(id,nome),partida:Partida!inner(ligaId,categoriaCampeonatoId)')
      .eq('partida.ligaId', ligaId)
      .in('tipo', TIPOS)
    if (categoria.id) consulta = consulta.eq('partida.categoriaCampeonatoId', categoria.id)
    const { data, error: falha } = await consulta
      .not('jogadorId', 'is', null)
      .range(offset, offset + 499)
    if (falha) return error('Não foi possível carregar o ranking.', 500)
    const lote = data ?? []
    for (const item of lote) {
      const classe = classeDoPonto(String(item.tipo ?? ''))
      const jogador = Array.isArray(item.jogador) ? item.jogador[0] : item.jogador
      if (!classe || !jogador?.id || !jogador.nome) continue
      const atual = totais.get(jogador.id) ?? { nome: jogador.nome, pontos: 0, saque: 0, ataque: 0, bloqueio: 0 }
      atual[classe] += 1
      atual.pontos += 1
      totais.set(jogador.id, atual)
    }
    if (lote.length < 500) break
    offset += 500
  }

  const mvp = Array.from(totais.values()).sort((a, b) => (
    b.pontos - a.pontos || b.ataque - a.ataque || b.bloqueio - a.bloqueio || b.saque - a.saque || a.nome.localeCompare(b.nome, 'pt')
  ))[0] ?? null

  const resposta = success({
    concluido: true,
    mvp: mvp?.nome ?? null,
    pontos: mvp?.pontos ?? 0,
    saque: mvp?.saque ?? 0,
    ataque: mvp?.ataque ?? 0,
    bloqueio: mvp?.bloqueio ?? 0,
  })
  resposta.headers.set('Cache-Control', 'no-store')
  return resposta
}
