// Painel de inscrições do organizador (R18): listagem, detalhe, decisão (com vagas e lista de espera),
// aprovação em lote, exportação e conversa de correção com o líder.
// Toda permissão é conferida aqui, no servidor. Sem PII: nomes abreviados, só flags de foto/documento/CPF.
import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { isCampeonatoFinalizado, MENSAGEM_CAMPEONATO_FINALIZADO } from '@/lib/championship-finalization'
import { ErroMeuTime, idValido } from '@/lib/meu-time/acesso'
import { exigirEquipe } from '@/lib/meu-time/dados'
import { garantirEquipeLegada } from '@/lib/meu-time/equipe-legada'
import { notificar, type TipoNotificacao } from '@/lib/meu-time-fase2/notificacoes'
import {
  campeonatoNaoEncontrado,
  exigirLigaDoPainel,
  lerPainel,
  ligasVisiveis,
  type LigaDoPainel,
} from './acesso'
import {
  ACOES,
  DESTINO_DA_ACAO,
  STATUS_OCUPA_VAGA,
  STATUS_PAINEL,
  mensagemTransicaoInvalida,
  montarCsv,
  nomeAbreviado,
  pendenciasDaInscricao,
  resolverAprovacao,
  transicaoValida,
  type AcaoDecisao,
} from './regras'

const db = supabaseAdmin as any

export const TAMANHO_PAGINA = 20
export const LIMITE_EXPORTACAO = 5000
export const MAXIMO_LOTE = 50

export const decisaoSchema = z.object({
  acao: z.enum(ACOES),
  mensagem: z.string().trim().max(500).optional().nullable(),
})
export const loteSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(MAXIMO_LOTE),
  acao: z.literal('APROVAR'),
})
export const comentarioSchema = z.object({ mensagem: z.string().trim().min(1, 'escreva a mensagem').max(1000) })

const naoEncontrada = () => new ErroMeuTime('Inscrição não encontrada.', 404, 'INSCRICAO_NAO_ENCONTRADA')

// --- Filtros ----------------------------------------------------------------------

export type FiltroPainel = {
  ligaId?: string | null
  categoriaId?: string | null
  status?: string | null
  q?: string | null
  pagina?: string | null
}

function validarFiltro(filtro: FiltroPainel) {
  if (filtro.status && !(STATUS_PAINEL as readonly string[]).includes(normalizarStatus(filtro.status))) {
    throw new ErroMeuTime('Status inválido.', 422, 'DADOS_INVALIDOS')
  }
  if (filtro.categoriaId && !idValido(filtro.categoriaId)) {
    throw new ErroMeuTime('Categoria inválida.', 422, 'DADOS_INVALIDOS')
  }
  if (filtro.ligaId && !/^\d+$/.test(filtro.ligaId)) {
    throw new ErroMeuTime('Campeonato inválido.', 422, 'DADOS_INVALIDOS')
  }
  const pagina = filtro.pagina ? Number(filtro.pagina) : 1
  if (!Number.isInteger(pagina) || pagina < 1 || pagina > 10_000) throw new ErroMeuTime('Página inválida.', 422, 'DADOS_INVALIDOS')
  return pagina
}

async function ligasDoFiltro(usuarioId: string, ligaId?: string | null) {
  const visiveis = await ligasVisiveis(usuarioId)
  if (!ligaId) return visiveis
  const alvo = visiveis.filter((l) => l.id === Number(ligaId))
  if (alvo.length === 0) throw campeonatoNaoEncontrado() // IDOR: campeonato de outro organizador = 404
  return alvo
}

// --- Montagem dos itens -------------------------------------------------------------

export type ItemPainel = {
  id: string
  equipe: { id: string; nome: string; cidade: string | null }
  ligaId: number
  categoriaId: string
  categoria: string
  campeonato: string
  status: string
  atletas: number
  pendencias: string[]
  posicaoEspera?: number
  atualizadoEm: string | null
  comentariosAbertos: number
}

