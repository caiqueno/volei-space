/**
 * Camada de leitura do scout para as rotas: lê o log (SumulaEvento, pela camada existente de
 * `sumula-eventos`) e monta o resumo. O cliente entra por parâmetro para o teste usar um banco falso.
 */
import type { ConfigPartida, ContextoDerivacao } from '@/lib/regras-volei'
import { carregarLinhas, linhasParaLog, sumulaEventosAtivo, type ClienteEventos } from '@/lib/sumula-eventos'
import type { AcaoScout } from './modelo'
import { montarResumo, type ResumoScout } from './exportacao'

export const MENSAGEM_EVENTOS_INDISPONIVEIS = 'Eventos da súmula ainda não habilitados neste ambiente.'

export type ResultadoLeituraScout =
  | { tipo: 'OK'; resumo: ResumoScout }
  | { tipo: 'INDISPONIVEL'; mensagem: string }
  | { tipo: 'ERRO'; mensagem: string }

export async function lerResumoScout(
  cliente: ClienteEventos,
  entrada: { partidaId: number; config: ConfigPartida; contexto?: ContextoDerivacao; acoes?: readonly AcaoScout[]; geradoEm?: string },
  env: Record<string, string | undefined> = process.env,
): Promise<ResultadoLeituraScout> {
  if (!sumulaEventosAtivo(env)) return { tipo: 'INDISPONIVEL', mensagem: MENSAGEM_EVENTOS_INDISPONIVEIS }
  const leitura = await carregarLinhas(cliente, entrada.partidaId)
  if (!leitura.ok) {
    return leitura.indisponivel
      ? { tipo: 'INDISPONIVEL', mensagem: MENSAGEM_EVENTOS_INDISPONIVEIS }
      : { tipo: 'ERRO', mensagem: leitura.mensagem }
  }
  const { log } = linhasParaLog(leitura.linhas)
  return {
    tipo: 'OK',
    resumo: montarResumo({
      partidaId: entrada.partidaId,
      log,
      config: entrada.config,
      contexto: entrada.contexto,
      acoes: entrada.acoes,
      geradoEm: entrada.geradoEm,
    }),
  }
}
