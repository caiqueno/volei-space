// Banco falso do log de eventos da súmula: a tabela "SumulaEvento" e o RPC registrar_evento_sumula,
// espelhando a migration pendente 202610170023 (idempotência, seq esperado, desfazer, oficializada).
import type { ClienteEventos, ErroBanco } from '../../src/lib/sumula-eventos/repositorio'

export interface OpcoesBancoEventos {
  partidaId: number
  equipeAId: number
  equipeBId: number
  oficializada?: boolean
  /** false simula a migration não aplicada (42P01 na tabela). */
  tabelaExiste?: boolean
  /** false simula a função RPC ausente (PGRST202). */
  rpcExiste?: boolean
}

export function criarBancoEventos(opcoes: OpcoesBancoEventos) {
  const linhas: Array<Record<string, any>> = []
  let proximoId = 1
  const estado = {
    chamadasRpc: 0,
    /** Executa antes de cada RPC: o teste usa para simular outro apontador gravando no meio. */
    antesDoRpc: null as null | (() => void),
  }
  const erro = (code: string, message: string, details: string | null = null): ErroBanco => ({ code, message, details })

  const from = (nome: string) => {
    const filtros: Array<(l: Record<string, any>) => boolean> = []
    let limite = Infinity
    const b: any = {
      select: () => b,
      eq: (c: string, v: unknown) => (filtros.push((l) => l[c] === v), b),
      gt: (c: string, v: number) => (filtros.push((l) => l[c] > v), b),
      order: () => b,
      limit: (n: number) => ((limite = n), b),
      then(res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) {
        if (nome !== 'SumulaEvento' || opcoes.tabelaExiste === false) {
          return Promise.resolve({ data: null, error: erro('42P01', `relation "public.${nome}" does not exist`) }).then(res, rej)
        }
        const data = linhas
          .filter((l) => filtros.every((f) => f(l)))
          .sort((x, y) => x.seq - y.seq)
          .slice(0, limite)
          .map((l) => ({ ...l }))
        return Promise.resolve({ data, error: null }).then(res, rej)
      },
    }
    return b
  }

  const rpc = (nome: string, a: Record<string, any>) => {
    estado.chamadasRpc += 1
    estado.antesDoRpc?.()
    const falha = (e: ErroBanco) => Promise.resolve({ data: null, error: e })
    if (opcoes.tabelaExiste === false || opcoes.rpcExiste === false || nome !== 'registrar_evento_sumula') {
      return falha(erro('PGRST202', 'Could not find the function public.registrar_evento_sumula in the schema cache'))
    }
    const doTipo = linhas.filter((l) => l.partidaId === a.p_partida_id)
    const existente = doTipo.find((l) => l.clientEventId === a.p_client_event_id)
    if (existente) return Promise.resolve({ data: { id: existente.id, seq: existente.seq, duplicado: true }, error: null })
    if (opcoes.oficializada) return falha(erro('23514', 'Sumula oficializada: nao aceita novos eventos'))
    const atual = doTipo.reduce((m, l) => Math.max(m, l.seq), 0)
    if (a.p_seq_esperado != null && a.p_seq_esperado !== atual) {
      return falha(erro('40001', 'Conflito de versao da sumula', String(atual)))
    }
    if (a.p_tipo === 'SNAPSHOT' && atual !== 0) return falha(erro('23514', 'SNAPSHOT so e aceito como primeiro evento da partida'))
    if (a.p_tipo === 'DESFAZ') {
      const alvo = doTipo.find((l) => l.id === a.p_desfaz_id)
      if (!alvo) return falha(erro('23503', 'Evento a desfazer nao pertence a esta partida'))
      if (alvo.tipo === 'DESFAZ' || alvo.tipo === 'SNAPSHOT') return falha(erro('23514', 'Evento nao pode ser desfeito'))
      if (doTipo.some((l) => l.desfazId === a.p_desfaz_id)) return falha(erro('23505', 'duplicate key value violates unique constraint "SumulaEvento_desfazId_key"'))
    }
    if (a.p_equipe_id != null && ![opcoes.equipeAId, opcoes.equipeBId].includes(a.p_equipe_id)) {
      return falha(erro('23514', 'Equipe nao participa desta partida'))
    }
    if (a.p_tipo === 'PONTO' && (a.p_equipe_id == null || a.p_set_numero == null)) {
      return falha(erro('23514', 'SumulaEvento_ponto_chk'))
    }
    const linha = {
      id: proximoId++,
      partidaId: a.p_partida_id,
      seq: atual + 1,
      clientEventId: a.p_client_event_id,
      tipo: a.p_tipo,
      setNumero: a.p_set_numero,
      equipeId: a.p_equipe_id,
      payload: JSON.parse(JSON.stringify(a.p_payload ?? {})),
      desfazId: a.p_desfaz_id ?? null,
      autorTipo: a.p_autor_tipo,
      criadoEm: new Date(0).toISOString(),
    }
    linhas.push(linha)
    return Promise.resolve({ data: { id: linha.id, seq: linha.seq, duplicado: false }, error: null })
  }

  const cliente: ClienteEventos = { from, rpc }
  return { cliente, linhas, estado }
}

/** Grava direto uma linha, como se outro apontador tivesse usado o RPC antes. */
export function inserirLinhaDeOutroApontador(
  banco: ReturnType<typeof criarBancoEventos>,
  partidaId: number,
  clientEventId: string,
) {
  const seq = banco.linhas.filter((l) => l.partidaId === partidaId).length + 1
  banco.linhas.push({
    id: 10_000 + seq,
    partidaId,
    seq,
    clientEventId,
    tipo: 'SAQUE',
    setNumero: null,
    equipeId: null,
    payload: { _motor: 'OBSERVACAO', texto: 'outro apontador' },
    desfazId: null,
    criadoEm: new Date(0).toISOString(),
  })
}
