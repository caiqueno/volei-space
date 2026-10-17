/**
 * Resumo e exportação do scout (JSON e CSV). Funções puras e de saída estável.
 *
 * JSON: `versaoEsquema` na raiz (`scout-json-1`). Mudança que quebra leitor => nova versão.
 * CSV: UTF-8 com BOM, separador `;` (Excel/LibreOffice em pt-BR abrem direto), fim de linha CRLF,
 * primeira coluna `versao_esquema` (`scout-csv-1`) em TODA linha. Só ids, nunca nomes (LGPD).
 * Contrato completo em docs/analise/26-scout.md.
 */
import type { ConfigPartida, ContextoDerivacao, SumulaEvento } from '@/lib/regras-volei'
import { derivarScoutDoLog, type DerivacaoScout } from './derivacao'
import { agregarAcoes, type AgregacaoScout } from './estatisticas'
import { VERSAO_ESQUEMA_CSV, VERSAO_ESQUEMA_JSON, type AcaoScout } from './modelo'

export const BOM_UTF8 = '﻿'

export interface ResumoScout {
  versaoEsquema: typeof VERSAO_ESQUEMA_JSON
  partidaId: number
  geradoEm: string
  /** O que sai do log do motor, sem scout manual. */
  derivado: DerivacaoScout
  /** Ações lançadas manualmente (fase posterior): hoje sempre vazio. */
  acoes: AcaoScout[]
  estatisticas: AgregacaoScout
  /** O que este resumo NÃO cobre, para ninguém ler zero onde há ausência de dado. */
  lacunas: string[]
}

export const LACUNAS_SCOUT: readonly string[] = [
  'Sem lançamento manual de scout: não há ace/erro de saque, ataque, bloqueio, defesa, levantamento nem qualidade de recepção.',
  'Eficiência de saque derivada = pontos no saque / saques; não separa ace, erro de saque e rally perdido.',
  'Zonas de origem/destino e posição do jogador no lance dependem de scout manual.',
  'Durações usam o horário de gravação dos eventos (criadoEm), não o horário real do lance.',
  'Formato .dvw (DataVolley) não implementado: o layout ainda não foi confirmado em fonte.',
]

export function montarResumo(params: {
  partidaId: number
  log: readonly SumulaEvento[]
  config: ConfigPartida
  contexto?: ContextoDerivacao
  acoes?: readonly AcaoScout[]
  geradoEm?: string
}): ResumoScout {
  const acoes = [...(params.acoes ?? [])]
  return {
    versaoEsquema: VERSAO_ESQUEMA_JSON,
    partidaId: params.partidaId,
    geradoEm: params.geradoEm ?? new Date().toISOString(),
    derivado: derivarScoutDoLog(params.log, params.config, params.contexto),
    acoes,
    estatisticas: agregarAcoes(acoes),
    lacunas: [...LACUNAS_SCOUT],
  }
}

export function exportarJson(resumo: ResumoScout): string {
  return JSON.stringify(resumo, null, 2)
}

export const COLUNAS_CSV = [
  'versao_esquema', 'partida_id', 'tipo_registro', 'set', 'seq', 'equipe', 'jogador', 'fundamento', 'resultado',
  'rotacao', 'rotacao_adversaria', 'posicao', 'zona_origem', 'zona_destino', 'placar_a_antes', 'placar_b_antes',
  'origem', 'tipo_ponto', 'sacador_equipe', 'sacador_jogador', 'sequencia_atual', 'sai', 'entra', 'detalhe',
] as const

type Celula = string | number | null | undefined

/** Escapa para CSV `;` e neutraliza injeção de fórmula em texto (=, +, -, @, tab, CR no início). */
export function celulaCsv(valor: Celula): string {
  if (valor === null || valor === undefined) return ''
  if (typeof valor === 'number') return Number.isFinite(valor) ? String(valor) : ''
  let t = valor
  if (/^[=+\-@\t\r]/.test(t)) t = `'${t}`
  return /[;"\r\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t
}

export function exportarCsv(resumo: ResumoScout): string {
  const linhas: Celula[][] = []
  const base = (tipo: string, campos: Partial<Record<(typeof COLUNAS_CSV)[number], Celula>>): Celula[] =>
    COLUNAS_CSV.map((c) => {
      if (c === 'versao_esquema') return VERSAO_ESQUEMA_CSV
      if (c === 'partida_id') return resumo.partidaId
      if (c === 'tipo_registro') return tipo
      return campos[c]
    })

  for (const p of resumo.derivado.pontos) {
    linhas.push(base('PONTO', {
      set: p.set, seq: p.seq, equipe: p.equipe,
      rotacao: p.equipe === 'A' ? p.rotacaoA : p.rotacaoB,
      rotacao_adversaria: p.equipe === 'A' ? p.rotacaoB : p.rotacaoA,
      placar_a_antes: p.placarAntesA, placar_b_antes: p.placarAntesB,
      origem: p.origem, tipo_ponto: p.tipo, sacador_equipe: p.sacadorEquipe, sacador_jogador: p.sacadorJogador,
      sequencia_atual: p.sequenciaAtual,
    }))
  }
  for (const t of resumo.derivado.tempos) {
    linhas.push(base('TEMPO', { set: t.set, seq: t.seq, equipe: t.equipe, placar_a_antes: t.placarA, placar_b_antes: t.placarB }))
  }
  for (const s of resumo.derivado.substituicoes) {
    linhas.push(base('SUBSTITUICAO', {
      set: s.set, seq: s.seq, equipe: s.equipe, sai: s.sai, entra: s.entra, detalhe: s.tipo,
      placar_a_antes: s.placarA, placar_b_antes: s.placarB,
    }))
  }
  for (const a of resumo.acoes) {
    linhas.push(base('ACAO', {
      set: a.set, seq: a.id, equipe: a.equipe, jogador: a.jogadorId, fundamento: a.fundamento, resultado: a.resultado,
      rotacao: a.rotacao, posicao: a.posicao, zona_origem: a.zonaOrigem, zona_destino: a.zonaDestino,
      placar_a_antes: a.pontoA, placar_b_antes: a.pontoB, origem: a.origem,
    }))
  }

  const corpo = [COLUNAS_CSV as readonly Celula[], ...linhas].map((l) => l.map(celulaCsv).join(';')).join('\r\n')
  return `${BOM_UTF8}${corpo}\r\n`
}
