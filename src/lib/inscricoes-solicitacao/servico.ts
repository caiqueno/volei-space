// Solicitação de inscrição (R14): o líder escolhe um campeonato aberto e, conforme o modo da categoria,
// a equipe entra direto (AUTOMATICA) ou fica numa fila para o organizador decidir (APROVACAO).
// A inscrição em si SEMPRE sai de inscreverEquipe (src/lib/meu-time/inscricao.ts): mesmas regras de janela,
// naipe, elenco e unicidade, sem duplicar nada. Aqui só entram a vitrine, a fila e as notificações.
import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { colunaAusente } from '@/lib/coluna-ausente'
import { campeonatoPublicado } from '@/lib/campeonato-publico'
import { idsCompeticoesPrivadas } from '@/lib/visibilidade-competicao'
import { registrationWindowDecision } from '@/lib/team-registration-draft'
import { ErroMeuTime, idValido, lerDados, tabelaAusente, violacaoUnica } from '@/lib/meu-time/acesso'
import { avaliarConvite, linkVigente, type LinkCampeonato } from '@/lib/meu-time/convite'
import { exigirEquipe, listarAtletasDoClube, type EquipeBanco } from '@/lib/meu-time/dados'
import { inscreverEquipe, paraRegra } from '@/lib/meu-time/inscricao'
import { inscricaoViva, mensagemNaipe, type SelecaoAtleta } from '@/lib/meu-time/regras'
import { listarNotificacoes, marcarLida, notificar } from '@/lib/meu-time-fase2/notificacoes'
import { indisponivel, lerSolic, recursoAusente } from './acesso'

const db = supabaseAdmin as any

export const MODOS = ['AUTOMATICA', 'APROVACAO'] as const
export type ModoInscricao = (typeof MODOS)[number]
export const ESTADOS = ['PENDENTE', 'APROVADA', 'RECUSADA', 'CANCELADA'] as const
export type EstadoSolicitacao = (typeof ESTADOS)[number]

export const solicitarSchema = z.object({
  equipeId: z.string().uuid(),
  categoriaId: z.string().uuid(),
  mensagem: z.string().trim().max(500).optional().nullable(),
  /** Token do link do organizador (categoria ou campeonato). Só é necessário em competição privada sem convite prévio. */
  convite: z.string().trim().max(200).optional(),
})

export const decisaoSchema = z.object({
  decisao: z.enum(['APROVADA', 'RECUSADA']),
  motivo: z.string().trim().max(500).optional().nullable(),
})

export const modoSchema = z.object({ modoInscricao: z.enum(MODOS) })

const COLUNAS_LIGA = 'id,nome,status,simulacao,organizadorId,inscricoesAbertas,inscricoesAberturaEm,inscricoesEncerramentoEm'

function modoDe(linha: { modoInscricao?: unknown } | null | undefined): ModoInscricao {
  return linha?.modoInscricao === 'APROVACAO' ? 'APROVACAO' : 'AUTOMATICA'
}

/** Naipe da categoria a partir do código (FEMININO_MASTER -> FEMININO). */
export function naipeDaCategoria(codigo: unknown): 'FEMININO' | 'MASCULINO' | 'MISTO' | null {
  const texto = String(codigo ?? '').toUpperCase()
  if (texto.startsWith('FEMININO')) return 'FEMININO'
  if (texto.startsWith('MASCULINO')) return 'MASCULINO'
  if (texto.startsWith('MISTO')) return 'MISTO'
  return null
}

type CategoriaLida = {
  id: string
  ligaId: number
  codigo: string
  nome: string
  ordem?: number | null
  tokenInscricao?: string | null
  modoInscricao?: string | null
}

/** Lê categorias. Coluna `modoInscricao` ausente (migration pendente): repete sem ela e vale AUTOMATICA. */
async function lerCategorias(filtrar: (consulta: any) => any): Promise<CategoriaLida[]> {
  const colunas = 'id,ligaId,codigo,nome,ordem,tokenInscricao'
  let r = await filtrar(db.from('CategoriaCampeonato').select(`${colunas},modoInscricao`).is('removidaEm', null))
  if (r.error && colunaAusente(r.error, ['modoInscricao'])) r = await filtrar(db.from('CategoriaCampeonato').select(colunas).is('removidaEm', null))
  return (lerDados(r, 'categorias') as CategoriaLida[] | null) ?? []
}

