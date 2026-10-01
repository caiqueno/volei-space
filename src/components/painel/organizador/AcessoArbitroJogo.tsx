'use client'

import { useEffect, useState } from 'react'

type Estado = {
  status: 'SEM_LINK' | 'ATIVO' | 'REVOGADO'
  caminho: string | null
}

export function AcessoArbitroJogo({ partidaId, jogo }: { partidaId: number; jogo: string }) {
  const [estado, setEstado] = useState<Estado | null>(null)
  const [aberto, setAberto] = useState<'gerar' | 'codigo' | 'ver' | null>(null)
  const [codigo, setCodigo] = useState('')
  const [confirmar, setConfirmar] = useState('')
  const [aviso, setAviso] = useState('')
  const [erro, setErro] = useState('')
  const [ocupado, setOcupado] = useState(false)

  async function ler() {
    const resposta = await fetch(`/api/organizador/partidas/${partidaId}/acesso-arbitro`)
    const json = await resposta.json().catch(() => ({}))
    if (!resposta.ok) throw new Error(json.error || 'Não foi possível ler o link.')
    setEstado(json.data)
  }

  useEffect(() => {
    ler().catch((falha) => setErro(falha instanceof Error ? falha.message : 'Não foi possível ler o link.'))
  }, [partidaId])

  function linkAbsoluto() {
    if (!estado?.caminho) return ''
    return `${window.location.origin}${estado.caminho}`
  }

  async function enviar(acao: 'gerar' | 'codigo' | 'regenerar' | 'revogar') {
    setOcupado(true)
    setErro('')
    setAviso('')
    try {
      const resposta = await fetch(`/api/organizador/partidas/${partidaId}/acesso-arbitro`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ acao, codigo, confirmar }),
      })
      const json = await resposta.json().catch(() => ({}))
      if (!resposta.ok) throw new Error(json.error || 'Não foi possível atualizar o acesso.')
      setEstado(json.data)
      setAberto(acao === 'gerar' || acao === 'regenerar' ? 'ver' : null)
      setCodigo('')
      setConfirmar('')
      if (acao === 'revogar') setAviso('Acesso revogado.')
      if (acao === 'codigo') setAviso('Código alterado. O link continua o mesmo.')
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : 'Não foi possível atualizar o acesso.')
    } finally {
      setOcupado(false)
    }
  }

  async function copiar() {
    await navigator.clipboard.writeText(linkAbsoluto())
    setAviso('Link copiado!')
  }

  const ativo = estado?.status === 'ATIVO'

  return (
    <div className="min-w-[220px]">
      <p className="text-xs font-black uppercase tracking-wide text-white/55">Link do árbitro: {estado?.status === 'ATIVO' ? 'ATIVO' : estado?.status === 'REVOGADO' ? 'REVOGADO' : 'SEM LINK'}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {!ativo ? (
          <button type="button" onClick={() => { setAberto('gerar'); setErro(''); setAviso('') }} className="rounded-full bg-[#ffb331] px-3 py-2 text-xs font-black text-[#050914]">Gerar link do jogo</button>
        ) : (
          <>
            <button type="button" onClick={() => void copiar()} className="rounded-full border border-white/15 px-3 py-2 text-xs font-black">Copiar link</button>
            <button type="button" onClick={() => setAberto('ver')} className="rounded-full border border-white/15 px-3 py-2 text-xs font-black">Ver link</button>
            <button type="button" onClick={() => { setAberto('codigo'); setErro(''); setAviso('') }} className="rounded-full border border-white/15 px-3 py-2 text-xs font-black">Alterar código</button>
            <button type="button" onClick={() => void enviar('regenerar')} disabled={ocupado} className="rounded-full border border-white/15 px-3 py-2 text-xs font-black">Regenerar link</button>
            <button type="button" onClick={() => void enviar('revogar')} disabled={ocupado} className="rounded-full border border-red-300/40 px-3 py-2 text-xs font-black text-red-100">Revogar</button>
          </>
        )}
      </div>
      {aviso ? <p className="mt-2 text-xs font-black text-emerald-300">{aviso}</p> : null}
      {erro ? <p className="mt-2 text-xs font-bold text-red-200">{erro}</p> : null}
      {aberto === 'ver' && ativo ? (
        <p className="mt-2 break-all rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-xs font-bold">{linkAbsoluto()}</p>
      ) : null}
      {aberto === 'gerar' || aberto === 'codigo' ? (
        <form
          className="mt-3 grid gap-2 rounded-2xl border border-white/10 bg-black/30 p-3"
          onSubmit={(evento) => {
            evento.preventDefault()
            void enviar(aberto === 'gerar' ? 'gerar' : 'codigo')
          }}
        >
          <p className="text-sm font-black">{aberto === 'gerar' ? 'Gerar acesso do árbitro' : 'Alterar código'}</p>
          <p className="text-xs font-semibold text-white/70">{jogo}</p>
          <input aria-label="Código de acesso" value={codigo} onChange={(evento) => setCodigo(evento.target.value)} placeholder="Código de acesso" className="rounded-xl border border-white/15 bg-[#07111f] px-3 py-2 text-sm" />
          <input aria-label="Confirmar código" value={confirmar} onChange={(evento) => setConfirmar(evento.target.value)} placeholder="Confirmar código" className="rounded-xl border border-white/15 bg-[#07111f] px-3 py-2 text-sm" />
          <div className="flex gap-2">
            <button type="button" onClick={() => setAberto(null)} className="rounded-full border border-white/15 px-3 py-2 text-xs font-black">Cancelar</button>
            <button type="submit" disabled={ocupado} className="rounded-full bg-[#ffb331] px-3 py-2 text-xs font-black text-[#050914]">{aberto === 'gerar' ? 'Gerar link' : 'Salvar código'}</button>
          </div>
        </form>
      ) : null}
    </div>
  )
}
