export type AtletaFoto = {
  id?: number | null
  nome?: string | null
  fotoRostoUrl?: string | null
  fotoUrl?: string | null
}

export type LadoMvp = {
  id?: number | null
  nome?: string | null
  jogadores?: AtletaFoto[] | null
}

export type PresencaMvp = {
  jogadorId?: number | null
  equipeId?: number | null
}

export function ehMvp(tipo: string | null | undefined) {
  return String(tipo ?? '').trim().toUpperCase() === 'MVP'
}

/** Foto do destaque, ou a do elenco já carregado na mesma partida. */
export function fotoDoAtleta(jogador: AtletaFoto | null | undefined, lados: LadoMvp[]) {
  const direta = texto(jogador?.fotoRostoUrl) || texto(jogador?.fotoUrl)
  if (direta) return direta
  const id = jogador?.id
  if (!id) return null
  for (const lado of lados) {
    const noElenco = lado.jogadores?.find((item) => item.id === id)
    const foto = texto(noElenco?.fotoRostoUrl) || texto(noElenco?.fotoUrl)
    if (foto) return foto
  }
  return null
}

/** Nome da equipe do atleta, pelo elenco ou pela presença desta partida. */
export function equipeDoAtleta(
  jogadorId: number | null | undefined,
  lados: LadoMvp[],
  presencas?: PresencaMvp[] | null,
) {
  if (!jogadorId) return null
  const peloElenco = lados.find((lado) => lado.jogadores?.some((jogador) => jogador.id === jogadorId))
  const nomeElenco = texto(peloElenco?.nome)
  if (nomeElenco) return nomeElenco
  const equipeId = presencas?.find((item) => item.jogadorId === jogadorId)?.equipeId
  if (!equipeId) return null
  return texto(lados.find((lado) => lado.id === equipeId)?.nome)
}

function texto(valor: string | null | undefined) {
  const limpo = valor?.trim()
  return limpo ? limpo : null
}