async function montarItens(linhas: any[], ligas: LigaDoPainel[]): Promise<ItemPainel[]> {
  if (linhas.length === 0) return []
  const ids = linhas.map((l) => l.id as string)
  const timeIds = Array.from(new Set(linhas.map((l) => l.timeId as string)))
  const categoriaIds = Array.from(new Set(linhas.map((l) => l.categoriaCampeonatoId as string)))

  const [times, categorias, atletas, regras, comentarios] = await Promise.all([
    db.from('TimeClube').select('id,nome,cidade').in('id', timeIds),
    db.from('CategoriaCampeonato').select('id,nome').in('id', categoriaIds),
    db.from('InscricaoAtleta').select('inscricaoId,documentosOk,capitao').in('inscricaoId', ids).eq('ativo', true),
    db.from('RegraElenco').select('categoriaCampeonatoId,atletasMin,atletasMax').in('categoriaCampeonatoId', categoriaIds),
    db.from('ComentarioInscricao').select('inscricaoId,tipo,resolvidoEm').in('inscricaoId', ids).eq('tipo', 'CORRECAO').is('resolvidoEm', null),
  ])
  const timePorId = new Map(((lerPainel(times, 'equipes') as any[] | null) ?? []).map((t) => [t.id, t]))
  const categoriaPorId = new Map(((lerPainel(categorias, 'categorias') as any[] | null) ?? []).map((c) => [c.id, c]))
  const atletasPorInscricao = new Map<string, any[]>()
  for (const a of (lerPainel(atletas, 'atletas das inscrições') as any[] | null) ?? []) {
    atletasPorInscricao.set(a.inscricaoId, [...(atletasPorInscricao.get(a.inscricaoId) ?? []), a])
  }
  const regraPorCategoria = new Map(((regras.error ? [] : regras.data) as any[]).map((r) => [r.categoriaCampeonatoId, r]))
  // Tabela de comentários ainda não existe: o painel segue, sem contagem.
  const abertosPorInscricao = new Map<string, number>()
  if (!comentarios.error) {
    for (const c of (comentarios.data ?? []) as any[]) abertosPorInscricao.set(c.inscricaoId, (abertosPorInscricao.get(c.inscricaoId) ?? 0) + 1)
  }
  const nomeLiga = new Map(ligas.map((l) => [l.id, l.nome]))

  return linhas.map((linha) => {
    const time = timePorId.get(linha.timeId)
    const doElenco = atletasPorInscricao.get(linha.id) ?? []
    const item: ItemPainel = {
      id: linha.id,
      equipe: { id: linha.timeId, nome: time?.nome ?? '', cidade: time?.cidade ?? null },
      ligaId: Number(linha.ligaId),
      categoriaId: linha.categoriaCampeonatoId,
      categoria: categoriaPorId.get(linha.categoriaCampeonatoId)?.nome ?? '',
      campeonato: nomeLiga.get(Number(linha.ligaId)) ?? '',
      status: linha.status,
      atletas: doElenco.length,
      pendencias: pendenciasDaInscricao(doElenco, regraPorCategoria.get(linha.categoriaCampeonatoId)),
      atualizadoEm: linha.atualizadoEm ?? linha.criadoEm ?? null,
      comentariosAbertos: abertosPorInscricao.get(linha.id) ?? 0,
    }
    if (linha.status === 'LISTA_ESPERA' && linha.posicaoEspera != null) item.posicaoEspera = Number(linha.posicaoEspera)
    return item
  })
}

async function lerInscricoes(ligas: LigaDoPainel[], filtro: FiltroPainel) {
  if (ligas.length === 0) return []
  let consulta = db.from('Inscricao').select('*').in('ligaId', ligas.map((l) => l.id))
  if (filtro.categoriaId) consulta = consulta.eq('categoriaCampeonatoId', filtro.categoriaId)
  // O status é aplicado depois, em memória, para os contadores por status valerem para o conjunto sem esse filtro.
  const linhas = ((lerPainel(await consulta, 'inscrições') as any[] | null) ?? []).filter((l) => l.status !== 'RASCUNHO' || filtro.status === 'RASCUNHO')
  return linhas.sort((a, b) => String(b.atualizadoEm ?? b.criadoEm ?? '').localeCompare(String(a.atualizadoEm ?? a.criadoEm ?? '')))
}

