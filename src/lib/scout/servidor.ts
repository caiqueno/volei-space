/**
 * Camada de leitura do scout para as rotas: lê o log (SumulaEvento, pela camada existente de
 * `sumula-eventos`) e monta o resumo. O cliente entra por parâmetro para o teste usar um banco falso.
 *
 * O resumo NÃO depende do log para existir: sem `SUMULA_EVENTOS_ATIVO` (ou sem a tabela), as ações manuais
 * seguem agregadas e as seções derivadas do log (pontos, tempos, substituições, sets) saem vazias, com um
 * aviso em `lacunas`. Assim a tela do scout carrega e o CSV/JSON levam o que foi lançado à mão.
 */
import type { ConfigPartida, ContextoDerivacao } from '@/lib/regras-volei'
import { carregarLinhas, linhasParaLog, sumulaEventosAtivo, type ClienteEventos } from '@/lib/sumula-eventos'
import type { AcaoScout } from './modelo'
import { montarResumo, type ResumoScout } from './exportacao'

export const MENSAGEM_EVENTOS_INDISPONIVEIS = 'Eventos da súmula ainda não habilitados neste ambiente.'
export const AVISO_SEM_LOG =
  'Log de eventos da súmula indisponível neste ambiente: as seções derivadas (pontos, sets, tempos e substituições) estão vazias; as ações manuais foram incluídas.'

export type ResultadoLeituraScout =
  | { tipo: 'OK'; resumo: ResumoScout; /** true quando o log não pôde ser lido e só as ações manuais entraram. */ semLog: boolean }
  | { tipo: 'ERRO'; mensagem: string }

export async function lerResumoScout(
  cliente: ClienteEventos,
  entrada: { partidaId: number; config: ConfigPartida; contexto?: ContextoDerivacao; acoes?: readonly AcaoScout[]; geradoEm?: string },
  env: Record<string, string | undefined> = process.env,
): Promise<ResultadoLeituraScout> {
  const base = { partidaId: entrada.partidaId, config: entrada.config, contexto: entrada.contexto, acoes: entrada.acoes, geradoEm: entrada.geradoEm }
  const semLog = (): ResultadoLeituraScout => ({ tipo: 'OK', semLog: true, resumo: montarResumo({ ...base, log: [], avisos: [AVISO_SEM_LOG] }) })

  if (!sumulaEventosAtivo(env)) return semLog()
  const leitura = await carregarLinhas(cliente, entrada.partidaId)
  if (!leitura.ok) return leitura.indisponivel ? semLog() : { tipo: 'ERRO', mensagem: leitura.mensagem }
  const { log } = linhasParaLog(leitura.linhas)
  return { tipo: 'OK', semLog: false, resumo: montarResumo({ ...base, log }) }
}
