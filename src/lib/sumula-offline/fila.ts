/**
 * Fila offline (outbox) da súmula por eventos.
 *
 * - Cada evento recebe `clientEventId` (UUID, idempotência no servidor) e `seqLocal` (ordem local).
 * - A ordem de envio é SEMPRE o `seqLocal`; a hora do aparelho vai só como `ocorridoEm` informativo (G8).
 * - Persistida por um adaptador injetável; reenvio é seguro porque o servidor deduplica por `clientEventId`.
 * - Sem dependência de React/Next: o hook e o indicador ficam em arquivos próprios.
 */
import type { EstadoSumula } from '@/lib/sumula-eventos/servico'
import type {
  ConflitoRegistrado,
  DadosPersistidos,
  EventoNovo,
  ItemFila,
  OpcoesFila,
  Pendencia,
  SnapshotFila,
  StatusConexao,
} from './tipos'

const TAMANHO_LOTE_PADRAO = 50

interface AceitoServidor {
  clientEventId: string
  seq: number
}
interface RejeitadoServidor {
  clientEventId: string
  codigo: string
  mensagem: string
  naoProcessado?: boolean
}

export function chaveDaFila(token: string) {
  return `volei.sumula.fila.v1.${token}`
}

function dadosVazios(): DadosPersistidos {
  return { versao: 1, proximoSeqLocal: 1, seqServidor: 0, itens: [], pendencias: [], ultimoConflito: null }
}

function gerarUuidPadrao(): string {
  const c = (globalThis as { crypto?: Crypto }).crypto
  if (c?.randomUUID) return c.randomUUID()
  const b = new Uint8Array(16)
  if (c?.getRandomValues) c.getRandomValues(b)
  else for (let i = 0; i < 16; i++) b[i] = Math.floor(Math.random() * 256)
  b[6] = (b[6] & 0x0f) | 0x40
  b[8] = (b[8] & 0x3f) | 0x80
  const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
}

/** Recuo exponencial com jitter (metade fixa, metade aleatória), limitado a `max`. */
export function calcularRecuo(tentativa: number, base: number, max: number, aleatorio: () => number): number {
  const teto = Math.min(max, base * 2 ** Math.max(0, tentativa - 1))
  return Math.round(teto / 2 + (teto / 2) * aleatorio())
}

function dadosValidos(bruto: unknown): DadosPersistidos | null {
  if (!bruto || typeof bruto !== 'object') return null
  const d = bruto as Partial<DadosPersistidos>
  if (d.versao !== 1 || !Array.isArray(d.itens) || !Array.isArray(d.pendencias)) return null
  const itens = d.itens
    .filter((i): i is ItemFila => !!i && typeof i.clientEventId === 'string' && typeof i.seqLocal === 'number')
    .sort((a, b) => a.seqLocal - b.seqLocal)
  const maior = itens.reduce((m, i) => Math.max(m, i.seqLocal), 0)
  return {
    versao: 1,
    proximoSeqLocal: Math.max(Number(d.proximoSeqLocal) || 1, maior + 1),
    seqServidor: Number(d.seqServidor) || 0,
    itens,
    pendencias: d.pendencias,
    ultimoConflito: d.ultimoConflito ?? null,
  }
}

export class FilaSumula {
  private readonly o: Required<Pick<OpcoesFila, 'recuoBaseMs' | 'recuoMaxMs' | 'recuoModoLocalMs' | 'tamanhoLote' | 'maxConflitosPorCiclo' | 'url'>> & OpcoesFila
  private dados: DadosPersistidos = dadosVazios()
  private estadoServidor: EstadoSumula | null = null
  private online: boolean
  private modoLocal = false
  private erro: string | null = null
  private sincronizando = false
  private enviando = 0
  private falhasSeguidas = 0
  private proximaTentativaEm: number | null = null
  private timer: unknown = null
  private pronto: Promise<void> | null = null
  private ciclo: Promise<void> | null = null
  private parada = false
  private tamanhoLoteAtual: number
  private gravacao: Promise<void> = Promise.resolve()
  private readonly ouvintes = new Set<() => void>()
  private snapshot: SnapshotFila
  private desligarEventos: (() => void) | null = null

