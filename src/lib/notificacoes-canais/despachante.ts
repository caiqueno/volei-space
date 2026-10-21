// Despachante das entregas por canal (cron). Processa "NotificacaoEntrega" PENDENTE com limite por execução,
// recuo exponencial e no máximo 5 tentativas. Cada entrega é reivindicada antes do envio (compara e troca na
// contagem de tentativas), então duas execuções simultâneas não enviam duas vezes.
// Erros são gravados só como código curto (sem e-mail, telefone ou texto de exceção).
import { supabaseAdmin } from '@/lib/supabase-admin'
import { ErroMeuTime, tabelaAusente } from '@/lib/meu-time/acesso'
import { enviarTextoPorWhatsapp } from '@/lib/mensageria'
import { contatosDoUsuario } from './contatos'
import { LIMITE_POR_EXECUCAO, MAXIMO_TENTATIVAS, MENSAGEM_CANAIS_NAO_HABILITADO, recuoEmMs } from './flags'
import { enviarPushSemPayload, type ResultadoPush } from './push'

const db = supabaseAdmin as any

/** Tempo que uma entrega reivindicada fica "reservada" caso o processo morra no meio do envio. */
const RESERVA_MS = 10 * 60_000

export type DepsDespacho = {
  agora?: () => Date
  limite?: number
  enviarEmail?: (para: string, assunto: string, html: string) => Promise<void>
  enviarWhatsapp?: (destino: string, texto: string) => Promise<void>
  enviarPush?: (assinatura: { endpoint: string }) => Promise<ResultadoPush>
}

export type ResumoDespacho = { processadas: number; enviadas: number; reagendadas: number; falhas: number; ignoradas: number }

function escapar(texto: string) {
  return texto.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;')
}

/** Reduz qualquer erro a um código curto e seguro (sem PII). */
export function codigoDeErro(erro: unknown) {
  const bruto = erro && typeof erro === 'object' && 'code' in erro ? String((erro as { code?: unknown }).code ?? '') : ''
  if (/^[A-Z0-9_]{2,40}$/.test(bruto)) return bruto
  if (erro instanceof Error && erro.name === 'CanalIndisponivelError') return 'CANAL_INDISPONIVEL'
  if (erro instanceof Error && /respondeu (\d{3})/.test(erro.message)) return `HTTP_${/respondeu (\d{3})/.exec(erro.message)![1]}`
  return 'ERRO_ENVIO'
}

type Resultado = { tipo: 'ENVIADA' } | { tipo: 'IGNORADA'; erro: string } | { tipo: 'FALHA'; erro: string }

async function enviarEmailPadrao(para: string, assunto: string, html: string) {
  const { sendEmail } = await import('@/lib/email')
  await sendEmail({ to: para, subject: assunto, html })
}

async function entregarPush(usuarioId: string, deps: DepsDespacho): Promise<Resultado> {
  const lista = await db.from('PushAssinatura').select('id,endpoint').eq('usuarioId', usuarioId)
  if (lista.error) return { tipo: 'FALHA', erro: 'ERRO_BANCO' }
  const assinaturas = (lista.data ?? []) as Array<{ id: string; endpoint: string }>
  if (assinaturas.length === 0) return { tipo: 'IGNORADA', erro: 'SEM_ASSINATURA' }
  const enviar = deps.enviarPush ?? ((a) => enviarPushSemPayload(a))
  let enviou = false
  let removidas = 0
  let ultimo = 'ERRO_ENVIO'
  for (const assinatura of assinaturas) {
    const r = await enviar({ endpoint: assinatura.endpoint })
    if (r.ok) {
      enviou = true
      continue
    }
    ultimo = r.erro
    if (r.remover) {
      await db.from('PushAssinatura').delete().eq('id', assinatura.id)
      removidas += 1
    } else {
      await db.from('PushAssinatura').update({ ultimoErro: r.erro }).eq('id', assinatura.id)
    }
  }
  if (enviou) return { tipo: 'ENVIADA' }
  if (removidas === assinaturas.length) return { tipo: 'IGNORADA', erro: `ASSINATURA_REMOVIDA_${ultimo}` }
  return { tipo: 'FALHA', erro: ultimo }
}

