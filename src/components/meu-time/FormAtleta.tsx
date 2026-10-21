'use client'

import { useRef, useState, type FormEvent } from 'react'
import { ErroMeuTime, type MeuTimeClient } from './cliente'
import { Aviso, botaoPrimario, botaoSecundario, Campo, campoEstilo, descreve, falhaDe } from './ui'
import { POSICOES } from './rotulos'
import { CamposResponsavel, RESPONSAVEL_VAZIO } from './CamposResponsavel'
import { validarAtletaComResponsavel, validarNovoAtleta, type CampoAtletaComResponsavel } from '@/lib/meu-time-ui/formularios'
import { ehMenor, type EntradaResponsavel } from '@/lib/meu-time-ui/responsavel'
import { dataNascimentoValida } from '@/lib/meu-time-ui/selecao'
import type { Atleta } from '@/lib/meu-time-ui/tipos'
import { elencoCompletoAtivo } from '@/lib/meu-time-elenco-ui/flag'
import { validarContatoAtleta, type CampoContatoAtleta, type EntradaContatoAtleta } from '@/lib/meu-time-elenco-ui/mascaras'
import { CamposElencoAtleta, CONTATO_ATLETA_VAZIO } from '@/components/meu-time-elenco/CamposElencoAtleta'

type Props = {
  cliente: MeuTimeClient
  equipeId: string
  /** Quando informado, edita este atleta em vez de criar um novo. */
  atleta?: Atleta
  aoSalvar: () => void
  aoCancelar: () => void
  /** Elenco completo: avisa a lista quando um arquivo foi enviado (a tela recarrega sem fechar o formulário). */
  aoMudou?: () => void
}