async function lerCategoria(categoriaId: string): Promise<CategoriaLida | null> {
  if (!idValido(categoriaId)) return null
  return (await lerCategorias((c) => c.eq('id', categoriaId)))[0] ?? null
}

async function lerLiga(ligaId: number) {
  return lerDados(await db.from('Liga').select(COLUNAS_LIGA).eq('id', ligaId).maybeSingle(), 'campeonato') as any
}

async function lerLinkCampeonato(ligaId: number): Promise<LinkCampeonato | null> {
  const r = await db.from('LinkInscricaoCampeonato').select('token,ativo,revogadoEm,expiraEm').eq('ligaId', ligaId).maybeSingle()
  if (r.error) {
    if (tabelaAusente(r.error)) return null
    lerDados(r, 'link do campeonato')
  }
  return (r.data as LinkCampeonato | null) ?? null
}

/** Ligas (entre `ligaIds`) para as quais algum membro da equipe tem convite do organizador (ConviteEquipe). */
async function ligasComConvite(equipeId: string, ligaIds: number[]): Promise<Set<number>> {
  if (ligaIds.length === 0) return new Set()
  const membros = (lerDados(await db.from('MembroEquipe').select('usuarioId').eq('timeId', equipeId), 'membros da equipe') as Array<{ usuarioId: string }> | null) ?? []
  const contas = membros.map((item) => item.usuarioId)
  if (contas.length === 0) return new Set()
  const r = await db.from('ConviteEquipe').select('ligaId,status,candidaturaEquipeId').in('ligaId', ligaIds).in('candidaturaEquipeId', contas)
  if (r.error) {
    if (tabelaAusente(r.error)) return new Set()
    lerDados(r, 'convites da equipe')
  }
  return new Set(((r.data ?? []) as any[]).filter((c) => ['ENVIADO', 'ACEITO'].includes(String(c.status))).map((c) => Number(c.ligaId)))
}

type SolicitacaoLida = {
  id: string
  timeId: string
  categoriaId: string
  ligaId: number
  estado: EstadoSolicitacao
  mensagem?: string | null
  motivoRecusa?: string | null
  solicitadoPor?: string | null
  solicitadoEm?: string | null
  decididoEm?: string | null
  inscricaoId?: string | null
}

const COLUNAS_SOLICITACAO = 'id,timeId,categoriaId,ligaId,estado,mensagem,motivoRecusa,solicitadoPor,solicitadoEm,decididoEm,inscricaoId'

async function lerSolicitacao(id: string): Promise<SolicitacaoLida | null> {
  if (!idValido(id)) return null
  return lerSolic(await db.from('SolicitacaoInscricao').select(COLUNAS_SOLICITACAO).eq('id', id).maybeSingle(), 'solicitação') as SolicitacaoLida | null
}

// --- Líder: vitrine ----------------------------------------------------------

export type CampeonatoDisponivel = {
  ligaId: number
  categoriaId: string
  campeonato: string
  categoria: string
  naipe: string | null
  modo: ModoInscricao
  situacao: 'DISPONIVEL' | 'PENDENTE' | 'INSCRITA' | 'RECUSADA' | 'ENCERRADA'
  solicitacaoId?: string
  motivoRecusa?: string
}

/**
 * Campeonatos publicados e abertos, da categoria compatível com o naipe da equipe.
 * Privada só aparece com convite (ConviteEquipe) ou relação já existente. Campeonato fechado só aparece quando a
 * equipe já tem história nele (inscrita, solicitação pendente/recusada ou cancelada), com a situação correspondente.
 * Sem a tabela de solicitações (migration pendente) a vitrine segue, sem estados de solicitação.
 */
