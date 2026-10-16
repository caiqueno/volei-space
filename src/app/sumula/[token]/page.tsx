'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import { lerLiberosIniciais } from '@/lib/libero-sumula'
import { numeroNaPartida } from '@/lib/numero-camisa-partida'
import { NomeEquipe } from '@/components/equipes/NomeEquipe'
import { TeamIdentity } from '@/components/equipes/TeamIdentity'
import { agendaDaPartida } from '@/lib/format-partida'
import { normalizarNomeEquipe } from '@/lib/nome-equipe'
import { emOrdemCronologica } from '@/lib/sumula-ui/ordem'
import { avisoDeOverrides, contarOverrides, lerOverride } from '@/lib/sumula-ui/override'
import { limparMarcas } from '@/lib/sumula-impressa/interpretar'

type Jogador = { id: number; nome: string; numero?: number | string | null; numeroHerdado?: number | null; posicao?: string | null }
type Equipe = { id: number; nome: string; logoUrl?: string | null; corHex?: string | null; jogadores?: Jogador[] }
type Ocorrencia = { id: number; tipo: string; descricao?: string | null; set?: number | null; jogadorId?: number | null }
type Registro = {
  id: number
  rodada?: number | null
  fase?: string | null
  status?: string | null
  categoria?: string | null
  dataHora?: string | null
  localNome?: string | null
  setsPorA?: number | null
  setsPorB?: number | null
  vencedorId?: number | null
  liga?: { nome?: string | null } | null
  equipeA?: Equipe | null
  equipeB?: Equipe | null
  sets?: Array<{ id: number; numero: number; pontosA: number; pontosB: number }>
  presencas?: Array<{ presente: boolean; equipeId: number; jogadorId: number; numero?: number | null; jogador?: Jogador | null }>
  ocorrencias?: Ocorrencia[]
  destaques?: Array<{ id: number; tipo: string; jogador?: Jogador | null }>
  escala?: Array<{ id: number; cargo?: string | null; arbitro?: { nome?: string | null } | null }>
}

