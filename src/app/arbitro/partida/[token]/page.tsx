'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowRight, Camera, CheckCircle2, ClipboardCheck, QrCode, ShieldAlert, StopCircle, Timer, UserCheck, X } from 'lucide-react'
import { ActionBar } from '@/components/ui/action-bar'
import { TeamIdentity } from '@/components/equipes/TeamIdentity'
import { numeroNaPartida, presencaFoiDecidida, proximoAtletaNoElenco, validarTrocaNumeroCamisa } from '@/lib/numero-camisa-partida'

export default function OperacaoArbitroPage() {
  const { token } = useParams<{ token: string }>()
  const [partida, setPartida] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [falha, setFalha] = useState('')
  const [savingId, setSavingId] = useState<number | null>(null)
  const [qr, setQr] = useState('')
  const [msg, setMsg] = useState('')
  const [validating, setValidating] = useState(false)
  const [starting, setStarting] = useState(false)
  const [editorNumero, setEditorNumero] = useState<number | null>(null)
  const [rascunhoNumero, setRascunhoNumero] = useState('')
  const [erroNumero, setErroNumero] = useState('')
  const [salvandoNumeroId, setSalvandoNumeroId] = useState<number | null>(null)
  const [numeroSalvoId, setNumeroSalvoId] = useState<number | null>(null)
  const [avisoNumero, setAvisoNumero] = useState('')
  const badgeRefs = useRef<Record<number, HTMLButtonElement | null>>({})
  const [scannerOpen, setScannerOpen] = useState(false)
  const [cameraOpen, setCameraOpen] = useState(false)
  const [scanError, setScanError] = useState('')
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const rafRef = useRef<number | null>(null)
  const scanningRef = useRef(false)

  async function fetchPartida(inicial = false) {
    if (inicial) setLoading(true)
    try {
      const res = await fetch(`/api/arbitro/partidas/${token}`)
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setPartida(null)
        setFalha(json.error ?? 'Não foi possível abrir a partida.')
        return
      }
      setFalha('')
      setPartida(json.data)
    } catch {
      setFalha('Falha de conexão. Tente novamente.')
    } finally {
      if (inicial) setLoading(false)
    }
  }

  useEffect(() => {
    fetchPartida(true)
  }, [token])

  useEffect(() => {
    return () => stopCamera()
  }, [])

  const presencas = useMemo(() => partida?.presencas ?? [], [partida])
  const jogadoresA = partida?.equipeA?.jogadores ?? []
  const jogadoresB = partida?.equipeB?.jogadores ?? []
  const totalAtletas = jogadoresA.length + jogadoresB.length
  const presencasDecididas = presencas.filter((item: { presente?: boolean | null }) => presencaFoiDecidida(item))
  const totalValidados = presencasDecididas.length
  const progresso = totalAtletas > 0 ? Math.round((totalValidados / totalAtletas) * 100) : 0
  const presentesA = presencasDecididas.filter((p: any) => p.equipeId === partida?.equipeAId).length
  const presentesB = presencasDecididas.filter((p: any) => p.equipeId === partida?.equipeBId).length
  const partidaEncerrada = String(partida?.status || '').toUpperCase() === 'ENCERRADA'

  async function validateQrToken(value: string, keepScanning = false) {
    if (!value.trim() || validating) return
    setValidating(true)
    setMsg('')
    const res = await fetch(`/api/arbitro/partidas/${token}/validar-qr`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ qrToken: value }),
    })
    const json = await res.json()
    setValidating(false)
    if (!res.ok) {
      setMsg(json.error ?? 'Nao foi possivel validar o QR Code.')
      if (keepScanning) resumeScan()
      return
    }
    setQr('')
    setMsg(`${json.data.jogador.nome} validado com sucesso.`)
    await fetchPartida()
    if (keepScanning) resumeScan()
  }

  async function validarManual(event: React.FormEvent) {
    event.preventDefault()
    await validateQrToken(qr)
  }

  async function startCamera() {
    setScannerOpen(true)
    setScanError('')
    setMsg('')

    if (!navigator.mediaDevices?.getUserMedia) {
      setScanError('Este navegador nao liberou acesso a camera. Use a validacao manual abaixo.')
      return
    }

    if (!('BarcodeDetector' in window)) {
      setScanError('Leitura automatica nao suportada neste navegador. Use Chrome no Android ou a validacao manual abaixo.')
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      })
      streamRef.current = stream
      setCameraOpen(true)

      window.setTimeout(async () => {
        if (!videoRef.current) return
        videoRef.current.srcObject = stream
        await videoRef.current.play()
        scanLoop()
      }, 80)
    } catch {
      setScanError('Nao foi possivel abrir a camera. Verifique a permissao do navegador.')
    }
  }

  function resumeScan() {
    if (!streamRef.current) return
    window.setTimeout(() => {
      scanningRef.current = true
      scanLoop()
    }, 900)
  }

  function stopCamera() {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    rafRef.current = null
    scanningRef.current = false
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
    setCameraOpen(false)
  }

  function closeScanner() {
    stopCamera()
    setScannerOpen(false)
  }

  async function scanLoop() {
    if (!streamRef.current) return
    const Detector = (window as any).BarcodeDetector
    const detector = new Detector({ formats: ['qr_code'] })
    scanningRef.current = true

    const tick = async () => {
      if (!scanningRef.current || !videoRef.current || validating) {
        rafRef.current = requestAnimationFrame(tick)
        return
      }

      try {
        const codes = await detector.detect(videoRef.current)
        const value = codes?.[0]?.rawValue
        if (value) {
          scanningRef.current = false
          setQr(value)
          await validateQrToken(value, true)
          return
        }
      } catch {
        setScanError('Nao foi possivel ler o QR Code nesta camera. Tente aproximar ou use a validacao manual.')
      }

      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)
  }

  async function marcarPresenca(jogadorId: number, presente: boolean) {
    if (savingId != null) return
    setSavingId(jogadorId)
    setMsg('')
    try {
      const res = await fetch(`/api/arbitro/partidas/${token}/presenca`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jogadorId, presente }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setMsg(json.error ?? 'Não foi possível salvar a presença.')
        await fetchPartida()
        return
      }
      setPartida((current: any) => {
        if (!current) return current
        const anterior = (current.presencas ?? []).find((item: any) => item.jogadorId === jogadorId)
        const demais = (current.presencas ?? []).filter((item: any) => item.jogadorId !== jogadorId)
        const numero = json.data?.numero !== undefined ? json.data.numero : anterior?.numero ?? null
        return { ...current, presencas: [...demais, { ...anterior, ...json.data, numero }] }
      })
    } catch {
      setMsg('Falha de conexão. A presença não foi salva.')
      await fetchPartida()
    } finally {
      setSavingId(null)
    }
  }

  function focarBadge(jogadorId: number) {
    requestAnimationFrame(() => badgeRefs.current[jogadorId]?.focus())
  }

  function alterarRascunhoNumero(valor: string) {
    setRascunhoNumero(valor)
    setErroNumero('')
  }

  function abrirNumero(jogador: { id: number; numero?: unknown }) {
    if (partidaEncerrada || salvandoNumeroId != null) return
    const atual = numeroNaPartida(jogador, presencas)
    setEditorNumero(jogador.id)
    setRascunhoNumero(atual == null ? '' : String(atual))
    setErroNumero('')
    setAvisoNumero('')
  }

  function cancelarNumero(jogadorId: number) {
    if (salvandoNumeroId != null) return
    setEditorNumero(null)
    setErroNumero('')
    focarBadge(jogadorId)
  }

  async function salvarNumero(jogadorId: number, numero: number | null | '') {
    if (salvandoNumeroId != null || !partida) return
    if (numero === '') {
      setErroNumero('O número da camisa deve ser um inteiro de 0 a 99.')
      return
    }
    const atletas = [...(partida.equipeA?.jogadores ?? []), ...(partida.equipeB?.jogadores ?? [])]
    if (numero != null) {
      const mensagem = validarTrocaNumeroCamisa({ jogadorId, numero, atletas, presencas })
      if (mensagem) {
        setErroNumero(mensagem)
        return
      }
    }
    setSalvandoNumeroId(jogadorId)
    setErroNumero('')
    try {
      const res = await fetch(`/api/arbitro/partidas/${token}/numero`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jogadorId, numero }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setErroNumero(json.error ?? 'Não foi possível salvar o número.')
        await fetchPartida()
        return
      }
      const nome = atletas.find((item: { id: number }) => item.id === jogadorId)?.nome ?? 'Atleta'
      setPartida((current: any) => {
        if (!current || !json.data?.id) return current
        const anterior = (current.presencas ?? []).find((item: any) => item.jogadorId === jogadorId)
        const demais = (current.presencas ?? []).filter((item: any) => item.jogadorId !== jogadorId)
        return { ...current, presencas: [...demais, { ...anterior, ...json.data }] }
      })
      const texto = numero == null ? `Número de ${nome} voltou ao cadastro.` : `Número de ${nome} atualizado para ${numero}.`
      setAvisoNumero(texto)
      setNumeroSalvoId(jogadorId)
      window.setTimeout(() => setNumeroSalvoId((atual) => (atual === jogadorId ? null : atual)), 2500)
      const elenco = (partida.equipeA?.jogadores ?? []).some((item: { id: number }) => item.id === jogadorId)
        ? partida.equipeA?.jogadores ?? []
        : partida.equipeB?.jogadores ?? []
      const seguinte = numero == null ? null : proximoAtletaNoElenco(elenco, jogadorId)
      if (seguinte) {
        const atual = numeroNaPartida(seguinte, presencas)
        setEditorNumero(seguinte.id)
        setRascunhoNumero(atual == null ? '' : String(atual))
        setErroNumero('')
      } else {
        setEditorNumero(null)
        focarBadge(jogadorId)
      }
    } catch {
      setErroNumero('Falha de conexão. O número não foi salvo.')
    } finally {
      setSalvandoNumeroId(null)
    }
  }

  async function iniciarPartida() {
    if (starting) return
    setStarting(true)
    setMsg('')
    try {
      const res = await fetch(`/api/arbitro/partidas/${token}/iniciar`, { method: 'POST' })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setMsg(json.error ?? 'Não foi possível iniciar a partida.')
        return
      }
      const destino = json.data?.sumulaToken || json.data?.id || partida?.sumulaToken || partida?.id
      if (!destino) {
        setMsg('A partida foi iniciada, mas a súmula não abriu. Use Abrir súmula.')
        setPartida((current: any) => ({ ...current, ...json.data }))
        return
      }
      window.location.assign(`/sumula/${destino}/lancar`)
    } catch {
      setMsg('Falha de conexão. A partida não foi iniciada.')
    } finally {
      setStarting(false)
    }
  }

  if (loading) return <Status title="Carregando operação" text="Buscando partida e equipes." />
  if (!partida) return <Status title="Partida indisponível" text={falha || 'Não foi possível abrir esta partida.'} error onRetry={() => fetchPartida(true)} />

  const janela = partida.janelaValidacao
  const liberada = Boolean(janela?.liberada)

  return (
    <main className="referee-shell min-h-screen text-white">
      <section className="referee-hero border-b">
        <div className="mx-auto max-w-7xl px-4 py-8">
          <p className="referee-kicker text-xs font-black uppercase tracking-[0.22em]">Operacao do arbitro</p>
          <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_auto_1fr] lg:items-center">
            <TeamBox team={partida.equipeA} />
            <div className="referee-score-card rounded-3xl border px-6 py-5 text-center">
              <p className="text-xs font-black uppercase tracking-wide">Rodada {partida.rodada}</p>
              <p className="mt-2 text-4xl font-black">VS</p>
              <p className="mt-2 text-xs font-bold">{partida.dataHora ? new Date(partida.dataHora).toLocaleString('pt-BR') : 'Sem horario definido'}</p>
            </div>
            <TeamBox team={partida.equipeB} align="right" />
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-6 px-4 py-8">
        <div className="referee-card rounded-[2rem] border p-6">
          <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <p className="referee-kicker text-xs font-black uppercase tracking-[0.2em]">Credenciamento pre-partida</p>
              <h1 className="mt-3 text-3xl font-black">Validacao dos atletas por QR Code</h1>
              <p className="mt-3 max-w-2xl text-sm font-semibold leading-7">{janela?.mensagem}</p>
            </div>
            <button disabled={!liberada} onClick={startCamera} className="referee-primary inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-4 text-sm font-black uppercase tracking-wide transition disabled:cursor-not-allowed disabled:opacity-45">
              <QrCode size={18} />
              Validar QR Code
            </button>
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_240px] lg:items-end">
            <div>
              <div className="flex items-center justify-between gap-3 text-sm font-black">
                <span>Progresso de validacao</span>
                <span>{totalValidados}/{totalAtletas} atletas</span>
              </div>
              <div className="mt-3 h-4 overflow-hidden rounded-full bg-white/10 ring-1 ring-white/10">
                <div className="h-full rounded-full bg-gradient-to-r from-luva-amber to-[#f4cf84] transition-all" style={{ width: `${progresso}%` }} />
              </div>
            </div>
            <div className="referee-status is-open inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-xs font-black uppercase tracking-wide">
              {liberada ? <CheckCircle2 size={16} /> : <Timer size={16} />}
              {liberada ? 'Liberada para teste' : 'Bloqueada'}
            </div>
          </div>

          {msg && <p className="referee-message mt-4 rounded-2xl border px-4 py-3 text-sm font-bold">{msg}</p>}
          <p className="sr-only" role="status">{avisoNumero}</p>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <TeamRoster team={partida.equipeA} jogadores={jogadoresA} presencas={presencas} presentes={presentesA} savingId={savingId} salvandoNumeroId={salvandoNumeroId} podeEditarNumero={!partidaEncerrada} editorNumero={editorNumero} rascunhoNumero={rascunhoNumero} erroNumero={erroNumero}   numeroSalvoId={numeroSalvoId} onPresenca={marcarPresenca} onAbrirNumero={abrirNumero} onRascunhoNumero={alterarRascunhoNumero} onSalvarNumero={salvarNumero} onCancelarNumero={cancelarNumero} badgeRef={(jogadorId, elemento) => { badgeRefs.current[jogadorId] = elemento }} />
          <TeamRoster team={partida.equipeB} jogadores={jogadoresB} presencas={presencas} presentes={presentesB} savingId={savingId} salvandoNumeroId={salvandoNumeroId} podeEditarNumero={!partidaEncerrada} editorNumero={editorNumero} rascunhoNumero={rascunhoNumero} erroNumero={erroNumero} numeroSalvoId={numeroSalvoId} onPresenca={marcarPresenca} onAbrirNumero={abrirNumero} onRascunhoNumero={alterarRascunhoNumero} onSalvarNumero={salvarNumero} onCancelarNumero={cancelarNumero} badgeRef={(jogadorId, elemento) => { badgeRefs.current[jogadorId] = elemento }} />
        </div>

        <div className="referee-card rounded-[2rem] border p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <ActionBar onClick={iniciarPartida} loading={starting} loadingLabel="Iniciando" disabled={!liberada || ['ENCERRADA', 'WO', 'CANCELADA'].includes(String(partida.status || '').toUpperCase())} className="referee-primary inline-flex w-full items-center justify-center gap-2 rounded-2xl px-5 py-4 text-sm font-black uppercase tracking-wide transition disabled:cursor-not-allowed disabled:opacity-45">
              <ClipboardCheck size={18} />
              Iniciar partida
            </ActionBar>
            {String(partida.status || '').toUpperCase() === 'EM_ANDAMENTO' ? (
              <Link href={`/sumula/${partida.sumulaToken || partida.id}/lancar`} className="referee-primary inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-4 text-sm font-black uppercase tracking-wide transition">
                Continuar lançamento
                <ArrowRight size={18} />
              </Link>
            ) : null}
            <Link href={`/sumula/${partida.sumulaToken || partida.id}`} className="referee-secondary inline-flex items-center justify-center gap-2 rounded-2xl border px-5 py-4 text-sm font-black uppercase tracking-wide transition">
              Ver súmula
              <ArrowRight size={18} />
            </Link>
          </div>
        </div>
      </section>

      {scannerOpen && (
        <div className="referee-scanner-modal fixed inset-0 z-50 flex items-center justify-center px-4 py-6">
          <div className="absolute inset-0 bg-[#020814]/82 backdrop-blur-xl" onClick={closeScanner} />
          <div className="referee-card relative z-10 grid max-h-[92vh] w-full max-w-3xl gap-4 overflow-y-auto rounded-[2rem] border p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="referee-kicker text-xs font-black uppercase tracking-[0.18em]">Scanner QR Code</p>
                <h2 className="mt-1 text-2xl font-black">Aponte a camera para o QR do atleta</h2>
              </div>
              <button type="button" onClick={closeScanner} className="referee-secondary inline-flex items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-xs font-black uppercase tracking-wide transition">
                <StopCircle size={17} />
                Fechar
              </button>
            </div>

            {!cameraOpen && (
              <button type="button" onClick={startCamera} disabled={validating} className="referee-primary inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-4 text-sm font-black uppercase tracking-wide transition disabled:opacity-45">
                <Camera size={18} />
                Abrir camera
              </button>
            )}

            {cameraOpen && (
              <div className="referee-video-frame overflow-hidden rounded-2xl border">
                <video ref={videoRef} className="h-[360px] w-full object-cover" muted playsInline />
                <div className="referee-scan-frame" />
              </div>
            )}

            {scanError && <p className="rounded-2xl border border-amber-300/24 bg-amber-400/10 px-4 py-3 text-xs font-bold text-amber-100">{scanError}</p>}

            <form onSubmit={validarManual} className="grid gap-3 border-t border-white/10 pt-4">
              <label className="grid gap-2">
                <span className="text-xs font-black uppercase tracking-[0.16em] text-white/80">Validacao manual</span>
                <input
                  value={qr}
                  onChange={(event) => setQr(event.target.value)}
                  disabled={validating}
                  placeholder="Cole o token ou link do QR Code se a camera nao ler"
                  className="referee-input rounded-2xl border px-4 py-4 text-sm font-bold outline-none transition disabled:opacity-45"
                />
              </label>
              <ActionBar disabled={!qr.trim()} loading={validating} loadingLabel="Validando" className="referee-secondary inline-flex w-full items-center justify-center gap-2 rounded-2xl border px-5 py-4 text-sm font-black uppercase tracking-wide transition disabled:cursor-not-allowed disabled:opacity-45">
                <QrCode size={18} />
                Validar manualmente
              </ActionBar>
            </form>
          </div>
        </div>
      )}
    </main>
  )
}

