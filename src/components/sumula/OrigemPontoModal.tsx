'use client'

import { ROTULO_PONTO, type OrigemPonto } from '@/lib/ponto-sumula'

type Atleta = { number: string; name: string }

const OPCOES: Array<{ origem: OrigemPonto; titulo: string }> = [
  { origem: 'ace', titulo: 'Ponto de Saque' },
  { origem: 'block', titulo: 'Ponto de Bloqueio' },
  { origem: 'attack', titulo: 'Ponto de Ataque' },
]

export function OrigemPontoModal({
  equipe,
  sacando,
  sacador,
  atletas,
  numeroExibido,
  onConfirm,
  onClose,
}: {
  equipe: string
  sacando: boolean
  sacador?: string
  atletas: Atleta[]
  numeroExibido: (number: string) => string
  onConfirm: (origem: OrigemPonto, number: string) => void
  onClose: () => void
}) {
  const inicial = sacando ? 'ace' : 'attack'
  const atletaInicial = sacando && sacador ? sacador : atletas[0]?.number ?? ''

  return (
    <form
      className="official-modal official-point-origin"
      role="dialog"
      aria-modal="true"
      aria-labelledby="point-origin-title"
      onSubmit={(event) => {
        event.preventDefault()
        const dados = new FormData(event.currentTarget)
        const origem = String(dados.get('origem') ?? '') as OrigemPonto
        const number = String(dados.get('jogador') ?? '')
        if (!ROTULO_PONTO[origem] || !number) return
        onConfirm(origem, number)
      }}
    >
      <div>
        <header>
          <span>{equipe}</span>
          <h3 id="point-origin-title">+1</h3>
          <p>Escolha a origem do ponto e o atleta que fez a ação.</p>
        </header>
        <fieldset>
          <legend>Tipo do ponto</legend>
          {OPCOES.map((opcao) => (
            <label key={opcao.origem}>
              <input type="radio" name="origem" value={opcao.origem} defaultChecked={opcao.origem === inicial} disabled={opcao.origem === 'ace' && !sacando} />
              <span>{opcao.titulo}</span>
              {opcao.origem === 'ace' && !sacando ? <em>Só quem está sacando</em> : null}
            </label>
          ))}
        </fieldset>
        <fieldset>
          <legend>Jogador</legend>
          {atletas.length === 0 && <p>Monte a escalação antes de registrar o ponto.</p>}
          {atletas.map((atleta) => (
            <label key={atleta.number}>
              <input type="radio" name="jogador" value={atleta.number} defaultChecked={atleta.number === atletaInicial} />
              <span>#{numeroExibido(atleta.number)} {atleta.name}</span>
            </label>
          ))}
        </fieldset>
        <div className="official-penalty-actions">
          <button type="button" onClick={onClose}>Cancelar</button>
          <button type="submit" disabled={atletas.length === 0}>Registrar +1</button>
        </div>
      </div>
    </form>
  )
}
