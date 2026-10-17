'use client'

import { useState, type FormEvent } from 'react'
import { Aviso, botaoPrimario, Campo, campoEstilo, Carregando, cartao, descreve, FalhaTela, falhaDe, Pagina, useCarregar } from '@/components/meu-time/ui'
import { POSICOES } from '@/components/meu-time/rotulos'
import type { Falha } from '@/lib/meu-time-ui/respostas'
import { EXPLICACAO_PUBLICA, ehMenorDeIdade, validarFormAtleta, type ErrosForm } from '@/lib/meu-time-fase2-ui/convites'
import { faseDoisAtiva } from '@/lib/meu-time-fase2-ui/flag'
import type { ConvitePublico } from '@/lib/meu-time-fase2-ui/tipos'
import { obterClienteFase2, type ClienteFase2 } from './cliente'

export function ConviteAtleta({ token, cliente }: { token: string; cliente?: ClienteFase2 }) {
  const api = cliente ?? obterClienteFase2()
  const { carga, tentarDeNovo } = useCarregar<ConvitePublico>(() => api.lerConvitePublico(token))

  if (!faseDoisAtiva()) {
    return (
      <Pagina titulo="Convite para o time">
        <Aviso>Esta função ainda não está disponível. Peça ao responsável pelo time para avisar quando estiver.</Aviso>
      </Pagina>
    )
  }
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
  const menor = ehMenorDeIdade(nascimento)

  async function enviar(ev: FormEvent) {
    ev.preventDefault()
    const e = validarFormAtleta({ nome, dataNascimento: nascimento, camisa })
    setErros(e)
    if (Object.keys(e).length > 0) return
    setOcupado(true)
    setFalha(null)
    try {
      await api.enviarConvitePublico(token, {
        nome: nome.trim(),
        dataNascimento: nascimento,
        ...(camisa.trim() !== '' ? { camisa: Number(camisa) } : {}),
        ...(posicao ? { posicao } : {}),
      })
      setEnviado(true)
    } catch (erro) {
      setFalha(falhaDe(erro))
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
        {falha && <FalhaTela falha={falha} />}
        <button type="submit" className={botaoPrimario} disabled={ocupado}>{ocupado ? 'Enviando…' : 'Enviar meus dados'}</button>
      </form>
    </Pagina>
  )
}