export function FormAtleta({ cliente, equipeId, atleta, aoSalvar, aoCancelar, aoMudou }: Props) {
  const elenco = elencoCompletoAtivo()
  const [contato, setContato] = useState<EntradaContatoAtleta>(CONTATO_ATLETA_VAZIO)
  const [errosContato, setErrosContato] = useState<Partial<Record<CampoContatoAtleta, string>>>({})
  const [pendentes, setPendentes] = useState<{ foto: File | null; documento: File | null }>({ foto: null, documento: null })
  // Atleta recém-criado: o formulário vira "enviando os arquivos escolhidos".
  const [criado, setCriado] = useState<Atleta | null>(null)
  const [faltaEnviar, setFaltaEnviar] = useState(0)
  const [nome, setNome] = useState(atleta?.nome ?? '')
  const [nascimento, setNascimento] = useState(atleta?.dataNascimento?.slice(0, 10) ?? '')
  const [numero, setNumero] = useState(atleta?.numeroPreferido != null ? String(atleta.numeroPreferido) : '')
  const [posicao, setPosicao] = useState(atleta?.posicao ?? '')
  const [erros, setErros] = useState<Partial<Record<CampoAtletaComResponsavel, string>>>({})
  const [responsavel, setResponsavel] = useState<EntradaResponsavel>(RESPONSAVEL_VAZIO)
  const respNomeRef = useRef<HTMLInputElement>(null)
  // Pede o responsável quando a data torna a pessoa menor e ainda não há autorização registrada.
  const pedeResponsavel = dataNascimentoValida(nascimento) && ehMenor(nascimento) && (!atleta || atleta.consentimentoPendente === true || atleta.menor !== true)
  const [mensagem, setMensagem] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)
  const nomeRef = useRef<HTMLInputElement>(null)
  const nascimentoRef = useRef<HTMLInputElement>(null)
  const numeroRef = useRef<HTMLInputElement>(null)

  async function enviar(evento: FormEvent) {
    evento.preventDefault()
    if (salvando) return
    const entrada = { nome, dataNascimento: nascimento, numero, posicao }
    const resultado = pedeResponsavel ? validarAtletaComResponsavel(entrada, responsavel) : validarNovoAtleta(entrada)
    setErros(resultado.erros)
    setMensagem(null)
    const contatoValidado = elenco ? validarContatoAtleta(contato) : null
    setErrosContato(contatoValidado?.erros ?? {})
    if (!resultado.valido) {
      const e = resultado.erros as Partial<Record<CampoAtletaComResponsavel, string>>
      const alvo = e.nome ? nomeRef : e.dataNascimento ? nascimentoRef : e.numero ? numeroRef : respNomeRef
      alvo.current?.focus()
      return
    }
    if (contatoValidado && !contatoValidado.valido) return
    setSalvando(true)
    try {
      const dados = contatoValidado ? { ...resultado.dados, ...contatoValidado.dados } : resultado.dados
      let salvo: Atleta | null = null
      if (atleta) await cliente.atualizarAtleta(equipeId, atleta.id, dados)
      else salvo = await cliente.adicionarAtleta(equipeId, dados)
      // O contato do responsável e os dados sensíveis saem da memória da tela assim que foram enviados.
      setResponsavel(RESPONSAVEL_VAZIO)
      setContato(CONTATO_ATLETA_VAZIO)
      const arquivos = [pendentes.foto, pendentes.documento].filter(Boolean).length
      if (salvo && arquivos > 0) {
        setCriado(salvo)
        setFaltaEnviar(arquivos)
        setSalvando(false)
        aoMudou?.()
        return
      }
      aoSalvar()
    } catch (erro) {
      setMensagem(erro instanceof ErroMeuTime ? erro.falha.mensagem : falhaDe(erro).mensagem)
      setSalvando(false)
    }
  }

  if (elenco && criado) {
    return (
      <section aria-label={`Enviar arquivos de ${criado.nome}`} className="flex flex-col gap-4 rounded-2xl border border-[var(--vs-border-strong)] bg-[var(--vs-elevated)] p-4">
        <h3 className="text-lg font-black">Atleta salvo</h3>
        <Aviso tom="is-success">{criado.nome} foi salvo. {faltaEnviar > 0 ? 'Enviando os arquivos que você escolheu.' : 'Arquivos enviados.'}</Aviso>
        <CamposElencoAtleta
          somenteArquivos equipeId={equipeId} atleta={criado} atletaId={criado.id} valor={contato} aoMudar={setContato} erros={{}}
          menor={criado.menor === true} arquivosPendentes={pendentes}
          aoEnviarFoto={() => { setFaltaEnviar((n) => Math.max(0, n - 1)); aoMudou?.() }}
          aoEnviarDocumento={() => { setFaltaEnviar((n) => Math.max(0, n - 1)); aoMudou?.() }}
        />
        <button type="button" onClick={aoSalvar} className={botaoPrimario}>{faltaEnviar > 0 ? 'Concluir sem esperar' : 'Concluir'}</button>
      </section>
    )
  }

  return (
    <form onSubmit={enviar} noValidate aria-label={atleta ? `Editar ${atleta.nome}` : 'Adicionar atleta'} className="flex flex-col gap-4 rounded-2xl border border-[var(--vs-border-strong)] bg-[var(--vs-elevated)] p-4">
      <h3 className="text-lg font-black">{atleta ? 'Editar atleta' : 'Adicionar atleta'}</h3>
      {mensagem && <Aviso tom="is-error" alerta>{mensagem}</Aviso>}
      <Campo id="atleta-nome" rotulo="Nome completo" erro={erros.nome}>
        <input ref={nomeRef} id="atleta-nome" value={nome} onChange={(e) => setNome(e.target.value)} autoComplete="off" maxLength={100} autoFocus={!atleta} className={campoEstilo} {...descreve('atleta-nome', undefined, erros.nome)} />
      </Campo>
      <Campo id="atleta-nascimento" rotulo="Data de nascimento" ajuda="Sem ela não dá para saber se a pessoa pode jogar na categoria." erro={erros.dataNascimento}>
        <input
          ref={nascimentoRef} id="atleta-nascimento" type="date" value={nascimento} onChange={(e) => setNascimento(e.target.value)}
          max={new Date().toISOString().slice(0, 10)} className={campoEstilo}
          {...descreve('atleta-nascimento', 'Sem ela não dá para saber se a pessoa pode jogar na categoria.', erros.dataNascimento)}
        />
      </Campo>
      {pedeResponsavel && (
        <CamposResponsavel
          ref={respNomeRef} prefixo="atleta" valor={responsavel} aoMudar={setResponsavel} nomeAtleta={nome.trim() || undefined}
          erros={{ nome: erros.respNome, contato: erros.respContato, aceite: erros.respAceite }}
        />
      )}
      <div className="grid grid-cols-2 gap-3">
        <Campo id="atleta-numero" rotulo="Camisa (opcional)" erro={erros.numero}>
          <input ref={numeroRef} id="atleta-numero" inputMode="numeric" pattern="[0-9]*" maxLength={2} value={numero} onChange={(e) => setNumero(e.target.value.replace(/\D/g, ''))} className={campoEstilo} {...descreve('atleta-numero', undefined, erros.numero)} />
        </Campo>
        <Campo id="atleta-posicao" rotulo="Posição (opcional)" erro={erros.posicao}>
          <select id="atleta-posicao" value={posicao} onChange={(e) => setPosicao(e.target.value)} className={campoEstilo}>
            <option value="">Não sei</option>
            {POSICOES.map((p) => <option key={p.valor} value={p.valor}>{p.rotulo}</option>)}
          </select>
        </Campo>
      </div>
      {elenco && (
        <CamposElencoAtleta
          equipeId={equipeId} atleta={atleta} atletaId={atleta?.id} valor={contato} aoMudar={setContato} erros={errosContato}
          menor={dataNascimentoValida(nascimento) && ehMenor(nascimento)} arquivosPendentes={pendentes}
          aoPrepararFoto={(foto) => setPendentes((p) => ({ ...p, foto }))}
          aoPrepararDocumento={(documento) => setPendentes((p) => ({ ...p, documento }))}
          aoEnviado={aoMudou} desabilitado={salvando}
        />
      )}
      <div className="flex flex-col gap-2 sm:flex-row">
        <button type="submit" disabled={salvando} className={botaoPrimario}>{salvando ? 'Salvando…' : atleta ? 'Salvar alterações' : 'Salvar atleta'}</button>
        <button type="button" onClick={aoCancelar} className={botaoSecundario}>Cancelar</button>
      </div>
    </form>
  )
}
