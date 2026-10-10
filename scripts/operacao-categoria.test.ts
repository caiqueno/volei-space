import assert from 'node:assert/strict'
import {
  alimentadorUsaVencedorExplicito,
  chaveDaVaga,
  equipePublica,
  faseDaCategoria,
  gruposEncerradosNaCategoria,
  mensagemRpcOperacao,
  montarTabelasPorCategoria,
  podeAvancarDeFase,
  recusaClassificacaoManual,
  vagaOcupadaNaCategoria,
} from '../src/lib/operacao-categoria'

const feminino = '11111111-1111-4111-8111-111111111111'
const masculino = '22222222-2222-4222-8222-222222222222'

assert.notEqual(chaveDaVaga(feminino, 'FINAL', 1), chaveDaVaga(masculino, 'FINAL', 1))
const finais = [
  { categoriaCampeonatoId: feminino, fase: 'FINAL', rodada: 1 },
]
assert.equal(vagaOcupadaNaCategoria(finais, feminino, 'FINAL', 1), true)
assert.equal(vagaOcupadaNaCategoria(finais, masculino, 'FINAL', 1), false, 'a final da outra categoria não ocupa a vaga')

const partidas = [
  { categoriaCampeonatoId: feminino, fase: 'GRUPOS', status: 'ENCERRADA' },
  { categoriaCampeonatoId: masculino, fase: 'GRUPOS', status: 'AGENDADA' },
]
assert.equal(gruposEncerradosNaCategoria(partidas, feminino, 'GRUPOS_MATA_MATA'), true)
assert.equal(gruposEncerradosNaCategoria(partidas, masculino, 'GRUPOS_MATA_MATA'), false)
assert.equal(gruposEncerradosNaCategoria([], feminino, 'MATA_MATA'), true, 'mata-mata puro não espera grupos')
assert.equal(gruposEncerradosNaCategoria([], feminino, 'GRUPOS_MATA_MATA'), false, 'sem jogos de grupo a fase não terminou')

assert.equal(faseDaCategoria({ faseEliminatoria: 'FINAL' }, { faseEliminatoria: 'QUARTAS' }, true), 'FINAL')
assert.equal(faseDaCategoria(null, { faseEliminatoria: 'QUARTAS' }, true), 'NENHUMA')
assert.equal(faseDaCategoria(null, { faseEliminatoria: 'QUARTAS' }, false), 'QUARTAS')

const tabelas = montarTabelasPorCategoria({
  categorias: [
    { id: feminino, nome: 'Feminino' },
    { id: masculino, nome: 'Masculino' },
  ],
  configs: [
    { categoriaCampeonatoId: feminino, formato: 'GRUPOS_MATA_MATA', quantidadeGrupos: 1, classificadosPorGrupo: 2, melhoresClassificadosGerais: 0, faseEliminatoria: 'FINAL' },
    { categoriaCampeonatoId: masculino, formato: 'GRUPOS_MATA_MATA', quantidadeGrupos: 1, classificadosPorGrupo: 1, melhoresClassificadosGerais: 0, faseEliminatoria: 'QUARTAS' },
  ],
  liga: { faseEliminatoria: 'QUARTAS', formato: 'GRUPOS_MATA_MATA', quantidadeGrupos: 1, classificadosPorGrupo: 1, melhoresClassificadosGerais: 0 },
  entradas: [
    {
      categoriaCampeonatoId: feminino,
      equipeId: 1,
      posicao: 1,
      pontos: 3,
      jogos: 1,
      vitorias: 1,
      derrotas: 0,
      setsPro: 2,
      setsContra: 0,
      pontosPro: 50,
      pontosContra: 30,
      punicoes: 0,
      equipe: { id: 1, nome: 'Aurora', corHex: '#fff', logoUrl: null, seedKey: 'segredo', horarios: '{"sabado":"18:00"}', slug: 'aurora', lider: 'Ana' },
    },
    {
      categoriaCampeonatoId: feminino,
      equipeId: 2,
      posicao: 2,
      pontos: 0,
      jogos: 1,
      equipe: { id: 2, nome: 'Bruma', corHex: '#000', logoUrl: '/b.png', seedKey: 'outra' },
    },
    {
      categoriaCampeonatoId: masculino,
      equipeId: 3,
      posicao: 1,
      pontos: 3,
      jogos: 1,
      equipe: { id: 3, nome: 'Cerrado', corHex: '#111', logoUrl: null, horarios: '{"domingo":"09:00"}' },
    },
  ],
  equipesAtivas: [
    { id: 1, nome: 'Aurora', corHex: '#fff', logoUrl: null, categoriaCampeonatoId: feminino },
    { id: 2, nome: 'Bruma', corHex: '#000', logoUrl: '/b.png', categoriaCampeonatoId: feminino },
    { id: 3, nome: 'Cerrado', corHex: '#111', logoUrl: null, categoriaCampeonatoId: masculino },
    { id: 4, nome: 'Dunas', corHex: '#222', logoUrl: null, categoriaCampeonatoId: masculino },
  ],
  partidas,
  grupos: [
    { id: 10, nome: 'Grupo A', classificados: 2, categoriaCampeonatoId: feminino },
    { id: 20, nome: 'Grupo A', classificados: 1, categoriaCampeonatoId: masculino },
  ],
  vinculos: [
    { grupoId: 10, equipeId: 1, posicao: 1, categoriaCampeonatoId: feminino },
    { grupoId: 10, equipeId: 2, posicao: 2, categoriaCampeonatoId: feminino },
    { grupoId: 20, equipeId: 3, posicao: 1, categoriaCampeonatoId: masculino },
    { grupoId: 20, equipeId: 4, posicao: 2, categoriaCampeonatoId: masculino },
  ],
  manuais: [],
})

