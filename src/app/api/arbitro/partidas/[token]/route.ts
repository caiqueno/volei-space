import { NextRequest } from 'next/server'
import { success } from '@/lib/api-response'
import { requireArbitroPartidaAccess } from '@/lib/arbitro-access'
import { dataHoraUtc } from '@/lib/data-hora'
import { anexarNumerosHerdados } from '@/lib/numero-herdado-leitura'
import { anexarPresencasHerdadas } from '@/lib/presenca-herdada-leitura'

const DEMO_PRESENCA_TOKENS = new Set(['token-demo-1-luva2026', 'token-demo-1-luv2026'])

function demoPresencaLiberada(token: string) {
  if (process.env.NODE_ENV === 'production') return false
  if (process.env.VERCEL_ENV === 'production' || process.env.VERCEL_ENV === 'preview') return false
  return DEMO_PRESENCA_TOKENS.has(token)
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  if (demoPresencaLiberada(token)) {
    return success({
      ...partidaDemoPresenca(token),
      janelaValidacao: { liberada: true, mensagem: 'Demonstração local. Nada é gravado.' },
    })
  }
  const access = await requireArbitroPartidaAccess(req, token)
  if (access instanceof Response) return access
  await anexarNumerosHerdados(access.partida)
  await anexarPresencasHerdadas(access.partida)

  return success({
    ...access.partida,
    janelaValidacao: getJanelaValidacao(access.partida.dataHora),
  })
}

function partidaDemoPresenca(token: string) {
  const setPoint = [
    { id: 101, nome: 'Ana Souza', numero: 1, posicao: null, equipeId: 101, presencaHerdada: true },
    { id: 102, nome: 'Bruno Lima', numero: 2, posicao: null, equipeId: 101, presencaHerdada: true },
    { id: 104, nome: 'Carla Dias', numero: 4, posicao: null, equipeId: 101, presencaHerdada: false },
    { id: 107, nome: 'Diego Nunes', numero: 7, posicao: 'LB', equipeId: 101, presencaHerdada: false },
    { id: 109, nome: 'Elena Prado', numero: 9, posicao: null, equipeId: 101, presencaHerdada: null },
  ]
  const libero = [
    { id: 201, nome: 'Fabio Melo', numero: 3, posicao: null, equipeId: 102, presencaHerdada: null },
    { id: 202, nome: 'Gina Rocha', numero: 5, posicao: null, equipeId: 102, presencaHerdada: null },
    { id: 208, nome: 'Heitor Paz', numero: 8, posicao: 'LB', equipeId: 102, presencaHerdada: null },
  ]
  return {
    id: 9001,
    rodada: 6,
    dataHora: '2026-08-15T14:00:00.000Z',
    localNome: 'Ginásio Municipal',
    status: 'AGENDADA',
    sumulaToken: token,
    ligaId: 1,
    equipeAId: 101,
    equipeBId: 102,
    equipeA: { id: 101, nome: 'Set Point', corHex: '#14573a', logoUrl: null, ultimaPartidaId: 8800, jogadores: setPoint },
    equipeB: { id: 102, nome: 'Líbero FC', corHex: '#1e3a5f', logoUrl: null, ultimaPartidaId: null, jogadores: libero },
    presencas: [],
  }
}

function getJanelaValidacao(dataHora?: string | null) {
  if (!dataHora) {
    return { liberada: true, mensagem: 'Partida sem horario definido. Validacao liberada para teste.' }
  }

  const instante = dataHoraUtc(dataHora)
  const abreEm = (instante ? new Date(instante).getTime() : new Date(dataHora).getTime()) - 60 * 60 * 1000
  return {
    liberada: true,
    abreEm: new Date(abreEm).toISOString(),
    mensagem: 'Validacao por QR Code liberada para teste operacional.',
  }
}