export default function SumulaRegistroPage() {
  const { token } = useParams<{ token: string }>()
  const [registro, setRegistro] = useState<Registro | null>(null)
  const [erro, setErro] = useState('')
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    let ativo = true
    // Link com o id da partida (portal público) usa a rota pública; link com token usa a consulta por token.
    const urlConsulta = /^\d+$/.test(token) ? `/api/partidas/${token}/sumula-publica` : `/api/sumula/${encodeURIComponent(token)}?consulta=1`
    fetch(urlConsulta, { cache: 'no-store' })
      .then(async (resposta) => {
        const json = await resposta.json().catch(() => ({}))
        if (!resposta.ok) throw new Error(json.error || 'Não foi possível abrir a súmula.')
        if (ativo) setRegistro(json.data)
      })
      .catch((falha) => {
        if (ativo) setErro(falha instanceof Error ? falha.message : 'Não foi possível abrir a súmula.')
      })
      .finally(() => {
        if (ativo) setCarregando(false)
      })
    return () => {
      ativo = false
    }
  }, [token])

  const liberos = useMemo(() => (registro ? liberosPorSet(registro) : []), [registro])
  // M4 (doc 24): a ordem vem da função compartilhada, nunca da ordem em que o banco devolve.
  const ocorrencias = useMemo(() => emOrdemCronologica(registro?.ocorrencias ?? [], 'auto'), [registro])
  const tempos = useMemo(() => (registro ? temposDaPartida(ocorrencias) : []), [registro, ocorrencias])
  const eventos = useMemo(() => ocorrencias.filter((item) => textoDaOcorrencia(item.descricao)), [ocorrencias])
  const totalOverrides = useMemo(() => contarOverrides(ocorrencias.map((item) => item.descricao)), [ocorrencias])

  if (carregando) {
    return <main className="sumula-registro"><p className="sumula-registro-estado">Carregando o registro da súmula.</p></main>
  }
  if (erro || !registro?.equipeA || !registro.equipeB) {
    return <main className="sumula-registro"><p className="sumula-registro-estado">{erro || 'Súmula indisponível.'}</p></main>
  }

  const vencedor = registro.vencedorId === registro.equipeA.id ? normalizarNomeEquipe(registro.equipeA.nome) : registro.vencedorId === registro.equipeB.id ? normalizarNomeEquipe(registro.equipeB.nome) : null

  return (
    <main className="sumula-registro">
      <header>
        <p>Súmula digital</p>
        <h1 className="flex flex-wrap items-center gap-3">
          <TeamIdentity nome={registro.equipeA.nome} cor={registro.equipeA.corHex} logoUrl={registro.equipeA.logoUrl} compact showName={false} />
          <NomeEquipe nome={registro.equipeA.nome} />
          <small>vs</small>
          <TeamIdentity nome={registro.equipeB.nome} cor={registro.equipeB.corHex} logoUrl={registro.equipeB.logoUrl} compact showName={false} />
          <NomeEquipe nome={registro.equipeB.nome} />
        </h1>
        <strong>{registro.setsPorA ?? 0} × {registro.setsPorB ?? 0}</strong>
        <a
          href={`/sumula/${encodeURIComponent(token)}/imprimir`}
          className="mt-3 inline-flex min-h-[44px] items-center justify-center rounded-md border border-current px-4 text-sm font-bold"
        >
          Imprimir súmula
        </a>
      </header>

      {totalOverrides > 0 ? (
        <p role="status" className="rounded-lg border-2 border-amber-600 bg-amber-50 p-3 text-sm font-semibold text-amber-950">
          {avisoDeOverrides(totalOverrides)}
        </p>
      ) : null}

      <section>
        <h2>Informações da partida</h2>
        <dl>
          <div><dt>Campeonato</dt><dd>{registro.liga?.nome || 'Campeonato'}</dd></div>
          <div><dt>Categoria</dt><dd>{registro.categoria || 'Não informada'}</dd></div>
          <div><dt>Data</dt><dd>{agendaDaPartida(registro).data || 'Não informada'}</dd></div>
          <div><dt>Local</dt><dd>{agendaDaPartida(registro).local || 'Não informado'}</dd></div>
          <div><dt>Fase</dt><dd>{agendaDaPartida(registro).rotulo}</dd></div>
          <div><dt>Arbitragem</dt><dd>{nomesDaArbitragem(registro.escala ?? [])}</dd></div>
        </dl>
      </section>

      <section>
        <h2>Escalação</h2>
        <div className="sumula-registro-duas">
          <ListaEquipe equipe={registro.equipeA} presencas={registro.presencas ?? []} />
          <ListaEquipe equipe={registro.equipeB} presencas={registro.presencas ?? []} />
        </div>
        <h3>Líbero utilizado em cada set</h3>
        {liberos.length ? (
          <table>
            <thead><tr><th>Set</th><th>Líbero utilizado</th></tr></thead>
            <tbody>
              {liberos.map((linha) => (
                <tr key={linha.set}>
                  <td>{linha.set}º set</td>
                  <td>{linha.nomes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <p>Nenhum líbero registrado pelo árbitro.</p>}
      </section>

      <section>
        <h2>Registro dos sets</h2>
        {(registro.sets ?? []).length ? (
          <table>
            <thead><tr><th>Set</th><th><NomeEquipe nome={registro.equipeA.nome} /></th><th><NomeEquipe nome={registro.equipeB.nome} /></th></tr></thead>
            <tbody>
              {registro.sets?.map((set) => (
                <tr key={set.id || set.numero}>
                  <td>{set.numero}º set</td>
                  <td>{set.pontosA}</td>
                  <td>{set.pontosB}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <p>Nenhum set encerrado ainda.</p>}
      </section>

      <section>
        <h2>Tempos</h2>
        {tempos.length ? (
          <table>
            <thead><tr><th>Set</th><th>Tempo</th><th>Registro</th></tr></thead>
            <tbody>
              {tempos.map((tempo) => (
                <tr key={tempo.id}>
                  <td>{tempo.set}º set</td>
                  <td>{tempo.hora}</td>
                  <td>{tempo.texto}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <p>Nenhum tempo registrado pelo árbitro.</p>}
      </section>

      <section>
        <h2>Eventos da partida</h2>
        {eventos.length ? (
          <ol>
            {eventos.map((evento) => {
              const partes = partesDaDescricao(evento.descricao)
              const decisao = lerOverride(evento.descricao)
              return <li key={evento.id}><span>{partes.hora || '—'}</span><span>{evento.set ? `${evento.set}º set` : ''}</span><span>{partes.texto}{decisao ? <strong> [Decisão do árbitro: {decisao.justificativa}]</strong> : null}</span></li>
            })}
          </ol>
        ) : <p>Nenhum acontecimento registrado pelo árbitro.</p>}
      </section>

      <section>
        <h2>Resultado final</h2>
        <p className="sumula-registro-placar">{registro.setsPorA ?? 0} × {registro.setsPorB ?? 0}</p>
        <p>{vencedor ? `${vencedor} venceu a partida.` : 'A partida ainda não tem vencedor registrado.'}</p>
        {registro.destaques?.length ? <p>MVP: {registro.destaques.map((item) => item.jogador?.nome).filter(Boolean).join(', ')}</p> : null}
      </section>
    </main>
  )
}

function ListaEquipe({ equipe, presencas }: { equipe: Equipe; presencas: NonNullable<Registro['presencas']> }) {
  const presentes = new Set(presencas.filter((item) => item.equipeId === equipe.id && item.presente).map((item) => item.jogadorId))
  const atletas = (equipe.jogadores ?? []).filter((jogador) => presentes.size === 0 || presentes.has(jogador.id))
  return (
    <article>
      <h3 className="flex items-center gap-2">
        <TeamIdentity nome={equipe.nome} cor={equipe.corHex} logoUrl={equipe.logoUrl} compact showName={false} />
        <NomeEquipe nome={equipe.nome} />
      </h3>
      {atletas.length ? (
        <ul>
          {atletas.map((jogador) => {
            const numero = numeroNaPartida(jogador, presencas)
            return <li key={jogador.id}>#{numero ?? '—'} {jogador.nome}{jogador.posicao ? ` · ${jogador.posicao}` : ''}</li>
          })}
        </ul>
      ) : <p>Nenhum atleta confirmado.</p>}
    </article>
  )
}

function nomesDaArbitragem(escala: NonNullable<Registro['escala']>) {
  const nomes = escala.map((item) => item.arbitro?.nome).filter(Boolean)
  return nomes.length ? nomes.join(', ') : 'Não registrada'
}

function partesDaDescricao(descricao?: string | null) {
  const partes = String(descricao ?? '').split('|').map((parte) => parte.trim())
  if (partes.length < 3) return { hora: '', texto: limparMarcas(String(descricao ?? '')) }
  return { hora: partes[0], texto: limparMarcas(partes.slice(2).join(' | ')) }
}

function textoDaOcorrencia(descricao?: string | null) {
  return partesDaDescricao(descricao).texto
}

function nomePeloNumero(equipe: Equipe | null | undefined, numero: string, presencas: NonNullable<Registro['presencas']> = []) {
  const atleta = equipe?.jogadores?.find((jogador) => {
    const efetivo = numeroNaPartida(jogador, presencas)
    return String(efetivo ?? '') === numero || String(jogador.numero ?? '') === numero
  })
  return atleta ? `${atleta.nome}` : `#${numero}`
}

function liberosPorSet(registro: Registro) {
  const porSet = new Map<number, Map<string, string>>()
  for (const evento of registro.ocorrencias ?? []) {
    const texto = textoDaOcorrencia(evento.descricao)
    const set = Number(evento.set) || 1
    const iniciais = lerLiberosIniciais(texto)
    if (iniciais) {
      const mapa = porSet.get(set) ?? new Map<string, string>()
      if (iniciais.liberoA) mapa.set(iniciais.equipeA, nomePeloNumero(equipePeloNome(registro, iniciais.equipeA), iniciais.liberoA, registro.presencas ?? []))
      if (iniciais.liberoB) mapa.set(iniciais.equipeB, nomePeloNumero(equipePeloNome(registro, iniciais.equipeB), iniciais.liberoB, registro.presencas ?? []))
      if (mapa.size) porSet.set(set, mapa)
    }
    const troca = texto.match(/Troca de líbero\s+(.+?):\s*sai\s+#\S+.+?entra\s+#(\S+)\s+(.+?)(?:\.|$)/i)
    if (troca) {
      const mapa = porSet.get(set) ?? new Map<string, string>()
      mapa.set(troca[1].trim(), troca[3].trim())
      porSet.set(set, mapa)
    }
  }
  return Array.from(porSet.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([set, mapa]) => ({ set, nomes: Array.from(mapa.entries()).map(([equipe, nome]) => `${equipe}: ${nome}`).join(' · ') }))
}

function equipePeloNome(registro: Registro, nome: string) {
  const alvo = nome.trim().toLowerCase()
  if (registro.equipeA?.nome.toLowerCase() === alvo) return registro.equipeA
  if (registro.equipeB?.nome.toLowerCase() === alvo) return registro.equipeB
  return null
}

function temposDaPartida(ocorrencias: Ocorrencia[]) {
  return ocorrencias
    .filter((evento) => evento.tipo === 'timeout' || /tempo técnico/i.test(textoDaOcorrencia(evento.descricao)))
    .map((evento) => {
      const partes = partesDaDescricao(evento.descricao)
      return { id: evento.id, set: Number(evento.set) || 1, hora: partes.hora || '—', texto: partes.texto || 'Tempo' }
    })
}
