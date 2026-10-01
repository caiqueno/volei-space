import { randomBytes } from 'crypto'
import type { NextRequest } from 'next/server'
import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { error } from '@/lib/api-response'
import { requirePublicRole } from '@/lib/auth'

export function novoTokenInscricao() {
  return randomBytes(16).toString('hex')
}

export function caminhoInscricaoCampeonato(token: string) {
  return `/inscricao/campeonato/${token}`
}

export async function registrarEventoInscricao(entrada: {
  ligaId: number
  linkId?: string | null
  tipo: 'LINK_INSCRICAO_GERADO' | 'LINK_INSCRICAO_ACESSADO' | 'LINK_INSCRICAO_DESATIVADO' | 'LINK_INSCRICAO_REATIVADO' | 'LINK_INSCRICAO_REGENERADO' | 'INSCRICAO_EQUIPE_REALIZADA'
  organizadorId?: string | null
  resultado: 'ok' | 'negado'
}) {
  await supabase.from('LinkInscricaoEvento').insert({
    ligaId: entrada.ligaId,
    linkId: entrada.linkId ?? null,
    tipo: entrada.tipo,
    organizadorId: entrada.organizadorId ?? null,
    resultado: entrada.resultado,
  })
}

export async function ligaDoOrganizador(req: NextRequest, ligaId: number) {
  const auth = await requirePublicRole(req, ['organizador'], { releasedOnly: true })
  if (auth instanceof Response) return auth
  if (!Number.isInteger(ligaId) || ligaId <= 0) return error('Campeonato inválido.', 400)
  const { data, error: falha } = await supabase.from('Liga').select('id,nome,organizadorId,status,inscricoesAbertas,inscricoesAberturaEm,inscricoesEncerramentoEm').eq('id', ligaId).maybeSingle()
  if (falha || !data) return error('Campeonato não encontrado.', 404)
  if (String(data.organizadorId) !== String(auth.userId)) return error('Este campeonato não pertence à sua organização.', 403)
  return { auth, liga: data }
}

export function resumoLink(acesso: { token?: string; ativo?: boolean; revogadoEm?: string | null } | null) {
  if (!acesso?.token) return { status: 'SEM_LINK' as const, caminho: null }
  if (!acesso.ativo || acesso.revogadoEm) return { status: 'DESATIVADO' as const, caminho: caminhoInscricaoCampeonato(acesso.token) }
  return { status: 'ATIVO' as const, caminho: caminhoInscricaoCampeonato(acesso.token) }
}

const LIGA_PUBLICA = 'id,nome,nomeCurto,status,simulacao,inscricoesAbertas,inscricoesAberturaEm,inscricoesEncerramentoEm,formularioInscricaoConfig,categoriasConfig,dataInicio'

export async function carregarInscricaoPorToken(token: string) {
  const { data: link, error: falha } = await supabase
    .from('LinkInscricaoCampeonato')
    .select('id,ligaId,token,ativo,revogadoEm')
    .eq('token', token)
    .maybeSingle()
  if (falha) return { falha: true as const }
  if (!link) return { falha: false as const, link: null }
  const { data: liga } = await supabase.from('Liga').select(LIGA_PUBLICA).eq('id', link.ligaId).maybeSingle()
  return { falha: false as const, link, liga }
}

export function periodoInscricao(liga: { status: string; inscricoesAbertas: boolean | null; inscricoesAberturaEm: string | null; inscricoesEncerramentoEm: string | null }) {
  const agora = new Date()
  if (liga.status === 'FINALIZADO' || liga.inscricoesAbertas === false) return 'fechado' as const
  if (!['EM_BREVE', 'ATIVA'].includes(liga.status)) return 'fechado' as const
  if (liga.inscricoesAberturaEm && agora < new Date(liga.inscricoesAberturaEm)) return 'antes' as const
  if (liga.inscricoesEncerramentoEm && agora > new Date(liga.inscricoesEncerramentoEm)) return 'depois' as const
  return 'aberto' as const
}
