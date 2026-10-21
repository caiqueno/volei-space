/**
 * Lógica PURA da interface do pagamento por comprovante (Pix). Sem React e sem rede.
 * A regra de verdade é do servidor; aqui só há retorno rápido, textos e montagem de pedidos.
 */

/** Só o valor exato '1' liga as telas novas. Desligada = telas atuais idênticas e nenhuma requisição. */
export function pagamentoComprovanteAtivo(valor: string | undefined | null = process.env.NEXT_PUBLIC_PAGAMENTO_COMPROVANTE_ATIVO): boolean {
  return valor === '1'
}

// ---------------------------------------------------------------- tipos

export type ModoPagamento = 'NENHUM' | 'COMPROVANTE'
export type EstadoPagamento = 'PENDENTE' | 'COMPROVANTE_ENVIADO' | 'CONFIRMADO' | 'RECUSADO' | 'ISENTO'
export type DecisaoPagamento = 'CONFIRMAR' | 'RECUSAR' | 'ISENTAR'
export type PapelPagamento = 'ADMINISTRADOR' | 'FINANCEIRO' | 'ARBITRAGEM' | null

const ESTADOS: EstadoPagamento[] = ['PENDENTE', 'COMPROVANTE_ENVIADO', 'CONFIRMADO', 'RECUSADO', 'ISENTO']

export function normalizarEstado(valor: unknown): EstadoPagamento | null {
  const s = typeof valor === 'string' ? valor.trim().toUpperCase() : ''
  return (ESTADOS as string[]).includes(s) ? (s as EstadoPagamento) : null
}

// ---------------------------------------------------------------- dinheiro

/** Dígitos de um texto qualquer. */
function digitos(texto: string): string {
  return texto.replace(/\D+/g, '')
}

/** Centavos inteiros em "150,00" (sem o símbolo). */
export function centavosParaReais(centavos: number): string {
  if (!Number.isFinite(centavos) || centavos < 0) return '0,00'
  const c = Math.round(centavos)
  const inteiro = Math.floor(c / 100).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return `${inteiro},${String(c % 100).padStart(2, '0')}`
}

/** "R$ 150,00". */
export function formatarReais(centavos: number): string {
  return `R$ ${centavosParaReais(centavos)}`
}

/**
 * Máscara de digitação: cada dígito entra pelos centavos ("1" -> "0,01", "15000" -> "150,00").
 * Aceita colar "R$ 150,00". Limite de 9 dígitos (R$ 9.999.999,99).
 */
export function mascaraReais(entrada: string): string {
  const d = digitos(entrada).replace(/^0+(?=\d)/, '').slice(0, 9)
  if (!d) return ''
  return centavosParaReais(Number(d))
}

/** Texto digitado ("150", "150,5", "1.234,56", "R$ 150,00") em centavos. null se não for um valor válido. */
export function reaisParaCentavos(texto: string): number | null {
  const limpo = texto.replace(/R\$/gi, '').replace(/\s+/g, '')
  if (!limpo) return null
  if (!/^[\d.,]+$/.test(limpo)) return null
  const ultimaVirgula = limpo.lastIndexOf(',')
  let inteiro: string
  let frac = ''
  if (ultimaVirgula >= 0) {
    inteiro = limpo.slice(0, ultimaVirgula)
    frac = limpo.slice(ultimaVirgula + 1)
    if (frac.includes('.') || frac.length > 2) return null
  } else {
    // Sem vírgula: o ponto só vale como separador de milhar (1.234) e nunca como decimal.
    inteiro = limpo
  }
  inteiro = inteiro.replace(/\./g, '')
  if (!/^\d*$/.test(inteiro) || !/^\d*$/.test(frac)) return null
  if (!inteiro && !frac) return null
  const reais = Number(inteiro || '0')
  const cents = Number((frac + '00').slice(0, 2))
  const total = reais * 100 + cents
  return Number.isSafeInteger(total) ? total : null
}

// ---------------------------------------------------------------- configuração da categoria (organizador)

export const INSTRUCOES_MAX = 500
export const CHAVE_PIX_MAX = 140
export const BENEFICIARIO_MAX = 100
/** Teto de R$ 100.000,00 por time. */
export const VALOR_MAX_CENTAVOS = 10_000_000

