'use client'

import { Aviso, Campo, campoEstilo, descreve } from '@/components/meu-time/ui'
import { formatarCpf, formatarTelefone, TIPOS_DOCUMENTO, type CampoContatoAtleta, type EntradaContatoAtleta } from '@/lib/meu-time-elenco-ui/mascaras'
import { AVISO_MENOR_RESPONSAVEL, PRIVACIDADE_CPF, PRIVACIDADE_DOCUMENTO, PRIVACIDADE_FOTO, TEXTO_SALVE_PRIMEIRO } from '@/lib/meu-time-elenco-ui/textos'
import type { Atleta } from '@/lib/meu-time-ui/tipos'
import { CampoProtegido } from './CampoProtegido'
import { UploadArquivo } from './UploadArquivo'

export const CONTATO_ATLETA_VAZIO: EntradaContatoAtleta = { cpf: '', documentoTipo: '', documentoNumero: '', telefone: '', telefoneEmergencia: '' }

type Props = {
  equipeId: string
  /** Atleta já salvo (edição ou recém-criado). Traz só as máscaras. */
  atleta?: Atleta
  atletaId?: string
  valor: EntradaContatoAtleta
  aoMudar: (valor: EntradaContatoAtleta) => void
  erros: Partial<Record<CampoContatoAtleta, string>>
  menor: boolean
  /** Arquivos escolhidos antes de o atleta existir (enviados ao salvar). */
  arquivosPendentes?: { foto?: File | null; documento?: File | null }
  aoPrepararFoto?: (arquivo: File | null) => void
  aoPrepararDocumento?: (arquivo: File | null) => void
  aoEnviado?: () => void
  aoEnviarFoto?: () => void
  aoEnviarDocumento?: () => void
  /** Depois de salvar um atleta novo: só falta enviar os arquivos. */
  somenteArquivos?: boolean
  desabilitado?: boolean
}

/** Foto de rosto, documento, CPF e telefones do atleta (flag do elenco completo). */
export function CamposElencoAtleta({ equipeId, atleta, atletaId, valor, aoMudar, erros, menor, arquivosPendentes, aoPrepararFoto, aoPrepararDocumento, aoEnviado, aoEnviarFoto, aoEnviarDocumento, somenteArquivos, desabilitado }: Props) {
  const muda = (campo: CampoContatoAtleta) => (texto: string) => aoMudar({ ...valor, [campo]: texto })
  const id = atletaId ?? 'novo'
  return (
    <div className="flex flex-col gap-4" data-testid="campos-elenco-atleta">
      {menor && <Aviso tom="is-warning">{AVISO_MENOR_RESPONSAVEL}</Aviso>}
      {!atletaId && <p className="text-sm text-[var(--vs-muted)]">{TEXTO_SALVE_PRIMEIRO}</p>}

      <UploadArquivo
        key={`foto-${id}`} id={`atleta-foto-${id}`} tipo="FOTO_ROSTO" rotulo="Foto de rosto" privacidade={PRIVACIDADE_FOTO}
        equipeId={equipeId} atletaId={atletaId} jaTem={atleta?.temFoto === true} arquivoInicial={arquivosPendentes?.foto}
        aoPreparar={aoPrepararFoto} aoEnviado={() => { aoEnviarFoto?.(); aoEnviado?.() }} desabilitado={desabilitado}
      />
      <UploadArquivo
        key={`doc-${id}`} id={`atleta-doc-${id}`} tipo="DOCUMENTO" rotulo="Documento (foto ou PDF)" privacidade={PRIVACIDADE_DOCUMENTO}
        equipeId={equipeId} atletaId={atletaId} jaTem={atleta?.temDocumento === true} arquivoInicial={arquivosPendentes?.documento}
        aoPreparar={aoPrepararDocumento} aoEnviado={() => { aoEnviarDocumento?.(); aoEnviado?.() }} desabilitado={desabilitado}
      />

      {!somenteArquivos && (<>
      <Campo id="atleta-doc-tipo" rotulo="Tipo do documento" erro={erros.documentoTipo}>
        <select id="atleta-doc-tipo" value={valor.documentoTipo} onChange={(e) => muda('documentoTipo')(e.target.value)} className={campoEstilo} {...descreve('atleta-doc-tipo', undefined, erros.documentoTipo)}>
          <option value="">{atleta?.documentoTipo ? 'Manter o que está salvo' : 'Escolha'}</option>
          {TIPOS_DOCUMENTO.map((t) => <option key={t.valor} value={t.valor}>{t.rotulo}</option>)}
        </select>
      </Campo>
      <CampoProtegido
        id="atleta-doc-numero" rotulo="Número do documento" mascara={atleta?.documentoNumero} valor={valor.documentoNumero}
        aoMudar={muda('documentoNumero')} maxLength={30} erro={erros.documentoNumero}
      />
      <CampoProtegido
        id="atleta-cpf" rotulo="CPF" mascara={atleta?.cpf} valor={valor.cpf} aoMudar={muda('cpf')} formatar={formatarCpf}
        inputMode="numeric" maxLength={14} placeholder="000.000.000-00" ajuda={PRIVACIDADE_CPF} erro={erros.cpf}
      />
      <CampoProtegido
        id="atleta-telefone" rotulo="Telefone do atleta" mascara={atleta?.telefone} valor={valor.telefone} aoMudar={muda('telefone')}
        formatar={formatarTelefone} inputMode="tel" type="tel" maxLength={15} placeholder="(11) 91234-5678" erro={erros.telefone}
      />
      <CampoProtegido
        id="atleta-telefone-emergencia" rotulo="Telefone de emergência" mascara={atleta?.telefoneEmergencia} valor={valor.telefoneEmergencia}
        aoMudar={muda('telefoneEmergencia')} formatar={formatarTelefone} inputMode="tel" type="tel" maxLength={15}
        placeholder="(11) 91234-5678" ajuda="Alguém para avisar se acontecer algo no jogo." erro={erros.telefoneEmergencia}
      />
      </>)}
    </div>
  )
}
