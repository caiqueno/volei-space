import Link from 'next/link'
import { botaoPrimario, cartao } from './ui'
import { descreverStatusInscricao } from '@/lib/meu-time-ui/respostas'
import type { InscricaoResumo } from '@/lib/meu-time-ui/tipos'

type PropsInscricoes = {
  inscricoes: InscricaoResumo[]
  hrefInscricao?: string
}

export function AbaInscricoes({ inscricoes, hrefInscricao }: PropsInscricoes) {
  return (
    <div className="flex flex-col gap-4">
      {hrefInscricao && <Link href={hrefInscricao} className={botaoPrimario}>Inscrever na categoria do convite</Link>}
      {inscricoes.length === 0 && (
        <div className={`${cartao} flex flex-col gap-2`}>
          <h3 className="text-lg font-black">Nenhuma inscrição ainda</h3>
          <p className="text-[var(--vs-muted)]">Para inscrever o time, abra o link de convite que o organizador mandou. Ele leva direto ao assistente, com a categoria certa. Não precisa esperar aprovação.</p>
        </div>
      )}
      <ul className="flex flex-col gap-2" aria-label="Inscrições do time">
        {inscricoes.map((inscricao) => {
          const status = descreverStatusInscricao(inscricao.status)
          const classe = status.tom === 'ok' ? 'is-success' : status.tom === 'erro' ? 'is-error' : 'is-warning'
          return (
            <li key={inscricao.id} className={`${cartao} flex flex-col gap-2`}>
              <p className="text-sm text-[var(--vs-muted)]">{inscricao.totalAtletas} {inscricao.totalAtletas === 1 ? 'atleta' : 'atletas'} na inscrição</p>
              <p className={`vs-state ${classe} font-bold`}>{status.rotulo}</p>
              <p className="text-sm">{status.explicacao}</p>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
