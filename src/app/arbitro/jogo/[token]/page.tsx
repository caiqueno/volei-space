'use client'

import { useCallback, useRef, useState, type FormEvent } from 'react'
import { textoAtualizado } from '@/lib/banco-ui/polling'
import { usePolling } from '@/lib/banco-ui/use-polling'
import { TeamIdentity } from '@/components/equipes/TeamIdentity'
import { formatarDataPartida } from '@/lib/format-partida'
import { useParams, useRouter } from 'next/navigation'

type Lado = { nome: string; logoUrl?: string | null; corHex?: string | null }
type Jogo = {
  equipeA: Lado
  equipeB: Lado
  dataHora: string | null
  localNome: string | null
}

export default function AcessoArbitroPage() {
  const { token } = useParams<{ token: string }>()
  const router = useRouter()
  const [jogo, setJogo] = useState<Jogo | null>(null)
  const [codigo, setCodigo] = useState('')
  const [erro, setErro] = useState('')
  const [revogado, setRevogado] = useState(false)
  const [carregando, setCarregando] = useState(true)
  const [entrando, setEntrando] = useState(false)
  const [validado, setValidado] = useState(false)

  // Consulta ao vivo: a cada 3 s (recuo em falha), pausa com a aba oculta e retoma ao voltar. Só troca o estado
  // quando o conteúdo muda, para a tela (e o que o árbitro está digitando) ficar exatamente onde estava.
  const ultimoJogo = useRef('')
  const consultarJogo = useCallback(async (): Promise<'parar' | void> => {
    try {
      const resposta = await fetch(`/api/arbitro/jogo/${token}`, { cache: 'no-store' })
      const json = await resposta.json().catch(() => ({}))
      if (resposta.status === 410) {
        setRevogado(true)
        setCarregando(false)
        return 'parar'
      }
      if (!resposta.ok) {
        // Erro 4xx (link inválido): avisa e para; 5xx: mantém o último jogo e tenta de novo com recuo.
        if (resposta.status >= 500) throw new Error('indisponivel')
        setErro(json.error ?? 'Link de acesso inválido.')
        setCarregando(false)
        return 'parar'
      }
      const texto = JSON.stringify(json.data.jogo)
      if (texto !== ultimoJogo.current) {
        ultimoJogo.current = texto
        setJogo(json.data.jogo)
      }
      setCarregando(false)
    } catch {
      if (!ultimoJogo.current) setErro('Não foi possível carregar o jogo agora. Tentando de novo.')
      setCarregando((atual) => (ultimoJogo.current ? atual : false))
      throw new Error('falha')
    }
  }, [token])
  const { semConexao, ultimaAtualizacao } = usePolling(consultarJogo, !validado)

  async function entrar(evento: FormEvent) {
    evento.preventDefault()
    if (entrando || validado) return
    setEntrando(true)
    setErro('')
    try {
      const resposta = await fetch(`/api/arbitro/jogo/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ codigo }),
      })
      const json = await resposta.json().catch(() => ({}))
      if (!resposta.ok) {
        setErro(json.error ?? 'Código de acesso inválido. Confira o código enviado pelo organizador e tente novamente.')
        return
      }
      setValidado(true)
      router.push(json.data.redirectTo)
    } catch {
      setErro('Não foi possível validar o código agora.')
    } finally {
      setEntrando(false)
    }
  }

  const quando = formatarDataPartida(jogo?.dataHora) ?? 'Horário a definir'

  return (
    <main className="luva-shell flex min-h-screen items-center justify-center px-4 py-10 text-white">
      <section className="w-full max-w-md rounded-[1.75rem] border border-white/10 bg-[#07111f] p-6">
        <p className="text-xs font-black uppercase tracking-[0.16em] text-luva-amber">Acesso do árbitro</p>
        {carregando ? <p className="mt-6 text-sm font-bold text-white/70">Identificando o jogo...</p> : null}
        {revogado ? (
          <div className="mt-6">
            <h1 className="font-display text-3xl font-black">Acesso indisponível</h1>
            <p className="mt-3 text-sm font-semibold leading-6 text-white/75">Este link de acesso ao jogo foi revogado pelo organizador.</p>
          </div>
        ) : null}
        {!carregando && !revogado && !jogo ? <p className="mt-6 text-sm font-bold text-red-200">{erro || 'Link de acesso inválido.'}</p> : null}
        {jogo && !revogado ? (
          <form className="mt-6" onSubmit={entrar}>
            <h1 className="flex flex-wrap items-center gap-2 font-display text-3xl font-black">
              <TeamIdentity nome={jogo.equipeA.nome} cor={jogo.equipeA.corHex} logoUrl={jogo.equipeA.logoUrl} compact showName={false} />
              <span>{jogo.equipeA.nome}</span>
              <span>×</span>
              <TeamIdentity nome={jogo.equipeB.nome} cor={jogo.equipeB.corHex} logoUrl={jogo.equipeB.logoUrl} compact showName={false} />
              <span>{jogo.equipeB.nome}</span>
            </h1>
            <p className="mt-2 text-sm font-semibold text-white/70">{quando}</p>
            <p className="text-sm font-semibold text-white/70">{jogo.localNome || 'Quadra a definir'}</p>
            <p role="status" className="mt-1 text-xs font-semibold text-white/70">
              {semConexao ? `Sem conexão. Mostrando dados ${ultimaAtualizacao ? textoAtualizado(ultimaAtualizacao) : 'anteriores'}.` : textoAtualizado(ultimaAtualizacao)}
            </p>
            <label className="mt-6 block text-sm font-black" htmlFor="codigo-acesso">Digite o código de acesso</label>
            <input
              id="codigo-acesso"
              value={codigo}
              onChange={(evento) => setCodigo(evento.target.value)}
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              required
              minLength={4}
              maxLength={32}
              aria-describedby="codigo-acesso-ajuda"
              placeholder="Código de 4 a 32 caracteres"
              className="mt-2 w-full rounded-xl border border-white/15 bg-black/30 px-4 py-3 text-base text-white"
            />
            <p id="codigo-acesso-ajuda" className="mt-2 text-xs font-semibold leading-5 text-white/70">
              O código foi definido pelo organizador do campeonato e enviado junto com este link (4 a 32 caracteres, maiúsculas e minúsculas contam). Não recebeu? Peça ao organizador.
            </p>
            {erro ? <p className="mt-3 text-sm font-bold text-red-200">{erro}</p> : null}
            {validado ? <p className="mt-3 text-sm font-black text-emerald-300">Código validado. Abrindo jogo...</p> : null}
            <button type="submit" disabled={entrando || validado} className="mt-5 w-full rounded-full bg-[#ffb331] px-5 py-3 text-sm font-black uppercase tracking-wide text-[#050914] disabled:opacity-60">
              {entrando ? 'Conferindo...' : 'Entrar no jogo'}
            </button>
          </form>
        ) : null}
      </section>
    </main>
  )
}
