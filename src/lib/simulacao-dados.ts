import bcrypt from 'bcryptjs'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { isCampeonatoFinalizado } from '@/lib/championship-finalization'
import { recalculateLeagueClassification } from '@/lib/championship-operations'
import {
  EMAIL_ARBITRO_SIMULACAO,
  type PlacarSimulacao,
  type VelocidadeSimulacao,
  avancarPlacar,
  definirVelocidade,
  lerPlacar,
  pausarPlacar,
  podeApagarSimulacao,
  podeEncerrarPartida,
  podeIniciarPartida,
  placarInicial,
  retomarPlacar,
  setsParaVencer,
} from '@/lib/simulacao'

const EMAILS = ['simulacao-mesa@example.invalid', 'simulacao-auxiliar@example.invalid']
const SENHA_SIMULACAO_DEV = 'teste123456'

let organizadorSimulacao: Promise<string | null> | null = null

function idOrganizadorSimulacao() {
  organizadorSimulacao ??= Promise.resolve(supabaseAdmin
    .from('CandidaturaOrganizador')
    .select('id')
    .ilike('email', 'organizador@volei.space')
    .maybeSingle()
    .then(({ data }) => (data?.id ? String(data.id) : null)))
  return organizadorSimulacao
}

type LigaSim = {
  id: number
  slug: string
  nome: string
  status: string
  simulacao: boolean
  inscricoesAbertas: boolean
  pontosPorSet: number | null
  diferencaMinimaSet: number | null
  setsPorPartida: number | null
  simulacaoRelogio: Record<string, PlacarSimulacao> | null
}

function relogios(liga: LigaSim) {
  return liga.simulacaoRelogio && typeof liga.simulacaoRelogio === 'object' ? liga.simulacaoRelogio : {}
}

