// Pagamento por comprovante (R19): configuração da categoria, estado do pagamento por inscrição, decisão do
// organizador e consulta do líder. Toda permissão e regra de negócio é conferida aqui, no servidor.
// Nada devolve o caminho do comprovante: a leitura é só pela URL assinada de 60 s (rota própria).
import { supabaseAdmin } from '@/lib/supabase-admin'
import { isCampeonatoFinalizado, MENSAGEM_CAMPEONATO_FINALIZADO } from '@/lib/championship-finalization'
import { ErroMeuTime, idValido, violacaoUnica } from '@/lib/meu-time/acesso'
import { exigirEquipe } from '@/lib/meu-time/dados'
import { notificar, type TipoNotificacao } from '@/lib/meu-time-fase2/notificacoes'
import { exigirLigaDoPainel, type LigaDoPainel } from '@/lib/painel-inscricoes/acesso'
import { ErroStorageMeuTime, assinarLeituraComprovante, caminhoPertenceAoDono } from '@/lib/uploads/meu-time'
import { pagamentoComprovanteAtivo, lerPagamentoDb, recursoPagamentoAusente, indisponivelPagamento } from './config'
import { validarCorpo } from './acesso'
import {
  configDaLinha,
  configPagamentoSchema,
  decisaoPagamentoSchema,
  estadoLiberaAprovacao,
  exigeComprovante,
  mensagemPagamentoPendente,
  transicaoDoPagamento,
  type ConfigPagamento,
  type EstadoPagamento,
} from './regras'

const db = supabaseAdmin as any

const COLUNAS_CONFIG = 'pagamentoModo,valorInscricaoCentavos,pixChave,pixBeneficiario,pagamentoInstrucoes'
const COLUNAS_PAGAMENTO = 'id,inscricaoId,valorCentavos,estado,comprovantePath,comprovanteEnviadoEm,decididoPor,decididoEm,motivoRecusa'

export type LinhaPagamento = {
  id: string
  inscricaoId: string
  valorCentavos: number
  estado: EstadoPagamento
  comprovantePath: string | null
  comprovanteEnviadoEm: string | null
  decididoPor: string | null
  decididoEm: string | null
  motivoRecusa: string | null
}

export type InscricaoParaPagamento = {
  id: string
  ligaId: number
  timeId: string
  categoriaCampeonatoId: string
  status: string
  criadoPor?: string | null
}

/** Tipos de notificação do pagamento (ver NOTA no relatório: a união TipoNotificacao ainda não os lista). */
export type TipoNotificacaoPagamento = 'COMPROVANTE_ENVIADO' | 'PAGAMENTO_CONFIRMADO' | 'PAGAMENTO_RECUSADO'

export const inscricaoNaoEncontrada = () => new ErroMeuTime('Inscrição não encontrada.', 404, 'INSCRICAO_NAO_ENCONTRADA')
const categoriaNaoEncontrada = () => new ErroMeuTime('Categoria não encontrada.', 404, 'CATEGORIA_NAO_ENCONTRADA')

// --- Leitura -------------------------------------------------------------------------------------------

/**
 * Configuração de pagamento da categoria. Com `tolerante`, coluna ausente (migration pendente) vale "sem cobrança";
 * sem ele vira 503.
 */
export async function lerConfigDaCategoria(categoriaId: string, tolerante = false): Promise<ConfigPagamento> {
  const r = await db.from('CategoriaConfiguracao').select(COLUNAS_CONFIG).eq('categoriaCampeonatoId', categoriaId).maybeSingle()
  if (r.error && tolerante && recursoPagamentoAusente(r.error)) return configDaLinha(null)
  return configDaLinha(lerPagamentoDb(r, 'configuração de pagamento da categoria') as Record<string, unknown> | null)
}

/** Linha do pagamento da inscrição. Com `tolerante`, tabela ausente vale "sem linha"; sem ele vira 503. */
export async function lerLinhaPagamento(inscricaoId: string, tolerante = false): Promise<LinhaPagamento | null> {
  const r = await db.from('PagamentoInscricao').select(COLUNAS_PAGAMENTO).eq('inscricaoId', inscricaoId).maybeSingle()
  if (r.error && tolerante && recursoPagamentoAusente(r.error)) return null
  return lerPagamentoDb(r, 'pagamento da inscrição') as LinhaPagamento | null
}

