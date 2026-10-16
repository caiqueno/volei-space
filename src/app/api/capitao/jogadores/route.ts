import { NextRequest } from 'next/server'
import { z } from 'zod'
import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { success, error } from '@/lib/api-response'
import { requirePublicRole } from '@/lib/auth'
import { generateQRToken } from '@/lib/qrcode'
import { ensureEquipeForCandidatura } from '@/lib/team-activation'
import { documentoParaLeitura, normalizarDocumentoEntrada } from '@/lib/uploads/documentos'
import { normalizarFotoRostoEntrada } from '@/lib/uploads/foto-rosto'
import { respostaEquipeNaoVinculada } from '@/lib/uploads/cadastro-incompleto'
import { mensagemDuplicataNaCategoria } from '@/lib/atleta-duplicado-consulta'

const POSICOES_JOGADOR = ['LV', 'PT', 'OP', 'CT', 'LB'] as const
const DUPLICATE_NUMBER_MESSAGE = 'Este número já está sendo utilizado por outro atleta desta equipe.'

const jogadorCapitaoSchema = z.object({
  id: z.number().int().positive().optional(),
  nome: z.string().min(2),
  numero: z.number().int().min(0).max(999).optional().nullable(),
  posicao: z.enum(POSICOES_JOGADOR).optional().nullable().or(z.literal('')),
  cpf: z.string().optional().nullable(),
  documentoTipo: z.string().max(40).optional().nullable().or(z.literal('')),
  documentoNumero: z.string().max(80).optional().nullable().or(z.literal('')),
  dataNascimento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida').optional().nullable().or(z.literal('')),
  telefone: z.string().optional().nullable(),
  telefoneEmergencia: z.string().optional().nullable(),
  // Caminho do bucket de foto de rosto ou URL pública do próprio Storage; a posse é conferida no servidor.
  fotoRostoUrl: z.string().trim().max(500).optional().nullable().or(z.literal('')),
  // Caminho do bucket privado (preferido) ou URL antiga do mesmo bucket; a posse é conferida no servidor.
  documentosUrls: z.array(z.string().trim().min(1).max(500)).max(8).optional(),
})

export async function GET(req: NextRequest) {
  const auth = await requirePublicRole(req, ['equipe'], { releasedOnly: true })
  if (auth instanceof Response) return auth

  const equipe = await getEquipeDoCapitao(auth.userId)
  if (!equipe) return respostaEquipeNaoVinculada(auth.userId)

  const { data, error: err } = await supabase
    .from('Jogador')
    .select('*')
    .eq('equipeId', equipe.id)
    .order('numero', { ascending: true, nullsFirst: false })
    .order('nome', { ascending: true })

  if (err) return error('Erro ao buscar elenco.', 500)
  return success({ equipe, jogadores: (data ?? []).map(normalizeJogador) })
}

