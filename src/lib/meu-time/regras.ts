// Regras do Meu Time, puras (sem banco, sem rede), para serem testadas isoladamente.
// O servidor chama estas funções antes de gravar qualquer inscrição.
import {
  mensagemElegibilidade,
  type ElegibilidadeCategoria,
} from '@/lib/elegibilidade-categoria'

export const STATUS_INSCRICAO = [
  'RASCUNHO',
  'CONFIRMADA',
  'CONFIRMADA_COM_PENDENCIAS',
  'AJUSTE_PEDIDO',
  'REMOVIDA',
] as const
export type StatusInscricao = (typeof STATUS_INSCRICAO)[number]

/** Inscrição que ainda ocupa vaga e prende o atleta à categoria. */
export function inscricaoViva(status: string) {
  return status !== 'REMOVIDA'
}

export const NAIPES = ['FEMININO', 'MASCULINO', 'MISTO'] as const
export type Naipe = (typeof NAIPES)[number]

export const NUMERO_MAXIMO_CAMISA = 99
export const MAXIMO_ATLETAS_POR_PEDIDO = 60

export type AtletaDoBanco = {
  id: string
  nome: string
  dataNascimento: string | null
  /** Valor do banco: 'F' ou 'M'. */
  sexo: string | null
  temDocumento: boolean
}

export type SelecaoAtleta = {
  atletaId: string
  numero: number
  capitao?: boolean
  libero?: boolean
}

export type RegraElencoDados = {
  atletasMin: number | null
  atletasMax: number | null
  liberosMax: number
  nascimentoDe: string | null
  nascimentoAte: string | null
  comissaoMax: number | null
  documentosExigidos: string[]
}

/** Sem linha em "RegraElenco" a categoria não impõe limites, só a regra de líbero padrão. */
export const REGRA_ELENCO_PADRAO: RegraElencoDados = {
  atletasMin: null,
  atletasMax: null,
  liberosMax: 2,
  nascimentoDe: null,
  nascimentoAte: null,
  comissaoMax: null,
  documentosExigidos: [],
}

export type ContextoInscricao = {
  naipeEquipe: Naipe
  regra: RegraElencoDados
  elegibilidade: ElegibilidadeCategoria | null
  /** Atletas do banco do clube, indexados por id. */
  banco: Map<string, AtletaDoBanco>
  /** Atletas já ativos em OUTRA inscrição viva da mesma categoria. */
  jaInscritosNaCategoria: Set<string>
  totalComissao: number
  hoje?: Date
}

export type ErroRegra = { codigo: string; mensagem: string; atletaId?: string }

export type ResultadoValidacao = {
  erros: ErroRegra[]
  avisos: string[]
  /** Itens que faltam mas não impedem a inscrição (vira CONFIRMADA_COM_PENDENCIAS). */
  pendencias: string[]
  status: StatusInscricao
}

function nomeCurto(atleta: AtletaDoBanco | undefined) {
  return atleta?.nome ?? 'Atleta'
}

function plural(n: number, singular: string, pluralTexto: string) {
  return `${n} ${n === 1 ? singular : pluralTexto}`
}

/** Mensagem do cartão de prontidão: "Seu time tem 9 atletas. 2 estão sem documento." */
export function resumoProntidao(atletas: Array<{ temDocumento: boolean }>) {
  const total = atletas.length
  const semDocumento = atletas.filter((atleta) => !atleta.temDocumento).length
  let mensagem: string
  if (total === 0) mensagem = 'Seu time ainda não tem atletas. Adicione os primeiros para se inscrever.'
  else if (semDocumento === 0) mensagem = `Seu time tem ${plural(total, 'atleta', 'atletas')}. Tudo certo.`
  else {
    const estado = semDocumento === 1 ? '1 está sem documento' : `${semDocumento} estão sem documento`
    mensagem = `Seu time tem ${plural(total, 'atleta', 'atletas')}. ${estado}.`
  }
  return { atletas: total, semDocumento, mensagem }
}

function dataIso(valor: string | null | undefined) {
  return valor ? String(valor).slice(0, 10) : null
}

