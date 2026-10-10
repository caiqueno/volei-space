import { NextRequest } from 'next/server'
import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { success, error } from '@/lib/api-response'
import { requirePublicRole } from '@/lib/auth'
import { categoriaDaUrl } from '@/lib/isolamento-categoria'
import { consultarComVaga } from '@/lib/consulta-vaga'
import { ladoExposto } from '@/lib/vaga-a-definir'

export async function GET(req: NextRequest) {
  const auth = await requirePublicRole(req, ['organizador'], { releasedOnly: true })
  if (auth instanceof Response) return auth

  const params = new URL(req.url).searchParams
  const categoria = categoriaDaUrl(params)
  if ('erro' in categoria) return error(categoria.erro, 422)
  const ligaId = Number(params.get('ligaId'))
  if (!Number.isInteger(ligaId) || ligaId <= 0) return error('Escolha um campeonato.', 422)
  // A primeira página pede 20. "Ver mais" e a releitura do Realtime pedem a janela
  // já aberta; o teto antigo de 30 devolvia menos do que a tela mostrava e ela recolhia.
  const limite = Math.min(200, Math.max(1, Number(params.get('limite') ?? 20) || 20))
  const offset = Math.max(0, Number(params.get('offset') ?? 0) || 0)

  const { data: liga, error: ligaErr } = await supabase
    .from('Liga')
    .select('id')
    .eq('id', ligaId)
    .eq('organizadorId', auth.userId)
    .maybeSingle()
  if (ligaErr) return error('Erro ao carregar o campeonato', 500, ligaErr.message)
  if (!liga) return error('Campeonato não encontrado.', 404)

  const status = params.get('status')
  const statusPermitido = ['EM_ANDAMENTO', 'AGENDADA', 'PENDENTE', 'ENCERRADA', 'WO', 'CANCELADA']
  if (status && !statusPermitido.includes(status)) return error('Status inválido.', 422)

  const selectPartidas = 'id,ligaId,fase,rodada,status,dataHora,localNome,setsPorA,setsPorB,pontosPorA,pontosPorB,sumulaToken,equipeA:Equipe!Partida_equipeAId_fkey(id,nome,corHex),equipeB:Equipe!Partida_equipeBId_fkey(id,nome,corHex),liga:Liga!Partida_ligaId_fkey(id,nome,simulacao),escala:EscalaArbitro(id,arbitroId,cargo,arbitro:Arbitro(id,nome,email)),acesso:AcessoArbitroJogo!AcessoArbitroJogo_partidaId_fkey(ultimoAcessoEm,ativo,revogadoEm)'
  const { data, error: partidasErr } = await consultarComVaga(selectPartidas, (colunas) => {
    let consulta = supabase.from('Partida').select(colunas).eq('ligaId', ligaId)
    if (categoria.id) consulta = consulta.eq('categoriaCampeonatoId', categoria.id)
    if (status) consulta = consulta.eq('status', status)
    return consulta
      .order('dataHora', { ascending: true, nullsFirst: false })
      .order('rodada', { ascending: true })
      .order('id', { ascending: true })
      .range(offset, offset + limite)
  })

  if (partidasErr) return error('Erro ao carregar partidas', 500, partidasErr.message)
  const linhas = (data ?? []).map((partida: any) => ({
    ...partida,
    equipeA: ladoExposto(partida.equipeA, partida.origemVagaA),
    equipeB: ladoExposto(partida.equipeB, partida.origemVagaB),
  }))
  return success({ partidas: linhas.slice(0, limite), temMais: linhas.length > limite })
}
