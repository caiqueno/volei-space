'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { enviarArquivoMeuTime, ErroUpload } from '@/lib/uploads-cliente'
import {
  aceitaDoCampo, ehPdf, formatarTamanho, ocupado, podeTentarDeNovo, proximoEstadoUpload, UPLOAD_OCIOSO, type EstadoUpload,
} from '@/lib/meu-time-elenco-ui/upload'
import { prepararArquivo } from '@/components/meu-time-elenco/imagem'

const botaoPequeno =
  'inline-flex min-h-[44px] items-center justify-center rounded-xl border border-[var(--vs-border-strong)] px-4 text-sm font-bold text-[var(--vs-text)] hover:bg-[var(--vs-elevated)] disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transition-none'

type Props = {
  id: string
  equipeId: string
  inscricaoId: string
  /** Texto do botão principal: "Enviar comprovante" ou "Enviar outro comprovante". */
  rotuloBotao?: string
  aoEnviado: () => void
}

function textoEstado(estado: EstadoUpload): string {
  switch (estado.fase) {
    case 'preparando': return 'Preparando o comprovante…'
    case 'enviando': return 'Enviando o comprovante…'
    case 'enviado': return 'Comprovante enviado. O organizador vai conferir.'
    case 'falhou': return estado.mensagem || 'Não foi possível enviar o comprovante.'
    default: return ''
  }
}

/** Foto ou PDF do comprovante: compressão no navegador, prévia, enviando/enviado/falhou e nova tentativa sem escolher de novo. */
export function EnviarComprovante({ id, equipeId, inscricaoId, rotuloBotao = 'Enviar comprovante', aoEnviado }: Props) {
  const [estado, setEstado] = useState<EstadoUpload>(UPLOAD_OCIOSO)
  const [pronto, setPronto] = useState<File | null>(null)
  const [previa, setPrevia] = useState<string | null>(null)
  const galeriaRef = useRef<HTMLInputElement>(null)
  const cameraRef = useRef<HTMLInputElement>(null)

  useEffect(() => () => { if (previa) URL.revokeObjectURL(previa) }, [previa])

  const enviar = useCallback(async (arquivo: File) => {
    setEstado((e) => proximoEstadoUpload(e, { tipo: 'preparado' }))
    try {
      await enviarArquivoMeuTime({ equipeId, inscricaoId, tipo: 'COMPROVANTE', arquivo })
      setEstado((e) => proximoEstadoUpload(e, { tipo: 'enviou' }))
      setPronto(null)
      aoEnviado()
    } catch (erro) {
      const mensagem = erro instanceof ErroUpload ? erro.message : 'Não foi possível enviar o comprovante. Tente novamente em instantes.'
      setEstado((e) => proximoEstadoUpload(e, { tipo: 'falhou', mensagem }))
    }
  }, [equipeId, inscricaoId, aoEnviado])

  async function aoEscolher(arquivo: File | undefined) {
    if (!arquivo) return
    setEstado((e) => proximoEstadoUpload(e, { tipo: 'escolheu' }))
    try {
      const preparado = await prepararArquivo('DOCUMENTO', arquivo, `comprovante-${inscricaoId}`)
      setPrevia(preparado.previaUrl)
      setPronto(preparado.arquivo)
      await enviar(preparado.arquivo)
    } catch (erro) {
      setEstado((e) => proximoEstadoUpload(e, { tipo: 'falhou', mensagem: erro instanceof Error ? erro.message : 'Não foi possível preparar o arquivo.' }))
    }
  }

  const trabalhando = ocupado(estado)
  const texto = textoEstado(estado)

  return (
    <fieldset className="flex flex-col gap-3 rounded-2xl border border-[var(--vs-border)] bg-[var(--vs-bg)] p-4">
      <legend className="px-1 text-sm font-bold">Enviar comprovante</legend>
      <p className="text-sm text-[var(--vs-muted)]">Tire uma foto do comprovante do Pix ou escolha um arquivo (JPG, PNG, WebP ou PDF).</p>

      {pronto && (
        <div className="flex items-center gap-3">
          {previa ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={previa} alt="Prévia do comprovante" className="h-20 w-20 shrink-0 rounded-xl border border-[var(--vs-border)] object-cover" />
          ) : (
            <div aria-hidden="true" className="flex h-20 w-20 shrink-0 items-center justify-center rounded-xl border border-dashed border-[var(--vs-border-strong)] text-xs text-[var(--vs-muted)]">
              {ehPdf(pronto) ? 'PDF' : 'Arquivo'}
            </div>
          )}
          <p className="min-w-0 truncate text-sm text-[var(--vs-muted)]">{pronto.name} ({formatarTamanho(pronto.size)})</p>
        </div>
      )}

      <p role="status" aria-live="polite" className={`text-sm font-bold ${estado.fase === 'falhou' ? 'text-[var(--vs-error-fg)]' : estado.fase === 'enviado' ? 'text-[var(--vs-win)]' : 'text-[var(--vs-muted)]'}`}>
        {texto}
      </p>

      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={trabalhando} onClick={() => cameraRef.current?.click()} className={botaoPequeno}>Fotografar comprovante</button>
        <button type="button" disabled={trabalhando} onClick={() => galeriaRef.current?.click()} className={botaoPequeno}>{rotuloBotao}</button>
        {podeTentarDeNovo(estado) && pronto && (
          <button type="button" onClick={() => void enviar(pronto)} className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-[var(--vs-gold)] px-4 text-sm font-black text-[var(--vs-on-gold)]">Tentar de novo</button>
        )}
      </div>

      <input
        ref={galeriaRef} id={`${id}-galeria`} type="file" accept={aceitaDoCampo('DOCUMENTO')} className="sr-only" tabIndex={-1} aria-label="Escolher o arquivo do comprovante"
        onChange={(e) => { const a = e.target.files?.[0]; e.target.value = ''; void aoEscolher(a) }}
      />
      <input
        ref={cameraRef} id={`${id}-camera`} type="file" accept="image/*" capture="environment" className="sr-only" tabIndex={-1} aria-label="Abrir a câmera para o comprovante"
        onChange={(e) => { const a = e.target.files?.[0]; e.target.value = ''; void aoEscolher(a) }}
      />
    </fieldset>
  )
}
