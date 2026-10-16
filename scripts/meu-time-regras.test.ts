import assert from 'node:assert/strict'
import {
  REGRA_ELENCO_PADRAO,
  dataNascimentoValida,
  inscricaoViva,
  mensagemNaipe,
  resumoProntidao,
  validarInscricao,
  type AtletaDoBanco,
  type ContextoInscricao,
  type RegraElencoDados,
} from '../src/lib/meu-time/regras'
import { prepararLote } from '../src/lib/meu-time/dados'

const HOJE = new Date('2026-10-16T12:00:00Z')

function atleta(id: string, extra: Partial<AtletaDoBanco> = {}): AtletaDoBanco {
  return { id, nome: `Atleta ${id}`, dataNascimento: '2000-05-10', sexo: 'F', temDocumento: true, ...extra }
}

function contexto(atletas: AtletaDoBanco[], regra: Partial<RegraElencoDados> = {}, extra: Partial<ContextoInscricao> = {}): ContextoInscricao {
  return {
    naipeEquipe: 'FEMININO',
    regra: { ...REGRA_ELENCO_PADRAO, ...regra },
    elegibilidade: null,
    banco: new Map(atletas.map((item) => [item.id, item])),
    jaInscritosNaCategoria: new Set(),
    totalComissao: 0,
    hoje: HOJE,
    ...extra,
  }
}

const codigos = (selecao: Parameters<typeof validarInscricao>[0], ctx: ContextoInscricao) =>
  validarInscricao(selecao, ctx).erros.map((erro) => erro.codigo)

// Caminho feliz: confirmada direto, sem pendências.
{
  const ctx = contexto([atleta('a'), atleta('b')])
  const r = validarInscricao([{ atletaId: 'a', numero: 1, capitao: true }, { atletaId: 'b', numero: 2, libero: true }], ctx)
  assert.deepEqual(r.erros, [])
  assert.equal(r.status, 'CONFIRMADA')
  assert.deepEqual(r.avisos, [])
}

// Lista vazia, atleta fora do time e atleta repetido.
assert.deepEqual(codigos([], contexto([])), ['SEM_ATLETAS'])
assert.deepEqual(codigos([{ atletaId: 'x', numero: 1 }], contexto([atleta('a')])), ['ATLETA_FORA_DO_TIME'])
assert.deepEqual(codigos([{ atletaId: 'a', numero: 1 }, { atletaId: 'a', numero: 2 }], contexto([atleta('a')])), ['ATLETA_REPETIDO'])

// Número único, dentro de 0 a 99.
assert.deepEqual(codigos([{ atletaId: 'a', numero: 7 }, { atletaId: 'b', numero: 7 }], contexto([atleta('a'), atleta('b')])), ['NUMERO_REPETIDO'])
assert.deepEqual(codigos([{ atletaId: 'a', numero: 100 }], contexto([atleta('a')])), ['NUMERO_INVALIDO'])
assert.deepEqual(codigos([{ atletaId: 'a', numero: -1 }], contexto([atleta('a')])), ['NUMERO_INVALIDO'])
assert.deepEqual(codigos([{ atletaId: 'a', numero: 0 }], contexto([atleta('a')])), [], 'camisa 0 é válida')

// No máximo 1 capitão; capitão não é líbero.
assert.ok(codigos([{ atletaId: 'a', numero: 1, capitao: true }, { atletaId: 'b', numero: 2, capitao: true }], contexto([atleta('a'), atleta('b')])).includes('MAIS_DE_UM_CAPITAO'))
assert.deepEqual(codigos([{ atletaId: 'a', numero: 1, capitao: true, libero: true }], contexto([atleta('a')])), ['CAPITAO_LIBERO'])

// Líberos até o máximo da RegraElenco (padrão 2; 0 proíbe).
{
  const tres = [atleta('a'), atleta('b'), atleta('c')]
  const sel = [{ atletaId: 'a', numero: 1, libero: true }, { atletaId: 'b', numero: 2, libero: true }, { atletaId: 'c', numero: 3, libero: true }]
  assert.deepEqual(codigos(sel, contexto(tres)), ['LIBEROS_ACIMA'])
  assert.deepEqual(codigos(sel.slice(0, 2), contexto(tres)), [])
  assert.deepEqual(codigos(sel.slice(0, 1), contexto(tres, { liberosMax: 0 })), ['LIBEROS_ACIMA'])
}

