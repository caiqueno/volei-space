'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { enviarArquivoMeuTime, ErroUpload, obterUrlDocumentoAtleta } from '@/lib/uploads-cliente'
import {
  aceitaDoCampo,
  ehPdf,
  formatarTamanho,
  ocupado,
  podeTentarDeNovo,
  precisaRecorte,
  proximoEstadoUpload,
  ROTULO_UPLOAD,
  textoEstadoUpload,
  UPLOAD_OCIOSO,
  type EstadoUpload,
  type TipoUploadElenco,
} from '@/lib/meu-time-elenco-ui/upload'
import { lerDimensoes, prepararArquivo, recortarQuadrado } from './imagem'
import { botaoSecundario } from '@/components/meu-time/ui'

type Props = {
  id: string
  tipo: TipoUploadElenco
  rotulo: string
  /** Aviso curto de privacidade, em linguagem simples. */
  privacidade?: string
  equipeId: string
  /** Foto e documento exigem o atleta já salvo. Sem ele, o arquivo fica guardado até o atleta ser salvo. */
  atletaId?: string
  /** Já existe arquivo salvo no servidor. */
  jaTem?: boolean
  /** Arquivo escolhido antes de o atleta existir; é enviado sozinho assim que houver `atletaId`. */
  arquivoInicial?: File | null
  /** Só no modo sem atleta: avisa o pai do arquivo pronto (ou null quando a pessoa tira). */
  aoPreparar?: (arquivo: File | null) => void
  aoEnviado?: () => void
  desabilitado?: boolean
}

type Recorte = { arquivo: File; largura: number; altura: number; posicao: number; url: string }

const botaoPequeno = 'inline-flex min-h-[44px] items-center justify-center rounded-xl border border-[var(--vs-border-strong)] px-4 text-sm font-bold text-[var(--vs-text)] hover:bg-[var(--vs-elevated)] disabled:cursor-not-allowed disabled:opacity-60'

/**
 * Escolha, preparo (compressão no navegador), prévia e envio de um arquivo do Meu Time.
 * Estados: preparando, enviando, enviado e falhou (com nova tentativa que não pede o arquivo de novo).
 */
