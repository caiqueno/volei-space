import { NextRequest } from 'next/server'
import { z } from 'zod'
import { success, error } from '@/lib/api-response'
import { ligaDoOrganizador } from '@/lib/link-inscricao-campeonato'
import { gerarLinkDaVaga, listarVagasDaCategoria } from '@/lib/vaga-inscricao'
import { RegistrationDraftError } from '@/lib/team-registration-draft'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ligaId = Number((await params).id)
  const acesso = await ligaDoOrganizador(req, ligaId)
  if (acesso instanceof Response) return acesso
  const categoriaId = new URL(req.url).searchParams.get('categoriaCampeonatoId')
  try {
    const quadro = await listarVagasDaCategoria(ligaId, categoriaId)
    return success(quadro)
  } catch (falha) {
    const status = falha instanceof RegistrationDraftError ? falha.status : 500
    return error(falha instanceof Error ? falha.message : 'Não foi possível ler as vagas.', status)
  }
}

const corpo = z.object({
  categoriaCampeonatoId: z.string().uuid(),
  vaga: z.number().int().positive(),
}).strict()

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ligaId = Number((await params).id)
  const acesso = await ligaDoOrganizador(req, ligaId)
  if (acesso instanceof Response) return acesso
  const json = await req.json().catch(() => null)
  const lido = corpo.safeParse(json)
  if (!lido.success) return error('Informe a categoria e a vaga.', 422)
  try {
    const link = await gerarLinkDaVaga(ligaId, lido.data.categoriaCampeonatoId, lido.data.vaga)
    return success(link)
  } catch (falha) {
    const status = falha instanceof RegistrationDraftError ? falha.status : 500
    return error(falha instanceof Error ? falha.message : 'Não foi possível gerar o link.', status)
  }
}
