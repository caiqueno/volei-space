// Pedido de troca de atleta (R17). Antes de RegraElenco.prazoTrocaEm o líder troca a lista livremente (PATCH direto);
// depois do prazo a troca vira pedido que o organizador aprova ou recusa. Aprovar aplica a troca na cópia
// "InscricaoAtleta" reaproveitando as MESMAS validações de elenco da inscrição (validarInscricao), com
// compensação em caso de falha (o cliente do Supabase não tem transação). Tudo é validado no servidor.
import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { ErroMeuTime, idValido, lerDados, violacaoUnica } from '@/lib/meu-time/acesso'
import { exigirEquipe, idsComConsentimento, listarAtletasDoClube, paraAtletaDoBanco, type Permissao } from '@/lib/meu-time/dados'
import { lerElenco } from '@/lib/meu-time/elenco'
import { garantirEquipeLegada } from '@/lib/meu-time/equipe-legada'
import { lerElegibilidade, paraRegra } from '@/lib/meu-time/inscricao'
import { inscricaoViva, validarInscricao, type Naipe, type RegraElencoDados, type ResultadoValidacao, type SelecaoAtleta } from '@/lib/meu-time/regras'
import { notificar, type TipoNotificacao } from '@/lib/meu-time-fase2/notificacoes'

const db = supabaseAdmin as any

export const ESTADOS_PEDIDO = ['PENDENTE', 'APROVADO', 'RECUSADO', 'CANCELADO'] as const
export type EstadoPedido = (typeof ESTADOS_PEDIDO)[number]

const identificador = z.string().trim().min(1).max(64)

export const novoPedidoSchema = z.object({
  sai: identificador,
  entra: identificador,
  motivo: z.string().trim().min(1).max(500).optional().nullable(),
  /** Camisa do atleta que entra. Sem ela, herda a do que sai. */
  numero: z.number().int().min(0).max(99).optional(),
})

export const trocaLivreSchema = z.object({
  sai: identificador,
  entra: identificador,
  numero: z.number().int().min(0).max(99).optional(),
})

export const decisaoPedidoSchema = z.object({
  decisao: z.enum(['APROVADO', 'RECUSADO']),
  motivo: z.string().trim().min(1).max(500).optional().nullable(),
})

export const filtroEstadoSchema = z.enum(ESTADOS_PEDIDO)

const naoEncontrada = () => new ErroMeuTime('Inscrição não encontrada.', 404, 'INSCRICAO_NAO_ENCONTRADA')
const pedidoNaoEncontrado = () => new ErroMeuTime('Pedido de troca não encontrado.', 404, 'PEDIDO_NAO_ENCONTRADO')

type InscricaoLinha = { id: string; ligaId: number; categoriaCampeonatoId: string; timeId: string; status: string }

async function lerInscricao(inscricaoId: string): Promise<InscricaoLinha | null> {
  if (!idValido(inscricaoId)) return null
  return lerDados(
    await db.from('Inscricao').select('id,ligaId,categoriaCampeonatoId,timeId,status').eq('id', inscricaoId).maybeSingle(),
    'inscrição',
  ) as InscricaoLinha | null
}

/** Inscrição viva de uma equipe da qual o usuário é membro com a permissão pedida. Qualquer outra coisa = 404. */
async function inscricaoDoTime(usuarioId: string, inscricaoId: string, permissao: Permissao) {
  const inscricao = await lerInscricao(inscricaoId)
  if (!inscricao || !inscricaoViva(inscricao.status)) throw naoEncontrada()
  let acesso
  try {
    acesso = await exigirEquipe(usuarioId, inscricao.timeId, permissao)
  } catch (erro) {
    if (erro instanceof ErroMeuTime && erro.status === 404) throw naoEncontrada()
    throw erro
  }
  return { inscricao, equipe: acesso.equipe }
}

async function lerRegraDaCategoria(categoriaId: string): Promise<RegraElencoDados> {
  return paraRegra(lerElenco(await db.from('RegraElenco').select('*').eq('categoriaCampeonatoId', categoriaId).maybeSingle(), 'regra de elenco'))
}

