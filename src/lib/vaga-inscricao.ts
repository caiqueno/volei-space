import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { normalizarNomeEquipe } from '@/lib/nome-equipe'
import { novoTokenInscricao } from '@/lib/link-inscricao-campeonato'
import {
  getRegistrationDraftByToken,
  registrationWindowDecision,
  type RegistrationLeague,
  RegistrationDraftError,
} from '@/lib/team-registration-draft'

export function caminhoInscricaoVaga(token: string) {
  return `/inscricao/vaga/${token}`
}

export function nomeDaVaga(vaga: number, nome?: string | null) {
  const texto = nome?.trim()
  if (texto && !/^Equipe \d+$/i.test(texto)) return normalizarNomeEquipe(texto)
  return normalizarNomeEquipe(`Equipe ${String(vaga).padStart(2, '0')}`)
}

type CategoriaVaga = {
  id: string
  nome: string
  codigo: string
  quantidade: number
}

export async function listarVagasDaCategoria(ligaId: number, categoriaId: string | null) {
  const [{ data: liga, error: ligaErr }, { data: categorias, error: catErr }] = await Promise.all([
    supabase.from('Liga').select('id,quantidadeEquipes').eq('id', ligaId).maybeSingle(),
    supabase.from('CategoriaCampeonato').select('id,nome,codigo,ordem').eq('ligaId', ligaId).is('removidaEm', null).order('ordem', { ascending: true }),
  ])
  if (ligaErr || catErr) throw new Error('Não foi possível ler as categorias.')
  if (!liga) throw new RegistrationDraftError('Campeonato não encontrado.', 404)
  const lista = categorias ?? []
  const escolhida = lista.find((item) => item.id === categoriaId) ?? lista[0] ?? null
  if (!escolhida) return { categorias: [] as CategoriaVaga[], categoriaId: null, quantidade: 0, vagas: [] as VagaLinha[] }

  const { data: config } = await supabase
    .from('CategoriaConfiguracao')
    .select('quantidadeEquipes')
    .eq('categoriaCampeonatoId', escolhida.id)
    .maybeSingle()
  const quantidade = Number(config?.quantidadeEquipes ?? liga.quantidadeEquipes ?? 0)
  const total = Number.isInteger(quantidade) && quantidade > 0 ? quantidade : 0

  const { data: convites, error: conviteErr } = await supabase
    .from('ConviteVagaEquipe')
    .select('vaga,token,inscricaoRascunhoId,equipeId')
    .eq('ligaId', ligaId)
    .eq('categoriaCampeonatoId', escolhida.id)
    .order('vaga', { ascending: true })
  if (conviteErr) throw new Error(conviteErr.message)
  const linhas = convites ?? []
  const rascunhoIds = linhas.map((item) => item.inscricaoRascunhoId).filter((id): id is string => Boolean(id))
  const equipeIds = linhas.map((item) => item.equipeId).filter((id): id is number => Number.isInteger(id))
  const [{ data: rascunhos }, { data: equipes }] = await Promise.all([
    rascunhoIds.length ? supabase.from('InscricaoEquipeRascunho').select('id,nomeEquipe').in('id', rascunhoIds) : Promise.resolve({ data: [] }),
    equipeIds.length ? supabase.from('Equipe').select('id,nome').in('id', equipeIds) : Promise.resolve({ data: [] }),
  ])
  const nomeRascunho = new Map((rascunhos ?? []).map((item) => [item.id, item.nomeEquipe]))
  const nomeEquipe = new Map((equipes ?? []).map((item) => [item.id, item.nome]))

  const porVaga = new Map(linhas.map((item) => [item.vaga, item]))
  const vagas = Array.from({ length: total }, (_, index) => {
    const vaga = index + 1
    const atual = porVaga.get(vaga)
    return {
      vaga,
      nome: nomeDaVaga(vaga, (atual?.inscricaoRascunhoId && nomeRascunho.get(atual.inscricaoRascunhoId)) || (atual?.equipeId ? nomeEquipe.get(atual.equipeId) : null)),
      caminho: atual?.token ? caminhoInscricaoVaga(atual.token) : null,
    }
  })

  return {
    categorias: lista.map((item) => ({ id: item.id, nome: item.nome, codigo: item.codigo, quantidade: item.id === escolhida.id ? total : 0 })),
    categoriaId: escolhida.id,
    quantidade: total,
    vagas,
  }
}

export type VagaLinha = { vaga: number; nome: string; caminho: string | null }

