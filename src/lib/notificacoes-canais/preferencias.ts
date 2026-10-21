// Preferências de notificação por canal e tipo ("PreferenciaNotificacao", migration pendente do agente de banco).
// Padrão: a notificação interna sempre existe; EMAIL vem ligado para tipos críticos; WHATSAPP e PUSH só se o
// usuário ativou e há canal válido (telefone cadastrado, assinatura push).
import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { ErroMeuTime, tabelaAusente, violacaoUnica } from '@/lib/meu-time/acesso'
import { CANAIS, MENSAGEM_CANAIS_NAO_HABILITADO, TIPOS_CRITICOS, TIPOS_NOTIFICACAO, type Canal } from './flags'

const db = supabaseAdmin as any

export const preferenciaSchema = z.object({
  canal: z.enum(CANAIS),
  tipo: z.enum(TIPOS_NOTIFICACAO),
  ativo: z.boolean(),
})
export type EntradaPreferencia = z.infer<typeof preferenciaSchema>

export type Preferencia = { canal: Canal; tipo: string; ativo: boolean }

function indisponivel() {
  return new ErroMeuTime(MENSAGEM_CANAIS_NAO_HABILITADO, 503, 'RECURSO_NAO_HABILITADO')
}

function ler<T>(resultado: { data: T | null; error: { code?: string | null; message?: string | null } | null }, onde: string): T | null {
  if (!resultado.error) return resultado.data
  if (tabelaAusente(resultado.error) || resultado.error.code === '42703') throw indisponivel()
  console.error(`[notificacoes-canais] ${onde}`, resultado.error.code ?? '')
  throw new ErroMeuTime('Não foi possível concluir a operação. Tente novamente.', 500)
}

/** Valor padrão de um canal para um tipo, sem preferência gravada. */
export function padraoDoCanal(canal: Canal, tipo: string) {
  return canal === 'EMAIL' && TIPOS_CRITICOS.includes(tipo)
}

export async function listarPreferencias(usuarioId: string) {
  const linhas = (ler(await db.from('PreferenciaNotificacao').select('canal,tipo,ativo').eq('usuarioId', usuarioId), 'listar preferências') as any[] | null) ?? []
  const gravadas = new Map<string, boolean>(linhas.map((l) => [`${l.canal}|${l.tipo}`, Boolean(l.ativo)]))
  // Matriz completa canal x tipo já com o padrão aplicado, para a tela só desenhar.
  const itens: Preferencia[] = []
  for (const canal of CANAIS) {
    for (const tipo of TIPOS_NOTIFICACAO) {
      itens.push({ canal, tipo, ativo: gravadas.get(`${canal}|${tipo}`) ?? padraoDoCanal(canal, tipo) })
    }
  }
  return { itens, padroes: { interna: 'SEMPRE', email: 'TIPOS_CRITICOS', whatsapp: 'SOMENTE_SE_ATIVADO', push: 'SOMENTE_SE_ATIVADO' } }
}

/** Idempotente: gravar o mesmo valor de novo continua 200. */
export async function salvarPreferencia(usuarioId: string, entrada: EntradaPreferencia): Promise<Preferencia> {
  const chave = { usuarioId, canal: entrada.canal, tipo: entrada.tipo }
  const atual = ler(
    await db.from('PreferenciaNotificacao').select('id').eq('usuarioId', usuarioId).eq('canal', entrada.canal).eq('tipo', entrada.tipo).maybeSingle(),
    'ler preferência',
  ) as { id: string } | null
  if (atual) {
    ler(await db.from('PreferenciaNotificacao').update({ ativo: entrada.ativo }).eq('id', atual.id).eq('usuarioId', usuarioId), 'atualizar preferência')
  } else {
    const criada = await db.from('PreferenciaNotificacao').insert({ ...chave, ativo: entrada.ativo })
    if (violacaoUnica(criada.error)) {
      // Corrida com outra requisição: o registro já existe, só atualiza.
      ler(await db.from('PreferenciaNotificacao').update({ ativo: entrada.ativo }).eq('usuarioId', usuarioId).eq('canal', entrada.canal).eq('tipo', entrada.tipo), 'atualizar preferência')
    } else {
      ler(criada, 'criar preferência')
    }
  }
  return { canal: entrada.canal, tipo: entrada.tipo, ativo: entrada.ativo }
}

/** Preferência gravada (true/false) ou undefined. Tabela ausente = undefined (vale o padrão). */
export async function preferenciaGravada(usuarioId: string, canal: Canal, tipo: string): Promise<boolean | undefined> {
  const r = await db.from('PreferenciaNotificacao').select('ativo').eq('usuarioId', usuarioId).eq('canal', canal).eq('tipo', tipo).maybeSingle()
  if (r.error || !r.data) return undefined
  return Boolean(r.data.ativo)
}