export type ConfigPagamento = {
  modo: ModoPagamento
  /** Texto do campo, já com a máscara (ex.: "150,00"). */
  valor: string
  pixChave: string
  pixBeneficiario: string
  instrucoes: string
}

export const CONFIG_VAZIA: ConfigPagamento = { modo: 'NENHUM', valor: '', pixChave: '', pixBeneficiario: '', instrucoes: '' }

function objeto(v: unknown): Record<string, unknown> {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {}
}
function texto(v: unknown): string {
  return typeof v === 'string' ? v : v == null ? '' : String(v)
}

/** Resposta de GET /api/organizador/categorias/[id]/pagamento -> campos do formulário. */
export function normalizarConfig(corpo: unknown): ConfigPagamento {
  const d = objeto(objeto(corpo).data)
  const modo: ModoPagamento = texto(d.modo).toUpperCase() === 'COMPROVANTE' ? 'COMPROVANTE' : 'NENHUM'
  const centavos = typeof d.valorCentavos === 'number' && Number.isFinite(d.valorCentavos) ? d.valorCentavos : null
  return {
    modo,
    valor: centavos != null && centavos > 0 ? centavosParaReais(centavos) : '',
    pixChave: texto(d.pixChave),
    pixBeneficiario: texto(d.pixBeneficiario),
    instrucoes: texto(d.instrucoes),
  }
}

export type ErrosConfig = Partial<Record<'valor' | 'pixChave' | 'pixBeneficiario' | 'instrucoes', string>>

export function validarConfig(c: ConfigPagamento): ErrosConfig {
  if (c.modo !== 'COMPROVANTE') return {}
  const erros: ErrosConfig = {}
  const centavos = reaisParaCentavos(c.valor)
  if (centavos == null || centavos <= 0) erros.valor = 'Informe quanto cada time paga, maior que zero.'
  else if (centavos > VALOR_MAX_CENTAVOS) erros.valor = 'O valor passa do limite de R$ 100.000,00.'
  if (!c.pixChave.trim()) erros.pixChave = 'Informe a chave Pix que vai receber.'
  else if (c.pixChave.trim().length > CHAVE_PIX_MAX) erros.pixChave = 'A chave Pix está grande demais.'
  if (!c.pixBeneficiario.trim()) erros.pixBeneficiario = 'Informe o nome de quem recebe.'
  else if (c.pixBeneficiario.trim().length > BENEFICIARIO_MAX) erros.pixBeneficiario = 'O nome está grande demais.'
  if (c.instrucoes.length > INSTRUCOES_MAX) erros.instrucoes = `Use até ${INSTRUCOES_MAX} caracteres nas instruções.`
  return erros
}

/** Corpo do PUT. Em NENHUM não manda os campos de Pix. */
export function corpoConfig(c: ConfigPagamento): { modo: ModoPagamento; valorCentavos?: number; pixChave?: string; pixBeneficiario?: string; instrucoes?: string } {
  if (c.modo !== 'COMPROVANTE') return { modo: 'NENHUM' }
  const corpo: ReturnType<typeof corpoConfig> = {
    modo: 'COMPROVANTE',
    valorCentavos: reaisParaCentavos(c.valor) ?? 0,
    pixChave: c.pixChave.trim(),
    pixBeneficiario: c.pixBeneficiario.trim(),
  }
  const instrucoes = c.instrucoes.trim()
  if (instrucoes) corpo.instrucoes = instrucoes
  return corpo
}

/** Frase de resumo mostrada antes de salvar. */
export function fraseResumo(c: ConfigPagamento): string {
  if (c.modo !== 'COMPROVANTE') return 'Sem cobrança por esta categoria: o time se inscreve sem pagar pelo volei.space.'
  const centavos = reaisParaCentavos(c.valor)
  const valor = centavos != null && centavos > 0 ? formatarReais(centavos) : 'o valor que você definir'
  return `Cada time paga ${valor} por Pix e envia o comprovante; você confirma antes de aprovar.`
}

export function tituloConfirmacaoConfig(c: ConfigPagamento): string {
  return c.modo === 'COMPROVANTE' ? 'Ativar o Pix com comprovante?' : 'Desativar o Pix com comprovante?'
}

