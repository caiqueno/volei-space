/**
 * Adaptador PURO entre a tela da súmula (lancar/page.tsx) e a fila offline de eventos (src/lib/sumula-offline).
 *
 * MODO SOMBRA: a tela continua gravando por PUT /api/sumula/[token]. Quando (e só quando)
 * NEXT_PUBLIC_SUMULA_EVENTOS_ATIVO === '1', cada ocorrência que a tela já registra também vira um evento do motor
 * (src/lib/regras-volei/eventos.ts) e entra na fila, que sincroniza com POST /api/sumula/[token]/eventos.
 *
 * Garantias:
 *  - nada aqui lança exceção para a tela: toda falha vira "descartado" com motivo (e um log discreto);
 *  - o payload é validado com o MESMO schema do servidor (PAYLOAD_POR_TIPO), então só sai o que a rota aceitaria;
 *  - o desfazer da tela vira DESFAZ por referência (clientEventId do evento original), na ordem inversa.
 */
import { PAYLOAD_POR_TIPO } from '@/lib/sumula-eventos/esquema'
import type { CategoriaSancao } from '@/lib/regras-volei'
import type { EventoNovo } from '@/lib/sumula-offline/tipos'

export type LadoTela = 'teamA' | 'teamB'
type EquipeMotor = 'A' | 'B'

/** Só o valor exato '1' liga a fila. Qualquer outra coisa (ausente, '0', 'true') mantém tudo desligado. */
export function filaDaSumulaAtiva(valor: string | undefined | null): boolean {
  return valor === '1'
}

/** Leitura da flag de build. O acesso literal a `process.env.NEXT_PUBLIC_*` é o que o Next inlina no cliente. */
export function filaAtivaNoBuild(): boolean {
  return filaDaSumulaAtiva(process.env.NEXT_PUBLIC_SUMULA_EVENTOS_ATIVO)
}

export type Ocorrencia =
  | { tipo: 'PONTO'; telaId: string; equipe: LadoTela; sacadorId?: number | null }
  | {
      tipo: 'SET_INICIADO'
      telaId?: string
      numeroSet: number
      /** Ids dos 6 titulares por posição; `null` = camisa sem atleta conhecido (a tradução é descartada). */
      formacaoA: Array<number | null | undefined>
      formacaoB: Array<number | null | undefined>
      saqueInicial: LadoTela
      liberosA?: Array<number | null | undefined>
      liberosB?: Array<number | null | undefined>
    }
  | { tipo: 'TEMPO'; telaId?: string; equipe: LadoTela }
  | {
      tipo: 'SUBSTITUICAO'
      telaId: string
      equipe: LadoTela
      saiId: number | null | undefined
      entraId: number | null | undefined
      excepcional?: boolean
      motivo?: 'LESAO' | 'DOENCA' | 'EXPULSAO' | 'DESQUALIFICACAO'
    }
  | { tipo: 'TROCA_LIBERO'; telaId: string; equipe: LadoTela; saiId: number | null | undefined; entraId: number | null | undefined }
  | {
      tipo: 'SANCAO'
      telaId: string
      equipe: LadoTela
      categoria: CategoriaSancao
      jogadorId?: number | null
      /** Quando não há jogador: 'TECNICO' ou 'EQUIPE'. */
      membro?: 'TECNICO' | 'EQUIPE'
      entreSets?: boolean
    }
  | { tipo: 'TROCA_LADO'; telaId?: string }
  | { tipo: 'WO'; telaId?: string; ausente: LadoTela | 'AMBAS' }
  | { tipo: 'SET_ANULADO'; telaId?: string; motivo?: string }
  | { tipo: 'OBSERVACAO'; telaId?: string; texto: string }
  /** Desfazer da tela: ids (da tela) dos registros removidos. */
  | { tipo: 'DESFAZ'; telaIds: string[] }

export type Traducao = { ok: true; eventos: EventoNovo[] } | { ok: false; motivo: string }

const equipeMotor = (lado: LadoTela): EquipeMotor => (lado === 'teamA' ? 'A' : 'B')

const idValido = (id: unknown): id is number => typeof id === 'number' && Number.isInteger(id) && id > 0

