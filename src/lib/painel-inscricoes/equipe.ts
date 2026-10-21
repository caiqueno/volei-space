// Equipe da organização (R18): membros com papel ADMINISTRADOR, FINANCEIRO ou ARBITRAGEM sobre "MembroOrganizador".
// "Organizador"."legadoId" = id da conta do dono (= "Liga"."organizadorId"); "MembroOrganizador"."usuarioId" = id da conta do membro
// (CandidaturaOrganizador). Regras: dono e ADMINISTRADOR gerenciam; só o dono concede ou retira ADMINISTRADOR;
// FINANCEIRO e ARBITRAGEM só leem. A resposta de adicionar é uniforme: não revela se o e-mail tem conta.
import { z } from 'zod'
import { padraoIlikeLiteral } from '@/lib/email-lookup'
import { mascararDestino } from '@/lib/mensageria'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { ErroMeuTime, violacaoUnica } from '@/lib/meu-time/acesso'
import { PAPEIS_MEMBRO, lerPainel, papelPodeEscrever, type PapelNoOrganizador } from './acesso'

const db = supabaseAdmin as any

export const MENSAGEM_MEMBRO_UNIFORME = 'Pedido recebido. Se houver uma conta de organizador com esse e-mail, a pessoa passa a fazer parte da equipe.'

export const membroSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(320),
  papel: z.enum(PAPEIS_MEMBRO),
})
export const remocaoSchema = z
  .object({
    email: z.string().trim().toLowerCase().email().max(320).optional(),
    usuarioId: z.string().trim().min(1).max(100).optional(),
    /** Se enviado, precisa coincidir com o papel atual do membro (confirmação do que a tela mostra). */
    papel: z.enum(PAPEIS_MEMBRO).optional(),
  })
  .refine((v) => Boolean(v.email || v.usuarioId), 'informe o e-mail ou o usuário')

type Organizacao = { id: string; legadoId: string; papel: PapelNoOrganizador }

/** Organização da pessoa: a própria (dono) ou aquela em que é membro. Dono sem registro ainda: `criar` o cria. */
async function organizacaoDe(usuarioId: string, nome: string, criar: boolean): Promise<Organizacao | null> {
  const propria = lerPainel(await db.from('Organizador').select('id,legadoId').eq('legadoId', usuarioId).maybeSingle(), 'organização') as { id: string; legadoId: string } | null
  if (propria) return { id: propria.id, legadoId: propria.legadoId, papel: 'DONO' }
  const vinculo = lerPainel(await db.from('MembroOrganizador').select('organizadorId,papel').eq('usuarioId', usuarioId).limit(1), 'vínculo') as Array<{ organizadorId: string; papel: PapelNoOrganizador }> | null
  if (vinculo && vinculo.length > 0) {
    const org = lerPainel(await db.from('Organizador').select('id,legadoId').eq('id', vinculo[0].organizadorId).maybeSingle(), 'organização') as { id: string; legadoId: string } | null
    if (org) return { id: org.id, legadoId: org.legadoId, papel: vinculo[0].papel }
  }
  if (!criar) return null
  // Dono ainda sem o registro (backfill pendente): cria agora, com o nome da própria conta.
  const criada = await db.from('Organizador').insert({ nome: nome.trim() || 'Organizador', legadoId: usuarioId }).select('id,legadoId').single()
  if (violacaoUnica(criada.error)) {
    const de_novo = lerPainel(await db.from('Organizador').select('id,legadoId').eq('legadoId', usuarioId).maybeSingle(), 'organização') as { id: string; legadoId: string } | null
    return de_novo ? { id: de_novo.id, legadoId: de_novo.legadoId, papel: 'DONO' } : null
  }
  const dados = lerPainel(criada, 'criar organização') as { id: string; legadoId: string } | null
  return dados ? { id: dados.id, legadoId: dados.legadoId, papel: 'DONO' } : null
}

async function contaPorEmail(email: string): Promise<string | null> {
  const r = await db.from('CandidaturaOrganizador').select('id,email').ilike('email', padraoIlikeLiteral(email)).limit(1)
  if (r.error) return null
  const linha = ((r.data ?? []) as any[])[0]
  return linha && String(linha.email).trim().toLowerCase() === email ? String(linha.id) : null
}

