import assert from 'node:assert/strict'
import {
  camposAlterados,
  camposParaEspelharNaLiga,
  erroAoConcluirCategoria,
  faseDeGruposEncerrada,
  jogoImpedeEdicaoDaCategoria,
  MENSAGEM_EDICAO_BLOQUEADA,
  partidaRemovivelAoRecriarGrupos,
  motivoBloqueioEdicao,
  proximoEstadoSecoes,
  secoesDependentes,
  statusConfiguracaoDaCategoria,
} from '../src/lib/configuracao-categoria-edicao'

assert.equal(jogoImpedeEdicaoDaCategoria({ status: 'AGENDADA' }), false)
assert.equal(jogoImpedeEdicaoDaCategoria({ status: 'PENDENTE' }), false)
assert.equal(jogoImpedeEdicaoDaCategoria({ status: 'CANCELADA' }), false)
assert.equal(jogoImpedeEdicaoDaCategoria({ status: 'EM_ANDAMENTO' }), true)
assert.equal(jogoImpedeEdicaoDaCategoria({ status: 'ENCERRADA' }), true)
assert.equal(jogoImpedeEdicaoDaCategoria({ status: 'WO' }), true)
assert.equal(jogoImpedeEdicaoDaCategoria({ status: 'AGENDADA', sumulaSubmetidaEm: '2026-10-10T12:00:00.000Z' }), true)
assert.equal(jogoImpedeEdicaoDaCategoria({ status: 'AGENDADA', setsPorA: 0, setsPorB: 0 }), true)
assert.equal(jogoImpedeEdicaoDaCategoria({ status: 'AGENDADA', vencedorId: 4 }), true)
assert.match(MENSAGEM_EDICAO_BLOQUEADA, /jogo em andamento, encerrado ou com súmula/)
assert.match(MENSAGEM_EDICAO_BLOQUEADA, /Equipes inscritas/)

assert.equal(faseDeGruposEncerrada([]), true)
assert.equal(faseDeGruposEncerrada([
  { fase: 'GRUPOS', status: 'ENCERRADA' },
  { fase: 'FINAL', status: 'AGENDADA' },
]), true)
assert.equal(faseDeGruposEncerrada([
  { fase: 'GRUPOS', status: 'ENCERRADA' },
  { fase: 'GERAL', status: 'AGENDADA' },
]), false)
assert.equal(faseDeGruposEncerrada([{ fase: 'GERAL', status: 'CANCELADA' }]), true)
assert.equal(faseDeGruposEncerrada([{ fase: null, status: 'EM_ANDAMENTO' }]), false)

const geral = { id: 1, fase: 'GERAL', status: 'AGENDADA', grupoId: null }
const grupos = { id: 2, fase: 'GRUPOS', status: 'PENDENTE', grupoId: 9 }
const final = { id: 3, fase: 'FINAL', status: 'AGENDADA', grupoId: null }
const iniciada = { id: 4, fase: 'GERAL', status: 'EM_ANDAMENTO', grupoId: null }
const comSumula = { id: 5, fase: 'GERAL', status: 'AGENDADA', sumulaAprovadaEm: '2026-10-10T12:00:00.000Z' }
const semFase = { id: 6, fase: '', status: 'AGENDADA', grupoId: null }

assert.equal(partidaRemovivelAoRecriarGrupos(geral), true)
assert.equal(partidaRemovivelAoRecriarGrupos(grupos), true)
assert.equal(partidaRemovivelAoRecriarGrupos(semFase), true)
assert.equal(partidaRemovivelAoRecriarGrupos(final), false)
assert.equal(partidaRemovivelAoRecriarGrupos(iniciada), false)
assert.equal(partidaRemovivelAoRecriarGrupos(comSumula), false)
assert.equal(partidaRemovivelAoRecriarGrupos({ fase: 'SEMIFINAL', status: 'AGENDADA', grupoId: 3 }), false)

