import { NextRequest } from 'next/server'
import { z } from 'zod'
import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { error, success } from '@/lib/api-response'
import {
  bloqueioTentativas,
  codigoConfere,
  gravarSessaoAcesso,
  proximoBloqueio,
  registrarEventoAcesso,
} from '@/lib/acesso-arbitro-jogo'
import { destinoDepoisDoCodigo } from '@/lib/arbitro-responsavel'
import { consultarComVaga } from '@/lib/consulta-vaga'
import { rotuloDoLado } from '@/lib/vaga-a-definir'

const corpoSchema = z.object({ codigo: z.string().min(1).max(32) })

const MENSAGEM_REVOGADO = 'Este link de acesso ao jogo foi revogado pelo organizador.'
const MENSAGEM_CODIGO = 'Código de acesso inválido. Confira o código enviado pelo organizador e tente novamente.'

function nomeEquipe(valor: unknown, origem: unknown) {
  return rotuloDoLado(valor, origem)
}

export async function GET(_req: NextRequest, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params
  const acesso = await carregar(token)
  if (acesso === 'falha') return error('Não foi possível validar o acesso do árbitro neste ambiente.', 503)
  if (!acesso) return error('Link de acesso inválido.', 404)
  if (!acesso.ativo || acesso.revogadoEm) {
    return error(MENSAGEM_REVOGADO, 410)
  }
  return success({
    jogo: {
      equipeA: nomeEquipe(acesso.partida.equipeA, acesso.partida.origemVagaA),
      equipeB: nomeEquipe(acesso.partida.equipeB, acesso.partida.origemVagaB),
      dataHora: acesso.partida.dataHora,
      localNome: acesso.partida.localNome,
    },
  })
}

export async function POST(req: NextRequest, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params
  const parsed = corpoSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return error(MENSAGEM_CODIGO, 401)

  const acesso = await carregar(token)
  if (acesso === 'falha') return error('Não foi possível validar o acesso do árbitro neste ambiente.', 503)
  if (!acesso) return error('Link de acesso inválido.', 404)
  if (!acesso.ativo || acesso.revogadoEm) return error(MENSAGEM_REVOGADO, 410)

  const bloqueio = bloqueioTentativas(acesso)
  if (bloqueio) return bloqueio

  const ok = await codigoConfere(parsed.data.codigo, acesso.codigoHash)
  if (!ok) {
    const proximo = proximoBloqueio(Number(acesso.tentativasFalhas ?? 0) + 1)
    await supabase.from('AcessoArbitroJogo').update({ ...proximo, atualizadoEm: new Date().toISOString() }).eq('id', acesso.id)
    await registrarEventoAcesso({ partidaId: acesso.partidaId, acessoId: acesso.id, tipo: 'CODIGO_INCORRETO', resultado: 'negado' })
    if (proximo.bloqueadoAte) return error('Muitas tentativas. Aguarde 15 minutos e tente novamente.', 429)
    return error(MENSAGEM_CODIGO, 401)
  }

  await supabase.from('AcessoArbitroJogo').update({
    tentativasFalhas: 0,
    bloqueadoAte: null,
    ultimoAcessoEm: new Date().toISOString(),
    atualizadoEm: new Date().toISOString(),
  }).eq('id', acesso.id)
  await registrarEventoAcesso({ partidaId: acesso.partidaId, acessoId: acesso.id, tipo: 'ACESSO_REALIZADO', resultado: 'ok' })

  const cookie = await gravarSessaoAcesso(acesso)
  const partida = acesso.partida
  const resposta = success({
    redirectTo: destinoDepoisDoCodigo({
      id: Number(partida.id),
      status: partida.status,
      sumulaToken: partida.sumulaToken,
    }, token),
  })
  resposta.cookies.set(cookie.name, cookie.value, cookie.options)
  return resposta
}

async function carregar(token: string) {
  const { data, error: falha } = await supabase
    .from('AcessoArbitroJogo')
    .select('id,partidaId,token,codigoHash,ativo,tentativasFalhas,bloqueadoAte,revogadoEm')
    .eq('token', token)
    .maybeSingle()
  if (falha) return 'falha' as const
  if (!data) return null
  const base = 'id,status,sumulaToken,dataHora,localNome,equipeA:Equipe!Partida_equipeAId_fkey(nome),equipeB:Equipe!Partida_equipeBId_fkey(nome)'
  const { data: partida } = await consultarComVaga(base, (colunas) => (
    supabase.from('Partida').select(colunas).eq('id', data.partidaId).maybeSingle()
  ))
  return { ...data, partida: partida ?? { id: data.partidaId, status: null, sumulaToken: null, dataHora: null, localNome: null, equipeA: null, equipeB: null, origemVagaA: null, origemVagaB: null } }
}
