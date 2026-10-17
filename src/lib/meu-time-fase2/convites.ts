// Convite de atleta por link (Meu Time, fase 2). Tabela "ConviteAtleta" (migration pendente).
// O token aleatório só existe na resposta da criação; no banco fica o hash SHA-256. O contato opcional
// de quem será convidado é gravado cifrado (mesma cifra LGPD) e nunca devolvido.
import { createHash, randomBytes } from 'node:crypto'
import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { ErroMeuTime, idValido } from '@/lib/meu-time/acesso'
import { adicionarAtleta, exigirEquipe } from '@/lib/meu-time/dados'
import { cifrarContato } from '@/lib/lgpd/cifra'
import { ehMenorDeIdade } from '@/lib/lgpd/idade'
import { lerFase2 } from '@/lib/meu-time-fase2/acesso'
import { notificar } from '@/lib/meu-time-fase2/notificacoes'

export const VALIDADE_CONVITE_MS = 14 * 24 * 60 * 60 * 1000
export const MENSAGEM_CONVITE_INDISPONIVEL = 'Este convite não está mais disponível. Peça um novo link ao líder da equipe.'

export function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex')
}

export function gerarToken() {
  return randomBytes(32).toString('base64url')
}

/** Formato esperado do token (43 caracteres base64url); outro formato nem consulta o banco. */
export function tokenComFormatoValido(token: unknown): token is string {
  return typeof token === 'string' && /^[A-Za-z0-9_-]{43}$/.test(token)
}

type LinhaConvite = {
  id: string
  timeId: string
  criadoPor: string
  expiraEm: string
  revogadoEm: string | null
  usadoEm: string | null
  criadoEm?: string | null
}

export type EstadoConvite = 'ATIVO' | 'USADO' | 'REVOGADO' | 'EXPIRADO'

export function estadoDoConvite(linha: Pick<LinhaConvite, 'expiraEm' | 'revogadoEm' | 'usadoEm'>, agora = Date.now()): EstadoConvite {
  if (linha.revogadoEm) return 'REVOGADO'
  if (linha.usadoEm) return 'USADO'
  if (new Date(linha.expiraEm).getTime() <= agora) return 'EXPIRADO'
  return 'ATIVO'
}

export async function criarConvite(usuarioId: string, equipeId: string, contato: string | null | undefined, origem: string) {
  const { equipe } = await exigirEquipe(usuarioId, equipeId, 'escrita')
  const contatoCifrado = contato ? cifrarContato(contato) : null // 503 sem chave, antes de gravar
  const token = gerarToken()
  const expiraEm = new Date(Date.now() + VALIDADE_CONVITE_MS).toISOString()
  lerFase2(
    await supabase.from('ConviteAtleta').insert({
      timeId: equipe.id,
      tokenHash: hashToken(token),
      contatoCifrado,
      expiraEm,
      criadoPor: usuarioId,
    }),
    'criar convite',
  )
  return { url: `${origem.replace(/\/$/, '')}/convite-atleta/${token}`, expiraEm }
}

export async function listarConvites(usuarioId: string, equipeId: string) {
  const { equipe } = await exigirEquipe(usuarioId, equipeId, 'escrita')
  const linhas = (lerFase2(
    await supabase.from('ConviteAtleta').select('id,timeId,criadoPor,expiraEm,revogadoEm,usadoEm,criadoEm').eq('timeId', equipe.id).order('criadoEm', { ascending: false }),
    'listar convites',
  ) as LinhaConvite[] | null) ?? []
  return linhas.map((linha) => ({
    id: linha.id,
    estado: estadoDoConvite(linha),
    expiraEm: linha.expiraEm,
    criadoEm: linha.criadoEm ?? null,
    usadoEm: linha.usadoEm,
  }))
}

/** Revogar é idempotente. Convite de equipe alheia "não existe" (404). */
export async function revogarConvite(usuarioId: string, conviteId: string) {
  const naoEncontrado = () => new ErroMeuTime('Convite não encontrado.', 404, 'CONVITE_NAO_ENCONTRADO')
  if (!idValido(conviteId)) throw naoEncontrado()
  const linha = lerFase2(
    await supabase.from('ConviteAtleta').select('id,timeId,revogadoEm').eq('id', conviteId).maybeSingle(),
    'convite',
  ) as Pick<LinhaConvite, 'id' | 'timeId' | 'revogadoEm'> | null
  if (!linha) throw naoEncontrado()
  try {
    await exigirEquipe(usuarioId, linha.timeId, 'escrita')
  } catch (erro) {
    if (erro instanceof ErroMeuTime && erro.status === 404) throw naoEncontrado()
    throw erro
  }
  if (!linha.revogadoEm) {
    lerFase2(await supabase.from('ConviteAtleta').update({ revogadoEm: new Date().toISOString() }).eq('id', conviteId), 'revogar convite')
  }
  return { id: conviteId, estado: 'REVOGADO' as const }
}