export function textoConfirmacaoConfig(c: ConfigPagamento, nomeCategoria: string): string {
  if (c.modo === 'COMPROVANTE') return `Categoria ${nomeCategoria}. ${fraseResumo(c)} Confira a chave Pix: o dinheiro vai para ela.`
  return `Categoria ${nomeCategoria}. Os times deixam de ver a cobrança. Inscrições que já enviaram comprovante continuam registradas.`
}

// ---------------------------------------------------------------- estado do pagamento

/** Resposta de GET /api/organizador/inscricoes/[id]/pagamento e item `pagamento` da lista. */
export type PagamentoOrganizador = {
  valorCentavos: number
  estado: EstadoPagamento
  comprovanteEnviadoEm: string | null
  decididoEm: string | null
  motivoRecusa: string | null
}

export function normalizarPagamentoOrganizador(corpo: unknown): PagamentoOrganizador | null {
  const d = objeto(objeto(corpo).data)
  const estado = normalizarEstado(d.estado)
  if (!estado) return null
  return {
    valorCentavos: typeof d.valorCentavos === 'number' && Number.isFinite(d.valorCentavos) ? d.valorCentavos : 0,
    estado,
    comprovanteEnviadoEm: d.comprovanteEnviadoEm ? texto(d.comprovanteEnviadoEm) : null,
    decididoEm: d.decididoEm ? texto(d.decididoEm) : null,
    motivoRecusa: d.motivoRecusa ? texto(d.motivoRecusa) : null,
  }
}

export type PagamentoDaLista = { estado: EstadoPagamento; valorCentavos: number }

/** `pagamento` de cada item da lista do painel, por id da inscrição. Itens sem pagamento ficam de fora. */
export function extrairPagamentosDaLista(corpo: unknown): Record<string, PagamentoDaLista> {
  const dados = objeto(objeto(corpo).data)
  const itens = Array.isArray(dados.itens) ? dados.itens : []
  const mapa: Record<string, PagamentoDaLista> = {}
  for (const bruto of itens) {
    const item = objeto(bruto)
    if (item.id == null || item.id === '') continue
    const p = objeto(item.pagamento)
    const estado = normalizarEstado(p.estado)
    if (!estado) continue
    mapa[texto(item.id)] = { estado, valorCentavos: typeof p.valorCentavos === 'number' && Number.isFinite(p.valorCentavos) ? p.valorCentavos : 0 }
  }
  return mapa
}

export type Tom = 'ok' | 'atencao' | 'erro' | 'neutro'

const ROTULO_ORGANIZADOR: Record<EstadoPagamento, string> = {
  PENDENTE: 'Aguardando pagamento',
  COMPROVANTE_ENVIADO: 'Comprovante enviado',
  CONFIRMADO: 'Pagamento confirmado',
  RECUSADO: 'Comprovante recusado',
  ISENTO: 'Isento',
}

const TOM: Record<EstadoPagamento, Tom> = {
  PENDENTE: 'atencao',
  COMPROVANTE_ENVIADO: 'atencao',
  CONFIRMADO: 'ok',
  RECUSADO: 'erro',
  ISENTO: 'neutro',
}

export function rotuloEstadoOrganizador(estado: EstadoPagamento): string {
  return ROTULO_ORGANIZADOR[estado]
}

export function tomDoEstado(estado: EstadoPagamento): Tom {
  return TOM[estado]
}

/** Etiqueta curta da lista do painel. */
export function etiquetaDaLista(p: PagamentoDaLista): string {
  return `${rotuloEstadoOrganizador(p.estado)} · ${formatarReais(p.valorCentavos)}`
}

/** true quando o pagamento ainda impede aprovar (o servidor decide; aqui só avisa). */
export function pagamentoBloqueiaAprovar(estado: EstadoPagamento | null | undefined): boolean {
  return estado === 'PENDENTE' || estado === 'COMPROVANTE_ENVIADO' || estado === 'RECUSADO'
}

/** Aviso de por que Aprovar não vai passar e o que fazer. */
export function avisoAprovarBloqueado(estado: EstadoPagamento): string {
  if (estado === 'COMPROVANTE_ENVIADO') return 'Para aprovar, confira o comprovante e confirme o pagamento no detalhe da inscrição.'
  if (estado === 'RECUSADO') return 'O comprovante foi recusado. Aprove só depois que o time enviar outro e você confirmar o pagamento.'
  return 'Para aprovar, o time precisa pagar e enviar o comprovante, ou você pode isentar o pagamento no detalhe.'
}