async function ligasSimulacao() {
  const { data, error } = await supabaseAdmin
    .from('Liga')
    .select('id,slug,nome,status,simulacao,inscricoesAbertas,pontosPorSet,diferencaMinimaSet,setsPorPartida,simulacaoRelogio')
    .eq('simulacao', true)
    .order('id', { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []) as LigaSim[]
}

export async function limparSimulacao() {
  const ligas = await ligasSimulacao()
  const ids = ligas.filter((liga) => podeApagarSimulacao(liga)).map((liga) => liga.id)
  if (ids.length === 0) {
    await removerArbitrosSimulacao()
    return { removidas: 0 }
  }

  const { data: partidas, error: partidasErr } = await supabaseAdmin.from('Partida').select('id').in('ligaId', ids)
  if (partidasErr) throw new Error(partidasErr.message)
  const partidaIds = (partidas ?? []).map((partida) => partida.id)

  if (partidaIds.length > 0) {
    for (const tabela of ['SetPartida', 'EscalaArbitro', 'OcorrenciaPartida', 'SumulaPresenca', 'CandidaturaPartidaArbitro']) {
      const { error } = await supabaseAdmin.from(tabela).delete().in('partidaId', partidaIds)
      if (error) throw new Error(error.message)
    }
    const { error } = await supabaseAdmin.from('Partida').delete().in('id', partidaIds)
    if (error) throw new Error(error.message)
  }

  const { data: equipes, error: equipesErr } = await supabaseAdmin.from('Equipe').select('id').in('ligaId', ids)
  if (equipesErr) throw new Error(equipesErr.message)
  const equipeIds = (equipes ?? []).map((equipe) => equipe.id)
  if (equipeIds.length > 0) {
    const { error: classErr } = await supabaseAdmin.from('ClassificacaoEntrada').delete().in('equipeId', equipeIds)
    if (classErr) throw new Error(classErr.message)
    const { error } = await supabaseAdmin.from('Jogador').delete().in('equipeId', equipeIds)
    if (error) throw new Error(error.message)
  }
  for (const tabela of ['InscricaoCampeonato', 'Equipe']) {
    const { error } = await supabaseAdmin.from(tabela).delete().in('ligaId', ids)
    if (error) throw new Error(error.message)
  }

  await removerArbitrosSimulacao()

  const { error: ligaErr } = await supabaseAdmin.from('Liga').delete().in('id', ids).eq('simulacao', true)
  if (ligaErr) throw new Error(ligaErr.message)
  return { removidas: ids.length }
}

async function removerArbitrosSimulacao() {
  const { error: candidaturaErr } = await supabaseAdmin.from('CandidaturaArbitro').delete().in('email', EMAILS)
  if (candidaturaErr) throw new Error(candidaturaErr.message)
  const { data: arbitros } = await supabaseAdmin.from('Arbitro').select('id,email').in('email', EMAILS)
  const arbitroIds = (arbitros ?? []).filter((arbitro) => EMAIL_ARBITRO_SIMULACAO.test(String(arbitro.email))).map((arbitro) => arbitro.id)
  if (arbitroIds.length === 0) return
  const { error } = await supabaseAdmin.from('Arbitro').delete().in('id', arbitroIds)
  if (error) throw new Error(error.message)
}

async function criarLiga(entrada: { slug: string; nome: string; status: string; inscricoesAbertas: boolean; descricao: string }) {
  const { data, error } = await supabaseAdmin
    .from('Liga')
    .insert({
      ...entrada,
      simulacao: true,
      organizadorId: await idOrganizadorSimulacao(),
      simulacaoRelogio: {},
      formato: 'GRUPOS',
      pontosPorSet: 25,
      diferencaMinimaSet: 2,
      setsPorPartida: 3,
      corTematica: '#0F2C52',
    })
    .select('id')
    .single()
  if (error || !data) throw new Error(error?.message || 'Não foi possível criar o campeonato de simulação.')
  return data.id as number
}

async function garantirCategoria(ligaId: number, codigo: string) {
  const { data: existente } = await supabaseAdmin
    .from('CategoriaCampeonato')
    .select('id')
    .eq('ligaId', ligaId)
    .eq('codigo', codigo)
    .is('removidaEm', null)
    .maybeSingle()
  if (existente?.id) return existente.id as string
  const nomes: Record<string, string> = { FEMININO: 'Feminino', MASCULINO: 'Masculino', MISTO: 'Misto' }
  const { data: criada, error } = await supabaseAdmin
    .from('CategoriaCampeonato')
    .insert({
      ligaId,
      codigo,
      nome: nomes[codigo] ?? codigo,
      slug: codigo.toLowerCase(),
      ordem: 0,
      statusConfiguracao: 'COPIADA_REVISAR',
    })
    .select('id')
    .single()
  if (error || !criada) throw new Error(error?.message || 'Não foi possível criar a categoria da simulação.')
  const { error: configErr } = await supabaseAdmin.from('CategoriaConfiguracao').insert({
    categoriaCampeonatoId: criada.id,
    ligaId,
    formato: 'GRUPOS_MATA_MATA',
  })
  if (configErr && configErr.code !== '23505') throw new Error(configErr.message)
  return criada.id as string
}

async function criarEquipe(ligaId: number, nome: string, categoria: string) {
  const categoriaCampeonatoId = await garantirCategoria(ligaId, categoria)
  const { data, error } = await supabaseAdmin
    .from('Equipe')
    .insert({
      ligaId,
      nome,
      categoria,
      categoriaCampeonatoId,
      serie: null,
      statusEquipe: 'ATIVA',
      slug: `sim-${ligaId}-${nome.toLowerCase().replace(/\s+/g, '-')}`,
    })
    .select('id')
    .single()
  if (error || !data) throw new Error(error?.message || 'Não foi possível criar a equipe de simulação.')
  const atletas = ['Ana Lima', 'Bia Costa', 'Caio Nunes', 'Duda Pires'].map((nomeAtleta, index) => ({
    equipeId: data.id,
    nome: `${nomeAtleta} ${nome.split(' ')[0]}`,
    numero: index + 1,
    posicao: index === 3 ? 'Líbero' : 'Ponteira',
  }))
  const { error: jogadorErr } = await supabaseAdmin.from('Jogador').insert(atletas)
  if (jogadorErr) throw new Error(jogadorErr.message)
  return data.id as number
}

async function inscrever(ligaId: number, equipeId: number, status: 'APROVADA' | 'SOLICITADA') {
  const agora = new Date().toISOString()
  const { data: equipe, error: equipeErr } = await supabaseAdmin.from('Equipe').select('categoriaCampeonatoId').eq('id', equipeId).single()
  if (equipeErr || !equipe?.categoriaCampeonatoId) throw new Error(equipeErr?.message || 'Equipe sem categoria.')
  const { error } = await supabaseAdmin.from('InscricaoCampeonato').insert({
    id: `sim-insc-${ligaId}-${equipeId}`,
    ligaId,
    equipeId,
    categoriaCampeonatoId: equipe.categoriaCampeonatoId,
    status,
    criadaEm: agora,
    atualizadaEm: agora,
  })
  if (error) throw new Error(error.message)
}

async function registrarEvento(partidaId: number, descricao: string, set: number | null) {
  const { error } = await supabaseAdmin.from('OcorrenciaPartida').insert({
    partidaId,
    tipo: 'OBSERVACAO',
    descricao,
    set,
  })
  if (error) throw new Error(error.message)
}

async function criarPartida(entrada: {
  ligaId: number
  equipeAId: number
  equipeBId: number
  status: string
  rodada: number
  dataHora: string
  localNome: string
  sets?: Array<{ numero: number; pontosA: number; pontosB: number }>
  setsPorA?: number
  setsPorB?: number
  vencedorId?: number
}) {
  const token = `sim-${entrada.ligaId}-${entrada.rodada}-${entrada.equipeAId}-${entrada.equipeBId}`
  const { data: equipeA } = await supabaseAdmin.from('Equipe').select('categoriaCampeonatoId,categoria').eq('id', entrada.equipeAId).single()
  const { data, error } = await supabaseAdmin
    .from('Partida')
    .insert({
      ligaId: entrada.ligaId,
      equipeAId: entrada.equipeAId,
      equipeBId: entrada.equipeBId,
      categoria: equipeA?.categoria ?? 'MISTO',
      categoriaCampeonatoId: equipeA?.categoriaCampeonatoId,
      serie: null,
      rodada: entrada.rodada,
      status: entrada.status,
      dataHora: entrada.dataHora,
      localNome: entrada.localNome,
      setsPorA: entrada.setsPorA ?? null,
      setsPorB: entrada.setsPorB ?? null,
      vencedorId: entrada.vencedorId ?? null,
      sumulaToken: token,
    })
    .select('id')
    .single()
  if (error || !data) throw new Error(error?.message || 'Não foi possível criar a partida de simulação.')
  if (entrada.sets?.length) {
    const { error: setErr } = await supabaseAdmin.from('SetPartida').insert(entrada.sets.map((set) => ({ ...set, partidaId: data.id })))
    if (setErr) throw new Error(setErr.message)
  }
  return data.id as number
}

export async function recriarSimulacao() {
  await limparSimulacao()
  const agora = new Date()
  const daqui = (horas: number) => new Date(agora.getTime() + horas * 3600_000).toISOString()

  const { data: arbitroMesa, error: mesaErr } = await supabaseAdmin
    .from('Arbitro')
    .insert({ nome: 'Mesa Simulação', email: EMAILS[0], aprovado: true })
    .select('id')
    .single()
  if (mesaErr || !arbitroMesa) throw new Error(mesaErr?.message || 'Não foi possível criar o árbitro de simulação.')
  const { data: arbitroAux, error: auxErr } = await supabaseAdmin
    .from('Arbitro')
    .insert({ nome: 'Auxiliar Simulação', email: EMAILS[1], aprovado: true })
    .select('id')
    .single()
  if (auxErr || !arbitroAux) throw new Error(auxErr?.message || 'Não foi possível criar o segundo árbitro de simulação.')

  const senhaHash = await bcrypt.hash(SENHA_SIMULACAO_DEV, 10)
  const organizadorId = await idOrganizadorSimulacao()
  const candidaturaMesaId = `sim-arb-${arbitroMesa.id}`
  const { error: contaErr } = await supabaseAdmin.from('CandidaturaArbitro').insert([
    {
      id: candidaturaMesaId,
      nome: 'Mesa Simulação',
      email: EMAILS[0],
      status: 'APROVADA',
      arbitroId: arbitroMesa.id,
      organizadorId,
      trocarSenha: false,
      senhaHash,
      criadaEm: new Date().toISOString(),
      atualizadaEm: new Date().toISOString(),
    },
    {
      id: `sim-arb-${arbitroAux.id}`,
      nome: 'Auxiliar Simulação',
      email: EMAILS[1],
      status: 'APROVADA',
      arbitroId: arbitroAux.id,
      organizadorId,
      trocarSenha: false,
      senhaHash,
      criadaEm: new Date().toISOString(),
      atualizadaEm: new Date().toISOString(),
    },
  ])
  if (contaErr) throw new Error(contaErr.message)

  await criarLiga({
    slug: 'sim-configuracao',
    nome: 'Simulação — Configuração',
    status: 'EM_BREVE',
    inscricoesAbertas: false,
    descricao: 'Campeonato de teste, ainda sem equipes. Não faz parte da operação real.',
  })

  const inscricoesId = await criarLiga({
    slug: 'sim-inscricoes',
    nome: 'Simulação — Inscrições abertas',
    status: 'ATIVA',
    inscricoesAbertas: true,
    descricao: 'Campeonato de teste com inscrições abertas e equipes fictícias.',
  })
  const areia = await criarEquipe(inscricoesId, 'Areia Alta', 'MISTO')
  const rede = await criarEquipe(inscricoesId, 'Rede Baixa', 'MISTO')
  await inscrever(inscricoesId, areia, 'SOLICITADA')
  await inscrever(inscricoesId, rede, 'SOLICITADA')

  const operacaoId = await criarLiga({
    slug: 'sim-operacao',
    nome: 'Simulação — Operação',
    status: 'ATIVA',
    inscricoesAbertas: false,
    descricao: 'Campeonato de teste com confrontos, árbitros e partidas em situações diferentes.',
  })
  const norte = await criarEquipe(operacaoId, 'Quadra Norte', 'MISTO')
  const sul = await criarEquipe(operacaoId, 'Quadra Sul', 'MISTO')
  const leste = await criarEquipe(operacaoId, 'Bloqueio Leste', 'MISTO')
  const oeste = await criarEquipe(operacaoId, 'Saque Oeste', 'MISTO')
  const centro = await criarEquipe(operacaoId, 'Ataque Centro', 'MISTO')
  const fundo = await criarEquipe(operacaoId, 'Defesa Fundo', 'MISTO')
  for (const equipeId of [norte, sul, leste, oeste, centro, fundo]) {
    await inscrever(operacaoId, equipeId, 'APROVADA')
  }

  const semArbitro = await criarPartida({
    ligaId: operacaoId, equipeAId: norte, equipeBId: sul, status: 'AGENDADA', rodada: 1, dataHora: daqui(4), localNome: 'Ginásio da Simulação',
  })
  const aguardando = await criarPartida({
    ligaId: operacaoId, equipeAId: leste, equipeBId: oeste, status: 'AGENDADA', rodada: 1, dataHora: daqui(5), localNome: 'Ginásio da Simulação',
  })
  const designada = await criarPartida({
    ligaId: operacaoId, equipeAId: norte, equipeBId: leste, status: 'AGENDADA', rodada: 2, dataHora: daqui(26), localNome: 'Quadra 1',
  })
  const andamento = await criarPartida({
    ligaId: operacaoId, equipeAId: sul, equipeBId: oeste, status: 'EM_ANDAMENTO', rodada: 2, dataHora: agora.toISOString(), localNome: 'Quadra 2',
  })
  const andamentoDois = await criarPartida({
    ligaId: operacaoId, equipeAId: centro, equipeBId: fundo, status: 'EM_ANDAMENTO', rodada: 2, dataHora: agora.toISOString(), localNome: 'Quadra 3',
  })
  const encerrada = await criarPartida({
    ligaId: operacaoId,
    equipeAId: norte,
    equipeBId: oeste,
    status: 'ENCERRADA',
    rodada: 3,
    dataHora: daqui(-5),
    localNome: 'Quadra 1',
    setsPorA: 2,
    setsPorB: 0,
    vencedorId: norte,
    sets: [{ numero: 1, pontosA: 25, pontosB: 18 }, { numero: 2, pontosA: 25, pontosB: 21 }],
  })

  const { error: escalaErr } = await supabaseAdmin.from('EscalaArbitro').insert([
    { partidaId: designada, arbitroId: arbitroMesa.id, cargo: 'PRIMEIRO_ARBITRO' },
    { partidaId: andamento, arbitroId: arbitroMesa.id, cargo: 'PRIMEIRO_ARBITRO' },
    { partidaId: andamentoDois, arbitroId: arbitroAux.id, cargo: 'PRIMEIRO_ARBITRO' },
    { partidaId: encerrada, arbitroId: arbitroAux.id, cargo: 'PRIMEIRO_ARBITRO' },
  ])
  if (escalaErr) throw new Error(escalaErr.message)

  const { error: pedidoErr } = await supabaseAdmin.from('CandidaturaPartidaArbitro').insert({
    partidaId: aguardando,
    candidaturaArbitroId: candidaturaMesaId,
    status: 'SOLICITADA',
  })
  if (pedidoErr) throw new Error(pedidoErr.message)

  const relogio = placarInicial(Date.now(), 1)
  relogio.pontosA = 12
  relogio.pontosB = 9
  const relogioDois = placarInicial(Date.now(), 2)
  relogioDois.pontosA = 5
  relogioDois.pontosB = 3
  const { error: relogioErr } = await supabaseAdmin
    .from('Liga')
    .update({ simulacaoRelogio: { [String(andamento)]: relogio, [String(andamentoDois)]: relogioDois } })
    .eq('id', operacaoId)
    .eq('simulacao', true)
  if (relogioErr) throw new Error(relogioErr.message)
  await recalculateLeagueClassification(operacaoId)

  const finalizadoId = await criarLiga({
    slug: 'sim-finalizado',
    nome: 'Simulação — Finalizado',
    status: 'ENCERRADA',
    inscricoesAbertas: false,
    descricao: 'Campeonato de teste encerrado para consulta. Operações novas devem ser recusadas.',
  })
  const finalA = await criarEquipe(finalizadoId, 'Campeãs da Areia', 'MISTO')
  const finalB = await criarEquipe(finalizadoId, 'Rede Encerrada', 'MISTO')
  await inscrever(finalizadoId, finalA, 'APROVADA')
  await inscrever(finalizadoId, finalB, 'APROVADA')
  await criarPartida({
    ligaId: finalizadoId,
    equipeAId: finalA,
    equipeBId: finalB,
    status: 'ENCERRADA',
    rodada: 1,
    dataHora: daqui(-20),
    localNome: 'Ginásio da Simulação',
    setsPorA: 2,
    setsPorB: 1,
    vencedorId: finalA,
    sets: [{ numero: 1, pontosA: 25, pontosB: 20 }, { numero: 2, pontosA: 22, pontosB: 25 }, { numero: 3, pontosA: 15, pontosB: 10 }],
  })
  await recalculateLeagueClassification(finalizadoId)
  const { error: finalizarErr } = await supabaseAdmin
    .from('Liga')
    .update({ status: 'FINALIZADO', inscricoesAbertas: false, finalizadoEm: agora.toISOString(), finalizadoPor: 'simulacao' })
    .eq('id', finalizadoId)
    .eq('simulacao', true)
  if (finalizarErr) throw new Error(finalizarErr.message)

  return { semArbitro, aguardando, designada, andamento, encerrada }
}

async function salvarRelogio(liga: LigaSim, partidaId: number, placar: PlacarSimulacao | null) {
  const mapa = { ...relogios(liga) }
  if (placar) mapa[String(partidaId)] = placar
  else delete mapa[String(partidaId)]
  const { error } = await supabaseAdmin.from('Liga').update({ simulacaoRelogio: mapa }).eq('id', liga.id).eq('simulacao', true)
  if (error) throw new Error(error.message)
}

async function partidaSimulacao(partidaId: number) {
  const { data, error } = await supabaseAdmin
    .from('Partida')
    .select('id,ligaId,status,equipeAId,equipeBId,setsPorA,setsPorB')
    .eq('id', partidaId)
    .maybeSingle()
  if (error || !data) throw new Error(error?.message || 'Partida de simulação não encontrada.')
  const ligas = await ligasSimulacao()
  const liga = ligas.find((item) => item.id === data.ligaId)
  if (!liga || !podeApagarSimulacao(liga)) throw new Error('Esta partida não pertence à simulação.')
  return { partida: data, liga }
}

export async function controlarPartida(partidaId: number, acao: 'pausar' | 'retomar' | 'iniciar' | 'encerrar' | 'avancar', velocidade?: number) {
  const { partida, liga } = await partidaSimulacao(partidaId)
  const agora = Date.now()
  const atual = lerPlacar(relogios(liga)[String(partidaId)], agora)

  if (acao === 'iniciar') {
    const bloqueio = podeIniciarPartida(partida.status, liga.status)
    if (bloqueio) throw new Error(bloqueio)
    const { error } = await supabaseAdmin.from('Partida').update({ status: 'EM_ANDAMENTO' }).eq('id', partidaId)
    if (error) throw new Error(error.message)
    await registrarEvento(partidaId, 'Partida iniciada na simulação.', 1)
    await salvarRelogio(liga, partidaId, placarInicial(agora, atual.velocidade))
    return
  }

  if (acao === 'encerrar') {
    const bloqueio = podeEncerrarPartida(partida.status, liga.status)
    if (bloqueio) throw new Error(bloqueio)
    const vencedorId = atual.setsA === atual.setsB
      ? null
      : atual.setsA > atual.setsB ? partida.equipeAId : partida.equipeBId
    const { error } = await supabaseAdmin.from('Partida').update({
      status: 'ENCERRADA',
      setsPorA: atual.setsA,
      setsPorB: atual.setsB,
      pontosPorA: atual.pontosA,
      pontosPorB: atual.pontosB,
      vencedorId,
    }).eq('id', partidaId)
    if (error) throw new Error(error.message)
    await registrarEvento(partidaId, 'Partida encerrada na simulação.', atual.setNumero)
    await recalculateLeagueClassification(liga.id)
    await salvarRelogio(liga, partidaId, pausarPlacar(atual, agora))
    return
  }

  if (isCampeonatoFinalizado(liga.status)) throw new Error('Este campeonato está finalizado e disponível apenas para consulta.')
  if (acao === 'pausar') await salvarRelogio(liga, partidaId, pausarPlacar(atual, agora))
  if (acao === 'retomar') await salvarRelogio(liga, partidaId, retomarPlacar(atual, agora))
  if (acao === 'avancar') await salvarRelogio(liga, partidaId, definirVelocidade(atual, velocidade ?? atual.velocidade, agora))
}

export async function avancarSimulacoes(agoraMs = Date.now()) {
  const ligas = await ligasSimulacao()
  for (const liga of ligas) {
    if (isCampeonatoFinalizado(liga.status)) continue
    const mapa = relogios(liga)
    const { data: partidas } = await supabaseAdmin
      .from('Partida')
      .select('id,status,equipeAId,equipeBId')
      .eq('ligaId', liga.id)
      .eq('status', 'EM_ANDAMENTO')
    let mudou = false
    const proximo = { ...mapa }
    for (const partida of partidas ?? []) {
      const placar = lerPlacar(mapa[String(partida.id)], agoraMs)
      const passo = avancarPlacar(
        placar,
        agoraMs,
        liga.pontosPorSet || 25,
        liga.diferencaMinimaSet || 2,
        setsParaVencer(liga.setsPorPartida || 3),
      )
      proximo[String(partida.id)] = passo.placar
      if (passo.sets.length > 0) {
        const { error } = await supabaseAdmin.from('SetPartida').upsert(
          passo.sets.map((set) => ({ ...set, partidaId: partida.id })),
          { onConflict: 'partidaId,numero' },
        )
        if (error) throw new Error(error.message)
        for (const set of passo.sets) {
          await registrarEvento(partida.id, `Set ${set.numero} encerrado: ${set.pontosA} a ${set.pontosB}.`, set.numero)
        }
      }
      if (passo.sets.length > 0 || passo.encerrada) {
        const vencedorId = passo.placar.setsA === passo.placar.setsB
          ? null
          : passo.placar.setsA > passo.placar.setsB ? partida.equipeAId : partida.equipeBId
        const { error } = await supabaseAdmin.from('Partida').update({
          status: passo.encerrada ? 'ENCERRADA' : 'EM_ANDAMENTO',
          setsPorA: passo.placar.setsA,
          setsPorB: passo.placar.setsB,
          pontosPorA: passo.placar.pontosA,
          pontosPorB: passo.placar.pontosB,
          vencedorId: passo.encerrada ? vencedorId : null,
        }).eq('id', partida.id)
        if (error) throw new Error(error.message)
        if (passo.encerrada) await recalculateLeagueClassification(liga.id)
      }
      mudou = true
    }
    if (mudou) {
      const { error } = await supabaseAdmin.from('Liga').update({ simulacaoRelogio: proximo }).eq('id', liga.id).eq('simulacao', true)
      if (error) throw new Error(error.message)
    }
  }
}

export async function painelSimulacao() {
  await avancarSimulacoes()
  const ligas = await ligasSimulacao()
  const ids = ligas.map((liga) => liga.id)
  if (ids.length === 0) {
    return { campeonatos: 0, agendadas: 0, andamento: 0, encerradas: 0, semArbitro: 0, arbitrosEmQuadra: 0, alertas: [] as string[], partidas: [] as unknown[], campeonatosLista: [] as unknown[], servidorAgora: Date.now() }
  }

  const { data: partidas, error } = await supabaseAdmin
    .from('Partida')
    .select('id,ligaId,status,rodada,dataHora,localNome,setsPorA,setsPorB,pontosPorA,pontosPorB,sumulaToken,equipeA:Equipe!Partida_equipeAId_fkey(nome),equipeB:Equipe!Partida_equipeBId_fkey(nome),escala:EscalaArbitro(arbitroId,cargo,arbitro:Arbitro(nome)),candidaturasArbitro:CandidaturaPartidaArbitro(status),sets:SetPartida(numero,pontosA,pontosB),ocorrencias:OcorrenciaPartida(id,tipo,descricao,set)')
    .in('ligaId', ids)
    .order('dataHora', { ascending: true })
  if (error) throw new Error(error.message)

  const linhas = partidas ?? []
  const agora = Date.now()
  const porLiga = new Map(ligas.map((liga) => [liga.id, liga]))
  const detalhadas = linhas.map((partida) => {
    const liga = porLiga.get(partida.ligaId)
    const placar = lerPlacar(relogios(liga as LigaSim)[String(partida.id)], agora)
    const escala = Array.isArray(partida.escala) ? partida.escala : []
    return {
      ...partida,
      campeonato: liga?.nome ?? '',
      statusCampeonato: liga?.status ?? '',
      placar,
      relogioMs: placar.acumuladoMs,
    }
  })

  const andamento = detalhadas.filter((partida) => partida.status === 'EM_ANDAMENTO')
  const arbitrosEmQuadra = new Set(andamento.flatMap((partida) => (partida.escala ?? []).map((item: { arbitroId: number }) => item.arbitroId))).size
  const semArbitro = detalhadas.filter((partida) => partida.status === 'AGENDADA' && (partida.escala ?? []).length === 0 && (partida.candidaturasArbitro ?? []).length === 0)
  const alertas = [
    ...semArbitro.map((partida) => `Partida ${partida.id} está agendada sem árbitro.`),
    ...detalhadas.filter((partida) => partida.status === 'EM_ANDAMENTO' && (partida.escala ?? []).length === 0).map((partida) => `Partida ${partida.id} está em andamento sem árbitro escalado.`),
    ...ligas.filter((liga) => isCampeonatoFinalizado(liga.status) && detalhadas.some((partida) => partida.ligaId === liga.id && partida.status === 'EM_ANDAMENTO')).map((liga) => `${liga.nome} está finalizado e ainda tem partida em andamento.`),
  ]

  return {
    campeonatos: ligas.length,
    agendadas: detalhadas.filter((partida) => partida.status === 'AGENDADA').length,
    andamento: andamento.length,
    encerradas: detalhadas.filter((partida) => partida.status === 'ENCERRADA').length,
    semArbitro: semArbitro.length,
    arbitrosEmQuadra,
    alertas,
    partidas: detalhadas,
    campeonatosLista: ligas.map((liga) => ({ id: liga.id, nome: liga.nome, status: liga.status, inscricoesAbertas: liga.inscricoesAbertas })),
    servidorAgora: agora,
  }
}
