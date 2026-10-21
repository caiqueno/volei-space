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
  /** Menor de 18 anos sem autorização ativa do responsável legal (calculado no servidor). */
  consentimentoPendente?: boolean
  /** R17 (ELENCO_COMPLETO_ATIVO): foto de rosto enviada. Ausente = a flag está desligada e vale a regra antiga. */
  temFoto?: boolean
  /** R17: CPF informado (só o hash/cifra existe; nunca o valor). */
  temCpf?: boolean
}

/** Itens que a regra de elenco pode exigir de cada atleta. */
export const DOCUMENTOS_EXIGIVEIS = ['FOTO', 'DOCUMENTO', 'CPF'] as const
export type DocumentoExigivel = (typeof DOCUMENTOS_EXIGIVEIS)[number]

/** Valor antigo de "documentosExigidos" que não seja FOTO nem CPF (ex.: 'RG') vira DOCUMENTO. */
export function documentosExigidosNormalizados(lista: readonly string[]): DocumentoExigivel[] {
  const achados = new Set<DocumentoExigivel>()
  for (const item of lista) {
    const valor = String(item).trim().toUpperCase()
    achados.add(valor === 'FOTO' || valor === 'CPF' ? valor : 'DOCUMENTO')
  }
  return DOCUMENTOS_EXIGIVEIS.filter((item) => achados.has(item))
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
  /** R17: quando a regra tem a coluna e ela é false, a falta de autorização do responsável não vira pendência. */
  exigeConsentimentoMenor?: boolean
  /** R17: depois deste instante a lista só muda por pedido de troca aprovado pelo organizador. */
  prazoTrocaEm?: string | null
  modelo?: string | null
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
  /**
   * R17: rascunho não é impedido pelas regras de quantidade e de idade do elenco (mínimo, máximo, líbero, comissão,
   * faixa de nascimento): viram pendências e o status sai RASCUNHO. Erros de integridade (atleta fora do time, camisa
   * repetida, atleta em outro time) continuam bloqueando.
   */
  rascunho?: boolean
}

const ERROS_QUE_RASCUNHO_ACEITA = new Set(['ABAIXO_DO_MINIMO', 'ACIMA_DO_MAXIMO', 'COMISSAO_ACIMA', 'LIBEROS_ACIMA', 'FORA_DA_IDADE'])

export type ErroRegra = { codigo: string; mensagem: string; atletaId?: string }

export type ResultadoValidacao = {
  erros: ErroRegra[]
  avisos: string[]
  /** Itens que faltam mas não impedem a inscrição (vira CONFIRMADA_COM_PENDENCIAS). */
  pendencias: string[]
  /** Pendências com código (ex.: ATLETA_MENOR_SEM_CONSENTIMENTO), na mesma ordem das que são específicas por atleta. */
  pendenciasDetalhe: ErroRegra[]
  status: StatusInscricao
}

const MENSAGEM_FALTA: Record<DocumentoExigivel, string> = {
  FOTO: 'falta a foto de rosto.',
  DOCUMENTO: 'falta o documento.',
  CPF: 'falta o CPF.',
}

function nomeCurto(atleta: AtletaDoBanco | undefined) {
  return atleta?.nome ?? 'Atleta'
}

function plural(n: number, singular: string, pluralTexto: string) {
  return `${n} ${n === 1 ? singular : pluralTexto}`
}

