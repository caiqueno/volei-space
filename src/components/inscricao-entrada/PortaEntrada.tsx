'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { ErroMeuTime, obterClientePadrao } from '@/components/meu-time/cliente'
import { extrairData } from '@/lib/meu-time-ui/respostas'
import {
  estadoDaPorta,
  guardarEntrada,
  hrefCadastro,
  hrefContinuacao,
  hrefLogin,
  inscricaoViaMeuTimeAtiva,
  montarReturnTo,
  normalizarEntrada,
  ROTULO_MODO_ENTRADA,
  textoPeriodo,
  type CategoriaEntrada,
  type EstadoPorta,
} from '@/lib/inscricao-entrada-ui/regras'

const botaoGrande =
  'inline-flex min-h-[56px] w-full items-center justify-center rounded-2xl bg-[#ffb331] px-6 py-4 text-lg font-black text-slate-950 focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-white disabled:opacity-60'
const botaoContorno =
  'inline-flex min-h-[48px] w-full items-center justify-center rounded-2xl border border-white/25 px-5 py-3 text-base font-black text-white focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-white'

function Moldura({ children }: { children: React.ReactNode }) {
  return (
    <main className="luva-shell flex min-h-screen items-center justify-center px-4 py-10 text-white">
      <section className="w-full max-w-xl" aria-live="polite">{children}</section>
    </main>
  )
}

function Mensagem({ titulo, texto, nome }: { titulo: string; texto: string; nome?: string }) {
  return (
    <Moldura>
      <h1 className="font-display text-3xl font-black">{titulo}</h1>
      {nome && <p className="mt-2 text-sm font-semibold text-white/75">{nome}</p>}
      <p className="mt-3 text-base font-semibold leading-6 text-white/75">{texto}</p>
      <Link href="/" className={`${botaoContorno} mt-6 sm:w-auto`}>Ir para o início</Link>
    </Moldura>
  )
}

export function PortaEntrada({ token, buscar }: { token: string; buscar?: typeof fetch }) {
  const ativo = inscricaoViaMeuTimeAtiva()
  const [estado, setEstado] = useState<EstadoPorta>(ativo ? { estado: 'carregando' } : { estado: 'desligada' })
  const [verificando, setVerificando] = useState<string | null>(null)

  useEffect(() => {
    if (!ativo) return
    let vivo = true
    const chamar = buscar ?? ((...a: Parameters<typeof fetch>) => fetch(...a))
    chamar(`/api/inscricao/entrada/${encodeURIComponent(token)}`, { cache: 'no-store', credentials: 'same-origin' })
      .then(async (res) => {
        let json: unknown = null
        try {
          json = await res.json()
        } catch {
          json = null
        }
        const entrada = res.ok ? normalizarEntrada(extrairData<unknown>(json)) : null
        if (vivo) setEstado(estadoDaPorta(true, { status: res.status, entrada }))
      })
      .catch(() => {
        if (vivo) setEstado(estadoDaPorta(true, { status: 599, entrada: null }))
      })
    return () => { vivo = false }
  }, [ativo, buscar, token])

  async function inscrever(categoriaId?: string) {
    setVerificando(categoriaId ?? 'todas')
    guardarEntrada({ entrada: token, categoria: categoriaId })
    let temSessao = true
    try {
      await obterClientePadrao().listarEquipes()
    } catch (e) {
      if (e instanceof ErroMeuTime && e.falha.tipo === 'sem-sessao') temSessao = false
    }
    const continuacao = montarReturnTo(token, categoriaId)
    window.location.assign(temSessao ? hrefContinuacao(token, categoriaId) : hrefLogin(continuacao))
  }

  if (estado.estado === 'desligada') return null
  if (estado.estado === 'carregando') {
    return <Moldura><p role="status" className="text-base font-semibold text-white/75">Abrindo o convite…</p></Moldura>
  }
  if (estado.estado === 'invalido') {
    return <Mensagem titulo="Link inválido ou expirado" texto="Peça ao organizador um link novo para a inscrição do seu time." />
  }
  if (estado.estado === 'indisponivel') {
    return <Mensagem titulo="Não foi possível abrir agora" texto="Verifique sua internet e abra o link de novo em instantes." />
  }
  if (estado.estado === 'ainda-nao') {
    return <Mensagem titulo="Inscrições ainda não abertas" nome={estado.entrada.campeonato} texto="Volte neste link quando o período de inscrição começar." />
  }
  if (estado.estado === 'encerrada') {
    return <Mensagem titulo="Inscrições encerradas" nome={estado.entrada.campeonato} texto="O período de inscrição destas categorias terminou." />
  }

  const { entrada, abertas } = estado
  const unica = abertas.length === 1
  const retornoGeral = montarReturnTo(token, unica ? abertas[0].categoriaId : undefined)

  return (
    <Moldura>
      <p className="text-xs font-black uppercase tracking-[0.16em] text-luva-amber">Inscrição de equipe</p>
      <h1 className="mt-2 font-display text-4xl font-black leading-tight">{entrada.campeonato}</h1>
      {entrada.privada && <p className="mt-2 text-sm font-semibold text-white/70">Campeonato com inscrição por convite.</p>}

      <ul className="mt-6 flex flex-col gap-3" aria-label="Categorias abertas">
        {abertas.map((c: CategoriaEntrada) => (
          <li key={c.categoriaId} className="rounded-2xl border border-white/15 bg-white/5 p-4">
            <h2 className="text-xl font-black">
              {c.nome}
              {c.naipe ? ` · ${c.naipe.charAt(0)}${c.naipe.slice(1).toLowerCase()}` : ''}
            </h2>
            <p className="mt-1 text-sm font-semibold text-white/75">{textoPeriodo(c)}</p>
            <p className="mt-1 text-sm font-semibold text-white/75">{ROTULO_MODO_ENTRADA[c.modo]}</p>
            {!unica && (
              <button type="button" className={`${botaoGrande} mt-3`} disabled={verificando !== null} onClick={() => void inscrever(c.categoriaId)}>
                {verificando === c.categoriaId ? 'Abrindo…' : 'Inscrever meu time nesta categoria'}
              </button>
            )}
          </li>
        ))}
      </ul>

      {unica && (
        <button type="button" className={`${botaoGrande} mt-6`} disabled={verificando !== null} onClick={() => void inscrever(abertas[0].categoriaId)}>
          {verificando ? 'Abrindo…' : 'Inscrever meu time'}
        </button>
      )}

      <p className="mt-6 text-sm font-semibold leading-6 text-white/70">
        Quem inscreve é o líder do time, pelo Meu Time. Se ainda não tem conta, crie a sua em um minuto e volte direto para esta inscrição.
      </p>
      <Link href={hrefCadastro(retornoGeral)} className={`${botaoContorno} mt-3`}>Criar conta de líder</Link>
    </Moldura>
  )
}
