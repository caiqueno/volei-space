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
import { estadoDoSetNoMomento } from './derivacao'
import type { DerivadorDeEstado } from './acoes'

export const MENSAGEM_EVENTOS_INDISPONIVEIS = 'Eventos da súmula ainda não habilitados neste ambiente.'
export const AVISO_SEM_LOG =
  'Log de eventos da súmula indisponível neste ambiente: as seções derivadas (pontos, sets, tempos e substituições) estão vazias; as ações manuais foram incluídas.'

/**
 * Derivador do estado do set para o POST de ações: lê o log e devolve placar/rotação do set no momento.
 * Sem `SUMULA_EVENTOS_ATIVO`, sem tabela ou sem set iniciado devolve null (a ação segue sem placar/rotação).
 * `carregar` só roda quando o log é de fato consultado (evita ler regras da partida à toa).
 */
export function criarDerivadorDoLog(
  cliente: ClienteEventos,
  partidaId: number,
  carregar: () => Promise<{ config: ConfigPartida; contexto?: ContextoDerivacao }>,
  env: Record<string, string | undefined> = process.env,
): DerivadorDeEstado | undefined {
  if (!sumulaEventosAtivo(env)) return undefined
  return async (setNumero) => {
    const leitura = await carregarLinhas(cliente, partidaId)
    if (!leitura.ok) return null
    const { log } = linhasParaLog(leitura.linhas)
    if (log.length === 0) return null
    const { config, contexto } = await carregar()
    return estadoDoSetNoMomento(log, config, setNumero, contexto)
  }
}

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
