import type { CSSProperties } from 'react'
import { Medal, Shield, Swords, Zap } from 'lucide-react'
import { NomeEquipe } from '@/components/equipes/NomeEquipe'
import { COLUNAS_GRUPO, numerosDaLinha } from '@/components/classificacao/LinhaGrupoTabela'
import { nomeDoAtleta } from '@/components/classificacao/LinhaScout'
import { MioloConfronto } from '@/components/mata-mata/MioloConfronto'
import { PlacarJogo } from '@/components/partidas/PlacarJogo'
import { iniciais } from '@/lib/iniciais'
import { saldoComSinal } from '@/lib/quadro-publico'
import type { CartazStories, FundamentoCartaz, SumulaCartaz } from '@/lib/stories-cartaz'
import { contraste, type PaletaStories } from '@/lib/stories-paleta'

const TEXTO_CLARO = '#F5F7FB'
const TEXTO_ESCURO = '#12141A'

function textoSobre(fundo: string) {
  return contraste(fundo, TEXTO_CLARO) >= 4.5 ? TEXTO_CLARO : TEXTO_ESCURO
}
import estilos from '@/components/stories/cartaz.module.css'

const ICONE: Record<FundamentoCartaz, typeof Swords> = {
  ataque: Swords,
  bloqueio: Shield,
  saque: Zap,
}

export function CartazVisual({ cartaz, paleta }: { cartaz: CartazStories; paleta: PaletaStories }) {
  return (
    <article
      className={estilos.cartaz}
      style={{
        '--story-fundo-a': paleta.fundoA,
        '--story-fundo-b': paleta.fundoB,
        '--story-superficie': paleta.superficie,
        '--story-elevada': paleta.elevada,
        '--story-borda': paleta.borda,
        '--story-texto': paleta.texto,
        '--story-suave': paleta.textoSuave,
        '--story-ouro': paleta.ouro,
        '--story-sobre-ouro': paleta.sobreOuro,
        '--story-primaria': paleta.primaria,
        '--story-sobre-primaria': textoSobre(paleta.primaria),
      } as CSSProperties}
      data-tipo={cartaz.tipo}
    >
      <header className={estilos.cabecalho}>
        {cartaz.campeonato ? (
          <p className={`${estilos.titulo} ${estilos.faixa}`}>
            {cartaz.logoCampeonato ? <img className={estilos.simboloCampeonato} src={cartaz.logoCampeonato} alt="" /> : null}
            <span>{cartaz.campeonato}</span>
          </p>
        ) : null}
      </header>
      <div className={estilos.miolo}>
        {cartaz.tipo === 'ranking' && <Ranking cartaz={cartaz} paleta={paleta} />}
        {cartaz.tipo === 'grupo' && <Grupo cartaz={cartaz} />}
        {cartaz.tipo === 'chave' && <Chave cartaz={cartaz} />}
        {(cartaz.tipo === 'resultado' || cartaz.tipo === 'aovivo') && <Resultado cartaz={cartaz} />}
        {cartaz.tipo === 'jogo' && <Jogo cartaz={cartaz} />}
      </div>
      <footer className={estilos.rodape}>
        <span className={estilos.marca}>
          <img
            className={estilos.simbolo}
            src="/brand/volei-space_simbolo-orbital_transparente.png"
            alt=""
          />
          volei.space
        </span>
      </footer>
    </article>
  )
}

function Ranking({ cartaz, paleta }: { cartaz: Extract<CartazStories, { tipo: 'ranking' }>; paleta: PaletaStories }) {
  const Icone = ICONE[cartaz.fundamento]
  if (cartaz.atletas.length === 0) return <p className={estilos.vazio}>Sem dados ainda</p>
  return (
    <section className={estilos.cartao} aria-label={cartaz.titulo}>
      <header className={estilos.topoRanking}>
        <span className={estilos.icone}><Icone size={48} strokeWidth={1.75} aria-hidden="true" /></span>
        <h2 className={estilos.tituloCartao}>{cartaz.titulo}</h2>
      </header>
      <ol>
        {cartaz.atletas.map((atleta, indice) => (
          <li key={atleta.jogadorId} className={estilos.linhaRanking}>
            <span className={estilos.posto} style={{ color: corMedalha(indice, paleta) }}>{indice + 1}º</span>
            {indice < 3 ? <Medal size={40} color={corMedalha(indice, paleta)} aria-hidden="true" /> : <span />}
            <span>
              <span className={estilos.nome}>{nomeDoAtleta(atleta)}</span>
              <span className={estilos.miudo}><NomeEquipe nome={atleta.equipe} /></span>
            </span>
            <b className={estilos.valor} style={{ color: indice === 0 ? paleta.ouro : paleta.texto }}>{atleta.pontos}</b>
          </li>
        ))}
      </ol>
    </section>
  )
}

