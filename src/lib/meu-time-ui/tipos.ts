// Tipos do contrato de "Meu Time" usados pela interface. O servidor é a fonte da verdade.

export type Naipe = 'FEMININO' | 'MASCULINO' | 'MISTO'

export type Prontidao = { atletas: number; semDocumento: number; mensagem: string }

export type EquipeResumo = {
  id: string
  nome: string
  cidade: string | null
  naipe: Naipe
  totalAtletas: number
  prontidao: Prontidao
}

export type Equipe = {
  id: string
  nome: string
  cidade: string | null
  naipe: Naipe
  escudoUrl?: string | null
}

export type Atleta = {
  id: string
  nome: string
  dataNascimento: string | null
  numeroPreferido: number | null
  posicao: string | null
  temDocumento: boolean
}

export type MembroComissao = { id: string; nome: string; funcao: string }

export type StatusInscricao = 'CONFIRMADA' | 'CONFIRMADA_COM_PENDENCIAS' | 'AJUSTE_PEDIDO' | 'REMOVIDA'

export type InscricaoResumo = {
  id: string
  categoriaCampeonatoId: string
  status: StatusInscricao
  totalAtletas: number
}

export type DetalheEquipe = {
  equipe: Equipe
  atletas: Atleta[]
  comissao: MembroComissao[]
  inscricoes: InscricaoResumo[]
  prontidao: Prontidao
}

export type NovaEquipe = { nome: string; cidade?: string; naipe: Naipe; escudoUrl?: string }

export type NovoAtleta = { nome: string; dataNascimento: string; numeroPreferido?: number; posicao?: string }

export type AtletaLote = { nome: string; numero?: number }

export type ResultadoLote = { criados: number; ignorados: Array<{ linha: number; motivo: string }> }

export type NovoMembroComissao = { nome: string; funcao: string }

export type AtletaInscricao = { atletaId: string; numero: number; capitao?: boolean; libero?: boolean }

export type NovaInscricao = {
  categoriaCampeonatoId: string
  atletas: AtletaInscricao[]
  comissao?: string[]
}

export type RespostaInscricao = { data: InscricaoResumo; avisos: string[] }