export function prazoEncerrado(regra: Pick<RegraElencoDados, 'prazoTrocaEm'>, agora: Date = new Date()) {
  if (!regra.prazoTrocaEm) return false
  const limite = new Date(regra.prazoTrocaEm).getTime()
  return Number.isFinite(limite) && agora.getTime() >= limite
}

async function exigirCampeonatoAberto(ligaId: number) {
  const liga = lerDados(await db.from('Liga').select('id,status').eq('id', ligaId).maybeSingle(), 'campeonato') as { status: string | null } | null
  if (liga && String(liga.status ?? '').toUpperCase() === 'FINALIZADO') {
    throw new ErroMeuTime('Este campeonato está finalizado e disponível apenas para consulta.', 409, 'CAMPEONATO_FINALIZADO')
  }
}

type LinhaElenco = { id: string; atletaId: string; numero: number | null; capitao: boolean; libero: boolean; posicao: string | null }

type PlanoTroca = {
  inscricao: InscricaoLinha
  linhaQueSai: LinhaElenco
  entra: { atletaId: string; nome: string; dataNascimento: string | null; temDocumento: boolean }
  numero: number | null
  resultado: ResultadoValidacao
}

/**
 * Lê o elenco da inscrição e valida a troca (sai/entra/camisa) contra o banco do time e a regra de elenco.
 * Não grava nada. Lança 422 com o motivo quando a lista nova fica fora da regra.
 */
async function prepararTroca(inscricao: InscricaoLinha, sai: string, entra: string, numeroPedido: number | null | undefined): Promise<PlanoTroca> {
  if (!idValido(sai) || !idValido(entra) || sai === entra) {
    throw new ErroMeuTime('Informe dois atletas diferentes para a troca.', 422, 'TROCA_INVALIDA')
  }
  const elenco = (lerDados(
    await db.from('InscricaoAtleta').select('id,atletaId,numero,capitao,libero,posicao').eq('inscricaoId', inscricao.id).eq('ativo', true),
    'elenco da inscrição',
  ) as LinhaElenco[] | null) ?? []
  const linhaQueSai = elenco.find((item) => item.atletaId === sai)
  if (!linhaQueSai) throw new ErroMeuTime('O atleta que sai não está na lista desta inscrição.', 422, 'ATLETA_SAI_FORA_DA_LISTA')
  if (elenco.some((item) => item.atletaId === entra)) {
    throw new ErroMeuTime('O atleta que entra já está na lista desta inscrição.', 422, 'ATLETA_JA_NA_LISTA')
  }

  const time = lerDados(
    await db.from('TimeClube').select('id,clubeId,naipe').eq('id', inscricao.timeId).maybeSingle(),
    'equipe da inscrição',
  ) as { clubeId: string; naipe: Naipe } | null
  if (!time) throw naoEncontrada()
  const linhasDoClube = await listarAtletasDoClube(time.clubeId)
  const comConsentimento = await idsComConsentimento(linhasDoClube)
  const banco = new Map(linhasDoClube.map((linha) => [linha.id as string, paraAtletaDoBanco(linha, comConsentimento)]))
  const quemEntra = banco.get(entra)
  if (!quemEntra) throw new ErroMeuTime('O atleta que entra não está no banco do time.', 422, 'ATLETA_FORA_DO_TIME')

  const ocupados = (lerDados(
    await db.from('InscricaoAtleta').select('atletaId,inscricaoId').eq('categoriaCampeonatoId', inscricao.categoriaCampeonatoId).in('atletaId', [entra]).eq('ativo', true).eq('inscricaoAtiva', true),
    'atletas já inscritos na categoria',
  ) as Array<{ atletaId: string; inscricaoId: string }> | null) ?? []
  const comissao = await db.from('InscricaoComissao').select('id').eq('inscricaoId', inscricao.id)

  const numero = numeroPedido ?? linhaQueSai.numero
  const selecao: SelecaoAtleta[] = elenco
    .filter((item) => item.atletaId !== sai)
    .map((item) => ({ atletaId: item.atletaId, numero: item.numero ?? 0, capitao: item.capitao, libero: item.libero }))
  selecao.push({ atletaId: entra, numero: numero ?? 0, capitao: linhaQueSai.capitao, libero: linhaQueSai.libero })

  const resultado = validarInscricao(selecao, {
    naipeEquipe: time.naipe,
    regra: await lerRegraDaCategoria(inscricao.categoriaCampeonatoId),
    elegibilidade: await lerElegibilidade(inscricao.ligaId, inscricao.categoriaCampeonatoId),
    banco,
    jaInscritosNaCategoria: new Set(ocupados.filter((item) => item.inscricaoId !== inscricao.id).map((item) => item.atletaId)),
    totalComissao: comissao.error ? 0 : ((comissao.data ?? []) as unknown[]).length,
  })
  if (resultado.erros.length > 0) {
    throw new ErroMeuTime(resultado.erros[0].mensagem, 422, resultado.erros[0].codigo, { erros: resultado.erros })
  }
  return {
    inscricao,
    linhaQueSai,
    entra: { atletaId: entra, nome: quemEntra.nome, dataNascimento: quemEntra.dataNascimento, temDocumento: quemEntra.temDocumento },
    numero: numero ?? null,
    resultado,
  }
}

