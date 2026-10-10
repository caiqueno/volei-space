// Shape retornado por GET /api/ligas (colunas públicas da tabela Liga) e helpers de
// rótulo compartilhados entre /painel e /painel/campeonatos.

export type LigaPanel = {
  id: number
  nome: string
  slug: string
  status?: string
  quantidadeEquipes?: number | null
  formato?: string | null
  inscricoesAbertas?: boolean | null
  categoriasConfig?: string | null
  subtitulo?: string | null
  descricao?: string | null
  regulamento?: string | null
  premiacao?: string | null
  dataInicio?: string | null
  dataFim?: string | null
  prazoAlteracaoElencoDias?: number | null
  setsPorPartida?: number | null
  pontosPorSet?: number | null
  tieBreakUltimoSet?: boolean | null
  pontosUltimoSet?: number | null
  quantidadeGrupos?: number | null
  nomesGrupos?: string | null
  criteriosClassificacao?: string | null
  faseEliminatoria?: string | null
  classificadosPorGrupo?: number | null
  rebaixados?: number | null
  podioDestaques?: string | null
  criadoEm?: string
}

export { formatLigaFormato, formatLigaStatus as formatLigaStatusLabel } from '@/lib/format-liga'
