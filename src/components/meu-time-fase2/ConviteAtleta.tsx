'use client'

import { useState, type FormEvent } from 'react'
import { Aviso, botaoPrimario, Campo, campoEstilo, Carregando, cartao, descreve, FalhaTela, falhaDe, Pagina, useCarregar } from '@/components/meu-time/ui'
import { POSICOES } from '@/components/meu-time/rotulos'
import type { Falha } from '@/lib/meu-time-ui/respostas'
import { AVISO_DADOS_ATLETA, EXPLICACAO_PUBLICA, MENSAGEM_CIENCIA, TEXTO_VERSAO_AVISO, ehMenorDeIdade, mensagemCienciaObrigatoria, montarCorpoConvite, validarFormAtleta, type ErrosForm } from '@/lib/meu-time-fase2-ui/convites'
import { faseDoisAtiva } from '@/lib/meu-time-fase2-ui/flag'
import type { ConvitePublico } from '@/lib/meu-time-fase2-ui/tipos'
import { obterClienteFase2, type ClienteFase2 } from './cliente'

export function ConviteAtleta({ token, cliente }: { token: string; cliente?: ClienteFase2 }) {
  // Flag desligada: nenhuma requisição (o hook de carga fica no componente interno, que nem monta).
  if (!faseDoisAtiva()) {
    return (
      <Pagina titulo="Convite para o time">
        <Aviso>Esta função ainda não está disponível. Peça ao responsável pelo time para avisar quando estiver.</Aviso>
      </Pagina>
    )
  }
  return <ConviteAtletaAtivo token={token} cliente={cliente} />
}

function ConviteAtletaAtivo({ token, cliente }: { token: string; cliente?: ClienteFase2 }) {
  const api = cliente ?? obterClienteFase2()
  const { carga, tentarDeNovo } = useCarregar<ConvitePublico>(() => api.lerConvitePublico(token))

  if (carga.estado === 'carregando') {
    return (
      <Pagina titulo="Convite para o time">
        <Carregando texto="Abrindo seu convite…" />
      </Pagina>
    )
  }
  if (carga.estado === 'falha') {
    if (carga.falha.tipo === 'nao-encontrado') return <Encerrado estado="invalido" />
    return (
      <Pagina titulo="Convite para o time">
        <FalhaTela falha={carga.falha} aoTentar={tentarDeNovo} />
      </Pagina>
    )
  }
  if (carga.dados.estado !== 'ativo') return <Encerrado estado={carga.dados.estado} />
  return <Formulario token={token} convite={carga.dados} api={api} />
}

function Encerrado({ estado }: { estado: Exclude<ConvitePublico['estado'], 'ativo'> }) {
  const e = EXPLICACAO_PUBLICA[estado]
  return (
    <Pagina titulo={e.titulo}>
      <Aviso tom="is-warning">{e.texto}</Aviso>
    </Pagina>
  )
}

