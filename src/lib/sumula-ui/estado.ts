/**
 * Reconstrói o estado do motor (EstadoEquipe) a partir do que a súmula já registrou, sem mudar o
 * formato de gravação. Módulo PURO. Os eventos chegam do mais antigo ao mais novo.
 */
import {
  aplicarRedesignacaoLibero,
  aplicarSancaoNoEstado,
  aplicarSubstituicaoExcepcional,
  aplicarSubstituicaoRegular,
  aplicarTrocaLibero,
  criarEstadoEquipe,
  registrarRallyConcluido,
  substituirNaQuadra,
  type EstadoEquipe,
  type MotivoExcepcional,
  type PerfilRegras,
  type SancaoAvaliada,
  type SancaoRegistrada,
  type TipoSancao,
} from '@/lib/regras-volei'

export type LadoTela = 'teamA' | 'teamB'

/** Ordem da tela [P4,P3,P2,P5,P6,P1] -> índices do motor [I..VI] = P1,P2,P3,P4,P5,P6. */
const PAGINA_PARA_MOTOR = [5, 2, 1, 0, 3, 4] as const

export function formacaoParaMotor(lineup: ReadonlyArray<string | undefined>, idPorNumero: (numero: string) => number | null): number[] | null {
  if (lineup.length < 6) return null
  const ids: number[] = []
  for (const indice of PAGINA_PARA_MOTOR) {
    const numero = lineup[indice]
    if (!numero) return null
    const id = idPorNumero(numero)
    if (id == null) return null
    ids.push(id)
  }
  return new Set(ids).size === 6 ? ids : null
}

/** Troca a formação em quadra do estado pela formação atual da tela (rodízio e líbero já refletidos). */
export function comFormacaoAtual(estado: EstadoEquipe, formacao: number[] | null): EstadoEquipe {
  return formacao ? { ...estado, emQuadra: formacao } : estado
}

/* ---------------- marcadores no texto das ocorrências ---------------- */

export function marcadorExcepcional(motivo: MotivoExcepcional) {
  return ` [[EXC:${motivo}]]`
}

export function lerMotivoExcepcional(texto: string): MotivoExcepcional {
  const m = texto.match(/\[\[EXC:(LESAO|DOENCA|EXPULSAO|DESQUALIFICACAO)\]\]/)
  return (m?.[1] as MotivoExcepcional | undefined) ?? 'LESAO'
}

export function marcadorSancao(equipe: 'A' | 'B', registro: SancaoRegistrada) {
  return ` [[SAN:${equipe}:${registro.membro.replace(/:/g, '.')}:${registro.categoria}:${registro.sancao}:${registro.set}]]`
}

const PADRAO_SAN = /\[\[SAN:(A|B):([^:\]]+):([A-Z]+):([A-Z_]+):(\d+)\]\]/

export function lerSancao(texto: string): SancaoRegistrada | null {
  const m = texto.match(PADRAO_SAN)
  if (!m) return null
  return {
    equipe: m[1] as 'A' | 'B',
    membro: m[2].replace(/\./g, ':'),
    categoria: m[3] as SancaoRegistrada['categoria'],
    sancao: m[4] as TipoSancao,
    set: Number(m[5]),
  }
}

export function marcadorRedesignacao(incapaz: string, novo: string) {
  return ` [[LIBRED:${incapaz}:${novo}]]`
}

export function lerRedesignacao(texto: string): { incapaz: string; novo: string } | null {
  const m = texto.match(/\[\[LIBRED:([^:\]]+):([^:\]]+)\]\]/)
  return m ? { incapaz: m[1], novo: m[2] } : null
}

/** Remove os marcadores técnicos para exibição. */
export function semMarcadores(texto: string) {
  return texto.replace(/\s*\[\[(?:ROT|EXC|SAN|LIBRED):[^\]]*\]\]/g, '')
}

/** Histórico de sanções da partida inteira (qualquer set), do mais antigo ao mais novo. */
export function historicoDeSancoes(eventosDoMaisAntigo: ReadonlyArray<{ text: string }>): SancaoRegistrada[] {
  const lista: SancaoRegistrada[] = []
  for (const evento of eventosDoMaisAntigo) {
    const s = lerSancao(evento.text)
    if (s) lista.push(s)
  }
  return lista
}

/* ---------------- replay ---------------- */

export type EventoDoSet = {
  type: string
  text: string
  teamId?: LadoTela
  set: number
}

export type EntradaReplay = {
  elenco: number[]
  liberos: number[]
  /** Formação no início do set, na ordem do motor (I..VI). */
  titulares: number[]
  equipe: LadoTela
  eventosDoSet: ReadonlyArray<EventoDoSet>
  perfil: PerfilRegras
  /** Camisa exibida -> id do atleta. */
  idPorCamisa: (camisa: string) => number | null
  /** Número do cadastro -> id do atleta. */
  idPorNumero: (numero: string) => number | null
  historico: ReadonlyArray<SancaoRegistrada>
  setAtual: number
}