export async function lerInscricaoParaPagamento(id: string): Promise<InscricaoParaPagamento | null> {
  if (!idValido(id)) return null
  const r = await db.from('Inscricao').select('id,ligaId,timeId,categoriaCampeonatoId,status,criadoPor').eq('id', id).maybeSingle()
  if (r.error) {
    console.error('[pagamento-comprovante] inscrição', r.error.code ?? '')
    throw new ErroMeuTime('Não foi possível concluir a operação. Tente novamente.', 500)
  }
  return (r.data as InscricaoParaPagamento | null) ?? null
}

// --- Criação do pagamento (cópia do valor) -------------------------------------------------------------

/**
 * Cria o pagamento PENDENTE da inscrição com o valor da categoria NESTE momento (cópia própria: mudar o valor da
 * categoria depois não altera quem já se inscreveu). Idempotente. Sem flag, sem cobrança ou inscrição removida = null.
 */
export async function garantirPagamentoPendente(inscricao: Pick<InscricaoParaPagamento, 'id' | 'categoriaCampeonatoId' | 'status'>, configConhecida?: ConfigPagamento): Promise<LinhaPagamento | null> {
  if (!pagamentoComprovanteAtivo()) return null
  const config = configConhecida ?? (await lerConfigDaCategoria(inscricao.categoriaCampeonatoId, true))
  if (!exigeComprovante(config) || inscricao.status === 'REMOVIDA') return null
  const existente = await lerLinhaPagamento(inscricao.id)
  if (existente) return existente
  const criada = await db
    .from('PagamentoInscricao')
    .insert({ inscricaoId: inscricao.id, valorCentavos: config.valorCentavos, estado: 'PENDENTE' })
    .select(COLUNAS_PAGAMENTO)
    .single()
  if (violacaoUnica(criada.error)) return lerLinhaPagamento(inscricao.id)
  return lerPagamentoDb(criada, 'criar pagamento da inscrição') as LinhaPagamento | null
}

/** Para os fluxos de inscrição: nunca derruba a inscrição já criada; a consulta do líder e a aprovação refazem a tentativa. */
export async function garantirPagamentoSemFalhar(inscricaoId: string | null | undefined): Promise<LinhaPagamento | null> {
  if (!inscricaoId || !pagamentoComprovanteAtivo()) return null
  try {
    const inscricao = await lerInscricaoParaPagamento(inscricaoId)
    return inscricao ? await garantirPagamentoPendente(inscricao) : null
  } catch (erro) {
    console.error('[pagamento-comprovante] pagamento pendente não criado', erro instanceof ErroMeuTime ? erro.codigo ?? erro.status : 'erro')
    return null
  }
}

// --- Regra da aprovação ---------------------------------------------------------------------------------

/**
 * APROVAR só vale com o pagamento CONFIRMADO ou ISENTO quando a categoria cobra por comprovante com valor > 0.
 * Sem a flag, ou sem cobrança, não faz nada. Lança 409 PAGAMENTO_PENDENTE com a mensagem do motivo.
 */
export async function exigirPagamentoLiberado(inscricao: InscricaoParaPagamento): Promise<void> {
  if (!pagamentoComprovanteAtivo()) return
  const config = await lerConfigDaCategoria(inscricao.categoriaCampeonatoId, true)
  if (!exigeComprovante(config)) return
  const linha = (await lerLinhaPagamento(inscricao.id)) ?? (await garantirPagamentoPendente(inscricao, config))
  if (linha && estadoLiberaAprovacao(linha.estado)) return
  throw new ErroMeuTime(mensagemPagamentoPendente(linha?.estado ?? 'PENDENTE', linha?.motivoRecusa), 409, 'PAGAMENTO_PENDENTE')
}

/** Para a promoção automática da lista de espera: quem ainda deve o pagamento não ocupa a vaga que abriu. */
export async function pagamentoLiberadoParaPromocao(inscricao: InscricaoParaPagamento): Promise<boolean> {
  try {
    await exigirPagamentoLiberado(inscricao)
    return true
  } catch (erro) {
    return !(erro instanceof ErroMeuTime && erro.codigo === 'PAGAMENTO_PENDENTE')
  }
}

