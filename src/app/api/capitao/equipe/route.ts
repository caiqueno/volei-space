import { NextRequest } from 'next/server'
import { z } from 'zod'
import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { success, error } from '@/lib/api-response'
import { requirePublicRole } from '@/lib/auth'
import { ensureEquipeForCandidatura } from '@/lib/team-activation'
import { respostaEquipeNaoVinculada } from '@/lib/uploads/cadastro-incompleto'
import { normalizarNomeEquipe } from '@/lib/nome-equipe'

const equipeIdentitySchema = z.object({
  nome: z.string().trim().min(2, 'Informe o nome da equipe.').max(120).transform(normalizarNomeEquipe),
  logoUrl: z.string().trim().url('Logo invalida.').optional().nullable().or(z.literal('')),
})

export async function GET(req: NextRequest) {
  const auth = await requirePublicRole(req, ['equipe'], { releasedOnly: true })
  if (auth instanceof Response) return auth

  const equipe = await ensureEquipeForCandidatura(auth.userId)
  if (!equipe) return respostaEquipeNaoVinculada(auth.userId)

  return success(normalizeEquipe(equipe))
}

export async function PUT(req: NextRequest) {
  const auth = await requirePublicRole(req, ['equipe'], { releasedOnly: true })
  if (auth instanceof Response) return auth

  const equipe = await ensureEquipeForCandidatura(auth.userId)
  if (!equipe) return respostaEquipeNaoVinculada(auth.userId)

  const body = await req.json().catch(() => ({}))
  const parsed = equipeIdentitySchema.safeParse(body)
  if (!parsed.success) return error('Dados invalidos', 422, parsed.error.flatten())

  const payload = {
    nome: parsed.data.nome,
    logoUrl: parsed.data.logoUrl || null,
    emblemaUrl: parsed.data.logoUrl || null,
  }

  const { data, error: updateErr } = await supabase
    .from('Equipe')
    .update(payload)
    .eq('id', equipe.id)
    .select()
    .single()

  if (updateErr) {
    if (updateErr.code === '23505') return error('Ja existe uma equipe com este nome neste campeonato/categoria.', 409)
    console.error('[capitao/equipe] erro ao atualizar equipe', updateErr)
    return error('Erro ao atualizar identidade da equipe.', 500)
  }

  await supabase
    .from('CandidaturaEquipe')
    .update({
      nome: payload.nome,
      emblemaUrl: payload.logoUrl,
    })
    .eq('id', auth.userId)

  return success(normalizeEquipe(data))
}

function normalizeEquipe(equipe: any) {
  return {
    id: equipe.id,
    nome: equipe.nome,
    logoUrl: equipe.logoUrl,
    corHex: equipe.corHex,
    categoria: equipe.categoria,
    serie: equipe.serie,
    slug: equipe.slug,
  }
}