function TeamBox({ team, align = 'left' }: { team: any; align?: 'left' | 'right' }) {
  return (
    <div className={`flex items-center gap-3 ${align === 'right' ? 'lg:flex-row-reverse lg:text-right' : ''}`}>
      <TeamIdentity nome={team.nome} cor={team.corHex} showName={false} />
      <div className="min-w-0">
        <p className="truncate text-2xl font-black text-white">{team.nome}</p>
        <p className="mt-1 text-sm font-semibold text-white/72">{team.jogadores?.length ?? 0} atletas no elenco</p>
      </div>
    </div>
  )
}

function rotuloPresenca(presencas: any[], jogadorId: number) {
  const registro = presencas.find((item) => item.jogadorId === jogadorId)
  if (!presencaFoiDecidida(registro)) return 'Pendente'
  return registro.presente ? 'Confirmado' : 'Ausente'
}

function TeamRoster({
  team,
  jogadores,
  presencas,
  presentes,
  savingId,
  salvandoNumeroId,
  podeEditarNumero,
  editorNumero,
  rascunhoNumero,
  erroNumero,
  numeroSalvoId,
  onPresenca,
  onAbrirNumero,
  onRascunhoNumero,
  onSalvarNumero,
  onCancelarNumero,
  badgeRef,
}: {
  team: any
  jogadores: any[]
  presencas: any[]
  presentes: number
  savingId: number | null
  salvandoNumeroId: number | null
  podeEditarNumero: boolean
  editorNumero: number | null
  rascunhoNumero: string
  erroNumero: string
  numeroSalvoId: number | null
  onPresenca: (jogadorId: number, presente: boolean) => void
  onAbrirNumero: (jogador: { id: number; numero?: unknown }) => void
  onRascunhoNumero: (valor: string) => void
  onSalvarNumero: (jogadorId: number, numero: number | null | '') => void
  onCancelarNumero: (jogadorId: number) => void
  badgeRef: (jogadorId: number, elemento: HTMLButtonElement | null) => void
}) {
  return (
    <div className="referee-card rounded-[2rem] border p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <TeamBox team={team} />
        <span className="referee-status is-open rounded-2xl px-3 py-2 text-xs font-black uppercase tracking-wide">{presentes}/{jogadores.length}</span>
      </div>
      <div className="grid gap-3">
        {jogadores.length === 0 ? (
          <p className="referee-empty rounded-2xl border p-4 text-sm font-bold">Nenhum atleta cadastrado.</p>
        ) : (
          jogadores.map((jogador) => {
            const status = rotuloPresenca(presencas, jogador.id)
            const salvando = savingId === jogador.id
            const editando = editorNumero === jogador.id
            const salvandoNumero = salvandoNumeroId === jogador.id
            const numero = numeroNaPartida(jogador, presencas)
            const textoNumero = numero == null ? '--' : String(numero)
            const registro = presencas.find((item) => item.jogadorId === jogador.id)
            const erroId = `erro-numero-${jogador.id}`
            const campoId = `numero-camisa-${jogador.id}`
            return (
              <div key={jogador.id} className={`referee-player rounded-2xl border p-4 ${status === 'Confirmado' ? 'is-validated' : ''}`}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    {podeEditarNumero ? (
                      <button
                        type="button"
                        ref={(elemento) => badgeRef(jogador.id, elemento)}
                        aria-label={`Alterar número da camisa de ${jogador.nome}, número atual ${textoNumero}`}
                        aria-expanded={editando}
                        aria-controls={editando ? `editor-numero-${jogador.id}` : undefined}
                        disabled={salvando || salvandoNumero}
                        onClick={() => editando ? onCancelarNumero(jogador.id) : onAbrirNumero(jogador)}
                        className={`referee-number inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-black disabled:opacity-45 ${numeroSalvoId === jogador.id ? 'is-saved' : ''}`}
                      >
                        {textoNumero}
                      </button>
                    ) : (
                      <span className="referee-number inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-black" aria-label={`Número ${textoNumero} de ${jogador.nome}`}>
                        {textoNumero}
                      </span>
                    )}
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black">{jogador.nome}</p>
                      <p className="mt-1 text-xs font-bold text-white/65">{jogador.posicao ?? 'Atleta'}</p>
                      {numeroSalvoId === jogador.id && <p className="referee-feedback is-success mt-1 text-xs font-black">Salvo</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-3 py-1.5 text-[11px] font-black uppercase tracking-wide ${status === 'Confirmado' ? 'bg-emerald-400/16 text-emerald-100' : status === 'Ausente' ? 'bg-red-400/16 text-red-100' : 'bg-white/8 text-white/70'}`}>
                      {status === 'Confirmado' ? <CheckCircle2 size={14} /> : status === 'Ausente' ? <X size={14} /> : <UserCheck size={14} />}
                      {salvando ? 'Salvando' : status}
                    </span>
                    <button type="button" aria-label={`Confirmar ${jogador.nome}`} disabled={salvando || salvandoNumero} onClick={() => onPresenca(jogador.id, true)} className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500 text-slate-950 disabled:opacity-45">
                      <CheckCircle2 size={18} />
                    </button>
                    <button type="button" aria-label={`Marcar ${jogador.nome} como ausente`} disabled={salvando || salvandoNumero} onClick={() => onPresenca(jogador.id, false)} className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-red-500 text-white disabled:opacity-45">
                      <X size={18} />
                    </button>
                  </div>
                </div>
                {editando && (
                  <form
                    id={`editor-numero-${jogador.id}`}
                    className="mt-3 grid gap-2 border-t border-white/10 pt-3"
                    onSubmit={(event) => {
                      event.preventDefault()
                      onSalvarNumero(jogador.id, rascunhoNumero.trim() === '' ? '' : Number(rascunhoNumero))
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'Escape') {
                        event.preventDefault()
                        onCancelarNumero(jogador.id)
                      }
                    }}
                  >
                    <label htmlFor={campoId} className="text-xs font-black uppercase tracking-wide">Número da camisa nesta partida</label>
                    <p className="text-xs font-bold text-white/70">Cadastro da equipe: {jogador.numero ?? 'sem número'}. Inteiro de 0 a 99, sem repetir nesta equipe. Enter salva e abre o próximo.</p>
                    <input
                      id={campoId}
                      value={rascunhoNumero}
                      inputMode="numeric"
                      autoComplete="off"
                      enterKeyHint="done"
                      maxLength={2}
                      autoFocus
                      onFocus={(event) => event.currentTarget.select()}
                      aria-invalid={Boolean(erroNumero)}
                      aria-describedby={erroNumero ? erroId : undefined}
                      disabled={salvandoNumero}
                      onChange={(event) => onRascunhoNumero(event.target.value.replace(/\D/g, '').slice(0, 2))}
                      className="referee-input h-11 rounded-xl border px-3 text-base font-bold outline-none"
                    />
                    {erroNumero && <p id={erroId} className="referee-feedback is-error text-sm font-bold" role="alert">{erroNumero}</p>}
                    <div className="grid grid-cols-2 gap-2">
                      <button type="submit" disabled={salvandoNumero} className="referee-primary inline-flex h-11 items-center justify-center rounded-xl px-3 text-sm font-black disabled:opacity-45">
                        {salvandoNumero ? 'Salvando' : 'Salvar'}
                      </button>
                      <button type="button" disabled={salvandoNumero} onClick={() => onCancelarNumero(jogador.id)} className="referee-secondary inline-flex h-11 items-center justify-center rounded-xl border px-3 text-sm font-black disabled:opacity-45">
                        Cancelar
                      </button>
                    </div>
                    {registro?.numero != null && (
                      <button type="button" disabled={salvandoNumero} onClick={() => onSalvarNumero(jogador.id, null)} className="referee-secondary inline-flex h-11 items-center justify-center rounded-xl border px-3 text-sm font-black disabled:opacity-45">
                        Voltar ao número do cadastro
                      </button>
                    )}
                  </form>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

function Status({ title, text, error = false, onRetry }: { title: string; text: string; error?: boolean; onRetry?: () => void }) {
  return (
    <main className="referee-shell flex min-h-screen items-center justify-center px-4 text-white">
      <div className="referee-card max-w-md rounded-[2rem] border p-7 text-center">
        <span className={`mx-auto flex h-16 w-16 items-center justify-center rounded-full ${error ? 'bg-red-500/20 text-red-100' : 'bg-luva-amber text-slate-950'}`}>
          {error ? <ShieldAlert size={28} /> : <ClipboardCheck size={28} />}
        </span>
        <h1 className="mt-5 text-2xl font-black">{title}</h1>
        <p className="mt-2 text-sm font-semibold leading-6 text-slate-200">{text}</p>
        {onRetry ? <button type="button" onClick={onRetry} className="mt-5 rounded-full bg-white px-4 py-2 text-sm font-black text-slate-950">Tentar novamente</button> : null}
      </div>
    </main>
  )
}