// Mínimo e máximo de atletas.
{
  const quatro = ['a', 'b', 'c', 'd'].map((id) => atleta(id))
  const sel = quatro.map((item, i) => ({ atletaId: item.id, numero: i + 1 }))
  const abaixo = validarInscricao(sel.slice(0, 2), contexto(quatro, { atletasMin: 6 }))
  assert.deepEqual(abaixo.erros.map((e) => e.codigo), ['ABAIXO_DO_MINIMO'])
  assert.match(abaixo.erros[0].mensagem, /Faltam 4 atletas para chegar ao mínimo de 6/)
  const acima = validarInscricao(sel, contexto(quatro, { atletasMax: 3 }))
  assert.deepEqual(acima.erros.map((e) => e.codigo), ['ACIMA_DO_MAXIMO'])
  assert.match(acima.erros[0].mensagem, /Remova 1 atleta: o máximo é 3/)
  assert.deepEqual(codigos(sel, contexto(quatro, { atletasMin: 4, atletasMax: 4 })), [])
}

// Faixa de nascimento da RegraElenco e idade/gênero da categoria.
{
  const velho = atleta('a', { dataNascimento: '1990-01-01' })
  const ok = atleta('b', { dataNascimento: '2010-01-01' })
  const ctx = contexto([velho, ok], { nascimentoDe: '2008-01-01' })
  const r = validarInscricao([{ atletaId: 'a', numero: 1 }, { atletaId: 'b', numero: 2 }], ctx)
  assert.deepEqual(r.erros.map((e) => e.codigo), ['FORA_DA_IDADE'])
  assert.equal(r.erros[0].atletaId, 'a')
  assert.match(r.erros[0].mensagem, /nasceu antes de 01\/01\/2008/)

  const comIdade = contexto([atleta('c', { dataNascimento: '2000-01-01' })], {}, { elegibilidade: { genero: null, idadeMinima: null, idadeMaxima: 17 } })
  assert.deepEqual(codigos([{ atletaId: 'c', numero: 1 }], comIdade), ['FORA_DA_IDADE'])

  const sexo = contexto([atleta('d', { sexo: 'M' })], {}, { elegibilidade: { genero: 'FEMININO', idadeMinima: null, idadeMaxima: null } })
  assert.deepEqual(codigos([{ atletaId: 'd', numero: 1 }], sexo), ['NAIPE_INCOMPATIVEL'])
}

// Naipe da equipe contra o gênero da categoria.
assert.equal(mensagemNaipe('FEMININO', 'FEMININO'), null)
assert.equal(mensagemNaipe('FEMININO', 'MISTO'), null)
assert.equal(mensagemNaipe('MASCULINO', null), null)
assert.match(mensagemNaipe('MASCULINO', 'FEMININO') ?? '', /categoria é feminino/)
assert.match(mensagemNaipe('MISTO', 'MASCULINO') ?? '', /categoria é masculino/)

// Atleta em um só time por categoria.
assert.deepEqual(
  codigos([{ atletaId: 'a', numero: 1 }], contexto([atleta('a')], {}, { jaInscritosNaCategoria: new Set(['a']) })),
  ['ATLETA_EM_OUTRO_TIME'],
)

// Comissão acima do limite.
assert.deepEqual(codigos([{ atletaId: 'a', numero: 1 }], contexto([atleta('a')], { comissaoMax: 1 }, { totalComissao: 2 })), ['COMISSAO_ACIMA'])

// Falta de documento: com documento exigido vira CONFIRMADA_COM_PENDENCIAS, nunca fila de aprovação.
{
  const sem = atleta('a', { temDocumento: false })
  const exigido = validarInscricao([{ atletaId: 'a', numero: 1 }], contexto([sem], { documentosExigidos: ['CPF'] }))
  assert.deepEqual(exigido.erros, [])
  assert.equal(exigido.status, 'CONFIRMADA_COM_PENDENCIAS')
  assert.match(exigido.pendencias[0], /falta o documento/)
  const naoExigido = validarInscricao([{ atletaId: 'a', numero: 1 }], contexto([sem]))
  assert.equal(naoExigido.status, 'CONFIRMADA')
  // Sem nascimento e com faixa de idade: pendência, não erro.
  const semData = atleta('b', { dataNascimento: null })
  const r = validarInscricao([{ atletaId: 'b', numero: 1 }], contexto([semData], { nascimentoDe: '2008-01-01' }))
  assert.deepEqual(r.erros, [])
  assert.equal(r.status, 'CONFIRMADA_COM_PENDENCIAS')
}