export const MENSAGEM_PAGAMENTO_PENDENTE =
  'Esta inscrição ainda não pode ser aprovada: o pagamento não está confirmado. Abra o detalhe da inscrição, confira o comprovante e confirme o pagamento (ou isente o time).'

// ---------------------------------------------------------------- líder

export type PixDoTime = { chave: string; beneficiario: string; instrucoes: string }

export type PagamentoLider = {
  exige: boolean
  valorCentavos: number
  pix: PixDoTime
  estado: EstadoPagamento
  motivoRecusa: string | null
  comprovanteEnviado: boolean
}

export function normalizarPagamentoLider(corpo: unknown): PagamentoLider | null {
  const d = objeto(objeto(corpo).data)
  if (Object.keys(d).length === 0) return null
  const pix = objeto(d.pix)
  return {
    exige: d.exige === true,
    valorCentavos: typeof d.valorCentavos === 'number' && Number.isFinite(d.valorCentavos) ? d.valorCentavos : 0,
    pix: { chave: texto(pix.chave), beneficiario: texto(pix.beneficiario), instrucoes: texto(pix.instrucoes) },
    estado: normalizarEstado(d.estado) ?? 'PENDENTE',
    motivoRecusa: d.motivoRecusa ? texto(d.motivoRecusa) : null,
    comprovanteEnviado: d.comprovanteEnviado === true,
  }
}

/**
 * Cobrança da categoria vista pelo líder ANTES de existir a inscrição (passo "Revisar e enviar").
 * Lê `data.pagamento` da resposta das regras da categoria; sem esse campo, devolve null e a tela não mostra nada.
 */
export function pagamentoDasRegras(corpo: unknown): PagamentoLider | null {
  const bruto = objeto(objeto(corpo).data).pagamento
  if (!bruto || typeof bruto !== 'object') return null
  const p = normalizarPagamentoLider({ data: bruto })
  return p && p.exige && p.valorCentavos > 0 ? p : null
}

export type TextoEstadoLider = { rotulo: string; explicacao: string; tom: Tom }

export function textoEstadoLider(estado: EstadoPagamento, motivoRecusa?: string | null): TextoEstadoLider {
  switch (estado) {
    case 'PENDENTE':
      return { rotulo: 'Aguardando seu pagamento', explicacao: 'Faça o Pix e envie o comprovante abaixo.', tom: 'atencao' }
    case 'COMPROVANTE_ENVIADO':
      return { rotulo: 'Comprovante enviado, aguardando o organizador', explicacao: 'O organizador vai conferir e confirmar. Você não precisa fazer mais nada.', tom: 'atencao' }
    case 'CONFIRMADO':
      return { rotulo: 'Pagamento confirmado', explicacao: 'Tudo certo com o pagamento desta inscrição.', tom: 'ok' }
    case 'RECUSADO': {
      const motivo = motivoRecusa?.trim()
      return { rotulo: 'Comprovante recusado', explicacao: `${motivo ? `Motivo: ${motivo}. ` : ''}Envie outro comprovante.`, tom: 'erro' }
    }
    case 'ISENTO':
      return { rotulo: 'Isento', explicacao: 'O organizador isentou este time do pagamento.', tom: 'ok' }
  }
}

/** O líder só envia comprovante quando falta pagar ou quando o anterior foi recusado. */
export function liderPodeEnviarComprovante(p: Pick<PagamentoLider, 'exige' | 'estado'>): boolean {
  return p.exige && (p.estado === 'PENDENTE' || p.estado === 'RECUSADO')
}

/** Reenviar depois de COMPROVANTE_ENVIADO ainda é possível, mas só como troca (antes da decisão). */
export function liderPodeTrocarComprovante(p: Pick<PagamentoLider, 'exige' | 'estado'>): boolean {
  return p.exige && p.estado === 'COMPROVANTE_ENVIADO'
}

/** Texto copiável do Pix (a chave pura, sem enfeite). */
export function textoParaCopiar(chave: string): string {
  return chave.trim()
}

// ---------------------------------------------------------------- botões do organizador

export type BotoesPagamento = { confirmar: boolean; recusar: boolean; isentar: boolean; verComprovante: boolean }

/** ARBITRAGEM só lê. Papel desconhecido (null) libera a tela e deixa o servidor responder 403. */
export function podeDecidirPagamento(papel: PapelPagamento): boolean {
  return papel === null || papel === 'ADMINISTRADOR' || papel === 'FINANCEIRO'
}

