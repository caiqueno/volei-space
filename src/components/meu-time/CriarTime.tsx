'use client'

import { useRouter } from 'next/navigation'
import { useRef, useState, type FormEvent } from 'react'
import { inscricaoViaMeuTimeAtiva, returnToSeguro } from '@/lib/inscricao-entrada-ui/regras'
import { obterClientePadrao, type MeuTimeClient } from './cliente'
import { Aviso, botaoPrimario, Campo, campoEstilo, descreve, FalhaTela, falhaDe, Pagina } from './ui'
import { NAIPE_ROTULO } from './rotulos'
import type { Falha } from '@/lib/meu-time-ui/respostas'
import type { Naipe } from '@/lib/meu-time-ui/tipos'
import { validarNovoTime } from '@/lib/meu-time-ui/formularios'

const NAIPES: Naipe[] = ['FEMININO', 'MASCULINO', 'MISTO']

export function CriarTime({ cliente }: { cliente?: MeuTimeClient }) {
  const api = cliente ?? obterClientePadrao()
  const router = useRouter()
  const [nome, setNome] = useState('')
  const [cidade, setCidade] = useState('')
  const [naipe, setNaipe] = useState<Naipe | ''>('')
  const [escudoUrl, setEscudoUrl] = useState('')
  const [erros, setErros] = useState<Partial<Record<'nome' | 'naipe' | 'escudoUrl', string>>>({})
  const [falha, setFalha] = useState<Falha | null>(null)
  const [salvando, setSalvando] = useState(false)
  const nomeRef = useRef<HTMLInputElement>(null)
  const resumoRef = useRef<HTMLDivElement>(null)

  async function enviar(evento: FormEvent) {
    evento.preventDefault()
    if (salvando) return
    const resultado = validarNovoTime({ nome, cidade, naipe, escudoUrl })
    setErros(resultado.erros)
    setFalha(null)
    if (!resultado.valido) {
      requestAnimationFrame(() => (resultado.erros.nome ? nomeRef.current : resumoRef.current)?.focus())
      return
    }
    setSalvando(true)
    try {
      const criada = await api.criarEquipe(resultado.dados)
      // Vindo de um convite de inscrição: volta para a continuação em vez da ficha do time.
      const voltar = inscricaoViaMeuTimeAtiva() ? returnToSeguro(new URLSearchParams(window.location.search).get('voltar')) : null
      router.push(voltar ?? `/meu-time/${encodeURIComponent(criada.id)}?novo=1`)
    } catch (erro) {
      setFalha(falhaDe(erro))
      setSalvando(false)
    }
  }

  return (
    <Pagina titulo="Criar meu time" voltar={{ href: '/meu-time', texto: 'Voltar para meus times' }}>
      <p className="text-[var(--vs-muted)]">Só o essencial. Você completa o resto depois.</p>
      {falha && (falha.tipo === 'nao-habilitado' || falha.tipo === 'sem-sessao') && <FalhaTela falha={falha} />}
      <form onSubmit={enviar} noValidate className="flex flex-col gap-5">
        {falha && falha.tipo !== 'nao-habilitado' && falha.tipo !== 'sem-sessao' && <Aviso tom="is-error" alerta>{falha.mensagem}</Aviso>}
        <div ref={resumoRef} tabIndex={-1} className="outline-none">
          {erros.naipe && <Aviso tom="is-error" alerta>{erros.naipe}</Aviso>}
        </div>
        <Campo id="time-nome" rotulo="Nome do time" erro={erros.nome}>
          <input
            ref={nomeRef} id="time-nome" name="nome" value={nome} onChange={(e) => setNome(e.target.value)}
            autoComplete="organization" maxLength={80} required className={campoEstilo} {...descreve('time-nome', undefined, erros.nome)}
          />
        </Campo>
        <Campo id="time-cidade" rotulo="Cidade (opcional)">
          <input id="time-cidade" name="cidade" value={cidade} onChange={(e) => setCidade(e.target.value)} autoComplete="address-level2" maxLength={80} className={campoEstilo} />
        </Campo>
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-bold">Naipe do time</legend>
          <div className="grid grid-cols-3 gap-2">
            {NAIPES.map((valor) => (
              <label
                key={valor}
                className={`flex min-h-[52px] cursor-pointer items-center justify-center rounded-xl border px-2 text-center text-base font-bold has-[:focus-visible]:outline has-[:focus-visible]:outline-[3px] has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[var(--vs-focus)] ${
                  naipe === valor ? 'border-[var(--vs-gold)] bg-[var(--vs-elevated)] text-[var(--vs-gold)]' : 'border-[var(--vs-border-strong)]'
                }`}
              >
                <input type="radio" name="naipe" value={valor} checked={naipe === valor} onChange={() => setNaipe(valor)} className="sr-only" />
                {NAIPE_ROTULO[valor]}
              </label>
            ))}
          </div>
        </fieldset>
        <details className="rounded-xl border border-[var(--vs-border)] p-3">
          <summary className="min-h-[44px] cursor-pointer py-2 text-sm font-bold">Escudo do time (opcional)</summary>
          <div className="mt-2">
            <Campo id="time-escudo" rotulo="Endereço da imagem do escudo" ajuda="Pode deixar em branco e colocar depois." erro={erros.escudoUrl}>
              <input
                id="time-escudo" name="escudoUrl" type="url" inputMode="url" value={escudoUrl} onChange={(e) => setEscudoUrl(e.target.value)}
                placeholder="https://" className={campoEstilo} {...descreve('time-escudo', 'Pode deixar em branco e colocar depois.', erros.escudoUrl)}
              />
            </Campo>
          </div>
        </details>
        <button type="submit" disabled={salvando} className={botaoPrimario}>{salvando ? 'Salvando seu time…' : 'Criar time'}</button>
      </form>
    </Pagina>
  )
}
