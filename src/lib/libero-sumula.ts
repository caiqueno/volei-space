/**
 * Líbero. A confirmação da papeleta não exige líbero inicial: vazio,
 * `--` ou `nenhum` significam que o time não tem líbero neste set.
 * A troca não conta como substituição. Quantidade 1 ou 2 limita a lista.
 * Qualquer outro valor não limita.
 */
export function numeroDeLibero(valor: unknown) {
  const texto = String(valor ?? '').trim().replace(/^#/, '')
  const normalizado = texto.toLowerCase()
  if (!normalizado || normalizado === '--' || normalizado === '—' || normalizado === '-' || normalizado === 'nenhum') return ''
  return texto
}

export function textoLiberoInicial(valor: unknown) {
  const numero = numeroDeLibero(valor)
  return numero ? `#${numero}` : 'nenhum'
}

/** A gravação da súmula não recusa o andamento quando o líbero inicial fica em branco. */
export function validarLiberoDaSumula(): string | null {
  return null
}

/** Lê a frase da papeleta confirmada. Sem marca, devolve null. */
export function lerLiberosIniciais(descricao: string) {
  const match = String(descricao ?? '').match(/Líberos iniciais:\s*(.+?)\s+(#[^\s.,|]+|nenhum)\s+e\s+(.+?)\s+(#[^\s.,|]+|nenhum)/i)
  if (!match) return null
  return {
    equipeA: match[1].trim(),
    liberoA: numeroDeLibero(match[2]),
    equipeB: match[3].trim(),
    liberoB: numeroDeLibero(match[4]),
  }
}
/** A escalação guarda o número do cadastro. A lista mostra a camisa da súmula. */
export function entraNoSeletorDeLibero(numeroCadastro: string, escalacao: readonly string[]) {
  return !escalacao.includes(String(numeroCadastro))
}

export function rotuloSeletorLibero(nome: string, camisaDaSumula: string) {
  if (!String(camisaDaSumula ?? '').trim()) return `sem número - ${nome}`
  return `#${camisaDaSumula} - ${nome}`
}

export function quantidadeDeLiberos(valor: unknown): 1 | 2 | null {
  const numero = Number(valor)
  if (numero !== 1 && numero !== 2) return null
  return numero
}

export function colunaDeLiberoAusente(erro: { message?: string; code?: string; details?: string } | null | undefined) {
  const texto = `${erro?.code ?? ''} ${erro?.message ?? ''} ${erro?.details ?? ''}`
  return /exigirLiberoInicial|quantidadeLiberos/i.test(texto)
}

export function semLibero<T extends Record<string, unknown>>(patch: T): T {
  const saida = { ...patch }
  delete saida.exigirLiberoInicial
  delete saida.quantidadeLiberos
  return saida
}

export function soLibero(patch: Record<string, unknown>) {
  const saida: Record<string, unknown> = {}
  if (Object.prototype.hasOwnProperty.call(patch, 'exigirLiberoInicial')) saida.exigirLiberoInicial = patch.exigirLiberoInicial === true
  if (Object.prototype.hasOwnProperty.call(patch, 'quantidadeLiberos')) saida.quantidadeLiberos = quantidadeDeLiberos(patch.quantidadeLiberos)
  return saida
}
