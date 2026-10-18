type Balde = { contagem: number; reiniciaEm: number }

const baldes = new Map<string, Balde>()
const LIMITE_BALDES = 5000

export type ResultadoCota = { permitido: boolean; retryAfterSeconds: number }

function limparExpirados(agora: number) {
  if (baldes.size < LIMITE_BALDES) return
  const expiradas: string[] = []
  baldes.forEach((balde, chave) => {
    if (balde.reiniciaEm <= agora) expiradas.push(chave)
  })
  expiradas.forEach((chave) => baldes.delete(chave))
}

export function consumirCota(chave: string, limite: number, janelaMs: number, agora = Date.now()): ResultadoCota {
  limparExpirados(agora)
  const atual = baldes.get(chave)
  if (!atual || atual.reiniciaEm <= agora) {
    baldes.set(chave, { contagem: 1, reiniciaEm: agora + janelaMs })
    return { permitido: true, retryAfterSeconds: 0 }
  }
  if (atual.contagem >= limite) {
    return { permitido: false, retryAfterSeconds: Math.max(1, Math.ceil((atual.reiniciaEm - agora) / 1000)) }
  }
  atual.contagem += 1
  return { permitido: true, retryAfterSeconds: 0 }
}

export function consumirLimite(chave: string, limite: number, janelaMs: number, agora = Date.now()) {
  const cota = consumirCota(chave, limite, janelaMs, agora)
  return { ok: cota.permitido, retryAfterSeconds: cota.retryAfterSeconds }
}

/**
 * IP do cliente para limites. Prefere os cabeçalhos definidos pela infraestrutura
 * (`x-vercel-forwarded-for`, `x-real-ip`), que o cliente não consegue forjar atrás do proxy,
 * e só então o primeiro item de `x-forwarded-for` (que o cliente pode preencher).
 */
export function ipDaRequisicao(req: { headers: { get(nome: string): string | null } }) {
  const vercel = req.headers.get('x-vercel-forwarded-for')?.split(',')[0]?.trim()
  const real = req.headers.get('x-real-ip')?.trim()
  const encaminhado = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  return (vercel || real || encaminhado || 'desconhecido').slice(0, 80)
}

/** Zera as cotas em memória e o store assíncrono padrão (os testes usam para isolar casos). */
export function reiniciarCotas() {
  baldes.clear()
  storePadrao = null
}

export function limparLimites() {
  baldes.clear()
  storePadrao = null
}

// ---------------------------------------------------------------------------
// Store do limitador (B2). A memória segue como padrão e como fallback; o
// store do Supabase usa a tabela "RateLimit"(chave, contagem, expiraEm) e só
// vale quando a tabela existe. Sem tabela, cai para memória sem quebrar o login.
// ---------------------------------------------------------------------------

export type ConsultaCota = { contagem: number; retryAfterSeconds: number }

export interface RateLimitStore {
  /** Conta uma ocorrência na janela e informa se ainda cabe no limite. */
  consumir(chave: string, limite: number, janelaMs: number, agora?: number): Promise<ResultadoCota>
  /** Lê a contagem atual sem contar uma ocorrência. */
  consultar(chave: string, agora?: number): Promise<ConsultaCota>
  /** Zera a chave (ex.: login correto limpa as falhas do e-mail). */
  zerar(chave: string): Promise<void>
}

export class MemoryRateLimitStore implements RateLimitStore {
  private readonly mapa = new Map<string, Balde>()

  async consumir(chave: string, limite: number, janelaMs: number, agora = Date.now()): Promise<ResultadoCota> {
    if (this.mapa.size >= LIMITE_BALDES) {
      this.mapa.forEach((balde, k) => {
        if (balde.reiniciaEm <= agora) this.mapa.delete(k)
      })
    }
    const atual = this.mapa.get(chave)
    if (!atual || atual.reiniciaEm <= agora) {
      this.mapa.set(chave, { contagem: 1, reiniciaEm: agora + janelaMs })
      return { permitido: true, retryAfterSeconds: 0 }
    }
    if (atual.contagem >= limite) {
      return { permitido: false, retryAfterSeconds: Math.max(1, Math.ceil((atual.reiniciaEm - agora) / 1000)) }
    }
    atual.contagem += 1
    return { permitido: true, retryAfterSeconds: 0 }
  }