const TIPOS_PONTO = new Set(['point', 'attack', 'block', 'ace'])

function lerTroca(texto: string): [string, string] | null {
  const m = texto.match(/sai #([^\s,]+).+entra #([^\s,]+)/i)
  if (!m) return null
  const limpar = (v: string) => v.replace(/[.,;:]+$/g, '')
  return [limpar(m[1]), limpar(m[2])]
}

function trocaForcada(estado: EstadoEquipe, sai: number, entra: number): EstadoEquipe {
  return { ...estado, emQuadra: estado.emQuadra.includes(sai) ? substituirNaQuadra(estado, sai, entra) : estado.emQuadra }
}

/**
 * Replay tolerante: o que já foi gravado não é rejeitado; se o motor bloquearia, o contador e a
 * quadra são atualizados mesmo assim para o resumo refletir o que aconteceu.
 */
export function reconstruirEstadoEquipe(entrada: EntradaReplay): EstadoEquipe {
  let estado = criarEstadoEquipe({ elenco: entrada.elenco, liberos: entrada.liberos, formacaoInicial: entrada.titulares })
  const lado: 'A' | 'B' = entrada.equipe === 'teamA' ? 'A' : 'B'
  const idDe = (numero: string) => entrada.idPorCamisa(numero) ?? entrada.idPorNumero(numero)

  // Desqualificação vale para a partida toda: vem do histórico dos sets anteriores.
  for (const s of entrada.historico) {
    if (s.equipe !== lado || s.sancao !== 'DESQUALIFICACAO' || s.set >= entrada.setAtual || !s.membro.startsWith('J:')) continue
    estado = aplicarSancaoNoEstado(estado, Number(s.membro.slice(2)), { sancao: 'DESQUALIFICACAO' } as SancaoAvaliada)
  }

  for (const evento of entrada.eventosDoSet) {
    if (TIPOS_PONTO.has(evento.type)) {
      estado = registrarRallyConcluido(estado)
      continue
    }
    if (evento.type === 'anotacao') {
      const san = lerSancao(evento.text)
      if (san && san.equipe === lado && san.set === entrada.setAtual && san.membro.startsWith('J:')) {
        const id = Number(san.membro.slice(2))
        const avaliada = { sancao: san.sancao } as SancaoAvaliada
        estado = aplicarSancaoNoEstado(estado, id, avaliada)
        continue
      }
      const red = lerRedesignacao(evento.text)
      if (red && evento.teamId === entrada.equipe) {
        const incapaz = entrada.idPorNumero(red.incapaz)
        const novo = entrada.idPorNumero(red.novo)
        if (incapaz != null && novo != null) {
          const r = aplicarRedesignacaoLibero(estado, { liberoIncapaz: incapaz, novoLibero: novo, motivo: 'INCAPAZ' }, { equipe: lado, numeroSet: entrada.setAtual, pontosEquipe: 0, pontosAdversario: 0 })
          estado = r.resultado.ok ? r.estado : estado
        }
      }
      continue
    }
    if (evento.teamId !== entrada.equipe) continue
    if (evento.type !== 'substitution' && evento.type !== 'injury_substitution' && evento.type !== 'libero_exchange') continue
    const troca = lerTroca(evento.text)
    if (!troca) {
      if (evento.type === 'substitution') estado = { ...estado, regulares: estado.regulares + 1 }
      if (evento.type === 'injury_substitution') estado = { ...estado, excepcionais: estado.excepcionais + 1 }
      continue
    }
    const sai = idDe(troca[0])
    const entra = idDe(troca[1])
    if (sai == null || entra == null) continue

    if (evento.type === 'substitution') {
      const livre = { ...estado, pedidoNaInterrupcao: false }
      const r = aplicarSubstituicaoRegular(livre, { sai, entra }, entrada.perfil)
      estado = r.resultado.ok
        ? { ...r.estado, pedidoNaInterrupcao: false }
        : { ...trocaForcada(estado, sai, entra), regulares: estado.regulares + 1 }
    } else if (evento.type === 'injury_substitution') {
      const motivo = lerMotivoExcepcional(evento.text)
      const r = aplicarSubstituicaoExcepcional({ ...estado, pedidoNaInterrupcao: false }, { sai, entra, motivo }, entrada.perfil)
      estado = r.resultado.ok
        ? r.estado
        : { ...trocaForcada(estado, sai, entra), excepcionais: estado.excepcionais + 1, semRetorno: [...estado.semRetorno, sai] }
    } else {
      const r = aplicarTrocaLibero(estado, { sai, entra }, { momento: 'BOLA_FORA', excecaoRally: true })
      if (r.resultado.ok) {
        estado = r.estado
      } else {
        const saiEhLibero = estado.liberos.includes(sai)
        estado = {
          ...trocaForcada(estado, sai, entra),
          substituidoPorLibero: saiEhLibero ? null : sai,
          rallyConcluidoDesdeTrocaLibero: false,
        }
      }
    }
  }
  return estado
}
