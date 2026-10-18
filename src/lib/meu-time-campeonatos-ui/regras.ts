// Regras puras das abas "Campeonatos" e "Jogos" do Meu Time. Sem React, sem rede.

export type Modo = 'AUTOMATICA' | 'APROVACAO'
export type Situacao = 'DISPONIVEL' | 'PENDENTE' | 'INSCRITA' | 'RECUSADA' | 'ENCERRADA'

export type OfertaCampeonato = {
  ligaId: string
  categoriaId: string
  campeonato: string
  categoria: string
  naipe: string
  modo: Modo
  situacao: Situacao
  solicitacaoId?: string
  motivoRecusa?: string
}

export type JogoDoTime = {
  partidaId: string
  equipeId: string
  adversario: string
  horario: string | null
  local: string | null
  status: string
  campeonato: string
  categoria: string
  papeletaPendente: boolean
}

// ---------------------------------------------------------------- flags

/** Aba Campeonatos e notificações de solicitação. Desligada = nada novo aparece, sem requisição. */
export function inscricaoSolicitacaoAtiva(valor: string | undefined = process.env.NEXT_PUBLIC_INSCRICAO_SOLICITACAO_ATIVO): boolean {
  return valor === '1'
}

/** Aba Jogos (banco por sessão). */
export function bancoSessaoAtivo(valor: string | undefined = process.env.NEXT_PUBLIC_BANCO_SESSAO_ATIVO): boolean {
  return valor === '1'
}

// ---------------------------------------------------------------- navegação

export type AbaExtra = { href: string; rotulo: string }

export function abasExtras(solicitacao: boolean, sessao: boolean): AbaExtra[] {
  const abas: AbaExtra[] = []
  if (solicitacao) abas.push({ href: '/meu-time/campeonatos', rotulo: 'Campeonatos' })
  if (sessao) abas.push({ href: '/meu-time/jogos', rotulo: 'Jogos' })
  return abas
}

export function abaExtraAtual(caminho: string, aba: AbaExtra): boolean {
  return caminho === aba.href || caminho.startsWith(`${aba.href}/`)
}

export function caminhoEhAbaExtra(caminho: string): boolean {
  return ['/meu-time/campeonatos', '/meu-time/jogos'].some((h) => caminho === h || caminho.startsWith(`${h}/`))
}

// ---------------------------------------------------------------- rótulos

export const ROTULO_MODO: Readonly<Record<Modo, string>> = {
  AUTOMATICA: 'Inscrição automática',
  APROVACAO: 'Com aprovação do organizador',
}

export const ROTULO_SITUACAO: Readonly<Record<Situacao, string>> = {
  DISPONIVEL: 'Disponível',
  PENDENTE: 'Aguardando aprovação',
  INSCRITA: 'Inscrita',
  RECUSADA: 'Recusada',
  ENCERRADA: 'Encerrada',
}

export const AJUDA_MODO: Readonly<Record<Modo, string>> = {
  AUTOMATICA: 'Ao confirmar, seu time já entra na categoria.',
  APROVACAO: 'O organizador analisa o seu pedido e responde. Avisamos você aqui.',
}

export function normalizarModo(v: unknown): Modo {
  return v === 'AUTOMATICA' ? 'AUTOMATICA' : 'APROVACAO'
}

export function normalizarSituacao(v: unknown): Situacao {
  return v === 'DISPONIVEL' || v === 'PENDENTE' || v === 'INSCRITA' || v === 'RECUSADA' ? v : 'ENCERRADA'
}

export function textoSituacao(o: Pick<OfertaCampeonato, 'situacao' | 'motivoRecusa'>): string {
  if (o.situacao === 'RECUSADA') {
    const motivo = o.motivoRecusa?.trim()
    return motivo ? `Recusada. Motivo: ${motivo}` : 'Recusada pelo organizador.'
  }
  return ROTULO_SITUACAO[o.situacao]
}

// ---------------------------------------------------------------- botão

export type AcaoOferta = 'INSCREVER' | 'SOLICITAR' | 'CANCELAR'

export type BotaoOferta = { acao: AcaoOferta; rotulo: string } | { acao: null; motivo: string }

