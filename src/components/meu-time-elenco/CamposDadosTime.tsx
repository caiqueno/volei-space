'use client'

import { Campo, campoEstilo, descreve } from '@/components/meu-time/ui'
import type { Equipe } from '@/lib/meu-time-ui/tipos'
import { corDoTextoSobre, corValida, descricaoUniforme, nomeDaCor, normalizarCor, PALETA_UNIFORME, type CampoDadosTime, type EntradaDadosTime } from '@/lib/meu-time-elenco-ui/cores'
import { AVISO_PRIVACIDADE_TIME } from '@/lib/meu-time-elenco-ui/dados-time'
import { formatarCnpj, formatarTelefone } from '@/lib/meu-time-elenco-ui/mascaras'
import { CampoProtegido } from './CampoProtegido'
import { UploadArquivo } from './UploadArquivo'

export const DADOS_TIME_VAZIO: EntradaDadosTime = { cnpj: '', contatoEmail: '', contatoTelefone: '', corPrimaria: '', corSecundaria: '' }

type Props = {
  equipe: Equipe
  valor: EntradaDadosTime
  aoMudar: (valor: EntradaDadosTime) => void
  erros: Partial<Record<CampoDadosTime, string>>
  aoEscudoEnviado: () => void
  desabilitado?: boolean
}

function SeletorCor({ id, rotulo, valor, aoMudar, erro }: { id: string; rotulo: string; valor: string; aoMudar: (v: string) => void; erro?: string }) {
  const valida = corValida(valor)
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="text-sm font-bold">{rotulo}</legend>
      <div className="flex flex-wrap gap-2" role="group" aria-label={`Cores sugeridas: ${rotulo}`}>
        {PALETA_UNIFORME.map((cor) => {
          const marcada = valida && normalizarCor(valor) === cor.hex
          return (
            <button
              key={cor.hex} type="button" onClick={() => aoMudar(cor.hex)} aria-pressed={marcada} aria-label={cor.nome} title={cor.nome}
              className={`h-11 w-11 rounded-full border-2 ${marcada ? 'border-[var(--vs-gold)] ring-2 ring-[var(--vs-gold)]' : 'border-[var(--vs-border-strong)]'}`}
              style={{ backgroundColor: cor.hex }}
            />
          )
        })}
      </div>
      <div className="flex items-center gap-2">
        <input
          id={`${id}-seletor`} type="color" aria-label={`${rotulo}: outra cor`} value={valida ? valor : '#1D4ED8'}
          onChange={(e) => aoMudar(normalizarCor(e.target.value))} className="h-11 w-14 shrink-0 cursor-pointer rounded-lg border border-[var(--vs-border-strong)] bg-transparent p-1"
        />
        <input
          id={id} value={valor} onChange={(e) => aoMudar(e.target.value)} maxLength={7} placeholder="#1D4ED8" autoComplete="off" aria-label={`${rotulo} em código`}
          className={campoEstilo} {...descreve(id, undefined, erro)}
        />
        {valor && (
          <button type="button" onClick={() => aoMudar('')} className="min-h-[44px] shrink-0 px-2 text-sm font-bold underline">Limpar</button>
        )}
      </div>
      {erro && <p id={`${id}-erro`} role="alert" className="text-sm font-bold text-[var(--vs-error-fg)]">{erro}</p>}
      {valida && <p className="text-sm text-[var(--vs-muted)]">{nomeDaCor(valor)}</p>}
    </fieldset>
  )
}

/** Prévia do uniforme em amostra de cor e em texto (a cor sozinha não basta para quem não enxerga bem). */
export function PreviaUniforme({ primaria, secundaria }: { primaria: string; secundaria: string }) {
  const p = corValida(primaria) ? primaria : null
  const s = corValida(secundaria) ? secundaria : null
  return (
    <div className="flex items-center gap-3" data-testid="previa-uniforme">
      <div
        aria-hidden="true" className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl border-4 text-lg font-black"
        style={{ backgroundColor: p ?? 'transparent', borderColor: s ?? 'var(--vs-border-strong)', color: p ? corDoTextoSobre(p) : 'inherit' }}
      >
        10
      </div>
      <p className="text-sm font-bold">{descricaoUniforme(primaria, secundaria)}</p>
    </div>
  )
}

/** CNPJ, contato, cores e escudo por upload do time (flag do elenco completo). */
export function CamposDadosTime({ equipe, valor, aoMudar, erros, aoEscudoEnviado, desabilitado }: Props) {
  const muda = (campo: CampoDadosTime) => (texto: string) => aoMudar({ ...valor, [campo]: texto })
  const emailSalvo = equipe.contatoEmail ?? ''
  return (
    <div className="flex flex-col gap-4" data-testid="campos-dados-time">
      <UploadArquivo
        id="time-escudo-arquivo" tipo="ESCUDO" rotulo="Escudo do time" privacidade="Imagem quadrada, até 2 MB. O escudo aparece na página pública do campeonato."
        equipeId={equipe.id} jaTem={Boolean(equipe.escudoUrl)} aoEnviado={aoEscudoEnviado} desabilitado={desabilitado}
      />
      <CampoProtegido
        id="time-cnpj" rotulo="CNPJ (opcional)" mascara={equipe.cnpj}
        valor={valor.cnpj} aoMudar={muda('cnpj')} formatar={formatarCnpj} inputMode="numeric" maxLength={18} placeholder="00.000.000/0000-00" erro={erros.cnpj}
      />
      <Campo id="time-email" rotulo="E-mail de contato (opcional)" ajuda={AVISO_PRIVACIDADE_TIME} erro={erros.contatoEmail}>
        <input
          id="time-email" type="email" inputMode="email" value={valor.contatoEmail} onChange={(e) => muda('contatoEmail')(e.target.value)} maxLength={254} autoComplete="off"
          placeholder={emailSalvo ? undefined : 'time@exemplo.com'} className={campoEstilo} {...descreve('time-email', AVISO_PRIVACIDADE_TIME, erros.contatoEmail)}
        />
      </Campo>
      <CampoProtegido
        id="time-telefone" rotulo="Telefone de contato (opcional)" mascara={equipe.contatoTelefone}
        valor={valor.contatoTelefone} aoMudar={muda('contatoTelefone')} formatar={formatarTelefone} inputMode="tel" type="tel" maxLength={15}
        placeholder="(11) 91234-5678" erro={erros.contatoTelefone}
      />
      <SeletorCor id="time-cor-primaria" rotulo="Cor principal do uniforme" valor={valor.corPrimaria} aoMudar={muda('corPrimaria')} erro={erros.corPrimaria} />
      <SeletorCor id="time-cor-secundaria" rotulo="Cor secundária (detalhes)" valor={valor.corSecundaria} aoMudar={muda('corSecundaria')} erro={erros.corSecundaria} />
      <PreviaUniforme primaria={valor.corPrimaria} secundaria={valor.corSecundaria} />
    </div>
  )
}