export async function listarCampeonatosDaEquipe(equipe: EquipeBanco): Promise<CampeonatoDisponivel[]> {
  const inscricoes = ((lerDados(
    await db.from('Inscricao').select('id,ligaId,categoriaCampeonatoId,status').eq('timeId', equipe.id),
    'inscrições da equipe',
  ) as any[] | null) ?? []).filter((item) => inscricaoViva(String(item.status)))
  const soli = await db.from('SolicitacaoInscricao').select(COLUNAS_SOLICITACAO).eq('timeId', equipe.id).order('solicitadoEm', { ascending: false })
  if (soli.error && !recursoAusente(soli.error)) lerSolic(soli, 'solicitações da equipe')
  const solicitacoes: SolicitacaoLida[] = soli.error ? [] : ((soli.data ?? []) as SolicitacaoLida[])

  const inscritas = new Set(inscricoes.map((item) => String(item.categoriaCampeonatoId)))
  // A mais recente de cada categoria define o estado mostrado.
  const maisRecente = new Map<string, SolicitacaoLida>()
  for (const item of solicitacoes) if (!maisRecente.has(item.categoriaId)) maisRecente.set(item.categoriaId, item)
  const comHistoria = new Set<number>([
    ...inscricoes.map((item) => Number(item.ligaId)),
    ...solicitacoes.map((item) => Number(item.ligaId)),
  ])

  const abertas = (lerDados(
    await db.from('Liga').select(COLUNAS_LIGA).in('status', ['EM_BREVE', 'ATIVA']),
    'campeonatos abertos',
  ) as any[] | null) ?? []
  const idsAbertas = new Set(abertas.map((liga) => Number(liga.id)))
  const faltantes = Array.from(comHistoria).filter((id) => !idsAbertas.has(id))
  const extras = faltantes.length === 0 ? [] : ((lerDados(await db.from('Liga').select(COLUNAS_LIGA).in('id', faltantes), 'campeonatos da equipe') as any[] | null) ?? [])
  const ligas = [...abertas, ...extras].filter((liga) => campeonatoPublicado(liga))
  if (ligas.length === 0) return []

  const ligaIds = ligas.map((liga) => Number(liga.id))
  const [privadas, convidadas] = await Promise.all([idsCompeticoesPrivadas({ semCache: true }), ligasComConvite(equipe.id, ligaIds)])
  const categorias = await lerCategorias((c) => c.in('ligaId', ligaIds))

  const saida: Array<CampeonatoDisponivel & { _ordem: number }> = []
  for (const liga of ligas) {
    const ligaId = Number(liga.id)
    const aberta = registrationWindowDecision(liga).allowed
    const visivel = !privadas.has(ligaId) || convidadas.has(ligaId) || comHistoria.has(ligaId)
    if (!visivel) continue
    for (const categoria of categorias.filter((item) => Number(item.ligaId) === ligaId)) {
      const naipe = naipeDaCategoria(categoria.codigo)
      const ultima = maisRecente.get(categoria.id)
      let situacao: CampeonatoDisponivel['situacao'] | null = null
      if (inscritas.has(categoria.id)) situacao = 'INSCRITA'
      else if (ultima?.estado === 'PENDENTE') situacao = 'PENDENTE'
      else if (ultima?.estado === 'RECUSADA') situacao = 'RECUSADA'
      else if (aberta) situacao = mensagemNaipe(equipe.naipe, naipe) ? null : 'DISPONIVEL'
      else if (ultima || comHistoria.has(ligaId)) situacao = 'ENCERRADA'
      if (!situacao) continue
      saida.push({
        ligaId,
        categoriaId: categoria.id,
        campeonato: String(liga.nome ?? ''),
        categoria: categoria.nome,
        naipe,
        modo: modoDe(categoria),
        situacao,
        ...(ultima && (situacao === 'PENDENTE' || situacao === 'RECUSADA') ? { solicitacaoId: ultima.id } : {}),
        ...(situacao === 'RECUSADA' && ultima?.motivoRecusa ? { motivoRecusa: ultima.motivoRecusa } : {}),
        _ordem: Number(categoria.ordem ?? 0),
      })
    }
  }
  return saida
    .sort((a, b) => a.campeonato.localeCompare(b.campeonato, 'pt-BR') || a._ordem - b._ordem)
    .map(({ _ordem, ...item }) => { void _ordem; return item })
}

// --- Inscrição pelo caminho existente ------------------------------------------