/** Qual botão a oferta mostra. Quem decide de verdade é o servidor; aqui só se evita o clique inútil. */
export function botaoDaOferta(o: Pick<OfertaCampeonato, 'modo' | 'situacao' | 'solicitacaoId'>): BotaoOferta {
  switch (o.situacao) {
    case 'ENCERRADA':
      return { acao: null, motivo: 'As inscrições desta categoria estão encerradas.' }
    case 'INSCRITA':
      return { acao: null, motivo: 'Seu time já está nesta categoria.' }
    case 'PENDENTE':
      return o.solicitacaoId
        ? { acao: 'CANCELAR', rotulo: 'Cancelar solicitação' }
        : { acao: null, motivo: 'Seu pedido está com o organizador.' }
    case 'RECUSADA':
    case 'DISPONIVEL':
    default:
      return o.modo === 'AUTOMATICA'
        ? { acao: 'INSCREVER', rotulo: 'Inscrever' }
        : { acao: 'SOLICITAR', rotulo: o.situacao === 'RECUSADA' ? 'Solicitar de novo' : 'Solicitar participação' }
  }
}

export const LIMITE_MENSAGEM = 300

/** Mensagem opcional ao organizador: tira espaços e limita o tamanho. */
export function prepararMensagem(texto: string): string | undefined {
  const t = texto.trim().slice(0, LIMITE_MENSAGEM)
  return t ? t : undefined
}

export function textoConfirmacao(o: Pick<OfertaCampeonato, 'modo' | 'campeonato' | 'categoria'>, equipe: string): string {
  const alvo = `${o.campeonato}, categoria ${o.categoria}`
  return o.modo === 'AUTOMATICA'
    ? `Inscrever ${equipe} em ${alvo}? Ao confirmar, o time entra na categoria.`
    : `Pedir ao organizador para ${equipe} participar de ${alvo}?`
}

/** Retorno claro depois do envio. O código vem do servidor: 409 SOLICITACAO_PENDENTE / JA_INSCRITA. */
export function mensagemRetorno(estado: string | undefined, modo: Modo): string {
  if (estado === 'INSCRITA') return 'Pronto! Seu time está inscrito.'
  if (estado === 'PENDENTE') return 'Pedido enviado. Agora é só esperar o organizador responder; avisamos você aqui no Meu Time.'
  return modo === 'AUTOMATICA' ? 'Inscrição concluída.' : 'Pedido enviado.'
}

export function mensagemDeCodigo(codigo: string | undefined): string | null {
  if (codigo === 'SOLICITACAO_PENDENTE') return 'Já existe um pedido seu aguardando o organizador para esta categoria.'
  if (codigo === 'JA_INSCRITA') return 'Seu time já está inscrito nesta categoria.'
  return null
}

/** Nos dois casos de 409 a lista mudou: vale recarregar. */
export function codigoPedeRecarregar(codigo: string | undefined): boolean {
  return codigo === 'SOLICITACAO_PENDENTE' || codigo === 'JA_INSCRITA'
}

// ---------------------------------------------------------------- jogos / banco por sessão

/** Base da API do banco por sessão (substitui o token do link). */
export function baseApiSessao(partidaId: string | number, equipeId: string | number): string {
  return `/api/banco/sessao/${encodeURIComponent(String(partidaId))}/${encodeURIComponent(String(equipeId))}`
}

export const TEXTO_PAPELETA_PENDENTE = 'Papeleta pendente'

export function rotuloStatusJogo(status: string): string {
  const s = String(status || '').replace(/_/g, ' ').toLowerCase()
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : ''
}

/** Jogos que ainda não acabaram vêm primeiro, por horário; sem horário vão para o fim. */
export function ordenarJogos(jogos: JogoDoTime[]): JogoDoTime[] {
  const encerrado = (j: JogoDoTime) => ['ENCERRADA', 'FINALIZADA', 'CANCELADA', 'WO'].includes(String(j.status || '').toUpperCase())
  const t = (j: JogoDoTime) => {
    const n = j.horario ? Date.parse(j.horario) : NaN
    return Number.isNaN(n) ? Number.MAX_SAFE_INTEGER : n
  }
  return [...jogos].sort((a, b) => Number(encerrado(a)) - Number(encerrado(b)) || t(a) - t(b))
}

export function chaveJogo(j: Pick<JogoDoTime, 'partidaId' | 'equipeId'>): string {
  return `${j.partidaId}:${j.equipeId}`
}

// ---------------------------------------------------------------- normalização das respostas

const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' ? (v as Record<string, unknown>) : {})
const txt = (v: unknown): string => (typeof v === 'string' ? v : typeof v === 'number' ? String(v) : '')