// Status: REMOVIDA libera o atleta e a vaga; os demais prendem.
assert.equal(inscricaoViva('REMOVIDA'), false)
for (const status of ['RASCUNHO', 'CONFIRMADA', 'CONFIRMADA_COM_PENDENCIAS', 'AJUSTE_PEDIDO']) assert.equal(inscricaoViva(status), true)

// Data de nascimento.
assert.equal(dataNascimentoValida('2000-02-29', HOJE), true)
assert.equal(dataNascimentoValida('2001-02-29', HOJE), false)
assert.equal(dataNascimentoValida('1919-12-31', HOJE), false)
assert.equal(dataNascimentoValida('2027-01-01', HOJE), false)
assert.equal(dataNascimentoValida('10/05/2000', HOJE), false)

// Prontidão.
assert.equal(resumoProntidao([]).mensagem, 'Seu time ainda não tem atletas. Adicione os primeiros para se inscrever.')
{
  const lista = [...Array(7).fill({ temDocumento: true }), { temDocumento: false }, { temDocumento: false }]
  assert.deepEqual(resumoProntidao(lista), { atletas: 9, semDocumento: 2, mensagem: 'Seu time tem 9 atletas. 2 estão sem documento.' })
  assert.equal(resumoProntidao([{ temDocumento: false }]).mensagem, 'Seu time tem 1 atleta. 1 está sem documento.')
  assert.equal(resumoProntidao([{ temDocumento: true }]).mensagem, 'Seu time tem 1 atleta. Tudo certo.')
}

// Lote: reaproveita o parser da inscrição rápida e ignora repetidos e linhas ruins.
{
  const colado = prepararLote({ texto: 'Maria Souza, 10\n10 - Ana Lima\n#7 Bia Costa\n\nx\nMaria Souza' }, [{ nome: 'ana lima' }])
  assert.deepEqual(colado.novos.map((n) => n.nome), ['Maria Souza', 'Bia Costa'])
  const motivos = colado.ignorados.map((i) => i.motivo)
  assert.ok(motivos.includes('Já está no banco do time'))
  assert.ok(motivos.includes('Sem nome reconhecível'))

  const lista = prepararLote({ atletas: [{ nome: 'Carla Dias', numero: 5 }, { nome: '  ', numero: 1 }, { nome: 'Dani Reis', numero: 150 }, { nome: 'CARLA  dias' }] }, [])
  assert.deepEqual(lista.novos.map((n) => n.nome), ['Carla Dias'])
  assert.deepEqual(lista.ignorados.map((i) => i.linha), [2, 3, 4])

  // B6: com texto e atletas juntos a numeração não se repete; a linha do texto é a linha colada.
  const junto = prepararLote({ texto: 'Ana Lima\n\nx\nAna Lima', atletas: [{ nome: '  ' }, { nome: 'Bia Costa', numero: 150 }] }, [])
  assert.deepEqual(junto.novos.map((n) => ({ nome: n.nome, linha: n.linha })), [{ nome: 'Ana Lima', linha: 1 }])
  assert.deepEqual(junto.ignorados.map((i) => i.linha), [3, 4, 5, 6], 'texto 3 e 4, atletas 5 e 6')
  assert.equal(new Set(junto.ignorados.map((i) => i.linha)).size, junto.ignorados.length)
  const colado2 = prepararLote({ texto: '\n\nCarla Dias' }, [])
  assert.equal(colado2.novos[0].linha, 3, 'linha colada, não a posição do candidato')

  // Homônimos: datas diferentes entram; mesma data ou data ausente de um lado repete.
  const homonimos = prepararLote(
    { atletas: [{ nome: 'Lia Nunes', dataNascimento: '2001-01-01' }, { nome: 'Lia Nunes', dataNascimento: '2002-02-02' }, { nome: 'Lia Nunes', dataNascimento: '2002-02-02' }, { nome: 'Lia Nunes' }] },
    [{ nome: 'Lia Nunes', dataNascimento: '2000-05-05T00:00:00Z' }],
  )
  assert.deepEqual(homonimos.novos.map((n) => n.dataNascimento), ['2001-01-01', '2002-02-02'])
  assert.deepEqual(homonimos.ignorados.map((i) => i.linha), [3, 4])
}

console.log('meu-time-regras: ok')