  async consultar(chave: string, agora = Date.now()): Promise<ConsultaCota> {
    const atual = this.mapa.get(chave)
    if (!atual || atual.reiniciaEm <= agora) return { contagem: 0, retryAfterSeconds: 0 }
    return { contagem: atual.contagem, retryAfterSeconds: Math.max(1, Math.ceil((atual.reiniciaEm - agora) / 1000)) }
  }

  async zerar(chave: string): Promise<void> {
    this.mapa.delete(chave)
  }
}

type ClienteRateLimit = {
  from(tabela: string): any
}

const TABELA = 'RateLimit'

export class SupabaseRateLimitStore implements RateLimitStore {
  constructor(private readonly cliente: ClienteRateLimit) {}

  private tabela() {
    return this.cliente.from(TABELA)
  }

  private async ler(chave: string): Promise<{ contagem: number; expiraEm: number } | null> {
    const { data, error: erro } = await this.tabela().select('contagem,expiraEm').eq('chave', chave).maybeSingle()
    if (erro) throw erro
    if (!data) return null
    const expiraEm = new Date(String(data.expiraEm)).getTime()
    return { contagem: Number(data.contagem) || 0, expiraEm: Number.isNaN(expiraEm) ? 0 : expiraEm }
  }

  async consumir(chave: string, limite: number, janelaMs: number, agora = Date.now()): Promise<ResultadoCota> {
    for (let tentativa = 0; tentativa < 3; tentativa += 1) {
      const atual = await this.ler(chave)
      if (!atual || atual.expiraEm <= agora) {
        const { error: erro } = await this.tabela().upsert(
          { chave, contagem: 1, expiraEm: new Date(agora + janelaMs).toISOString() },
          { onConflict: 'chave' },
        )
        if (erro) throw erro
        return { permitido: true, retryAfterSeconds: 0 }
      }
      if (atual.contagem >= limite) {
        return { permitido: false, retryAfterSeconds: Math.max(1, Math.ceil((atual.expiraEm - agora) / 1000)) }
      }
      // Compara e troca: só soma se ninguém alterou a contagem desde a leitura.
      const { data, error: erro } = await this.tabela()
        .update({ contagem: atual.contagem + 1 })
        .eq('chave', chave)
        .eq('contagem', atual.contagem)
        .select('chave')
      if (erro) throw erro
      if (Array.isArray(data) && data.length > 0) return { permitido: true, retryAfterSeconds: 0 }
    }
    // Disputa persistente: trata como excesso em vez de deixar passar.
    return { permitido: false, retryAfterSeconds: 1 }
  }

  async consultar(chave: string, agora = Date.now()): Promise<ConsultaCota> {
    const atual = await this.ler(chave)
    if (!atual || atual.expiraEm <= agora) return { contagem: 0, retryAfterSeconds: 0 }
    return { contagem: atual.contagem, retryAfterSeconds: Math.max(1, Math.ceil((atual.expiraEm - agora) / 1000)) }
  }

  async zerar(chave: string): Promise<void> {
    const { error: erro } = await this.tabela().delete().eq('chave', chave)
    if (erro) throw erro
  }
}

const REPETIR_PRINCIPAL_APOS_MS = 5 * 60 * 1000

/**
 * Tenta o store principal e, se ele falhar (tabela ausente, rede), usa a
 * memória. Depois de uma falha o principal fica de lado por alguns minutos.
 */
export class RateLimitStoreComFallback implements RateLimitStore {
  private indisponivelAte = 0

  constructor(
    private readonly principal: RateLimitStore | null,
    private readonly reserva: RateLimitStore = new MemoryRateLimitStore(),
    private readonly relogio: () => number = Date.now,
  ) {}

