// Explorar competições (R18): vitrine para líder, técnico e assistente logados. Só competições PÚBLICAS e publicadas
// (privada só por convite, como já é); o selo de elegibilidade é calculado no servidor contra o banco de atletas do
// time. A resposta não leva dado pessoal: organizador aparece pelo nome da organização.
import { supabaseAdmin } from '@/lib/supabase-admin'
import { campeonatoPublicado } from '@/lib/campeonato-publico'
import { normalizarElegibilidade } from '@/lib/elegibilidade-categoria'
import { registrationWindowDecision } from '@/lib/team-registration-draft'
import { idsCompeticoesPrivadas } from '@/lib/visibilidade-competicao'
import { ErroMeuTime, idValido } from '@/lib/meu-time/acesso'
import { lerExplorar } from './acesso'
import { exigirEquipe, listarAtletasDoClube, type EquipeBanco } from '@/lib/meu-time/dados'
import { paraRegra } from '@/lib/meu-time/inscricao'
import { NAIPES, type AtletaDoBanco } from '@/lib/meu-time/regras'
import { naipeDaCategoria } from '@/lib/inscricoes-solicitacao/servico'
import { STATUS_OCUPA_VAGA } from '@/lib/painel-inscricoes/regras'
import { pagamentoComprovanteAtivo } from '@/lib/pagamento-comprovante/config'
import { configDaLinha, valorInscricaoParaExplorar } from '@/lib/pagamento-comprovante/regras'
import { calcularSelo, type Selo } from './selo'

const db = supabaseAdmin as any

export const TAMANHO_PAGINA = 20

export type FiltroCompeticoes = {
  equipeId?: string | null
  cidade?: string | null
  de?: string | null
  ate?: string | null
  categoria?: string | null
  naipe?: string | null
  abertas?: string | null
  q?: string | null
  pagina?: string | null
}

export type ItemCompeticao = {
  ligaId: number
  categoriaId: string
  campeonato: string
  organizador: string
  categoria: string
  naipe: string | null
  cidade: string | null
  local: string | null
  inicio: string | null
  fim: string | null
  prazoInscricao: string | null
  vagasTotal: number | null
  vagasRestantes: number | null
  valorInscricao: number | null
  modo: 'AUTOMATICA' | 'APROVACAO'
  situacao: 'ABERTA' | 'INSCRITA' | 'LOTADA' | 'ENCERRADA' | 'EM_BREVE'
  /** Nulo quando a consulta não informa equipeId. */
  selo: Selo | null
  privada: false
}

const dados = (mensagem: string) => new ErroMeuTime(mensagem, 422, 'DADOS_INVALIDOS')

function semAcento(texto: unknown) {
  return String(texto ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

function diaValido(valor: string | null | undefined, campo: string) {
  if (!valor) return null
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor) || Number.isNaN(new Date(`${valor}T00:00:00Z`).getTime())) throw dados(`Data inválida em "${campo}".`)
  return valor
}

function validar(filtro: FiltroCompeticoes) {
  const pagina = filtro.pagina ? Number(filtro.pagina) : 1
  if (!Number.isInteger(pagina) || pagina < 1 || pagina > 10_000) throw dados('Página inválida.')
  const naipe = filtro.naipe ? filtro.naipe.toUpperCase() : null
  if (naipe && !(NAIPES as readonly string[]).includes(naipe)) throw dados('Naipe inválido.')
  if (filtro.equipeId && !idValido(filtro.equipeId)) throw new ErroMeuTime('Equipe não encontrada.', 404, 'EQUIPE_NAO_ENCONTRADA')
  return { pagina, naipe, de: diaValido(filtro.de, 'de'), ate: diaValido(filtro.ate, 'ate') }
}

const positivo = (v: unknown) => (Number.isInteger(Number(v)) && Number(v) > 0 ? Number(v) : null)