/**
 * Aplica a troca na cópia da inscrição: desativa a linha de quem sai e cria a de quem entra. Sem transação no
 * cliente, então se a segunda etapa falhar a primeira é desfeita (compensação) e o erro sobe.
 */
async function executarTroca(plano: PlanoTroca) {
  const { inscricao, linhaQueSai, entra, numero, resultado } = plano
  const agora = new Date().toISOString()
  const saiu = lerDados(
    await db.from('InscricaoAtleta').update({ ativo: false, removidoEm: agora }).eq('id', linhaQueSai.id).eq('ativo', true).select('id'),
    'tirar atleta da lista',
  ) as Array<{ id: string }> | null
  if (!saiu || saiu.length === 0) throw new ErroMeuTime('A lista mudou enquanto a troca era feita. Revise e tente de novo.', 409, 'CONFLITO_DE_ELENCO')

  const desfazer = async () => {
    await db.from('InscricaoAtleta').update({ ativo: true, removidoEm: null }).eq('id', linhaQueSai.id)
  }
  let entrou
  try {
    entrou = await db.from('InscricaoAtleta').insert({
      inscricaoId: inscricao.id,
      ligaId: inscricao.ligaId,
      categoriaCampeonatoId: inscricao.categoriaCampeonatoId,
      atletaId: entra.atletaId,
      nomeSnapshot: entra.nome,
      dataNascimentoSnapshot: entra.dataNascimento,
      numero,
      posicao: linhaQueSai.posicao ?? null,
      capitao: linhaQueSai.capitao,
      libero: linhaQueSai.libero,
      documentosOk: entra.temDocumento,
    })
  } catch (erro) {
    await desfazer()
    throw erro
  }
  if (entrou.error) {
    await desfazer()
    if (violacaoUnica(entrou.error)) {
      throw new ErroMeuTime('O atleta ou a camisa acabou de ser usado em outra inscrição. Revise a lista.', 409, 'CONFLITO_DE_ELENCO')
    }
    lerDados(entrou, 'colocar atleta na lista')
  }

  // Estado da inscrição acompanha as pendências recalculadas (não mexe em rascunho, ajuste pedido ou removida).
  if (inscricao.status === 'CONFIRMADA' || inscricao.status === 'CONFIRMADA_COM_PENDENCIAS') {
    const novo = await db.from('Inscricao').update({ status: resultado.status, atualizadoEm: agora }).eq('id', inscricao.id)
    if (novo.error) console.error('[pedido-troca] status da inscrição não atualizado', novo.error.code ?? '')
  }
  // Atletas que entram precisam existir também na equipe legada das partidas (idempotente, nunca falha).
  await garantirEquipeLegada(inscricao.id)
}

// --- Líder / técnico ----------------------------------------------------------------

