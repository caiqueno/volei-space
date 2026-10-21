import Link from 'next/link'
import { Aviso, botaoPrimario, cartao } from './ui'
import { mensagemSemPermissao } from '@/lib/meu-time-ui/permissoes'
import { descreverStatusInscricao } from '@/lib/meu-time-ui/respostas'
import type { Atleta, InscricaoResumo } from '@/lib/meu-time-ui/tipos'
import { elencoCompletoAtivo } from '@/lib/meu-time-elenco-ui/flag'
import { PedidosTroca } from '@/components/meu-time-elenco/PedidosTroca'
import { StatusInscricao } from '@/components/meu-time-competicoes/StatusInscricao'
import { explorarCompeticoesAtivo } from '@/lib/meu-time-competicoes-ui/regras'
import { CartaoPagamento } from '@/components/pagamento-comprovante/CartaoPagamento'

type PropsInscricoes = {
  inscricoes: InscricaoResumo[]
  hrefInscricao?: string
  /** false para ASSISTENTE e CAPITAO: veem as inscrições, mas não inscrevem. */
  podeInscrever?: boolean
  /** Elenco completo: atletas do time, para o pedido de troca. */
  atletas?: Atleta[]
  /** Elenco completo: quem pode pedir troca (responsável e técnico). */
  podePedirTroca?: boolean
}

export function AbaInscricoes({ inscricoes, hrefInscricao, podeInscrever = true, atletas, podePedirTroca = false }: PropsInscricoes) {
  const elenco = elencoCompletoAtivo()
  const novosStatus = explorarCompeticoesAtivo()
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
          // Com a flag das competições ligada, mostra o caminho completo, a pendência e a conversa.
          const extra = inscricao as InscricaoResumo & { comentario?: string | null; motivoRecusa?: string | null; posicaoEspera?: number | null }
          return (
            <li key={inscricao.id} className={`${cartao} flex flex-col gap-2`}>
              <p className="text-sm text-[var(--vs-muted)]">{inscricao.totalAtletas} {inscricao.totalAtletas === 1 ? 'atleta' : 'atletas'} na inscrição</p>
              {novosStatus ? (
                <StatusInscricao
                  inscricaoId={inscricao.id}
                  inscricao={{ status: inscricao.status, comentario: extra.comentario, motivoRecusa: extra.motivoRecusa, posicaoEspera: extra.posicaoEspera }}
                />
              ) : (
                <>
                  <p className={`vs-state ${classe} font-bold`}>{status.rotulo}</p>
                  <p className="text-sm">{status.explicacao}</p>
                </>
              )}
              {inscricao.status !== 'REMOVIDA' && <CartaoPagamento inscricaoId={inscricao.id} podeEnviar={podeInscrever} />}
              {elenco && atletas && inscricao.status !== 'REMOVIDA' && (
                <PedidosTroca inscricao={inscricao} atletas={atletas} podePedir={podePedirTroca} />
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
