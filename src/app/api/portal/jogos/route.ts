import { NextRequest } from 'next/server'
import { error, success } from '@/lib/api-response'
import { buscarAgendaCampeonato } from '@/lib/agenda-publica'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const PARTES = new Set(['ao-vivo', 'proximos', 'encerradas'])

export async function GET(req: NextRequest) {
  const params = new URL(req.url).searchParams
  const ligaId = Number(params.get('ligaId'))
  if (!Number.isInteger(ligaId) || ligaId <= 0) return error('Escolha um campeonato.', 422)
  const parte = params.get('parte')
  if (parte && !PARTES.has(parte)) return error('Informe a parte da agenda.', 422)

  const agenda = await buscarAgendaCampeonato(ligaId, {
    parte: parte as 'ao-vivo' | 'proximos' | 'encerradas' | undefined,
    offset: Number(params.get('offset') ?? 0),
    limite: Number(params.get('limite') ?? 8),
    // Quem chamou já escolheu o campeonato, igual à página que renderiza a agenda.
    // Sem isto o Realtime esvazia a lista de um campeonato marcado como teste.
    campeonatoInformado: true,
  })
  if (agenda.erro) return error('Não foi possível carregar os jogos agora. Tente novamente em instantes.', 500)

  const resposta = success({
    aoVivo: agenda.aoVivo.partidas,
    proximos: agenda.proximos.partidas,
    encerradas: agenda.encerradas.partidas,
    analise: [],
    outras: [],
    temMais: {
      aoVivo: agenda.aoVivo.temMais,
      proximos: agenda.proximos.temMais,
      encerradas: agenda.encerradas.temMais,
    },
    atualizadoEm: new Date().toISOString(),
  })
  resposta.headers.set('Cache-Control', 'no-store')
  return resposta
}
