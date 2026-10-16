// Funções puras de apoio ao cadastro de elenco na inscrição rápida (sem acesso a banco).
// O servidor continua sendo a fonte da verdade para mínimo, máximo e duplicidade.

export type AtletaColado = { nome: string; numero: string }
export type LinhaIgnorada = { linha: number; texto: string; motivo: string }
export type ResultadoListaColada = { atletas: AtletaColado[]; ignoradas: LinhaIgnorada[] }

const NUMERO_MAXIMO_CAMISA = 99

function limparPrefixo(texto: string) {
  // "1. Nome", "1) Nome", "- Nome", "* Nome": marcadores de lista, não camisa.
  return texto.replace(/^\s*(?:\d{1,3}\s*[.)]\s+|[-*•–]\s+)/, '').trim()
}

function normalizarNome(nome: string) {
  return nome.replace(/\s+/g, ' ').replace(/^[\s,;|\-–:]+|[\s,;|\-–:]+$/g, '').trim()
}

/**
 * Interpreta uma lista colada do WhatsApp. Aceita, por linha:
 * "Maria Souza, 10", "10 - Maria Souza", "#10 Maria Souza", "Maria Souza 10", "Maria Souza;10", "Maria Souza".
 */
export function interpretarListaColada(texto: string): ResultadoListaColada {
  const atletas: AtletaColado[] = []
  const ignoradas: LinhaIgnorada[] = []
  const linhas = String(texto ?? '').split(/\r?\n/)
  linhas.forEach((original, indice) => {
    const bruto = original.trim()
    if (!bruto) return
    const linha = indice + 1
    const base = limparPrefixo(bruto)
    let numero = ''
    let nome = base
    const inicio = base.match(/^#?\s*(\d{1,3})\s*(?:[,;|\t\-–:]\s*|\s+)(.+)$/)
    const fim = base.match(/^(.+?)\s*(?:[,;|\t\-–:]\s*|\s+)#?\s*(\d{1,3})$/)
    if (inicio) { numero = inicio[1]; nome = inicio[2] }
    else if (fim) { nome = fim[1]; numero = fim[2] }
    nome = normalizarNome(nome)
    if (nome.length < 2 || !/[A-Za-zÀ-ɏ]/.test(nome)) {
      ignoradas.push({ linha, texto: bruto, motivo: 'Sem nome reconhecível' })
      return
    }
    if (numero !== '' && Number(numero) > NUMERO_MAXIMO_CAMISA) {
      ignoradas.push({ linha, texto: bruto, motivo: `Camisa acima de ${NUMERO_MAXIMO_CAMISA}` })
      return
    }
    atletas.push({ nome, numero: numero === '' ? '' : String(Number(numero)) })
  })
  return { atletas, ignoradas }
}

export function normalizarChaveNome(nome: string) {
  return nome.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim().toLowerCase()
}

/** Separa quem já está no elenco (mesmo nome) ou repete camisa, apontando o motivo. */
export function separarNovosAtletas(
  colados: AtletaColado[],
  existentes: Array<{ nome: string; numero?: string | number | null }>,
): { novos: AtletaColado[]; repetidos: Array<AtletaColado & { motivo: string }> } {
  const nomes = new Set(existentes.map((item) => normalizarChaveNome(item.nome)))
  const camisas = new Set(existentes.map((item) => (item.numero == null || item.numero === '' ? '' : String(Number(item.numero)))).filter(Boolean))
  const novos: AtletaColado[] = []
  const repetidos: Array<AtletaColado & { motivo: string }> = []
  for (const atleta of colados) {
    const chave = normalizarChaveNome(atleta.nome)
    if (nomes.has(chave)) { repetidos.push({ ...atleta, motivo: 'Já está no elenco' }); continue }
    if (atleta.numero && camisas.has(atleta.numero)) { repetidos.push({ ...atleta, motivo: `Camisa ${atleta.numero} já usada` }); continue }
    nomes.add(chave)
    if (atleta.numero) camisas.add(atleta.numero)
    novos.push(atleta)
  }
  return { novos, repetidos }
}

export type ResumoElenco = {
  total: number
  minimo: number | null
  maximo: number | null
  faltam: number
  excedem: number
  situacao: 'abaixo' | 'ok' | 'acima'
  texto: string
}

export function resumirElenco(total: number, minimo: number | null | undefined, maximo: number | null | undefined): ResumoElenco {
  const min = minimo != null && minimo > 0 ? minimo : null
  const max = maximo != null && maximo > 0 ? maximo : null
  const faltam = min != null ? Math.max(0, min - total) : 0
  const excedem = max != null ? Math.max(0, total - max) : 0
  const situacao = excedem > 0 ? 'acima' : faltam > 0 || total === 0 ? 'abaixo' : 'ok'
  const partes = [`${total} ${total === 1 ? 'atleta' : 'atletas'}`]
  if (min != null) partes.push(`mínimo ${min}`)
  if (max != null) partes.push(`máximo ${max}`)
  return { total, minimo: min, maximo: max, faltam, excedem, situacao, texto: partes.join(' · ') }
}

export type EntradaMotivoConcluir = {
  nomeEquipe: string
  precisaCategoria: boolean
  categoriaEscolhida: boolean
  liderObrigatorio: boolean
  lider: string
  total: number
  minimo: number | null | undefined
  maximo: number | null | undefined
}

/** Primeiro motivo que impede "Concluir inscrição", em linguagem simples; null quando pode concluir. */
export function motivoBloqueioConcluir(entrada: EntradaMotivoConcluir): string | null {
  if (!entrada.nomeEquipe.trim()) return 'Informe o nome da equipe para concluir.'
  if (entrada.precisaCategoria && !entrada.categoriaEscolhida) return 'Escolha o torneio para concluir.'
  if (entrada.liderObrigatorio && !entrada.lider.trim()) return 'Informe o líder da equipe para concluir.'
  if (entrada.total === 0) return 'Adicione pelo menos 1 atleta para concluir.'
  const resumo = resumirElenco(entrada.total, entrada.minimo, entrada.maximo)
  if (resumo.faltam > 0) return `Faltam ${resumo.faltam} ${resumo.faltam === 1 ? 'atleta' : 'atletas'} para chegar ao mínimo de ${resumo.minimo}.`
  if (resumo.excedem > 0) return `Remova ${resumo.excedem} ${resumo.excedem === 1 ? 'atleta' : 'atletas'}: o máximo é ${resumo.maximo}.`
  return null
}
