/**
 * Ao vivo público (R11): leitura sem login. Atrás da flag AO_VIVO_ATIVO.
 * Fonte preferida: log do motor (SumulaEvento). Sem log (ou sem a tabela), SetPartida.
 * O cliente do banco e as dependências entram por parâmetro (teste com banco falso).
 */
import type { ConfigPartida } from '@/lib/regras-volei'
import { derivarPlacar } from '@/lib/regras-volei'
import { carregarLinhas, linhasParaLog, type ClienteEventos } from '@/lib/sumula-eventos'
import { payloadDoLog, payloadDosSets, type PayloadAoVivo } from './montar'

export function aoVivoAtivo(env: Record<string, string | undefined> = process.env): boolean {
  return env.AO_VIVO_ATIVO === '1'
}

/** Cache curto de CDN: o placar muda a cada ponto, então só 2 segundos. */
export const CACHE_CONTROL_AO_VIVO = 'public, max-age=0, s-maxage=2'

/** Id numérico simples de Partida (até 9 dígitos). */
export function idDePartidaAoVivo(valor: string): number | null {
  if (!/^\d{1,9}$/.test(valor)) return null
  const n = Number(valor)
  return n > 0 ? n : null
}

export type DependenciasAoVivo = {
  /** Config do motor para a partida (regras da categoria/liga). */
  configDaPartida(partida: { ligaId: number; fase?: string | null; categoriaCampeonatoId?: string | null }): Promise<ConfigPartida>
  /** Competição publicada para visitante (não simulação e não privada). */
  campeonatoPublicado(ligaId: number): Promise<boolean>
  /** Se o log do motor pode ser lido (SUMULA_EVENTOS_ATIVO=1). */
  eventosAtivos: boolean
  agora?: Date
}

export type ResultadoAoVivo =
  | { tipo: 'OK'; payload: PayloadAoVivo; fonte: 'LOG' | 'SETS' }
  | { tipo: 'NAO_ENCONTRADO' }
  | { tipo: 'ERRO' }

async function nomeDaEquipe(cliente: ClienteEventos, equipeId: number | null): Promise<string | null> {
  if (equipeId == null) return null
  const r = await cliente.from('Equipe').select('id,nome').eq('id', equipeId).maybeSingle()
  if (r.error) throw new Error('erro ao ler a equipe')
  const nome = r.data?.nome
  return typeof nome === 'string' && nome.trim() ? nome : null
}

export async function lerAoVivo(cliente: ClienteEventos, partidaId: number, deps: DependenciasAoVivo): Promise<ResultadoAoVivo> {
  const lida = await cliente
    .from('Partida')
    .select('id,ligaId,equipeAId,equipeBId,status,fase,categoriaCampeonatoId,setsPorA,setsPorB')
    .eq('id', partidaId)
    .maybeSingle()
  if (lida.error) return { tipo: 'ERRO' }
  const partida = lida.data as any
  // Inexistente, simulação, rascunho e competição privada têm a mesma resposta (404).
  if (!partida || !(await deps.campeonatoPublicado(Number(partida.ligaId)))) return { tipo: 'NAO_ENCONTRADO' }

  const [equipeA, equipeB] = await Promise.all([
    nomeDaEquipe(cliente, partida.equipeAId ?? null),
    nomeDaEquipe(cliente, partida.equipeBId ?? null),
  ])
  const base = { partida: { id: Number(partida.id), status: partida.status, setsPorA: partida.setsPorA, setsPorB: partida.setsPorB }, equipeA, equipeB, agora: deps.agora }

  if (deps.eventosAtivos) {
    try {
      const leitura = await carregarLinhas(cliente, Number(partida.id))
      if (leitura.ok && leitura.linhas.length > 0) {
        const config = await deps.configDaPartida({ ligaId: Number(partida.ligaId), fase: partida.fase ?? null, categoriaCampeonatoId: partida.categoriaCampeonatoId ?? null })
        const { log } = linhasParaLog(leitura.linhas)
        return { tipo: 'OK', fonte: 'LOG', payload: payloadDoLog({ ...base, placar: derivarPlacar(log, config) }) }
      }
    } catch {
      // Qualquer falha do log cai para os sets: o placar ao vivo não pode sumir por causa disso.
    }
  }

  const sets = await cliente.from('SetPartida').select('numero,pontosA,pontosB').eq('partidaId', Number(partida.id))
  if (sets.error) return { tipo: 'ERRO' }
  const linhas = ((sets.data ?? []) as any[]).map((s) => ({ numero: Number(s.numero), pontosA: Number(s.pontosA), pontosB: Number(s.pontosB) }))
  return { tipo: 'OK', fonte: 'SETS', payload: payloadDosSets({ ...base, sets: linhas }) }
}