assert.deepEqual(
  secoesDependentes('estrutura', { formato: 'GRUPOS_MATA_MATA', tieBreakUltimoSet: true }),
  ['classificacao', 'eliminatorias', 'calendario', 'inscricoes'],
)
assert.deepEqual(secoesDependentes('estrutura', { tieBreakUltimoSet: true }), ['classificacao', 'eliminatorias'])
assert.deepEqual(secoesDependentes('classificacao', { classificadosPorGrupo: 2 }), ['eliminatorias'])
assert.deepEqual(secoesDependentes('eliminatorias', { faseEliminatoria: 'SEMIFINAL' }), ['classificacao', 'calendario'])
assert.deepEqual(secoesDependentes('eliminatorias', {}), [])
assert.deepEqual(secoesDependentes('eliminatorias', { setsPorPartidaFinal: 5, setsPorPartidaSemifinal: null }), [])
assert.deepEqual(secoesDependentes('eliminatorias', { setsPorPartidaQuartas: 5, setsPorPartidaOitavas: null }), [])
assert.deepEqual(secoesDependentes('eliminatorias', { setsPorPartidaFinal: 5, faseEliminatoria: 'FINAL' }), ['classificacao', 'calendario'])

assert.equal(motivoBloqueioEdicao('eliminatorias', { setsPorPartidaFinal: 5 }, [{ fase: 'GRUPOS', status: 'ENCERRADA' }]), null)
assert.match(motivoBloqueioEdicao('eliminatorias', { setsPorPartidaFinal: 5 }, [{ fase: 'FINAL', status: 'ENCERRADA' }]) ?? '', /final já tem jogo/i)
assert.equal(motivoBloqueioEdicao('eliminatorias', { setsPorPartidaSemifinal: 3 }, [{ fase: 'FINAL', status: 'ENCERRADA' }]), null)
assert.match(motivoBloqueioEdicao('eliminatorias', { setsPorPartidaTerceiroLugar: 3 }, [{ fase: 'TERCEIRO_LUGAR', status: 'EM_ANDAMENTO' }]) ?? '', /3º lugar/)
assert.equal(motivoBloqueioEdicao('eliminatorias', { setsPorPartidaQuartas: 5 }, [{ fase: 'GRUPOS', status: 'ENCERRADA' }]), null)
assert.match(motivoBloqueioEdicao('eliminatorias', { setsPorPartidaQuartas: 5 }, [{ fase: 'QUARTAS', status: 'EM_ANDAMENTO' }]) ?? '', /quartas já tem jogo/i)
assert.equal(motivoBloqueioEdicao('eliminatorias', { setsPorPartidaOitavas: 3 }, [{ fase: 'QUARTAS', status: 'ENCERRADA' }]), null)
assert.equal(motivoBloqueioEdicao('eliminatorias', { faseEliminatoria: 'FINAL' }, [{ fase: 'GRUPOS', status: 'ENCERRADA' }]), MENSAGEM_EDICAO_BLOQUEADA)
assert.equal(motivoBloqueioEdicao('estrutura', { limiteSubstituicoesPorSet: 6 }, [{ fase: 'GRUPOS', status: 'EM_ANDAMENTO' }]), null)
assert.equal(motivoBloqueioEdicao('estrutura', { limiteSubstituicoesPorSet: 6, setsPorPartida: 5 }, [{ fase: 'GRUPOS', status: 'EM_ANDAMENTO' }]), MENSAGEM_EDICAO_BLOQUEADA)
assert.deepEqual(secoesDependentes('estrutura', { limiteSubstituicoesPorSet: 6 }), [])
assert.deepEqual(camposParaEspelharNaLiga({ limiteSubstituicoesPorSet: null }), { limiteSubstituicoesPorSet: null })