function Formulario({ token, convite, api }: { token: string; convite: ConvitePublico; api: ClienteFase2 }) {
  const [nome, setNome] = useState('')
  const [nascimento, setNascimento] = useState('')
  const [camisa, setCamisa] = useState('')
  const [posicao, setPosicao] = useState('')
  const [erros, setErros] = useState<ErrosForm>({})
  const [falha, setFalha] = useState<Falha | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [enviado, setEnviado] = useState(false)
  const [ciente, setCiente] = useState(false)
  const menor = ehMenorDeIdade(nascimento)

  async function enviar(ev: FormEvent) {
    ev.preventDefault()
    const e = validarFormAtleta({ nome, dataNascimento: nascimento, camisa, ciente })
    setErros(e)
    if (Object.keys(e).length > 0) return
    const corpo = montarCorpoConvite({ nome, dataNascimento: nascimento, camisa, posicao, ciente })
    if (!corpo) {
      setErros({ ...e, ciencia: MENSAGEM_CIENCIA })
      return
    }
    setOcupado(true)
    setFalha(null)
    try {
      await api.enviarConvitePublico(token, corpo)
      setEnviado(true)
    } catch (erro) {
      const f = falhaDe(erro)
      const ciencia = mensagemCienciaObrigatoria(f)
      if (ciencia) setErros({ ciencia })
      setFalha(ciencia ? { ...f, mensagem: ciencia } : f)
    } finally {
      setOcupado(false)
    }
  }

  if (enviado) {
    return (
      <Pagina titulo="Tudo certo!">
        <Aviso tom="is-success">
          Recebemos seus dados para o time {convite.equipe}.
          {menor && ' Como você é menor de idade, vamos entrar em contato com seu responsável para pedir a autorização.'}
        </Aviso>
        <p className="text-[var(--vs-muted)]">Pode fechar esta página. O responsável pelo time cuida do resto.</p>
      </Pagina>
    )
  }

  return (
    <Pagina titulo={`Entrar no time ${convite.equipe}`}>
      <p className="text-[var(--vs-muted)]">
        {convite.categoria ? `Categoria: ${convite.categoria}. ` : ''}Preencha seus dados. Leva menos de um minuto.
      </p>
      <form onSubmit={enviar} noValidate className={`${cartao} flex flex-col gap-4`}>
        <Campo id="ca-nome" rotulo="Seu nome completo" erro={erros.nome}>
          <input id="ca-nome" className={campoEstilo} autoComplete="name" value={nome} onChange={(e) => setNome(e.target.value)} {...descreve('ca-nome', undefined, erros.nome)} />
        </Campo>
        <Campo id="ca-nasc" rotulo="Data de nascimento" erro={erros.dataNascimento}>
          <input id="ca-nasc" type="date" className={campoEstilo} autoComplete="bday" value={nascimento} onChange={(e) => setNascimento(e.target.value)} {...descreve('ca-nasc', undefined, erros.dataNascimento)} />
        </Campo>
        {menor && (
          <Aviso tom="is-warning">
            Você tem menos de 18 anos. Depois de enviar, vamos entrar em contato com seu responsável para pedir a autorização. Seu cadastro só vale depois disso.
          </Aviso>
        )}
        <Campo id="ca-camisa" rotulo="Número da camisa (opcional)" erro={erros.camisa}>
          <input id="ca-camisa" inputMode="numeric" className={campoEstilo} value={camisa} onChange={(e) => setCamisa(e.target.value)} {...descreve('ca-camisa', undefined, erros.camisa)} />
        </Campo>
        <Campo id="ca-pos" rotulo="Posição (opcional)">
          <select id="ca-pos" className={campoEstilo} value={posicao} onChange={(e) => setPosicao(e.target.value)}>
            <option value="">Não sei ainda</option>
            {POSICOES.map((p) => (
              <option key={p.valor} value={p.valor}>{p.rotulo}</option>
            ))}
          </select>
        </Campo>
        <section aria-labelledby="ca-dados-titulo" className="rounded-xl border border-[var(--vs-border)] p-3 text-sm">
          <h2 id="ca-dados-titulo" className="font-black">{AVISO_DADOS_ATLETA.titulo}</h2>
          <ul className="mt-1 list-disc pl-5 text-[var(--vs-muted)]">
            {AVISO_DADOS_ATLETA.itens.map((i) => (
              <li key={i}>{i}</li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-[var(--vs-muted)]">{TEXTO_VERSAO_AVISO}</p>
        </section>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="ca-ciencia" className="flex min-h-[44px] items-start gap-3 text-sm font-bold">
            <input
              id="ca-ciencia"
              type="checkbox"
              className="mt-0.5 h-6 w-6 shrink-0"
              checked={ciente}
              onChange={(e) => setCiente(e.target.checked)}
              {...descreve('ca-ciencia', undefined, erros.ciencia)}
            />
            <span>{AVISO_DADOS_ATLETA.ciencia}</span>
          </label>
          {erros.ciencia && <p id="ca-ciencia-erro" role="alert" className="text-sm font-bold text-[var(--vs-error-fg)]">{erros.ciencia}</p>}
        </div>
        {falha && <FalhaTela falha={falha} />}
        <button type="submit" className={botaoPrimario} disabled={ocupado}>{ocupado ? 'Enviando…' : 'Enviar meus dados'}</button>
      </form>
    </Pagina>
  )
}