export async function listarCompeticoes(usuarioId: string, filtro: FiltroCompeticoes, agora = new Date()) {
  const { pagina, naipe: naipeFiltro, de, ate } = validar(filtro)

  // Equipe escolhida: posse conferida (leitura serve a líder, técnico e assistente). Outra equipe = 404.
  let equipe: EquipeBanco | null = null
  let atletas: AtletaDoBanco[] = []
  const inscritas = new Set<string>()
  if (filtro.equipeId) {
    equipe = (await exigirEquipe(usuarioId, filtro.equipeId, 'leitura')).equipe
    atletas = (await listarAtletasDoClube(equipe.clubeId)).map((linha) => ({
      id: String(linha.id),
      nome: '',
      dataNascimento: linha.dataNascimento ? String(linha.dataNascimento).slice(0, 10) : null,
      sexo: linha.sexo ?? null,
      temDocumento: true,
    }))
    const minhas = (lerExplorar(await db.from('Inscricao').select('categoriaCampeonatoId,status').eq('timeId', equipe.id), 'inscrições da equipe') as any[] | null) ?? []
    for (const i of minhas) if (i.status !== 'REMOVIDA') inscritas.add(String(i.categoriaCampeonatoId))
  }

  const ligas = ((lerExplorar(await db.from('Liga').select('*').in('status', ['EM_BREVE', 'ATIVA']), 'campeonatos') as any[] | null) ?? []).filter((l) => campeonatoPublicado(l))
  const privadas = await idsCompeticoesPrivadas({ semCache: true })
  const publicas = ligas.filter((l) => !privadas.has(Number(l.id)))
  if (publicas.length === 0) return { itens: [] as ItemCompeticao[], total: 0 }
  const ligaIds = publicas.map((l) => Number(l.id))

  const categorias = (lerExplorar(await db.from('CategoriaCampeonato').select('*').in('ligaId', ligaIds).is('removidaEm', null), 'categorias') as any[] | null) ?? []
  const categoriaIds = categorias.map((c) => c.id as string)
  const orgIds = Array.from(new Set(publicas.map((l) => l.organizadorId).filter(Boolean).map(String)))
  const [configs, regras, organizadores, locais, ocupadas] = await Promise.all([
    db.from('CategoriaConfiguracao').select('*').in('categoriaCampeonatoId', categoriaIds),
    db.from('RegraElenco').select('*').in('categoriaCampeonatoId', categoriaIds),
    orgIds.length ? db.from('CandidaturaOrganizador').select('id,nome,organizacao').in('id', orgIds) : Promise.resolve({ data: [] }),
    db.from('LigaLocal').select('ligaId,nome,ordem').in('ligaId', ligaIds),
    db.from('Inscricao').select('categoriaCampeonatoId,status').in('categoriaCampeonatoId', categoriaIds).in('status', [...STATUS_OCUPA_VAGA]),
  ])
  const configPorCategoria = new Map<string, any>((configs.error ? [] : configs.data ?? []).map((c: any) => [c.categoriaCampeonatoId, c]))
  const regraPorCategoria = new Map<string, any>((regras.error ? [] : regras.data ?? []).map((r: any) => [r.categoriaCampeonatoId, r]))
  const organizadorPorId = new Map<string, any>((organizadores.error ? [] : organizadores.data ?? []).map((o: any) => [String(o.id), o]))
  const localPorLiga = new Map<number, string>()
  for (const l of ((locais.error ? [] : locais.data ?? []) as any[]).sort((a, b) => Number(a.ordem ?? 0) - Number(b.ordem ?? 0))) {
    if (!localPorLiga.has(Number(l.ligaId))) localPorLiga.set(Number(l.ligaId), String(l.nome ?? ''))
  }
  const ocupadasPorCategoria = new Map<string, number>()
  for (const i of (ocupadas.error ? [] : ocupadas.data ?? []) as any[]) {
    ocupadasPorCategoria.set(i.categoriaCampeonatoId, (ocupadasPorCategoria.get(i.categoriaCampeonatoId) ?? 0) + 1)
  }

  const itens: ItemCompeticao[] = []
  for (const categoria of categorias) {
    const liga = publicas.find((l) => Number(l.id) === Number(categoria.ligaId))
    if (!liga) continue
    const cfg = configPorCategoria.get(categoria.id)
    const elegibilidade = normalizarElegibilidade(cfg ?? null)
    const naipeCategoria = elegibilidade.genero ?? naipeDaCategoria(categoria.codigo)
    const organizacao = organizadorPorId.get(String(liga.organizadorId))
    const vagasTotal = positivo(cfg?.quantidadeEquipesMaxima) ?? positivo(cfg?.quantidadeEquipes) ?? positivo(liga.quantidadeEquipesMaxima) ?? positivo(liga.quantidadeEquipes)
    const vagasRestantes = vagasTotal == null ? null : Math.max(0, vagasTotal - (ocupadasPorCategoria.get(categoria.id) ?? 0))
    const janela = registrationWindowDecision(liga, agora)
    const jaInscrita = inscritas.has(categoria.id)
    const emBreve = !janela.allowed && liga.inscricoesAberturaEm && new Date(liga.inscricoesAberturaEm) > agora
    const situacao: ItemCompeticao['situacao'] = jaInscrita
      ? 'INSCRITA'
      : !janela.allowed ? (emBreve ? 'EM_BREVE' : 'ENCERRADA') : vagasRestantes === 0 ? 'LOTADA' : 'ABERTA'

    itens.push({
      ligaId: Number(liga.id),
      categoriaId: categoria.id,
      campeonato: String(liga.nome ?? ''),
      organizador: String(organizacao?.organizacao || organizacao?.nome || ''),
      categoria: String(categoria.nome ?? ''),
      naipe: naipeCategoria,
      // Sem fonte garantida: só lê "Liga"."cidade" se a coluna existir neste banco; senão null.
      cidade: typeof liga.cidade === 'string' && liga.cidade.trim() ? liga.cidade.trim() : null,
      local: localPorLiga.get(Number(liga.id)) ?? null,
      inicio: cfg?.dataInicio ?? liga.dataInicio ?? null,
      fim: cfg?.dataFim ?? liga.dataFim ?? null,
      prazoInscricao: cfg?.inscricoesEncerramentoEm ?? liga.inscricoesEncerramentoEm ?? null,
      vagasTotal,
      vagasRestantes,
      // R19 (PAGAMENTO_COMPROVANTE_ATIVO): vem de CategoriaConfiguracao.valorInscricaoCentavos / 100 (nulo se não definido;
      // 0 só com modo NENHUM e valor explícito 0, que a tela mostra como "Gratuito"). Sem a flag ou sem a coluna: nulo.
      valorInscricao: pagamentoComprovanteAtivo() ? valorInscricaoParaExplorar(configDaLinha(cfg ?? null)) : null,
      modo: categoria.modoInscricao === 'APROVACAO' ? 'APROVACAO' : 'AUTOMATICA',
      situacao,
      selo: !equipe ? null : calcularSelo({
        naipeEquipe: equipe?.naipe ?? null,
        atletas,
        naipeCategoria,
        regra: paraRegra(regraPorCategoria.get(categoria.id) ?? null),
        elegibilidade,
        janelaAberta: janela.allowed,
        janelaMotivo: janela.allowed ? null : janela.reason,
        vagasRestantes,
        jaInscrita,
        hoje: agora,
      }),
      privada: false,
    })
  }

  const termoCidade = semAcento(filtro.cidade)
  // Sem coluna de cidade no banco (nenhum item tem cidade) o filtro é ignorado, sem erro.
  const filtrarCidade = Boolean(termoCidade) && itens.some((i) => i.cidade)
  const termoCategoria = semAcento(filtro.categoria)
  const termoBusca = semAcento(filtro.q)
  const filtrados = itens.filter((i) => {
    if (filtrarCidade && !semAcento(i.cidade).includes(termoCidade)) return false
    if (naipeFiltro && i.naipe !== naipeFiltro) return false
    if (termoCategoria && !semAcento(i.categoria).includes(termoCategoria)) return false
    if (filtro.abertas === '1' && i.situacao !== 'ABERTA') return false
    if (termoBusca && !semAcento(`${i.campeonato} ${i.organizador} ${i.categoria}`).includes(termoBusca)) return false
    if (de || ate) {
      // Sem datas não dá para dizer que cai no período: fica de fora quando o filtro de data é usado.
      if (!i.inicio && !i.fim) return false
      const comeco = (i.inicio ?? i.fim)!.slice(0, 10)
      const termino = (i.fim ?? i.inicio)!.slice(0, 10)
      if (de && termino < de) return false
      if (ate && comeco > ate) return false
    }
    return true
  })
  filtrados.sort((a, b) => (a.inicio ?? '9999').localeCompare(b.inicio ?? '9999') || a.campeonato.localeCompare(b.campeonato, 'pt-BR') || a.categoria.localeCompare(b.categoria, 'pt-BR'))
  const inicio = (pagina - 1) * TAMANHO_PAGINA
  return { itens: filtrados.slice(inicio, inicio + TAMANHO_PAGINA), total: filtrados.length }
}