async function buscarPorToken(token: string): Promise<LinhaConvite | null> {
  if (!tokenComFormatoValido(token)) return null
  return lerFase2(
    await supabase.from('ConviteAtleta').select('id,timeId,criadoPor,expiraEm,revogadoEm,usadoEm').eq('tokenHash', hashToken(token)).maybeSingle(),
    'convite por token',
  ) as LinhaConvite | null
}

async function equipeDoConvite(timeId: string) {
  return lerFase2(
    await supabase.from('TimeClube').select('id,clubeId,nome,naipe').eq('id', timeId).is('arquivadoEm', null).maybeSingle(),
    'equipe do convite',
  ) as { id: string; clubeId: string; nome: string; naipe: string } | null
}

/** Público, sem PII: só nome e naipe da equipe. Qualquer motivo de indisponibilidade tem a mesma resposta. */
export async function consultarConviteAberto(token: string) {
  const convite = await buscarPorToken(token)
  if (!convite || estadoDoConvite(convite) !== 'ATIVO') return { estado: 'INDISPONIVEL' as const }
  const equipe = await equipeDoConvite(convite.timeId)
  if (!equipe) return { estado: 'INDISPONIVEL' as const }
  return { estado: 'DISPONIVEL' as const, equipe: { nome: equipe.nome, naipe: equipe.naipe } }
}

export const RESPOSTA_ACEITE = { recebido: true, mensagem: 'Cadastro recebido. O líder da equipe vai conferir seus dados.' }

/**
 * Aceite uso único: reserva o convite de forma condicional (usadoEm nulo) e só então cria o atleta.
 * Duplicata (mesmo nome+nascimento) devolve a mesma resposta de sucesso, sem criar nem revelar nada.
 * Se a criação falhar por outro motivo, a reserva é desfeita para o convite poder ser usado de novo.
 */
export async function aceitarConvite(token: string, entrada: { nome: string; dataNascimento: string; numeroPreferido?: number | null; posicao?: string | null }) {
  const convite = await buscarPorToken(token)
  const indisponivel = () => new ErroMeuTime(MENSAGEM_CONVITE_INDISPONIVEL, 404, 'CONVITE_INDISPONIVEL')
  if (!convite || estadoDoConvite(convite) !== 'ATIVO') throw indisponivel()
  const equipe = await equipeDoConvite(convite.timeId)
  if (!equipe) throw indisponivel()

  const reservado = (lerFase2(
    await supabase.from('ConviteAtleta').update({ usadoEm: new Date().toISOString() }).eq('id', convite.id).is('usadoEm', null).is('revogadoEm', null).select('id'),
    'reservar convite',
  ) as Array<{ id: string }> | null) ?? []
  if (reservado.length === 0) throw indisponivel()

  try {
    const atleta = await adicionarAtleta(convite.criadoPor, equipe.clubeId, entrada)
    await supabase.from('ConviteAtleta').update({ atletaId: atleta.id }).eq('id', convite.id)
    await notificar(
      convite.criadoPor,
      'CONVITE_ACEITO',
      'Convite aceito',
      `${atleta.nome} preencheu o convite da equipe ${equipe.nome}.`,
      { equipeId: equipe.id, atletaId: atleta.id },
    )
    const pendencias = ehMenorDeIdade(entrada.dataNascimento) ? ['ATLETA_MENOR_SEM_CONSENTIMENTO'] : []
    return { ...RESPOSTA_ACEITE, pendencias }
  } catch (erro) {
    if (erro instanceof ErroMeuTime && erro.codigo === 'ATLETA_DUPLICADO') {
      return { ...RESPOSTA_ACEITE, pendencias: ehMenorDeIdade(entrada.dataNascimento) ? ['ATLETA_MENOR_SEM_CONSENTIMENTO'] : [] }
    }
    await supabase.from('ConviteAtleta').update({ usadoEm: null }).eq('id', convite.id)
    throw erro
  }
}
