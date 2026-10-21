'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import {
  falhaEscondeArea, liderPodeEnviarComprovante, liderPodeTrocarComprovante, normalizarPagamentoLider, pagamentoComprovanteAtivo,
  textoEstadoLider, tratarRespostaPagamento, urlPagamentoLider, type PagamentoLider,
} from '@/lib/pagamento-comprovante-ui'
import { PixParaPagar } from './PixParaPagar'
import { EnviarComprovante } from './EnviarComprovante'
import { cartao } from '@/components/meu-time/ui'

const TOM_CLASSE = { ok: 'is-success', atencao: 'is-warning', erro: 'is-error', neutro: '' } as const

type Carga = { fase: 'carregando' } | { fase: 'oculto' } | { fase: 'erro'; mensagem: string } | { fase: 'pronto'; pagamento: PagamentoLider }

/**
 * Cartão "Pagamento" da inscrição, na aba Inscrições do time.
 * Flag desligada: não renderiza nada e não faz requisição. 404/503 ou categoria sem cobrança: some sem barulho.
 * Nunca mostra o caminho do arquivo enviado.
 */
export function CartaoPagamento({ inscricaoId, equipeId, podeEnviar = true }: { inscricaoId: string; equipeId?: string; podeEnviar?: boolean }) {
  const ativo = pagamentoComprovanteAtivo()
  const params = useParams()
  const rota = params?.equipeId
  const equipe = equipeId ?? (typeof rota === 'string' ? rota : '')
  const [carga, setCarga] = useState<Carga>({ fase: 'carregando' })
  const [trocando, setTrocando] = useState(false)

  const carregar = useCallback(async (sinal?: AbortSignal) => {
    try {
      const r = await fetch(urlPagamentoLider(inscricaoId), { cache: 'no-store', credentials: 'same-origin', signal: sinal })
      const corpo = await r.json().catch(() => null)
      const t = tratarRespostaPagamento(r.status, corpo)
      if (!t.ok) {
        setCarga(falhaEscondeArea(t.tipo) ? { fase: 'oculto' } : { fase: 'erro', mensagem: t.mensagem })
        return
      }
      const pagamento = normalizarPagamentoLider(corpo)
      setCarga(pagamento && pagamento.exige ? { fase: 'pronto', pagamento } : { fase: 'oculto' })
    } catch {
      if (!sinal?.aborted) setCarga({ fase: 'erro', mensagem: 'Sem conexão para ver o pagamento. Tente de novo.' })
    }
  }, [inscricaoId])

  useEffect(() => {
    if (!ativo) return
    const c = new AbortController()
    void carregar(c.signal)
    return () => c.abort()
  }, [ativo, carregar])

  if (!ativo || carga.fase === 'oculto') return null
  if (carga.fase === 'carregando') return <div className={`${cartao} h-16 animate-pulse motion-reduce:animate-none`} role="status" aria-label="Carregando o pagamento" />
  if (carga.fase === 'erro') {
    return (
      <div className={`${cartao} flex flex-col gap-2`}>
        <h4 className="text-base font-black">Pagamento</h4>
        <p role="alert" className="text-sm font-bold text-[var(--vs-error-fg)]">{carga.mensagem}</p>
        <button type="button" onClick={() => { setCarga({ fase: 'carregando' }); void carregar() }} className="inline-flex min-h-[44px] items-center self-start text-sm font-bold text-[var(--vs-gold)] underline">Tentar de novo</button>
      </div>
    )
  }

  const p = carga.pagamento
  const texto = textoEstadoLider(p.estado, p.motivoRecusa)
  const precisaPagar = p.estado === 'PENDENTE' || p.estado === 'RECUSADO'
  const mostraEnvio = podeEnviar && equipe !== '' && (liderPodeEnviarComprovante(p) || (liderPodeTrocarComprovante(p) && trocando))

  return (
    <section className={`${cartao} flex flex-col gap-3`} aria-label="Pagamento da inscrição">
      <h4 className="text-base font-black">Pagamento</h4>
      <div className={`vs-state ${TOM_CLASSE[texto.tom]}`} role="status">
        <strong className="block">{texto.rotulo}</strong>
        {texto.explicacao}
      </div>
      {precisaPagar && <PixParaPagar valorCentavos={p.valorCentavos} pix={p.pix} />}
      {!podeEnviar && precisaPagar && <p className="text-sm text-[var(--vs-muted)]">Só quem inscreve o time pode enviar o comprovante.</p>}
      {mostraEnvio && (
        <EnviarComprovante
          id={`comprovante-${inscricaoId}`}
          equipeId={equipe}
          inscricaoId={inscricaoId}
          rotuloBotao={p.estado === 'RECUSADO' || trocando ? 'Enviar outro comprovante' : 'Escolher foto ou PDF'}
          aoEnviado={() => { setTrocando(false); void carregar() }}
        />
      )}
      {podeEnviar && equipe !== '' && liderPodeTrocarComprovante(p) && !trocando && (
        <button type="button" onClick={() => setTrocando(true)} className="inline-flex min-h-[44px] items-center self-start text-sm font-bold text-[var(--vs-gold)] underline">Enviei o arquivo errado, trocar</button>
      )}
    </section>
  )
}