function filtrarPorBusca(itens: ItemPainel[], q?: string | null) {
  const termo = String(q ?? '').trim().toLowerCase()
  if (!termo) return itens
  return itens.filter((i) => `${i.equipe.nome} ${i.equipe.cidade ?? ''} ${i.categoria}`.toLowerCase().includes(termo))
}

export async function listarInscricoesDoPainel(usuarioId: string, filtro: FiltroPainel) {
  const pagina = validarFiltro(filtro)
  const ligas = await ligasDoFiltro(usuarioId, filtro.ligaId)
  const todos = filtrarPorBusca(await montarItens(await lerInscricoes(ligas, filtro), ligas), filtro.q)
  const alvo = filtro.status ? normalizarStatus(filtro.status) : null
  const itens = alvo ? todos.filter((i) => i.status === alvo) : todos
  const inicio = (pagina - 1) * TAMANHO_PAGINA
  return { itens: itens.slice(inicio, inicio + TAMANHO_PAGINA), total: itens.length, contadores: contarPorStatus(todos) }
}

/** RECUSADA é o nome de tela de REMOVIDA. */
function normalizarStatus(status: string) {
  return status === 'RECUSADA' ? 'REMOVIDA' : status
}

/** Contagem por status do conjunto sem o filtro de status (o frontend não precisa contar no cliente). */
export function contarPorStatus(itens: Array<{ status: string }>) {
  const contadores: Record<string, number> = Object.fromEntries(STATUS_PAINEL.map((s) => [s, 0]))
  for (const i of itens) contadores[i.status] = (contadores[i.status] ?? 0) + 1
  contadores.RECUSADA = contadores.REMOVIDA
  return contadores
}

export async function exportarInscricoes(usuarioId: string, filtro: FiltroPainel) {
  validarFiltro({ ...filtro, pagina: null })
  const ligas = await ligasDoFiltro(usuarioId, filtro.ligaId)
  const todos = filtrarPorBusca(await montarItens((await lerInscricoes(ligas, filtro)).slice(0, LIMITE_EXPORTACAO), ligas), filtro.q)
  const alvo = filtro.status ? normalizarStatus(filtro.status) : null
  const itens = alvo ? todos.filter((i) => i.status === alvo) : todos
  // Colunas fixas e sem dado pessoal: nada de CPF, telefone, documento nem nome de atleta.
  return montarCsv(itens.map((i) => [i.equipe.nome, i.equipe.cidade ?? '', i.categoria, i.status, i.atletas, i.pendencias.join(' | '), i.atualizadoEm ?? '']))
}

// --- Detalhe ------------------------------------------------------------------------

async function lerInscricao(id: string) {
  if (!idValido(id)) return null
  return lerPainel(await db.from('Inscricao').select('*').eq('id', id).maybeSingle(), 'inscrição') as any | null
}

async function inscricaoDoPainel(usuarioId: string, id: string, escrita: boolean) {
  const inscricao = await lerInscricao(id)
  if (!inscricao) throw naoEncontrada()
  // Sem relação com o campeonato = 404 (IDOR); papel só de leitura numa escrita = 403.
  const liga = await exigirLigaDoPainel(usuarioId, Number(inscricao.ligaId), escrita).catch((erro) => {
    if (erro instanceof ErroMeuTime && erro.status === 404) throw naoEncontrada()
    throw erro
  })
  return { inscricao, liga }
}

function listarComentarios(linhas: any[]) {
  return linhas
    .sort((a, b) => String(a.criadoEm ?? '').localeCompare(String(b.criadoEm ?? '')))
    .map((c) => ({ id: c.id, tipo: c.tipo, autorPapel: c.autorPapel, mensagem: c.mensagem, criadoEm: c.criadoEm ?? null, resolvidoEm: c.resolvidoEm ?? null }))
}

async function comentariosDaInscricao(inscricaoId: string, tolerante: boolean) {
  const r = await db.from('ComentarioInscricao').select('id,tipo,autorPapel,mensagem,criadoEm,resolvidoEm').eq('inscricaoId', inscricaoId)
  if (r.error && tolerante) return []
  return listarComentarios((lerPainel(r, 'comentários') as any[] | null) ?? [])
}

