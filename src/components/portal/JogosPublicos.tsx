import Link from 'next/link'
import { PartidaCard } from '@/components/partidas/PartidaCard'
import { campeonatoDeTeste } from '@/lib/campeonato-teste'
import { dataHoraUtc, ordenarJogos } from '@/lib/data-hora'
import { consultarComVaga } from '@/lib/consulta-vaga'
import { PARTIDA_PUBLICA_COLUNAS } from '@/lib/partida-publica'
import { ladoExposto } from '@/lib/vaga-a-definir'
import { isSupabaseConfigured } from '@/lib/supabase-config'
import { supabaseAdmin } from '@/lib/supabase-admin'
import mi from '@/styles/microinteracoes.module.css'

const TAMANHO = 24

const FILTROS = [
  { id: 'todos', rotulo: 'Todos' },
  { id: 'ao-vivo', rotulo: 'Ao vivo' },
  { id: 'nao-iniciado', rotulo: 'Não iniciado' },
  { id: 'encerrados', rotulo: 'Encerrados' },
] as const

type Filtro = (typeof FILTROS)[number]['id']

const STATUS: Record<Exclude<Filtro, 'todos'>, string[]> = {
  'ao-vivo': ['EM_ANDAMENTO'],
  'nao-iniciado': ['AGENDADA', 'PENDENTE'],
  encerrados: ['ENCERRADA', 'WO'],
}

type Linha = {
  id: number
  rodada: number
  status: string
  dataHora: string | null
  localNome: string | null
  setsPorA: number | null
  setsPorB: number | null
  liga: { id?: number; nome?: string | null; slug?: string | null; descricao?: string | null; simulacao?: boolean | null } | Array<{ id?: number; nome?: string | null; slug?: string | null; descricao?: string | null; simulacao?: boolean | null }> | null
  sets: Array<{ numero: number; pontosA: number; pontosB: number }>
  equipeA: { id: number; nome: string; corHex: string | null; logoUrl?: string | null; vaga?: boolean } | null
  equipeB: { id: number; nome: string; corHex: string | null; logoUrl?: string | null; vaga?: boolean } | null
  origemVagaA?: string | null
  origemVagaB?: string | null
}

export async function JogosPublicos({ filtro, pagina, ligaId }: { filtro?: string; pagina?: string; ligaId: number }) {
  const ativo = FILTROS.some((item) => item.id === filtro) ? filtro as Filtro : 'todos'
  const numeroPagina = Math.max(1, Number(pagina) || 1)

  if (!isSupabaseConfigured) {
    return (
      <Moldura filtro={ativo} pagina={numeroPagina} total={0} ligaId={ligaId}>
        <p className="text-sm font-semibold text-slate-300">Nenhum jogo encontrado</p>
      </Moldura>
    )
  }

  const { data: campeonato, error: erroCampeonato } = await supabaseAdmin
    .from('Liga')
    .select('id,nome,slug,descricao,simulacao,logoUrl')
    .eq('id', ligaId)
    .maybeSingle()
  if (erroCampeonato || !campeonato || campeonatoDeTeste(campeonato)) {
    return (
      <Moldura filtro={ativo} pagina={numeroPagina} total={0} ligaId={ligaId}>
        <p className="text-sm font-semibold text-slate-300">Esse campeonato não está na lista pública.</p>
      </Moldura>
    )
  }

  const status = ativo === 'todos' ? null : STATUS[ativo]
  const colunas = `${PARTIDA_PUBLICA_COLUNAS},liga:Liga!Partida_ligaId_fkey(id,nome,slug,descricao,simulacao,logoUrl)`
  let contagem = supabaseAdmin.from('Partida').select('id', { count: 'exact', head: true }).eq('ligaId', ligaId)
  if (status) contagem = contagem.in('status', status)

  const inicio = (numeroPagina - 1) * TAMANHO
  const [totalResposta, listaResposta] = await Promise.all([
    contagem,
    consultarComVaga(colunas, (select) => {
      let lista = supabaseAdmin.from('Partida').select(select).eq('ligaId', ligaId)
      if (status) lista = lista.in('status', status)
      return lista.order('dataHora', { ascending: true, nullsFirst: false }).order('rodada', { ascending: true }).order('id', { ascending: true }).range(inicio, inicio + TAMANHO - 1)
    }),
  ])

  if (totalResposta.error || listaResposta.error) {
    return (
      <Moldura filtro={ativo} pagina={numeroPagina} total={0} ligaId={ligaId} campeonato={campeonato.nome}>
        <p className="text-sm font-bold text-red-200">Erro ao carregar dados</p>
      </Moldura>
    )
  }

  const partidas = ordenarJogos(((listaResposta.data ?? []) as unknown as Linha[])
    .map((partida) => {
      const liga = Array.isArray(partida.liga) ? partida.liga[0] : partida.liga
      return {
        ...partida,
        liga: liga ?? null,
        dataHora: dataHoraUtc(partida.dataHora),
        sets: Array.isArray(partida.sets) ? partida.sets : [],
        equipeA: ladoExposto(partida.equipeA, partida.origemVagaA),
        equipeB: ladoExposto(partida.equipeB, partida.origemVagaB),
      }
    })
    .filter((partida) => (partida.equipeA?.id || partida.equipeA?.vaga) && (partida.equipeB?.id || partida.equipeB?.vaga) && !campeonatoDeTeste(partida.liga) && partida.liga?.simulacao !== true))

  const total = totalResposta.count ?? partidas.length

  return (
    <Moldura filtro={ativo} pagina={numeroPagina} total={total} ligaId={ligaId} campeonato={campeonato.nome}>
      {partidas.length === 0 ? (
        <p className="text-sm font-semibold text-slate-300">{vazio(ativo)}</p>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {partidas.map((partida, index) => <PartidaCard key={partida.id} partida={partida} atraso={`${Math.min(index, 8) * 30}ms`} compartilhar />)}
          </div>
          {inicio + TAMANHO < total && (
            <Link href={hrefDoFiltro(ativo, numeroPagina + 1, ligaId)} className="mt-6 inline-flex rounded-full bg-white/10 px-4 py-2 text-sm font-black text-white">
              Ver mais
            </Link>
          )}
        </>
      )}
    </Moldura>
  )
}