  constructor(opcoes: OpcoesFila) {
    this.o = {
      recuoBaseMs: 1000,
      recuoMaxMs: 60_000,
      recuoModoLocalMs: 60_000,
      tamanhoLote: TAMANHO_LOTE_PADRAO,
      maxConflitosPorCiclo: 3,
      url: `/api/sumula/${encodeURIComponent(opcoes.token)}/eventos`,
      ...opcoes,
    }
    this.tamanhoLoteAtual = Math.min(this.o.tamanhoLote, TAMANHO_LOTE_PADRAO)
    this.online = this.lerOnline()
    this.snapshot = this.montarSnapshot()
  }

  // ---------- leitura / assinatura ----------

  getSnapshot = (): SnapshotFila => this.snapshot

  subscribe = (ouvinte: () => void) => {
    this.ouvintes.add(ouvinte)
    return () => {
      this.ouvintes.delete(ouvinte)
    }
  }

  /** Eventos ainda não confirmados, na ordem de envio. */
  itensPendentes(): ItemFila[] {
    return this.dados.itens.map((i) => ({ ...i }))
  }

  // ---------- ciclo de vida ----------

  /** Carrega a fila do armazenamento (reabrir o app com pendências, G4/G5). Idempotente. */
  iniciar(): Promise<void> {
    if (!this.pronto) {
      this.pronto = (async () => {
        try {
          const bruto = await this.o.armazenamento.carregar(chaveDaFila(this.o.token))
          const lido = bruto ? dadosValidos(JSON.parse(bruto)) : null
          if (lido) this.dados = lido
        } catch {
          // Armazenamento ilegível: segue com fila vazia em memória, sem derrubar a tela.
        }
        this.atualizar()
        if (this.dados.itens.length > 0) this.agendarAgora()
      })()
    }
    return this.pronto
  }

  /** Liga os listeners de rede/visibilidade. Devolve a função que desliga. */
  conectarEventosDoNavegador(): () => void {
    if (typeof window === 'undefined') return () => {}
    this.desligarEventos?.()
    const aoFicarOnline = () => this.definirOnline(true)
    const aoFicarOffline = () => this.definirOnline(false)
    const aoMudarVisibilidade = () => {
      if (document.visibilityState === 'visible') {
        this.definirOnline(this.lerOnline())
        void this.sincronizar()
      }
    }
    window.addEventListener('online', aoFicarOnline)
    window.addEventListener('offline', aoFicarOffline)
    document.addEventListener('visibilitychange', aoMudarVisibilidade)
    this.desligarEventos = () => {
      window.removeEventListener('online', aoFicarOnline)
      window.removeEventListener('offline', aoFicarOffline)
      document.removeEventListener('visibilitychange', aoMudarVisibilidade)
      this.desligarEventos = null
    }
    return this.desligarEventos
  }

  destruir() {
    this.parada = true
    this.cancelarTimer()
    this.desligarEventos?.()
    this.ouvintes.clear()
  }

  /** Chamado pelos eventos online/offline (ou pelo teste). */
  definirOnline(online: boolean) {
    if (this.online === online) {
      if (online) void this.sincronizar()
      return
    }
    this.online = online
    if (!online) {
      this.cancelarTimer()
      this.proximaTentativaEm = null
      this.atualizar()
      return
    }
    // Voltou a rede: zera o recuo e tenta já.
    this.falhasSeguidas = 0
    this.erro = null
    this.atualizar()
    void this.sincronizar()
  }

  // ---------- entrada de eventos ----------

