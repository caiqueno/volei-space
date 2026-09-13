'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import QRCode from 'qrcode'
import { ArrowLeft, Copy } from 'lucide-react'
import { FormAlert } from '../../ui/FormAlert'
import PageLoading from '@/components/ui/page-loading'
import { formatCents } from '@/lib/pricing'
import type { ChampionshipPricing } from '@/lib/pricing'

interface CheckoutData {
  pricing: ChampionshipPricing
  coupon: { code: string; percent: number; discountCents: number } | null
  totalCents: number
  pixPayload: string
  jaConfirmado: boolean
}

// Fluxo de checkout SIMULADO da ativação do campeonato: resumo -> QR Pix
// fake -> botão "avançar" que marca o pagamento como confirmado. Não há
// gateway/webhook real por trás — ver comentário em api/.../pagamento/route.ts.
export function PagamentoView({ ligaId }: { ligaId: number }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const cupom = searchParams.get('cupom') ?? ''

  const [data, setData] = useState<CheckoutData | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [screen, setScreen] = useState<'checkout' | 'pix'>('checkout')
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch(`/api/organizador/ligas/${ligaId}/pagamento?cupom=${encodeURIComponent(cupom)}`, { cache: 'no-store' })
      .then(async (response) => {
        const payload = await response.json()
        if (!response.ok) throw new Error(payload.error || 'Erro ao carregar o checkout.')
        return payload.data as CheckoutData
      })
      .then((loaded) => {
        if (!cancelled) setData(loaded)
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : 'Erro ao carregar o checkout.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [ligaId, cupom])

  useEffect(() => {
    if (screen !== 'pix' || !data || data.jaConfirmado) return
    let cancelled = false
    QRCode.toDataURL(data.pixPayload, { width: 260, margin: 2, color: { dark: '#0F2C52', light: '#FFFFFF' } }).then((url) => {
      if (!cancelled) setQrDataUrl(url)
    })
    return () => {
      cancelled = true
    }
  }, [screen, data])

  async function handleConfirmar() {
    setConfirming(true)
    try {
      const response = await fetch(`/api/organizador/ligas/${ligaId}/pagamento/confirmar`, { method: 'POST' })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'Erro ao confirmar pagamento.')
      router.push(`/painel/estrutura?ligaId=${ligaId}`)
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Erro ao confirmar pagamento.')
      setConfirming(false)
    }
  }

  function handleCopy() {
    if (!data) return
    navigator.clipboard.writeText(data.pixPayload).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  if (loading) return <PageLoading label="Carregando checkout..." />

  if (loadError || !data) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16">
        <FormAlert variant="error">{loadError ?? 'Campeonato não encontrado.'}</FormAlert>
        <Link
          href={`/painel/parametrizacao/previa?ligaId=${ligaId}`}
          className="public-secondary-action mt-6 inline-flex items-center gap-2 rounded-full px-5 py-3 text-sm font-black"
        >
          <ArrowLeft size={16} /> Voltar à Prévia
        </Link>
      </div>
    )
  }

  if (data.jaConfirmado) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16">
        <FormAlert variant="success">
          <p className="font-black">Pagamento já confirmado para este campeonato.</p>
        </FormAlert>
        <Link
          href={`/painel/estrutura?ligaId=${ligaId}`}
          className="public-primary-action mt-6 inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-black"
        >
          Ir para criação de grupos
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-10">
      <Link
        href={`/painel/parametrizacao/previa?ligaId=${ligaId}`}
        className="inline-flex items-center gap-2 text-sm font-semibold text-slate-300 transition hover:text-[#ffffff]"
      >
        <ArrowLeft size={16} /> Voltar à Prévia
      </Link>

      <p className="luva-kicker mt-5">Parametrização do campeonato</p>
      <h1 className="mt-2 font-display text-2xl font-black text-[#ffffff] md:text-3xl">Pagamento</h1>

      <div className="mt-4">
        <FormAlert variant="info">Ambiente de simulação — nenhuma cobrança real é gerada.</FormAlert>
      </div>

      {screen === 'checkout' && (
        <div className="mt-6 creator-modal-section rounded-2xl border p-5">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">Resumo do pedido</p>
          <div className="mt-4 grid gap-2 border-t border-white/10 pt-4">
            {data.pricing.items.map((item) => (
              <div key={item.key} className="flex items-center justify-between gap-3 text-sm">
                <p className="font-semibold text-slate-300">{item.label}</p>
                <p className="font-bold text-[#ffffff]">{formatCents(item.totalCents)}</p>
              </div>
            ))}
            {data.pricing.discountCents > 0 && (
              <div className="flex items-center justify-between text-sm">
                <p className="font-semibold text-emerald-300">Desconto por volume ({Math.round(data.pricing.discountPercent * 100)}%)</p>
                <p className="font-bold text-emerald-300">-{formatCents(data.pricing.discountCents)}</p>
              </div>
            )}
            {data.coupon && (
              <div className="flex items-center justify-between text-sm">
                <p className="font-semibold text-emerald-300">
                  Cupom {data.coupon.code} ({Math.round(data.coupon.percent * 100)}%)
                </p>
                <p className="font-bold text-emerald-300">-{formatCents(data.coupon.discountCents)}</p>
              </div>
            )}
            <div className="mt-2 flex items-center justify-between border-t border-white/10 pt-3 text-base">
              <strong className="text-[#ffffff]">Total</strong>
              <strong className="text-luva-amber">{formatCents(data.totalCents)}</strong>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setScreen('pix')}
            className="public-primary-action mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-black"
          >
            Gerar QR Code Pix
          </button>
        </div>
      )}

      {screen === 'pix' && (
        <div className="mt-6 creator-modal-section rounded-2xl border p-5">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">Pagamento via Pix (simulado)</p>
          <p className="mt-1 text-2xl font-black text-luva-amber">{formatCents(data.totalCents)}</p>

          <div className="mt-4 flex justify-center">
            {qrDataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={qrDataUrl} alt="QR Code Pix simulado" width={220} height={220} className="rounded-xl" />
            ) : (
              <div className="flex h-[220px] w-[220px] items-center justify-center rounded-xl border border-white/10 text-xs font-bold text-slate-400">
                Gerando QR...
              </div>
            )}
          </div>

          <p className="mt-4 text-xs font-black uppercase tracking-[0.16em] text-slate-400">Pix copia e cola (simulado)</p>
          <div className="mt-2 flex items-center gap-2">
            <input readOnly value={data.pixPayload} className="creator-input w-full truncate rounded-2xl border px-4 py-3 text-xs font-bold" />
            <button
              type="button"
              onClick={handleCopy}
              className="public-secondary-action inline-flex shrink-0 items-center gap-1 rounded-full px-4 py-3 text-xs font-black"
            >
              <Copy size={14} /> {copied ? 'Copiado' : 'Copiar'}
            </button>
          </div>

          <button
            type="button"
            onClick={handleConfirmar}
            disabled={confirming}
            className="public-primary-action mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-black disabled:cursor-not-allowed disabled:opacity-60"
          >
            {confirming ? 'Confirmando...' : 'Já paguei — simular confirmação'}
          </button>
        </div>
      )}
    </div>
  )
}