/** Resumo por inscrição para o painel e o CSV: estado e valor. `null` = a categoria não cobra. Tabelas ausentes = nada. */
export async function resumosDePagamento(inscricoes: Array<{ id: string; categoriaCampeonatoId: string }>): Promise<Map<string, { estado: EstadoPagamento; valorCentavos: number } | null>> {
  const saida = new Map<string, { estado: EstadoPagamento; valorCentavos: number } | null>()
  if (inscricoes.length === 0) return saida
  const categoriaIds = Array.from(new Set(inscricoes.map((i) => i.categoriaCampeonatoId)))
  const [configs, pagamentos] = await Promise.all([
    db.from('CategoriaConfiguracao').select(`categoriaCampeonatoId,${COLUNAS_CONFIG}`).in('categoriaCampeonatoId', categoriaIds),
    db.from('PagamentoInscricao').select('inscricaoId,valorCentavos,estado').in('inscricaoId', inscricoes.map((i) => i.id)),
  ])
  const porCategoria = new Map<string, ConfigPagamento>()
  // Listagem do painel: recurso ainda ausente neste banco = sem informação de pagamento (nunca derruba a lista).
  if (configs.error) {
    if (!recursoPagamentoAusente(configs.error)) lerPagamentoDb({ data: null, error: configs.error }, 'configurações de pagamento')
  } else for (const c of (configs.data ?? []) as any[]) porCategoria.set(c.categoriaCampeonatoId, configDaLinha(c))
  const porInscricao = new Map<string, { estado: EstadoPagamento; valorCentavos: number }>()
  if (pagamentos.error) {
    if (!recursoPagamentoAusente(pagamentos.error)) lerPagamentoDb({ data: null, error: pagamentos.error }, 'pagamentos das inscrições')
  } else for (const p of (pagamentos.data ?? []) as any[]) porInscricao.set(p.inscricaoId, { estado: p.estado, valorCentavos: Number(p.valorCentavos) })
  for (const inscricao of inscricoes) {
    const config = porCategoria.get(inscricao.categoriaCampeonatoId)
    const linha = porInscricao.get(inscricao.id)
    if (linha) saida.set(inscricao.id, linha)
    else if (config && exigeComprovante(config)) saida.set(inscricao.id, { estado: 'PENDENTE', valorCentavos: config.valorCentavos as number })
    else saida.set(inscricao.id, null)
  }
  return saida
}

// --- Notificações --------------------------------------------------------------------------------------

function avisar(usuarioId: string, tipo: TipoNotificacaoPagamento, titulo: string, mensagem: string, dados: Record<string, unknown>) {
  // A união TipoNotificacao (meu-time-fase2) ainda não lista os tipos do R19; a tabela e os canais aceitam texto livre.
  return notificar(usuarioId, tipo as unknown as TipoNotificacao, titulo, mensagem, dados)
}

async function nomesDaInscricao(inscricao: InscricaoParaPagamento) {
  const [time, categoria] = await Promise.all([
    db.from('TimeClube').select('nome').eq('id', inscricao.timeId).maybeSingle(),
    db.from('CategoriaCampeonato').select('nome').eq('id', inscricao.categoriaCampeonatoId).maybeSingle(),
  ])
  return { time: String(time.data?.nome ?? 'Sua equipe'), categoria: String(categoria.data?.nome ?? '') }
}

async function destinatariosDaEquipe(inscricao: InscricaoParaPagamento) {
  const r = await db.from('MembroEquipe').select('usuarioId,papel').eq('timeId', inscricao.timeId)
  const membros = r.error ? [] : ((r.data ?? []) as any[]).filter((m) => m.papel === 'RESPONSAVEL' || m.papel === 'TECNICO').map((m) => String(m.usuarioId))
  if (membros.length > 0) return Array.from(new Set(membros))
  return inscricao.criadoPor ? [String(inscricao.criadoPor)] : []
}

/** Avisa o dono do campeonato que a equipe enviou o comprovante. */
export async function avisarComprovanteEnviado(inscricao: InscricaoParaPagamento) {
  const liga = await db.from('Liga').select('id,nome,organizadorId').eq('id', inscricao.ligaId).maybeSingle()
  if (!liga.data?.organizadorId) return
  const nomes = await nomesDaInscricao(inscricao)
  await avisar(
    String(liga.data.organizadorId),
    'COMPROVANTE_ENVIADO',
    'Comprovante de pagamento enviado',
    `${nomes.time} enviou o comprovante de pagamento de ${nomes.categoria} (${liga.data.nome ?? ''}).`,
    { inscricaoId: inscricao.id, ligaId: Number(inscricao.ligaId), categoriaId: inscricao.categoriaCampeonatoId },
  )
}