/**
 * Valida a lista de atletas escolhida para uma categoria.
 * Erros bloqueiam; pendências e avisos não. Nunca devolve estado de aprovação:
 * a inscrição é automática, então o resultado é CONFIRMADA ou CONFIRMADA_COM_PENDENCIAS.
 */
export function validarInscricao(selecao: SelecaoAtleta[], contexto: ContextoInscricao): ResultadoValidacao {
  const erros: ErroRegra[] = []
  const avisos: string[] = []
  const pendencias: string[] = []
  const { regra, banco } = contexto

  if (selecao.length === 0) {
    erros.push({ codigo: 'SEM_ATLETAS', mensagem: 'Escolha pelo menos 1 atleta para a inscrição.' })
  }

  const vistos = new Set<string>()
  const numeros = new Map<number, string>()
  let capitaes = 0
  let liberos = 0

  for (const item of selecao) {
    const atleta = banco.get(item.atletaId)
    if (!atleta) {
      erros.push({ codigo: 'ATLETA_FORA_DO_TIME', mensagem: 'Há atleta que não faz parte do banco deste time.', atletaId: item.atletaId })
      continue
    }
    if (vistos.has(item.atletaId)) {
      erros.push({ codigo: 'ATLETA_REPETIDO', mensagem: `${nomeCurto(atleta)} aparece mais de uma vez na lista.`, atletaId: item.atletaId })
      continue
    }
    vistos.add(item.atletaId)

    if (!Number.isInteger(item.numero) || item.numero < 0 || item.numero > NUMERO_MAXIMO_CAMISA) {
      erros.push({ codigo: 'NUMERO_INVALIDO', mensagem: `A camisa de ${nomeCurto(atleta)} deve ser de 0 a ${NUMERO_MAXIMO_CAMISA}.`, atletaId: item.atletaId })
    } else if (numeros.has(item.numero)) {
      erros.push({
        codigo: 'NUMERO_REPETIDO',
        mensagem: `A camisa ${item.numero} está em ${nomeCurto(banco.get(numeros.get(item.numero)!))} e em ${nomeCurto(atleta)}.`,
        atletaId: item.atletaId,
      })
    } else {
      numeros.set(item.numero, item.atletaId)
    }

    if (item.capitao && item.libero) {
      erros.push({ codigo: 'CAPITAO_LIBERO', mensagem: `${nomeCurto(atleta)} não pode ser capitão e líbero ao mesmo tempo.`, atletaId: item.atletaId })
    }
    if (item.capitao) capitaes += 1
    if (item.libero) liberos += 1

    if (contexto.jaInscritosNaCategoria.has(item.atletaId)) {
      erros.push({
        codigo: 'ATLETA_EM_OUTRO_TIME',
        mensagem: `${nomeCurto(atleta)} já está inscrito em outro time desta categoria.`,
        atletaId: item.atletaId,
      })
    }

    const foraDaFaixa = mensagemFaixaDeNascimento(atleta, regra)
    if (foraDaFaixa) erros.push({ codigo: 'FORA_DA_IDADE', mensagem: `${nomeCurto(atleta)}: ${foraDaFaixa}`, atletaId: item.atletaId })
    const elegibilidade = mensagemElegibilidade(
      contexto.elegibilidade,
      { sexo: sexoParaElegibilidade(atleta.sexo), dataNascimento: atleta.dataNascimento },
      contexto.hoje,
    )
    if (elegibilidade) {
      const codigo = /sexo/i.test(elegibilidade) ? 'NAIPE_INCOMPATIVEL' : 'FORA_DA_IDADE'
      erros.push({ codigo, mensagem: `${nomeCurto(atleta)}: ${elegibilidade}`, atletaId: item.atletaId })
    }

    if (!atleta.dataNascimento && (regra.nascimentoDe || regra.nascimentoAte || temFaixaDeIdade(contexto.elegibilidade))) {
      pendencias.push(`${nomeCurto(atleta)}: falta a data de nascimento para conferir a idade.`)
    }
    if (!atleta.temDocumento && regra.documentosExigidos.length > 0) {
      pendencias.push(`${nomeCurto(atleta)}: falta o documento.`)
    }
  }

  if (capitaes > 1) erros.push({ codigo: 'MAIS_DE_UM_CAPITAO', mensagem: 'A equipe pode ter só 1 capitão.' })
  if (liberos > regra.liberosMax) {
    erros.push({
      codigo: 'LIBEROS_ACIMA',
      mensagem: regra.liberosMax === 0
        ? 'Esta categoria não permite líbero.'
        : `Esta categoria permite até ${plural(regra.liberosMax, 'líbero', 'líberos')}.`,
    })
  }

  const total = selecao.length
  if (regra.atletasMin != null && total < regra.atletasMin) {
    const faltam = regra.atletasMin - total
    erros.push({ codigo: 'ABAIXO_DO_MINIMO', mensagem: `Faltam ${plural(faltam, 'atleta', 'atletas')} para chegar ao mínimo de ${regra.atletasMin}.` })
  }
  if (regra.atletasMax != null && total > regra.atletasMax) {
    const excedem = total - regra.atletasMax
    erros.push({ codigo: 'ACIMA_DO_MAXIMO', mensagem: `Remova ${plural(excedem, 'atleta', 'atletas')}: o máximo é ${regra.atletasMax}.` })
  }
  if (regra.comissaoMax != null && contexto.totalComissao > regra.comissaoMax) {
    erros.push({ codigo: 'COMISSAO_ACIMA', mensagem: `A comissão técnica pode ter até ${regra.comissaoMax} ${regra.comissaoMax === 1 ? 'pessoa' : 'pessoas'}.` })
  }

  if (total > 0 && liberos === 0 && regra.liberosMax > 0) avisos.push('Nenhum líbero marcado.')
  if (total > 0 && capitaes === 0) avisos.push('Nenhum capitão marcado.')

  return {
    erros,
    avisos,
    pendencias,
    status: pendencias.length > 0 ? 'CONFIRMADA_COM_PENDENCIAS' : 'CONFIRMADA',
  }
}

