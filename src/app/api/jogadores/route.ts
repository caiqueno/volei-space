import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { success, error } from '@/lib/api-response'
import { jogadorSchema } from '@/lib/schemas'
import { exigirOrganizadorDaEquipe, ligasVisiveisAoOrganizador } from '@/lib/organizador-isolamento'
import { requireArbitroPartidaAccess } from '@/lib/arbitro-access'
import { jogoJaIniciado } from '@/lib/arbitro-responsavel'
import { payloadNovoAtleta, validarNovoAtleta } from '@/lib/presenca-herdada'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const equipeId = searchParams.get('equipeId')
    const busca = searchParams.get('q')?.trim()
    const ligasDoOrganizador = await ligasVisiveisAoOrganizador(req)

    // CPF, documento, nascimento, telefones e qrCodeToken nunca saem por aqui:
    // esta rota responde sem sessão e alimenta telas que só mostram elenco.
    let q = supabase
      .from('Jogador')
      .select('id, nome, numero, posicao, fotoUrl, fotoRostoUrl, equipeId, banido, equipe:Equipe(id, nome, ligaId, categoriaCampeonatoId)')
      .order('nome', { ascending: true })
    if (ligasDoOrganizador) {
      const { data: equipes } = await supabase.from('Equipe').select('id').in('ligaId', ligasDoOrganizador.length ? ligasDoOrganizador : [-1])
      const ids = (equipes ?? []).map((equipe) => equipe.id)
      if (equipeId && !ids.includes(Number(equipeId))) return success([])
      q = q.in('equipeId', ids.length ? ids : [-1])
    }
    if (equipeId) q = q.eq('equipeId', Number(equipeId))
    if (busca) q = q.ilike('nome', `%${busca.replace(/[%_]/g, '')}%`)

    const { data, error: err } = await q
    if (err) throw err
    return success(data)
  } catch {
    return error('Erro ao buscar jogadores', 500)
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const tokenPartida = typeof body?.sumulaToken === 'string' ? body.sumulaToken.trim() : ''
    if (tokenPartida) {
      const nome = typeof body?.nome === 'string' ? body.nome.trim() : body?.nome
      const numeroInformado = typeof body?.numero === 'string' && body.numero.trim() !== '' ? Number(body.numero) : body?.numero
      const daPartida = jogadorSchema.safeParse({
        nome,
        equipeId: body?.equipeId,
        numero: numeroInformado,
      })
      if (!daPartida.success) return error('Dados inválidos', 422, daPartida.error.flatten())
      return criarAtletaNaPartida(req, tokenPartida, daPartida.data)
    }

    const parsed = jogadorSchema.safeParse(body)
    if (!parsed.success) return error('Dados inválidos', 422, parsed.error.flatten())
    const acesso = await exigirOrganizadorDaEquipe(req, parsed.data.equipeId)
    if (acesso instanceof NextResponse) return acesso

    const { data, error: err } = await supabase
      .from('Jogador')
      .insert(parsed.data)
      .select()
      .single()
    if (err) throw err
    return success(data, 201)
  } catch {
    return error('Erro ao criar jogador', 500)
  }
}

async function criarAtletaNaPartida(
  req: NextRequest,
  token: string,
  campos: { nome: string; equipeId: number; numero?: number },
) {
  const access = await requireArbitroPartidaAccess(req, token)
  if (access instanceof Response) return access
  if (jogoJaIniciado(access.partida.status)) {
    return error('A partida já começou. O atleta não entra por esta tela.', 409)
  }

  const equipes = [
    Number(access.partida.equipeAId ?? access.partida.equipeA?.id),
    Number(access.partida.equipeBId ?? access.partida.equipeB?.id),
  ]
  if (!equipes.includes(Number(campos.equipeId))) {
    return error('Este atleta não joga esta partida.', 422)
  }

  const { data: elenco, error: elencoErr } = await supabase
    .from('Jogador')
    .select('id,numero,banido,equipeId')
    .eq('equipeId', campos.equipeId)
  if (elencoErr) return error('Erro ao validar número de camisa.', 500)

  const validado = validarNovoAtleta({
    nome: campos.nome,
    numero: campos.numero == null ? '' : String(campos.numero),
    atletas: elenco ?? [],
    equipeId: campos.equipeId,
  })
  if ('erro' in validado) return error(validado.erro, 409)

  const { data, error: err } = await supabase
    .from('Jogador')
    .insert(payloadNovoAtleta({ ...validado, equipeId: campos.equipeId }))
    .select('id, nome, numero, posicao, equipeId, banido')
    .single()
  if (err) return error('Erro ao criar jogador', 500)
  return success(data, 201)
}
