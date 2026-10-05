import { NextRequest } from 'next/server'
import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { success, error } from '@/lib/api-response'
import { ligaDoOrganizador, novoTokenInscricao } from '@/lib/link-inscricao-campeonato'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ligaId = Number(id)
  const acesso = await ligaDoOrganizador(req, ligaId)
  if (acesso instanceof Response) return acesso

  const { data, error: falha } = await supabase
    .from('CategoriaCampeonato')
    .select('id,nome,codigo,tokenInscricao,ordem')
    .eq('ligaId', ligaId)
    .is('removidaEm', null)
    .order('ordem', { ascending: true })

  if (falha) return error('Não foi possível ler as categorias.', 500)
  return success((data ?? []).map((item) => ({
    id: item.id,
    nome: item.nome,
    codigo: item.codigo,
    caminho: item.tokenInscricao ? `/inscricao/categoria/${item.tokenInscricao}` : null,
  })))
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ligaId = Number(id)
  const acesso = await ligaDoOrganizador(req, ligaId)
  if (acesso instanceof Response) return acesso

  const body = await req.json().catch(() => ({}))
  const categoriaId = String(body.categoriaCampeonatoId ?? '')
  if (!categoriaId) return error('Informe a categoria.', 422)

  const { data: categoria, error: leitura } = await supabase
    .from('CategoriaCampeonato')
    .select('id,tokenInscricao')
    .eq('id', categoriaId)
    .eq('ligaId', ligaId)
    .is('removidaEm', null)
    .maybeSingle()
  if (leitura || !categoria) return error('Categoria não encontrada neste campeonato.', 404)

  let token = categoria.tokenInscricao as string | null
  if (!token) {
    token = novoTokenInscricao()
    const { error: gravacao } = await supabase
      .from('CategoriaCampeonato')
      .update({ tokenInscricao: token })
      .eq('id', categoria.id)
      .is('tokenInscricao', null)
    if (gravacao) return error('Não foi possível gerar o link desta categoria.', 500)
    const { data: atual } = await supabase.from('CategoriaCampeonato').select('tokenInscricao').eq('id', categoria.id).maybeSingle()
    token = atual?.tokenInscricao ?? token
  }

  return success({ caminho: `/inscricao/categoria/${token}` })
}
