// Tipos do contrato de "Meu Time" usados pela interface. O servidor é a fonte da verdade.

export type Naipe = 'FEMININO' | 'MASCULINO' | 'MISTO'

export type Prontidao = {
  atletas: number
  semDocumento: number
  /** Menores sem autorização do responsável. O servidor manda `semAutorizacaoResponsavel`; o nome curto é aceito por compatibilidade. */
  semAutorizacaoResponsavel?: number
  semAutorizacao?: number
  mensagem: string
}

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
  /** Menor de 18 anos. Opcional por tolerância a servidor antigo. */
  menor?: boolean
  /** Menor ainda sem autorização do responsável. O contato do responsável nunca volta do servidor. */
  consentimentoPendente?: boolean
}

/** Responsável legal de atleta menor. Só vai para o servidor; nunca é mostrado depois de salvo. */
export type ResponsavelLegal = { nome: string; contato: string }

export type DadosConsentimento = { responsavel: ResponsavelLegal; aceiteResponsavel: true }

export type ConsentimentoAtleta = { atletaId: string; nome: string; menor: boolean; consentimentoPendente: boolean }

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
  /** Contas com acesso à equipe (o contrato sempre envia; opcional aqui por tolerância a servidor antigo). */
  membros?: MembroAcesso[]
  /** Papel de quem está logado na equipe, quando o servidor informa. */
  meuPapel?: PapelAcesso
}

export type NovaEquipe = { nome: string; cidade?: string; naipe: Naipe; escudoUrl?: string }

export type NovoAtleta = {
  nome: string
  dataNascimento: string
  numeroPreferido?: number
  posicao?: string
  /** Obrigatórios para menor de 18 anos. */
  responsavel?: ResponsavelLegal
  aceiteResponsavel?: true
}

export type AtletaLote = { nome: string; numero?: number | null; dataNascimento?: string | null; posicao?: PosicaoCodigo | null }

/**
 * Resultado do lote já normalizado. No contrato `criados` é a lista de atletas; aqui `atletasCriados`
 * guarda a lista e `criados` o total (o servidor antigo mandava só o número).
 */
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