/** Escolhe o token que o servidor apresenta ao caminho existente em nome da equipe (vitrine ou aprovação). */
async function tokenDoServidor(categoria: CategoriaLida): Promise<string | undefined> {
  if (categoria.tokenInscricao) return categoria.tokenInscricao
  const link = await lerLinkCampeonato(Number(categoria.ligaId))
  return linkVigente(link) ? link.token : undefined
}

/**
 * Seleção de atletas a partir do banco do time: camisa preferida quando livre e entre 0 e 99; as demais pegam a menor
 * camisa livre. O resto (naipe, idade, mínimo/máximo, unicidade na categoria) é conferido por inscreverEquipe.
 */
export async function montarSelecaoDoBanco(equipe: EquipeBanco): Promise<SelecaoAtleta[]> {
  const atletas = await listarAtletasDoClube(equipe.clubeId)
  if (atletas.length === 0) {
    throw new ErroMeuTime('Cadastre pelo menos 1 atleta no banco do time antes de se inscrever.', 422, 'TIME_SEM_ATLETAS')
  }
  const usados = new Set<number>()
  const escolhidos = new Map<string, number>()
  for (const atleta of atletas) {
    const preferido = atleta.numeroPreferido
    if (Number.isInteger(preferido) && preferido >= 0 && preferido <= 99 && !usados.has(preferido)) {
      usados.add(preferido)
      escolhidos.set(atleta.id, preferido)
    }
  }
  let proximo = 0
  for (const atleta of atletas) {
    if (escolhidos.has(atleta.id)) continue
    while (usados.has(proximo) && proximo <= 99) proximo += 1
    if (proximo > 99) throw new ErroMeuTime('O banco do time tem atletas demais para numerar de 0 a 99.', 422, 'ACIMA_DO_MAXIMO')
    usados.add(proximo)
    escolhidos.set(atleta.id, proximo)
  }
  return atletas.map((atleta) => ({ atletaId: atleta.id as string, numero: escolhidos.get(atleta.id)! }))
}

async function inscrever(usuarioId: string, equipe: EquipeBanco, categoria: CategoriaLida, convite: string | undefined) {
  return inscreverEquipe(usuarioId, equipe, {
    categoriaCampeonatoId: categoria.id,
    atletas: await montarSelecaoDoBanco(equipe),
    convite,
  })
}

// --- Líder: solicitar / cancelar ---------------------------------------------