/** Antes do prazo: o líder troca livremente. Depois do prazo: 409 com a orientação de pedir a troca. */
export async function trocarLivremente(usuarioId: string, inscricaoId: string, entrada: z.infer<typeof trocaLivreSchema>) {
  const { inscricao } = await inscricaoDoTime(usuarioId, inscricaoId, 'escrita')
  await exigirCampeonatoAberto(inscricao.ligaId)
  const regra = await lerRegraDaCategoria(inscricao.categoriaCampeonatoId)
  if (prazoEncerrado(regra)) {
    throw new ErroMeuTime('O prazo de troca livre acabou. Envie um pedido de troca para o organizador.', 409, 'PRAZO_ENCERRADO', { prazoTrocaEm: regra.prazoTrocaEm })
  }
  const plano = await prepararTroca(inscricao, entrada.sai, entrada.entra, entrada.numero)
  await executarTroca(plano)
  return { inscricaoId: inscricao.id, status: plano.resultado.status, avisos: [...plano.resultado.avisos, ...plano.resultado.pendencias] }
}

type PedidoLinha = {
  id: string
  inscricaoId: string
  atletaSaiId: string | null
  atletaEntraId: string | null
  numeroNovo: number | null
  /** Coluna "justificativa" (a API pública chama de motivo). */
  justificativa: string | null
  status: EstadoPedido
  solicitadoPor: string | null
  solicitadoEm: string | null
  decididoPor: string | null
  decididoEm: string | null
  /** Coluna "motivoDecisao" (a API pública chama de motivoRecusa). */
  motivoDecisao: string | null
}

const COLUNAS_PEDIDO = 'id,inscricaoId,atletaSaiId,atletaEntraId,numeroNovo,justificativa,status,solicitadoPor,solicitadoEm,decididoPor,decididoEm,motivoDecisao'

async function nomesDosAtletas(ids: string[]) {
  const nomes = new Map<string, string>()
  const unicos = Array.from(new Set(ids.filter(Boolean)))
  if (unicos.length === 0) return nomes
  const linhas = (lerDados(await db.from('Atleta').select('id,nome').in('id', unicos), 'nomes dos atletas') as Array<{ id: string; nome: string }> | null) ?? []
  for (const linha of linhas) nomes.set(linha.id, linha.nome)
  return nomes
}

function paraPedido(linha: PedidoLinha, nomes: Map<string, string>) {
  return {
    id: linha.id,
    inscricaoId: linha.inscricaoId,
    estado: linha.status,
    sai: { id: linha.atletaSaiId, nome: linha.atletaSaiId ? (nomes.get(linha.atletaSaiId) ?? null) : null },
    entra: { id: linha.atletaEntraId, nome: linha.atletaEntraId ? (nomes.get(linha.atletaEntraId) ?? null) : null },
    numero: linha.numeroNovo ?? null,
    motivo: linha.justificativa ?? null,
    motivoRecusa: linha.motivoDecisao ?? null,
    solicitadoEm: linha.solicitadoEm ?? null,
    decididoEm: linha.decididoEm ?? null,
  }
}

async function pedidosComNomes(linhas: PedidoLinha[]) {
  const nomes = await nomesDosAtletas(linhas.flatMap((item) => [item.atletaSaiId ?? '', item.atletaEntraId ?? '']))
  return linhas.map((linha) => paraPedido(linha, nomes))
}

