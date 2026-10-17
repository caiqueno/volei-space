export type ItemNav = { href: string; rotulo: string; fase2: boolean; marcavel: boolean }

export const ITENS_NAV: ItemNav[] = [
  { href: '/meu-time', rotulo: 'Minhas equipes', fase2: false, marcavel: true },
  { href: '/meu-time?ver=atletas', rotulo: 'Atletas', fase2: false, marcavel: false },
  { href: '/meu-time/convites', rotulo: 'Convites', fase2: true, marcavel: true },
  { href: '/meu-time/importar', rotulo: 'Importar', fase2: true, marcavel: true },
  { href: '/meu-time/clube', rotulo: 'Clube', fase2: true, marcavel: true },
  { href: '/meu-time/notificacoes', rotulo: 'Notificações', fase2: true, marcavel: true },
]

/** Com a flag desligada, só aparecem os itens que já existiam. */
export function itensVisiveis(ativa: boolean): ItemNav[] {
  return ITENS_NAV.filter((i) => ativa || !i.fase2)
}

const FASE2 = ['/meu-time/convites', '/meu-time/importar', '/meu-time/clube', '/meu-time/notificacoes']

export function itemAtual(caminho: string, item: ItemNav): boolean {
  if (!item.marcavel) return false
  if (item.href === '/meu-time') return !FASE2.some((f) => caminho === f || caminho.startsWith(`${f}/`))
  return caminho === item.href || caminho.startsWith(`${item.href}/`)
}
