'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'

type Jogador = { id: number; nome: string; numero?: number | string | null; posicao?: string | null }
type Equipe = { id: number; nome: string; jogadores?: Jogador[] }
type Ocorrencia = { id: number; tipo: string; descricao?: string | null; set?: number | null; jogadorId?: number | null }
type Registro = {
  id: number
  rodada?: number | null
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
    fetch(`/api/sumula/${encodeURIComponent(token)}?consulta=1`, { cache: 'no-store' })
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
  const tempos = useMemo(() => (registro ? temposDaPartida(registro.ocorrencias ?? []) : []), [registro])
  const eventos = useMemo(() => (registro?.ocorrencias ?? []).filter((item) => textoDaOcorrencia(item.descricao)), [registro])

  if (carregando) {
    return <main className="sumula-registro"><p className="sumula-registro-estado">Carregando o registro da súmula.</p></main>
  }
  if (erro || !registro?.equipeA || !registro.equipeB) {
    return <main className="sumula-registro"><p className="sumula-registro-estado">{erro || 'Súmula indisponível.'}</p></main>
  }

  const vencedor = registro.vencedorId === registro.equipeA.id ? registro.equipeA.nome : registro.vencedorId === registro.equipeB.id ? registro.equipeB.nome : null

  return (
    <main className="sumula-registro">
      <header>
        <p>Súmula digital</p>
        <h1>{registro.equipeA.nome} <small>vs</small> {registro.equipeB.nome}</h1>
        <strong>{registro.setsPorA ?? 0} × {registro.setsPorB ?? 0}</strong>
      </header>

      <section>
        <h2>Informações da partida</h2>
        <dl>
          <div><dt>Campeonato</dt><dd>{registro.liga?.nome || 'Campeonato'}</dd></div>
          <div><dt>Categoria</dt><dd>{registro.categoria || 'Não informada'}</dd></div>
          <div><dt>Data</dt><dd>{registro.dataHora ? new Date(registro.dataHora).toLocaleString('pt-BR') : 'A definir'}</dd></div>
          <div><dt>Local</dt><dd>{registro.localNome || 'A definir'}</dd></div>
          <div><dt>Rodada</dt><dd>{registro.rodada || '—'}</dd></div>
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
            <thead><tr><th>Set</th><th>{registro.equipeA.nome}</th><th>{registro.equipeB.nome}</th></tr></thead>
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
              return <li key={evento.id}><span>{partes.hora || '—'}</span><span>{evento.set ? `${evento.set}º set` : ''}</span><span>{partes.texto}</span></li>
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
      <h3>{equipe.nome}</h3>
      {atletas.length ? (
        <ul>
          {atletas.map((jogador) => <li key={jogador.id}>#{jogador.numero ?? '—'} {jogador.nome}{jogador.posicao ? ` · ${jogador.posicao}` : ''}</li>)}
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
  if (partes.length < 3) return { hora: '', texto: String(descricao ?? '') }
  return { hora: partes[0], texto: partes.slice(2).join(' | ') }
}

function textoDaOcorrencia(descricao?: string | null) {
  return partesDaDescricao(descricao).texto
}

function nomePeloNumero(equipe: Equipe | null | undefined, numero: string) {
  const atleta = equipe?.jogadores?.find((jogador) => String(jogador.numero ?? '') === numero)
  return atleta ? `${atleta.nome}` : `#${numero}`
}

function liberosPorSet(registro: Registro) {
  const porSet = new Map<number, Map<string, string>>()
  for (const evento of registro.ocorrencias ?? []) {
    const texto = textoDaOcorrencia(evento.descricao)
    const set = Number(evento.set) || 1
    const iniciais = texto.match(/Líberos iniciais:\s*(.+?)\s+#(\S+)\s+e\s+(.+?)\s+#(\S+)/i)
    if (iniciais) {
      const mapa = porSet.get(set) ?? new Map<string, string>()
      mapa.set(iniciais[1].trim(), nomePeloNumero(equipePeloNome(registro, iniciais[1]), iniciais[2].replace(/\D/g, '')))
      mapa.set(iniciais[3].trim(), nomePeloNumero(equipePeloNome(registro, iniciais[3]), iniciais[4].replace(/\D/g, '')))
      porSet.set(set, mapa)
    }
    const troca = texto.match(/Troca de líbero\s+(.+?):\s*sai\s+#\S+.+?entra\s+#(\S+)\s+(.+?)(?:\.|$)/i)
    if (troca) {
      const mapa = porSet.get(set) ?? new Map<string, string>()
      mapa.set(troca[1].trim(), troca[3].trim())
      porSet.set(set, mapa)
    }
  }
  return [...porSet.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([set, mapa]) => ({ set, nomes: [...mapa.entries()].map(([equipe, nome]) => `${equipe}: ${nome}`).join(' · ') }))
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