export function normalizarOfertas(dado: unknown): OfertaCampeonato[] {
  if (!Array.isArray(dado)) return []
  return dado
    .map((i) => {
      const o = obj(i)
      const oferta: OfertaCampeonato = {
        ligaId: txt(o.ligaId),
        categoriaId: txt(o.categoriaId),
        campeonato: txt(o.campeonato),
        categoria: txt(o.categoria),
        naipe: txt(o.naipe),
        modo: normalizarModo(o.modo),
        situacao: normalizarSituacao(o.situacao),
      }
      if (o.solicitacaoId !== undefined && o.solicitacaoId !== null && txt(o.solicitacaoId)) oferta.solicitacaoId = txt(o.solicitacaoId)
      if (typeof o.motivoRecusa === 'string' && o.motivoRecusa.trim()) oferta.motivoRecusa = o.motivoRecusa
      return oferta
    })
    .filter((o) => o.categoriaId !== '')
}

export function normalizarJogos(dado: unknown): JogoDoTime[] {
  if (!Array.isArray(dado)) return []
  return dado
    .map((i) => {
      const o = obj(i)
      return {
        partidaId: txt(o.partidaId),
        equipeId: txt(o.equipeId),
        adversario: txt(o.adversario) || 'Adversário a definir',
        horario: txt(o.horario) || null,
        local: txt(o.local) || null,
        status: txt(o.status),
        campeonato: txt(o.campeonato),
        categoria: txt(o.categoria),
        papeletaPendente: o.papeletaPendente === true,
      }
    })
    .filter((j) => j.partidaId !== '' && j.equipeId !== '')
}

// ---------------------------------------------------------------- notificações do líder

const TIPOS_SOLICITACAO = ['SOLICITACAO_APROVADA', 'SOLICITACAO_RECUSADA'] as const

export function ehNotificacaoDeSolicitacao(tipo: string): boolean {
  return (TIPOS_SOLICITACAO as readonly string[]).includes(tipo)
}

/** Título em linguagem simples; na recusa, traz o motivo. Devolve null para outros tipos. */
export function tituloSolicitacao(n: { tipo: string; payload?: Record<string, unknown> | null }): string | null {
  if (!ehNotificacaoDeSolicitacao(n.tipo)) return null
  const p = n.payload ?? {}
  const onde = [p.campeonato, p.categoria].filter((v): v is string => typeof v === 'string' && v.trim() !== '').join(', ')
  if (n.tipo === 'SOLICITACAO_APROVADA') return onde ? `Seu time foi aceito: ${onde}` : 'Seu time foi aceito em um campeonato'
  const motivo = [p.motivo, p.motivoRecusa].find((v): v is string => typeof v === 'string' && v.trim() !== '')
  const base = onde ? `Pedido recusado: ${onde}` : 'Seu pedido de participação foi recusado'
  return motivo ? `${base}. Motivo: ${motivo.trim()}` : base
}

/** Troca só o título; o resto da notificação segue igual. */
export function comTituloDeSolicitacao<T extends { tipo: string; payload: Record<string, unknown> }>(n: T): T {
  const titulo = tituloSolicitacao(n)
  return titulo ? { ...n, payload: { ...n.payload, titulo } } : n
}

export const HREF_CAMPEONATOS = '/meu-time/campeonatos'

// ---------------------------------------------------------------- erros do pedido de inscrição