export async function gerarLinkDaVaga(ligaId: number, categoriaId: string, vaga: number) {
  if (!Number.isInteger(vaga) || vaga < 1) throw new RegistrationDraftError('Vaga inválida.', 422)
  const quadro = await listarVagasDaCategoria(ligaId, categoriaId)
  if (quadro.categoriaId !== categoriaId) throw new RegistrationDraftError('Esta categoria não pertence ao campeonato.', 404)
  if (vaga > quadro.quantidade) throw new RegistrationDraftError('Essa vaga passa da quantidade de equipes parametrizada.', 422)
  const existente = quadro.vagas.find((item) => item.vaga === vaga && item.caminho)
  if (existente?.caminho) return existente

  const token = novoTokenInscricao()
  const { error } = await supabase.from('ConviteVagaEquipe').insert({
    ligaId,
    categoriaCampeonatoId: categoriaId,
    vaga,
    token,
    status: 'DISPONIVEL',
  })
  if (error && !/duplicate|unique/i.test(error.message)) throw new Error(error.message)

  const { data } = await supabase
    .from('ConviteVagaEquipe')
    .select('token')
    .eq('ligaId', ligaId)
    .eq('categoriaCampeonatoId', categoriaId)
    .eq('vaga', vaga)
    .maybeSingle()
  if (!data?.token) throw new RegistrationDraftError('Não foi possível gerar o link.', 500)
  return { vaga, nome: nomeDaVaga(vaga), caminho: caminhoInscricaoVaga(data.token) }
}

export async function abrirInscricaoDaVaga(token: string) {
  const { data: vaga, error } = await supabase
    .from('ConviteVagaEquipe')
    .select('id,ligaId,categoriaCampeonatoId,vaga,inscricaoRascunhoId')
    .eq('token', token)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!vaga) throw new RegistrationDraftError('Link de inscrição inválido ou inexistente.', 404)
  const { data: categoria } = await supabase
    .from('CategoriaCampeonato')
    .select('id,codigo,nome,removidaEm')
    .eq('id', vaga.categoriaCampeonatoId)
    .maybeSingle()
  if (!categoria || categoria.removidaEm) throw new RegistrationDraftError('Link de inscrição inválido ou inexistente.', 404)

  let rascunhoId = vaga.inscricaoRascunhoId as string | null
  if (!rascunhoId) {
    const { data: liga, error: ligaErr } = await supabase.from('Liga').select('id,nome,status,inscricoesAbertas,inscricoesAberturaEm,inscricoesEncerramentoEm').eq('id', vaga.ligaId).maybeSingle()
    if (ligaErr || !liga) throw new RegistrationDraftError('Campeonato não encontrado.', 404)
    const janela = registrationWindowDecision(liga as RegistrationLeague)
    if (!janela.allowed) throw new RegistrationDraftError(janela.reason || 'Inscrições indisponíveis.', 403)
    const nome = nomeDaVaga(vaga.vaga)
    const { data: criado, error: criarErr } = await supabase.from('InscricaoEquipeRascunho').insert({
      ligaId: vaga.ligaId,
      nomeEquipe: normalizarNomeEquipe(nome),
      categoria: categoria.codigo,
      serie: null,
      categoriaCampeonatoId: vaga.categoriaCampeonatoId,
      status: 'NAO_INICIADO',
    }).select('id').single()
    if (criarErr || !criado) throw new RegistrationDraftError('Não foi possível abrir a inscrição.', 500)
    const { data: ligado } = await supabase
      .from('ConviteVagaEquipe')
      .update({ inscricaoRascunhoId: criado.id, atualizadoEm: new Date().toISOString(), status: 'EM_PREENCHIMENTO' })
      .eq('id', vaga.id)
      .is('inscricaoRascunhoId', null)
      .select('inscricaoRascunhoId')
      .maybeSingle()
    if (!ligado) {
      await supabase.from('InscricaoEquipeRascunho').delete().eq('id', criado.id)
      const { data: atual } = await supabase.from('ConviteVagaEquipe').select('inscricaoRascunhoId').eq('id', vaga.id).maybeSingle()
      rascunhoId = atual?.inscricaoRascunhoId ?? null
    } else {
      rascunhoId = criado.id
    }
  }
  if (!rascunhoId) throw new RegistrationDraftError('Não foi possível abrir a inscrição.', 500)

  const { data: rascunho, error: rascunhoErr } = await supabase.from('InscricaoEquipeRascunho').select('token').eq('id', rascunhoId).maybeSingle()
  if (rascunhoErr || !rascunho?.token) throw new RegistrationDraftError('Inscrição não encontrada.', 404)
  const contexto = await getRegistrationDraftByToken(rascunho.token)
  return { ...contexto, categoria: { codigo: categoria.codigo, nome: categoria.nome } }
}