// --- Organizador: configuração da categoria -------------------------------------------------------------

async function categoriaDoOrganizador(usuarioId: string, categoriaId: string, escrita: boolean): Promise<{ categoria: { id: string; ligaId: number }; liga: LigaDoPainel }> {
  if (!idValido(categoriaId)) throw categoriaNaoEncontrada()
  const r = await db.from('CategoriaCampeonato').select('id,ligaId').eq('id', categoriaId).is('removidaEm', null).maybeSingle()
  if (r.error) {
    console.error('[pagamento-comprovante] categoria', r.error.code ?? '')
    throw new ErroMeuTime('Não foi possível concluir a operação. Tente novamente.', 500)
  }
  if (!r.data) throw categoriaNaoEncontrada()
  // Sem relação com o campeonato = 404 (IDOR); papel só de leitura numa escrita = 403.
  const liga = await exigirLigaDoPainel(usuarioId, Number(r.data.ligaId), escrita).catch((erro) => {
    if (erro instanceof ErroMeuTime && erro.status === 404) throw categoriaNaoEncontrada()
    throw erro
  })
  return { categoria: { id: String(r.data.id), ligaId: Number(r.data.ligaId) }, liga }
}

function paraResposta(config: ConfigPagamento) {
  return { modo: config.modo, valorCentavos: config.valorCentavos, pixChave: config.pixChave, pixBeneficiario: config.pixBeneficiario, instrucoes: config.instrucoes }
}

export async function lerConfigPagamento(usuarioId: string, categoriaId: string) {
  const { categoria } = await categoriaDoOrganizador(usuarioId, categoriaId, false)
  return paraResposta(await lerConfigDaCategoria(categoria.id))
}

const presente = (corpo: unknown, campo: string) => typeof corpo === 'object' && corpo !== null && Object.prototype.hasOwnProperty.call(corpo, campo)

export async function gravarConfigPagamento(usuarioId: string, categoriaId: string, corpo: unknown) {
  const { categoria, liga } = await categoriaDoOrganizador(usuarioId, categoriaId, true)
  const entrada = validarCorpo(configPagamentoSchema, corpo)
  if (isCampeonatoFinalizado(liga.status)) throw new ErroMeuTime(MENSAGEM_CAMPEONATO_FINALIZADO, 409, 'CAMPEONATO_FINALIZADO')

  const campos: Record<string, unknown> = { pagamentoModo: entrada.modo, atualizadoEm: new Date().toISOString() }
  if (entrada.modo === 'COMPROVANTE') {
    // Cobrança: o conjunto inteiro vem no corpo (valor e Pix já foram exigidos pela validação).
    Object.assign(campos, { valorInscricaoCentavos: entrada.valorCentavos, pixChave: entrada.pixChave, pixBeneficiario: entrada.pixBeneficiario, pagamentoInstrucoes: entrada.instrucoes })
  } else {
    // Sem cobrança: só mexe no que veio no corpo (o valor 0 explícito é o "Gratuito" do explorar).
    if (presente(corpo, 'valorCentavos')) campos.valorInscricaoCentavos = entrada.valorCentavos ?? null
    if (presente(corpo, 'pixChave')) campos.pixChave = entrada.pixChave
    if (presente(corpo, 'pixBeneficiario')) campos.pixBeneficiario = entrada.pixBeneficiario
    if (presente(corpo, 'instrucoes')) campos.pagamentoInstrucoes = entrada.instrucoes
  }

  const atual = lerPagamentoDb(await db.from('CategoriaConfiguracao').select('categoriaCampeonatoId').eq('categoriaCampeonatoId', categoria.id).maybeSingle(), 'configuração da categoria') as { categoriaCampeonatoId: string } | null
  if (atual) {
    lerPagamentoDb(await db.from('CategoriaConfiguracao').update(campos).eq('categoriaCampeonatoId', categoria.id).select('categoriaCampeonatoId'), 'gravar configuração de pagamento')
  } else {
    lerPagamentoDb(await db.from('CategoriaConfiguracao').insert({ categoriaCampeonatoId: categoria.id, ligaId: categoria.ligaId, ...campos }), 'criar configuração de pagamento')
  }
  return paraResposta(await lerConfigDaCategoria(categoria.id))
}