export async function POST(req: NextRequest) {
  const auth = await requirePublicRole(req, ['equipe'], { releasedOnly: true })
  if (auth instanceof Response) return auth

  const equipe = await getEquipeDoCapitao(auth.userId)
  if (!equipe) return respostaEquipeNaoVinculada(auth.userId)

  const prazoError = await ensureRosterChangeAllowed(equipe.id)
  if (prazoError) return prazoError

  const body = await req.json()
  const parsed = jogadorCapitaoSchema.safeParse(body)
  if (!parsed.success) return error('Dados inválidos', 422, parsed.error.flatten())

  const jaGravados = parsed.data.id ? await documentosGravados(parsed.data.id, equipe.id) : []
  const documentos = (parsed.data.documentosUrls ?? []).map((valor) => normalizarDocumentoEntrada(valor, equipe, jaGravados))
  if (documentos.some((item) => item === null)) return error('Documento inválido: envie o arquivo pela área de documentos do atleta.', 422)
  const fotoEnviada = parsed.data.fotoRostoUrl?.trim() || ''
  const fotoGravada = fotoEnviada && parsed.data.id ? await fotoGravadaDoAtleta(parsed.data.id, equipe.id) : null
  const fotoRostoUrl = fotoEnviada ? normalizarFotoRostoEntrada(fotoEnviada, equipe, fotoGravada) : null
  if (fotoEnviada && !fotoRostoUrl) return error('Foto inválida: envie a foto pela área de fotos do atleta.', 422)
  const payload = buildPlayerPayload(parsed.data, equipe.id, documentos as string[], fotoRostoUrl)

  if (parsed.data.id) {
    const owns = await playerBelongsToTeam(parsed.data.id, equipe.id)
    if (!owns) return error('Atleta não pertence à sua equipe.', 403)

    const numberError = await validateUniqueJerseyNumber(equipe.id, parsed.data.numero ?? null, parsed.data.id)
    if (numberError) return numberError
    const atual = await supabase.from('Jogador').select('nome,dataNascimento,documentoNumero').eq('id', parsed.data.id).eq('equipeId', equipe.id).maybeSingle()
    const duplicata = await mensagemDuplicataNaCategoria({
      ligaId: equipe.ligaId,
      categoriaCampeonatoId: equipe.categoriaCampeonatoId,
      equipeId: equipe.id,
      nome: parsed.data.nome ?? atual.data?.nome,
      dataNascimento: parsed.data.dataNascimento ?? atual.data?.dataNascimento,
      documentoNumero: parsed.data.documentoNumero ?? atual.data?.documentoNumero,
    })
    if (duplicata) return error(duplicata, 422)

    const { data, error: err } = await supabase
      .from('Jogador')
      .update(payload)
      .eq('id', parsed.data.id)
      .eq('equipeId', equipe.id)
      .select()
      .single()

    if (err) {
      if (isDuplicateJerseyNumberDbError(err)) return error(DUPLICATE_NUMBER_MESSAGE, 409)
      return error('Erro ao atualizar atleta.', 500)
    }
    return success(normalizeJogador(data))
  }

  const numberError = await validateUniqueJerseyNumber(equipe.id, parsed.data.numero ?? null)
  if (numberError) return numberError
  const duplicata = await mensagemDuplicataNaCategoria({
    ligaId: equipe.ligaId,
    categoriaCampeonatoId: equipe.categoriaCampeonatoId,
    equipeId: equipe.id,
    nome: parsed.data.nome,
    dataNascimento: parsed.data.dataNascimento,
    documentoNumero: parsed.data.documentoNumero,
  })
  if (duplicata) return error(duplicata, 422)

  const { data, error: err } = await supabase
    .from('Jogador')
    .insert({
      ...payload,
      equipeId: equipe.id,
      qrCodeToken: generateQRToken(),
      qrCodeGeradoEm: new Date().toISOString(),
      autoRegistrado: false,
    })
    .select()
    .single()

  if (err) {
    if (isDuplicateJerseyNumberDbError(err)) return error(DUPLICATE_NUMBER_MESSAGE, 409)
    return error('Erro ao cadastrar atleta.', 500)
  }
  return success(normalizeJogador(data), 201)
}

export async function DELETE(req: NextRequest) {
  const auth = await requirePublicRole(req, ['equipe'], { releasedOnly: true })
  if (auth instanceof Response) return auth

  const equipe = await getEquipeDoCapitao(auth.userId)
  if (!equipe) return respostaEquipeNaoVinculada(auth.userId)

  const prazoError = await ensureRosterChangeAllowed(equipe.id)
  if (prazoError) return prazoError

  const id = Number(new URL(req.url).searchParams.get('id'))
  if (!id) return error('Atleta não informado.', 400)

  const { error: err } = await supabase
    .from('Jogador')
    .delete()
    .eq('id', id)
    .eq('equipeId', equipe.id)

  if (err) return error('Erro ao remover atleta.', 500)
  return success({ deleted: true })
}

async function getEquipeDoCapitao(candidaturaId: string) {
  return ensureEquipeForCandidatura(candidaturaId)
}

async function documentosGravados(id: number, equipeId: number): Promise<string[]> {
  const { data } = await supabase.from('Jogador').select('documentosUrls').eq('id', id).eq('equipeId', equipeId).maybeSingle()
  return parseJsonArray(data?.documentosUrls).map(documentoParaLeitura).filter((item): item is string => Boolean(item))
}

async function fotoGravadaDoAtleta(id: number, equipeId: number): Promise<string | null> {
  const { data } = await supabase.from('Jogador').select('fotoRostoUrl').eq('id', id).eq('equipeId', equipeId).maybeSingle()
  return data?.fotoRostoUrl ? String(data.fotoRostoUrl) : null
}

async function playerBelongsToTeam(id: number, equipeId: number) {
  const { data } = await supabase
    .from('Jogador')
    .select('id')
    .eq('id', id)
    .eq('equipeId', equipeId)
    .maybeSingle()
  return Boolean(data)
}