export function botoesDoPagamento(estado: EstadoPagamento, papel: PapelPagamento, comprovanteEnviadoEm: string | null): BotoesPagamento {
  const decide = podeDecidirPagamento(papel)
  const tem = comprovanteEnviadoEm != null && comprovanteEnviadoEm !== ''
  return {
    confirmar: decide && (estado === 'PENDENTE' || estado === 'COMPROVANTE_ENVIADO' || estado === 'RECUSADO'),
    recusar: decide && estado === 'COMPROVANTE_ENVIADO',
    isentar: decide && (estado === 'PENDENTE' || estado === 'COMPROVANTE_ENVIADO' || estado === 'RECUSADO'),
    verComprovante: tem && (estado === 'COMPROVANTE_ENVIADO' || estado === 'CONFIRMADO' || estado === 'RECUSADO'),
  }
}

export const MOTIVO_MAX = 300

/** Retorno rápido da decisão. null = pode enviar. */
export function validarDecisaoPagamento(decisao: DecisaoPagamento, motivo: string): string | null {
  if (decisao === 'RECUSAR' && !motivo.trim()) return 'Explique o motivo da recusa para o time saber o que corrigir.'
  if (motivo.length > MOTIVO_MAX) return `Use até ${MOTIVO_MAX} caracteres no motivo.`
  return null
}

export function corpoDecisaoPagamento(decisao: DecisaoPagamento, motivo: string): { decisao: DecisaoPagamento; motivo?: string } {
  const m = motivo.trim()
  return decisao === 'RECUSAR' || (decisao === 'ISENTAR' && m) ? { decisao, motivo: m } : { decisao }
}

export function tituloDecisaoPagamento(decisao: DecisaoPagamento): string {
  if (decisao === 'CONFIRMAR') return 'Confirmar o pagamento?'
  if (decisao === 'RECUSAR') return 'Recusar o comprovante?'
  return 'Isentar o pagamento?'
}

export function textoDecisaoPagamento(decisao: DecisaoPagamento, equipe: string, valorCentavos: number): string {
  if (decisao === 'CONFIRMAR') return `Você confirma que recebeu ${formatarReais(valorCentavos)} de ${equipe}. Depois disso a inscrição pode ser aprovada.`
  if (decisao === 'RECUSAR') return `${equipe} será avisada e poderá enviar outro comprovante. O motivo é obrigatório.`
  return `${equipe} não precisará pagar ${formatarReais(valorCentavos)}. Use quando o time já pagou por outro meio ou tem desconto total.`
}

export function mensagemDecisaoPagamento(decisao: DecisaoPagamento, equipe: string): string {
  if (decisao === 'CONFIRMAR') return `Pagamento de ${equipe} confirmado.`
  if (decisao === 'RECUSAR') return `Comprovante de ${equipe} recusado. O time foi avisado.`
  return `${equipe} foi isentada do pagamento.`
}

// ---------------------------------------------------------------- datas

