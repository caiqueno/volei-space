import Link from 'next/link'
import { Aviso, botaoPrimario, cartao } from './ui'
import { mensagemSemPermissao } from '@/lib/meu-time-ui/permissoes'
import { descreverStatusInscricao } from '@/lib/meu-time-ui/respostas'
import type { InscricaoResumo } from '@/lib/meu-time-ui/tipos'

type PropsInscricoes = {
  inscricoes: InscricaoResumo[]
  hrefInscricao?: string
  /** false para ASSISTENTE e CAPITAO: veem as inscrições, mas não inscrevem. */
  podeInscrever?: boolean
}

export function AbaInscricoes({ inscricoes, hrefInscricao, podeInscrever = true }: PropsInscricoes) {
  return (
    <div className="flex flex-col gap-4">
      {!podeInscrever && <Aviso>{mensagemSemPermissao('inscricao')} Você pode acompanhar as inscrições, mas não enviar.</Aviso>}
      {hrefInscricao && <Link href={hrefInscricao} className={botaoPrimario}>Inscrever na categoria do convite</Link>}
      {inscricoes.length === 0 && (
        <div className={`${cartao} flex flex-col gap-2`}>
          <h3 className="text-lg font-black">Nenhuma inscrição ainda</h3>
          {podeInscrever && <p className="text-[var(--vs-muted)]">Para inscrever o time, abra o link de convite que o organizador mandou. Ele leva direto ao assistente, com a categoria certa. Não precisa esperar aprovação.</p>}
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