async function validateUniqueJerseyNumber(equipeId: number, numero?: number | null, ignoreId?: number) {
  if (numero === null || numero === undefined) return null

  let query = supabase
    .from('Jogador')
    .select('id')
    .eq('equipeId', equipeId)
    .eq('numero', numero)
    .eq('banido', false)
    .limit(1)

  if (ignoreId) query = query.neq('id', ignoreId)

  const { data, error: err } = await query
  if (err) {
    console.error('[capitao/jogadores] erro ao validar numero de camisa', err)
    return error('Erro ao validar número de camisa.', 500)
  }

  if (data?.length) {
    return error(DUPLICATE_NUMBER_MESSAGE, 409)
  }

  return null
}

async function ensureRosterChangeAllowed(equipeId: number) {
  const { data, error: err } = await supabase
    .from('InscricaoCampeonato')
    .select('status, liga:Liga(id,nome,status,dataInicio,prazoAlteracaoElencoDias)')
    .eq('equipeId', equipeId)
    .in('status', ['APROVADA', 'APROVADO', 'ATIVA', 'ATIVO'])

  if (err) {
    console.error('[capitao/jogadores] erro ao verificar prazo de elenco', err)
    return error('Erro ao verificar prazo de alteração do elenco.', 500)
  }

  const agora = Date.now()
  for (const inscricao of data ?? []) {
    const liga = Array.isArray((inscricao as any).liga) ? (inscricao as any).liga[0] : (inscricao as any).liga
    if (!liga) continue
    if (String(liga.status || '').toUpperCase() !== 'ATIVA') continue
    if (!liga.dataInicio) continue

    const inicio = new Date(liga.dataInicio)
    if (Number.isNaN(inicio.getTime())) continue

    const prazoDias = Number(liga.prazoAlteracaoElencoDias ?? 7)
    const limite = new Date(inicio)
    limite.setDate(limite.getDate() + prazoDias)
    limite.setHours(23, 59, 59, 999)

    if (agora > limite.getTime()) {
      const limiteFormatado = new Intl.DateTimeFormat('pt-BR').format(limite)
      return error(`O prazo para alterar o elenco no campeonato ${liga.nome} encerrou em ${limiteFormatado}.`, 403)
    }
  }

  return null
}

function buildPlayerPayload(data: z.infer<typeof jogadorCapitaoSchema>, equipeId: number, documentos: string[], fotoRostoUrl: string | null) {
  const documentoTipo = data.documentoTipo?.trim() || (data.cpf ? 'CPF' : null)
  const rawDocumento = data.documentoNumero?.trim() || data.cpf?.trim() || null
  const documentoNumero = rawDocumento && documentoTipo === 'CPF' ? rawDocumento.replace(/\D/g, '') : rawDocumento

  return {
    nome: data.nome.trim(),
    equipeId,
    numero: data.numero ?? null,
    posicao: data.posicao?.trim() || null,
    cpf: documentoTipo === 'CPF' && documentoNumero ? documentoNumero.replace(/\D/g, '') : null,
    documentoTipo,
    documentoNumero,
    dataNascimento: data.dataNascimento ? new Date(data.dataNascimento).toISOString() : null,
    telefone: data.telefone || null,
    telefoneEmergencia: data.telefoneEmergencia || null,
    fotoRostoUrl,
    fotoUrl: fotoRostoUrl,
    documentosUrls: JSON.stringify(documentos),
  }
}

function normalizeJogador(jogador: any) {
  const documentoTipo = jogador.documentoTipo ?? (jogador.cpf ? 'CPF' : null)
  const documentoNumero = jogador.documentoNumero ?? jogador.cpf ?? null
  return {
    ...jogador,
    documentoTipo,
    documentoNumero,
    isLibero: String(jogador.posicao || '').toUpperCase() === 'LB',
    documentosUrls: parseJsonArray(jogador.documentosUrls)
      .map(documentoParaLeitura)
      .filter((item): item is string => Boolean(item)),
  }
}

function parseJsonArray(value: unknown) {
  if (!value) return []
  if (Array.isArray(value)) return value
  try {
    const parsed = JSON.parse(String(value))
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function isDuplicateJerseyNumberDbError(err: any) {
  return err?.code === '23505' && String(err.message ?? err.details ?? '').includes('Jogador_equipe_numero_ativo_unique')
}

