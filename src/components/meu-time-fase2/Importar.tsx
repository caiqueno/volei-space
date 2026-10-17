'use client'

import { useRef, useState, type ChangeEvent } from 'react'
import { Aviso, botaoPerigo, botaoPrimario, botaoSecundario, Campo, campoEstilo, cartao, FalhaTela, falhaDe } from '@/components/meu-time/ui'
import type { Falha } from '@/lib/meu-time-ui/respostas'
import { NOME_ARQUIVO_MODELO, podeConfirmar, resumoEmFrase, ROTULO_STATUS, textoCsvValido, textoDeErroLinha, textoDoModeloCsv, validarArquivoCsv } from '@/lib/meu-time-fase2-ui/csv'
import type { PreviaImportacao } from '@/lib/meu-time-fase2-ui/tipos'
import { obterClienteFase2, type ClienteFase2 } from './cliente'
import { PaginaFase2, SeletorEquipe } from './Comum'

export function ImportarPlanilha({ cliente }: { cliente?: ClienteFase2 }) {
  const api = cliente ?? obterClienteFase2()
  const [equipeId, setEquipeId] = useState('')
  const [csv, setCsv] = useState('')
  const [erroLocal, setErroLocal] = useState<string | null>(null)
  const [falha, setFalha] = useState<Falha | null>(null)
  const [previa, setPrevia] = useState<PreviaImportacao | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [pronto, setPronto] = useState<'importada' | 'descartada' | null>(null)
  const arquivoRef = useRef<HTMLInputElement>(null)

  function baixarModelo() {
    const blob = new Blob([textoDoModeloCsv()], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = NOME_ARQUIVO_MODELO
    a.click()
    URL.revokeObjectURL(url)
  }

  async function aoEscolherArquivo(ev: ChangeEvent<HTMLInputElement>) {
    const arquivo = ev.target.files?.[0]
    if (!arquivo) return
    const problema = validarArquivoCsv(arquivo)
    if (problema) {
      setErroLocal(problema)
      return
    }
    try {
      setCsv((await arquivo.text()).replace(/^﻿/, ''))
      setErroLocal(null)
    } catch {
      setErroLocal('Não conseguimos ler esse arquivo. Tente outro ou cole as linhas aqui.')
    }
  }

  async function enviar() {
    const problema = !equipeId ? 'Escolha o time que vai receber os atletas.' : textoCsvValido(csv)
    setErroLocal(problema)
    if (problema) return
    setOcupado(true)
    setFalha(null)
    try {
      setPrevia(await api.enviarPlanilha(equipeId, csv))
    } catch (e) {
      setFalha(falhaDe(e))
    } finally {
      setOcupado(false)
    }
  }

  async function decidir(acao: 'importada' | 'descartada') {
    if (!previa) return
    setOcupado(true)
    setFalha(null)
    try {
      if (acao === 'importada') await api.confirmarImportacao(previa.id)
      else await api.descartarImportacao(previa.id)
      setPronto(acao)
      setPrevia(null)
      setCsv('')
      if (arquivoRef.current) arquivoRef.current.value = ''
    } catch (e) {
      setFalha(falhaDe(e))
    } finally {
      setOcupado(false)
    }
  }

  return (
    <PaginaFase2 titulo="Importar planilha de atletas">
      {pronto && (
        <Aviso tom="is-success">
          {pronto === 'importada' ? 'Atletas importados. Eles já aparecem no time.' : 'Importação descartada. Nada foi mudado no time.'}
        </Aviso>
      )}
      {!previa && (
        <>
          <Aviso>Traga vários atletas de uma vez. Baixe o modelo, preencha no Excel ou Google Planilhas e envie o arquivo .csv, ou cole as linhas abaixo. Você confere tudo antes de confirmar.</Aviso>
          <button type="button" className={botaoSecundario} onClick={baixarModelo}>Baixar planilha modelo</button>
          <SeletorEquipe id="imp-equipe" valor={equipeId} aoMudar={setEquipeId} rotulo="Para qual time?" />
          <div className={`${cartao} flex flex-col gap-3`}>
            <Campo id="imp-arquivo" rotulo="Enviar arquivo .csv" ajuda="O arquivo é lido aqui no seu aparelho e só vai ao servidor quando você tocar em Conferir.">
              <input id="imp-arquivo" ref={arquivoRef} type="file" accept=".csv,text/csv" className={campoEstilo} onChange={aoEscolherArquivo} />
            </Campo>
            <Campo id="imp-texto" rotulo="Ou cole as linhas aqui">
              <textarea id="imp-texto" rows={8} className={`${campoEstilo} font-mono text-sm`} value={csv} onChange={(e) => setCsv(e.target.value)} placeholder="nome,data_nascimento,camisa,posicao" />
            </Campo>
            {erroLocal && <p role="alert" className="text-sm font-bold text-[var(--vs-error-fg)]">{erroLocal}</p>}
            <button type="button" className={botaoPrimario} disabled={ocupado} onClick={enviar}>{ocupado ? 'Conferindo…' : 'Conferir planilha'}</button>
          </div>
        </>
      )}
      {falha && <FalhaTela falha={falha} />}
      {previa && (
        <section className="flex flex-col gap-4" aria-labelledby="previa">
          <h2 id="previa" className="text-xl font-black">Confira antes de importar</h2>
          <Aviso tom={previa.resumo.invalidas > 0 ? 'is-warning' : 'is-success'}>
            {resumoEmFrase(previa.resumo)}
            {previa.resumo.invalidas > 0 && ' Linhas com erro não serão importadas.'}
          </Aviso>
          <ul className="flex flex-col gap-2" aria-label="Linhas da planilha">
            {previa.linhas.map((l) => (
              <li key={l.n} className={`${cartao} flex flex-col gap-1`}>
                <span className="font-black">
                  Linha {l.n}: {String(l.dados.nome ?? 'sem nome')} <span className="text-sm font-bold">({ROTULO_STATUS[l.status]})</span>
                </span>
                {l.erros.length > 0 && (
                  <ul className={`list-disc pl-5 text-sm ${l.status === 'ERRO' ? 'text-[var(--vs-error-fg)]' : 'text-[var(--vs-muted)]'}`}>
                    {l.erros.map((e, i) => (
                      <li key={i}>{textoDeErroLinha(e)}</li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button type="button" className={botaoPrimario} disabled={ocupado || !podeConfirmar(previa.resumo)} onClick={() => decidir('importada')}>
              {ocupado ? 'Aguarde…' : 'Confirmar importação'}
            </button>
            <button type="button" className={botaoPerigo} disabled={ocupado} onClick={() => decidir('descartada')}>Descartar</button>
          </div>
        </section>
      )}
    </PaginaFase2>
  )
}