export function dataHora(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} às ${p(d.getHours())}:${p(d.getMinutes())}`
}

// ---------------------------------------------------------------- rotas e respostas

export const urlConfigCategoria = (categoriaId: string) => `/api/organizador/categorias/${encodeURIComponent(categoriaId)}/pagamento`
export const urlPagamentoOrganizador = (inscricaoId: string) => `/api/organizador/inscricoes/${encodeURIComponent(inscricaoId)}/pagamento`
export const urlComprovanteOrganizador = (inscricaoId: string) => `${urlPagamentoOrganizador(inscricaoId)}/comprovante-url`
export const urlDecidirPagamento = (inscricaoId: string) => `${urlPagamentoOrganizador(inscricaoId)}/decidir`
export const urlPagamentoLider = (inscricaoId: string) => `/api/meu-time/inscricoes/${encodeURIComponent(inscricaoId)}/pagamento`

/** Só abre link https; nunca guarda. */
export function urlComprovanteSegura(valor: unknown): string | null {
  if (typeof valor !== 'string') return null
  try {
    const u = new URL(valor)
    return u.protocol === 'https:' ? u.toString() : null
  } catch {
    return null
  }
}

export type TipoFalhaPagamento = 'desligado' | 'nao-habilitado' | 'pagamento-pendente' | 'conflito' | 'sessao' | 'validacao' | 'generica'
export type FalhaPagamento = { tipo: TipoFalhaPagamento; mensagem: string; recarregar?: boolean }
export type RespostaPagamento = { ok: true } | ({ ok: false } & FalhaPagamento)

/** Traduz o status HTTP (e o código 409) em mensagem simples. 404 = flag desligada; 503 = não habilitado. */
export function tratarRespostaPagamento(status: number, corpo?: { error?: unknown; codigo?: unknown } | null): RespostaPagamento {
  if (status >= 200 && status < 300) return { ok: true }
  const erro = typeof corpo?.error === 'string' && corpo.error.trim() ? corpo.error.trim() : ''
  const codigo = typeof corpo?.codigo === 'string' ? corpo.codigo : ''
  if (status === 404) return { ok: false, tipo: 'desligado', mensagem: 'O pagamento por comprovante ainda não está disponível.' }
  if (status === 503) return { ok: false, tipo: 'nao-habilitado', mensagem: 'O pagamento por comprovante ainda não está habilitado neste ambiente.' }
  if (status === 409 && codigo === 'PAGAMENTO_PENDENTE') return { ok: false, tipo: 'pagamento-pendente', mensagem: MENSAGEM_PAGAMENTO_PENDENTE, recarregar: true }
  if (status === 409) return { ok: false, tipo: 'conflito', recarregar: true, mensagem: erro || 'O pagamento mudou de situação e a ação não vale mais. A tela foi atualizada.' }
  if (status === 401) return { ok: false, tipo: 'sessao', mensagem: 'Sua sessão expirou. Entre novamente.' }
  if (status === 403) return { ok: false, tipo: 'sessao', mensagem: erro || 'Seu papel não permite esta ação.' }
  if (status === 400 || status === 422) return { ok: false, tipo: 'validacao', mensagem: erro || 'Confira os dados informados.' }
  return { ok: false, tipo: 'generica', mensagem: erro || 'Não foi possível concluir. Tente de novo.' }
}

/** 409 PAGAMENTO_PENDENTE vindo da aprovação (só existe com a flag do servidor ligada). */
export function ehPagamentoPendente(status: number, corpo?: { codigo?: unknown } | null): boolean {
  return status === 409 && corpo?.codigo === 'PAGAMENTO_PENDENTE'
}

/** Mensagem da aprovação: explica o pagamento pendente; nos demais casos mantém a mensagem que já existia. */
export function mensagemDaAprovacao(status: number, corpo: { codigo?: unknown } | null | undefined, padrao: string): string {
  return ehPagamentoPendente(status, corpo) ? MENSAGEM_PAGAMENTO_PENDENTE : padrao
}

/** Falha que esconde a área toda (flag do servidor desligada ou módulo não habilitado). */
export function falhaEscondeArea(tipo: TipoFalhaPagamento | undefined): boolean {
  return tipo === 'desligado' || tipo === 'nao-habilitado'
}

// ---------------------------------------------------------------- upload do comprovante

export type PedidoAssinaturaComprovante = {
  equipeId: string
  inscricaoId: string
  tipo: 'COMPROVANTE'
  nomeArquivo: string
  contentType: string
  tamanho: number
}

function nomeSeguroArquivo(nome: string): string {
  const limpo = nome
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/\.{2,}/g, '.')
    .replace(/^[-.]+|[-.]+$/g, '')
    .slice(0, 80)
  return limpo || 'comprovante'
}

export function montarPedidoComprovante(entrada: { equipeId: string; inscricaoId: string; arquivo: { name: string; type: string; size: number } }): PedidoAssinaturaComprovante {
  if (!entrada.inscricaoId) throw new Error('Envie o comprovante a partir de uma inscrição.')
  return {
    equipeId: entrada.equipeId,
    inscricaoId: entrada.inscricaoId,
    tipo: 'COMPROVANTE',
    nomeArquivo: nomeSeguroArquivo(entrada.arquivo.name),
    contentType: entrada.arquivo.type,
    tamanho: entrada.arquivo.size,
  }
}

export function montarConfirmacaoComprovante(entrada: { equipeId: string; inscricaoId: string }, path: string) {
  return { equipeId: entrada.equipeId, inscricaoId: entrada.inscricaoId, tipo: 'COMPROVANTE' as const, path }
}
