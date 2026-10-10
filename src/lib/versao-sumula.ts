const MARCA_VERSAO = /\[\[V:(\d+)\]\]/

export function lerVersaoRegistro(descricao: string | null | undefined) {
  const marca = new RegExp(MARCA_VERSAO.source, 'g')
  let maior: number | null = null
  let match: RegExpExecArray | null
  const texto = String(descricao ?? '')
  while ((match = marca.exec(texto)) !== null) {
    const valor = Number(match[1])
    if (!Number.isInteger(valor)) continue
    if (maior == null || valor > maior) maior = valor
  }
  return maior
}

export function maiorVersaoRegistro(descricoes: Array<string | null | undefined>) {
  let maior = 0
  for (const descricao of descricoes) {
    const versao = lerVersaoRegistro(descricao)
    if (versao != null && versao > maior) maior = versao
  }
  return maior
}

export function marcarVersaoRegistro(registro: string, versao: number) {
  return `${registro} [[V:${versao}]]`
}

export function versaoEhAntiga(recebida: number, gravada: number | null) {
  if (gravada == null) return false
  return recebida < gravada
}

/** Reserva antiga ou versão menor que a já gravada perde para o salvamento que chegou depois. */
export function deveRecusarAndamento(entrada: {
  versaoCliente?: number | null
  versaoGravada: number | null
  reservaId: number | null
  reservaMaisNova: number | null
}) {
  if (typeof entrada.versaoCliente === 'number' && versaoEhAntiga(entrada.versaoCliente, entrada.versaoGravada)) return true
  if (entrada.reservaId != null && entrada.reservaMaisNova != null && entrada.reservaId < entrada.reservaMaisNova) return true
  return false
}
