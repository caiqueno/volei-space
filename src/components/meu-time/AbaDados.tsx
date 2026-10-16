'use client'

import { useRef, useState, type FormEvent } from 'react'
import type { MeuTimeClient } from './cliente'
import { AcessoEquipe } from './AcessoEquipe'
import { Aviso, botaoPrimario, botaoSecundario, Campo, campoEstilo, cartao, descreve, falhaDe } from './ui'
import { NAIPE_ROTULO } from './rotulos'
import { validarEdicaoTime } from '@/lib/meu-time-ui/formularios'
import type { Equipe, PapelAcesso } from '@/lib/meu-time-ui/tipos'

type Props = {
  cliente: MeuTimeClient
  equipe: Equipe
  meuPapel?: PapelAcesso
  aoAtualizar: () => Promise<void>
}

/** Dados do time (editáveis) e "Quem tem acesso". O naipe não muda depois de criado. */
export function AbaDados({ cliente, equipe, meuPapel, aoAtualizar }: Props) {
  const [editando, setEditando] = useState(false)
  const [nome, setNome] = useState(equipe.nome)
  const [cidade, setCidade] = useState(equipe.cidade ?? '')
  const [escudo, setEscudo] = useState(equipe.escudoUrl ?? '')
  const [erros, setErros] = useState<Partial<Record<'nome' | 'escudoUrl', string>>>({})
  const [mensagem, setMensagem] = useState<string | null>(null)
  const [salvo, setSalvo] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const nomeRef = useRef<HTMLInputElement>(null)
  const escudoRef = useRef<HTMLInputElement>(null)

  function abrir() {
    setNome(equipe.nome)
    setCidade(equipe.cidade ?? '')
    setEscudo(equipe.escudoUrl ?? '')
    setErros({})
    setMensagem(null)
    setSalvo(false)
    setEditando(true)
  }

  async function enviar(evento: FormEvent) {
    evento.preventDefault()
    if (salvando) return
    const resultado = validarEdicaoTime({ nome, cidade, escudoUrl: escudo })
    setErros(resultado.erros)
    setMensagem(null)
    if (!resultado.valido) {
      ;(resultado.erros.nome ? nomeRef : escudoRef).current?.focus()
      return
    }
    setSalvando(true)
    try {
      await cliente.atualizarEquipe(equipe.id, resultado.dados)
      await aoAtualizar()
      setEditando(false)
      setSalvo(true)
    } catch (erro) {
      setMensagem(falhaDe(erro).mensagem)
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {salvo && !editando && <Aviso tom="is-success">Dados do time salvos.</Aviso>}
      {!editando && (
        <div className="flex flex-col gap-3">
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
          <button type="button" onClick={abrir} className={botaoSecundario}>Editar dados do time</button>
        </div>
      )}
      {editando && (
        <form onSubmit={enviar} noValidate aria-label="Editar dados do time" className="flex flex-col gap-4 rounded-2xl border border-[var(--vs-border-strong)] bg-[var(--vs-elevated)] p-4">
          <h3 className="text-lg font-black">Editar dados do time</h3>
          {mensagem && <Aviso tom="is-error" alerta>{mensagem}</Aviso>}
          <Campo id="time-nome" rotulo="Nome do time" erro={erros.nome}>
            <input ref={nomeRef} id="time-nome" value={nome} onChange={(e) => setNome(e.target.value)} maxLength={200} autoComplete="off" className={campoEstilo} {...descreve('time-nome', undefined, erros.nome)} />
          </Campo>
          <Campo id="time-cidade" rotulo="Cidade (opcional)">
            <input id="time-cidade" value={cidade} onChange={(e) => setCidade(e.target.value)} maxLength={120} autoComplete="off" className={campoEstilo} />
          </Campo>
          <Campo id="time-escudo" rotulo="Endereço do escudo (opcional)" ajuda="Um link https:// com a imagem do escudo." erro={erros.escudoUrl}>
            <input ref={escudoRef} id="time-escudo" type="url" inputMode="url" value={escudo} onChange={(e) => setEscudo(e.target.value)} maxLength={500} className={campoEstilo} {...descreve('time-escudo', 'Um link https:// com a imagem do escudo.', erros.escudoUrl)} />
          </Campo>
          <p className="text-sm text-[var(--vs-muted)]">Naipe: {NAIPE_ROTULO[equipe.naipe]}. Ele não muda depois que o time é criado.</p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button type="submit" disabled={salvando} className={botaoPrimario}>{salvando ? 'Salvando…' : 'Salvar dados'}</button>
            <button type="button" disabled={salvando} onClick={() => setEditando(false)} className={botaoSecundario}>Cancelar</button>
          </div>
        </form>
      )}
      <AcessoEquipe cliente={cliente} equipeId={equipe.id} meuPapel={meuPapel} />
    </div>
  )
}
