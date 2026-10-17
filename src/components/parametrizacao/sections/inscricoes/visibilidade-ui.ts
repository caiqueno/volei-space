// Lógica pura do seletor "Competição pública / privada" (sem React, testável).
// A regra de verdade é do servidor; aqui só texto e estado de tela.

export type VisibilidadeUi = 'PUBLICA' | 'PRIVADA'

export type LinkCategoriaUi = {
  id: string | number
  nome: string
  caminho: string | null
}

export const OPCOES_VISIBILIDADE: Array<{ value: VisibilidadeUi; titulo: string; descricao: string }> = [
  { value: 'PUBLICA', titulo: 'Competição pública', descricao: 'Aparece na lista de campeonatos do site e qualquer pessoa pode encontrá-la.' },
  { value: 'PRIVADA', titulo: 'Competição privada', descricao: 'Só entra quem tem o link. Ela não aparece nas listas públicas do site.' },
]

/** Campo ausente (backend ainda sem a coluna) ou desconhecido vale como pública. */
export function normalizarVisibilidade(valor: unknown): VisibilidadeUi {
  return String(valor ?? '').trim().toUpperCase() === 'PRIVADA' ? 'PRIVADA' : 'PUBLICA'
}

export function rotuloVisibilidade(valor: unknown): string {
  return normalizarVisibilidade(valor) === 'PRIVADA' ? 'Privada (só entra quem tem o link)' : 'Pública'
}

/** Os links de inscrição só são mostrados quando a competição é privada. */
export function deveMostrarLinks(valor: unknown): boolean {
  return normalizarVisibilidade(valor) === 'PRIVADA'
}

export function categoriasSemLink(links: readonly LinkCategoriaUi[]): LinkCategoriaUi[] {
  return links.filter((item) => !item.caminho)
}

/** Aviso quando a competição é privada e ainda não há nenhum link emitido; null se estiver tudo certo. */
export function avisoLinks(links: readonly LinkCategoriaUi[]): string | null {
  if (links.length === 0) return 'Esta competição ainda não tem categorias. Crie uma categoria para gerar o link de inscrição.'
  const semLink = categoriasSemLink(links).length
  if (semLink === links.length) return 'Nenhum link de inscrição foi emitido ainda. Sem link, ninguém consegue se inscrever numa competição privada.'
  if (semLink > 0) return `${semLink} categoria(s) ainda sem link de inscrição.`
  return null
}

export function urlCompleta(origem: string, caminho: string): string {
  return `${origem.replace(/\/+$/, '')}${caminho.startsWith('/') ? caminho : `/${caminho}`}`
}

export function linkWhatsapp(nomeCategoria: string, url: string): string {
  const texto = `Inscrição na categoria ${nomeCategoria}: ${url}`
  return `https://wa.me/?text=${encodeURIComponent(texto)}`
}
