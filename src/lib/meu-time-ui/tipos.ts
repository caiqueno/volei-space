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

export const FUNCOES_COMISSAO_CODIGOS = ['TECNICO', 'ASSISTENTE', 'PREPARADOR_FISICO', 'FISIOTERAPEUTA', 'MEDICO'] as const
export type FuncaoComissao = (typeof FUNCOES_COMISSAO_CODIGOS)[number]

/** Pessoa da comissão técnica: só nome e função (não tem conta no sistema). */
export type MembroComissao = { id: string; nome: string; funcao: string }

export const POSICOES_CODIGOS = ['LV', 'PT', 'OP', 'CT', 'LB'] as const
export type PosicaoCodigo = (typeof POSICOES_CODIGOS)[number]

export type PapelAcesso = 'RESPONSAVEL' | 'TECNICO' | 'ASSISTENTE' | 'CAPITAO'

/** Pessoa com conta que tem acesso à equipe (rota /membros). `voce` é opcional: o servidor pode marcar a própria pessoa. */
export type MembroAcesso = { id: string; nome: string; papel: PapelAcesso; voce?: boolean }

export type NovoAcesso = { email: string; papel: 'TECNICO' | 'ASSISTENTE' }

/** Limites da categoria vindos de GET /categorias/:id/regras. */
export type RegrasCategoria = {
  categoriaId: string
  nome: string
  naipe: Naipe | null
  /** null = sem limite (categoria sem RegraElenco). */
  minimoAtletas: number | null
  maximoAtletas: number | null
  maximoLiberos: number
  maximoComissao: number | null
  anoNascimentoMinimo: number | null
  anoNascimentoMaximo: number | null
  inscricoesAbertas: boolean
}

export type EdicaoEquipe = { nome: string; cidade: string | null; escudoUrl: string | null }

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
  /** Papel de quem está logado na equipe, quando o servidor informa. */
  meuPapel?: PapelAcesso
}

export type NovaEquipe = { nome: string; cidade?: string; naipe: Naipe; escudoUrl?: string }

export type NovoAtleta = { nome: string; dataNascimento: string; numeroPreferido?: number; posicao?: string }

export type AtletaLote = { nome: string; numero?: number; dataNascimento?: string }

export type ResultadoLote = {
  criados: number
  /** Atletas criados, quando o servidor devolve a lista (os sem nascimento vêm com `dataNascimento: null`). */
  atletasCriados: Atleta[]
  ignorados: Array<{ linha: number; motivo: string }>
}

export type NovoMembroComissao = { nome: string; funcao: string }

export type AtletaInscricao = { atletaId: string; numero: number; capitao?: boolean; libero?: boolean }

export type NovaInscricao = {
  categoriaCampeonatoId: string
  atletas: AtletaInscricao[]
  comissao?: string[]
  /** Token do link do organizador (`?convite=`). Se vier, o servidor confere com a categoria. */
  convite?: string
}

export type RespostaInscricao = { data: InscricaoResumo; avisos: string[] }
