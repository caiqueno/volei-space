import { NextRequest } from 'next/server'
import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { success, error } from '@/lib/api-response'
import { ligaDoOrganizador, novoTokenInscricao } from '@/lib/link-inscricao-campeonato'
import { slugify } from '@/utils/slug'

const CATALOGO = [
  { codigo: 'FEMININO', nome: 'Feminino', slug: 'feminino' },
  { codigo: 'FEMININO_MASTER', nome: 'Feminino Master', slug: 'feminino-master' },
  { codigo: 'MISTO', nome: 'Misto', slug: 'misto' },
  { codigo: 'MASCULINO', nome: 'Masculino', slug: 'masculino' },
  { codigo: 'MASCULINO_MASTER', nome: 'Masculino Master', slug: 'masculino-master' },
] as const

function identidadeDaCategoria(nome: string) {
  const chave = nome.trim().toLocaleLowerCase('pt-BR')
  const catalogo = CATALOGO.find((item) => item.nome.toLocaleLowerCase('pt-BR') === chave)
  if (catalogo) return { codigo: catalogo.codigo, nome: catalogo.nome, slug: catalogo.slug }
  const slug = slugify(nome).slice(0, 40) || 'categoria'
  return { codigo: slug, nome, slug }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ligaId = Number(id)
  const acesso = await ligaDoOrganizador(req, ligaId)
  if (acesso instanceof Response) return acesso

  const body = await req.json().catch(() => ({}))
  const nome = String(body.nome ?? '').trim()
  if (nome.length < 2) return error('Informe o nome da categoria.', 422)

  const identidade = identidadeDaCategoria(nome)
  const { data: existente } = await supabase
    .from('CategoriaCampeonato')
    .select('id,tokenInscricao')
    .eq('ligaId', ligaId)
    .eq('codigo', identidade.codigo)
    .is('removidaEm', null)
    .maybeSingle()

  let categoriaId = existente?.id as string | undefined
  let token = existente?.tokenInscricao as string | null | undefined
  if (!categoriaId) {
    const { data: criada, error: gravacao } = await supabase
      .from('CategoriaCampeonato')
      .insert({ ligaId, codigo: identidade.codigo, nome: identidade.nome, slug: identidade.slug, ordem: 1, statusConfiguracao: 'NAO_INICIADA' })
      .select('id,tokenInscricao')
      .single()
    if (gravacao || !criada) return error('Não foi possível criar a categoria.', 500)
    categoriaId = criada.id
    token = criada.tokenInscricao
  }

  if (!token) {
    token = novoTokenInscricao()
    const { error: gravacao } = await supabase.from('CategoriaCampeonato').update({ tokenInscricao: token }).eq('id', categoriaId).is('tokenInscricao', null)
    if (gravacao) return error('Não foi possível gerar o link da categoria.', 500)
  }

  return success({ categoriaId, caminho: `/inscricao/categoria/${token}` })
}
