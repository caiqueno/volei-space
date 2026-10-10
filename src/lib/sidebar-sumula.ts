export const CHAVE_SIDEBAR_SUMULA = 'volei.space.sumula.sidebar'

export type PreferenciaSidebar = 'fixa' | 'recolhida'

type Leitura = { getItem(chave: string): string | null }
type Gravacao = { setItem(chave: string, valor: string): void }

/** Sem valor gravado, a barra esquerda permanece aberta. */
export function lerSidebarSumula(storage: Leitura | null | undefined): PreferenciaSidebar {
  if (!storage) return 'fixa'
  return storage.getItem(CHAVE_SIDEBAR_SUMULA) === 'recolhida' ? 'recolhida' : 'fixa'
}

export function gravarSidebarSumula(storage: Gravacao, preferencia: PreferenciaSidebar) {
  storage.setItem(CHAVE_SIDEBAR_SUMULA, preferencia)
}
