// Regras puras do login sem senha (código por e-mail, Google, troca de perfil). Sem React, sem rede.
// Tudo atrás de NEXT_PUBLIC_LOGIN_SEM_SENHA_ATIVO. Desligada = login atual idêntico.

export type TipoPerfil = 'LIDER' | 'ORGANIZADOR'
export type Perfil = { perfil: TipoPerfil; referenciaId: string; rotulo: string }
export type Canal = 'EMAIL' | 'WHATSAPP'

export const REENVIO_SEGUNDOS = 30
export const TAMANHO_CODIGO = 6

export const MENSAGEM_UNIFORME = 'Se este e-mail puder entrar, o código chegou. Confira também a caixa de spam.'
export const TEXTO_CODIGO_ENVIADO = 'Enviamos um código de 6 dígitos.'

// ---------------------------------------------------------------- flags

export function loginSemSenhaAtivo(valor: string | undefined = process.env.NEXT_PUBLIC_LOGIN_SEM_SENHA_ATIVO): boolean {
  return valor === '1'
}

/** WhatsApp só aparece com a flag própria E com o login sem senha ligado. */
export function loginWhatsappAtivo(
  valor: string | undefined = process.env.NEXT_PUBLIC_LOGIN_WHATSAPP_ATIVO,
  base: boolean = loginSemSenhaAtivo(),
): boolean {
  return base && valor === '1'
}

// ---------------------------------------------------------------- entradas

export function emailValido(valor: string): boolean {
  const v = valor.trim()
  return v.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)
}

/** Só dígitos, no máximo 6. Serve para digitar e para colar ("123 456", "123-456"). */
export function normalizarCodigo(valor: string): string {
  return valor.replace(/\D/g, '').slice(0, TAMANHO_CODIGO)
}

export function codigoCompleto(valor: string): boolean {
  return normalizarCodigo(valor).length === TAMANHO_CODIGO
}

/** Telefone brasileiro: DDD + número, 10 ou 11 dígitos (aceita +55). */
export function normalizarTelefone(valor: string): string {
  let d = valor.replace(/\D/g, '')
  if ((d.length === 12 || d.length === 13) && d.startsWith('55')) d = d.slice(2)
  return d
}

export function telefoneValido(valor: string): boolean {
  const d = normalizarTelefone(valor)
  return d.length === 10 || d.length === 11
}

// ---------------------------------------------------------------- reenvio

export function liberaReenvioEm(agoraMs: number): number {
  return agoraMs + REENVIO_SEGUNDOS * 1000
}

export function segundosRestantes(agoraMs: number, liberaEm: number): number {
  return Math.max(0, Math.ceil((liberaEm - agoraMs) / 1000))
}

export function rotuloReenvio(segundos: number): string {
  return segundos > 0 ? `Reenviar código em ${segundos} s` : 'Reenviar código'
}

// ---------------------------------------------------------------- mensagens de erro

export type ContextoErro = 'solicitar' | 'confirmar' | 'perfil'

/** Mensagem clara por situação. Nunca revela se o e-mail existe. */
export function mensagemErro(status: number, codigo: string | undefined, contexto: ContextoErro, mensagemServidor?: string): string {
  const c = (codigo ?? '').toUpperCase()
  if (status === 0) return 'Falha na conexão. Tente novamente em instantes.'
  if (status === 429) {
    return contexto === 'solicitar'
      ? 'Muitos pedidos de código. Aguarde alguns minutos e tente de novo.'
      : 'Muitas tentativas. Aguarde alguns minutos e peça um novo código.'
  }
  if (status === 404) return 'Entrar com código não está disponível agora. Use a senha.'
  if (status === 503) return 'O envio de código ainda não está habilitado. Use a senha.'
  if (contexto === 'confirmar') {
    if (status === 410 || c.includes('EXPIRAD')) return 'Esse código expirou. Peça um novo código.'
    if (status === 400 || status === 401 || status === 422 || c.includes('INVALID') || c.includes('CODIGO')) {
      return 'Código incorreto. Confira os 6 dígitos e tente de novo.'
    }
  }
  if (contexto === 'solicitar' && (status === 400 || status === 422)) return 'Confira o e-mail e tente de novo.'
  if (contexto === 'perfil' && (status === 401 || status === 403)) return 'Sua sessão não permite esse perfil. Entre de novo.'
  if (mensagemServidor && status < 500) return mensagemServidor
  return 'Não foi possível concluir agora. Tente de novo em instantes.'
}