// --- Organizador: pagamento da inscrição ------------------------------------------------------------------

type Nivel = 'leitura' | 'financeiro'

async function inscricaoDoOrganizador(usuarioId: string, inscricaoId: string, nivel: Nivel) {
  const inscricao = await lerInscricaoParaPagamento(inscricaoId)
  if (!inscricao) throw inscricaoNaoEncontrada()
  const liga = await exigirLigaDoPainel(usuarioId, Number(inscricao.ligaId), false).catch((erro) => {
    if (erro instanceof ErroMeuTime && erro.status === 404) throw inscricaoNaoEncontrada()
    throw erro
  })
  // Comprovante e decisão: dono, ADMINISTRADOR e FINANCEIRO. ARBITRAGEM só consulta o estado.
  if (nivel === 'financeiro' && liga.papel === 'ARBITRAGEM') {
    throw new ErroMeuTime('Seu papel na organização não permite esta ação.', 403, 'SEM_PERMISSAO')
  }
  return { inscricao, liga }
}

function resumoPagamento(linha: LinhaPagamento) {
  return {
    valorCentavos: linha.valorCentavos,
    estado: linha.estado,
    comprovanteEnviadoEm: linha.comprovanteEnviadoEm ?? null,
    decididoEm: linha.decididoEm ?? null,
    motivoRecusa: linha.estado === 'RECUSADO' ? linha.motivoRecusa ?? null : null,
  }
}

export async function lerPagamentoParaOrganizador(usuarioId: string, inscricaoId: string) {
  const { inscricao } = await inscricaoDoOrganizador(usuarioId, inscricaoId, 'leitura')
  const config = await lerConfigDaCategoria(inscricao.categoriaCampeonatoId, true)
  const exige = exigeComprovante(config)
  const linha = await lerLinhaPagamento(inscricao.id, !exige)
  if (linha) return { exige, ...resumoPagamento(linha), temComprovante: Boolean(linha.comprovantePath) }
  if (exige) return { exige, valorCentavos: config.valorCentavos, estado: 'PENDENTE' as const, comprovanteEnviadoEm: null, decididoEm: null, motivoRecusa: null, temComprovante: false }
  return { exige, valorCentavos: null, estado: null, comprovanteEnviadoEm: null, decididoEm: null, motivoRecusa: null, temComprovante: false }
}

export async function urlDoComprovante(usuarioId: string, inscricaoId: string) {
  const { inscricao } = await inscricaoDoOrganizador(usuarioId, inscricaoId, 'financeiro')
  const semComprovante = () => new ErroMeuTime('Comprovante não encontrado.', 404, 'COMPROVANTE_NAO_ENCONTRADO')
  const linha = await lerLinhaPagamento(inscricao.id)
  const caminho = linha?.comprovantePath
  if (!linha || !caminho || !caminhoPertenceAoDono(caminho, inscricao.id)) throw semComprovante()
  try {
    const assinado = await assinarLeituraComprovante(caminho)
    if (!assinado) throw semComprovante()
    return assinado
  } catch (erro) {
    if (erro instanceof ErroStorageMeuTime) {
      if (erro.bucketAusente) throw indisponivelPagamento()
      throw new ErroMeuTime('Não foi possível falar com o armazenamento de arquivos. Tente novamente.', 502, 'STORAGE_INDISPONIVEL')
    }
    throw erro
  }
}

