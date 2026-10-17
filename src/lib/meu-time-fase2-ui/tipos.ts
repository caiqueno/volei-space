export type EstadoConvite = 'ativo' | 'usado' | 'expirado' | 'revogado' | 'invalido'

export type ConviteResumo = { id: string; estado: EstadoConvite; criadoEm: string; expiraEm: string }
export type ConviteGerado = { url: string; expiraEm: string }
export type ConvitePublico = { equipe: string; categoria: string | null; estado: EstadoConvite }
export type DadosAtletaConvite = { nome: string; dataNascimento: string; camisa?: number; posicao?: string }

export type StatusLinha = 'OK' | 'AVISO' | 'ERRO'
export type LinhaImportacao = { n: number; status: StatusLinha; erros: string[]; dados: Record<string, unknown> }
export type PreviaImportacao = {
  id: string
  resumo: { validas: number; comAviso: number; invalidas: number }
  linhas: LinhaImportacao[]
}

export type EquipeClube = { id: string; nome: string }
export type Clube = { id?: string; nome: string; equipes?: EquipeClube[] }

export type Notificacao = { id: string; tipo: string; payload: Record<string, unknown>; lidaEm: string | null; criadoEm: string }