export async function solicitarInscricao(usuarioId: string, equipe: EquipeBanco, entrada: z.infer<typeof solicitarSchema>) {
  const categoria = await lerCategoria(entrada.categoriaId)
  if (!categoria) throw new ErroMeuTime('Categoria não encontrada.', 404, 'CATEGORIA_NAO_ENCONTRADA')
  const liga = await lerLiga(Number(categoria.ligaId))
  // Só campeonato publicado é visível ao líder; rascunho e simulação "não existem".
  if (!liga || !campeonatoPublicado(liga)) throw new ErroMeuTime('Campeonato não encontrado.', 404, 'CAMPEONATO_NAO_ENCONTRADO')
  const janela = registrationWindowDecision(liga)
  if (!janela.allowed) throw new ErroMeuTime(janela.reason || 'Inscrições indisponíveis.', 403, 'INSCRICOES_FECHADAS')
  const naipe = mensagemNaipe(equipe.naipe, naipeDaCategoria(categoria.codigo))
  if (naipe) throw new ErroMeuTime(naipe, 422, 'NAIPE_INCOMPATIVEL')

  // Privada: convite do organizador (ConviteEquipe da equipe) ou token do link informado.
  const privada = (await idsCompeticoesPrivadas({ semCache: true })).has(Number(liga.id))
  let convite: string | undefined = await tokenDoServidor(categoria)
  if (privada) {
    if (entrada.convite) {
      const decisao = avaliarConvite(entrada.convite, {
        visibilidade: 'PRIVADA',
        tokenCategoria: categoria.tokenInscricao ?? null,
        linkCampeonato: await lerLinkCampeonato(Number(liga.id)),
      })
      if (!decisao.ok) throw new ErroMeuTime(decisao.mensagem, decisao.status, decisao.codigo)
    } else if (!(await ligasComConvite(equipe.id, [Number(liga.id)])).has(Number(liga.id))) {
      throw new ErroMeuTime('Esta competição é privada: é preciso o convite do organizador.', 403, 'CONVITE_OBRIGATORIO')
    }
    if (!convite) {
      throw new ErroMeuTime('Esta competição é privada e o organizador ainda não emitiu o link de inscrição desta categoria. Peça o link ao organizador.', 403, 'CONVITE_INVALIDO')
    }
  }

  const vivas = ((lerDados(
    await db.from('Inscricao').select('id,status').eq('timeId', equipe.id).eq('categoriaCampeonatoId', categoria.id),
    'inscrição existente',
  ) as Array<{ id: string; status: string }> | null) ?? []).filter((item) => inscricaoViva(item.status))
  if (vivas.length > 0) throw new ErroMeuTime('Esta equipe já está inscrita nesta categoria.', 409, 'JA_INSCRITA')

  if (modoDe(categoria) === 'AUTOMATICA') {
    const { resumo, avisos } = await inscrever(usuarioId, equipe, categoria, convite)
    return { status: 201, corpo: { estado: 'INSCRITA' as const, inscricaoId: resumo.id, avisos } }
  }

  // APROVACAO: fila para o organizador.
  const pendente = lerSolic(
    await db.from('SolicitacaoInscricao').select('id').eq('timeId', equipe.id).eq('categoriaId', categoria.id).eq('estado', 'PENDENTE'),
    'solicitação pendente',
  ) as Array<{ id: string }> | null
  const jaPendente = () => new ErroMeuTime('Já existe uma solicitação pendente desta equipe para esta categoria.', 409, 'SOLICITACAO_PENDENTE')
  if ((pendente ?? []).length > 0) throw jaPendente()

  // Confere cedo o tamanho do elenco, para o líder não esperar a aprovação de algo que não vai passar.
  const selecao = await montarSelecaoDoBanco(equipe)
  const regra = paraRegra(lerDados(await db.from('RegraElenco').select('*').eq('categoriaCampeonatoId', categoria.id).maybeSingle(), 'regra de elenco'))
  if (regra.atletasMin != null && selecao.length < regra.atletasMin) {
    throw new ErroMeuTime(`Faltam ${regra.atletasMin - selecao.length} atleta(s) para chegar ao mínimo de ${regra.atletasMin}.`, 422, 'ABAIXO_DO_MINIMO')
  }
  if (regra.atletasMax != null && selecao.length > regra.atletasMax) {
    throw new ErroMeuTime(`Remova ${selecao.length - regra.atletasMax} atleta(s): o máximo é ${regra.atletasMax}.`, 422, 'ACIMA_DO_MAXIMO')
  }

  const criada = await db
    .from('SolicitacaoInscricao')
    .insert({
      timeId: equipe.id,
      categoriaId: categoria.id,
      ligaId: Number(liga.id),
      estado: 'PENDENTE',
      mensagem: entrada.mensagem || null,
      solicitadoPor: usuarioId,
      solicitadoEm: new Date().toISOString(),
    })
    .select('id,estado')
    .single()
  if (violacaoUnica(criada.error)) throw jaPendente()
  const solicitacao = lerSolic(criada, 'criar solicitação') as { id: string; estado: string } | null
  if (!solicitacao) throw new ErroMeuTime('Não foi possível registrar a solicitação.', 500)

  if (liga.organizadorId) {
    await notificar(
      String(liga.organizadorId),
      'SOLICITACAO_INSCRICAO',
      'Nova solicitação de inscrição',
      `${equipe.nome} pediu para entrar em ${categoria.nome} (${liga.nome}).`,
      { solicitacaoId: solicitacao.id, equipe: equipe.nome, categoria: categoria.nome },
    )
  }
  return { status: 201, corpo: { id: solicitacao.id, estado: 'PENDENTE' as const } }
}

