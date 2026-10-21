/** Regras de elenco e pedidos de troca (organizador): lógica PURA da tela (sem React, sem rede). A regra de verdade é do servidor. */

export type ModeloId = 'FIVB' | 'CBV' | 'AMADOR_LIVRE' | 'PERSONALIZADO'
export type Documento = 'FOTO' | 'DOCUMENTO' | 'CPF'

export const DOCUMENTOS: Array<{ value: Documento; rotulo: string }> = [
  { value: 'FOTO', rotulo: 'Foto' },
  { value: 'DOCUMENTO', rotulo: 'Documento com foto' },
  { value: 'CPF', rotulo: 'CPF' },
]

export const MODELOS_IDS: ModeloId[] = ['FIVB', 'CBV', 'AMADOR_LIVRE', 'PERSONALIZADO']
export const INTERVALO_PEDIDOS_MS = 15_000
export const MOTIVO_MAX = 300

/** Só o valor exato '1' liga a área nova. */
export function elencoCompletoAtivo(valor: string | undefined | null): boolean {
  return valor === '1'
}

export interface ValoresModelo {
  atletasMin: number | null
  atletasMax: number | null
  liberosMax: number | null
  nascimentoDe: string | null
  nascimentoAte: string | null
  documentosExigidos: Documento[]
  comissaoMax: number | null
}

export interface ModeloRegra {
  modelo: ModeloId
  nome: string
  descricao: string
  valores: ValoresModelo
  confirmado: boolean
}

/** Estado do formulário: campos numéricos como texto para permitir campo vazio. */
export interface FormRegra {
  modelo: ModeloId
  atletasMin: string
  atletasMax: string
  liberosMax: string
  nascimentoDe: string
  nascimentoAte: string
  documentosExigidos: Documento[]
  comissaoMax: string
  prazoTrocaEm: string | null
  exigeConsentimentoMenor: boolean
}

export type CampoRegra = 'atletasMin' | 'atletasMax' | 'liberosMax' | 'nascimento' | 'comissaoMax'

function texto(v: unknown): string {
  return typeof v === 'string' ? v : v == null ? '' : String(v)
}

