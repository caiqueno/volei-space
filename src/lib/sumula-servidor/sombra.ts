/**
 * Revalidação em MODO SOMBRA das ocorrências do PUT /api/sumula/[token] com o motor de regras.
 *
 * Contrato (REGRA DE OURO): nada aqui bloqueia, altera status HTTP ou muda o que foi gravado. O resultado é
 * ADITIVO na resposta (`avisosMotor`, `divergenciaPlacar`) e só existe com SUMULA_SERVIDOR_SOMBRA=1.
 * Falha interna do motor vira um aviso 'info' (SOMBRA-ERRO-INTERNO), nunca exceção.
 * Como ler os avisos e quando migrar para bloqueio: docs/analise/07-arquitetura-backend.md (seção "Modo sombra").
 */
import {
  anexarEvento,
  derivarPlacar,
  type ConfigPartida,
  type ContextoDerivacao,
  type NovoEvento,
  type SumulaEvento,
} from '@/lib/regras-volei'
import { contextoDaPartida } from '@/lib/sumula-eventos/contexto'
import { configDaPartida } from '@/lib/sumula-eventos/config-partida'
import { validarNovoEvento } from '@/lib/sumula-eventos/servico'
import { traduzirOcorrencia, LivroEspelho } from '@/lib/sumula-ui/fila-adaptador'
import { ehNaoConfirmado, lerOverride } from '@/lib/sumula-ui/override'
import type { CategoryMatchRules } from '@/lib/category-match-rules'
import { interpretarOcorrencias, type EntradaInterpretacao } from './interpretar'

export type SeveridadeAviso = 'erro' | 'aviso' | 'info'

export interface AvisoMotor {
  codigo: string
  mensagem: string
  severidade: SeveridadeAviso
}

export interface DivergenciaPlacar {
  sets: Array<{
    numero: number
    gravado: { a: number; b: number }
    derivado: { a: number; b: number } | null
  }>
}

export interface ResultadoSombra {
  avisosMotor: AvisoMotor[]
  divergenciaPlacar?: DivergenciaPlacar
}

export interface EntradaSombra extends EntradaInterpretacao {
  sets: ReadonlyArray<{ numero: number; pontosA: number; pontosB: number }>
  regras: Partial<CategoryMatchRules>
}

/** Só o valor exato '1' liga a sombra. Qualquer outra coisa (ausente, '0', 'true') mantém tudo desligado. */
export function sombraAtiva(valor: string | undefined | null = process.env.SUMULA_SERVIDOR_SOMBRA): boolean {
  return valor === '1'
}

let contadorId = 0
const novoId = () => `00000000-0000-4000-8000-${String(++contadorId % 1_000_000_000_000).padStart(12, '0')}`

const ROTULO_INTERPRETACAO: Record<string, { codigo: string; severidade: SeveridadeAviso; mensagem: string }> = {
  SANCAO_SEM_MARCADOR: {
    codigo: 'SOMBRA-SANCAO-SEM-MARCADOR',
    severidade: 'aviso',
    mensagem: 'Há sanção gravada sem o marcador técnico: o motor não conseguiu revalidar a progressão das sanções.',
  },
  REDESIGNACAO_LIBERO: {
    codigo: 'SOMBRA-NAO-TRADUZIDA',
    severidade: 'info',
    mensagem: 'Redesignação de líbero não é revalidada nesta fase.',
  },
  TEXTO_NAO_RECONHECIDO: { codigo: 'SOMBRA-NAO-TRADUZIDA', severidade: 'info', mensagem: 'Uma ocorrência não pôde ser lida com segurança e ficou fora da revalidação.' },
  ATLETA_DESCONHECIDO: { codigo: 'SOMBRA-NAO-TRADUZIDA', severidade: 'info', mensagem: 'Uma ocorrência cita camisa sem atleta conhecido e ficou fora da revalidação.' },
  EQUIPE_DESCONHECIDA: { codigo: 'SOMBRA-NAO-TRADUZIDA', severidade: 'info', mensagem: 'Uma ocorrência sem equipe identificável ficou fora da revalidação.' },
  FORMACAO_INCOMPLETA: { codigo: 'SOMBRA-NAO-TRADUZIDA', severidade: 'info', mensagem: 'Papeleta de set sem formação completa ficou fora da revalidação.' },
}

