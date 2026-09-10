import { NextRequest } from 'next/server'
import { success, error } from '@/lib/api-response'
import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { requirePublicRole, type PublicUserRole } from '@/lib/auth'
import {
  candidaturaTipoSchema,
  candidaturaUpdateSchemas,
  selectByCandidaturaTipo,
  tableByCandidaturaTipo,
} from '@/lib/candidatura-edit'
import { duplicateDatabaseMessage, formatCadastroPhone } from '@/lib/candidatura-duplicates'
import { errorDetail } from '@/lib/error-detail'

type Params = {
  params: {
    tipo: string
    id: string
  }
}

function roleFromTipo(tipo: 'equipe' | 'arbitro' | 'quadra'): PublicUserRole {
  return tipo
}

async function requireOwner(req: NextRequest, tipo: 'equipe' | 'arbitro' | 'quadra', id: string) {
  const auth = await requirePublicRole(req, [roleFromTipo(tipo)])
  if (auth instanceof Response) return auth
  if (auth.userId !== id) return error('Voce nao pode acessar dados de outra candidatura.', 403)
  return auth
}

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const parsedTipo = candidaturaTipoSchema.safeParse(params.tipo)
    if (!parsedTipo.success) return error('Tipo de candidatura invalido', 400)

    const tipo = parsedTipo.data
    const auth = await requireOwner(req, tipo, params.id)
    if (auth instanceof Response) return auth

    const { data, error: err } = await supabase
      .from(tableByCandidaturaTipo[tipo])
      .select(selectByCandidaturaTipo[tipo])
      .eq('id', params.id)
      .maybeSingle()

    if (err) throw err
    if (!data) return error('Candidatura nao encontrada', 404)

    return success({ tipo, candidatura: data })
  } catch (err) {
    console.error('[candidaturas/public/get] erro', err)
    return error(`Erro ao buscar candidatura: ${errorDetail(err)}`, 500)
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const parsedTipo = candidaturaTipoSchema.safeParse(params.tipo)
    if (!parsedTipo.success) return error('Tipo de candidatura invalido', 400)

    const tipo = parsedTipo.data
    const auth = await requireOwner(req, tipo, params.id)
    if (auth instanceof Response) return auth

    const body = await req.json()
    const parsedBody = candidaturaUpdateSchemas[tipo].safeParse(body)
    if (!parsedBody.success) return error('Dados invalidos', 422, parsedBody.error.flatten())

    const table = tableByCandidaturaTipo[tipo]
    const { data: current, error: currentErr } = await supabase
      .from(table)
      .select(tipo === 'equipe' ? 'id,email,telefone,status,equipeId' : 'id,email,telefone,status')
      .eq('id', params.id)
      .maybeSingle()

    if (currentErr) throw currentErr
    if (!current) return error('Candidatura nao encontrada', 404)
    const currentRecord = current as unknown as Record<string, unknown>
    const currentStatus = String(currentRecord.status || '').toUpperCase()
    const equipeLiberada = tipo === 'equipe' && ['APROVADA', 'APROVADO', 'ATIVA', 'ATIVO'].includes(currentStatus)
    if (currentStatus !== 'PENDENTE' && !equipeLiberada) {
      return error('Esta candidatura ja saiu da etapa de analise e nao pode mais ser editada.', 409)
    }

    const update = normalizeUpdatePayload(tipo, parsedBody.data)

    const { data, error: updateErr } = await supabase
      .from(table)
      .update(update)
      .eq('id', params.id)
      .select(selectByCandidaturaTipo[tipo])
      .single()

    if (updateErr) throw updateErr
    if (tipo === 'equipe' && currentRecord.equipeId) {
      await syncEquipeFromCandidatura(Number(currentRecord.equipeId), update)
    }

    return success({ candidatura: data, mensagem: 'Dados atualizados para analise.' })
  } catch (err) {
    const detail = errorDetail(err)
    const duplicateError = duplicateDatabaseMessage(detail)
    if (duplicateError) return error(duplicateError, 409)
    console.error('[candidaturas/public/patch] erro', err)
    return error(`Erro ao atualizar candidatura: ${detail}`, 500)
  }
}

function normalizeUpdatePayload(tipo: 'equipe' | 'arbitro' | 'quadra', data: Record<string, unknown>) {
  if (tipo === 'equipe') {
    const genero = String(data.genero || 'MASCULINO')
    return {
      nome: data.nome,
      responsavel: data.responsavel,
      telefone: formatCadastroPhone(String(data.telefone || '')),
      emblemaUrl: data.emblemaUrl || null,
      genero,
      categoria: genero,
      categoriaEtaria: data.categoriaEtaria || null,
      nivel: data.nivel || null,
      temInstagram: Boolean(data.temInstagram),
      instagram: data.temInstagram ? String(data.instagram || '').replace(/^@/, '').trim() : null,
      diasDisponiveis: JSON.stringify(data.diasDisponiveis || []),
      horarios: JSON.stringify(data.horarios || { manha: false, tarde: false, noite: false }),
      quadraInfo: JSON.stringify(data.quadraInfo || {}),
    }
  }

  if (tipo === 'arbitro') {
    return {
      nome: data.nome,
      telefone: formatCadastroPhone(String(data.telefone || '')),
      cref: data.cref || null,
      diplomaUrl: data.diplomaUrl || null,
    }
  }

  return {
    nome: data.nome,
    responsavel: data.responsavel,
    telefone: formatCadastroPhone(String(data.telefone || '')),
    cep: data.cep || null,
    endereco: data.endereco,
    bairro: data.bairro || null,
    estrutura: data.estrutura || null,
    horarios: JSON.stringify(data.horarios || { horariosDisponiveis: [] }),
    fotosUrls: JSON.stringify(data.fotosUrls || []),
    cobertura: Boolean(data.cobertura),
    banheiro: Boolean(data.banheiro),
    estacionamento: Boolean(data.estacionamento),
  }
}

async function syncEquipeFromCandidatura(equipeId: number, update: Record<string, unknown>) {
  const equipeUpdate: Record<string, unknown> = {}
  if ('nome' in update) equipeUpdate.nome = update.nome
  if ('categoria' in update) equipeUpdate.categoria = update.categoria
  if ('emblemaUrl' in update) {
    equipeUpdate.emblemaUrl = update.emblemaUrl || null
    equipeUpdate.logoUrl = update.emblemaUrl || null
  }
  if ('diasDisponiveis' in update) equipeUpdate.diasDisponiveis = update.diasDisponiveis
  if ('horarios' in update) equipeUpdate.horarios = update.horarios
  if ('quadraInfo' in update) equipeUpdate.quadraInfo = update.quadraInfo

  if (!Object.keys(equipeUpdate).length) return
  const { error: err } = await supabase.from('Equipe').update(equipeUpdate).eq('id', equipeId)
  if (err) throw err
}