/** Gera um UUID v4 (o servidor exige UUID em `clientEventId`). */
export function gerarClientEventId(): string {
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

/**
 * Livro do espelho: lembra qual clientEventId corresponde a cada registro da tela, na ordem em que entraram,
 * para o desfazer da tela virar DESFAZ do evento certo (do mais novo para o mais antigo, como o motor exige).
 */
export class LivroEspelho {
  private readonly porTela = new Map<string, string>()
  private readonly ordem: string[] = []

  registrar(telaId: string, clientEventId: string) {
    if (this.porTela.has(telaId)) return
    this.porTela.set(telaId, clientEventId)
    this.ordem.push(telaId)
  }

  /** Remove do livro e devolve os clientEventId a desfazer, do mais novo para o mais antigo. Ids desconhecidos são ignorados. */
  retirar(telaIds: readonly string[]): string[] {
    const alvos = new Set(telaIds.filter((id) => this.porTela.has(id)))
    const resultado: string[] = []
    for (let i = this.ordem.length - 1; i >= 0; i--) {
      const id = this.ordem[i]
      if (!alvos.has(id)) continue
      resultado.push(this.porTela.get(id) as string)
      this.porTela.delete(id)
      this.ordem.splice(i, 1)
    }
    return resultado
  }

  get tamanho() {
    return this.porTela.size
  }
}

function validar(tipo: keyof typeof PAYLOAD_POR_TIPO, bruto: Record<string, unknown>): { ok: true; payload: Record<string, unknown> } | { ok: false; motivo: string } {
  const r = PAYLOAD_POR_TIPO[tipo].safeParse(bruto)
  if (!r.success) {
    const primeira = r.error.issues[0]
    return { ok: false, motivo: `${tipo}: ${primeira?.path.join('.') || 'payload'} ${primeira?.message ?? 'inválido'}` }
  }
  return { ok: true, payload: r.data as Record<string, unknown> }
}

function formacaoCompleta(lista: Array<number | null | undefined>): number[] | null {
  if (lista.length !== 6 || !lista.every(idValido)) return null
  return lista as number[]
}

function liberosValidos(lista: Array<number | null | undefined> | undefined): number[] | undefined {
  if (!lista) return undefined
  const ids = lista.filter(idValido)
  return ids.length > 0 ? ids : undefined
}

function montar(tipo: keyof typeof PAYLOAD_POR_TIPO, bruto: Record<string, unknown>, clientEventId: string): Traducao {
  const v = validar(tipo, bruto)
  if (!v.ok) return v
  return { ok: true, eventos: [{ clientEventId, tipo, payload: v.payload }] }
}

/**
 * Traduz uma ocorrência da tela em eventos do motor. Nunca lança.
 * `gerarId` é injetável (teste); `livro` só é necessário para DESFAZ e é atualizado pelo chamador via `registrarNoLivro`.
 */
export function traduzirOcorrencia(o: Ocorrencia, livro: LivroEspelho, gerarId: () => string = gerarClientEventId): Traducao {
  try {
    const id = gerarId()
    switch (o.tipo) {
      case 'PONTO': {
        const bruto: Record<string, unknown> = { equipe: equipeMotor(o.equipe) }
        if (idValido(o.sacadorId)) bruto.sacador = o.sacadorId
        return montar('PONTO', bruto, id)
      }
      case 'SET_INICIADO': {
        const formacaoA = formacaoCompleta(o.formacaoA)
        const formacaoB = formacaoCompleta(o.formacaoB)
        if (!formacaoA || !formacaoB) return { ok: false, motivo: 'SET_INICIADO: formação incompleta ou com atleta desconhecido.' }
        const bruto: Record<string, unknown> = { numeroSet: o.numeroSet, formacaoA, formacaoB, saqueInicial: equipeMotor(o.saqueInicial) }
        const liberosA = liberosValidos(o.liberosA)
        const liberosB = liberosValidos(o.liberosB)
        if (liberosA) bruto.liberosA = liberosA
        if (liberosB) bruto.liberosB = liberosB
        return montar('SET_INICIADO', bruto, id)
      }
      case 'TEMPO':
        return montar('TEMPO', { equipe: equipeMotor(o.equipe) }, id)
      case 'SUBSTITUICAO': {
        if (!idValido(o.saiId) || !idValido(o.entraId)) return { ok: false, motivo: 'SUBSTITUICAO: atleta que sai ou entra desconhecido.' }
        const bruto: Record<string, unknown> = { equipe: equipeMotor(o.equipe), sai: o.saiId, entra: o.entraId }
        if (o.excepcional) {
          bruto.excepcional = true
          if (o.motivo) bruto.motivo = o.motivo
        }
        return montar('SUBSTITUICAO', bruto, id)
      }
      case 'TROCA_LIBERO': {
        if (!idValido(o.saiId) || !idValido(o.entraId)) return { ok: false, motivo: 'TROCA_LIBERO: atleta que sai ou entra desconhecido.' }
        return montar('TROCA_LIBERO', { equipe: equipeMotor(o.equipe), sai: o.saiId, entra: o.entraId }, id)
      }
      case 'SANCAO': {
        const membro = idValido(o.jogadorId) ? `J:${o.jogadorId}` : o.membro === 'TECNICO' ? 'TECNICO' : 'EQUIPE'
        const bruto: Record<string, unknown> = { equipe: equipeMotor(o.equipe), membro, categoria: o.categoria }
        if (o.entreSets) bruto.entreSets = true
        return montar('SANCAO', bruto, id)
      }
      case 'TROCA_LADO':
        return montar('TROCA_LADO', {}, id)
      case 'WO':
        return montar('WO', { ausente: o.ausente === 'AMBAS' ? 'AMBAS' : equipeMotor(o.ausente) }, id)
      case 'SET_ANULADO':
        return montar('SET_ANULADO', o.motivo ? { motivo: o.motivo.slice(0, 200) } : {}, id)
      case 'OBSERVACAO': {
        const texto = o.texto.trim().slice(0, 500)
        if (!texto) return { ok: false, motivo: 'OBSERVACAO: texto vazio.' }
        return montar('OBSERVACAO', { texto }, id)
      }
      case 'DESFAZ': {
        const alvos = livro.retirar(o.telaIds)
        if (alvos.length === 0) return { ok: false, motivo: 'DESFAZ: nenhum dos registros desfeitos tinha ido para a fila.' }
        return {
          ok: true,
          eventos: alvos.map((alvo, indice) => ({
            clientEventId: indice === 0 ? id : gerarId(),
            tipo: 'DESFAZ' as const,
            payload: {},
            desfazClientEventId: alvo,
          })),
        }
      }
      default:
        return { ok: false, motivo: 'Tipo de ocorrência desconhecido.' }
    }
  } catch (erro) {
    return { ok: false, motivo: `Falha ao traduzir: ${erro instanceof Error ? erro.message : 'erro desconhecido'}.` }
  }
}

/** Id da tela de uma ocorrência (para o livro), quando ela pode ser desfeita depois. */
export function telaIdDaOcorrencia(o: Ocorrencia): string | null {
  return o.tipo !== 'DESFAZ' && 'telaId' in o && typeof o.telaId === 'string' ? o.telaId : null
}

export interface DestinoEspelho {
  enfileirar(evento: EventoNovo): Promise<unknown>
}

/**
 * Traduz e enfileira SEM nunca propagar erro. Devolve se algo entrou na fila.
 * Falha de tradução ou de fila: evento descartado e `aoDescartar` (log discreto) chamado com o motivo.
 */
export function espelharOcorrencia(
  destino: DestinoEspelho,
  livro: LivroEspelho,
  o: Ocorrencia,
  aoDescartar: (motivo: string) => void = () => undefined,
  gerarId: () => string = gerarClientEventId,
): boolean {
  try {
    const t = traduzirOcorrencia(o, livro, gerarId)
    if (!t.ok) {
      aoDescartar(t.motivo)
      return false
    }
    const telaId = telaIdDaOcorrencia(o)
    t.eventos.forEach((evento, indice) => {
      if (telaId && indice === 0 && evento.clientEventId) livro.registrar(telaId, evento.clientEventId)
      // `enfileirar` é assíncrono: a rejeição também não pode escapar.
      // Chamada síncrona (preserva a ordem dos eventos); o resultado assíncrono é tratado à parte.
      Promise.resolve(destino.enfileirar(evento))
        .catch((erro: unknown) => aoDescartar(`Fila recusou o evento: ${erro instanceof Error ? erro.message : 'erro desconhecido'}.`))
    })
    return true
  } catch (erro) {
    try {
      aoDescartar(`Falha ao espelhar: ${erro instanceof Error ? erro.message : 'erro desconhecido'}.`)
    } catch {
      // O próprio log não pode quebrar a tela.
    }
    return false
  }
}
