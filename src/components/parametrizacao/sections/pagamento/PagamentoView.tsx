'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { ActionBar } from '@/components/ui/action-bar'
import { FormAlert } from '../../ui/FormAlert'
import PageLoading from '@/components/ui/page-loading'
import { formatCents, linhasDoCheckout } from '@/lib/pricing'
import { PixComComprovante } from '@/components/pagamento-comprovante/PixComComprovante'

interface CheckoutData {
  pagamentoHabilitado?: boolean
  destino?: string
  pricing?: Parameters<typeof linhasDoCheckout>[0] & {
    discountCents?: number | null
    discountPercent?: number | null
  }
  coupon?: { code: string; percent: number; discountCents: number } | null
  totalCents?: number | null
  pixPayload?: string | null
  jaConfirmado?: boolean
}

export function PagamentoView({ ligaId }: { ligaId: number }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const cupom = searchParams.get('cupom') ?? ''

  const [data, setData] = useState<CheckoutData | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [redirecting, setRedirecting] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch(`/api/organizador/ligas/${ligaId}/pagamento?cupom=${encodeURIComponent(cupom)}`, { cache: 'no-store' })
      .then(async (response) => {
        const payload = await response.json()
        if (!response.ok) throw new Error(payload.error || 'Erro ao carregar o checkout.')
        return payload.data as CheckoutData
      })
      .then((loaded) => {
        if (cancelled) return
        if (loaded.pagamentoHabilitado === false) {
          setRedirecting(true)
          router.replace(loaded.destino || `/painel/estrutura?ligaId=${ligaId}`)
          return
        }
        setData(loaded)
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
  }, [ligaId, cupom, router])

  async function handleConfirmar() {
    setConfirming(true)
    try {
      const response = await fetch(`/api/organizador/ligas/${ligaId}/pagamento/confirmar`, { method: 'POST' })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'Não foi possível continuar a configuração.')
      router.push(`/painel/estrutura?ligaId=${ligaId}`)
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Não foi possível continuar a configuração.')
      setConfirming(false)
    }
  }

  if (loading || redirecting) return <PageLoading label={redirecting ? 'Abrindo a estrutura do campeonato...' : 'Carregando...'} />

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
          <p className="font-black">A configuração deste campeonato já foi liberada.</p>
        </FormAlert>
        <Link
          href={`/painel/estrutura?ligaId=${ligaId}`}
          className="public-primary-action mt-6 inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-black"
        >
          Ir para criação de grupos
        </Link>
        <PixComComprovante ligaId={ligaId} />
      </div>
    )
  }

  const linhas = linhasDoCheckout(data.pricing)
  const descontoCents = Number(data.pricing?.discountCents ?? 0)
  const descontoPercent = Number(data.pricing?.discountPercent ?? 0)
  const totalCents = Number(data.totalCents ?? 0)

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
        <FormAlert variant="info">A cobrança por Pix ainda não está ligada. A configuração segue sem registrar um pagamento.</FormAlert>
      </div>

      <div className="mt-6 creator-modal-section rounded-2xl border p-5">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">Resumo do pedido</p>
          <div className="mt-4 grid gap-2 border-t border-white/10 pt-4">
            {linhas.map((item) => (
              <div key={item.id} className="flex items-center justify-between gap-3 text-sm">
                <p className="font-semibold text-slate-300">{item.label}</p>
                <p className="font-bold text-[#ffffff]">{formatCents(item.totalCents)}</p>
              </div>
            ))}
            {descontoCents > 0 && (
              <div className="flex items-center justify-between text-sm">
                <p className="font-semibold text-emerald-300">Desconto por volume ({Math.round(descontoPercent * 100)}%)</p>
                <p className="font-bold text-emerald-300">-{formatCents(descontoCents)}</p>
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
              <strong className="text-luva-amber">{formatCents(totalCents)}</strong>
            </div>
          </div>
          <ActionBar
            type="button"
            onClick={handleConfirmar}
            loading={confirming}
            loadingLabel="Continuando"
            className="public-primary-action mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-black disabled:cursor-not-allowed disabled:opacity-60"
          >
            Continuar sem cobrança
          </ActionBar>
        </div>

      <PixComComprovante ligaId={ligaId} />
    </div>
  )
}
