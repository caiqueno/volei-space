export function manterPaginaAberta<T extends { id: number }>(atual: T[], novas: T[], temMais: boolean): T[] {
  if (atual.length === 0) return novas
  const idsNovos = new Set(novas.map((item) => item.id))
  const intersecao = atual.filter((item) => idsNovos.has(item.id)).length
  if (intersecao === 0) return novas
  const porId = new Map(novas.map((item) => [item.id, item]))
  const mantidos = atual.map((item) => porId.get(item.id) ?? item)
  const ids = new Set(mantidos.map((item) => item.id))
  const extras = novas.filter((item) => !ids.has(item.id))
  if (!temMais && extras.length === 0 && novas.length < atual.length && intersecao === novas.length) return novas
  return [...mantidos, ...extras]
}