  /**
   * Põe o evento na fila local (persistida) e dispara o envio. Resolve quando o evento está gravado,
   * sem esperar a rede: o placar nunca depende dela (G1). O mesmo `clientEventId` não entra duas vezes (G3).
   */
  async enfileirar(evento: EventoNovo): Promise<ItemFila | null> {
    await this.iniciar()
    const id = evento.clientEventId ?? (this.o.gerarId ?? gerarUuidPadrao)()
    if (this.dados.itens.some((i) => i.clientEventId === id) || this.dados.pendencias.some((p) => p.clientEventId === id)) {
      return null
    }
    const item: ItemFila = {
      clientEventId: id,
      seqLocal: this.dados.proximoSeqLocal++,
      tipo: evento.tipo,
      payload: evento.payload ?? {},
      ...(evento.desfazId !== undefined ? { desfazId: evento.desfazId } : {}),
      ocorridoEm: new Date((this.o.agora ?? Date.now)()).toISOString(),
      tentativas: 0,
    }
    this.dados.itens.push(item)
    await this.persistir()
    this.atualizar()
    this.agendarAgora()
    return { ...item }
  }

  /** O apontador resolveu a pendência (corrigiu ou descartou). */
  async resolverPendencia(clientEventId: string) {
    await this.iniciar()
    this.dados.pendencias = this.dados.pendencias.filter((p) => p.clientEventId !== clientEventId)
    await this.persistir()
    this.atualizar()
  }

  /** Reativa o envio após erro que parou a fila (ex.: sessão expirada e novo login, G9). */
  retomar() {
    this.erro = null
    this.falhasSeguidas = 0
    this.parada = false
    this.atualizar()
    void this.sincronizar()
  }

  // ---------- envio ----------

  /** Um ciclo de envio. Chamadas simultâneas compartilham o mesmo ciclo (nada de envio paralelo). */
  sincronizar(): Promise<void> {
    if (this.ciclo) return this.ciclo
    this.ciclo = this.executarCiclo().finally(() => {
      this.ciclo = null
      this.sincronizando = false
      this.enviando = 0
      this.atualizar()
      // Evento que chegou no instante em que o ciclo terminava não pode ficar sem envio.
      if (this.dados.itens.length > 0 && this.timer === null && !this.erro && !this.modoLocal) this.agendarAgora()
    })
    return this.ciclo
  }

