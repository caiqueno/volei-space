import { NextRequest } from 'next/server'
import { normalizarNomeEquipe } from '@/lib/nome-equipe'
import { randomUUID } from 'crypto'
import { supabaseAdmin as supabase, isSupabaseServiceConfigured } from '@/lib/supabase-admin'
import { error, success } from '@/lib/api-response'
import { emailConviteEquipeCampeonato, sendEmail } from '@/lib/email'
import { requirePublicRole } from '@/lib/auth'

function appUrl(req: NextRequest) {
  return process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') ?? new URL(req.url).origin
}

export async function GET(req: NextRequest) {
  const auth = await requirePublicRole(req, ['organizador'], { releasedOnly: true })
  if (auth instanceof Response) return auth

  const { searchParams } = new URL(req.url)
  const ligaId = searchParams.get('ligaId')

  let query = supabase
    .from('ConviteEquipe')
    .select('*, liga:Liga(id,nome,slug,organizadorId)')
    .order('criadoEm', { ascending: false })
    .limit(80)

  if (ligaId) query = query.eq('ligaId', Number(ligaId))

  const { data, error: fetchErr } = await query
  if (fetchErr) return error('Erro ao buscar convites.', 500)

  const convites = (data ?? []).filter((convite: any) => {
    const liga = Array.isArray(convite.liga) ? convite.liga[0] : convite.liga
    return liga?.organizadorId === auth.userId
  })

  return success(convites)
}

export async function POST(req: NextRequest) {
  try {
    if (!isSupabaseServiceConfigured) {
      return error('SUPABASE_SERVICE_ROLE_KEY nao configurada para enviar convites com RLS ativo.', 500)
    }

    const auth = await requirePublicRole(req, ['organizador'], { releasedOnly: true })
    if (auth instanceof Response) return auth

    const body = await req.json()
    const ligaId = Number(body.ligaId)
    const email = String(body.email ?? '').trim().toLowerCase()
    const nomeEquipe = String(body.nomeEquipe ?? '').trim()
    const mensagem = String(body.mensagem ?? '').trim()

    if (!ligaId || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return error('Informe campeonato e e-mail valido para enviar o convite.', 422)
    }

    const { data: liga, error: ligaErr } = await supabase
      .from('Liga')
      .select('id,nome,slug,organizadorId')
      .eq('id', ligaId)
      .single()

    if (ligaErr || !liga) return error('Campeonato nao encontrado.', 404)
    if (liga.organizadorId !== auth.userId) return error('Voce nao pode convidar equipes para este campeonato.', 403)

    const token = randomUUID()
    const convitePayload = {
      id: randomUUID(),
      token,
      ligaId,
      organizadorId: auth.userId,
      email,
      nomeEquipe: nomeEquipe ? normalizarNomeEquipe(nomeEquipe) : null,
      mensagem: mensagem || null,
      status: 'ENVIADO',
    }

    const { data: convite, error: insertErr } = await supabase
      .from('ConviteEquipe')
      .insert(convitePayload)
      .select()
      .single()

    if (insertErr) throw insertErr

    const link = `${appUrl(req)}/cadastro?modo=cadastro&perfil=equipe&ligaId=${liga.id}&convite=${encodeURIComponent(token)}`
    try {
      await sendEmail({
        to: email,
        subject: `Convite para ${liga.nome} - volei.space`,
        html: emailConviteEquipeCampeonato({
          campeonato: liga.nome,
          organizador: auth.nome || 'Organizacao do campeonato',
          link,
          mensagem,
        }),
      })
    } catch (emailErr) {
      await supabase.from('ConviteEquipe').update({ status: 'ERRO_EMAIL' }).eq('id', convite.id)
      console.error('[convites-equipe] erro ao enviar e-mail', emailErr)
      return error('Convite salvo, mas o e-mail nao foi enviado. Verifique a configuracao SMTP.', 500)
    }

    return success({ ...convite, link }, 201)
  } catch (err) {
    console.error('[convites-equipe] erro', err)
    return error('Erro ao enviar convite.', 500)
  }
}