async function entregar(entrega: { canal: string }, notificacao: { usuarioId: string; titulo: string; mensagem: string }, deps: DepsDespacho): Promise<Resultado> {
  if (entrega.canal === 'PUSH') return entregarPush(notificacao.usuarioId, deps)
  const contatos = await contatosDoUsuario(notificacao.usuarioId)
  try {
    if (entrega.canal === 'EMAIL') {
      if (!contatos.email) return { tipo: 'IGNORADA', erro: 'SEM_EMAIL' }
      const html = `<p><strong>${escapar(notificacao.titulo)}</strong></p><p>${escapar(notificacao.mensagem)}</p><p>Abra o volei.space para ver os detalhes.</p>`
      await (deps.enviarEmail ?? enviarEmailPadrao)(contatos.email, notificacao.titulo, html)
      return { tipo: 'ENVIADA' }
    }
    if (entrega.canal === 'WHATSAPP') {
      if (!contatos.telefone) return { tipo: 'IGNORADA', erro: 'SEM_TELEFONE' }
      await (deps.enviarWhatsapp ?? ((d, t) => enviarTextoPorWhatsapp(d, t)))(contatos.telefone, `${notificacao.titulo}: ${notificacao.mensagem}`)
      return { tipo: 'ENVIADA' }
    }
    return { tipo: 'IGNORADA', erro: 'CANAL_DESCONHECIDO' }
  } catch (erro) {
    return { tipo: 'FALHA', erro: codigoDeErro(erro) }
  }
}

export async function processarEntregas(deps: DepsDespacho = {}): Promise<ResumoDespacho> {
  const agora = (deps.agora ?? (() => new Date()))()
  const limite = Math.max(1, Math.min(deps.limite ?? LIMITE_POR_EXECUCAO, 200))
  const resumo: ResumoDespacho = { processadas: 0, enviadas: 0, reagendadas: 0, falhas: 0, ignoradas: 0 }

  const fila = await db
    .from('NotificacaoEntrega')
    .select('id,notificacaoId,canal,tentativas')
    .eq('estado', 'PENDENTE')
    .lte('proximaTentativaEm', agora.toISOString())
    .order('criadoEm', { ascending: true })
    .limit(limite)
  if (fila.error) {
    if (tabelaAusente(fila.error) || fila.error.code === '42703') throw new ErroMeuTime(MENSAGEM_CANAIS_NAO_HABILITADO, 503, 'RECURSO_NAO_HABILITADO')
    console.error('[notificacoes-canais] fila de entregas', fila.error.code ?? '')
    throw new ErroMeuTime('Não foi possível concluir a operação. Tente novamente.', 500)
  }

  for (const entrega of ((fila.data ?? []) as Array<{ id: string; notificacaoId: string; canal: string; tentativas: number }>).slice(0, limite)) {
    const feitas = Number(entrega.tentativas) || 0
    const reivindicada = await db
      .from('NotificacaoEntrega')
      .update({ tentativas: feitas + 1, proximaTentativaEm: new Date(agora.getTime() + RESERVA_MS).toISOString() })
      .eq('id', entrega.id)
      .eq('estado', 'PENDENTE')
      .eq('tentativas', feitas)
      .select('id')
    if (reivindicada.error || !Array.isArray(reivindicada.data) || reivindicada.data.length === 0) continue

    resumo.processadas += 1
    const lida = await db.from('Notificacao').select('id,usuarioId,titulo,mensagem').eq('id', entrega.notificacaoId).maybeSingle()
    const notificacao = lida.error ? null : (lida.data as { usuarioId: string; titulo: string; mensagem: string } | null)
    const resultado: Resultado = notificacao
      ? await entregar(entrega, notificacao, deps)
      : { tipo: 'IGNORADA', erro: 'NOTIFICACAO_AUSENTE' }

    if (resultado.tipo === 'ENVIADA') {
      await db.from('NotificacaoEntrega').update({ estado: 'ENVIADA', enviadoEm: agora.toISOString(), erro: null }).eq('id', entrega.id)
      resumo.enviadas += 1
    } else if (resultado.tipo === 'IGNORADA') {
      await db.from('NotificacaoEntrega').update({ estado: 'IGNORADA', erro: resultado.erro }).eq('id', entrega.id)
      resumo.ignoradas += 1
    } else if (feitas + 1 >= MAXIMO_TENTATIVAS) {
      await db.from('NotificacaoEntrega').update({ estado: 'FALHOU', erro: resultado.erro }).eq('id', entrega.id)
      resumo.falhas += 1
    } else {
      await db
        .from('NotificacaoEntrega')
        .update({ estado: 'PENDENTE', erro: resultado.erro, proximaTentativaEm: new Date(agora.getTime() + recuoEmMs(feitas + 1)).toISOString() })
        .eq('id', entrega.id)
      resumo.reagendadas += 1
    }
  }
  return resumo
}