export function UploadArquivo({ id, tipo, rotulo, privacidade, equipeId, atletaId, jaTem = false, arquivoInicial, aoPreparar, aoEnviado, desabilitado }: Props) {
  const [estado, setEstado] = useState<EstadoUpload>(UPLOAD_OCIOSO)
  const [pronto, setPronto] = useState<File | null>(null)
  const [previa, setPrevia] = useState<string | null>(null)
  const [tem, setTem] = useState(jaTem)
  const [recorte, setRecorte] = useState<Recorte | null>(null)
  const [abrindo, setAbrindo] = useState(false)
  const [erroAbrir, setErroAbrir] = useState<string | null>(null)
  const galeriaRef = useRef<HTMLInputElement>(null)
  const cameraRef = useRef<HTMLInputElement>(null)
  const iniciou = useRef(false)
  const nomeTipo = ROTULO_UPLOAD[tipo]
  const podeEnviar = tipo === 'ESCUDO' || Boolean(atletaId)
  const usaCamera = tipo !== 'ESCUDO'

  useEffect(() => () => { if (previa) URL.revokeObjectURL(previa) }, [previa])
  useEffect(() => () => { if (recorte) URL.revokeObjectURL(recorte.url) }, [recorte])

  const enviar = useCallback(async (arquivo: File) => {
    setEstado((e) => proximoEstadoUpload(e, { tipo: 'preparado' }))
    try {
      await enviarArquivoMeuTime({ equipeId, atletaId, tipo, arquivo })
      setEstado((e) => proximoEstadoUpload(e, { tipo: 'enviou' }))
      setTem(true)
      setPronto(null)
      aoEnviado?.()
    } catch (erro) {
      const mensagem = erro instanceof ErroUpload ? erro.message : 'Não foi possível enviar o arquivo. Tente novamente em instantes.'
      setEstado((e) => proximoEstadoUpload(e, { tipo: 'falhou', mensagem }))
    }
  }, [equipeId, atletaId, tipo, aoEnviado])

  const processar = useCallback(async (arquivo: File) => {
    setEstado((e) => proximoEstadoUpload(e, { tipo: 'escolheu' }))
    try {
      const preparado = await prepararArquivo(tipo, arquivo, `${nomeTipo}-${atletaId ?? equipeId}`)
      setPrevia(preparado.previaUrl)
      setPronto(preparado.arquivo)
      if (!podeEnviar) {
        // Atleta ainda não existe: guarda e avisa o pai. O envio acontece depois de salvar.
        aoPreparar?.(preparado.arquivo)
        setEstado(UPLOAD_OCIOSO)
        return
      }
      await enviar(preparado.arquivo)
    } catch (erro) {
      setEstado((e) => proximoEstadoUpload(e, { tipo: 'falhou', mensagem: erro instanceof Error ? erro.message : 'Não foi possível preparar o arquivo.' }))
    }
  }, [tipo, nomeTipo, atletaId, equipeId, podeEnviar, aoPreparar, enviar])

  // Arquivo escolhido antes de salvar o atleta: envia sozinho quando o atleta passa a existir.
  useEffect(() => {
    if (arquivoInicial && atletaId && !iniciou.current) {
      iniciou.current = true
      setPronto(arquivoInicial)
      setPrevia(ehPdf(arquivoInicial) ? null : URL.createObjectURL(arquivoInicial))
      void enviar(arquivoInicial)
    }
  }, [arquivoInicial, atletaId, enviar])

  async function aoEscolher(arquivo: File | undefined) {
    if (!arquivo) return
    setErroAbrir(null)
    if (tipo === 'ESCUDO' && !ehPdf(arquivo)) {
      try {
        const { largura, altura } = await lerDimensoes(arquivo)
        if (precisaRecorte(largura, altura)) {
          setRecorte({ arquivo, largura, altura, posicao: 0.5, url: URL.createObjectURL(arquivo) })
          return
        }
      } catch (erro) {
        setEstado({ fase: 'falhou', mensagem: erro instanceof Error ? erro.message : 'Não foi possível ler a imagem.' })
        return
      }
    }
    await processar(arquivo)
  }

  async function confirmarRecorte() {
    if (!recorte) return
    const { arquivo, posicao } = recorte
    setRecorte(null)
    setEstado((e) => proximoEstadoUpload(e, { tipo: 'escolheu' }))
    try {
      await processar(await recortarQuadrado(arquivo, posicao))
    } catch (erro) {
      setEstado({ fase: 'falhou', mensagem: erro instanceof Error ? erro.message : 'Não foi possível recortar a imagem.' })
    }
  }

  function tirarEscolha() {
    setPronto(null)
    setPrevia(null)
    setEstado(UPLOAD_OCIOSO)
    aoPreparar?.(null)
  }

  async function verDocumento() {
    if (!atletaId || abrindo) return
    setAbrindo(true)
    setErroAbrir(null)
    try {
      const url = await obterUrlDocumentoAtleta(atletaId)
      window.open(url, '_blank', 'noopener,noreferrer')
    } catch (erro) {
      setErroAbrir(erro instanceof ErroUpload ? erro.message : 'Não foi possível abrir o documento agora.')
    } finally {
      setAbrindo(false)
    }
  }

  const trabalhando = ocupado(estado)
  const texto = textoEstadoUpload(estado, nomeTipo)
  const guardado = !podeEnviar && pronto
  const rotuloEscolher = tem || pronto ? `Trocar ${nomeTipo}` : tipo === 'DOCUMENTO' ? 'Escolher foto ou PDF' : 'Escolher da galeria'

  return (
    <fieldset className="flex flex-col gap-3 rounded-2xl border border-[var(--vs-border)] bg-[var(--vs-surface)] p-4" disabled={desabilitado}>
      <legend className="px-1 text-sm font-bold">{rotulo}</legend>
      <div className="flex items-center gap-3">
        {previa ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={previa} alt={`Prévia: ${nomeTipo}`} className={`h-20 w-20 shrink-0 border border-[var(--vs-border)] object-cover ${tipo === 'FOTO_ROSTO' ? 'rounded-full' : 'rounded-xl'}`} />
        ) : (
          <div aria-hidden="true" className={`flex h-20 w-20 shrink-0 items-center justify-center border border-dashed border-[var(--vs-border-strong)] text-xs text-[var(--vs-muted)] ${tipo === 'FOTO_ROSTO' ? 'rounded-full' : 'rounded-xl'}`}>
            {pronto && ehPdf(pronto) ? 'PDF' : tem ? 'Salvo' : 'Vazio'}
          </div>
        )}
        <div className="min-w-0 text-sm">
          {tem && !pronto && <p className="font-bold text-[var(--vs-win)]">Já enviado.</p>}
          {pronto && <p className="truncate text-[var(--vs-muted)]">{pronto.name} ({formatarTamanho(pronto.size)})</p>}
          {guardado && <p className="font-bold">Pronto. Será enviado quando você salvar.</p>}
          {!tem && !pronto && <p className="text-[var(--vs-muted)]">Nada enviado ainda.</p>}
        </div>
      </div>

      <p role="status" aria-live="polite" className={`text-sm font-bold ${estado.fase === 'falhou' ? 'text-[var(--vs-error-fg)]' : estado.fase === 'enviado' ? 'text-[var(--vs-win)]' : 'text-[var(--vs-muted)]'}`}>
        {texto}
      </p>

      {recorte ? (
        <div className="flex flex-col gap-3" role="group" aria-label="Recortar o escudo em quadrado">
          <p className="text-sm text-[var(--vs-muted)]">O escudo é quadrado. Deslize para escolher a parte que fica.</p>
          <div className="relative h-40 w-40 overflow-hidden rounded-xl border border-[var(--vs-border-strong)] bg-[var(--vs-bg)]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={recorte.url} alt="Prévia do recorte" className="h-full w-full object-cover" style={{ objectPosition: recorte.largura >= recorte.altura ? `${recorte.posicao * 100}% 50%` : `50% ${recorte.posicao * 100}%` }} />
          </div>
          <label className="flex flex-col gap-1 text-sm font-bold">
            Enquadramento
            <input type="range" min={0} max={100} value={Math.round(recorte.posicao * 100)} onChange={(e) => setRecorte({ ...recorte, posicao: Number(e.target.value) / 100 })} className="min-h-[44px] w-full accent-[var(--vs-gold)]" />
          </label>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={confirmarRecorte} className={botaoSecundario}>Usar este recorte</button>
            <button type="button" onClick={() => setRecorte(null)} className={botaoPequeno}>Cancelar</button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {usaCamera && (
            <button type="button" disabled={trabalhando} onClick={() => cameraRef.current?.click()} className={botaoPequeno}>
              {tipo === 'FOTO_ROSTO' ? 'Tirar foto agora' : 'Fotografar documento'}
            </button>
          )}
          <button type="button" disabled={trabalhando} onClick={() => galeriaRef.current?.click()} className={botaoPequeno}>{rotuloEscolher}</button>
          {podeTentarDeNovo(estado) && pronto && podeEnviar && (
            <button type="button" onClick={() => void enviar(pronto)} className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-[var(--vs-gold)] px-4 text-sm font-black text-[var(--vs-on-gold)]">Tentar de novo</button>
          )}
          {pronto && !podeEnviar && (
            <button type="button" onClick={tirarEscolha} className={botaoPequeno}>Tirar esta</button>
          )}
          {tipo === 'DOCUMENTO' && tem && atletaId && (
            <button type="button" disabled={abrindo} onClick={() => void verDocumento()} className={botaoPequeno}>{abrindo ? 'Abrindo…' : 'Ver documento enviado'}</button>
          )}
        </div>
      )}
      {erroAbrir && <p role="alert" className="text-sm font-bold text-[var(--vs-error-fg)]">{erroAbrir}</p>}

      <input
        ref={galeriaRef} id={`${id}-galeria`} type="file" accept={aceitaDoCampo(tipo)} className="sr-only" tabIndex={-1} aria-label={`Escolher arquivo: ${rotulo}`}
        onChange={(e) => { const a = e.target.files?.[0]; e.target.value = ''; void aoEscolher(a) }}
      />
      {usaCamera && (
        <input
          ref={cameraRef} id={`${id}-camera`} type="file" accept="image/*" capture={tipo === 'FOTO_ROSTO' ? 'user' : 'environment'} className="sr-only" tabIndex={-1} aria-label={`Abrir a câmera: ${rotulo}`}
          onChange={(e) => { const a = e.target.files?.[0]; e.target.value = ''; void aoEscolher(a) }}
        />
      )}
      {privacidade && <p className="text-xs text-[var(--vs-muted)]">{privacidade}</p>}
    </fieldset>
  )
}