export async function decidirPagamento(usuarioId: string, inscricaoId: string, corpo: unknown) {
  const { inscricao, liga } = await inscricaoDoOrganizador(usuarioId, inscricaoId, 'financeiro')
  const entrada = validarCorpo(decisaoPagamentoSchema, corpo)
  if (isCampeonatoFinalizado(liga.status)) throw new ErroMeuTime(MENSAGEM_CAMPEONATO_FINALIZADO, 409, 'CAMPEONATO_FINALIZADO')
  if (inscricao.status === 'REMOVIDA') throw new ErroMeuTime('Esta inscrição foi recusada ou removida.', 409, 'TRANSICAO_INVALIDA')

  const config = await lerConfigDaCategoria(inscricao.categoriaCampeonatoId, true)
  let linha = await lerLinhaPagamento(inscricao.id)
  if (!linha && exigeComprovante(config)) linha = await garantirPagamentoPendente(inscricao, config)
  if (!linha) throw new ErroMeuTime('Esta categoria não cobra por comprovante.', 409, 'SEM_COBRANCA')

  const transicao = transicaoDoPagamento(entrada.decisao, linha.estado)
  if (transicao.tipo === 'conflito') throw new ErroMeuTime(transicao.mensagem, 409, 'PAGAMENTO_CONFLITO')
  if (transicao.tipo === 'repetida') return resumoPagamento(linha) // idempotente: sem novo aviso

  const agora = new Date().toISOString()
  const motivo = entrada.decisao === 'RECUSAR' ? entrada.motivo ?? null : null
  // Reivindica a decisão comparando o estado lido: só uma requisição vence a corrida.
  const reivindicada = lerPagamentoDb(
    await db
      .from('PagamentoInscricao')
      .update({ estado: transicao.destino, decididoPor: usuarioId, decididoEm: agora, motivoRecusa: motivo, atualizadoEm: agora })
      .eq('id', linha.id)
      .eq('estado', linha.estado)
      .select('id'),
    'decidir pagamento',
  ) as any[] | null
  if (!reivindicada || reivindicada.length === 0) {
    const depois = await lerLinhaPagamento(inscricao.id)
    if (depois && depois.estado === transicao.destino) return resumoPagamento(depois)
    throw new ErroMeuTime('Este pagamento acabou de ser alterado. Atualize a tela e tente de novo.', 409, 'CONFLITO')
  }

  const atualizada: LinhaPagamento = { ...linha, estado: transicao.destino, decididoPor: usuarioId, decididoEm: agora, motivoRecusa: motivo }
  if (entrada.decisao !== 'ISENTAR') {
    const nomes = await nomesDaInscricao(inscricao)
    const confirmado = entrada.decisao === 'CONFIRMAR'
    for (const destinatario of await destinatariosDaEquipe(inscricao)) {
      await avisar(
        destinatario,
        confirmado ? 'PAGAMENTO_CONFIRMADO' : 'PAGAMENTO_RECUSADO',
        confirmado ? 'Pagamento confirmado' : 'Comprovante recusado',
        confirmado
          ? `O pagamento de ${nomes.time} em ${nomes.categoria} (${liga.nome}) foi confirmado.`
          : `O comprovante de ${nomes.time} em ${nomes.categoria} (${liga.nome}) foi recusado. Motivo: ${motivo}`,
        { inscricaoId: inscricao.id, ligaId: Number(inscricao.ligaId), categoriaId: inscricao.categoriaCampeonatoId },
      )
    }
  }
  return resumoPagamento(atualizada)
}

// --- Líder / técnico -------------------------------------------------------------------------------------

export async function consultarPagamentoDoLider(usuarioId: string, inscricaoId: string) {
  const inscricao = await lerInscricaoParaPagamento(inscricaoId)
  if (!inscricao) throw inscricaoNaoEncontrada()
  // Posse: quem não é da equipe recebe 404 (a chave Pix não aparece); assistente recebe 403.
  await exigirEquipe(usuarioId, inscricao.timeId, 'escrita')
  const config = await lerConfigDaCategoria(inscricao.categoriaCampeonatoId, true)
  const semCobranca = { exige: false, valorCentavos: null, pix: null, estado: null, comprovanteEnviado: false }
  if (!exigeComprovante(config)) return semCobranca
  const linha = (await lerLinhaPagamento(inscricao.id)) ?? (await garantirPagamentoPendente(inscricao, config))
  if (!linha) return semCobranca
  return {
    exige: true,
    valorCentavos: linha.valorCentavos,
    pix: { chave: config.pixChave, beneficiario: config.pixBeneficiario, instrucoes: config.instrucoes },
    estado: linha.estado,
    ...(linha.estado === 'RECUSADO' && linha.motivoRecusa ? { motivoRecusa: linha.motivoRecusa } : {}),
    comprovanteEnviado: Boolean(linha.comprovantePath),
  }
}

export { indisponivelPagamento }
