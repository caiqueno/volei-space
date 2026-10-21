'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { obterClientePadrao, type MeuTimeClient } from '@/components/meu-time/cliente'
import { Aviso, botaoPrimario, botaoSecundario, Campo, campoEstilo, Carregando, cartao, FalhaTela, falhaDe, Pagina, useCarregar } from '@/components/meu-time/ui'
import type { Falha } from '@/lib/meu-time-ui/respostas'
import {
  aplicarFiltro,
  contarFiltrosAtivos,
  erroDoPeriodo,
  explorarCompeticoesAtivo,
  filtrosVazios,
  HREF_CRIAR_TIME,
  hrefParticipar,
  motivoSemParticipar,
  NAIPES,
  podeParticipar,
  prazoRestante,
  prazoUrgente,
  rotuloNaipe,
  ROTULO_MODO,
  textoDoSelo,
  textoPagina,
  textoPeriodo,
  textoTotal,
  textoValor,
  textoVazio,
  totalPaginas,
  vagasDe,
  visualDoSelo,
  type Competicao,
  type Filtros,
  type ListaCompeticoes,
} from '@/lib/meu-time-competicoes-ui/regras'
import { obterClienteCompeticoes, type ClienteCompeticoes } from './cliente'

function Selo({ c }: { c: Competicao }) {
  if (!c.selo) return null
  const v = visualDoSelo(c.selo.nivel)
  return (
    <div className={`vs-state ${v.classe} flex flex-col gap-1`} role="group" aria-label={v.leitor}>
      <p className="font-black">
        <span aria-hidden="true">{v.icone} </span>
        <span className="sr-only">{v.leitor}. </span>
        {textoDoSelo(c.selo)}
      </p>
      {c.selo.detalhes.length > 0 && (
        <ul className="list-disc pl-5 text-sm">
          {c.selo.detalhes.map((d) => <li key={d}>{d}</li>)}
        </ul>
      )}
    </div>
  )
}

function Cartao({ c, semTime, temEquipe }: { c: Competicao; semTime: boolean; temEquipe: boolean }) {
  const vagas = vagasDe(c.vagasRestantes, c.vagasTotal)
  const prazo = prazoRestante(c.prazoInscricao)
  const urgente = prazoUrgente(c.prazoInscricao)
  const pode = podeParticipar(c)
  const motivo = motivoSemParticipar(c)
  const onde = [c.cidade, c.local].filter(Boolean).join(' · ')
  return (
    <li className={`${cartao} flex flex-col gap-3`}>
      <div>
        <h2 className="font-display text-xl font-black leading-tight">{c.campeonato}</h2>
        {c.organizador && <p className="text-sm text-[var(--vs-muted)]">Organização: {c.organizador}</p>}
        <p className="text-base text-[var(--vs-muted)]">
          {c.categoria}
          {c.naipe ? ` · ${rotuloNaipe(c.naipe)}` : ''}
        </p>
      </div>

      <dl className="grid grid-cols-1 gap-1 text-base sm:grid-cols-2">
        <div className="flex gap-2"><dt className="font-bold">Quando:</dt><dd>{textoPeriodo(c.inicio, c.fim)}</dd></div>
        {onde && <div className="flex gap-2"><dt className="font-bold">Onde:</dt><dd>{onde}</dd></div>}
        <div className="flex gap-2"><dt className="font-bold">Valor:</dt><dd>{textoValor(c.valorInscricao)}</dd></div>
        {prazo && (
          <div className="flex gap-2">
            <dt className="font-bold">Prazo:</dt>
            <dd className={urgente ? 'font-bold text-[var(--vs-gold)]' : ''}>{prazo}</dd>
          </div>
        )}
      </dl>

      <div className="flex flex-col gap-1">
        <p className="text-sm font-bold">{vagas.texto}</p>
        {vagas.percentualOcupado !== null && (
          <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--vs-elevated)]" role="img" aria-label={`${vagas.percentualOcupado}% das vagas ocupadas`}>
            <div className="h-full rounded-full bg-[var(--vs-gold)]" style={{ width: `${vagas.percentualOcupado}%` }} />
          </div>
        )}
      </div>

      <span className="self-start rounded-full border border-[var(--vs-border-strong)] px-3 py-1 text-sm font-bold">{ROTULO_MODO[c.modo]}</span>

      {c.selo ? <Selo c={c} /> : <p className="text-sm text-[var(--vs-muted)]">{temEquipe ? 'Sem avaliação para o seu time.' : 'Escolha um time acima para ver se ele pode participar.'}</p>}

      {pode && !semTime && (
        <Link href={hrefParticipar(c.categoriaId)} className={botaoPrimario}>
          Participar
        </Link>
      )}
      {pode && semTime && (
        <Link href={HREF_CRIAR_TIME} className={botaoPrimario}>
          Criar meu time para participar
        </Link>
      )}
      {!pode && motivo && <p className="text-sm text-[var(--vs-muted)]">{motivo}</p>}
    </li>
  )
}

