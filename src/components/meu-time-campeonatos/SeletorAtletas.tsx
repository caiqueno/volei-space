'use client'

import { useEffect, useState } from 'react'
import { Aviso, botaoPrimario, botaoSecundario, Carregando } from '@/components/meu-time/ui'
import {
  alternarAtleta,
  ordenarAtletas,
  selecaoValida,
  textoContagemSelecao,
  type AtletaDoBanco,
} from '@/lib/meu-time-campeonatos-ui/regras'

/** Escolha de quais atletas do banco do time entram na categoria, quando há mais do que o limite permite. */
export function SeletorAtletas({
  idBase,
  maximo,
  ocupado,
  carregar,
  aoEnviar,
  aoVoltar,
}: {
  idBase: string
  maximo: number
  ocupado: boolean
  carregar: () => Promise<AtletaDoBanco[]>
  aoEnviar: (ids: string[]) => void
  aoVoltar: () => void
}) {
  const [atletas, setAtletas] = useState<AtletaDoBanco[] | null>(null)
  const [erro, setErro] = useState(false)
  const [marcados, setMarcados] = useState<string[]>([])

  useEffect(() => {
    let vivo = true
    setAtletas(null)
    setErro(false)
    carregar()
      .then((lista) => { if (vivo) setAtletas(ordenarAtletas(lista)) })
      .catch(() => { if (vivo) setErro(true) })
    return () => { vivo = false }
  }, [carregar])

  const cheio = marcados.length >= maximo
  const valida = selecaoValida(marcados, maximo)

  return (
    <fieldset className="flex flex-col gap-2" disabled={ocupado}>
      <legend className="font-bold">Quem entra na categoria?</legend>
      <p id={`${idBase}-contagem`} aria-live="polite" className="text-sm text-[var(--vs-muted)]">
        {textoContagemSelecao(marcados.length, maximo)}
      </p>
      {!atletas && !erro && <Carregando texto="Buscando os atletas do time…" />}
      {erro && <Aviso tom="is-error" alerta>Não foi possível carregar os atletas do time. Volte e tente de novo.</Aviso>}
      {atletas && atletas.length === 0 && <Aviso>O time ainda não tem atletas cadastrados.</Aviso>}
      {atletas && atletas.length > 0 && (
        <ul className="flex max-h-72 flex-col gap-1 overflow-y-auto" aria-describedby={`${idBase}-contagem`}>
          {atletas.map((a) => {
            const marcado = marcados.includes(a.id)
            const bloqueado = cheio && !marcado
            return (
              <li key={a.id}>
                <label className={`flex min-h-[44px] cursor-pointer items-center gap-3 rounded-xl border px-3 py-2 ${marcado ? 'border-[var(--vs-gold)]' : 'border-[var(--vs-border)]'} ${bloqueado ? 'opacity-60' : ''}`}>
                  <input
                    type="checkbox"
                    className="h-5 w-5 shrink-0 accent-[var(--vs-gold)]"
                    checked={marcado}
                    disabled={bloqueado}
                    onChange={() => setMarcados((atual) => alternarAtleta(atual, a.id, maximo))}
                  />
                  <span className="flex-1 font-bold">{a.nome}</span>
                  {a.numeroPreferido !== null && <span className="text-sm text-[var(--vs-muted)]">Nº {a.numeroPreferido}</span>}
                </label>
              </li>
            )
          })}
        </ul>
      )}
      <div className="flex flex-col gap-2 sm:flex-row">
        <button type="button" className={botaoPrimario} disabled={ocupado || !valida} onClick={() => aoEnviar(marcados)}>
          {ocupado ? 'Enviando…' : 'Enviar com estes atletas'}
        </button>
        <button type="button" className={botaoSecundario} disabled={ocupado} onClick={aoVoltar}>
          Voltar
        </button>
      </div>
    </fieldset>
  )
}