// ---------------------------------------------------------------- resposta de confirmar

export type ResultadoConfirmar =
  | { tipo: 'perfis'; perfis: Perfil[]; perfilAtivo: Perfil | null }
  | { tipo: 'novaConta' }

function perfilDe(bruto: unknown): Perfil | null {
  if (!bruto || typeof bruto !== 'object') return null
  const o = bruto as Record<string, unknown>
  const perfil = o.perfil === 'LIDER' || o.perfil === 'ORGANIZADOR' ? o.perfil : null
  const ref = typeof o.referenciaId === 'string' || typeof o.referenciaId === 'number' ? String(o.referenciaId) : ''
  if (!perfil || !ref) return null
  const rotulo = typeof o.rotulo === 'string' && o.rotulo.trim() ? o.rotulo.trim() : perfil === 'LIDER' ? 'Líder de time' : 'Organizador'
  return { perfil, referenciaId: ref, rotulo }
}

export function normalizarPerfis(bruto: unknown): Perfil[] {
  if (!Array.isArray(bruto)) return []
  const vistos = new Set<string>()
  const lista: Perfil[] = []
  for (const item of bruto) {
    const p = perfilDe(item)
    if (!p) continue
    const chave = `${p.perfil}:${p.referenciaId}`
    if (vistos.has(chave)) continue
    vistos.add(chave)
    lista.push(p)
  }
  return lista
}

/** `perfilAtivo` pode vir como objeto completo ou só como o tipo/referência; acha o item correspondente. */
export function acharPerfilAtivo(perfis: Perfil[], ativo: unknown): Perfil | null {
  const direto = perfilDe(ativo)
  if (direto) return perfis.find((p) => p.perfil === direto.perfil && p.referenciaId === direto.referenciaId) ?? direto
  if (ativo === 'LIDER' || ativo === 'ORGANIZADOR') return perfis.find((p) => p.perfil === ativo) ?? null
  return null
}

export function lerConfirmar(corpo: unknown): ResultadoConfirmar | null {
  const data = corpo && typeof corpo === 'object' ? (corpo as { data?: unknown }).data : null
  if (!data || typeof data !== 'object') return null
  const d = data as Record<string, unknown>
  if (d.novaConta === true) return { tipo: 'novaConta' }
  const perfis = normalizarPerfis(d.perfis)
  if (perfis.length === 0) return null
  return { tipo: 'perfis', perfis, perfilAtivo: acharPerfilAtivo(perfis, d.perfilAtivo) }
}

export function lerPerfis(corpo: unknown): { perfis: Perfil[]; perfilAtivo: Perfil | null } | null {
  const r = lerConfirmar(corpo)
  return r && r.tipo === 'perfis' ? { perfis: r.perfis, perfilAtivo: r.perfilAtivo } : null
}

// ---------------------------------------------------------------- perfil

export const TITULO_ESCOLHA_PERFIL = 'Como você quer entrar hoje?'

export function destinoDoPerfil(perfil: TipoPerfil): string {
  return perfil === 'ORGANIZADOR' ? '/painel' : '/meu-time'
}

export function rotuloDoPerfil(p: Pick<Perfil, 'perfil' | 'rotulo'>): string {
  return p.rotulo || (p.perfil === 'ORGANIZADOR' ? 'Organizador' : 'Líder de time')
}

export function descricaoDoPerfil(perfil: TipoPerfil): string {
  return perfil === 'ORGANIZADOR' ? 'Gerenciar campeonatos' : 'Gerenciar meu time'
}

export function precisaEscolherPerfil(perfis: Perfil[]): boolean {
  return perfis.length > 1
}

/** Mais de um perfil: o usuário escolhe. Um só: entra direto. */
export function proximoPassoPosConfirmar(r: ResultadoConfirmar): { passo: 'onboarding' } | { passo: 'escolher'; perfis: Perfil[] } | { passo: 'entrar'; perfil: Perfil } {
  if (r.tipo === 'novaConta') return { passo: 'onboarding' }
  if (precisaEscolherPerfil(r.perfis)) return { passo: 'escolher', perfis: r.perfis }
  return { passo: 'entrar', perfil: r.perfis[0] }
}