type Rascunho = Pick<Filtros, 'cidade' | 'de' | 'ate' | 'categoria' | 'naipe' | 'abertas' | 'q'>

function FormFiltros({
  aplicados,
  aoAplicar,
  aoLimpar,
}: {
  aplicados: Filtros
  aoAplicar: (r: Rascunho) => void
  aoLimpar: () => void
}) {
  const [r, setR] = useState<Rascunho>({ cidade: aplicados.cidade, de: aplicados.de, ate: aplicados.ate, categoria: aplicados.categoria, naipe: aplicados.naipe, abertas: aplicados.abertas, q: aplicados.q })
  const erro = erroDoPeriodo(r)
  const ativos = contarFiltrosAtivos(aplicados)
  const set = (p: Partial<Rascunho>) => setR((v) => ({ ...v, ...p }))
  return (
    <form
      className="flex flex-col gap-3"
      role="search"
      aria-label="Buscar competições"
      onSubmit={(e) => {
        e.preventDefault()
        if (!erro) aoAplicar(r)
      }}
    >
      <Campo id="comp-busca" rotulo="Buscar por nome">
        <input id="comp-busca" type="search" className={campoEstilo} value={r.q} maxLength={80} placeholder="Nome do campeonato ou do organizador" onChange={(e) => set({ q: e.target.value })} />
      </Campo>
      <label className="flex min-h-[44px] items-center gap-3 text-base font-bold">
        <input type="checkbox" className="h-6 w-6 accent-[var(--vs-gold)]" checked={r.abertas} onChange={(e) => set({ abertas: e.target.checked })} />
        Só inscrições abertas
      </label>
      <details className="rounded-xl border border-[var(--vs-border)] p-3" open={ativos > 1}>
        <summary className="min-h-[44px] cursor-pointer text-base font-bold leading-[44px]">Mais filtros</summary>
        <div className="mt-2 flex flex-col gap-3">
          <Campo id="comp-cidade" rotulo="Cidade">
            <input id="comp-cidade" className={campoEstilo} value={r.cidade} maxLength={80} autoComplete="address-level2" onChange={(e) => set({ cidade: e.target.value })} />
          </Campo>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Campo id="comp-de" rotulo="A partir de">
              <input id="comp-de" type="date" className={campoEstilo} value={r.de} onChange={(e) => set({ de: e.target.value })} />
            </Campo>
            <Campo id="comp-ate" rotulo="Até" erro={erro}>
              <input id="comp-ate" type="date" className={campoEstilo} value={r.ate} aria-invalid={erro ? true : undefined} aria-describedby={erro ? 'comp-ate-erro' : undefined} onChange={(e) => set({ ate: e.target.value })} />
            </Campo>
          </div>
          <Campo id="comp-categoria" rotulo="Categoria">
            <input id="comp-categoria" className={campoEstilo} value={r.categoria} maxLength={60} placeholder="Ex.: Adulto, Sub-17" onChange={(e) => set({ categoria: e.target.value })} />
          </Campo>
          <Campo id="comp-naipe" rotulo="Naipe">
            <select id="comp-naipe" className={campoEstilo} value={r.naipe} onChange={(e) => set({ naipe: e.target.value })}>
              <option value="">Todos</option>
              {NAIPES.map((n) => <option key={n} value={n}>{rotuloNaipe(n)}</option>)}
            </select>
          </Campo>
        </div>
      </details>
      <div className="flex flex-col gap-2 sm:flex-row">
        <button type="submit" className={botaoPrimario} disabled={!!erro}>Buscar</button>
        <button
          type="button"
          className={botaoSecundario}
          onClick={() => {
            setR({ cidade: '', de: '', ate: '', categoria: '', naipe: '', abertas: false, q: '' })
            aoLimpar()
          }}
        >
          Limpar filtros
        </button>
      </div>
    </form>
  )
}

