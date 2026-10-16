'use client'

import { useSearchParams } from 'next/navigation'
import { useRef, useState, type KeyboardEvent } from 'react'
import { obterClientePadrao, type MeuTimeClient } from './cliente'
import { AbaAtletas } from './AbaAtletas'
import { AbaComissao } from './AbaComissao'
import { AbaDados } from './AbaDados'
import { AbaInscricoes } from './AbaDadosEInscricoes'
import { CartaoProntidao } from './CartaoProntidao'
import { Aviso, Carregando, FalhaTela, Pagina, useCarregar } from './ui'
import { NAIPE_ROTULO } from './rotulos'
import { hrefInscricao } from '@/lib/meu-time-ui/navegacao'
import { podeFazer } from '@/lib/meu-time-ui/permissoes'

const ABAS = [
  { id: 'atletas', rotulo: 'Atletas' },
  { id: 'comissao', rotulo: 'Comissão técnica' },
  { id: 'dados', rotulo: 'Dados do time' },
  { id: 'inscricoes', rotulo: 'Inscrições' },
] as const
type IdAba = (typeof ABAS)[number]['id']

export function DetalheTime({ equipeId, cliente }: { equipeId: string; cliente?: MeuTimeClient }) {
  const api = cliente ?? obterClientePadrao()
  const params = useSearchParams()
  const { carga, recarregar, tentarDeNovo } = useCarregar(() => api.obterEquipe(equipeId))
  const [aba, setAba] = useState<IdAba>('atletas')
  const [semDocumento, setSemDocumento] = useState(false)
  const botoes = useRef<Array<HTMLButtonElement | null>>([])

  function teclado(evento: KeyboardEvent, indice: number) {
    const total = ABAS.length
    const destino = evento.key === 'ArrowRight' ? (indice + 1) % total : evento.key === 'ArrowLeft' ? (indice - 1 + total) % total : evento.key === 'Home' ? 0 : evento.key === 'End' ? total - 1 : null
    if (destino === null) return
    evento.preventDefault()
    setAba(ABAS[destino].id)
    botoes.current[destino]?.focus()
  }

  if (carga.estado === 'carregando') return <Pagina titulo="Meu time" voltar={{ href: '/meu-time', texto: 'Voltar para meus times' }}><Carregando texto="Carregando o time…" /></Pagina>
  if (carga.estado === 'falha') return <Pagina titulo="Meu time" voltar={{ href: '/meu-time', texto: 'Voltar para meus times' }}><FalhaTela falha={carga.falha} aoTentar={tentarDeNovo} /></Pagina>

  const { equipe, atletas, comissao, inscricoes, prontidao, meuPapel } = carga.dados
  const podeInscrever = podeFazer(meuPapel, 'inscricao')
  // Quem não pode inscrever não vê o atalho do convite (o servidor recusaria com 403).
  const hrefAssistente = podeInscrever ? hrefInscricao(equipeId, (chave) => params.get(chave)) : undefined
  const atualizar = async () => { await recarregar() }

  return (
    <Pagina titulo={equipe.nome} voltar={{ href: '/meu-time', texto: 'Voltar para meus times' }}>
      <p className="-mt-3 text-[var(--vs-muted)]">{[equipe.cidade, NAIPE_ROTULO[equipe.naipe]].filter(Boolean).join(' · ')}</p>
      {params.get('novo') === '1' && <Aviso tom="is-success">Time criado. Agora vamos colocar os atletas.</Aviso>}
      <CartaoProntidao
        prontidao={prontidao}
        hrefInscricao={hrefAssistente}
        aoVerPendencias={() => { setAba('atletas'); setSemDocumento(true) }}
      />

      <div role="tablist" aria-label="Seções do time" className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1">
        {ABAS.map((item, indice) => (
          <button
            key={item.id} ref={(el) => { botoes.current[indice] = el }} type="button" role="tab" id={`aba-${item.id}`}
            aria-selected={aba === item.id} aria-controls={`painel-${item.id}`} tabIndex={aba === item.id ? 0 : -1}
            onClick={() => setAba(item.id)} onKeyDown={(e) => teclado(e, indice)}
            className={`min-h-[48px] shrink-0 rounded-xl border px-4 text-sm font-bold ${aba === item.id ? 'border-[var(--vs-gold)] bg-[var(--vs-elevated)] text-[var(--vs-gold)]' : 'border-[var(--vs-border)] text-[var(--vs-text)]'}`}
          >
            {item.rotulo}
          </button>
        ))}
      </div>

      <div role="tabpanel" id={`painel-${aba}`} aria-labelledby={`aba-${aba}`} tabIndex={0} className="outline-offset-4">
        {aba === 'atletas' && (
          <AbaAtletas cliente={api} equipeId={equipeId} atletas={atletas} somenteSemDocumento={semDocumento} aoMudarFiltro={setSemDocumento} meuPapel={meuPapel} aoAtualizar={atualizar} />
        )}
        {aba === 'comissao' && <AbaComissao cliente={api} equipeId={equipeId} comissao={comissao} meuPapel={meuPapel} aoAtualizar={atualizar} />}
        {aba === 'dados' && <AbaDados cliente={api} equipe={equipe} meuPapel={meuPapel} aoAtualizar={atualizar} />}
        {aba === 'inscricoes' && <AbaInscricoes inscricoes={inscricoes} hrefInscricao={hrefAssistente} podeInscrever={podeInscrever} />}
      </div>
    </Pagina>
  )
}