export async function criarPedido(usuarioId: string, inscricaoId: string, entrada: z.infer<typeof novoPedidoSchema>) {
  const { inscricao } = await inscricaoDoTime(usuarioId, inscricaoId, 'escrita')
  await exigirCampeonatoAberto(inscricao.ligaId)
  const regra = await lerRegraDaCategoria(inscricao.categoriaCampeonatoId)
  if (!prazoEncerrado(regra)) {
    throw new ErroMeuTime('Ainda dá para trocar a lista direto, sem pedido.', 409, 'PRAZO_ABERTO', { prazoTrocaEm: regra.prazoTrocaEm })
  }
  // Mesmas validações da aprovação, para o líder saber já se o pedido faz sentido.
  const plano = await prepararTroca(inscricao, entrada.sai, entrada.entra, entrada.numero)

  const iguais = (lerElenco(
    await db.from('PedidoTroca').select('id').eq('inscricaoId', inscricao.id).eq('atletaSaiId', entrada.sai).eq('atletaEntraId', entrada.entra).eq('status', 'PENDENTE'),
    'pedidos iguais pendentes',
  ) as Array<{ id: string }> | null) ?? []
  if (iguais.length > 0) throw new ErroMeuTime('Já existe um pedido igual aguardando o organizador.', 409, 'PEDIDO_DUPLICADO')

  const criado = lerElenco(
    await db
      .from('PedidoTroca')
      .insert({
        inscricaoId: inscricao.id,
        tipo: 'SUBSTITUIR',
        atletaSaiId: entrada.sai,
        atletaEntraId: entrada.entra,
        numeroNovo: plano.numero,
        justificativa: entrada.motivo ?? null,
        status: 'PENDENTE',
        solicitadoPor: usuarioId,
        solicitadoEm: new Date().toISOString(),
      })
      .select(COLUNAS_PEDIDO)
      .single(),
    'criar pedido de troca',
  ) as PedidoLinha | null
  if (!criado) throw new ErroMeuTime('Não foi possível registrar o pedido.', 500)
  return (await pedidosComNomes([criado]))[0]
}

export async function listarPedidosDaInscricao(usuarioId: string, inscricaoId: string) {
  const { inscricao } = await inscricaoDoTime(usuarioId, inscricaoId, 'leitura')
  const linhas = (lerElenco(
    await db.from('PedidoTroca').select(COLUNAS_PEDIDO).eq('inscricaoId', inscricao.id).order('solicitadoEm', { ascending: false }),
    'pedidos de troca',
  ) as PedidoLinha[] | null) ?? []
  const regra = await lerRegraDaCategoria(inscricao.categoriaCampeonatoId)
  return { prazoTrocaEm: regra.prazoTrocaEm ?? null, trocaLivre: !prazoEncerrado(regra), pedidos: await pedidosComNomes(linhas) }
}

/** Cancela pedido pendente do próprio time. Repetir em pedido já cancelado é idempotente; decidido = 409. */
export async function cancelarPedido(usuarioId: string, inscricaoId: string, pedidoId: string) {
  const { inscricao } = await inscricaoDoTime(usuarioId, inscricaoId, 'escrita')
  if (!idValido(pedidoId)) throw pedidoNaoEncontrado()
  const atual = lerElenco(
    await db.from('PedidoTroca').select(COLUNAS_PEDIDO).eq('id', pedidoId).eq('inscricaoId', inscricao.id).maybeSingle(),
    'pedido de troca',
  ) as PedidoLinha | null
  if (!atual) throw pedidoNaoEncontrado()
  if (atual.status === 'CANCELADO') return (await pedidosComNomes([atual]))[0]
  if (atual.status !== 'PENDENTE') throw new ErroMeuTime('Este pedido já foi decidido e não pode ser cancelado.', 409, 'PEDIDO_JA_DECIDIDO')
  const cancelado = lerElenco(
    await db.from('PedidoTroca').update({ status: 'CANCELADO' }).eq('id', pedidoId).eq('status', 'PENDENTE').select(COLUNAS_PEDIDO),
    'cancelar pedido de troca',
  ) as PedidoLinha[] | null
  if (!cancelado || cancelado.length === 0) {
    // Perdeu a corrida: o organizador decidiu no mesmo instante.
    throw new ErroMeuTime('Este pedido já foi decidido e não pode ser cancelado.', 409, 'PEDIDO_JA_DECIDIDO')
  }
  return (await pedidosComNomes([cancelado[0]]))[0]
}

// --- Organizador --------------------------------------------------------------------