export function CompeticoesTela({ cliente, clienteTime }: { cliente?: ClienteCompeticoes; clienteTime?: MeuTimeClient }) {
  const ativo = explorarCompeticoesAtivo()
  const api = cliente ?? obterClienteCompeticoes()
  const apiTime = clienteTime ?? obterClientePadrao()
  // A lista de times só é pedida com a flag ligada; desligada = nenhuma requisição.
  const { carga: times } = useCarregar(async () => (ativo ? apiTime.listarEquipes() : []))
  const [filtros, setFiltros] = useState<Filtros>(filtrosVazios())
  const [lista, setLista] = useState<ListaCompeticoes | null>(null)
  const [falha, setFalha] = useState<Falha | null>(null)
  const [tentativa, setTentativa] = useState(0)
  const [chaveForm, setChaveForm] = useState(0)
  const topo = useRef<HTMLHeadingElement>(null)

  const equipes = times.estado === 'pronto' ? times.dados : []
  const timesProntos = times.estado !== 'carregando'

  // Com um time só, ele já vale para o selo.
  useEffect(() => {
    if (times.estado === 'pronto' && times.dados.length === 1) setFiltros((f) => (f.equipeId ? f : { ...f, equipeId: times.dados[0].id }))
  }, [times])

  useEffect(() => {
    if (!ativo || !timesProntos) return
    const ctl = new AbortController()
    setFalha(null)
    setLista(null)
    api
      .listar(filtros, ctl.signal)
      .then((l) => setLista(l))
      .catch((e) => {
        if (ctl.signal.aborted) return
        setFalha(falhaDe(e))
      })
    return () => ctl.abort()
  }, [ativo, api, filtros, timesProntos, tentativa])

  // Flag desligada: nada novo aparece e nenhuma requisição sai.
  if (!ativo) {
    return (
      <Pagina titulo="Competições" voltar={{ href: '/meu-time', texto: 'Voltar aos meus times' }}>
        <Aviso>Esta função ainda não está disponível para você. Assim que estiver, é só voltar aqui.</Aviso>
      </Pagina>
    )
  }

  const semTime = times.estado === 'pronto' && times.dados.length === 0
  const vazio = textoVazio(filtros)
  const paginas = lista ? totalPaginas(lista.total) : 1

  function irParaPagina(p: number) {
    setFiltros((f) => ({ ...f, pagina: p }))
    topo.current?.focus()
  }

  return (
    <Pagina titulo="Competições" voltar={{ href: '/meu-time', texto: 'Voltar aos meus times' }}>
      <p className="text-base text-[var(--vs-muted)]">Veja campeonatos com inscrições abertas e descubra se o seu time pode participar.</p>

      {times.estado === 'falha' && <FalhaTela falha={times.falha} />}
      {equipes.length > 1 && (
        <Campo id="comp-equipe" rotulo="Qual time vai participar?" ajuda="O selo de cada competição mostra se este time pode entrar.">
          <select id="comp-equipe" className={campoEstilo} value={filtros.equipeId} onChange={(e) => setFiltros((f) => aplicarFiltro(f, { equipeId: e.target.value }))}>
            <option value="">Escolha um time</option>
            {equipes.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
          </select>
        </Campo>
      )}
      {semTime && (
        <Aviso>
          Você ainda não tem um time. Pode olhar as competições, e para participar é só <Link href={HREF_CRIAR_TIME} className="font-bold underline">criar o seu time</Link>.
        </Aviso>
      )}

      <FormFiltros
        key={chaveForm}
        aplicados={filtros}
        aoAplicar={(r) => setFiltros((f) => aplicarFiltro(f, r))}
        aoLimpar={() => {
          setFiltros((f) => aplicarFiltro(f, { cidade: '', de: '', ate: '', categoria: '', naipe: '', abertas: false, q: '' }))
          setChaveForm((n) => n + 1)
        }}
      />

      <h2 ref={topo} tabIndex={-1} className="text-lg font-black outline-none" aria-live="polite">
        {lista ? textoTotal(lista.total) : 'Resultados'}
      </h2>

      {!lista && !falha && timesProntos && <Carregando texto="Buscando competições…" />}
      {falha && <FalhaTela falha={falha} aoTentar={() => setTentativa((n) => n + 1)} />}
      {lista && lista.itens.length === 0 && (
        <div className={`${cartao} flex flex-col gap-2`}>
          <h3 className="text-lg font-black">{vazio.titulo}</h3>
          <p className="text-[var(--vs-muted)]">{vazio.dica}</p>
          {vazio.limpar && (
            <button
              type="button"
              className={`${botaoSecundario} self-start`}
              onClick={() => {
                setFiltros((f) => aplicarFiltro(f, { cidade: '', de: '', ate: '', categoria: '', naipe: '', abertas: false, q: '' }))
                setChaveForm((n) => n + 1)
              }}
            >
              Limpar filtros
            </button>
          )}
        </div>
      )}
      {lista && lista.itens.length > 0 && (
        <ul className="flex flex-col gap-3" aria-label="Competições">
          {lista.itens.map((c) => <Cartao key={c.categoriaId} c={c} semTime={semTime} temEquipe={!!filtros.equipeId} />)}
        </ul>
      )}

      {lista && paginas > 1 && (
        <nav aria-label="Páginas" className="flex items-center justify-between gap-2">
          <button type="button" className={botaoSecundario} disabled={filtros.pagina <= 1} onClick={() => irParaPagina(filtros.pagina - 1)}>Anterior</button>
          <span className="text-sm font-bold">{textoPagina(filtros.pagina, lista.total)}</span>
          <button type="button" className={botaoSecundario} disabled={filtros.pagina >= paginas} onClick={() => irParaPagina(filtros.pagina + 1)}>Próxima</button>
        </nav>
      )}
    </Pagina>
  )
}
