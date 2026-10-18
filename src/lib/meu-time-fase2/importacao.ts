// Importação de atletas por CSV em duas etapas: prévia (sem gravar atletas) e confirmação.
// Tabela "ImportacaoAtletas" (migration pendente): guarda a prévia até confirmar ou descartar.
import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { ErroMeuTime, idValido } from '@/lib/meu-time/acesso'
import { adicionarLote, exigirEquipe, listarAtletasDoClube } from '@/lib/meu-time/dados'
import { chaveAtleta } from '@/lib/meu-time/regras'
import { analisarCsv, type LinhaCsv } from '@/lib/meu-time-fase2/csv'
import { lerFase2 } from '@/lib/meu-time-fase2/acesso'
import { notificar } from '@/lib/meu-time-fase2/notificacoes'

type Resumo = { validas: number; comAviso: number; invalidas: number }
type LinhaPrevia = { n: number; status: LinhaCsv['status']; erros: string[]; avisos: string[]; dados: LinhaCsv['dados']; repetida: boolean }
type LinhaImportacao = {
  id: string
  timeId: string
  criadoPor: string
  status: 'PREVIA' | 'CONFIRMADA'
  linhas: LinhaPrevia[] | null
  resumo: Resumo | null
  resultado: { criados: number; ignorados: Array<{ n: number; motivo: string }> } | null
  /** Validade da prévia (migration 0037: padrão agora + 72 h). Ausente/nulo = sem expiração (linhas antigas). */
  expiraEm?: string | null
}

const COLUNAS = 'id,timeId,criadoPor,status,linhas,resumo,resultado,expiraEm'

/** Máximo de prévias pendentes (não expiradas) por equipe. */
export const MAX_PREVIAS_PENDENTES = 5

/** Prévia ainda não confirmada cuja validade passou: vale como inexistente (os dados pessoais já devem sair). */
export function previaExpirada(linha: Pick<LinhaImportacao, 'status' | 'expiraEm'>, agora = Date.now()): boolean {
  if (linha.status !== 'PREVIA' || !linha.expiraEm) return false
  const limite = new Date(linha.expiraEm).getTime()
  return !Number.isNaN(limite) && limite <= agora
}

/** Marca como AVISO (e como "ja existe") as linhas que repetem nome+nascimento do banco do time. */
function marcarExistentes(linhas: LinhaCsv[], existentes: Array<{ nome: string; dataNascimento?: string | Date | null }>) {
  const chaves = new Set(existentes.map((item) => chaveAtleta(item.nome, item.dataNascimento ? String(item.dataNascimento).slice(0, 10) : null)))
  return linhas.map((linha) => {
    if (linha.status === 'ERRO' || !linha.dados.dataNascimento) return linha
    if (!chaves.has(chaveAtleta(linha.dados.nome, linha.dados.dataNascimento))) return linha
    const avisos = [...linha.avisos, 'Já existe no banco do time (mesmo nome e nascimento); esta linha será ignorada.']
    return { ...linha, status: 'AVISO' as const, avisos, repetida: true }
  })
}

function resumir(linhas: Array<{ status: LinhaCsv['status'] }>): Resumo {
  return {
    validas: linhas.filter((l) => l.status === 'OK').length,
    comAviso: linhas.filter((l) => l.status === 'AVISO').length,
    invalidas: linhas.filter((l) => l.status === 'ERRO').length,
  }
}

function paraSaida(linha: LinhaPrevia) {
  return { n: linha.n, status: linha.status, erros: linha.erros, avisos: linha.avisos, dados: linha.dados }
}

/** Apaga as prévias vencidas da equipe (levam junto nome e nascimento). Confirmadas ficam. */
async function expurgarPreviasExpiradas(timeId: string) {
  lerFase2(
    await supabase.from('ImportacaoAtletas').delete().eq('timeId', timeId).eq('status', 'PREVIA').lt('expiraEm', new Date().toISOString()),
    'expurgar prévias expiradas',
  )
}

export async function criarPrevia(usuarioId: string, equipeId: string, csv: string) {
  const { equipe } = await exigirEquipe(usuarioId, equipeId, 'escrita')
  const lido = analisarCsv(csv)
  if (!lido.ok) {
    throw new ErroMeuTime(lido.mensagem, lido.codigo === 'CSV_LIMITE_LINHAS' ? 413 : 422, lido.codigo)
  }
  await expurgarPreviasExpiradas(equipe.id)
  const pendentes = (lerFase2(
    await supabase.from('ImportacaoAtletas').select('id,status,expiraEm').eq('timeId', equipe.id).eq('status', 'PREVIA'),
    'prévias pendentes',
  ) as Array<Pick<LinhaImportacao, 'status' | 'expiraEm'>> | null) ?? []
  if (pendentes.filter((p) => !previaExpirada(p)).length >= MAX_PREVIAS_PENDENTES) {
    throw new ErroMeuTime(
      `Esta equipe já tem ${MAX_PREVIAS_PENDENTES} importações aguardando confirmação. Confirme ou descarte alguma antes de enviar outra planilha.`,
      429,
      'IMPORTACAO_LIMITE_PREVIAS',
    )
  }
  const linhas = marcarExistentes(lido.linhas, await listarAtletasDoClube(equipe.clubeId))
  const resumo = resumir(linhas)
  const criada = lerFase2(
    await supabase.from('ImportacaoAtletas').insert({ timeId: equipe.id, criadoPor: usuarioId, status: 'PREVIA', linhas, resumo }).select('id').single(),
    'criar prévia de importação',
  ) as { id: string } | null
  if (!criada) throw new ErroMeuTime('Não foi possível criar a prévia.', 500)
  return { id: criada.id, resumo, linhas: linhas.map(paraSaida) }
}