/** Núcleo PURO e síncrono; pode lançar (quem chama é `revalidarEmSombra`). */
export function calcularSombra(entrada: EntradaSombra): ResultadoSombra {
  const avisos: AvisoMotor[] = []
  const { itens, naoInterpretadas } = interpretarOcorrencias(entrada)

  const vistos = new Set<string>()
  for (const n of naoInterpretadas) {
    const rotulo = ROTULO_INTERPRETACAO[n.motivo]
    const chave = `${rotulo.codigo}|${n.motivo}`
    if (n.motivo !== 'SANCAO_SEM_MARCADOR' && vistos.has(chave)) continue
    vistos.add(chave)
    avisos.push({ codigo: rotulo.codigo, mensagem: rotulo.mensagem, severidade: rotulo.severidade })
  }

  const config: ConfigPartida = configDaPartida(entrada.regras)
  const ctx = contextoDaPartida({ equipeA: entrada.equipeA, equipeB: entrada.equipeB, presencas: [...entrada.presencas] })
  let log: readonly SumulaEvento[] = []
  const livro = new LivroEspelho()

  for (const item of itens) {
    const traduzido = traduzirOcorrencia(item.ocorrencia, livro, novoId)
    if (!traduzido.ok) {
      avisos.push({ codigo: 'SOMBRA-NAO-TRADUZIDA', mensagem: traduzido.motivo, severidade: 'info' })
      continue
    }

    // Ponto de penalidade que a própria sanção anterior já gerou no motor: não conta duas vezes.
    if (item.ocorrencia.tipo === 'PONTO' && item.ocorrencia.telaId.startsWith('penalidade-') && log.length > 0) {
      const ultimo = log[log.length - 1]!
      const derivado = derivarPlacar(log, config, ctx)
      const gerou = ultimo.tipo === 'SANCAO' && (derivado.setAtual?.pontos ?? []).some((p) => p.seq === ultimo.seq && p.origem === 'PENALIDADE')
      if (gerou) continue
    }

    for (const evento of traduzido.eventos) {
      const recebido = { clientEventId: evento.clientEventId as string, tipo: evento.tipo, payload: evento.payload, desfazId: null }
      const r = validarNovoEvento(log, config, ctx, recebido as Parameters<typeof validarNovoEvento>[3])
      let novo: NovoEvento
      if (r.ok && !r.duplicado) {
        novo = r.novo
        for (const a of r.avisos) avisos.push({ codigo: a.codigo, mensagem: a.mensagem, severidade: 'info' })
      } else if (r.ok) {
        continue
      } else {
        const justificado = lerOverride(item.texto)
        const info = ehNaoConfirmado(r.codigo) || (justificado != null && justificado.codigo.toUpperCase() === String(r.codigo).toUpperCase())
        avisos.push({ codigo: r.codigo, mensagem: r.mensagem, severidade: info ? 'info' : 'erro' })
        novo = { tipo: evento.tipo, payload: evento.payload, clientEventId: evento.clientEventId, desfazId: null } as unknown as NovoEvento
      }
      // O que a tela gravou entra no log mesmo se o motor recusaria: a derivação ignora o inválido e o placar é comparado.
      const anexado = anexarEvento(log, novo)
      if (anexado.ok) log = anexado.log
    }
  }

  const resultado: ResultadoSombra = { avisosMotor: avisos }
  if (itens.length === 0) return resultado

  const derivado = derivarPlacar(log, config, ctx)
  const porSet = new Map<number, { a: number; b: number }>()
  for (const s of derivado.sets) porSet.set(s.numero, { a: s.placar.a, b: s.placar.b })
  if (derivado.setAtual) porSet.set(derivado.setAtual.numero, { a: derivado.setAtual.placar.a, b: derivado.setAtual.placar.b })

  const divergentes: DivergenciaPlacar['sets'] = []
  for (const set of entrada.sets) {
    const d = porSet.get(set.numero) ?? null
    const gravado = { a: set.pontosA, b: set.pontosB }
    if (!d && gravado.a === 0 && gravado.b === 0) continue
    if (!d || d.a !== gravado.a || d.b !== gravado.b) divergentes.push({ numero: set.numero, gravado, derivado: d })
  }
  if (divergentes.length > 0) {
    resultado.divergenciaPlacar = { sets: divergentes }
    avisos.push({
      codigo: 'SOMBRA-PLACAR-DIVERGENTE',
      mensagem: 'O placar derivado das ocorrências difere do placar gravado nos sets: ' + divergentes.map((s) => s.numero).join(', ') + '.',
      severidade: 'aviso',
    })
  }
  return resultado
}

export interface OpcoesSombra {
  /** Injetável nos testes; padrão lê a variável de ambiente. */
  ativa?: boolean
  partidaId?: number
  registrar?: (mensagem: string) => void
}

/**
 * Ponto de entrada da rota. Desligada: devolve `null` e não computa nada. Ligada: nunca lança.
 * Registra só contagens (sem nomes, camisas, textos ou ids de atletas).
 */
export function revalidarEmSombra(entrada: () => EntradaSombra, opcoes: OpcoesSombra = {}): ResultadoSombra | null {
  const ativa = opcoes.ativa ?? sombraAtiva()
  if (!ativa) return null
  const registrar = opcoes.registrar ?? ((m: string) => console.info(m))
  try {
    const r = calcularSombra(entrada())
    const porCodigo: Record<string, number> = {}
    for (const a of r.avisosMotor) porCodigo[a.codigo] = (porCodigo[a.codigo] ?? 0) + 1
    registrar(`[sumula-sombra] ${JSON.stringify({
      partidaId: opcoes.partidaId ?? null,
      avisos: r.avisosMotor.length,
      erros: r.avisosMotor.filter((a) => a.severidade === 'erro').length,
      divergenciaPlacar: r.divergenciaPlacar ? r.divergenciaPlacar.sets.length : 0,
      codigos: porCodigo,
    })}`)
    return r
  } catch (erro) {
    try {
      registrar(`[sumula-sombra] ${JSON.stringify({ partidaId: opcoes.partidaId ?? null, erroInterno: erro instanceof Error ? erro.name : 'desconhecido' })}`)
    } catch {
      // O log não pode derrubar o PUT.
    }
    return { avisosMotor: [{ codigo: 'SOMBRA-ERRO-INTERNO', mensagem: 'A revalidação em modo sombra falhou e foi ignorada. A súmula foi gravada normalmente.', severidade: 'info' }] }
  }
}
