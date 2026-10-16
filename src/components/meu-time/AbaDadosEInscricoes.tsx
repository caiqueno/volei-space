import Link from 'next/link'
import { Aviso, botaoPrimario, cartao } from './ui'
import { NAIPE_ROTULO } from './rotulos'
import { descreverStatusInscricao } from '@/lib/meu-time-ui/respostas'
import type { Equipe, InscricaoResumo } from '@/lib/meu-time-ui/tipos'

export function AbaDados({ equipe }: { equipe: Equipe }) {
  return (
    <div className="flex flex-col gap-4">
      <dl className={`${cartao} grid grid-cols-[auto_1fr] gap-x-4 gap-y-3`}>
        <dt className="text-sm font-bold text-[var(--vs-muted)]">Nome</dt>
        <dd className="font-bold">{equipe.nome}</dd>
        <dt className="text-sm font-bold text-[var(--vs-muted)]">Cidade</dt>
        <dd>{equipe.cidade || 'Não informada'}</dd>
        <dt className="text-sm font-bold text-[var(--vs-muted)]">Naipe</dt>
        <dd>{NAIPE_ROTULO[equipe.naipe]}</dd>
        <dt className="text-sm font-bold text-[var(--vs-muted)]">Escudo</dt>
        <dd>{equipe.escudoUrl ? 'Cadastrado' : 'Ainda sem escudo'}</dd>
      </dl>
      <Aviso>A edição destes dados ainda não está disponível aqui. Se algo estiver errado, avise o organizador do campeonato.</Aviso>
    </div>
  )
}

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