export async function detalharInscricao(usuarioId: string, id: string) {
  const { inscricao, liga } = await inscricaoDoPainel(usuarioId, id, false)
  const [item] = await montarItens([inscricao], [liga])

  const elenco = (lerPainel(await db.from('InscricaoAtleta').select('*').eq('inscricaoId', inscricao.id).eq('ativo', true), 'atletas') as any[] | null) ?? []
  const atletaIds = elenco.map((a) => a.atletaId)
  const [atletas, docs] = atletaIds.length === 0
    ? [{ data: [] }, { data: [] }]
    : await Promise.all([db.from('Atleta').select('*').in('id', atletaIds), db.from('AtletaDocumento').select('atletaId,cpfCifrado,documentoPath').in('atletaId', atletaIds)])
  const atletaPorId = new Map((((atletas as any).error ? [] : (atletas as any).data) as any[]).map((a) => [a.id, a]))
  const docPorAtleta = new Map((((docs as any).error ? [] : (docs as any).data) as any[]).map((d) => [d.atletaId, d]))

  const comissao = await db.from('InscricaoComissao').select('nomeSnapshot,funcao').eq('inscricaoId', inscricao.id)
  return {
    ...item,
    motivoDecisao: inscricao.motivoDecisao ?? null,
    decididaEm: inscricao.decididaEm ?? null,
    atletas: elenco
      .sort((a, b) => Number(a.numero ?? 999) - Number(b.numero ?? 999))
      .map((a) => {
        const atleta = atletaPorId.get(a.atletaId)
        const doc = docPorAtleta.get(a.atletaId)
        return {
          nome: nomeAbreviado(a.nomeSnapshot),
          camisa: a.numero ?? null,
          capitao: Boolean(a.capitao),
          libero: Boolean(a.libero),
          // Só se existe, nunca o conteúdo: o documento e o CPF não saem deste painel.
          temFoto: Boolean(atleta?.fotoRostoPath),
          temDocumento: Boolean(a.documentosOk || doc?.documentoPath || atleta?.documentoPath),
          temCpf: Boolean(doc?.cpfCifrado || atleta?.cpfCifrado || atleta?.cpfHash),
        }
      }),
    comissao: comissao.error ? [] : ((comissao.data ?? []) as any[]).map((m) => ({ nome: nomeAbreviado(m.nomeSnapshot), funcao: m.funcao ?? null })),
    comentarios: await comentariosDaInscricao(inscricao.id, true),
  }
}

// --- Vagas e lista de espera ---------------------------------------------------------------

/** Limite de equipes da categoria (máximo, senão a quantidade prevista; senão a do campeonato). Nulo = sem limite. */
export async function limiteDeVagas(categoriaId: string, ligaId: number): Promise<number | null> {
  const positivo = (v: unknown) => (Number.isInteger(Number(v)) && Number(v) > 0 ? Number(v) : null)
  const cfg = await db.from('CategoriaConfiguracao').select('quantidadeEquipes,quantidadeEquipesMaxima').eq('categoriaCampeonatoId', categoriaId).maybeSingle()
  const daCategoria = !cfg.error && cfg.data ? positivo(cfg.data.quantidadeEquipesMaxima) ?? positivo(cfg.data.quantidadeEquipes) : null
  if (daCategoria) return daCategoria
  const liga = await db.from('Liga').select('quantidadeEquipes,quantidadeEquipesMaxima').eq('id', ligaId).maybeSingle()
  return !liga.error && liga.data ? positivo(liga.data.quantidadeEquipesMaxima) ?? positivo(liga.data.quantidadeEquipes) : null
}

async function ocupadasNaCategoria(categoriaId: string, exceto?: string) {
  const linhas = (lerPainel(await db.from('Inscricao').select('id,status').eq('categoriaCampeonatoId', categoriaId).in('status', [...STATUS_OCUPA_VAGA]), 'vagas ocupadas') as any[] | null) ?? []
  return linhas.filter((l) => l.id !== exceto).length
}

