import assert from 'node:assert/strict'
import { IDS, bancoComTabelas, criarAmbiente } from './helpers/ambiente-elenco'

const amb = criarAmbiente()
const { req, json, entrar } = amb

async function main() {
  const modelosRota = await import('../src/app/api/regras-elenco/modelos/route')
  const regraRota = await import('../src/app/api/organizador/categorias/[id]/regra-elenco/route')
  const inscricaoRota = await import('../src/app/api/meu-time/equipes/[id]/inscricoes/route')
  const { reiniciarCotas } = await import('../src/lib/rate-limit')
  const { validarInscricao, REGRA_ELENCO_PADRAO } = await import('../src/lib/meu-time/regras')

  const modelos = () => modelosRota.GET(req('GET', '/api/regras-elenco/modelos'))
  const getRegra = (id: string) => regraRota.GET(req('GET', `/api/organizador/categorias/${id}/regra-elenco`), { params: { id } })
  const putRegra = (id: string, corpo: unknown) => regraRota.PUT(req('PUT', `/api/organizador/categorias/${id}/regra-elenco`, corpo), { params: { id } })
  const inscrever = (corpo: unknown) => inscricaoRota.POST(req('POST', `/api/meu-time/equipes/${IDS.EQ}/inscricoes`, corpo), { params: { id: IDS.EQ } })

  process.env.MEU_TIME_ATIVO = '1'
  process.env.ELENCO_COMPLETO_ATIVO = '1'
  let ambiente = bancoComTabelas()
  amb.banco.atual = ambiente.banco

  // --- Modelos --------------------------------------------------------------------------
  await entrar('org1', 'organizador')
  reiniciarCotas()
  let r = await modelos()
  assert.equal(r.status, 200)
  let corpo = await json(r)
  assert.deepEqual(corpo.data.modelos.map((m: any) => m.modelo), ['FIVB', 'CBV', 'AMADOR_LIVRE', 'PERSONALIZADO'])
  const fivb = corpo.data.modelos[0]
  assert.equal(fivb.valores.atletasMax, 14)
  assert.equal(fivb.fontes.atletasMax, 'V')
  assert.equal(fivb.fontes.atletasMin, 'M')
  assert.ok(fivb.naoConfirmados.includes('atletasMin') && fivb.naoConfirmados.includes('documentosExigidos'), 'campos sem fonte marcados [M]')
  assert.ok(!fivb.naoConfirmados.includes('atletasMax'))
  assert.equal(corpo.data.modelos[1].valores.atletasMax, 12)
  assert.equal(corpo.data.modelos[2].valores.atletasMax, null)
  assert.ok(corpo.data.legenda.M.includes('Não confirmado'))
  await entrar('lider')
  assert.equal((await modelos()).status, 401, 'líder não usa a rota do organizador')
  await entrar('org1', 'organizador')
  delete process.env.ELENCO_COMPLETO_ATIVO
  assert.equal((await modelos()).status, 404, 'flag desligada = 404')
  assert.equal((await getRegra(IDS.CAT1)).status, 404)
  assert.equal((await putRegra(IDS.CAT1, { modelo: 'FIVB' })).status, 404)
  process.env.ELENCO_COMPLETO_ATIVO = '1'

  // --- GET/PUT da regra -------------------------------------------------------------------
  r = await getRegra(IDS.CAT1)
  assert.equal(r.status, 200)
  corpo = await json(r)
  assert.equal(corpo.data.configurada, false)
  assert.equal(corpo.data.atletasMax, null)

  r = await putRegra(IDS.CAT1, { modelo: 'FIVB' })
  assert.equal(r.status, 200)
  corpo = await json(r)
  assert.equal(corpo.data.configurada, true)
  assert.equal(corpo.data.modelo, 'FIVB')
  assert.equal(corpo.data.atletasMax, 14, 'omitido assume o padrão do modelo')
  assert.equal(corpo.data.liberosMax, 2)
  assert.equal(corpo.data.comissaoMax, 5)
  assert.equal(ambiente.tabelas.RegraElenco.length, 1)
  assert.equal(ambiente.tabelas.RegraElenco[0].ligaId, 1)

  r = await putRegra(IDS.CAT1, {
    modelo: 'PERSONALIZADO', atletasMin: 6, atletasMax: 10, liberosMax: 1, nascimentoDe: '2001-01-01', nascimentoAte: '2010-12-31',
    documentosExigidos: ['FOTO', 'CPF', 'FOTO'], comissaoMax: 3, prazoTrocaEm: '2030-01-01T12:00:00Z', exigeConsentimentoMenor: false,
  })
  assert.equal(r.status, 200)
  corpo = await json(r)
  assert.deepEqual(corpo.data.documentosExigidos, ['FOTO', 'CPF'], 'sem repetidos')
  assert.equal(corpo.data.exigeConsentimentoMenor, false)
  assert.equal(corpo.data.prazoTrocaEm, '2030-01-01T12:00:00Z')
  assert.equal(ambiente.tabelas.RegraElenco.length, 1, 'atualiza a mesma linha')
  assert.equal((await json(await getRegra(IDS.CAT1))).data.atletasMax, 10)

  // null limpa o limite.
  corpo = await json(await putRegra(IDS.CAT1, { modelo: 'FIVB', atletasMax: null, comissaoMax: null }))
  assert.equal(corpo.data.atletasMax, null)
  assert.equal(corpo.data.comissaoMax, null)

  // Validações.
  assert.equal((await putRegra(IDS.CAT1, { modelo: 'FIVB', atletasMin: 10, atletasMax: 8 })).status, 422)
  assert.equal((await putRegra(IDS.CAT1, { modelo: 'X' })).status, 422)
  assert.equal((await putRegra(IDS.CAT1, { modelo: 'CBV', liberosMax: 7 })).status, 422)
  assert.equal((await putRegra(IDS.CAT1, { modelo: 'CBV', atletasMax: 0 })).status, 422)
  assert.equal((await putRegra(IDS.CAT1, { modelo: 'CBV', documentosExigidos: ['RG'] })).status, 422)
  assert.equal((await putRegra(IDS.CAT1, { modelo: 'CBV', nascimentoDe: '2001-02-31' })).status, 422)
  assert.equal((await putRegra(IDS.CAT1, { modelo: 'CBV', nascimentoDe: '2010-01-01', nascimentoAte: '2001-01-01' })).status, 422)
  assert.equal((await putRegra(IDS.CAT1, { modelo: 'CBV', prazoTrocaEm: 'amanhã' })).status, 422)

  // Isolamento entre organizadores (IDOR = 404) e categoria inexistente.
  await entrar('org2', 'organizador')
  assert.equal((await getRegra(IDS.CAT1)).status, 404)
  assert.equal((await putRegra(IDS.CAT1, { modelo: 'FIVB' })).status, 404)
  assert.equal((await getRegra('lixo')).status, 404)
  assert.equal((await putRegra('99999999-9999-4999-8999-999999999999', { modelo: 'FIVB' })).status, 404)
  assert.equal((await putRegra(IDS.CAT2, { modelo: 'CBV' })).status, 200, 'cada um mexe nas suas')
  assert.equal(ambiente.tabelas.RegraElenco.length, 2)
  await entrar('lider')
  assert.equal((await getRegra(IDS.CAT1)).status, 401)

  // Campeonato finalizado = 409 na escrita; leitura segue.
  await entrar('org1', 'organizador')
  ambiente.tabelas.Liga.find((l) => l.id === 1)!.status = 'FINALIZADO'
  r = await putRegra(IDS.CAT1, { modelo: 'FIVB' })
  assert.equal(r.status, 409)
  assert.equal((await json(r)).codigo, 'CAMPEONATO_FINALIZADO')
  assert.equal((await getRegra(IDS.CAT1)).status, 200)
  ambiente.tabelas.Liga.find((l) => l.id === 1)!.status = 'ATIVA'

  // Tabela ausente = 503.
  amb.banco.atual = bancoComTabelas({ RegraElenco: undefined }).banco
  r = await putRegra(IDS.CAT1, { modelo: 'FIVB' })
  assert.equal(r.status, 503)
  assert.equal((await json(r)).error, 'Recurso ainda não habilitado neste ambiente.')

  // --- A inscrição valida contra a regra, no servidor ---------------------------------------
  const lista = (n: number) => Array.from({ length: n }, (_, i) => ({ atletaId: IDS.atleta(i + 1), numero: i + 1 }))
  const regraCat3 = (extra: Record<string, unknown>) => ({ categoriaCampeonatoId: IDS.CAT3, ligaId: 1, liberosMax: 2, documentosExigidos: [], ...extra })
  const novoCenario = (regra: Record<string, unknown> | null, extra: Record<string, any> = {}) => {
    ambiente = bancoComTabelas({ RegraElenco: regra ? [regraCat3(regra)] : [], ...extra })
    amb.banco.atual = ambiente.banco
    return ambiente
  }
  await entrar('lider')
  reiniciarCotas()

  // Abaixo do mínimo: mensagem com o motivo.
  novoCenario({ atletasMin: 6, atletasMax: 8 })
  r = await inscrever({ categoriaCampeonatoId: IDS.CAT3, atletas: lista(3) })
  assert.equal(r.status, 422)
  corpo = await json(r)
  assert.equal(corpo.codigo, 'ABAIXO_DO_MINIMO')
  assert.match(corpo.error, /Faltam 3 atletas para chegar ao mínimo de 6/)
  assert.equal(ambiente.tabelas.Inscricao.filter((l) => l.categoriaCampeonatoId === IDS.CAT3).length, 0)

  // Acima do máximo.
  novoCenario({ atletasMin: 2, atletasMax: 4 })
  r = await inscrever({ categoriaCampeonatoId: IDS.CAT3, atletas: lista(6) })
  assert.equal(r.status, 422)
  assert.match((await json(r)).error, /Remova 2 atletas: o máximo é 4/)

  // Faixa de nascimento.
  novoCenario({ nascimentoDe: '2001-01-01' })
  r = await inscrever({ categoriaCampeonatoId: IDS.CAT3, atletas: lista(2) })
  assert.equal(r.status, 422)
  assert.equal((await json(r)).codigo, 'FORA_DA_IDADE')

  // Líbero acima do permitido.
  novoCenario({ liberosMax: 1 })
  r = await inscrever({ categoriaCampeonatoId: IDS.CAT3, atletas: [{ atletaId: IDS.atleta(1), numero: 1, libero: true }, { atletaId: IDS.atleta(2), numero: 2, libero: true }] })
  assert.equal(r.status, 422)
  assert.equal((await json(r)).codigo, 'LIBEROS_ACIMA')

  // Rascunho não é impedido pelas regras de quantidade e idade; vira RASCUNHO com os motivos como pendência.
  novoCenario({ atletasMin: 6, atletasMax: 8, nascimentoDe: '2001-01-01' })
  r = await inscrever({ categoriaCampeonatoId: IDS.CAT3, atletas: lista(3), rascunho: true })
  assert.equal(r.status, 201)
  corpo = await json(r)
  assert.equal(corpo.data.status, 'RASCUNHO')
  assert.ok(corpo.avisos.some((a: string) => /Faltam 3 atletas/.test(a)), 'o motivo aparece nos avisos')
  assert.ok(corpo.avisos.some((a: string) => /nasceu antes de 01\/01\/2001/.test(a)))
  assert.equal(ambiente.tabelas.Equipe.length, 0, 'rascunho não cria equipe de jogo')
  // Mesmo em rascunho, erro de integridade bloqueia (atleta que não é do time).
  novoCenario({ atletasMin: 6 })
  r = await inscrever({ categoriaCampeonatoId: IDS.CAT3, atletas: [{ atletaId: IDS.atletaB, numero: 1 }], rascunho: true })
  assert.equal(r.status, 422)
  assert.equal((await json(r)).codigo, 'ATLETA_FORA_DO_TIME')
  // Flag desligada: rascunho é ignorado (a regra bloqueia como sempre).
  delete process.env.ELENCO_COMPLETO_ATIVO
  novoCenario({ atletasMin: 6 })
  r = await inscrever({ categoriaCampeonatoId: IDS.CAT3, atletas: lista(3), rascunho: true })
  assert.equal(r.status, 422)
  process.env.ELENCO_COMPLETO_ATIVO = '1'

  // Documentos exigidos: pendência com o nome do item faltando (não bloqueia), some quando o item existe.
  novoCenario({ documentosExigidos: ['FOTO', 'CPF', 'DOCUMENTO'] })
  r = await inscrever({ categoriaCampeonatoId: IDS.CAT3, atletas: lista(2) })
  assert.equal(r.status, 201)
  corpo = await json(r)
  assert.equal(corpo.data.status, 'CONFIRMADA_COM_PENDENCIAS')
  for (const falta of [/Atleta 1: falta a foto de rosto/, /Atleta 1: falta o CPF/, /Atleta 1: falta o documento\./]) {
    assert.ok(corpo.avisos.some((a: string) => falta.test(a)), String(falta))
  }
  ambiente = novoCenario({ documentosExigidos: ['FOTO', 'CPF'] })
  for (const n of [1, 2]) {
    const a = ambiente.tabelas.Atleta.find((l) => l.id === IDS.atleta(n))!
    a.fotoRostoPath = `${a.id}/f.jpg`
    a.cpfHash = `hash${n}`
  }
  r = await inscrever({ categoriaCampeonatoId: IDS.CAT3, atletas: lista(2) })
  assert.equal(r.status, 201)
  assert.equal((await json(r)).data.status, 'CONFIRMADA', 'regra cumprida = sem pendência')

  // Sem regra gravada a categoria não impõe limites (comportamento anterior).
  novoCenario(null)
  assert.equal((await inscrever({ categoriaCampeonatoId: IDS.CAT3, atletas: lista(1) })).status, 201)

  // Função pura: exigeConsentimentoMenor=false não gera pendência de autorização do responsável.
  const menor = { id: 'm', nome: 'Menor', dataNascimento: '2015-01-01', sexo: 'F', temDocumento: true, consentimentoPendente: true }
  const contexto = (exige: boolean) => ({
    naipeEquipe: 'FEMININO' as const,
    regra: { ...REGRA_ELENCO_PADRAO, exigeConsentimentoMenor: exige },
    elegibilidade: null,
    banco: new Map([['m', menor]]),
    jaInscritosNaCategoria: new Set<string>(),
    totalComissao: 0,
  })
  assert.equal(validarInscricao([{ atletaId: 'm', numero: 1 }], contexto(true)).status, 'CONFIRMADA_COM_PENDENCIAS')
  assert.equal(validarInscricao([{ atletaId: 'm', numero: 1 }], contexto(false)).status, 'CONFIRMADA')

  console.log('elenco-regras: ok')
}

main().catch((erro) => {
  console.error(erro)
  process.exit(1)
})
