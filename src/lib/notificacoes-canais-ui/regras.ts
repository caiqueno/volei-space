// Regras puras das preferências de notificação por canal e do push neste aparelho. Sem React, sem rede.
// Tudo atrás de NEXT_PUBLIC_NOTIFICACOES_MULTICANAL_ATIVO. Desligada = tela de notificações atual idêntica.

export type Canal = 'EMAIL' | 'WHATSAPP' | 'PUSH'

export const CANAIS: ReadonlyArray<{ canal: Canal; rotulo: string; explicacao: string }> = [
  { canal: 'EMAIL', rotulo: 'E-mail', explicacao: 'Chega na sua caixa de entrada. Bom para resumos e avisos que você quer guardar.' },
  { canal: 'WHATSAPP', rotulo: 'WhatsApp', explicacao: 'Chega no seu WhatsApp, só com avisos importantes, como resposta do organizador e jogos.' },
  { canal: 'PUSH', rotulo: 'Aviso no aparelho', explicacao: 'Aparece na tela deste celular ou computador, mesmo com o site fechado. Precisa ser ativado em cada aparelho.' },
]

export const TIPOS_PADRAO: ReadonlyArray<{ tipo: string; rotulo: string }> = [
  { tipo: 'INSCRICAO', rotulo: 'Inscrição do time (aprovada, recusada, pendência)' },
  { tipo: 'JOGO', rotulo: 'Jogos (horário, local e mudanças)' },
  { tipo: 'LEMBRETE', rotulo: 'Lembretes (prazos e papeleta)' },
]

export type Preferencia = { canal: Canal; tipo: string; ativo: boolean }

// ---------------------------------------------------------------- flag

export function notificacoesMulticanalAtivo(valor: string | undefined = process.env.NEXT_PUBLIC_NOTIFICACOES_MULTICANAL_ATIVO): boolean {
  return valor === '1'
}

// ---------------------------------------------------------------- preferências

export function ehCanal(v: unknown): v is Canal {
  return v === 'EMAIL' || v === 'WHATSAPP' || v === 'PUSH'
}

export function normalizarPreferencias(dado: unknown): Preferencia[] {
  const bruto = Array.isArray(dado) ? dado : dado && typeof dado === 'object' && Array.isArray((dado as { itens?: unknown }).itens) ? (dado as { itens: unknown[] }).itens : []
  const vistos = new Set<string>()
  const lista: Preferencia[] = []
  for (const i of bruto) {
    const o = i && typeof i === 'object' ? (i as Record<string, unknown>) : {}
    if (!ehCanal(o.canal) || typeof o.tipo !== 'string' || !o.tipo.trim()) continue
    const chave = `${o.canal}:${o.tipo}`
    if (vistos.has(chave)) continue
    vistos.add(chave)
    lista.push({ canal: o.canal, tipo: o.tipo, ativo: o.ativo !== false })
  }
  return lista
}

/** Tipos que o servidor conhece; se não mandou nenhum, usa a lista padrão. */
export function tiposDisponiveis(prefs: Preferencia[]): { tipo: string; rotulo: string }[] {
  const conhecidos = new Map(TIPOS_PADRAO.map((t) => [t.tipo, t.rotulo]))
  const vistos = Array.from(new Set(prefs.map((p) => p.tipo)))
  if (vistos.length === 0) return [...TIPOS_PADRAO]
  return vistos.map((tipo) => ({ tipo, rotulo: conhecidos.get(tipo) ?? tipo.charAt(0) + tipo.slice(1).toLowerCase().replace(/_/g, ' ') }))
}

/** Sem registro salvo, o aviso vale como ligado (padrão do servidor). */
export function valorDaPreferencia(prefs: Preferencia[], canal: Canal, tipo: string): boolean {
  return prefs.find((p) => p.canal === canal && p.tipo === tipo)?.ativo ?? true
}

export function comPreferencia(prefs: Preferencia[], nova: Preferencia): Preferencia[] {
  const resto = prefs.filter((p) => !(p.canal === nova.canal && p.tipo === nova.tipo))
  return [...resto, nova]
}

export function rotuloCanal(canal: Canal): string {
  return CANAIS.find((c) => c.canal === canal)?.rotulo ?? canal
}

// ---------------------------------------------------------------- chave VAPID

/** Converte a chave pública VAPID (base64url) em bytes. Devolve null se for inválida. */
export function chaveVapidParaBytes(chave: string): Uint8Array | null {
  const limpa = (chave ?? '').trim()
  if (!limpa || !/^[A-Za-z0-9_-]+={0,2}$/.test(limpa)) return null
  const semPad = limpa.replace(/=+$/, '')
  if (semPad.length % 4 === 1) return null
  const b64 = semPad.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (semPad.length % 4)) % 4)
  let bin: string
  try {
    bin = atob(b64)
  } catch {
    return null
  }
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return bytes
}

/** Chave pública P-256 sem compressão: 65 bytes começando em 0x04. */
export function chaveVapidValida(chave: string): boolean {
  const b = chaveVapidParaBytes(chave)
  return b !== null && b.length === 65 && b[0] === 4
}

