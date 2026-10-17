'use client'

import { useCallback, useEffect, useState } from 'react'
import { Aviso, botaoPerigo, botaoPrimario, botaoSecundario, Campo, campoEstilo, Carregando, cartao, FalhaTela, falhaDe } from '@/components/meu-time/ui'
import type { Falha } from '@/lib/meu-time-ui/respostas'
import { formatarDataHora, linkWhatsApp, podeRevogar, ROTULO_ESTADO } from '@/lib/meu-time-fase2-ui/convites'
import type { ConviteGerado, ConviteResumo } from '@/lib/meu-time-fase2-ui/tipos'
import { obterClienteFase2, type ClienteFase2 } from './cliente'
import { PaginaFase2, SeletorEquipe } from './Comum'

export function ConvitesLider({ cliente }: { cliente?: ClienteFase2 }) {
  const api = cliente ?? obterClienteFase2()
  const [equipeId, setEquipeId] = useState('')
  const [contato, setContato] = useState('')
  const [lista, setLista] = useState<ConviteResumo[] | null>(null)
  const [falha, setFalha] = useState<Falha | null>(null)
  const [gerado, setGerado] = useState<ConviteGerado | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [copiado, setCopiado] = useState(false)
  const [confirmando, setConfirmando] = useState<string | null>(null)

  const carregar = useCallback(async () => {
    if (!equipeId) {
      setLista(null)
      return
    }
    try {
      setFalha(null)
      setLista(await api.listarConvites(equipeId))
    } catch (e) {
      setFalha(falhaDe(e))
    }
  }, [api, equipeId])

  useEffect(() => {
    setGerado(null)
    setCopiado(false)
    void carregar()
  }, [carregar])

  async function gerar() {
    setOcupado(true)
    setFalha(null)
    try {
      setGerado(await api.gerarConvite(equipeId, contato))
      setCopiado(false)
      await carregar()
    } catch (e) {
      setFalha(falhaDe(e))
    } finally {
      setOcupado(false)
    }
  }

  async function copiar() {
    if (!gerado) return
    try {
      await navigator.clipboard.writeText(gerado.url)
      setCopiado(true)
    } catch {
      setCopiado(false)
    }
  }

  async function revogar(id: string) {
    setOcupado(true)
    try {
      await api.revogarConvite(id)
      setConfirmando(null)
      await carregar()
    } catch (e) {
      setFalha(falhaDe(e))
    } finally {
      setOcupado(false)
    }
  }

  return (
    <PaginaFase2 titulo="Convites para atletas">
      <Aviso>Gere um link e mande para o atleta. Ele mesmo preenche os dados, sem precisar de conta.</Aviso>
      <SeletorEquipe id="convite-equipe" valor={equipeId} aoMudar={setEquipeId} />
      {equipeId && (
        <section className={`${cartao} flex flex-col gap-3`} aria-labelledby="novo-convite">
          <h2 id="novo-convite" className="text-xl font-black">Novo convite</h2>
          <Campo id="convite-contato" rotulo="Nome ou telefone do atleta (opcional)" ajuda="Só para você se lembrar de quem é o convite.">
            <input id="convite-contato" className={campoEstilo} value={contato} maxLength={80} onChange={(e) => setContato(e.target.value)} />
          </Campo>
          <button type="button" className={botaoPrimario} disabled={ocupado} onClick={gerar}>
            {ocupado ? 'Gerando…' : 'Gerar link de convite'}
          </button>
        </section>
      )}
      {falha && <FalhaTela falha={falha} aoTentar={carregar} />}
      {gerado && (
        <section className={`${cartao} flex flex-col gap-3`} aria-labelledby="link-pronto">
          <h2 id="link-pronto" className="text-xl font-black">Link pronto</h2>
          <input readOnly aria-label="Link do convite" className={campoEstilo} value={gerado.url} onFocus={(e) => e.currentTarget.select()} />
          <p className="text-sm text-[var(--vs-muted)]">Vale até {formatarDataHora(gerado.expiraEm)}.</p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button type="button" className={botaoSecundario} onClick={copiar}>Copiar link</button>
            <a className={botaoSecundario} href={linkWhatsApp(gerado.url)} target="_blank" rel="noopener noreferrer">Enviar pelo WhatsApp</a>
          </div>
          <p role="status" className="min-h-[1.25rem] text-sm font-bold">{copiado ? 'Link copiado.' : ''}</p>
        </section>
      )}
      {equipeId && !falha && lista === null && <Carregando texto="Carregando convites…" />}
      {lista && lista.length === 0 && <Aviso>Nenhum convite ainda. Gere o primeiro acima.</Aviso>}
      {lista && lista.length > 0 && (
        <section aria-labelledby="enviados">
          <h2 id="enviados" className="mb-2 text-xl font-black">Convites enviados</h2>
          <ul className="flex flex-col gap-3">
            {lista.map((c) => (
              <li key={c.id} className={`${cartao} flex flex-col gap-2`}>
                <span className="font-black">{ROTULO_ESTADO[c.estado]}</span>
                <span className="text-sm text-[var(--vs-muted)]">Criado em {formatarDataHora(c.criadoEm)} · vale até {formatarDataHora(c.expiraEm)}</span>
                {podeRevogar(c.estado) &&
                  (confirmando === c.id ? (
                    <div className="flex flex-col gap-2 sm:flex-row" role="group" aria-label="Confirmar cancelamento">
                      <button type="button" className={botaoPerigo} disabled={ocupado} onClick={() => revogar(c.id)}>Sim, cancelar convite</button>
                      <button type="button" className={botaoSecundario} onClick={() => setConfirmando(null)}>Manter</button>
                    </div>
                  ) : (
                    <button type="button" className={`${botaoPerigo} self-start`} onClick={() => setConfirmando(c.id)}>Cancelar convite</button>
                  ))}
              </li>
            ))}
          </ul>
        </section>
      )}
    </PaginaFase2>
  )
}