export async function cancelarSolicitacao(usuarioId: string, id: string) {
  const naoEncontrada = () => new ErroMeuTime('Solicitação não encontrada.', 404, 'SOLICITACAO_NAO_ENCONTRADA')
  const solicitacao = await lerSolicitacao(id)
  if (!solicitacao) throw naoEncontrada()
  // Posse: quem não é da equipe recebe 404 (IDOR); assistente recebe 403 do exigirEquipe.
  await exigirEquipe(usuarioId, solicitacao.timeId, 'escrita')
  if (solicitacao.estado === 'CANCELADA') return { id, estado: 'CANCELADA' as const }
  if (solicitacao.estado !== 'PENDENTE') {
    throw new ErroMeuTime('Esta solicitação já foi decidida pelo organizador.', 409, 'SOLICITACAO_JA_DECIDIDA')
  }
  const linhas = lerSolic(
    await db.from('SolicitacaoInscricao').update({ estado: 'CANCELADA' }).eq('id', id).eq('estado', 'PENDENTE').select('id'),
    'cancelar solicitação',
  ) as any[] | null
  if (!linhas || linhas.length === 0) {
    const atual = await lerSolicitacao(id)
    if (atual?.estado === 'CANCELADA') return { id, estado: 'CANCELADA' as const }
    throw new ErroMeuTime('Esta solicitação já foi decidida pelo organizador.', 409, 'SOLICITACAO_JA_DECIDIDA')
  }
  return { id, estado: 'CANCELADA' as const }
}

// --- Organizador ------------------------------------------------------------------

async function ligasDoOrganizador(organizadorId: string): Promise<Array<{ id: number; nome: string }>> {
  const linhas = (lerDados(await db.from('Liga').select('id,nome').eq('organizadorId', organizadorId), 'campeonatos do organizador') as any[] | null) ?? []
  return linhas.map((linha) => ({ id: Number(linha.id), nome: String(linha.nome ?? '') }))
}

/** Lista as solicitações das ligas do organizador. Sem PII de atletas: só a contagem do elenco do time. */
export async function listarParaOrganizador(organizadorId: string, filtro: { estado?: string | null; ligaId?: string | null }) {
  let estado: EstadoSolicitacao | null = null
  if (filtro.estado) {
    if (!(ESTADOS as readonly string[]).includes(filtro.estado)) {
      throw new ErroMeuTime('Estado inválido.', 422, 'DADOS_INVALIDOS')
    }
    estado = filtro.estado as EstadoSolicitacao
  }
  const proprias = await ligasDoOrganizador(organizadorId)
  let alvo = proprias
  if (filtro.ligaId) {
    const ligaId = /^\d+$/.test(filtro.ligaId) ? Number(filtro.ligaId) : NaN
    alvo = proprias.filter((liga) => liga.id === ligaId)
    if (alvo.length === 0) throw new ErroMeuTime('Campeonato não encontrado.', 404, 'CAMPEONATO_NAO_ENCONTRADO')
  }
  if (alvo.length === 0) return []

  let consulta = db.from('SolicitacaoInscricao').select(COLUNAS_SOLICITACAO).in('ligaId', alvo.map((liga) => liga.id))
  if (estado) consulta = consulta.eq('estado', estado)
  const linhas = (lerSolic(await consulta.order('solicitadoEm', { ascending: false }), 'solicitações') as SolicitacaoLida[] | null) ?? []
  if (linhas.length === 0) return []

  const times = (lerDados(
    await db.from('TimeClube').select('id,clubeId,nome,cidade').in('id', Array.from(new Set(linhas.map((l) => l.timeId)))),
    'equipes das solicitações',
  ) as any[] | null) ?? []
  const categorias = await lerCategorias((c) => c.in('id', Array.from(new Set(linhas.map((l) => l.categoriaId)))))
  const clubes = Array.from(new Set(times.map((t) => String(t.clubeId))))
  const vinculos = (lerDados(
    await db.from('VinculoAtletaClube').select('clubeId,atletaId').in('clubeId', clubes).eq('status', 'ATIVO'),
    'atletas dos times',
  ) as Array<{ clubeId: string }> | null) ?? []
  const atletasPorClube = new Map<string, number>()
  for (const v of vinculos) atletasPorClube.set(String(v.clubeId), (atletasPorClube.get(String(v.clubeId)) ?? 0) + 1)

  const nomeLiga = new Map(alvo.map((liga) => [liga.id, liga.nome]))
  return linhas.map((linha) => {
    const time = times.find((t) => t.id === linha.timeId)
    return {
      id: linha.id,
      equipe: { id: linha.timeId, nome: time?.nome ?? '', cidade: time?.cidade ?? null },
      ligaId: Number(linha.ligaId),
      campeonato: nomeLiga.get(Number(linha.ligaId)) ?? '',
      categoria: categorias.find((c) => c.id === linha.categoriaId)?.nome ?? '',
      mensagem: linha.mensagem ?? null,
      estado: linha.estado,
      solicitadoEm: linha.solicitadoEm ?? null,
      motivoRecusa: linha.motivoRecusa ?? null,
      inscricaoId: linha.inscricaoId ?? null,
      atletas: time ? atletasPorClube.get(String(time.clubeId)) ?? 0 : 0,
    }
  })
}