function numeroOuNulo(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

function dataCivil(v: unknown): string | null {
  const t = texto(v).slice(0, 10)
  return /^\d{4}-\d{2}-\d{2}$/.test(t) ? t : null
}

function documentos(v: unknown): Documento[] {
  if (!Array.isArray(v)) return []
  const out: Documento[] = []
  for (const item of v) {
    const d = String(item).toUpperCase() as Documento
    if (DOCUMENTOS.some((x) => x.value === d) && !out.includes(d)) out.push(d)
  }
  return out
}

export function normalizarModelos(corpo: unknown): ModeloRegra[] {
  const lista = (corpo as { data?: unknown } | null)?.data
  if (!Array.isArray(lista)) return []
  const out: ModeloRegra[] = []
  for (const bruto of lista) {
    const m = bruto as Record<string, unknown> | null
    if (!m) continue
    const id = texto(m.modelo).toUpperCase() as ModeloId
    if (!MODELOS_IDS.includes(id)) continue
    const v = (m.valores ?? {}) as Record<string, unknown>
    out.push({
      modelo: id,
      nome: texto(m.nome) || nomePadraoModelo(id),
      descricao: texto(m.descricao),
      confirmado: m.confirmado !== false,
      valores: {
        atletasMin: numeroOuNulo(v.atletasMin),
        atletasMax: numeroOuNulo(v.atletasMax),
        liberosMax: numeroOuNulo(v.liberosMax),
        nascimentoDe: dataCivil(v.nascimentoDe),
        nascimentoAte: dataCivil(v.nascimentoAte),
        documentosExigidos: documentos(v.documentosExigidos),
        comissaoMax: numeroOuNulo(v.comissaoMax),
      },
    })
  }
  // Ordem estável dos cartões.
  return out.sort((a, b) => MODELOS_IDS.indexOf(a.modelo) - MODELOS_IDS.indexOf(b.modelo))
}

export function nomePadraoModelo(id: ModeloId): string {
  if (id === 'FIVB') return 'Padrão FIVB'
  if (id === 'CBV') return 'Padrão CBV'
  if (id === 'AMADOR_LIVRE') return 'Amador livre'
  return 'Personalizado'
}

const txt = (n: number | null) => (n == null ? '' : String(n))

export function formVazio(modelo: ModeloId = 'PERSONALIZADO'): FormRegra {
  return {
    modelo, atletasMin: '', atletasMax: '', liberosMax: '', nascimentoDe: '', nascimentoAte: '',
    documentosExigidos: [], comissaoMax: '', prazoTrocaEm: null, exigeConsentimentoMenor: false,
  }
}

/** Escolher um modelo pronto preenche os campos de valores; prazo e consentimento do responsável são mantidos. */
export function aplicarModelo(atual: FormRegra, modelo: ModeloRegra): FormRegra {
  if (modelo.modelo === 'PERSONALIZADO' && modelo.valores.atletasMin == null && modelo.valores.atletasMax == null) {
    return { ...atual, modelo: 'PERSONALIZADO' }
  }
  const v = modelo.valores
  return {
    ...atual,
    modelo: modelo.modelo,
    atletasMin: txt(v.atletasMin),
    atletasMax: txt(v.atletasMax),
    liberosMax: txt(v.liberosMax),
    nascimentoDe: v.nascimentoDe ?? '',
    nascimentoAte: v.nascimentoAte ?? '',
    documentosExigidos: [...v.documentosExigidos],
    comissaoMax: txt(v.comissaoMax),
  }
}

/** Qualquer ajuste manual de um valor faz o modelo virar "Personalizado". */
export function ajustar(atual: FormRegra, mudanca: Partial<Omit<FormRegra, 'modelo'>>): FormRegra {
  const mexeuNosValores = Object.keys(mudanca).some((k) => k !== 'prazoTrocaEm' && k !== 'exigeConsentimentoMenor')
  return { ...atual, ...mudanca, modelo: mexeuNosValores ? 'PERSONALIZADO' : atual.modelo }
}

export function alternarDocumento(lista: Documento[], doc: Documento): Documento[] {
  return lista.includes(doc) ? lista.filter((d) => d !== doc) : [...lista, doc]
}

/** Lê o GET da regra da categoria. Tolerante a campos ausentes. */
export function normalizarRegra(corpo: unknown): { form: FormRegra; somenteLeitura: boolean } {
  const d = ((corpo as { data?: unknown } | null)?.data ?? {}) as Record<string, unknown>
  const id = texto(d.modelo).toUpperCase() as ModeloId
  const prazo = texto(d.prazoTrocaEm)
  const finalizado = d.somenteLeitura === true || d.campeonatoFinalizado === true || texto(d.campeonatoStatus).toUpperCase() === 'FINALIZADO'
  return {
    somenteLeitura: finalizado,
    form: {
      modelo: MODELOS_IDS.includes(id) ? id : 'PERSONALIZADO',
      atletasMin: txt(numeroOuNulo(d.atletasMin)),
      atletasMax: txt(numeroOuNulo(d.atletasMax)),
      liberosMax: txt(numeroOuNulo(d.liberosMax)),
      nascimentoDe: dataCivil(d.nascimentoDe) ?? '',
      nascimentoAte: dataCivil(d.nascimentoAte) ?? '',
      documentosExigidos: documentos(d.documentosExigidos),
      comissaoMax: txt(numeroOuNulo(d.comissaoMax)),
      prazoTrocaEm: prazo && !Number.isNaN(new Date(prazo).getTime()) ? prazo : null,
      exigeConsentimentoMenor: d.exigeConsentimentoMenor === true,
    },
  }
}

function inteiro(s: string): number | null {
  const t = s.trim()
  if (!/^\d+$/.test(t)) return null
  return Number(t)
}

export type ErrosRegra = Partial<Record<CampoRegra, string>>

/** Validação de apoio (o servidor valida de novo). Campo vazio é permitido; texto inválido não. */
export function validarForm(f: FormRegra): ErrosRegra {
  const erros: ErrosRegra = {}
  const campos: Array<[CampoRegra, string, string, number]> = [
    ['atletasMin', f.atletasMin, 'Mínimo de atletas', 1],
    ['atletasMax', f.atletasMax, 'Máximo de atletas', 1],
    ['liberosMax', f.liberosMax, 'Máximo de líberos', 0],
    ['comissaoMax', f.comissaoMax, 'Comissão técnica', 0],
  ]
  for (const [campo, valor, nome, minimo] of campos) {
    if (!valor.trim()) continue
    const n = inteiro(valor)
    if (n == null) erros[campo] = `${nome}: use apenas números inteiros.`
    else if (n < minimo) erros[campo] = `${nome}: o menor valor é ${minimo}.`
    else if (n > 99) erros[campo] = `${nome}: o maior valor é 99.`
  }
  const min = inteiro(f.atletasMin)
  const max = inteiro(f.atletasMax)
  if (!erros.atletasMin && !erros.atletasMax && min != null && max != null && min > max) {
    erros.atletasMax = 'O máximo de atletas não pode ser menor que o mínimo.'
  }
  const lib = inteiro(f.liberosMax)
  if (!erros.liberosMax && !erros.atletasMax && lib != null && max != null && lib > max) {
    erros.liberosMax = 'O número de líberos não pode passar do máximo de atletas.'
  }
  if (f.nascimentoDe && f.nascimentoAte && f.nascimentoDe > f.nascimentoAte) {
    erros.nascimento = 'A data inicial do nascimento deve ser antes da final.'
  }
  return erros
}

export function temErros(e: ErrosRegra): boolean {
  return Object.keys(e).length > 0
}

export function dataBr(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso
}

/** "Nasceu entre 01/01/2008 e 31/12/2010." Aceita faixa aberta. */
export function explicacaoNascimento(de: string, ate: string): string {
  if (de && ate) return `Pode jogar quem nasceu entre ${dataBr(de)} e ${dataBr(ate)}.`
  if (de) return `Pode jogar quem nasceu a partir de ${dataBr(de)}.`
  if (ate) return `Pode jogar quem nasceu até ${dataBr(ate)}.`
  return 'Sem limite de idade: qualquer data de nascimento é aceita.'
}

function listaPt(itens: string[]): string {
  if (itens.length <= 1) return itens.join('')
  return `${itens.slice(0, -1).join(', ')} e ${itens[itens.length - 1]}`
}

function dataHoraBr(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} às ${p(d.getHours())}:${p(d.getMinutes())}`
}

/** Resumo em frase simples do que o time precisa cumprir. */
export function fraseResumo(f: FormRegra): string {
  const min = inteiro(f.atletasMin)
  const max = inteiro(f.atletasMax)
  const frases: string[] = []
  if (min != null && max != null) frases.push(`Seu time precisa ter de ${min} a ${max} atletas.`)
  else if (min != null) frases.push(`Seu time precisa ter pelo menos ${min} atletas.`)
  else if (max != null) frases.push(`Seu time pode ter no máximo ${max} atletas.`)
  else frases.push('Não há limite de atletas por time.')
  const lib = inteiro(f.liberosMax)
  if (lib != null) frases.push(lib === 0 ? 'Não é permitido inscrever líbero.' : lib === 1 ? 'Pode ter 1 líbero.' : `Pode ter até ${lib} líberos.`)
  const com = inteiro(f.comissaoMax)
  if (com != null) frases.push(com === 0 ? 'Não há comissão técnica na inscrição.' : com === 1 ? 'A comissão técnica pode ter 1 pessoa.' : `A comissão técnica pode ter até ${com} pessoas.`)
  if (f.nascimentoDe || f.nascimentoAte) frases.push(explicacaoNascimento(f.nascimentoDe, f.nascimentoAte))
  if (f.documentosExigidos.length > 0) {
    const nomes = f.documentosExigidos.map((d) => (DOCUMENTOS.find((x) => x.value === d)?.rotulo ?? d).toLowerCase())
    frases.push(`Cada atleta precisa enviar ${listaPt(nomes)}.`)
  } else {
    frases.push('Nenhum documento é exigido dos atletas.')
  }
  if (f.exigeConsentimentoMenor) frases.push('Atletas menores de idade precisam da autorização do responsável.')
  if (f.prazoTrocaEm) {
    const quando = dataHoraBr(f.prazoTrocaEm)
    if (quando) frases.push(`Trocas de atletas podem ser pedidas até ${quando}.`)
  }
  return frases.join(' ')
}

/** Corpo do PUT: campos vazios são omitidos (o PUT substitui a regra inteira). */
export function corpoPut(f: FormRegra): Record<string, unknown> {
  const corpo: Record<string, unknown> = { modelo: f.modelo }
  const numeros: Array<['atletasMin' | 'atletasMax' | 'liberosMax' | 'comissaoMax', string]> = [
    ['atletasMin', f.atletasMin], ['atletasMax', f.atletasMax], ['liberosMax', f.liberosMax], ['comissaoMax', f.comissaoMax],
  ]
  for (const [k, v] of numeros) {
    const n = inteiro(v)
    if (n != null) corpo[k] = n
  }
  if (f.nascimentoDe) corpo.nascimentoDe = f.nascimentoDe
  if (f.nascimentoAte) corpo.nascimentoAte = f.nascimentoAte
  corpo.documentosExigidos = f.documentosExigidos
  if (f.prazoTrocaEm) corpo.prazoTrocaEm = f.prazoTrocaEm
  corpo.exigeConsentimentoMenor = f.exigeConsentimentoMenor
  return corpo
}

export function iguais(a: FormRegra, b: FormRegra): boolean {
  return JSON.stringify(corpoPut(a)) === JSON.stringify(corpoPut(b))
}

export function urlRegra(categoriaId: string): string {
  return `/api/organizador/categorias/${encodeURIComponent(categoriaId)}/regra-elenco`
}

export type TipoFalha = 'desligado' | 'nao-habilitado' | 'conflito' | 'sessao' | 'generica'

export interface RespostaTratada {
  ok: boolean
  tipo?: TipoFalha
  mensagem: string
  /** Em 409 a tela deve recarregar a lista/regra. */
  recarregar?: boolean
}

/** 404 = recurso desligado, 503 = não habilitado, 409 = conflito (decisão contrária ou campeonato finalizado). */
export function tratarResposta(status: number, corpo?: { error?: string } | null): RespostaTratada {
  if (status >= 200 && status < 300) return { ok: true, mensagem: '' }
  const erro = typeof corpo?.error === 'string' && corpo.error ? corpo.error : ''
  if (status === 404) return { ok: false, tipo: 'desligado', mensagem: 'Este recurso ainda não está disponível.' }
  if (status === 503) return { ok: false, tipo: 'nao-habilitado', mensagem: 'As regras de elenco ainda não estão habilitadas neste ambiente.' }
  if (status === 409) return { ok: false, tipo: 'conflito', recarregar: true, mensagem: erro || 'Este item já recebeu outra decisão. A tela foi atualizada.' }
  if (status === 401 || status === 403) return { ok: false, tipo: 'sessao', mensagem: 'Sua sessão não tem permissão para esta ação. Entre novamente.' }
  return { ok: false, tipo: 'generica', mensagem: erro || 'Não foi possível concluir. Tente de novo.' }
}

// ---------------------------------------------------------------- Pedidos de troca

export type EstadoPedido = 'PENDENTE' | 'APROVADO' | 'RECUSADO' | 'CANCELADO'
export type FiltroPedido = 'PENDENTE' | 'APROVADO' | 'RECUSADO'

export const FILTROS_PEDIDO: Array<{ value: FiltroPedido; rotulo: string }> = [
  { value: 'PENDENTE', rotulo: 'Pendentes' },
  { value: 'APROVADO', rotulo: 'Aprovados' },
  { value: 'RECUSADO', rotulo: 'Recusados' },
]

export interface AtletaResumo {
  id: string
  numero: number | null
  nomeAbreviado: string
}

export interface PedidoTroca {
  id: string
  equipe: { id: string; nome: string }
  categoria: string
  campeonato: string
  sai: AtletaResumo
  entra: AtletaResumo
  motivo: string | null
  estado: EstadoPedido
  criadoEm: string | null
}

function atleta(v: unknown): AtletaResumo {
  const a = (v ?? {}) as Record<string, unknown>
  const n = numeroOuNulo(a.numero)
  return { id: texto(a.id), numero: n, nomeAbreviado: texto(a.nomeAbreviado) || 'Atleta' }
}

export function normalizarPedidos(corpo: unknown): PedidoTroca[] {
  const lista = (corpo as { data?: unknown } | null)?.data
  if (!Array.isArray(lista)) return []
  const out: PedidoTroca[] = []
  for (const bruto of lista) {
    const p = bruto as Record<string, unknown> | null
    if (!p || p.id == null) continue
    const eq = (p.equipe ?? {}) as Record<string, unknown>
    const estado = texto(p.estado).toUpperCase()
    out.push({
      id: texto(p.id),
      equipe: { id: texto(eq.id), nome: texto(eq.nome) || 'Equipe' },
      categoria: texto(p.categoria),
      campeonato: texto(p.campeonato),
      sai: atleta(p.sai),
      entra: atleta(p.entra),
      motivo: p.motivo ? texto(p.motivo) : null,
      estado: (['PENDENTE', 'APROVADO', 'RECUSADO', 'CANCELADO'].includes(estado) ? estado : 'PENDENTE') as EstadoPedido,
      criadoEm: p.criadoEm ? texto(p.criadoEm) : null,
    })
  }
  return out
}

export function urlPedidos(estado: FiltroPedido): string {
  return `/api/organizador/pedidos-troca?${new URLSearchParams({ estado }).toString()}`
}

export function urlDecidirPedido(id: string): string {
  return `/api/organizador/pedidos-troca/${encodeURIComponent(id)}/decidir`
}

export function podeDecidirPedido(estado: string): boolean {
  return estado === 'PENDENTE'
}

export function contarPedidosPendentes(lista: Array<{ estado: string }>): number {
  return lista.filter((p) => p.estado === 'PENDENTE').length
}

/** Texto curto do contador do menu: vazio quando zero, "99+" no teto. */
export function rotuloContador(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return ''
  return n > 99 ? '99+' : String(Math.floor(n))
}

export function limparMotivo(valor: string): string | undefined {
  const m = valor.trim().slice(0, MOTIVO_MAX)
  return m ? m : undefined
}

export function rotuloAtleta(a: AtletaResumo): string {
  return a.numero != null ? `${a.nomeAbreviado} (camisa ${a.numero})` : a.nomeAbreviado
}

const ROTULOS_PEDIDO: Record<EstadoPedido, string> = {
  PENDENTE: 'Pendente', APROVADO: 'Aprovado', RECUSADO: 'Recusado', CANCELADO: 'Cancelado',
}

export function rotuloEstadoPedido(estado: string): string {
  return ROTULOS_PEDIDO[estado as EstadoPedido] ?? 'Desconhecido'
}

export function textoVazioPedidos(estado: FiltroPedido): string {
  if (estado === 'PENDENTE') return 'Nenhum pedido de troca esperando por você. Quando uma equipe pedir para trocar um atleta, ele aparece aqui.'
  if (estado === 'APROVADO') return 'Nenhum pedido de troca aprovado ainda.'
  return 'Nenhum pedido de troca recusado.'
}

export function mensagemDecisaoPedido(decisao: 'APROVADO' | 'RECUSADO', equipe: string): string {
  return decisao === 'APROVADO' ? `A troca de ${equipe} foi aprovada.` : `A troca de ${equipe} foi recusada.`
}

export function itemAtivoPedidos(pathname: string): boolean {
  return pathname === '/painel/pedidos-troca' || pathname.startsWith('/painel/pedidos-troca/')
}

export function dataCurta(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getDate())}/${p(d.getMonth() + 1)} ${p(d.getHours())}:${p(d.getMinutes())}`
}
