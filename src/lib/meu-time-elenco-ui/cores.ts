// Cores do uniforme: validação, nome em português e contraste para a prévia em texto.

export const PALETA_UNIFORME = [
  { hex: '#1D4ED8', nome: 'azul' },
  { hex: '#0B1F4D', nome: 'azul-marinho' },
  { hex: '#0EA5E9', nome: 'azul-claro' },
  { hex: '#DC2626', nome: 'vermelho' },
  { hex: '#7F1D1D', nome: 'vinho' },
  { hex: '#16A34A', nome: 'verde' },
  { hex: '#14532D', nome: 'verde-escuro' },
  { hex: '#FACC15', nome: 'amarelo' },
  { hex: '#F59E0B', nome: 'dourado' },
  { hex: '#EA580C', nome: 'laranja' },
  { hex: '#7C3AED', nome: 'roxo' },
  { hex: '#DB2777', nome: 'rosa' },
  { hex: '#FFFFFF', nome: 'branco' },
  { hex: '#9CA3AF', nome: 'cinza' },
  { hex: '#111827', nome: 'preto' },
] as const

export function corValida(valor: string | null | undefined): boolean {
  return typeof valor === 'string' && /^#[0-9a-fA-F]{6}$/.test(valor.trim())
}

export function normalizarCor(valor: string): string {
  return valor.trim().toUpperCase()
}

function rgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

/** Nome da cor mais próxima da paleta, para a descrição em texto. */
export function nomeDaCor(hex: string): string {
  if (!corValida(hex)) return 'sem cor'
  const [r, g, b] = rgb(normalizarCor(hex))
  let melhor: (typeof PALETA_UNIFORME)[number] = PALETA_UNIFORME[0]
  let menor = Infinity
  for (const item of PALETA_UNIFORME) {
    const [pr, pg, pb] = rgb(item.hex)
    const d = (r - pr) ** 2 + (g - pg) ** 2 + (b - pb) ** 2
    if (d < menor) { menor = d; melhor = item }
  }
  return melhor.nome
}

function luminancia(hex: string): number {
  const canais = rgb(hex).map((c) => {
    const v = c / 255
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * canais[0] + 0.7152 * canais[1] + 0.0722 * canais[2]
}

export function razaoContraste(a: string, b: string): number {
  const la = luminancia(normalizarCor(a))
  const lb = luminancia(normalizarCor(b))
  const [claro, escuro] = la >= lb ? [la, lb] : [lb, la]
  return (claro + 0.05) / (escuro + 0.05)
}

/** Cor de texto legível sobre o fundo (preto ou branco). */
export function corDoTextoSobre(fundo: string): '#000000' | '#FFFFFF' {
  return razaoContraste(fundo, '#FFFFFF') >= razaoContraste(fundo, '#000000') ? '#FFFFFF' : '#000000'
}

export function descricaoUniforme(primaria: string | null | undefined, secundaria: string | null | undefined): string {
  const p = corValida(primaria) ? nomeDaCor(primaria as string) : null
  const s = corValida(secundaria) ? nomeDaCor(secundaria as string) : null
  if (!p && !s) return 'Uniforme sem cores definidas.'
  if (p && !s) return `Uniforme: camisa ${p}.`
  if (!p && s) return `Uniforme: detalhes ${s}.`
  if (p === s) return `Uniforme: camisa e detalhes ${p}.`
  return `Uniforme: camisa ${p}, detalhes ${s}.`
}

export type EntradaDadosTime = { cnpj: string; contatoEmail: string; contatoTelefone: string; corPrimaria: string; corSecundaria: string }
export type CampoDadosTime = keyof EntradaDadosTime