async function filaDaCategoria(categoriaId: string) {
  const linhas = (lerPainel(await db.from('Inscricao').select('id,posicaoEspera,timeId,ligaId,criadoEm,criadoPor').eq('categoriaCampeonatoId', categoriaId).eq('status', 'LISTA_ESPERA'), 'lista de espera') as any[] | null) ?? []
  return linhas.sort((a, b) => Number(a.posicaoEspera ?? 1e9) - Number(b.posicaoEspera ?? 1e9) || String(a.criadoEm ?? '').localeCompare(String(b.criadoEm ?? '')))
}

async function proximaPosicao(categoriaId: string) {
  const fila = await filaDaCategoria(categoriaId)
  return fila.reduce((maior, l) => Math.max(maior, Number(l.posicaoEspera) || 0), 0) + 1
}

/** Renumera a fila 1..n depois que alguém saiu. Coluna ausente: ignora. */
async function reordenarFila(categoriaId: string) {
  try {
    const fila = await filaDaCategoria(categoriaId)
    for (let i = 0; i < fila.length; i += 1) {
      if (Number(fila[i].posicaoEspera) !== i + 1) await db.from('Inscricao').update({ posicaoEspera: i + 1 }).eq('id', fila[i].id)
    }
  } catch {
    /* coluna/tabela ainda não habilitada */
  }
}

async function destinatariosDoTime(inscricao: { timeId: string; criadoPor?: string | null }) {
  const r = await db.from('MembroEquipe').select('usuarioId,papel').eq('timeId', inscricao.timeId)
  const lideres = r.error ? [] : ((r.data ?? []) as any[]).filter((m) => m.papel === 'RESPONSAVEL').map((m) => String(m.usuarioId))
  if (lideres.length > 0) return lideres
  return inscricao.criadoPor ? [String(inscricao.criadoPor)] : []
}

async function nomeDoTime(timeId: string) {
  const r = await db.from('TimeClube').select('nome').eq('id', timeId).maybeSingle()
  return String(r.data?.nome ?? 'Sua equipe')
}

async function nomeDaCategoria(categoriaId: string) {
  const r = await db.from('CategoriaCampeonato').select('nome').eq('id', categoriaId).maybeSingle()
  return String(r.data?.nome ?? '')
}

async function avisarLider(inscricao: any, tipo: TipoNotificacao, titulo: string, texto: (time: string, categoria: string) => string) {
  const [time, categoria, destinatarios] = await Promise.all([nomeDoTime(inscricao.timeId), nomeDaCategoria(inscricao.categoriaCampeonatoId), destinatariosDoTime(inscricao)])
  for (const usuarioId of destinatarios) {
    await notificar(usuarioId, tipo, titulo, texto(time, categoria), { inscricaoId: inscricao.id, ligaId: Number(inscricao.ligaId), categoriaId: inscricao.categoriaCampeonatoId })
  }
}

/** Promove, na ordem, quem está na lista de espera enquanto houver vaga. Devolve quantas promoveu. */
export async function promoverListaDeEspera(categoriaId: string, ligaId: number, nomeLiga: string): Promise<number> {
  const limite = await limiteDeVagas(categoriaId, ligaId)
  if (!limite) return 0
  let promovidas = 0
  for (let volta = 0; volta < 100; volta += 1) {
    if ((await ocupadasNaCategoria(categoriaId)) >= limite) break
    const proximo = (await filaDaCategoria(categoriaId))[0]
    if (!proximo) break
    const agora = new Date().toISOString()
    const reivindicada = await db
      .from('Inscricao')
      .update({ status: 'CONFIRMADA', posicaoEspera: null, decididaEm: agora, atualizadoEm: agora })
      .eq('id', proximo.id)
      .eq('status', 'LISTA_ESPERA')
      .select('id')
    if (reivindicada.error || !Array.isArray(reivindicada.data) || reivindicada.data.length === 0) continue
    promovidas += 1
    await garantirEquipeLegada(proximo.id)
    await avisarLider(proximo, 'INSCRICAO_PROMOVIDA', 'Uma vaga abriu', (time, categoria) => `Abriu vaga e ${time} saiu da lista de espera e foi confirmada em ${categoria} (${nomeLiga}).`)
  }
  await reordenarFila(categoriaId)
  return promovidas
}

