'use client'

import { useEffect, useState } from 'react'
import { pagamentoComprovanteAtivo, pagamentoDasRegras, type PagamentoLider } from '@/lib/pagamento-comprovante-ui'
import { PixParaPagar } from './PixParaPagar'
import { cartao } from '@/components/meu-time/ui'

/**
 * Passo "Revisar e enviar": mostra quanto o time vai pagar e para onde, quando a categoria exige.
 * Flag desligada: nada e nenhuma requisição. Sem dados de cobrança nas regras (ou 404/503): não aparece.
 */
export function PagamentoNaRevisao({ categoriaId }: { categoriaId: string }) {
  const ativo = pagamentoComprovanteAtivo()
  const [pagamento, setPagamento] = useState<PagamentoLider | null>(null)

  useEffect(() => {
    if (!ativo) return
    const c = new AbortController()
    fetch(`/api/meu-time/categorias/${encodeURIComponent(categoriaId)}/regras`, { cache: 'no-store', credentials: 'same-origin', signal: c.signal })
      .then(async (r) => (r.ok ? pagamentoDasRegras(await r.json().catch(() => null)) : null))
      .then((p) => setPagamento(p))
      .catch(() => undefined)
    return () => c.abort()
  }, [ativo, categoriaId])

  if (!ativo || !pagamento) return null
  return (
    <section className={`${cartao} flex flex-col gap-3`} aria-label="Pagamento da inscrição">
      <h3 className="text-base font-black">Pagamento desta categoria</h3>
      <p className="text-sm">Depois de enviar a inscrição, faça o Pix abaixo e mande o comprovante pela aba Inscrições do time. O organizador confere antes de aprovar.</p>
      <PixParaPagar valorCentavos={pagamento.valorCentavos} pix={pagamento.pix} />
    </section>
  )
}
