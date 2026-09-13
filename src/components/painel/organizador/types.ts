export interface LigaCarouselItem {
  id: number
  slug: string
  nome: string
  logoUrl: string | null
  capaUrl: string | null
  dataInicio: string | null
  dataFim: string | null
  status: string
  localPrincipal: { nome: string; endereco: string | null; quadra: string | null } | null
  categoriasReais: { categoria: string; serie: string | null }[]
}