export function bytesParaBase64Url(buffer: ArrayBuffer | Uint8Array | null | undefined): string {
  if (!buffer) return ''
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer)
  let bin = ''
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

// ---------------------------------------------------------------- permissão e suporte

export type EstadoPush =
  | 'sem-suporte'
  | 'negada'
  | 'pronta'      // dá para pedir permissão (só após o clique)
  | 'ativa'       // permitido e assinado neste aparelho
  | 'concedida'   // permitido, mas sem assinatura neste aparelho

export type AmbientePush = {
  temServiceWorker: boolean
  temPushManager: boolean
  temNotification: boolean
  contextoSeguro: boolean
  permissao: 'default' | 'granted' | 'denied' | null
  assinado: boolean
}

export function suportaPush(a: Pick<AmbientePush, 'temServiceWorker' | 'temPushManager' | 'temNotification' | 'contextoSeguro'>): boolean {
  return a.contextoSeguro && a.temServiceWorker && a.temPushManager && a.temNotification
}

export function estadoDoPush(a: AmbientePush): EstadoPush {
  if (!suportaPush(a)) return 'sem-suporte'
  if (a.permissao === 'denied') return 'negada'
  if (a.permissao === 'granted') return a.assinado ? 'ativa' : 'concedida'
  return 'pronta'
}

export type TextoPush = { titulo: string; explicacao: string; botao: string | null; tom: 'info' | 'is-warning' | 'is-success' | 'is-error' }

export function textoDoPush(estado: EstadoPush): TextoPush {
  switch (estado) {
    case 'sem-suporte':
      return {
        titulo: 'Este navegador não recebe avisos no aparelho',
        explicacao: 'Use e-mail ou WhatsApp, ou abra o volei.space em um navegador mais novo (no iPhone, adicione o site à tela de início).',
        botao: null,
        tom: 'is-warning',
      }
    case 'negada':
      return {
        titulo: 'Os avisos estão bloqueados neste aparelho',
        explicacao: 'Você disse "não" antes. Para mudar, libere as notificações do volei.space nas configurações do navegador (ícone de cadeado ao lado do endereço) e volte aqui.',
        botao: null,
        tom: 'is-error',
      }
    case 'ativa':
      return { titulo: 'Avisos ativos neste aparelho', explicacao: 'Você vai receber os avisos que deixar ligados abaixo.', botao: 'Desativar avisos neste aparelho', tom: 'is-success' }
    case 'concedida':
      return { titulo: 'Falta só ativar', explicacao: 'O navegador já permite avisos. Toque no botão para registrar este aparelho.', botao: 'Ativar avisos neste aparelho', tom: 'info' }
    default:
      return {
        titulo: 'Receba avisos neste aparelho',
        explicacao: 'Ao tocar no botão, o navegador vai perguntar se pode mostrar avisos. Você pode desativar quando quiser.',
        botao: 'Ativar avisos neste aparelho',
        tom: 'info',
      }
  }
}

/** Mensagem para o resultado do pedido de permissão. */
export function textoResultadoPermissao(r: 'granted' | 'denied' | 'default'): string {
  if (r === 'granted') return 'Pronto! Este aparelho vai receber os avisos.'
  if (r === 'denied') return 'Sem permissão, não dá para avisar neste aparelho. Você pode liberar nas configurações do navegador.'
  return 'Você fechou a pergunta sem responder. Toque no botão de novo quando quiser ativar.'
}

export type FalhaPush = 'chave' | 'rede' | 'registro' | 'assinatura' | 'servidor'

export function textoFalhaPush(f: FalhaPush): string {
  switch (f) {
    case 'chave':
      return 'Os avisos no aparelho ainda não estão disponíveis. Tente mais tarde.'
    case 'rede':
      return 'Sem internet agora. Tente de novo quando voltar.'
    case 'registro':
      return 'Não conseguimos preparar este navegador para os avisos. Recarregue a página e tente de novo.'
    case 'assinatura':
      return 'O navegador não concluiu o registro. Tente de novo.'
    default:
      return 'Não conseguimos salvar o registro deste aparelho agora. Tente de novo em instantes.'
  }
}

/** Corpo do POST /api/notificacoes/push/assinar, a partir de PushSubscription.toJSON(). Null se faltar algo. */
export function corpoDaAssinatura(json: unknown): { endpoint: string; chaves: { p256dh: string; auth: string } } | null {
  const o = json && typeof json === 'object' ? (json as Record<string, unknown>) : {}
  const k = o.keys && typeof o.keys === 'object' ? (o.keys as Record<string, unknown>) : {}
  const endpoint = typeof o.endpoint === 'string' ? o.endpoint : ''
  const p256dh = typeof k.p256dh === 'string' ? k.p256dh : ''
  const auth = typeof k.auth === 'string' ? k.auth : ''
  if (!/^https:\/\//.test(endpoint) || !p256dh || !auth) return null
  return { endpoint, chaves: { p256dh, auth } }
}