  private async tentar<T>(operacao: (store: RateLimitStore) => Promise<T>): Promise<T> {
    if (this.principal && this.relogio() >= this.indisponivelAte) {
      try {
        return await operacao(this.principal)
      } catch (err) {
        this.indisponivelAte = this.relogio() + REPETIR_PRINCIPAL_APOS_MS
        const mensagem = err instanceof Error ? err.message : (err as { message?: string } | null)?.message
        console.warn('[rate-limit] store do Supabase indisponível; usando memória.', mensagem ?? '')
      }
    }
    return operacao(this.reserva)
  }

  consumir(chave: string, limite: number, janelaMs: number, agora?: number) {
    return this.tentar((s) => s.consumir(chave, limite, janelaMs, agora))
  }

  consultar(chave: string, agora?: number) {
    return this.tentar((s) => s.consultar(chave, agora))
  }

  zerar(chave: string) {
    return this.tentar((s) => s.zerar(chave))
  }
}

let storePadrao: RateLimitStore | null = null
let storeDeTeste: RateLimitStore | null = null

async function obterStore(): Promise<RateLimitStore> {
  if (storeDeTeste) return storeDeTeste
  if (storePadrao) return storePadrao
  let principal: RateLimitStore | null = null
  try {
    const { supabaseAdmin, isSupabaseServiceConfigured } = await import('@/lib/supabase-admin')
    if (isSupabaseServiceConfigured) principal = new SupabaseRateLimitStore(supabaseAdmin)
  } catch {
    principal = null
  }
  storePadrao = new RateLimitStoreComFallback(principal)
  return storePadrao
}

/** Só para testes: troca o store usado pelas funções assíncronas. */
export function definirStoreDeRateLimit(store: RateLimitStore | null) {
  storeDeTeste = store
  storePadrao = null
}

export type OpcoesLimite = { limite: number; janelaMs: number }

/** Conta uma ocorrência e responde se ainda cabe. */
export async function checkRateLimit(chave: string, opcoes: OpcoesLimite, agora = Date.now()): Promise<ResultadoCota> {
  return (await obterStore()).consumir(chave, opcoes.limite, opcoes.janelaMs, agora)
}

/** Informa se a chave já estourou o limite, sem contar uma nova ocorrência. */
export async function limiteEsgotado(chave: string, limite: number, agora = Date.now()): Promise<ResultadoCota> {
  const { contagem, retryAfterSeconds } = await (await obterStore()).consultar(chave, agora)
  return contagem >= limite ? { permitido: false, retryAfterSeconds } : { permitido: true, retryAfterSeconds: 0 }
}

export async function zerarLimite(chave: string): Promise<void> {
  await (await obterStore()).zerar(chave)
}

// ---------------------------------------------------------------------------
// Limitador assíncrono para rotas por token e públicas (R13). Usa o store
// persistente (Supabase) com fallback para memória; se o próprio limitador
// falhar, a política decide: leitura pública segue (falha-aberto) e
// escrita/aceite é recusada (falha-fechado). Nunca lança.
// ---------------------------------------------------------------------------

export type ModoFalhaLimite = 'ABERTO' | 'FECHADO'
export type ResultadoLimite = { ok: boolean; retryAfterSeconds: number; indisponivel?: boolean }

/** Leitura (GET/HEAD/OPTIONS) falha aberto; qualquer escrita falha fechado. */
export function modoDeFalhaDoMetodo(metodo: string | null | undefined): ModoFalhaLimite {
  const m = String(metodo ?? 'GET').toUpperCase()
  return m === 'GET' || m === 'HEAD' || m === 'OPTIONS' ? 'ABERTO' : 'FECHADO'
}

export async function consumirLimiteAsync(
  chave: string,
  limite: number,
  janelaMs: number,
  modoFalha: ModoFalhaLimite,
  agora = Date.now(),
): Promise<ResultadoLimite> {
  try {
    const cota = await checkRateLimit(chave, { limite, janelaMs }, agora)
    return { ok: cota.permitido, retryAfterSeconds: cota.retryAfterSeconds }
  } catch (err) {
    const mensagem = err instanceof Error ? err.message : ''
    console.warn('[rate-limit] limitador indisponível.', mensagem)
    return modoFalha === 'ABERTO'
      ? { ok: true, retryAfterSeconds: 0, indisponivel: true }
      : { ok: false, retryAfterSeconds: 5, indisponivel: true }
  }
}
