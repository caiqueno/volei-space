'use client'

import { useEffect, useState } from 'react'

type Estado = {
  status: 'SEM_LINK' | 'ATIVO' | 'REVOGADO'
  caminho: string | null
}

export type LinkDoJuiz = {
  partidaId: number
  jogo: string
  url: string
  codigo: string | null
}

function chaveCodigo(partidaId: number) {
  return `luva_codigo_juiz_${partidaId}`
}

export function AcessoArbitroJogo({
  partidaId,
  jogo,
  onDisponivel,
}: {
  partidaId: number
  jogo: string
  onDisponivel?: (link: LinkDoJuiz) => void
}) {
  const [estado, setEstado] = useState<Estado | null>(null)
  const [aberto, setAberto] = useState(false)
  const [modo, setModo] = useState<'gerar' | 'codigo' | null>(null)
  const [codigo, setCodigo] = useState('')
  const [confirmar, setConfirmar] = useState('')
  const [codigoVisivel, setCodigoVisivel] = useState('')
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
    try {
      setCodigoVisivel(window.localStorage.getItem(chaveCodigo(partidaId)) ?? '')
    } catch {
      setCodigoVisivel('')
    }
  }, [partidaId])

  function linkAbsoluto() {
    if (!estado?.caminho || typeof window === 'undefined') return ''
    return `${window.location.origin}${estado.caminho}`
  }

  useEffect(() => {
    onDisponivel?.({
      partidaId,
      jogo,
      url: linkAbsoluto(),
      codigo: codigoVisivel || null,
    })
  }, [estado, codigoVisivel, partidaId, jogo])

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
      if (acao === 'gerar' || acao === 'codigo') {
        const gravado = codigo.trim()
        try { window.localStorage.setItem(chaveCodigo(partidaId), gravado) } catch { /* o código continua na tela */ }
        setCodigoVisivel(gravado)
      }
      if (acao === 'revogar') {
        try { window.localStorage.removeItem(chaveCodigo(partidaId)) } catch { /* a sessão local já saiu */ }
        setCodigoVisivel('')
      }
      setEstado(json.data)
      setModo(null)
      setCodigo('')
      setConfirmar('')
      if (acao === 'revogar') setAviso('Acesso revogado.')
      if (acao === 'codigo') setAviso('Código alterado. O link continua o mesmo.')
      if (acao === 'gerar') setAviso('Link do juiz gerado.')
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : 'Não foi possível atualizar o acesso.')
    } finally {
      setOcupado(false)
    }
  }

  async function copiar() {
    const url = linkAbsoluto()
    if (!url) return
    const texto = codigoVisivel ? `${url}\nCódigo: ${codigoVisivel}` : url
    await navigator.clipboard.writeText(texto)
    setAviso('Link copiado.')
  }

  function whatsapp() {
    const url = linkAbsoluto()
    if (!url) return
    const texto = `Link do juiz — ${jogo}\n${url}${codigoVisivel ? `\nCódigo: ${codigoVisivel}` : ''}`
    window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, '_blank', 'noopener,noreferrer')
  }

  const ativo = estado?.status === 'ATIVO'

  return (
    <div>
      <button type="button" onClick={() => { setAberto(true); setErro(''); setAviso('') }} className="rounded-full bg-[#ffb331] px-3 py-2 text-xs font-black text-[#050914]">
        Link do juiz
      </button>
      {aberto ? (
        <div className="fixed inset-0 z-[80] grid place-items-end bg-black/50 p-4 sm:place-items-center" role="dialog" aria-modal="true" aria-label="Link do juiz">
          <div className="grid w-full max-w-md gap-3 rounded-3xl border border-white/10 bg-[#07111f] p-4 text-white shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-black">Link do juiz</p>
                <p className="mt-1 text-xs font-semibold text-white/70">{jogo}</p>
              </div>
              <button type="button" onClick={() => setAberto(false)} className="rounded-full border border-white/15 px-3 py-2 text-xs font-black">Fechar</button>
            </div>
            <p className="text-xs font-black uppercase tracking-wide text-white/55">{ativo ? 'Ativo' : estado?.status === 'REVOGADO' ? 'Revogado' : 'Sem link'}</p>
            {ativo && codigoVisivel ? <p className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm font-black">Código: {codigoVisivel}</p> : null}
            {ativo && !codigoVisivel ? <p className="text-xs font-semibold text-white/60">O código fica visível neste navegador depois de gerado. Gere de novo se precisar mostrá-lo outra vez.</p> : null}
            {ativo ? <p className="break-all rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-xs font-bold">{linkAbsoluto()}</p> : null}
            <div className="flex flex-wrap gap-2">
              {!ativo ? (
                <button type="button" onClick={() => setModo('gerar')} className="rounded-full bg-[#ffb331] px-3 py-2 text-xs font-black text-[#050914]">Gerar link</button>
              ) : (
                <>
                  <button type="button" onClick={() => void copiar()} className="rounded-full border border-white/15 px-3 py-2 text-xs font-black">Copiar</button>
                  <button type="button" onClick={whatsapp} className="rounded-full border border-white/15 px-3 py-2 text-xs font-black">WhatsApp</button>
                  <button type="button" onClick={() => setModo('codigo')} className="rounded-full border border-white/15 px-3 py-2 text-xs font-black">Alterar código</button>
                  <button type="button" onClick={() => void enviar('regenerar')} disabled={ocupado} className="rounded-full border border-white/15 px-3 py-2 text-xs font-black">Regenerar link</button>
                  <button type="button" onClick={() => void enviar('revogar')} disabled={ocupado} className="rounded-full border border-red-300/40 px-3 py-2 text-xs font-black text-red-100">Revogar</button>
                </>
              )}
            </div>
            {modo ? (
              <form
                className="grid gap-2"
                onSubmit={(evento) => {
                  evento.preventDefault()
                  void enviar(modo === 'gerar' ? 'gerar' : 'codigo')
                }}
              >
                <input aria-label="Código de acesso" value={codigo} onChange={(evento) => setCodigo(evento.target.value)} placeholder="Código de acesso" className="rounded-xl border border-white/15 bg-[#07111f] px-3 py-2 text-sm" />
                <input aria-label="Confirmar código" value={confirmar} onChange={(evento) => setConfirmar(evento.target.value)} placeholder="Confirmar código" className="rounded-xl border border-white/15 bg-[#07111f] px-3 py-2 text-sm" />
                <button type="submit" disabled={ocupado} className="rounded-full bg-[#ffb331] px-3 py-2 text-xs font-black text-[#050914]">{modo === 'gerar' ? 'Gerar link' : 'Salvar código'}</button>
              </form>
            ) : null}
            {aviso ? <p className="text-xs font-black text-emerald-300">{aviso}</p> : null}
            {erro ? <p className="text-xs font-bold text-red-200">{erro}</p> : null}
          </div>
        </div>
      ) : null}
    </div>
  )
}
