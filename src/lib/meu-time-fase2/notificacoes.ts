// Notificações internas do Meu Time (tabela "Notificacao", migration pendente).
import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { ErroMeuTime, idValido } from '@/lib/meu-time/acesso'
import { lerFase2 } from '@/lib/meu-time-fase2/acesso'
import { multicanalAtivo } from '@/lib/notificacoes-canais/flags'
import { criarEntregas } from '@/lib/notificacoes-canais/entrega'

export type TipoNotificacao =
  | 'CONVITE_ACEITO'
  | 'IMPORTACAO_CONFIRMADA'
  | 'AJUSTE_PEDIDO'
  // R14: solicitação de inscrição (organizador recebe a primeira; o líder recebe as duas últimas).
  | 'SOLICITACAO_INSCRICAO'
  | 'SOLICITACAO_APROVADA'
  | 'SOLICITACAO_RECUSADA'
  // R18: painel de inscrições do organizador, lista de espera, lembretes e tabela.
  | 'INSCRICAO_APROVADA'
  | 'INSCRICAO_EM_ANALISE'
  | 'INSCRICAO_RECUSADA'
  | 'INSCRICAO_LISTA_ESPERA'
  | 'INSCRICAO_PROMOVIDA'
  | 'INSCRICAO_RESPOSTA'
  | 'PRAZO_INSCRICAO'
  | 'JOGO_AMANHA'
  | 'TABELA_PUBLICADA'

export type Notificacao = {
  id: string
  tipo: string
  titulo: string
  mensagem: string
  dados: Record<string, unknown> | null
  lida: boolean
  criadaEm: string | null
}

/**
 * Cria uma notificação para o usuário. Uso interno (nunca exposto por rota). Falha em silêncio:
 * notificar não pode derrubar a operação principal (tabela ausente, rede). Não enviar PII em `dados`.
 */
export async function notificar(
  usuarioId: string,
  tipo: TipoNotificacao,
  titulo: string,
  mensagem: string,
  dados: Record<string, unknown> | null = null,
): Promise<boolean> {
  try {
    // R18 (NOTIFICACOES_MULTICANAL_ATIVO): precisa do id gravado para criar as entregas por canal.
    // Com a flag desligada o caminho é exatamente o anterior.
    const multicanal = multicanalAtivo()
    const resposta = multicanal
      ? await supabase.from('Notificacao').insert({ usuarioId, tipo, titulo, mensagem, dados }).select('id').single()
      : await supabase.from('Notificacao').insert({ usuarioId, tipo, titulo, mensagem, dados })
    if (resposta.error) {
      console.warn('[meu-time-fase2] notificação não gravada', resposta.error.code ?? '')
      return false
    }
    if (multicanal) {
      const id = (resposta.data as { id?: string } | null)?.id
      if (id) await criarEntregas(usuarioId, id, tipo)
    }
    return true
  } catch {
    return false
  }
}

function paraNotificacao(linha: any): Notificacao {
  return {
    id: linha.id,
    tipo: linha.tipo,
    titulo: linha.titulo,
    mensagem: linha.mensagem,
    dados: linha.dados ?? null,
    lida: Boolean(linha.lidaEm),
    criadaEm: linha.criadoEm ?? null,
  }
}

export async function listarNotificacoes(usuarioId: string, apenasNaoLidas = false) {
  let consulta = supabase.from('Notificacao').select('id,tipo,titulo,mensagem,dados,lidaEm,criadoEm').eq('usuarioId', usuarioId)
  if (apenasNaoLidas) consulta = consulta.is('lidaEm', null)
  const linhas = (lerFase2(await consulta.order('criadoEm', { ascending: false }).limit(100), 'listar notificações') as any[] | null) ?? []
  const itens = linhas.map(paraNotificacao)
  return { itens, naoLidas: itens.filter((item) => !item.lida).length }
}

/** Idempotente: marcar de novo uma já lida continua 200. Notificação de outro usuário "não existe" (404). */
export async function marcarLida(usuarioId: string, id: string) {
  const naoEncontrada = () => new ErroMeuTime('Notificação não encontrada.', 404, 'NOTIFICACAO_NAO_ENCONTRADA')
  if (!idValido(id)) throw naoEncontrada()
  const linha = lerFase2(
    await supabase.from('Notificacao').select('id,lidaEm').eq('id', id).eq('usuarioId', usuarioId).maybeSingle(),
    'notificação',
  ) as { id: string; lidaEm: string | null } | null
  if (!linha) throw naoEncontrada()
  if (!linha.lidaEm) {
    lerFase2(await supabase.from('Notificacao').update({ lidaEm: new Date().toISOString() }).eq('id', id).eq('usuarioId', usuarioId), 'marcar notificação lida')
  }
  return { id, lida: true }
}