async function inscricoesDoOrganizador(organizadorId: string) {
  const ligas = (lerDados(await db.from('Liga').select('id').eq('organizadorId', organizadorId), 'campeonatos do organizador') as Array<{ id: number }> | null) ?? []
  if (ligas.length === 0) return []
  const inscricoes = (lerDados(
    await db.from('Inscricao').select('id,ligaId,categoriaCampeonatoId,timeId,status').in('ligaId', ligas.map((item) => item.id)),
    'inscrições do organizador',
  ) as InscricaoLinha[] | null) ?? []
  return inscricoes
}

function emBlocos<T>(lista: T[], tamanho = 100) {
  const blocos: T[][] = []
  for (let i = 0; i < lista.length; i += tamanho) blocos.push(lista.slice(i, i + tamanho))
  return blocos
}

export async function listarPedidosDoOrganizador(organizadorId: string, estado?: EstadoPedido) {
  const inscricoes = await inscricoesDoOrganizador(organizadorId)
  if (inscricoes.length === 0) return { pedidos: [] }
  const porId = new Map(inscricoes.map((item) => [item.id, item]))
  const linhas: PedidoLinha[] = []
  for (const bloco of emBlocos(inscricoes.map((item) => item.id))) {
    let consulta = db.from('PedidoTroca').select(COLUNAS_PEDIDO).in('inscricaoId', bloco)
    if (estado) consulta = consulta.eq('status', estado)
    linhas.push(...((lerElenco(await consulta.order('solicitadoEm', { ascending: false }), 'pedidos de troca') as PedidoLinha[] | null) ?? []))
  }
  linhas.sort((a, b) => String(b.solicitadoEm ?? '').localeCompare(String(a.solicitadoEm ?? '')))
  const recorte = linhas.slice(0, 200)
  const times = (lerDados(
    await db.from('TimeClube').select('id,nome').in('id', Array.from(new Set(recorte.map((item) => porId.get(item.inscricaoId)?.timeId).filter(Boolean))) as string[]),
    'equipes dos pedidos',
  ) as Array<{ id: string; nome: string }> | null) ?? []
  const categorias = (lerDados(
    await db.from('CategoriaCampeonato').select('id,nome').in('id', Array.from(new Set(recorte.map((item) => porId.get(item.inscricaoId)?.categoriaCampeonatoId).filter(Boolean))) as string[]),
    'categorias dos pedidos',
  ) as Array<{ id: string; nome: string }> | null) ?? []
  const nomeTime = new Map(times.map((item) => [item.id, item.nome]))
  const nomeCategoria = new Map(categorias.map((item) => [item.id, item.nome]))
  const pedidos = await pedidosComNomes(recorte)
  return {
    pedidos: pedidos.map((pedido) => {
      const inscricao = porId.get(pedido.inscricaoId)
      return {
        ...pedido,
        ligaId: inscricao?.ligaId ?? null,
        categoriaCampeonatoId: inscricao?.categoriaCampeonatoId ?? null,
        categoria: inscricao ? (nomeCategoria.get(inscricao.categoriaCampeonatoId) ?? null) : null,
        equipe: inscricao ? (nomeTime.get(inscricao.timeId) ?? null) : null,
      }
    }),
  }
}

/** Pedido de uma inscrição de campeonato do organizador. Qualquer outro caso (inclusive outro organizador) = 404. */
async function pedidoDoOrganizador(organizadorId: string, pedidoId: string) {
  if (!idValido(pedidoId)) throw pedidoNaoEncontrado()
  const pedido = lerElenco(
    await db.from('PedidoTroca').select(COLUNAS_PEDIDO).eq('id', pedidoId).maybeSingle(),
    'pedido de troca',
  ) as PedidoLinha | null
  if (!pedido) throw pedidoNaoEncontrado()
  const inscricao = await lerInscricao(pedido.inscricaoId)
  if (!inscricao) throw pedidoNaoEncontrado()
  const liga = lerDados(await db.from('Liga').select('id,nome,organizadorId,status').eq('id', inscricao.ligaId).maybeSingle(), 'campeonato do pedido') as
    | { nome: string; organizadorId: string | null; status: string | null }
    | null
  if (!liga || String(liga.organizadorId ?? '') !== organizadorId) throw pedidoNaoEncontrado()
  return { pedido, inscricao, liga }
}