/** Mensagem do cartão de prontidão: "Seu time tem 9 atletas. 2 estão sem documento." */
export function resumoProntidao(
  atletas: Array<{ temDocumento: boolean; consentimentoPendente?: boolean; temFoto?: boolean; temCpf?: boolean }>,
  /** R17: o que as regras de elenco das inscrições da equipe exigem. Só vale com os campos de foto/CPF presentes. */
  opcoes: { exigidos?: readonly string[] } = {},
) {
  const total = atletas.length
  const semDocumento = atletas.filter((atleta) => !atleta.temDocumento).length
  const semAutorizacaoResponsavel = atletas.filter((atleta) => atleta.consentimentoPendente).length
  const modoElenco = atletas.some((atleta) => atleta.temFoto !== undefined || atleta.temCpf !== undefined)
  const semFoto = atletas.filter((atleta) => atleta.temFoto === false).length
  const semCpf = atletas.filter((atleta) => atleta.temCpf === false).length
  const exigidos = modoElenco ? documentosExigidosNormalizados(opcoes.exigidos ?? ['DOCUMENTO']) : []
  const contaDocumento = modoElenco ? exigidos.includes('DOCUMENTO') : true
  const contaFoto = modoElenco && exigidos.includes('FOTO')
  const contaCpf = modoElenco && exigidos.includes('CPF')
  const faltaDocumento = contaDocumento ? semDocumento : 0
  let mensagem: string
  if (total === 0) mensagem = 'Seu time ainda não tem atletas. Adicione os primeiros para se inscrever.'
  else if (faltaDocumento === 0 && semAutorizacaoResponsavel === 0 && !(contaFoto && semFoto > 0) && !(contaCpf && semCpf > 0)) {
    mensagem = `Seu time tem ${plural(total, 'atleta', 'atletas')}. Tudo certo.`
  } else {
    const partes: string[] = []
    if (faltaDocumento > 0) partes.push(faltaDocumento === 1 ? '1 está sem documento' : `${faltaDocumento} estão sem documento`)
    if (contaFoto && semFoto > 0) partes.push(semFoto === 1 ? '1 está sem foto' : `${semFoto} estão sem foto`)
    if (contaCpf && semCpf > 0) partes.push(semCpf === 1 ? '1 está sem CPF' : `${semCpf} estão sem CPF`)
    if (semAutorizacaoResponsavel > 0) {
      partes.push(semAutorizacaoResponsavel === 1 ? '1 está sem autorização do responsável' : `${semAutorizacaoResponsavel} estão sem autorização do responsável`)
    }
    mensagem = `Seu time tem ${plural(total, 'atleta', 'atletas')}. ${partes.join('. ')}.`
  }
  return {
    atletas: total,
    semDocumento,
    semAutorizacaoResponsavel,
    mensagem,
    ...(modoElenco ? { semFoto, semCpf, exigidos } : {}),
  }
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
  const pendenciasDetalhe: ErroRegra[] = []
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
    if (regra.documentosExigidos.length > 0) {
      if (atleta.temCpf === undefined && atleta.temFoto === undefined) {
        // Regra antiga (flag de elenco desligada): um único "documento".
        if (!atleta.temDocumento) pendencias.push(`${nomeCurto(atleta)}: falta o documento.`)
      } else {
        for (const exigido of documentosExigidosNormalizados(regra.documentosExigidos)) {
          const tem = exigido === 'FOTO' ? atleta.temFoto : exigido === 'CPF' ? atleta.temCpf : atleta.temDocumento
          if (!tem) pendencias.push(`${nomeCurto(atleta)}: ${MENSAGEM_FALTA[exigido]}`)
        }
      }
    }
    // LGPD: não bloqueia a inscrição, mas deixa a pendência registrada (CONFIRMADA_COM_PENDENCIAS).
    if (atleta.consentimentoPendente && regra.exigeConsentimentoMenor !== false) {
      const mensagem = `${nomeCurto(atleta)} é menor de 18 anos e está sem autorização do responsável legal.`
      pendencias.push(`ATLETA_MENOR_SEM_CONSENTIMENTO: ${mensagem}`)
      pendenciasDetalhe.push({ codigo: 'ATLETA_MENOR_SEM_CONSENTIMENTO', mensagem, atletaId: item.atletaId })
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

  if (contexto.rascunho) {
    // Rascunho: regras de quantidade e idade viram pendências (com o motivo), o resto continua bloqueando.
    const bloqueantes: ErroRegra[] = []
    for (const erro of erros) {
      if (ERROS_QUE_RASCUNHO_ACEITA.has(erro.codigo)) {
        pendencias.push(`${erro.codigo}: ${erro.mensagem}`)
        pendenciasDetalhe.push(erro)
      } else bloqueantes.push(erro)
    }
    erros.splice(0, erros.length, ...bloqueantes)
  }

  return {
    erros,
    avisos,
    pendencias,
    pendenciasDetalhe,
    status: contexto.rascunho ? 'RASCUNHO' : pendencias.length > 0 ? 'CONFIRMADA_COM_PENDENCIAS' : 'CONFIRMADA',
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