// --- Decisão -----------------------------------------------------------------------------

export type ResultadoDecisao = { id: string; status: string; posicaoEspera: number | null; promovidas: number }

function mensagemObrigatoria(acao: AcaoDecisao, mensagem: string | null | undefined) {
  if ((acao === 'PEDIR_CORRECAO' || acao === 'RECUSAR') && !mensagem) {
    throw new ErroMeuTime(
      acao === 'RECUSAR' ? 'Informe o motivo da recusa.' : 'Diga o que a equipe precisa corrigir.',
      422,
      'DADOS_INVALIDOS',
    )
  }
}

export async function decidirInscricao(usuarioId: string, id: string, entrada: z.infer<typeof decisaoSchema>): Promise<ResultadoDecisao> {
  const { inscricao, liga } = await inscricaoDoPainel(usuarioId, id, true)
  const { acao } = entrada
  const mensagem = entrada.mensagem?.trim() || null
  mensagemObrigatoria(acao, mensagem)
  if (isCampeonatoFinalizado(liga.status)) {
    throw new ErroMeuTime(MENSAGEM_CAMPEONATO_FINALIZADO, 409, 'CAMPEONATO_FINALIZADO')
  }

  const atual = String(inscricao.status)
  const resposta = (linha: any, promovidas = 0): ResultadoDecisao => ({
    id: linha.id,
    status: linha.status,
    posicaoEspera: linha.status === 'LISTA_ESPERA' && linha.posicaoEspera != null ? Number(linha.posicaoEspera) : null,
    promovidas,
  })

  // Idempotência: repetir a mesma decisão devolve o estado atual, sem notificar de novo.
  if (acao === 'APROVAR' && atual === 'CONFIRMADA') return resposta(inscricao)
  if (acao !== 'APROVAR' && atual === DESTINO_DA_ACAO[acao]) {
    if (acao === 'PEDIR_CORRECAO' && mensagem) {
      const abertas = ((await comentariosDaInscricao(inscricao.id, false)) as any[]).filter((c) => c.tipo === 'CORRECAO' && !c.resolvidoEm)
      if (!abertas.some((c) => c.mensagem === mensagem)) await registrarComentario(inscricao.id, usuarioId, 'ORGANIZADOR', 'CORRECAO', mensagem)
    }
    return resposta(inscricao)
  }
  if (!transicaoValida(acao, atual)) {
    throw new ErroMeuTime(mensagemTransicaoInvalida(acao, atual), 409, 'TRANSICAO_INVALIDA')
  }

  // Destino real: APROVAR sem vaga vai para a lista de espera.
  let destino = DESTINO_DA_ACAO[acao] as string
  if (acao === 'APROVAR') {
    const limite = await limiteDeVagas(inscricao.categoriaCampeonatoId, Number(inscricao.ligaId))
    destino = resolverAprovacao(atual, await ocupadasNaCategoria(inscricao.categoriaCampeonatoId, inscricao.id), limite).destino
    if (destino === 'LISTA_ESPERA' && atual === 'LISTA_ESPERA') return resposta(inscricao) // continua esperando
  }

  const agora = new Date().toISOString()
  const campos: Record<string, unknown> = { status: destino, atualizadoEm: agora }
  if (acao !== 'ANALISAR') campos.decididaEm = agora
  if (acao === 'RECUSAR') campos.motivoDecisao = mensagem
  if (acao === 'PEDIR_CORRECAO') campos.comentarioPendencia = mensagem
  let posicao: number | null = null
  if (destino === 'LISTA_ESPERA') {
    posicao = await proximaPosicao(inscricao.categoriaCampeonatoId)
    campos.posicaoEspera = posicao
  } else if (atual === 'LISTA_ESPERA') {
    campos.posicaoEspera = null
  }

  // Reivindica a decisão (compara e troca no status): só uma requisição vence a corrida.
  const reivindicada = lerPainel(
    await db.from('Inscricao').update(campos).eq('id', inscricao.id).eq('status', atual).select('id'),
    'decidir inscrição',
  ) as any[] | null
  if (!reivindicada || reivindicada.length === 0) {
    const depois = await lerInscricao(inscricao.id)
    if (depois && depois.status === destino) return resposta(depois)
    throw new ErroMeuTime('Esta inscrição acabou de ser alterada. Atualize a tela e tente de novo.', 409, 'CONFLITO')
  }

  if (acao === 'PEDIR_CORRECAO' && mensagem) {
    try {
      await registrarComentario(inscricao.id, usuarioId, 'ORGANIZADOR', 'CORRECAO', mensagem)
    } catch (erro) {
      // Sem o comentário a decisão não vale: devolve o status anterior.
      await db.from('Inscricao').update({ status: atual }).eq('id', inscricao.id).eq('status', destino)
      throw erro
    }
  }

  if (destino === 'CONFIRMADA') await garantirEquipeLegada(inscricao.id)
  const atualizado = { ...inscricao, ...campos }

  const saiuDaVaga = STATUS_OCUPA_VAGA.includes(atual) && !STATUS_OCUPA_VAGA.includes(destino)
  let promovidas = 0
  if (saiuDaVaga) promovidas = await promoverListaDeEspera(inscricao.categoriaCampeonatoId, Number(inscricao.ligaId), liga.nome)
  else if (atual === 'LISTA_ESPERA') await reordenarFila(inscricao.categoriaCampeonatoId)

  await notificarDecisao(atualizado, acao, destino, posicao, liga.nome, mensagem)
  return resposta(atualizado, promovidas)
}