async function carregar(usuarioId: string, id: string, permissao: 'escrita') {
  const naoEncontrada = () => new ErroMeuTime('Importação não encontrada.', 404, 'IMPORTACAO_NAO_ENCONTRADA')
  if (!idValido(id)) throw naoEncontrada()
  const linha = lerFase2(await supabase.from('ImportacaoAtletas').select(COLUNAS).eq('id', id).maybeSingle(), 'importação') as LinhaImportacao | null
  if (!linha) throw naoEncontrada()
  if (previaExpirada(linha)) {
    // Prévia vencida é indisponível (404) e sai do banco junto com os dados pessoais.
    await supabase.from('ImportacaoAtletas').delete().eq('id', id).eq('status', 'PREVIA')
    throw naoEncontrada()
  }
  let acesso
  try {
    acesso = await exigirEquipe(usuarioId, linha.timeId, permissao)
  } catch (erro) {
    if (erro instanceof ErroMeuTime && erro.status === 404) throw naoEncontrada()
    throw erro
  }
  return { importacao: linha, equipe: acesso.equipe }
}

/**
 * Confirma: cria os atletas válidos. Idempotente (segunda chamada devolve o mesmo resultado, 200).
 * A reserva PREVIA -> CONFIRMADA é condicional, então duas confirmações simultâneas não duplicam atletas.
 */
export async function confirmarImportacao(usuarioId: string, id: string) {
  const { importacao, equipe } = await carregar(usuarioId, id, 'escrita')
  if (importacao.status === 'CONFIRMADA') {
    return { id, repetida: true, ...(importacao.resultado ?? { criados: 0, ignorados: [] }) }
  }
  const reservada = (lerFase2(
    await supabase.from('ImportacaoAtletas').update({ status: 'CONFIRMADA', confirmadoEm: new Date().toISOString() }).eq('id', id).eq('status', 'PREVIA').select('id'),
    'reservar importação',
  ) as Array<{ id: string }> | null) ?? []
  if (reservada.length === 0) {
    const atual = lerFase2(await supabase.from('ImportacaoAtletas').select(COLUNAS).eq('id', id).maybeSingle(), 'importação') as LinhaImportacao | null
    if (!atual) throw new ErroMeuTime('Importação não encontrada.', 404, 'IMPORTACAO_NAO_ENCONTRADA')
    return { id, repetida: true, ...(atual.resultado ?? { criados: 0, ignorados: [] }) }
  }

  try {
    const linhas = importacao.linhas ?? []
    const ignorados: Array<{ n: number; motivo: string }> = []
    const aCriar: LinhaPrevia[] = []
    for (const linha of linhas) {
      if (linha.status === 'ERRO') ignorados.push({ n: linha.n, motivo: 'Linha inválida' })
      else if (linha.repetida) ignorados.push({ n: linha.n, motivo: 'Atleta repetido (planilha ou banco do time)' })
      else aCriar.push(linha)
    }
    const resultado = await adicionarLote(usuarioId, equipe.clubeId, {
      atletas: aCriar.map((l) => ({ nome: l.dados.nome, numero: l.dados.numeroPreferido, dataNascimento: l.dados.dataNascimento, posicao: l.dados.posicao })),
    })
    // adicionarLote reaplica a deduplicação contra o banco no momento da confirmação.
    for (const ignorado of resultado.ignorados) {
      ignorados.push({ n: aCriar[ignorado.linha - 1]?.n ?? ignorado.linha, motivo: ignorado.motivo })
    }
    ignorados.sort((a, b) => a.n - b.n)
    const saida = { criados: resultado.criados.length, ignorados }
    // Minimização: depois de confirmar, os dados pessoais da prévia saem da tabela; fica só o resultado.
    lerFase2(await supabase.from('ImportacaoAtletas').update({ resultado: saida, linhas: [] }).eq('id', id), 'gravar resultado da importação')
    await notificar(usuarioId, 'IMPORTACAO_CONFIRMADA', 'Importação concluída', `${saida.criados} atleta(s) importado(s) para ${equipe.nome}.`, { equipeId: equipe.id, importacaoId: id })
    return { id, repetida: false, ...saida }
  } catch (erro) {
    await supabase.from('ImportacaoAtletas').update({ status: 'PREVIA', confirmadoEm: null }).eq('id', id)
    throw erro
  }
}

/** Descarta a prévia (apaga a linha, com os dados pessoais). Importação já confirmada não se descarta. */
export async function descartarImportacao(usuarioId: string, id: string) {
  const { importacao } = await carregar(usuarioId, id, 'escrita')
  if (importacao.status === 'CONFIRMADA') {
    throw new ErroMeuTime('Esta importação já foi confirmada.', 409, 'IMPORTACAO_JA_CONFIRMADA')
  }
  lerFase2(await supabase.from('ImportacaoAtletas').delete().eq('id', id).eq('status', 'PREVIA'), 'descartar importação')
  return { id, descartada: true }
}