function Grupo({ cartaz }: { cartaz: Extract<CartazStories, { tipo: 'grupo' }> }) {
  const grupo = cartaz.grupo
  if (!grupo || grupo.linhas.length === 0) return <p className={estilos.vazio}>Sem dados ainda</p>
  return (
    <section className={estilos.cartao} aria-label={grupo.nome}>
      <header className={estilos.topoRanking}>
        <h2 className={estilos.tituloCartao}>{grupo.nome}</h2>
      </header>
      <table className={estilos.tabela}>
        <caption className="sr-only">Classificação de {grupo.nome}</caption>
        <thead>
          <tr>
            {COLUNAS_GRUPO.map((coluna) => <th key={coluna}>{coluna}</th>)}
          </tr>
        </thead>
        <tbody>
          {grupo.linhas.map((linha, indice) => {
            const numeros = numerosDaLinha(linha)
            const classifica = grupo.vagas > 0 && indice < grupo.vagas
            return (
              <tr key={`${grupo.nome}-${linha.equipe}`}>
                <td className={classifica ? estilos.classifica : undefined}>{indice + 1}</td>
                <td><NomeEquipe nome={linha.equipe} /></td>
                <td>{numeros.pontos}</td>
                <td>{numeros.jogos}</td>
                <td>{numeros.vitorias}</td>
                <td>{numeros.derrotas}</td>
                <td>{numeros.setsPro}</td>
                <td>{numeros.setsContra}</td>
                <td>{saldoComSinal(numeros.saldoSets)}</td>
                <td>{saldoComSinal(numeros.saldoPontos)}</td>
                <td>{numeros.punicoes > 0 ? numeros.punicoes : '—'}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </section>
  )
}

function Chave({ cartaz }: { cartaz: Extract<CartazStories, { tipo: 'chave' }> }) {
  if (cartaz.semis.length === 0 && !cartaz.final && !cartaz.terceiro) return <p className={estilos.vazio}>Sem chave ainda</p>
  return (
    <div className={estilos.chave}>
      {cartaz.semis.length > 0 && (
        <>
          <p className={estilos.rotuloFase}>{cartaz.rotuloSemis}</p>
          <div className={estilos.semis}>
            {cartaz.semis.map((jogo) => (
              <MioloConfronto key={`${jogo.ladoA.nome}-${jogo.ladoB.nome}`} tom="story" tag={jogo.tag} status={jogo.status} ladoA={jogo.ladoA} ladoB={jogo.ladoB} setsPorA={jogo.setsPorA} setsPorB={jogo.setsPorB} parciais={jogo.parciais} vencedor={jogo.vencedor} volta={jogo.volta} />
            ))}
          </div>
        </>
      )}
      {cartaz.final && (
        <MioloConfronto tom="story" ouro tag={cartaz.final.tag || 'Final'} status={cartaz.final.status} ladoA={cartaz.final.ladoA} ladoB={cartaz.final.ladoB} setsPorA={cartaz.final.setsPorA} setsPorB={cartaz.final.setsPorB} parciais={cartaz.final.parciais} vencedor={cartaz.final.vencedor} volta={cartaz.final.volta} />
      )}
      {cartaz.terceiro && (
        <MioloConfronto tom="story" tag="3º lugar" status={cartaz.terceiro.status} ladoA={cartaz.terceiro.ladoA} ladoB={cartaz.terceiro.ladoB} setsPorA={cartaz.terceiro.setsPorA} setsPorB={cartaz.terceiro.setsPorB} parciais={cartaz.terceiro.parciais} vencedor={cartaz.terceiro.vencedor} volta={cartaz.terceiro.volta} />
      )}
    </div>
  )
}

function Resultado({ cartaz }: { cartaz: Extract<CartazStories, { tipo: 'resultado' | 'aovivo' }> }) {
  const jogo = cartaz.resultado
  const aoVivo = cartaz.tipo === 'aovivo'
  const valorA = aoVivo ? jogo.pontosA ?? 0 : jogo.setsPorA
  const valorB = aoVivo ? jogo.pontosB ?? 0 : jogo.setsPorB
  return (
    <div className={estilos.resultado}>
      <p className={estilos.rotuloFase}>{aoVivo ? 'Ao vivo' : 'Fim de jogo'}</p>
      <PlacarJogo
        tom="story"
        ladoA={<NomeEquipe nome={jogo.nomeA} />}
        ladoB={<NomeEquipe nome={jogo.nomeB} />}
        valorA={valorA}
        valorB={valorB}
        centro={aoVivo ? `${jogo.setsPorA} x ${jogo.setsPorB}` : 'sets'}
        destaqueA={jogo.vencedor === jogo.nomeA}
        destaqueB={jogo.vencedor === jogo.nomeB}
      />
      {cartaz.fraseVencedor && <p className={estilos.frase}>{cartaz.fraseVencedor}</p>}
      {jogo.parciais.length > 0 && (
        <ul className={estilos.listaParciais}>
          {jogo.parciais.map((set) => (
            <li key={set.numero} className={estilos.parcial}><span>Set {set.numero}</span><b>{set.pontosA} x {set.pontosB}</b></li>
          ))}
        </ul>
      )}
      {jogo.mvp && <p className={estilos.mvp}>MVP {jogo.mvp}</p>}
      {cartaz.sumula && <SumulaBloco sumula={cartaz.sumula} />}
    </div>
  )
}

function SumulaBloco({ sumula }: { sumula: SumulaCartaz | null }) {
  if (!sumula) return null
  return (
    <div className={estilos.sumula}>
      <p className={estilos.rotuloFase}>Súmula</p>
      {sumula.fundamentos.map((equipe) => (
        <p key={equipe.equipe} className={estilos.parcial}>
          <span className={estilos.nome}>{equipe.equipe}</span>
          <b>{equipe.ataque} · {equipe.bloqueio} · {equipe.saque}</b>
        </p>
      ))}
      {sumula.cartoes.map((cartao, indice) => (
        <p key={`${cartao.tipo}-${indice}`} className={estilos.miudo}>{cartao.tipo}{cartao.nome ? ` · ${cartao.nome}` : ''}</p>
      ))}
    </div>
  )
}

function Jogo({ cartaz }: { cartaz: Extract<CartazStories, { tipo: 'jogo' }> }) {
  const jogo = cartaz.jogo
  const mostraPlacar = jogo.aoVivo || jogo.encerrado
  return (
    <article className={`${estilos.cartao} ${estilos.jogo}`}>
      <header className={estilos.topoJogo}>
        <p className={estilos.rotulo}>{jogo.rotulo}</p>
        <p className={estilos.rotulo}>{jogo.status}</p>
      </header>
      <div className={estilos.tabuleiro}>
        <Time nome={jogo.nomeA} cor={jogo.corA} logo={jogo.logoA} />
        <div className={estilos.caixaPlacar}>
          {mostraPlacar ? (
            <>
              <b className={estilos.placarGrande}>{jogo.setsPorA ?? 0} x {jogo.setsPorB ?? 0}</b>
              {jogo.parciais.length > 0 && (
                <p className={estilos.miudo}>{jogo.parciais.map((set) => `${set.pontosA}-${set.pontosB}`).join(' / ')}</p>
              )}
            </>
          ) : (
            <b className={estilos.placarGrande}>vs</b>
          )}
        </div>
        <Time nome={jogo.nomeB} cor={jogo.corB} logo={jogo.logoB} />
      </div>
      {(jogo.data || jogo.local) && (
        <div className={estilos.meta}>
          {jogo.data && <p>{jogo.data}</p>}
          {jogo.local && <p>{jogo.local}</p>}
        </div>
      )}
    </article>
  )
}

function Time({ nome, cor, logo }: { nome: string; cor: string | null; logo: string | null }) {
  return (
    <div className={estilos.time}>
      {logo ? (
        <img className={estilos.escudo} src={logo} alt="" />
      ) : (
        <span className="team-mark" style={{ width: 84, height: 84, fontSize: 28, ['--team-color' as string]: cor ?? 'var(--story-primaria)' }}>{iniciais(nome) || '–'}</span>
      )}
      <span className={estilos.nome}><NomeEquipe nome={nome} /></span>
    </div>
  )
}

function corMedalha(indice: number, paleta: PaletaStories) {
  const preferidas = indice === 0 ? [paleta.ouro] : indice === 1 ? ['#C9D1DC', paleta.texto] : indice === 2 ? ['#D08C4E', paleta.ouro] : [paleta.textoSuave]
  return preferidas.find((cor) => contraste(paleta.superficie, cor) >= 4.5) ?? paleta.texto
}