async function notificarDecisao(inscricao: any, acao: AcaoDecisao, destino: string, posicao: number | null, nomeLiga: string, mensagem: string | null) {
  if (acao === 'APROVAR' && destino === 'LISTA_ESPERA') {
    return avisarLider(inscricao, 'INSCRICAO_LISTA_ESPERA', 'Equipe na lista de espera', (time, categoria) => `Não há vaga agora: ${time} ficou na lista de espera de ${categoria} (${nomeLiga}), posição ${posicao}.`)
  }
  if (acao === 'APROVAR') {
    return avisarLider(inscricao, 'INSCRICAO_APROVADA', 'Inscrição aprovada', (time, categoria) => `${time} foi aprovada em ${categoria} (${nomeLiga}).`)
  }
  if (acao === 'ANALISAR') {
    return avisarLider(inscricao, 'INSCRICAO_EM_ANALISE', 'Inscrição em análise', (time, categoria) => `A inscrição de ${time} em ${categoria} (${nomeLiga}) está em análise.`)
  }
  if (acao === 'PEDIR_CORRECAO') {
    return avisarLider(inscricao, 'AJUSTE_PEDIDO', 'Ajuste pedido na inscrição', (time, categoria) => `O organizador pediu ajustes na inscrição de ${time} em ${categoria} (${nomeLiga}): ${mensagem}`)
  }
  if (acao === 'LISTA_ESPERA') {
    return avisarLider(inscricao, 'INSCRICAO_LISTA_ESPERA', 'Equipe na lista de espera', (time, categoria) => `${time} ficou na lista de espera de ${categoria} (${nomeLiga}), posição ${posicao}.`)
  }
  return avisarLider(inscricao, 'INSCRICAO_RECUSADA', 'Inscrição recusada', (time, categoria) => `A inscrição de ${time} em ${categoria} (${nomeLiga}) foi recusada. Motivo: ${mensagem}`)
}

async function registrarComentario(inscricaoId: string, autor: string, autorPapel: 'ORGANIZADOR' | 'LIDER', tipo: 'CORRECAO' | 'RESPOSTA' | 'NOTA', mensagem: string) {
  lerPainel(await db.from('ComentarioInscricao').insert({ inscricaoId, autor, autorPapel, mensagem, tipo }), 'registrar comentário')
}

// --- Lote -------------------------------------------------------------------------------------

