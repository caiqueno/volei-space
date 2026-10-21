// Cria as entregas por canal ("NotificacaoEntrega") de uma notificação interna já gravada.
// Nunca lança: notificar não pode derrubar a operação principal. Sem tabela (migration pendente) não cria nada.
import { supabaseAdmin } from '@/lib/supabase-admin'
import { contatosDoUsuario } from './contatos'
import { CANAIS, type Canal } from './flags'
import { padraoDoCanal, preferenciaGravada } from './preferencias'

const db = supabaseAdmin as any

/**
 * Canais externos que valem para este usuário e tipo:
 *   EMAIL: preferência gravada, senão ligado só para tipos críticos; precisa de e-mail válido.
 *   WHATSAPP: só se ativado e com telefone cadastrado válido.
 *   PUSH: só se ativado e com ao menos uma assinatura.
 */
export async function canaisDaEntrega(usuarioId: string, tipo: string): Promise<Canal[]> {
  const contatos = await contatosDoUsuario(usuarioId)
  const escolhidos: Canal[] = []
  for (const canal of CANAIS) {
    const gravada = await preferenciaGravada(usuarioId, canal, tipo)
    const ativo = gravada ?? padraoDoCanal(canal, tipo)
    if (!ativo) continue
    if (canal === 'EMAIL' && !contatos.email) continue
    if (canal === 'WHATSAPP' && !contatos.telefone) continue
    if (canal === 'PUSH' && !(await temAssinaturaPush(usuarioId))) continue
    escolhidos.push(canal)
  }
  return escolhidos
}

export async function temAssinaturaPush(usuarioId: string) {
  const r = await db.from('PushAssinatura').select('id').eq('usuarioId', usuarioId).limit(1)
  return !r.error && Array.isArray(r.data) && r.data.length > 0
}

export async function criarEntregas(usuarioId: string, notificacaoId: string, tipo: string, agora = new Date()): Promise<number> {
  try {
    const canais = await canaisDaEntrega(usuarioId, tipo)
    if (canais.length === 0) return 0
    const criadoEm = agora.toISOString()
    const resposta = await db.from('NotificacaoEntrega').insert(
      canais.map((canal) => ({ notificacaoId, canal, estado: 'PENDENTE', tentativas: 0, criadoEm, proximaTentativaEm: criadoEm })),
    )
    if (resposta.error) {
      console.warn('[notificacoes-canais] entregas não gravadas', resposta.error.code ?? '')
      return 0
    }
    return canais.length
  } catch {
    return 0
  }
}
