'use client'

import { useEffect, useState } from 'react'

type Estado = {
  status: 'SEM_LINK' | 'ATIVO' | 'DESATIVADO'
  caminho: string | null
  nome?: string
}

export function LinkInscricaoCampeonato({ ligaId, nome, compacto = false }: { ligaId: number; nome: string; compacto?: boolean }) {
  const [estado, setEstado] = useState<Estado | null>(null)
  const [aberto, setAberto] = useState(false)
  const [confirmar, setConfirmar] = useState(false)
  const [aviso, setAviso] = useState('')
  const [erro, setErro] = useState('')
  const [ocupado, setOcupado] = useState(false)

  async function ler() {
    const resposta = await fetch(`/api/organizador/ligas/${ligaId}/link-inscricao`)
    const json = await resposta.json().catch(() => ({}))
    if (!resposta.ok) throw new Error(json.error || 'Não foi possível ler o link.')
    setEstado(json.data)
  }

  useEffect(() => {
    if (!aberto) return
    ler().catch((falha) => setErro(falha instanceof Error ? falha.message : 'Não foi possível ler o link.'))
  }, [aberto, ligaId])

  function absoluto() {
    if (!estado?.caminho) return ''
    return `${window.location.origin}${estado.caminho}`
  }

  async function enviar(acao: 'gerar' | 'regenerar' | 'desativar' | 'reativar') {
    setOcupado(true)
    setErro('')
    setAviso('')
    try {
      const resposta = await fetch(`/api/organizador/ligas/${ligaId}/link-inscricao`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ acao }),
      })
      const json = await resposta.json().catch(() => ({}))
      if (!resposta.ok) throw new Error(json.error || 'Não foi possível atualizar o link.')
      setEstado(json.data)
      setConfirmar(false)
      if (acao === 'gerar') setAviso('Link criado.')
      if (acao === 'regenerar') setAviso('O link anterior deixou de funcionar.')
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : 'Não foi possível atualizar o link.')
    } finally {
      setOcupado(false)
    }
  }

  async function abrir() {
    setAberto(true)
    setErro('')
    setAviso('')
    setConfirmar(false)
    setOcupado(true)
    try {
      const leitura = await fetch(`/api/organizador/ligas/${ligaId}/link-inscricao`)
      const json = await leitura.json().catch(() => ({}))
      if (!leitura.ok) throw new Error(json.error || 'Não foi possível ler o link.')
      if (json.data?.status === 'SEM_LINK') {
        const criado = await fetch(`/api/organizador/ligas/${ligaId}/link-inscricao`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ acao: 'gerar' }),
        })
        const corpo = await criado.json().catch(() => ({}))
        if (!criado.ok) throw new Error(corpo.error || 'Não foi possível gerar o link.')
        setEstado(corpo.data)
        setAviso('Link criado.')
      } else {
        setEstado(json.data)
      }
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : 'Não foi possível gerar o link.')
    } finally {
      setOcupado(false)
    }
  }

  async function copiar() {
    await navigator.clipboard.writeText(absoluto())
    setAviso('Link copiado.')
  }

  return (
    <>
      <button type="button" onClick={abrir} className={compacto ? 'championship-list-link' : 'rounded-full bg-[#ffb331] px-5 py-3 text-sm font-black uppercase tracking-wide text-[#050914]'}>
        {compacto ? 'Link de inscrição' : 'Gerar link de inscrição'}
      </button>
      {aberto ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <section className="w-full max-w-lg rounded-[1.75rem] border border-white/10 bg-[#07111f] p-6 text-white">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-luva-amber">Link de inscrição</p>
            <h2 className="mt-2 font-display text-3xl font-black">{nome}</h2>
            <p className="mt-3 text-sm font-semibold leading-6 text-white/75">Envie este link para as equipes realizarem a inscrição no campeonato.</p>
            {estado?.caminho ? (
              <>
                <p className="mt-4 text-xs font-black uppercase tracking-wide text-white/50">Status: {estado.status === 'ATIVO' ? 'Ativo' : 'Desativado'}</p>
                <p className="mt-2 break-all rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm font-bold">{absoluto()}</p>
              </>
            ) : null}
            {aviso ? <p className="mt-3 text-sm font-black text-emerald-300">{aviso}</p> : null}
            {erro ? <p className="mt-3 text-sm font-bold text-red-200">{erro}</p> : null}
            {confirmar ? (
              <div className="mt-5 rounded-2xl border border-white/10 p-4">
                <p className="font-black">Regenerar link?</p>
                <p className="mt-2 text-sm font-semibold text-white/75">O link atual deixará de funcionar. As inscrições já realizadas não serão afetadas.</p>
                <div className="mt-4 flex gap-2">
                  <button type="button" onClick={() => setConfirmar(false)} className="rounded-full border border-white/20 px-4 py-2 text-sm font-black">Cancelar</button>
                  <button type="button" disabled={ocupado} onClick={() => enviar('regenerar')} className="rounded-full bg-[#ffb331] px-4 py-2 text-sm font-black text-[#050914]">Regenerar link</button>
                </div>
              </div>
            ) : (
              <div className="mt-5 flex flex-wrap gap-2">
                <button type="button" disabled={!estado?.caminho || ocupado} onClick={copiar} className="rounded-full bg-[#ffb331] px-4 py-2 text-sm font-black text-[#050914]">Copiar link</button>
                {estado?.caminho ? <a href={absoluto()} target="_blank" rel="noreferrer" className="rounded-full border border-white/20 px-4 py-2 text-sm font-black">Ver página</a> : null}
                {estado?.status === 'ATIVO' ? <button type="button" disabled={ocupado} onClick={() => enviar('desativar')} className="rounded-full border border-white/20 px-4 py-2 text-sm font-black">Desativar link</button> : null}
                {estado?.status === 'DESATIVADO' ? <button type="button" disabled={ocupado} onClick={() => enviar('reativar')} className="rounded-full border border-white/20 px-4 py-2 text-sm font-black">Reativar link</button> : null}
                {estado?.caminho ? <button type="button" disabled={ocupado} onClick={() => setConfirmar(true)} className="rounded-full border border-white/20 px-4 py-2 text-sm font-black">Regenerar link</button> : null}
                <button type="button" onClick={() => setAberto(false)} className="rounded-full border border-white/20 px-4 py-2 text-sm font-black">Fechar</button>
              </div>
            )}
          </section>
        </div>
      ) : null}
    </>
  )
}