// ---------------------------------------------------------------- destino seguro

const PREFIXOS_DESTINO = ['/meu-time', '/painel', '/inscricao'] as const

/** Aceita só /meu-time, /painel e /inscricao (e subcaminhos). Nunca URL externa, `//host` ou barra invertida. */
export function destinoPosLoginSeguro(valor: string | null | undefined): string | null {
  if (!valor || valor.length > 600) return null
  const bruto = valor.trim()
  let decodificado: string
  try {
    decodificado = decodeURIComponent(bruto)
  } catch {
    return null
  }
  for (const v of [bruto, decodificado]) {
    if (!v.startsWith('/') || v.startsWith('//') || v.includes('\\') || /[\u0000-\u001f]/.test(v)) return null
    const caminho = v.split(/[?#]/)[0]
    if (!PREFIXOS_DESTINO.some((p) => caminho === p || caminho.startsWith(`${p}/`))) return null
  }
  return bruto
}

/** Destino final: continuação segura se houver e combinar com o perfil; senão a casa do perfil. */
export function destinoFinal(perfil: TipoPerfil, continuar: string | null | undefined): string {
  const seguro = destinoPosLoginSeguro(continuar)
  if (!seguro) return destinoDoPerfil(perfil)
  const caminho = seguro.split(/[?#]/)[0]
  const casa = destinoDoPerfil(perfil)
  if (caminho === '/inscricao' || caminho.startsWith('/inscricao/')) return seguro
  return caminho === casa || caminho.startsWith(`${casa}/`) ? seguro : casa
}

// ---------------------------------------------------------------- onboarding

export type OpcaoOnboarding = { id: 'time' | 'organizador' | 'atleta'; titulo: string; texto: string; href: string | null }

export const TITULO_ONBOARDING = 'O que você quer fazer hoje?'

export const OPCOES_ONBOARDING: OpcaoOnboarding[] = [
  { id: 'time', titulo: 'Cadastrar meu time', texto: 'Crie o time, monte o elenco e inscreva em campeonatos.', href: '/meu-time/novo' },
  { id: 'organizador', titulo: 'Organizar um campeonato', texto: 'Cadastre-se como organizador e abra inscrições.', href: '/cadastro' },
  { id: 'atleta', titulo: 'Sou atleta e recebi um convite', texto: 'Seu convite chega pelo link ou pelo WhatsApp do líder do time.', href: null },
]

export const TEXTO_CONVITE_ATLETA =
  'Abra o link do convite que o líder do seu time enviou. Se ainda não recebeu, peça o link a ele. Atletas não precisam criar time.'

// ---------------------------------------------------------------- máquina de estados do login por código

export type EstadoLogin =
  | { passo: 'email'; erro?: string }
  | { passo: 'enviando'; email: string; reenvio?: boolean }
  | { passo: 'codigo'; email: string; liberaReenvioEm: number; erro?: string; reenviado?: boolean }
  | { passo: 'confirmando'; email: string; liberaReenvioEm: number }
  | { passo: 'perfil'; perfis: Perfil[] }
  | { passo: 'onboarding' }
  | { passo: 'concluido'; destino: string }

export type EventoLogin =
  | { tipo: 'enviar'; email: string }
  | { tipo: 'enviado'; agora: number }
  | { tipo: 'falhaEnvio'; mensagem: string }
  | { tipo: 'reenviar'; agora: number }
  | { tipo: 'confirmar' }
  | { tipo: 'confirmado'; resultado: ResultadoConfirmar; continuar?: string | null }
  | { tipo: 'falhaConfirmar'; mensagem: string }
  | { tipo: 'escolheu'; perfil: Perfil; continuar?: string | null }
  | { tipo: 'trocarEmail' }

export const ESTADO_INICIAL: EstadoLogin = { passo: 'email' }

export function transicaoLogin(estado: EstadoLogin, ev: EventoLogin): EstadoLogin {
  switch (ev.tipo) {
    case 'enviar':
      if (estado.passo !== 'email' && estado.passo !== 'codigo') return estado
      return emailValido(ev.email) ? { passo: 'enviando', email: ev.email.trim() } : { passo: 'email', erro: 'Confira o e-mail e tente de novo.' }
    case 'reenviar':
      // Só reenvia depois da contagem terminar.
      if (estado.passo !== 'codigo' || segundosRestantes(ev.agora, estado.liberaReenvioEm) > 0) return estado
      return { passo: 'enviando', email: estado.email, reenvio: true }
    case 'enviado':
      if (estado.passo !== 'enviando') return estado
      return { passo: 'codigo', email: estado.email, liberaReenvioEm: liberaReenvioEm(ev.agora) }
    case 'falhaEnvio':
      if (estado.passo !== 'enviando') return estado
      return { passo: 'email', erro: ev.mensagem }
    case 'confirmar':
      return estado.passo === 'codigo' ? { passo: 'confirmando', email: estado.email, liberaReenvioEm: estado.liberaReenvioEm } : estado
    case 'falhaConfirmar':
      if (estado.passo !== 'confirmando') return estado
      // Erro de código: continua na tela do código, com a mensagem; o reenvio segue a contagem.
      return { passo: 'codigo', email: estado.email, liberaReenvioEm: estado.liberaReenvioEm, erro: ev.mensagem }
    case 'confirmado': {
      if (estado.passo !== 'confirmando') return estado
      const prox = proximoPassoPosConfirmar(ev.resultado)
      if (prox.passo === 'onboarding') return { passo: 'onboarding' }
      if (prox.passo === 'escolher') return { passo: 'perfil', perfis: prox.perfis }
      const ativo = ev.resultado.tipo === 'perfis' ? ev.resultado.perfilAtivo : null
      return { passo: 'concluido', destino: destinoFinal((ativo ?? prox.perfil).perfil, ev.continuar) }
    }
    case 'escolheu':
      return estado.passo === 'perfil' ? { passo: 'concluido', destino: destinoFinal(ev.perfil.perfil, ev.continuar) } : estado
    case 'trocarEmail':
      return estado.passo === 'codigo' || estado.passo === 'email' ? { passo: 'email' } : estado
  }
}

// ---------------------------------------------------------------- navegação do líder

export type ItemNavLider = { href: string; rotulo: string }

export const NAV_LIDER: ItemNavLider[] = [
  { href: '/meu-time/inicio', rotulo: 'Início' },
  { href: '/meu-time', rotulo: 'Meu Time' },
  { href: '/meu-time/campeonatos', rotulo: 'Competições' },
  { href: '/meu-time/jogos', rotulo: 'Jogos' },
  { href: '/meu-time/perfil', rotulo: 'Perfil' },
]

const SUBROTAS_PROPRIAS = ['/meu-time/inicio', '/meu-time/campeonatos', '/meu-time/jogos', '/meu-time/perfil']

export function itemNavLiderAtual(caminho: string, item: ItemNavLider): boolean {
  if (item.href === '/meu-time') return !SUBROTAS_PROPRIAS.some((s) => caminho === s || caminho.startsWith(`${s}/`))
  return caminho === item.href || caminho.startsWith(`${item.href}/`)
}

// ---------------------------------------------------------------- resumo do Início

export type ResumoInicio = { proximosJogos: number; atletasPendentes: number; papeletasPendentes: number }

/** O que fazer agora: lista curta e ordenada por urgência. */
export function acoesAgora(r: ResumoInicio, temTime: boolean): { texto: string; href: string }[] {
  if (!temTime) return [{ texto: 'Cadastrar meu time', href: '/meu-time/novo' }]
  const lista: { texto: string; href: string }[] = []
  if (r.papeletasPendentes > 0) lista.push({ texto: r.papeletasPendentes === 1 ? 'Enviar a papeleta de 1 jogo' : `Enviar a papeleta de ${r.papeletasPendentes} jogos`, href: '/meu-time/jogos' })
  if (r.atletasPendentes > 0) lista.push({ texto: r.atletasPendentes === 1 ? 'Completar o cadastro de 1 atleta' : `Completar o cadastro de ${r.atletasPendentes} atletas`, href: '/meu-time' })
  if (lista.length === 0) lista.push({ texto: 'Ver campeonatos abertos', href: '/meu-time/campeonatos' })
  return lista
}