  private async executarCiclo(): Promise<void> {
    await this.iniciar()
    if (this.parada || !this.lerOnline() || this.dados.itens.length === 0) {
      this.online = this.lerOnline()
      return
    }
    this.online = true
    this.cancelarTimer()
    this.sincronizando = true
    let conflitos = 0
    const doFetch = this.o.fetchImpl ?? (typeof fetch !== 'undefined' ? fetch : undefined)
    if (!doFetch) return

    while (this.dados.itens.length > 0 && !this.parada) {
      const lote = this.dados.itens.slice(0, this.tamanhoLoteAtual)
      this.enviando = lote.length
      this.atualizar()
      let resposta: Response
      try {
        resposta = await doFetch(this.o.url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({
            seqEsperado: this.dados.seqServidor,
            eventos: lote.map((i) => ({
              clientEventId: i.clientEventId,
              tipo: i.tipo,
              payload: i.payload,
              ...(i.desfazId !== undefined ? { desfazId: i.desfazId } : {}),
              ocorridoEm: i.ocorridoEm,
            })),
          }),
        })
      } catch {
        // Falha de rede: mantém tudo, não mostra erro (o indicador mostra "sem conexão").
        this.online = this.lerOnline()
        await this.registrarTentativa(lote)
        this.agendarRecuo()
        return
      }

      const corpo = await this.lerJson(resposta)
      const status = resposta.status

      if (status === 200) {
        this.modoLocal = false
        this.erro = null
        this.falhasSeguidas = 0
        this.proximaTentativaEm = null
        const d = corpo?.data ?? {}
        const progresso = await this.aplicarProcessado(lote, d.aceitos ?? [], d.rejeitados ?? [], d.estado ?? null)
        if (!progresso) {
          // Resposta sem aceitar nem rejeitar nada: evita laço; tenta de novo com recuo.
          await this.registrarTentativa(lote)
          this.erro = 'Não foi possível sincronizar agora. Tentaremos de novo.'
          this.agendarRecuo()
          return
        }
        this.tamanhoLoteAtual = Math.min(this.o.tamanhoLote, TAMANHO_LOTE_PADRAO)
        continue
      }

      if (status === 409) {
        const det = corpo?.details ?? {}
        const seqAtual = Number(det.seqAtual ?? det.estado?.ultimoSeq ?? this.dados.seqServidor)
        await this.reconciliar(lote, det.aceitos ?? [], det.estado ?? null, seqAtual)
        conflitos++
        if (conflitos > this.o.maxConflitosPorCiclo) {
          this.erro = 'A súmula mudou em outro aparelho. Confira o placar.'
          this.atualizar()
          this.agendarRecuo()
          return
        }
        continue
      }

      if (status === 404 || status === 503) {
        // Rota desligada/indisponível: segue em modo local, sem erro ao usuário.
        this.modoLocal = true
        this.erro = null
        await this.registrarTentativa(lote)
        this.falhasSeguidas++
        this.agendarEm(this.o.recuoModoLocalMs)
        return
      }

      if (status === 401 || status === 403) {
        // Sessão expirada (G9): para sem perder nada; `retomar()` depois do novo login.
        this.erro = 'Sessão expirada. Entre de novo para sincronizar.'
        this.parada = true
        return
      }

      if (status === 422) {
        if (lote.length > 1) {
          this.tamanhoLoteAtual = 1 // isola o evento problemático
          continue
        }
        const msg = typeof corpo?.error === 'string' ? corpo.error : 'Evento inválido.'
        await this.moverParaPendencia(lote[0], 'RG-LOG-011', msg)
        this.tamanhoLoteAtual = Math.min(this.o.tamanhoLote, TAMANHO_LOTE_PADRAO)
        continue
      }

      // 5xx e demais: erro do servidor, tenta de novo com recuo.
      this.erro = 'Não foi possível sincronizar agora. Tentaremos de novo.'
      await this.registrarTentativa(lote)
      this.agendarRecuo()
      return
    }
  }

  private async aplicarProcessado(lote: ItemFila[], aceitos: AceitoServidor[], rejeitados: RejeitadoServidor[], estado: EstadoSumula | null): Promise<boolean> {
    const idsAceitos = new Set(aceitos.map((a) => a.clientEventId))
    let maiorSeq = this.dados.seqServidor
    for (const a of aceitos) if (typeof a.seq === 'number') maiorSeq = Math.max(maiorSeq, a.seq)
    const porId = new Map(lote.map((i) => [i.clientEventId, i]))
    for (const r of rejeitados) {
      if (r.naoProcessado) continue // fica na fila; o servidor nem avaliou
      const item = porId.get(r.clientEventId)
      if (!item) continue
      this.dados.pendencias.push(this.paraPendencia(item, r.codigo, r.mensagem))
      idsAceitos.add(r.clientEventId) // sai da fila
    }
    this.dados.itens = this.dados.itens.filter((i) => !idsAceitos.has(i.clientEventId))
    if (estado) {
      this.estadoServidor = estado
      maiorSeq = Math.max(maiorSeq, Number(estado.ultimoSeq) || 0)
    }
    this.dados.seqServidor = maiorSeq
    await this.persistir()
    this.atualizar()
    return idsAceitos.size > 0
  }

  /** 409: o servidor tem eventos que não conhecemos. Absorve o que ele aceitou e reenvia com o seq novo. */
  private async reconciliar(lote: ItemFila[], aceitos: AceitoServidor[], estado: EstadoSumula | null, seqAtual: number) {
    const ids = new Set(aceitos.map((a) => a.clientEventId))
    this.dados.itens = this.dados.itens.filter((i) => !ids.has(i.clientEventId))
    this.dados.seqServidor = Number.isFinite(seqAtual) ? seqAtual : this.dados.seqServidor
    if (estado) this.estadoServidor = estado
    const conflito: ConflitoRegistrado = { em: new Date((this.o.agora ?? Date.now)()).toISOString(), seqAtual: this.dados.seqServidor }
    this.dados.ultimoConflito = conflito
    await this.registrarTentativa(lote.filter((i) => !ids.has(i.clientEventId)), false)
    await this.persistir()
    this.atualizar()
  }

  private async moverParaPendencia(item: ItemFila, codigo: string, mensagem: string) {
    this.dados.pendencias.push(this.paraPendencia(item, codigo, mensagem))
    this.dados.itens = this.dados.itens.filter((i) => i.clientEventId !== item.clientEventId)
    await this.persistir()
    this.atualizar()
  }

  private paraPendencia(item: ItemFila, codigo: string, mensagem: string): Pendencia {
    return {
      clientEventId: item.clientEventId,
      seqLocal: item.seqLocal,
      tipo: item.tipo,
      payload: item.payload,
      codigo,
      mensagem,
      em: new Date((this.o.agora ?? Date.now)()).toISOString(),
    }
  }

  private async registrarTentativa(lote: ItemFila[], persistir = true) {
    const ids = new Set(lote.map((i) => i.clientEventId))
    for (const i of this.dados.itens) if (ids.has(i.clientEventId)) i.tentativas++
    if (persistir) await this.persistir()
  }

  // ---------- agendamento ----------

  private agendarRecuo() {
    this.falhasSeguidas++
    if (!this.lerOnline()) {
      this.proximaTentativaEm = null
      return
    }
    this.agendarEm(calcularRecuo(this.falhasSeguidas, this.o.recuoBaseMs, this.o.recuoMaxMs, this.o.aleatorio ?? Math.random))
  }

  private agendarAgora() {
    if (this.parada || this.ciclo || !this.lerOnline()) return
    this.agendarEm(0)
  }

  private agendarEm(ms: number) {
    if (this.parada) return
    this.cancelarTimer()
    const agendar = this.o.agendar ?? ((fn, t) => setTimeout(fn, t))
    this.proximaTentativaEm = (this.o.agora ?? Date.now)() + ms
    this.timer = agendar(() => {
      this.timer = null
      this.proximaTentativaEm = null
      void this.sincronizar()
    }, ms)
    this.atualizar()
  }

  private cancelarTimer() {
    if (this.timer === null) return
    const cancelar = this.o.cancelar ?? ((h) => clearTimeout(h as ReturnType<typeof setTimeout>))
    cancelar(this.timer)
    this.timer = null
  }

  // ---------- internos ----------

  private lerOnline(): boolean {
    if (this.o.estaOnline) return this.o.estaOnline()
    return typeof navigator === 'undefined' ? true : navigator.onLine !== false
  }

  private async lerJson(resposta: Response): Promise<any> {
    try {
      return await resposta.json()
    } catch {
      return null
    }
  }

  private persistir(): Promise<void> {
    const texto = JSON.stringify(this.dados)
    this.gravacao = this.gravacao
      .catch(() => {})
      .then(() => this.o.armazenamento.salvar(chaveDaFila(this.o.token), texto))
      .catch(() => {
        // Sem espaço/permissão: a fila segue em memória nesta sessão.
      })
    return this.gravacao
  }

  private status(): StatusConexao {
    if (this.erro) return 'erro'
    if (!this.online) return 'offline'
    if (this.sincronizando && this.dados.itens.length > 0) return 'sincronizando'
    if (this.dados.itens.length > 0) return 'pendente'
    return 'online'
  }

  private montarSnapshot(): SnapshotFila {
    return {
      status: this.status(),
      online: this.online,
      modoLocal: this.modoLocal,
      pendentes: this.dados.itens.length,
      enviando: this.enviando,
      pendencias: [...this.dados.pendencias],
      seqServidor: this.dados.seqServidor,
      estadoServidor: this.estadoServidor,
      ultimoConflito: this.dados.ultimoConflito,
      erro: this.erro,
      proximaTentativaEm: this.proximaTentativaEm,
    }
  }

  private atualizar() {
    this.snapshot = this.montarSnapshot()
    this.ouvintes.forEach((o) => o())
  }
}
