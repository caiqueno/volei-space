// Idade civil calculada SEMPRE no servidor, a partir da data de nascimento (AAAA-MM-DD).
import { IDADE_MAIORIDADE } from '@/lib/lgpd/termo'

function dia(valor: string | Date | null | undefined) {
  if (!valor) return null
  const texto = valor instanceof Date ? valor.toISOString() : String(valor)
  return /^\d{4}-\d{2}-\d{2}/.test(texto) ? texto.slice(0, 10) : null
}

/**
 * Menor de 18 anos na data `hoje` (UTC). Sem data de nascimento (atleta de lote) devolve false:
 * a idade é desconhecida e a pendência "falta nascimento" já cobre o caso. Quem nasceu em 29/02 completa
 * 18 anos em 01/03 nos anos não bissextos (convenção adotada; confirmar com o jurídico se necessário).
 */
export function ehMenorDeIdade(dataNascimento: string | Date | null | undefined, hoje: Date = new Date()) {
  const nascimento = dia(dataNascimento)
  if (!nascimento) return false
  const [ano, mes, dd] = nascimento.split('-').map(Number)
  const alvo = ano + IDADE_MAIORIDADE
  const bissexto = (alvo % 4 === 0 && alvo % 100 !== 0) || alvo % 400 === 0
  const maioridade = mes === 2 && dd === 29 && !bissexto
    ? `${alvo}-03-01`
    : `${alvo}-${String(mes).padStart(2, '0')}-${String(dd).padStart(2, '0')}`
  return hoje.toISOString().slice(0, 10) < maioridade
}