function Moldura({ filtro, pagina, total, ligaId, campeonato, children }: { filtro: Filtro; pagina: number; total: number; ligaId: number; campeonato?: string; children: React.ReactNode }) {
  return (
    <main className="luva-shell min-h-screen pb-28 lg:pb-0">
      <section className="mx-auto max-w-7xl px-4 py-10">
        <Link href="/jogos" className="text-sm font-black text-[#ffb331]">Escolher outro campeonato</Link>
        <h1 className={`mt-3 font-display text-4xl font-black text-white ${mi.entrar}`}>{campeonato || 'Jogos'}</h1>
        <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-slate-300">{textoDoTotal(filtro, total, campeonato)}</p>
        <nav className="mt-6 flex flex-wrap gap-2" aria-label="Filtros dos jogos">
          {FILTROS.map((item) => {
            const ligado = item.id === filtro
            return (
              <Link
                key={item.id}
                href={hrefDoFiltro(item.id, 1, ligaId)}
                aria-current={ligado ? 'page' : undefined}
                className={`rounded-full px-4 py-2 text-sm font-black ${mi.toque} ${ligado ? 'bg-[#ffb331] text-[#061426]' : 'border border-white/15 text-white'}`}
              >
                {item.rotulo}
              </Link>
            )
          })}
        </nav>
        <div className="mt-8">{children}</div>
        {pagina > 1 && <p className="sr-only">Página {pagina}</p>}
      </section>
    </main>
  )
}

function hrefDoFiltro(filtro: Filtro, pagina: number, ligaId: number) {
  const params = new URLSearchParams()
  params.set('ligaId', String(ligaId))
  if (filtro !== 'todos') params.set('filtro', filtro)
  if (pagina > 1) params.set('pagina', String(pagina))
  return `/jogos?${params.toString()}`
}

function textoDoTotal(filtro: Filtro, total: number, campeonato?: string) {
  const nome = campeonato ? ` de ${campeonato}` : ''
  if (filtro === 'ao-vivo') return `${total} jogos ao vivo${nome}.`
  if (filtro === 'nao-iniciado') return `${total} jogos ainda não iniciados${nome}.`
  if (filtro === 'encerrados') return `${total} jogos encerrados${nome}.`
  return `${total} jogos públicos${nome}.`
}

function vazio(filtro: Filtro) {
  if (filtro === 'ao-vivo') return 'Nenhum jogo ao vivo'
  if (filtro === 'nao-iniciado') return 'Nenhum jogo não iniciado'
  if (filtro === 'encerrados') return 'Nenhum jogo encerrado'
  return 'Nenhum jogo encontrado'
}
