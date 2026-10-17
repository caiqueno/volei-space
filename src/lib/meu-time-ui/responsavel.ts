// Regras de tela para atleta menor de idade (LGPD). O servidor valida tudo de novo e é a fonte da verdade.
import type { Atleta, ResponsavelLegal } from './tipos'

export const IDADE_MAIORIDADE = 18

/** Idade completa em anos numa data AAAA-MM-DD; null se a data for inválida ou futura. */
export function calcularIdade(dataNascimento: string | null | undefined, hoje: Date = new Date()): number | null {
  const m = typeof dataNascimento === 'string' ? dataNascimento.match(/^(\d{4})-(\d{2})-(\d{2})/) : null
  if (!m) return null
  const [ano, mes, dia] = [Number(m[1]), Number(m[2]), Number(m[3])]
  if (ano < 1900 || mes < 1 || mes > 12 || dia < 1 || dia > 31) return null
  let idade = hoje.getFullYear() - ano
  const antesDoAniversario = hoje.getMonth() + 1 < mes || (hoje.getMonth() + 1 === mes && hoje.getDate() < dia)
  if (antesDoAniversario) idade -= 1
  return idade < 0 ? null : idade
}

/** Menor de 18 anos pela data de nascimento. Sem data válida, não dá para afirmar: false. */
export function ehMenor(dataNascimento: string | null | undefined, hoje: Date = new Date()): boolean {
  const idade = calcularIdade(dataNascimento, hoje)
  return idade !== null && idade < IDADE_MAIORIDADE
}

export type CampoResponsavel = 'nome' | 'contato' | 'aceite'

export type EntradaResponsavel = { nome: string; contato: string; aceite: boolean }

export type ResultadoResponsavel =
  | { valido: true; dados: { responsavel: ResponsavelLegal; aceiteResponsavel: true }; erros: Partial<Record<CampoResponsavel, string>> }
  | { valido: false; erros: Partial<Record<CampoResponsavel, string>> }

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Telefone brasileiro: DDD + 8 ou 9 dígitos, com ou sem 55. */
export function telefoneValido(texto: string): boolean {
  const digitos = texto.replace(/\D/g, '')
  const semPais = digitos.length >= 12 && digitos.startsWith('55') ? digitos.slice(2) : digitos
  return /^[1-9]{2}9?\d{8}$/.test(semPais)
}

export function contatoValido(texto: string): boolean {
  const t = texto.trim()
  return EMAIL.test(t) || (!t.includes('@') && telefoneValido(t))
}

export function validarResponsavel(entrada: EntradaResponsavel): ResultadoResponsavel {
  const erros: Partial<Record<CampoResponsavel, string>> = {}
  const nome = entrada.nome.replace(/\s+/g, ' ').trim()
  if (nome.length < 3 || !nome.includes(' ')) erros.nome = 'Escreva o nome e o sobrenome do responsável.'
  const contato = entrada.contato.trim()
  if (!contato) erros.contato = 'Informe um telefone com DDD ou um e-mail do responsável.'
  else if (!contatoValido(contato)) erros.contato = 'Esse contato não parece certo. Use um telefone com DDD, como (11) 91234-5678, ou um e-mail, como nome@exemplo.com.'
  if (!entrada.aceite) erros.aceite = 'Marque a autorização do responsável para salvar.'
  if (Object.keys(erros).length > 0) return { valido: false, erros }
  const contatoFinal = contato.includes('@') ? contato.toLowerCase() : contato.replace(/\D/g, '')
  return { valido: true, dados: { responsavel: { nome, contato: contatoFinal }, aceiteResponsavel: true }, erros }
}

// ---------------------------------------------------------------- Listas e filtros

export function faltaAutorizacao(atleta: Pick<Atleta, 'consentimentoPendente'>): boolean {
  return atleta.consentimentoPendente === true
}

export function contarSemAutorizacao(atletas: Array<Pick<Atleta, 'consentimentoPendente'>>): number {
  return atletas.filter(faltaAutorizacao).length
}

/** Quantos sem autorização: usa o número da prontidão do servidor; se faltar, conta pela lista. */
export function totalSemAutorizacao(
  prontidao: { semAutorizacao?: number; semAutorizacaoResponsavel?: number } | undefined,
  atletas: Array<Pick<Atleta, 'consentimentoPendente'>>,
): number {
  const doServidor = prontidao?.semAutorizacaoResponsavel ?? prontidao?.semAutorizacao
  return typeof doServidor === 'number' && Number.isFinite(doServidor) ? Math.max(0, doServidor) : contarSemAutorizacao(atletas)
}

// ---------------------------------------------------------------- Textos

export const TEXTO_SEM_AUTORIZACAO = 'Sem autorização do responsável'

export function textoResumoAutorizacao(total: number): string {
  if (total === 0) return ''
  return total === 1 ? '1 atleta menor está sem autorização do responsável.' : `${total} atletas menores estão sem autorização do responsável.`
}

export const EXPLICACAO_AUTORIZACAO =
  'Para atleta menor de 18 anos, a lei pede a autorização de um responsável. Você pode inscrever mesmo assim, mas o ideal é completar antes do jogo.'

export const CODIGO_AVISO_MENOR_SEM_CONSENTIMENTO = 'ATLETA_MENOR_SEM_CONSENTIMENTO'

/** Traduz o código de aviso do servidor em frase simples; outros avisos passam como vieram. */
export function traduzirAvisoInscricao(aviso: string): string {
  if (aviso.includes(CODIGO_AVISO_MENOR_SEM_CONSENTIMENTO)) {
    return 'Há atleta menor de 18 anos sem autorização do responsável. A inscrição foi enviada, mas complete a autorização no cadastro do atleta.'
  }
  return aviso
}

/** Aviso não bloqueante do assistente: atletas escolhidos que ainda não têm autorização. */
export function atletasEscolhidosSemAutorizacao(escolhas: Array<{ atletaId: string }>, atletas: Atleta[]): Atleta[] {
  const ids = new Set(escolhas.map((e) => e.atletaId))
  return atletas.filter((a) => ids.has(a.id) && faltaAutorizacao(a))
}

export function avisoAutorizacaoInscricao(semAutorizacao: Atleta[]): string | null {
  if (semAutorizacao.length === 0) return null
  const nomes = semAutorizacao.map((a) => a.nome).join(', ')
  return semAutorizacao.length === 1
    ? `${nomes} é menor de 18 anos e está sem autorização do responsável.`
    : `${semAutorizacao.length} atletas menores estão sem autorização do responsável: ${nomes}.`
}

export const TEXTO_REMOVER_ATLETA =
  'Os dados pessoais dele serão apagados ou anonimizados. O histórico de jogos é mantido, sem identificar a pessoa. Isso não dá para desfazer.'

export function perguntaRemoverAtleta(nome: string): string {
  return `Remover ${nome} do time?`
}