export type AtletaDoBanco = { id: string; nome: string; numeroPreferido: number | null }

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`

function primeiroInteiro(texto: string, padrao: RegExp): number | null {
  const m = padrao.exec(texto)
  if (!m) return null
  const n = Number(m[1])
  return Number.isInteger(n) && n >= 0 ? n : null
}

/** Limites e diferença lidos da mensagem do servidor ("Faltam X ... mínimo de N", "Remova X ...: o máximo é M"). */
export function limitesDoErro(codigo: string | undefined, mensagem: string): { minimo: number | null; maximo: number | null; diferenca: number | null } {
  if (codigo === 'ABAIXO_DO_MINIMO') {
    return { minimo: primeiroInteiro(mensagem, /m[ií]nimo (?:de|é) (\d+)/i), maximo: null, diferenca: primeiroInteiro(mensagem, /faltam (\d+)/i) }
  }
  if (codigo === 'ACIMA_DO_MAXIMO') {
    return { minimo: null, maximo: primeiroInteiro(mensagem, /m[aá]ximo (?:de|é) (\d+)/i), diferenca: primeiroInteiro(mensagem, /remova (\d+)/i) }
  }
  return { minimo: null, maximo: null, diferenca: null }
}

export type FalhaSolicitacao = { codigo?: string; mensagem: string }

/** Mensagem simples para os erros do POST de solicitação. Cai na mensagem do servidor quando o código é outro. */
export function mensagemErroSolicitacao(f: FalhaSolicitacao): string {
  const { minimo, maximo, diferenca } = limitesDoErro(f.codigo, f.mensagem)
  switch (f.codigo) {
    case 'TIME_SEM_ATLETAS':
      return 'Cadastre atletas no time antes de se inscrever.'
    case 'ABAIXO_DO_MINIMO': {
      if (minimo === null) return 'Seu time tem menos atletas do que esta categoria pede. Cadastre mais atletas e tente de novo.'
      const base = `Esta categoria pede no mínimo ${plural(minimo, 'atleta', 'atletas')}.`
      if (diferenca === null) return `${base} Cadastre mais atletas no time e tente de novo.`
      return `${base} Seu time tem ${Math.max(0, minimo - diferenca)}. Cadastre mais ${plural(diferenca, 'atleta', 'atletas')} e tente de novo.`
    }
    case 'ACIMA_DO_MAXIMO': {
      if (maximo === null) return 'Seu time tem atletas demais para esta categoria. Remova alguns do banco do time e tente de novo.'
      const base = `Esta categoria aceita no máximo ${plural(maximo, 'atleta', 'atletas')}.`
      return diferenca !== null ? `${base} Seu time tem ${maximo + diferenca}. Escolha quem entra.` : `${base} Escolha quem entra.`
    }
    case 'CONVITE_OBRIGATORIO':
      return 'Esta competição é por convite. Peça o link de inscrição ao organizador.'
    case 'INSCRICOES_FECHADAS':
      return 'As inscrições desta categoria estão fechadas.'
    case 'NAIPE_INCOMPATIVEL':
      return 'O naipe do seu time não é o desta categoria. Escolha uma categoria do mesmo naipe.'
    default:
      return mensagemDeCodigo(f.codigo) ?? f.mensagem
  }
}

/** Só no excesso de atletas o líder resolve na própria tela, escolhendo quem entra. Devolve o máximo ou null. */
export function maximoParaEscolha(f: FalhaSolicitacao): number | null {
  if (f.codigo !== 'ACIMA_DO_MAXIMO') return null
  const { maximo } = limitesDoErro(f.codigo, f.mensagem)
  return maximo !== null && maximo >= 1 ? maximo : null
}

// ---------------------------------------------------------------- escolha de atletas

/** Marca ou desmarca um atleta. No máximo, novas marcações são ignoradas (desmarcar sempre vale). */
export function alternarAtleta(selecionados: readonly string[], id: string, maximo: number): string[] {
  if (selecionados.includes(id)) return selecionados.filter((s) => s !== id)
  return selecionados.length >= maximo ? [...selecionados] : [...selecionados, id]
}

export function selecaoValida(selecionados: readonly string[], maximo: number): boolean {
  return selecionados.length >= 1 && selecionados.length <= maximo
}

export function textoContagemSelecao(marcados: number, maximo: number): string {
  if (marcados === 0) return `Escolha até ${plural(maximo, 'atleta', 'atletas')}.`
  if (marcados >= maximo) return `${marcados} de ${maximo} escolhidos. Para trocar, desmarque alguém.`
  return `${marcados} de ${maximo} escolhidos. Ainda cabem ${plural(maximo - marcados, 'atleta', 'atletas')}.`
}

/** Atletas na ordem do número preferido (sem número vão para o fim), depois por nome. */
export function ordenarAtletas(lista: AtletaDoBanco[]): AtletaDoBanco[] {
  const n = (a: AtletaDoBanco) => (a.numeroPreferido === null ? Number.MAX_SAFE_INTEGER : a.numeroPreferido)
  return [...lista].sort((a, b) => n(a) - n(b) || a.nome.localeCompare(b.nome, 'pt-BR'))
}

export function normalizarAtletasDoBanco(dado: unknown): AtletaDoBanco[] {
  if (!Array.isArray(dado)) return []
  return dado
    .map((i) => {
      const o = obj(i)
      const n = typeof o.numeroPreferido === 'number' && Number.isFinite(o.numeroPreferido) ? o.numeroPreferido : null
      return { id: txt(o.id), nome: txt(o.nome), numeroPreferido: n }
    })
    .filter((a) => a.id !== '' && a.nome !== '')
}
