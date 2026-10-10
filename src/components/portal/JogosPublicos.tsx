import Link from 'next/link'
import { PartidaCard } from '@/components/partidas/PartidaCard'
import { idsForaDaVitrine } from '@/lib/campeonatos-publicos'
import { campeonatoDeTeste } from '@/lib/campeonato-teste'
import { dataHoraUtc, ordenarJogos } from '@/lib/data-hora'
import { consultarComVaga } from '@/lib/consulta-vaga'
import { PARTIDA_PUBLICA_COLUNAS } from '@/lib/partida-publica'
import { ladoExposto } from '@/lib/vaga-a-definir'
import { isSupabaseConfigured } from '@/lib/supabase'
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
  equipeA: { id: number; nome: string; corHex: string | null; vaga?: boolean } | null
  equipeB: { id: number; nome: string; corHex: string | null; vaga?: boolean } | null
  origemVagaA?: string | null
  origemVagaB?: string | null
}

export async function JogosPublicos({ filtro, pagina }: { filtro?: string; pagina?: string }) {
  const ativo = FILTROS.some((item) => item.id === filtro) ? filtro as Filtro : 'todos'
  const numeroPagina = Math.max(1, Number(pagina) || 1)

  if (!isSupabaseConfigured) {
    return (
      <Moldura filtro={ativo} pagina={numeroPagina} total={0}>
        <p className="text-sm font-semibold text-slate-300">Nenhum jogo encontrado</p>
      </Moldura>
    )
  }

  const ocultos = await idsForaDaVitrine()
  const fora = ocultos.length ? `(${ocultos.join(',')})` : ''
  const status = ativo === 'todos' ? null : STATUS[ativo]
  const colunas = `${PARTIDA_PUBLICA_COLUNAS},liga:Liga!Partida_ligaId_fkey(id,nome,slug,descricao,simulacao)`
  let contagem = supabaseAdmin.from('Partida').select('id', { count: 'exact', head: true })
  if (fora) contagem = contagem.not('ligaId', 'in', fora)
  if (status) contagem = contagem.in('status', status)

  const inicio = (numeroPagina - 1) * TAMANHO
  const [totalResposta, listaResposta] = await Promise.all([
    contagem,
    consultarComVaga(colunas, (select) => {
      let lista = supabaseAdmin.from('Partida').select(select)
      if (fora) lista = lista.not('ligaId', 'in', fora)
      if (status) lista = lista.in('status', status)
      return lista.order('dataHora', { ascending: true, nullsFirst: false }).order('rodada', { ascending: true }).order('id', { ascending: true }).range(inicio, inicio + TAMANHO - 1)
    }),
  ])

  if (totalResposta.error || listaResposta.error) {
    return (
      <Moldura filtro={ativo} pagina={numeroPagina} total={0}>
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
    <Moldura filtro={ativo} pagina={numeroPagina} total={total}>
      {partidas.length === 0 ? (
        <p className="text-sm font-semibold text-slate-300">{vazio(ativo)}</p>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {partidas.map((partida, index) => <PartidaCard key={partida.id} partida={partida} atraso={`${Math.min(index, 8) * 30}ms`} />)}
          </div>
          {inicio + TAMANHO < total && (
            <Link href={hrefDoFiltro(ativo, numeroPagina + 1)} className="mt-6 inline-flex rounded-full bg-white/10 px-4 py-2 text-sm font-black text-white">
              Ver mais
            </Link>
          )}
        </>
      )}
    </Moldura>
  )
}

function Moldura({ filtro, pagina, total, children }: { filtro: Filtro; pagina: number; total: number; children: React.ReactNode }) {
  return (
    <main className="luva-shell min-h-screen pb-28 lg:pb-0">
      <section className="mx-auto max-w-7xl px-4 py-10">
        <h1 className={`font-display text-4xl font-black text-white ${mi.entrar}`}>Jogos</h1>
        <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-slate-300">{textoDoTotal(filtro, total)}</p>
        <nav className="mt-6 flex flex-wrap gap-2" aria-label="Filtros dos jogos">
          {FILTROS.map((item) => {
            const ligado = item.id === filtro
            return (
              <Link
                key={item.id}
                href={hrefDoFiltro(item.id, 1)}
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

function hrefDoFiltro(filtro: Filtro, pagina: number) {
  const params = new URLSearchParams()
  if (filtro !== 'todos') params.set('filtro', filtro)
  if (pagina > 1) params.set('pagina', String(pagina))
  const consulta = params.toString()
  return consulta ? `/jogos?${consulta}` : '/jogos'
}

function textoDoTotal(filtro: Filtro, total: number) {
  if (filtro === 'ao-vivo') return `${total} jogos ao vivo, de todos os campeonatos.`
  if (filtro === 'nao-iniciado') return `${total} jogos ainda não iniciados, de todos os campeonatos.`
  if (filtro === 'encerrados') return `${total} jogos encerrados, de todos os campeonatos.`
  return `${total} jogos públicos, de todos os campeonatos.`
}

function vazio(filtro: Filtro) {
  if (filtro === 'ao-vivo') return 'Nenhum jogo ao vivo'
  if (filtro === 'nao-iniciado') return 'Nenhum jogo não iniciado'
  if (filtro === 'encerrados') return 'Nenhum jogo encerrado'
  return 'Nenhum jogo encontrado'
}