assert.equal(tabelas.length, 2)
const tabelaFeminina = tabelas[0]
const tabelaMasculina = tabelas[1]
assert.deepEqual(tabelaFeminina.linhas.map((linha) => linha.equipe.id), [1, 2])
assert.deepEqual(tabelaMasculina.linhas.map((linha) => linha.equipe.id), [3, 4], 'a equipe sem jogo entra só na própria categoria')
assert.equal(tabelaFeminina.requiredClassified, 2, 'a fase da categoria manda, não a da liga')
assert.equal(tabelaMasculina.requiredClassified, 8)
assert.equal(tabelaFeminina.groupStageFinished, true)
assert.equal(tabelaMasculina.groupStageFinished, false)
assert.equal(podeAvancarDeFase({
  requiredClassified: tabelaFeminina.requiredClassified,
  classificados: tabelaFeminina.automaticClassifiedIds.length,
  groupStageFinished: tabelaFeminina.groupStageFinished,
}), true)
assert.equal(podeAvancarDeFase({
  requiredClassified: tabelaMasculina.requiredClassified,
  classificados: tabelaMasculina.automaticClassifiedIds.length + tabelaMasculina.manualClassifiedIds.length,
  groupStageFinished: tabelaMasculina.groupStageFinished,
}), false)
assert.deepEqual(tabelaFeminina.groups.map((grupo) => grupo.dados.map((linha) => linha.equipe.nome)), [['Aurora', 'Bruma']])
assert.deepEqual(Object.keys(tabelaFeminina.linhas[0].equipe).sort(), ['corHex', 'id', 'logoUrl', 'nome'])
assert.equal('seedKey' in tabelaFeminina.linhas[0].equipe, false)
assert.equal('horarios' in tabelaMasculina.linhas[0].equipe, false)

const publica = equipePublica({ id: 9, nome: 'Estrela', corHex: '#abc', logoUrl: '/e.png', seedKey: 'x', horarios: '{}', slug: 'estrela', lider: 'Lia', diasDisponiveis: '[]', quadraInfo: '{}' })
assert.deepEqual(publica, { id: 9, nome: 'Estrela', corHex: '#abc', logoUrl: '/e.png' })

assert.equal(recusaClassificacaoManual({
  faseEliminatoria: 'FINAL',
  chaveIniciada: false,
  equipeNaCategoria: false,
  jaClassificada: false,
  classificados: 0,
}), 'A equipe não pertence a esta categoria.')
assert.equal(recusaClassificacaoManual({
  faseEliminatoria: 'FINAL',
  chaveIniciada: true,
  equipeNaCategoria: true,
  jaClassificada: false,
  classificados: 0,
}), 'O chaveamento desta categoria já começou.')
assert.equal(recusaClassificacaoManual({
  faseEliminatoria: 'FINAL',
  chaveIniciada: false,
  equipeNaCategoria: true,
  jaClassificada: false,
  classificados: 2,
}), 'As vagas desta categoria já foram preenchidas.')
assert.equal(recusaClassificacaoManual({
  faseEliminatoria: 'QUARTAS',
  chaveIniciada: false,
  equipeNaCategoria: true,
  jaClassificada: false,
  classificados: 2,
}), '', 'as vagas preenchidas da outra categoria não bloqueiam esta')

assert.equal(alimentadorUsaVencedorExplicito([
  { equipeAId: 1, equipeBId: 2, setsPorA: 0, setsPorB: 0, vencedorId: 1 },
]), true)
assert.equal(mensagemRpcOperacao({ code: 'PGRST202', message: 'Could not find the function public.criar_confronto_categoria in the schema cache' }).motivo, 'ausente')
assert.equal(mensagemRpcOperacao({ message: 'Group stage not finished' }).status, 422)
assert.equal(mensagemRpcOperacao({ code: '23505', message: 'Slot or participant already used' }).status, 409)
assert.equal(mensagemRpcOperacao({ message: 'Teams are not eligible for this slot' }).motivo, 'inelegivel')
assert.match(mensagemRpcOperacao({ message: 'Championship unavailable or unauthorized' }).mensagem, /pagamento/)

console.log('operação por categoria: duas categorias não compartilham tabela, vaga nem fim de grupos')