assert.deepEqual(camposAlterados({ faseEliminatoria: 'NENHUMA', tieBreakUltimoSet: false }, { faseEliminatoria: 'SEMIFINAL', tieBreakUltimoSet: false }), {
  faseEliminatoria: 'SEMIFINAL',
})
assert.deepEqual(camposAlterados({ criteriosClassificacao: '["PONTOS"]' }, { criteriosClassificacao: ['PONTOS'] }), {})
assert.deepEqual(camposParaEspelharNaLiga({ faseEliminatoria: 'SEMIFINAL', terceiroSetObrigatorio: true, pontosVencedorMargem1: 2 }), {
  faseEliminatoria: 'SEMIFINAL',
})
assert.deepEqual(camposParaEspelharNaLiga({ setsPorPartidaFinal: 5, setsPorPartidaSemifinal: null, pontosVencedorMargem1: 2 }), {
  setsPorPartidaFinal: 5,
  setsPorPartidaSemifinal: null,
})
assert.deepEqual(camposParaEspelharNaLiga({ setsPorPartidaQuartas: 5, setsPorPartidaOitavas: null }), {
  setsPorPartidaQuartas: 5,
  setsPorPartidaOitavas: null,
})
assert.deepEqual(camposParaEspelharNaLiga({
  formularioInscricaoConfig: { atleta: { dataNascimento: 'disabled', documento: 'optional' } },
  terceiroSetObrigatorio: true,
}), {
  formularioInscricaoConfig: { atleta: { dataNascimento: 'disabled', documento: 'optional' } },
})

const secoes = proximoEstadoSecoes({
  secoes: [
    { secao: 'estrutura', status: 'completed', revisaoConfirmada: 3 },
    { secao: 'classificacao', status: 'completed', revisaoConfirmada: 3 },
    { secao: 'eliminatorias', status: 'completed', revisaoConfirmada: 2 },
  ],
  secaoAtual: 'estrutura',
  versaoAnterior: 3,
  versaoNova: 4,
  dependentes: ['classificacao', 'eliminatorias'],
  concluir: true,
})
const porNome = new Map(secoes.map((secao) => [secao.secao, secao]))
assert.equal(porNome.get('estrutura')?.status, 'completed')
assert.equal(porNome.get('estrutura')?.revisaoConfirmada, 4)
assert.equal(porNome.get('classificacao')?.status, 'attention-required')
assert.equal(porNome.get('eliminatorias')?.status, 'attention-required')
assert.equal(statusConfiguracaoDaCategoria('GRUPOS_MATA_MATA', secoes, 4), 'ATENCAO_NECESSARIA')

const completas = ['estrutura', 'classificacao', 'eliminatorias', 'calendario', 'inscricoes'].map((secao) => ({
  secao,
  status: 'completed',
  revisaoConfirmada: 4,
}))
assert.equal(statusConfiguracaoDaCategoria('GRUPOS_MATA_MATA', completas, 4), 'CONCLUIDA')
assert.equal(statusConfiguracaoDaCategoria('MATA_MATA', completas.filter((secao) => secao.secao !== 'classificacao'), 4), 'CONCLUIDA')

assert.equal(erroAoConcluirCategoria('eliminatorias', {
  formato: 'GRUPOS_MATA_MATA',
  faseEliminatoria: 'SEMIFINAL',
  quantidadeGrupos: 2,
  classificadosPorGrupo: 2,
  melhoresClassificadosGerais: 0,
}), null)
assert.match(erroAoConcluirCategoria('eliminatorias', {
  formato: 'PONTOS_CORRIDOS',
  faseEliminatoria: 'FINAL',
}) ?? '', /Pontos corridos/)
assert.match(erroAoConcluirCategoria('estrutura', {
  formato: 'GRUPOS_MATA_MATA',
  quantidadeEquipes: 4,
  quantidadeGrupos: 5,
  faseEliminatoria: 'NENHUMA',
}) ?? '', /grupos/)

console.log('configuracao-categoria-edicao ok')