export async function decidirPedido(organizadorId: string, pedidoId: string, entrada: z.infer<typeof decisaoPedidoSchema>) {
  const { pedido, inscricao, liga } = await pedidoDoOrganizador(organizadorId, pedidoId)
  const resposta = async (linha: PedidoLinha) => (await pedidosComNomes([linha]))[0]
  if (pedido.status === entrada.decisao) return resposta(pedido)
  if (pedido.status !== 'PENDENTE') {
    throw new ErroMeuTime(
      pedido.status === 'CANCELADO' ? 'A equipe cancelou este pedido.' : 'Este pedido já foi decidido de outra forma.',
      409,
      'PEDIDO_JA_DECIDIDO',
    )
  }
  if (String(liga.status ?? '').toUpperCase() === 'FINALIZADO') {
    throw new ErroMeuTime('Este campeonato está finalizado e disponível apenas para consulta.', 409, 'CAMPEONATO_FINALIZADO')
  }
  if (!pedido.atletaSaiId || !pedido.atletaEntraId) throw new ErroMeuTime('Pedido incompleto.', 409, 'PEDIDO_INCOMPLETO')

  // Com aprovação: valida ANTES de reivindicar, assim um pedido inválido continua pendente (o organizador pode recusar).
  const plano = entrada.decisao === 'APROVADO'
    ? await prepararTroca(inscricao, pedido.atletaSaiId, pedido.atletaEntraId, pedido.numeroNovo)
    : null

  const motivo = entrada.motivo || null
  const agora = new Date().toISOString()
  // Reivindica a decisão de forma atômica: só uma requisição vence a corrida PENDENTE -> decisão.
  const reivindicado = lerElenco(
    await db
      .from('PedidoTroca')
      .update({ status: entrada.decisao, decididoPor: organizadorId, decididoEm: agora, motivoDecisao: entrada.decisao === 'RECUSADO' ? motivo : null })
      .eq('id', pedidoId)
      .eq('status', 'PENDENTE')
      .select(COLUNAS_PEDIDO),
    'decidir pedido de troca',
  ) as PedidoLinha[] | null
  if (!reivindicado || reivindicado.length === 0) {
    const atual = lerElenco(await db.from('PedidoTroca').select(COLUNAS_PEDIDO).eq('id', pedidoId).maybeSingle(), 'pedido de troca') as PedidoLinha | null
    if (atual?.status === entrada.decisao) return resposta(atual)
    throw new ErroMeuTime('Este pedido já foi decidido de outra forma.', 409, 'PEDIDO_JA_DECIDIDO')
  }

  if (plano) {
    try {
      await executarTroca(plano)
    } catch (erro) {
      await db.from('PedidoTroca').update({ status: 'PENDENTE', decididoPor: null, decididoEm: null, motivoDecisao: null }).eq('id', pedidoId).eq('status', 'APROVADO')
      throw erro
    }
  }

  if (pedido.solicitadoPor) {
    const aprovado = entrada.decisao === 'APROVADO'
    const nomes = await nomesDosAtletas([pedido.atletaSaiId, pedido.atletaEntraId])
    const sai = nomes.get(pedido.atletaSaiId) ?? 'atleta'
    const entra = nomes.get(pedido.atletaEntraId) ?? 'atleta'
    await notificar(
      String(pedido.solicitadoPor),
      (aprovado ? 'PEDIDO_TROCA_APROVADO' : 'PEDIDO_TROCA_RECUSADO') as TipoNotificacao,
      aprovado ? 'Troca aprovada' : 'Troca recusada',
      aprovado
        ? `A troca de ${sai} por ${entra} foi aprovada em ${liga.nome}.`
        : `A troca de ${sai} por ${entra} foi recusada em ${liga.nome}.${motivo ? ` Motivo: ${motivo}` : ''}`,
      { pedidoId, inscricaoId: pedido.inscricaoId, ...(motivo ? { motivo } : {}) },
    )
  }
  return resposta(reivindicado[0])
}