export async function aprovarEmLote(usuarioId: string, ids: string[]) {
  const unicos = Array.from(new Set(ids))
  const resultados: Array<{ id: string; ok: boolean; status?: string; posicaoEspera?: number | null; codigo?: string }> = []
  for (const id of unicos) {
    try {
      const r = await decidirInscricao(usuarioId, id, { acao: 'APROVAR' })
      resultados.push({ id, ok: true, status: r.status, posicaoEspera: r.posicaoEspera })
    } catch (erro) {
      if (!(erro instanceof ErroMeuTime)) throw erro
      if (erro.status === 503) throw erro
      resultados.push({ id, ok: false, codigo: erro.codigo ?? String(erro.status) })
    }
  }
  // `aprovadas` = ids aprovados (CONFIRMADA); quem foi para a lista de espera vem em `listaEspera`; `falhas` = [{id, codigo}].
  return {
    aprovadas: resultados.filter((r) => r.ok && r.status === 'CONFIRMADA').map((r) => r.id),
    listaEspera: resultados.filter((r) => r.ok && r.status === 'LISTA_ESPERA').map((r) => ({ id: r.id, posicaoEspera: r.posicaoEspera ?? null })),
    falhas: resultados.filter((r) => !r.ok).map((r) => ({ id: r.id, codigo: r.codigo as string })),
  }
}

// --- Conversa com o líder (Meu Time) ---------------------------------------------------------------

async function inscricaoDaEquipe(usuarioId: string, id: string, permissao: 'leitura' | 'escrita') {
  const inscricao = await lerInscricao(id)
  if (!inscricao) throw naoEncontrada()
  // Posse: quem não é da equipe recebe 404; assistente que tenta escrever recebe 403.
  await exigirEquipe(usuarioId, inscricao.timeId, permissao)
  return inscricao
}

export async function listarComentariosDoLider(usuarioId: string, id: string) {
  const inscricao = await inscricaoDaEquipe(usuarioId, id, 'leitura')
  return { status: inscricao.status, comentarios: await comentariosDaInscricao(inscricao.id, false) }
}

export async function responderComentario(usuarioId: string, id: string, entrada: z.infer<typeof comentarioSchema>) {
  const inscricao = await inscricaoDaEquipe(usuarioId, id, 'escrita')
  const liga = await db.from('Liga').select('id,nome,status,organizadorId').eq('id', inscricao.ligaId).maybeSingle()
  if (isCampeonatoFinalizado(liga.data?.status)) throw new ErroMeuTime(MENSAGEM_CAMPEONATO_FINALIZADO, 409, 'CAMPEONATO_FINALIZADO')
  const atual = String(inscricao.status)
  if (atual === 'RASCUNHO' || atual === 'REMOVIDA') {
    throw new ErroMeuTime(atual === 'REMOVIDA' ? 'Esta inscrição foi recusada ou removida.' : 'Envie a inscrição antes de conversar com o organizador.', 409, 'TRANSICAO_INVALIDA')
  }
  await registrarComentario(inscricao.id, usuarioId, 'LIDER', 'RESPOSTA', entrada.mensagem)
  const agora = new Date().toISOString()
  // Correções abertas passam a respondidas; a inscrição volta para a análise do organizador.
  await db.from('ComentarioInscricao').update({ resolvidoEm: agora }).eq('inscricaoId', inscricao.id).eq('tipo', 'CORRECAO').is('resolvidoEm', null)
  let status = atual
  if (atual === 'AJUSTE_PEDIDO') {
    const r = lerPainel(await db.from('Inscricao').update({ status: 'EM_ANALISE', atualizadoEm: agora }).eq('id', inscricao.id).eq('status', 'AJUSTE_PEDIDO').select('id'), 'voltar para análise') as any[] | null
    if (r && r.length > 0) status = 'EM_ANALISE'
  }
  if (liga.data?.organizadorId) {
    const [time, categoria] = await Promise.all([nomeDoTime(inscricao.timeId), nomeDaCategoria(inscricao.categoriaCampeonatoId)])
    await notificar(String(liga.data.organizadorId), 'INSCRICAO_RESPOSTA', 'Equipe respondeu ao pedido de ajuste', `${time} respondeu na inscrição de ${categoria} (${liga.data.nome ?? ''}).`, { inscricaoId: inscricao.id, ligaId: Number(inscricao.ligaId) })
  }
  return { status }
}