async function dadosDasContas(ids: string[]) {
  const mapa = new Map<string, { nome: string; email: string }>()
  if (ids.length === 0) return mapa
  const r = await db.from('CandidaturaOrganizador').select('id,nome,email').in('id', ids)
  for (const l of (r.error ? [] : r.data ?? []) as any[]) mapa.set(String(l.id), { nome: String(l.nome ?? ''), email: String(l.email ?? '') })
  return mapa
}

export async function listarEquipe(usuarioId: string, nome: string) {
  const org = await organizacaoDe(usuarioId, nome, false)
  if (!org) return { meuPapel: 'DONO' as PapelNoOrganizador, membros: [] as unknown[] }
  const membros = (lerPainel(await db.from('MembroOrganizador').select('usuarioId,papel,criadoEm').eq('organizadorId', org.id), 'membros') as any[] | null) ?? []
  const contas = await dadosDasContas(membros.map((m) => String(m.usuarioId)))
  // Quem gerencia vê o e-mail inteiro (precisa dele para remover); quem só lê vê mascarado.
  const gestor = papelPodeEscrever(org.papel)
  return {
    meuPapel: org.papel,
    membros: membros.map((m) => {
      const conta = contas.get(String(m.usuarioId))
      const email = conta?.email ?? ''
      return { email: gestor ? email : email ? mascararDestino(email) : '', papel: m.papel as string, nome: conta?.nome ?? '', status: 'ATIVO' }
    }),
  }
}

function exigirGestao(org: Organizacao | null, papelPedido: string) {
  if (!org || !papelPodeEscrever(org.papel)) {
    throw new ErroMeuTime('Seu papel na organização só permite consultar.', 403, 'SEM_PERMISSAO')
  }
  if (papelPedido === 'ADMINISTRADOR' && org.papel !== 'DONO') {
    throw new ErroMeuTime('Só o dono da organização concede ou retira o papel de administrador.', 403, 'SEM_PERMISSAO')
  }
}

export async function adicionarMembroDaEquipe(usuarioId: string, nome: string, entrada: z.infer<typeof membroSchema>) {
  const org = await organizacaoDe(usuarioId, nome, true)
  exigirGestao(org, entrada.papel)
  const contaId = await contaPorEmail(entrada.email)
  if (contaId && contaId !== org!.legadoId) {
    const existente = lerPainel(await db.from('MembroOrganizador').select('papel').eq('organizadorId', org!.id).eq('usuarioId', contaId).maybeSingle(), 'membro') as { papel: string } | null
    if (existente) {
      // Trocar o papel de um administrador também é coisa do dono.
      if (existente.papel === 'ADMINISTRADOR') exigirGestao(org, 'ADMINISTRADOR')
      lerPainel(await db.from('MembroOrganizador').update({ papel: entrada.papel }).eq('organizadorId', org!.id).eq('usuarioId', contaId), 'trocar papel')
    } else {
      const criada = await db.from('MembroOrganizador').insert({ organizadorId: org!.id, usuarioId: contaId, papel: entrada.papel })
      if (!violacaoUnica(criada.error)) lerPainel(criada, 'adicionar membro')
    }
  }
  return { mensagem: MENSAGEM_MEMBRO_UNIFORME }
}

export async function removerMembroDaEquipe(usuarioId: string, nome: string, entrada: z.infer<typeof remocaoSchema>) {
  const org = await organizacaoDe(usuarioId, nome, false)
  exigirGestao(org, 'FINANCEIRO')
  const alvoId = entrada.usuarioId ?? (entrada.email ? await contaPorEmail(entrada.email) : null)
  const membro = alvoId
    ? (lerPainel(await db.from('MembroOrganizador').select('papel').eq('organizadorId', org!.id).eq('usuarioId', alvoId).maybeSingle(), 'membro') as { papel: string } | null)
    : null
  if (!alvoId || !membro || (entrada.papel && entrada.papel !== membro.papel)) throw new ErroMeuTime('Membro não encontrado.', 404, 'MEMBRO_NAO_ENCONTRADO')
  if (membro.papel === 'ADMINISTRADOR') exigirGestao(org, 'ADMINISTRADOR')
  lerPainel(await db.from('MembroOrganizador').delete().eq('organizadorId', org!.id).eq('usuarioId', alvoId), 'remover membro')
  return { removido: true }
}
