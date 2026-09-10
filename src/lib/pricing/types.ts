export interface MatchEstimateInput {
  formato?: string | null
  quantidadeEquipes?: number | null
  quantidadeGrupos?: number | null
  turnoReturno?: boolean | null
  faseEliminatoria?: string | null
  disputaTerceiroLugar?: boolean | null
}

export interface MatchEstimate {
  /**
   * `false` quando ainda não há dados suficientes para estimar (ex.: formato
   * ou quantidade de equipes não definidos). Nunca devolvemos 0 nesse caso —
   * 0 faria a UI cotar "só a ativação" para um campeonato inteiro.
   */
  disponivel: boolean
  total: number
  faseDeGrupos: number
  eliminatorias: number
}

export interface ChampionshipPricingInput {
  matchCount: number
  sumulaScoutsEnabled?: boolean | null
  qrCodeEnabled?: boolean | null
}

export interface PricingLineItem {
  key: 'ativacao' | 'gestao' | 'sumulaScouts' | 'qrCode'
  label: string
  /** Preço unitário por partida, em centavos (ausente na ativação). */
  unitCents?: number
  totalCents: number
}

export interface ChampionshipPricing {
  matchCount: number
  /** Valor por partida somando os recursos contratados, em centavos. */
  matchUnitCents: number
  items: PricingLineItem[]
  subtotalCents: number
  discountPercent: number
  discountCents: number
  activationCents: number
  totalCents: number
}
