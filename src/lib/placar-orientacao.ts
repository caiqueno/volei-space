const FRASE_TROCA = 'inverteram os lados da quadra'

export function placarNaOrientacao(placar: string, invertido: boolean) {
  if (!invertido) return placar
  const match = placar.trim().match(/^(\d+)\s*x\s*(\d+)$/i)
  if (!match) return placar
  return `${match[2]} x ${match[1]}`
}

export function ladosInvertidosNoPonto(
  eventosDoMaisNovoAoMaisAntigo: Array<{ text?: string | null }>,
  indice: number,
  invertidoAgora: boolean,
) {
  let trocasDepois = 0
  for (let i = 0; i < indice; i += 1) {
    const texto = String(eventosDoMaisNovoAoMaisAntigo[i]?.text ?? '').toLowerCase()
    if (texto.includes(FRASE_TROCA)) trocasDepois += 1
  }
  return trocasDepois % 2 === 1 ? !invertidoAgora : invertidoAgora
}