function temFaixaDeIdade(elegibilidade: ElegibilidadeCategoria | null) {
  return elegibilidade != null && (elegibilidade.idadeMinima != null || elegibilidade.idadeMaxima != null)
}

function sexoParaElegibilidade(sexo: string | null) {
  if (sexo === 'F') return 'FEMININO'
  if (sexo === 'M') return 'MASCULINO'
  return null
}

function mensagemFaixaDeNascimento(atleta: AtletaDoBanco, regra: RegraElencoDados) {
  const nascimento = dataIso(atleta.dataNascimento)
  if (!nascimento) return null
  const de = dataIso(regra.nascimentoDe)
  const ate = dataIso(regra.nascimentoAte)
  if (de && nascimento < de) return `nasceu antes de ${formatarData(de)}, o limite da categoria.`
  if (ate && nascimento > ate) return `nasceu depois de ${formatarData(ate)}, o limite da categoria.`
  return null
}

function formatarData(iso: string) {
  const [ano, mes, dia] = iso.split('-')
  return `${dia}/${mes}/${ano}`
}

/** Naipe da equipe contra o gênero da categoria. Categoria sem gênero ou mista aceita todos. */
export function mensagemNaipe(naipeEquipe: Naipe, generoCategoria: string | null | undefined) {
  const genero = String(generoCategoria ?? '').toUpperCase()
  if (!genero || genero === 'MISTO') return null
  if (genero === naipeEquipe) return null
  const nome = genero === 'FEMININO' ? 'feminino' : 'masculino'
  return `Esta categoria é ${nome}. O naipe da sua equipe não confere.`
}

/** Data de nascimento válida (AAAA-MM-DD), real, de 1920 até hoje. */
export function dataNascimentoValida(valor: string, hoje = new Date()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false
  const data = new Date(`${valor}T00:00:00Z`)
  if (Number.isNaN(data.getTime()) || data.toISOString().slice(0, 10) !== valor) return false
  return valor >= '1920-01-01' && valor <= hoje.toISOString().slice(0, 10)
}

export function chaveAtleta(nome: string, dataNascimento: string | null) {
  const limpo = nome.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim().toLowerCase()
  return `${limpo}|${dataIso(dataNascimento) ?? ''}`
}