async function exigirSolicitacaoDoOrganizador(organizadorId: string, id: string) {
  const naoEncontrada = () => new ErroMeuTime('Solicitação não encontrada.', 404, 'SOLICITACAO_NAO_ENCONTRADA')
  const solicitacao = await lerSolicitacao(id)
  if (!solicitacao) throw naoEncontrada()
  const liga = await lerLiga(Number(solicitacao.ligaId))
  // Outro organizador "não vê" a solicitação (IDOR = 404).
  if (!liga || String(liga.organizadorId) !== organizadorId) throw naoEncontrada()
  return { solicitacao, liga }
}

export async function decidirSolicitacao(organizadorId: string, id: string, entrada: z.infer<typeof decisaoSchema>) {
  const { solicitacao, liga } = await exigirSolicitacaoDoOrganizador(organizadorId, id)
  const resposta = (s: SolicitacaoLida) => ({ id: s.id, estado: s.estado, inscricaoId: s.inscricaoId ?? null })
  if (solicitacao.estado === entrada.decisao) return resposta(solicitacao)
  if (solicitacao.estado !== 'PENDENTE') {
    throw new ErroMeuTime(
      solicitacao.estado === 'CANCELADA' ? 'A equipe cancelou esta solicitação.' : 'Esta solicitação já foi decidida de outra forma.',
      409,
      'SOLICITACAO_JA_DECIDIDA',
    )
  }
  const motivo = entrada.motivo || null
  const agora = new Date().toISOString()
  // Reivindica a decisão de forma atômica (só uma requisição vence a corrida PENDENTE -> decisão).
  const reivindicada = lerSolic(
    await db
      .from('SolicitacaoInscricao')
      .update({ estado: entrada.decisao, decididoPor: organizadorId, decididoEm: agora, motivoRecusa: entrada.decisao === 'RECUSADA' ? motivo : null })
      .eq('id', id)
      .eq('estado', 'PENDENTE')
      .select('id'),
    'decidir solicitação',
  ) as any[] | null
  if (!reivindicada || reivindicada.length === 0) {
    const atual = await lerSolicitacao(id)
    if (atual?.estado === entrada.decisao) return resposta(atual)
    throw new ErroMeuTime('Esta solicitação já foi decidida de outra forma.', 409, 'SOLICITACAO_JA_DECIDIDA')
  }

  const categoria = await lerCategoria(solicitacao.categoriaId)
  const time = lerDados(
    await db.from('TimeClube').select('id,clubeId,nome,cidade,naipe,escudoUrl').eq('id', solicitacao.timeId).is('arquivadoEm', null).maybeSingle(),
    'equipe da solicitação',
  ) as EquipeBanco | null
  const nomeCategoria = categoria?.nome ?? ''
  const nomeEquipe = time?.nome ?? ''

  let inscricaoId: string | null = null
  if (entrada.decisao === 'APROVADA') {
    const reverter = async () => {
      await db.from('SolicitacaoInscricao').update({ estado: 'PENDENTE', decididoPor: null, decididoEm: null, motivoRecusa: null }).eq('id', id).eq('estado', 'APROVADA')
    }
    try {
      if (!time || !categoria) throw new ErroMeuTime('A equipe ou a categoria não está mais disponível.', 409, 'SOLICITACAO_INDISPONIVEL')
      const resultado = await inscrever(String(solicitacao.solicitadoPor ?? organizadorId), time, categoria, await tokenDoServidor(categoria))
      inscricaoId = resultado.resumo.id
    } catch (erro) {
      if (erro instanceof ErroMeuTime && erro.codigo === 'JA_INSCRITA' && time && categoria) {
        // A equipe entrou por outro caminho enquanto esperava: a aprovação só vincula a inscrição viva.
        const existentes = ((await db.from('Inscricao').select('id,status').eq('timeId', time.id).eq('categoriaCampeonatoId', categoria.id)).data ?? []) as any[]
        inscricaoId = existentes.find((item) => inscricaoViva(String(item.status)))?.id ?? null
      }
      if (!inscricaoId) {
        await reverter()
        throw erro
      }
    }
    lerSolic(await db.from('SolicitacaoInscricao').update({ inscricaoId }).eq('id', id), 'vincular inscrição')
  }

  if (solicitacao.solicitadoPor) {
    const aprovada = entrada.decisao === 'APROVADA'
    await notificar(
      String(solicitacao.solicitadoPor),
      aprovada ? 'SOLICITACAO_APROVADA' : 'SOLICITACAO_RECUSADA',
      aprovada ? 'Inscrição aprovada' : 'Inscrição recusada',
      aprovada
        ? `${nomeEquipe} foi aprovada em ${nomeCategoria} (${liga.nome}).`
        : `${nomeEquipe} foi recusada em ${nomeCategoria} (${liga.nome}).${motivo ? ` Motivo: ${motivo}` : ''}`,
      { solicitacaoId: id, equipe: nomeEquipe, categoria: nomeCategoria, ...(motivo ? { motivo } : {}) },
    )
  }
  return { id, estado: entrada.decisao, inscricaoId }
}

