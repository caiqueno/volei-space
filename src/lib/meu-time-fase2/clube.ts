// Clube do usuário (Meu Time, fase 2). Usa as tabelas existentes Clube / TimeClube / VinculoAtletaClube.
import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { ErroMeuTime } from '@/lib/meu-time/acesso'
import { exigirEquipe, listarEquipesDoUsuario } from '@/lib/meu-time/dados'
import { lerFase2 } from '@/lib/meu-time-fase2/acesso'

export type ClubeUsuario = { id: string; nome: string; cidade: string | null }

async function clubeDoUsuario(usuarioId: string): Promise<ClubeUsuario | null> {
  const linhas = lerFase2(
    await supabase.from('Clube').select('id,nome,cidade').eq('criadoPor', usuarioId).is('arquivadoEm', null).order('nome', { ascending: true }).limit(1),
    'clube do usuário',
  ) as Array<{ id: string; nome: string; cidade: string | null }> | null
  const linha = linhas?.[0]
  return linha ? { id: linha.id, nome: linha.nome, cidade: linha.cidade ?? null } : null
}

async function equipesDoClube(usuarioId: string, clubeId: string) {
  const equipes = await listarEquipesDoUsuario(usuarioId)
  return equipes.filter((e) => e.clubeId === clubeId).map((e) => ({ id: e.id, nome: e.nome, cidade: e.cidade, naipe: e.naipe }))
}

export async function verClube(usuarioId: string) {
  const clube = await clubeDoUsuario(usuarioId)
  if (!clube) throw new ErroMeuTime('Você ainda não tem um clube.', 404, 'CLUBE_NAO_ENCONTRADO')
  return { ...clube, equipes: await equipesDoClube(usuarioId, clube.id) }
}

/** Idempotente: quem já tem clube recebe o existente (criado=false), sem criar outro. */
export async function criarClube(usuarioId: string, entrada: { nome: string; cidade?: string | null }) {
  const existente = await clubeDoUsuario(usuarioId)
  if (existente) return { criado: false, clube: { ...existente, equipes: await equipesDoClube(usuarioId, existente.id) } }
  const criado = lerFase2(
    await supabase.from('Clube').insert({ nome: entrada.nome, cidade: entrada.cidade || null, origem: 'APP', criadoPor: usuarioId }).select('id,nome,cidade').single(),
    'criar clube',
  ) as { id: string; nome: string; cidade: string | null } | null
  if (!criado) throw new ErroMeuTime('Não foi possível criar o clube.', 500)
  return { criado: true, clube: { id: criado.id, nome: criado.nome, cidade: criado.cidade ?? null, equipes: [] as never[] } }
}

/**
 * Vincula ao clube do usuário uma equipe que ele lidera (papel RESPONSAVEL). O banco de atletas é por
 * clube, então só se move equipe que é a única do clube de origem; os atletas vão junto. Se o clube de
 * origem tem outras equipes, 409 (mover quebraria o banco compartilhado). Idempotente.
 */
export async function vincularEquipe(usuarioId: string, equipeId: string) {
  const clube = await clubeDoUsuario(usuarioId)
  if (!clube) throw new ErroMeuTime('Crie seu clube antes de vincular equipes.', 409, 'CLUBE_NAO_ENCONTRADO')
  const { equipe } = await exigirEquipe(usuarioId, equipeId, 'responsavel')
  if (equipe.clubeId === clube.id) return { vinculada: true, jaEstava: true, clube: { id: clube.id, nome: clube.nome } }

  const irmas = (lerFase2(
    await supabase.from('TimeClube').select('id').eq('clubeId', equipe.clubeId).is('arquivadoEm', null),
    'equipes do clube de origem',
  ) as Array<{ id: string }> | null) ?? []
  if (irmas.some((item) => item.id !== equipe.id)) {
    throw new ErroMeuTime('Esta equipe divide o banco de atletas com outras equipes do clube atual e não pode ser movida.', 409, 'CLUBE_COMPARTILHADO')
  }
  lerFase2(await supabase.from('TimeClube').update({ clubeId: clube.id }).eq('id', equipe.id), 'vincular equipe ao clube')
  const mover = await supabase.from('VinculoAtletaClube').update({ clubeId: clube.id }).eq('clubeId', equipe.clubeId)
  if (mover.error) {
    await supabase.from('TimeClube').update({ clubeId: equipe.clubeId }).eq('id', equipe.id)
    lerFase2(mover, 'mover atletas para o clube')
  }
  return { vinculada: true, jaEstava: false, clube: { id: clube.id, nome: clube.nome } }
}
