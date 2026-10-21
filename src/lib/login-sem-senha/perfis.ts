import { configuredAdminEmail } from '@/lib/admin-access'
import { emailsConferem, padraoIlikeLiteral } from '@/lib/email-lookup'
import { tabelaAusente } from './config'

export type ClienteDb = { from(tabela: string): any }

export type TipoPerfil = 'LIDER' | 'ORGANIZADOR'

export type PerfilVinculado = {
  perfil: TipoPerfil
  referenciaId: string
  rotulo: string
  /** Campos internos para montar a sessão; não vão na resposta pública. */
  nome: string
  status: string
}

export type PerfilPublico = Pick<PerfilVinculado, 'perfil' | 'referenciaId' | 'rotulo'>

export function paraPublico(p: PerfilVinculado): PerfilPublico {
  return { perfil: p.perfil, referenciaId: p.referenciaId, rotulo: p.rotulo }
}

// Espelha RELEASED_PUBLIC_STATUSES de auth.ts (sem importar next/headers aqui).
const RELEASED_PUBLIC_STATUSES = ['APROVADA', 'APROVADO', 'ATIVA', 'ATIVO', 'LIBERADA', 'LIBERADO']

function liberado(status: unknown) {
  return RELEASED_PUBLIC_STATUSES.includes(String(status ?? '').trim().toUpperCase())
}

async function consultar(consulta: PromiseLike<{ data: any; error: any }>) {
  const { data, error } = await consulta
  if (error) {
    if (tabelaAusente(error) || /column .* does not exist/i.test(String(error.message ?? ''))) return []
    throw new Error(String(error.message ?? 'erro de banco'))
  }
  return (Array.isArray(data) ? data : []) as Record<string, unknown>[]
}

/** Perfis ligados ao e-mail. Administrador nunca entra aqui: o acesso dele é só por senha. */
export async function listarPerfis(db: ClienteDb, emailNormalizado: string): Promise<PerfilVinculado[]> {
  const encontrados = new Map<string, PerfilVinculado>()
  const adicionar = (p: PerfilVinculado) => {
    const chave = `${p.perfil}:${p.referenciaId}`
    if (!encontrados.has(chave)) encontrados.set(chave, p)
  }

  const equipes = (await consultar(
    db.from('CandidaturaEquipe').select('id,email,nome,responsavel,status').ilike('email', padraoIlikeLiteral(emailNormalizado)).limit(20),
  )).filter((l) => emailsConferem(emailNormalizado, l.email))
  const organizadores = (await consultar(
    db.from('CandidaturaOrganizador').select('id,email,nome,status').ilike('email', padraoIlikeLiteral(emailNormalizado)).limit(20),
  )).filter((l) => emailsConferem(emailNormalizado, l.email) && liberado(l.status))

  const vinculos = await consultar(
    db.from('PessoaPerfil').select('perfil,referenciaId').eq('emailNormalizado', emailNormalizado).limit(50),
  )

  for (const v of vinculos) {
    const referenciaId = String(v.referenciaId ?? '')
    if (!referenciaId) continue
    if (v.perfil === 'LIDER') {
      const equipe = (await consultar(db.from('CandidaturaEquipe').select('id,nome,responsavel,status').eq('id', referenciaId).limit(1)))[0]
      const nome = String(equipe?.nome || equipe?.responsavel || '')
      adicionar({ perfil: 'LIDER', referenciaId, nome, status: String(equipe?.status || 'ATIVA'), rotulo: nome ? `Líder · ${nome}` : 'Líder' })
    } else if (v.perfil === 'ORGANIZADOR') {
      const org = (await consultar(db.from('CandidaturaOrganizador').select('id,nome,status').eq('id', referenciaId).limit(1)))[0]
      if (!org || !liberado(org.status)) continue
      const nome = String(org.nome || '')
      adicionar({ perfil: 'ORGANIZADOR', referenciaId, nome, status: String(org.status), rotulo: nome ? `Organizador · ${nome}` : 'Organizador' })
    }
  }

  for (const e of equipes) {
    const nome = String(e.nome || e.responsavel || '')
    adicionar({ perfil: 'LIDER', referenciaId: String(e.id), nome, status: String(e.status || 'PENDENTE'), rotulo: nome ? `Líder · ${nome}` : 'Líder' })
  }
  for (const o of organizadores) {
    const nome = String(o.nome || '')
    adicionar({ perfil: 'ORGANIZADOR', referenciaId: String(o.id), nome, status: String(o.status), rotulo: nome ? `Organizador · ${nome}` : 'Organizador' })
  }

  return Array.from(encontrados.values())
}

/** O e-mail pertence a um administrador? Se sim, o acesso por código é recusado. */
export async function emailDeAdministrador(db: ClienteDb, emailNormalizado: string) {
  if (configuredAdminEmail() === emailNormalizado) return true
  const { data, error } = await db.from('Admin').select('email').ilike('email', padraoIlikeLiteral(emailNormalizado)).limit(1)
  if (error) {
    if (tabelaAusente(error)) return false
    throw new Error(String(error.message ?? 'erro de banco'))
  }
  return Array.isArray(data) && data.some((l: any) => emailsConferem(emailNormalizado, l.email))
}