// --- Organizador: modo da categoria --------------------------------------------------

async function exigirCategoriaDoOrganizador(organizadorId: string, categoriaId: string) {
  const naoEncontrada = () => new ErroMeuTime('Categoria não encontrada.', 404, 'CATEGORIA_NAO_ENCONTRADA')
  if (!idValido(categoriaId)) throw naoEncontrada()
  const linha = lerDados(
    await db.from('CategoriaCampeonato').select('id,ligaId').eq('id', categoriaId).is('removidaEm', null).maybeSingle(),
    'categoria',
  ) as { id: string; ligaId: number } | null
  if (!linha) throw naoEncontrada()
  const liga = await lerLiga(Number(linha.ligaId))
  if (!liga || String(liga.organizadorId) !== organizadorId) throw naoEncontrada()
  return { categoria: linha, liga }
}

export async function lerModoDaCategoria(organizadorId: string, categoriaId: string) {
  const { categoria } = await exigirCategoriaDoOrganizador(organizadorId, categoriaId)
  const linha = lerSolic(
    await db.from('CategoriaCampeonato').select('id,modoInscricao').eq('id', categoria.id).maybeSingle(),
    'modo de inscrição',
  ) as { modoInscricao?: string | null } | null
  return { categoriaId: categoria.id, ligaId: Number(categoria.ligaId), modoInscricao: modoDe(linha) }
}

export async function gravarModoDaCategoria(organizadorId: string, categoriaId: string, modo: ModoInscricao) {
  const { categoria, liga } = await exigirCategoriaDoOrganizador(organizadorId, categoriaId)
  if (String(liga.status).toUpperCase() === 'FINALIZADO') {
    throw new ErroMeuTime('Este campeonato está finalizado e disponível apenas para consulta.', 409, 'CAMPEONATO_FINALIZADO')
  }
  const gravada = await db.from('CategoriaCampeonato').update({ modoInscricao: modo }).eq('id', categoria.id).select('id')
  if (gravada.error && recursoAusente(gravada.error)) throw indisponivel()
  lerDados(gravada, 'gravar modo de inscrição')
  return { categoriaId: categoria.id, ligaId: Number(categoria.ligaId), modoInscricao: modo }
}

// --- Organizador: notificações ---------------------------------------------------------

export const notificacoesDoOrganizador = listarNotificacoes
export const marcarNotificacaoDoOrganizador = marcarLida
