import Link from 'next/link'
import { Aviso, botaoPrimario, cartao } from './ui'
import type { Prontidao } from '@/lib/meu-time-ui/tipos'

type Props = {
  prontidao: Prontidao
  /** Endereço do assistente de inscrição, quando o time chegou por um convite de categoria. */
  hrefInscricao?: string
  aoVerPendencias?: () => void
}

/** "Seu time tem 9 atletas. 2 estão sem documento." com o próximo passo logo abaixo. */
export function CartaoProntidao({ prontidao, hrefInscricao, aoVerPendencias }: Props) {
  const { atletas, semDocumento, mensagem } = prontidao
  const completos = Math.max(0, atletas - semDocumento)
  const percentual = atletas === 0 ? 0 : Math.round((completos / atletas) * 100)
  const pronto = atletas > 0 && semDocumento === 0

  return (
    <section aria-labelledby="prontidao-titulo" className={`${cartao} flex flex-col gap-3`}>
      <h2 id="prontidao-titulo" className="text-lg font-black">{mensagem}</h2>
      {atletas > 0 && (
        <>
          <div
            role="progressbar" aria-label="Atletas com documento" aria-valuemin={0} aria-valuemax={atletas} aria-valuenow={completos}
            aria-valuetext={`${completos} de ${atletas} atletas com documento`}
            className="h-3 w-full overflow-hidden rounded-full bg-[var(--vs-elevated)]"
          >
            <div className="h-full bg-[var(--vs-win)] transition-[width] motion-reduce:transition-none" style={{ width: `${percentual}%` }} />
          </div>
          <p className="text-sm text-[var(--vs-muted)]">{completos} de {atletas} com documento</p>
        </>
      )}
      {atletas === 0 && (
        <Aviso>Cole a lista do grupo do time e a gente separa nome e camisa. Vá na aba Atletas.</Aviso>
      )}
      {semDocumento > 0 && aoVerPendencias && (
        <button type="button" onClick={aoVerPendencias} className="min-h-[44px] self-start text-sm font-bold text-[var(--vs-gold)] underline">
          Ver quem está sem documento
        </button>
      )}
      {pronto && <Aviso tom="is-success">Tudo certo. Seu time está pronto para se inscrever.</Aviso>}
      {hrefInscricao && atletas > 0 && (
        <Link href={hrefInscricao} className={botaoPrimario}>Inscrever na categoria do convite</Link>
      )}
    </section>
  )
}
