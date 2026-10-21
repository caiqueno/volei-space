// Pagamento por comprovante (R19) no explorar: `valorInscricao` vem de valorInscricaoCentavos / 100 (nulo se não definido;
// 0 só com modo NENHUM e valor explícito 0), e só com a flag PAGAMENTO_COMPROVANTE_ATIVO ligada.
import assert from 'node:assert/strict'
import { instalarSupabaseFalso } from './helpers/fake-supabase'
import { criarBancoEscrita, type LinhaEscrita } from './helpers/fake-supabase-escrita'

process.env.JWT_SECRET = 'segredo-de-teste-explorar-pag-com-32-caracteres'
const banco = instalarSupabaseFalso(require.resolve('../src/lib/supabase-admin'))

const uuid = (n: number) => `${String(n).repeat(8)}-${String(n).repeat(4)}-4${String(n).repeat(3)}-8${String(n).repeat(3)}-${String(n).repeat(12)}`
const CAT = { NAO_DEFINIDO: uuid(1), GRATIS: uuid(2), COBRA: uuid(3), NENHUM_COM_VALOR: uuid(4), COBRA_ZERO: uuid(5), SEM_CONFIG: uuid(6) }
const AGORA = new Date('2026-10-21T12:00:00Z')

function tabelas(): Record<string, LinhaEscrita[]> {
  const cat = (id: string, nome: string) => ({ id, ligaId: 1, codigo: 'FEMININO', nome, ordem: 0, removidaEm: null })
  const cfg = (id: string, extra: Record<string, unknown>) => ({ categoriaCampeonatoId: id, ligaId: 1, genero: 'FEMININO', idadeMinima: null, idadeMaxima: null, ...extra })
  return {
    Liga: [{ id: 1, nome: 'Copa Norte', organizadorId: 'org-1', status: 'ATIVA', simulacao: false, inscricoesAbertas: true, inscricoesAberturaEm: null, inscricoesEncerramentoEm: '2099-01-01T00:00:00Z' }],
    CategoriaCampeonato: [cat(CAT.NAO_DEFINIDO, 'A'), cat(CAT.GRATIS, 'B'), cat(CAT.COBRA, 'C'), cat(CAT.NENHUM_COM_VALOR, 'D'), cat(CAT.COBRA_ZERO, 'E'), cat(CAT.SEM_CONFIG, 'F')],
    CategoriaConfiguracao: [
      cfg(CAT.NAO_DEFINIDO, { pagamentoModo: 'NENHUM', valorInscricaoCentavos: null }),
      cfg(CAT.GRATIS, { pagamentoModo: 'NENHUM', valorInscricaoCentavos: 0 }),
      cfg(CAT.COBRA, { pagamentoModo: 'COMPROVANTE', valorInscricaoCentavos: 12550, pixChave: 'chave-secreta' }),
      cfg(CAT.NENHUM_COM_VALOR, { pagamentoModo: 'NENHUM', valorInscricaoCentavos: 3000 }),
      cfg(CAT.COBRA_ZERO, { pagamentoModo: 'COMPROVANTE', valorInscricaoCentavos: 0 }),
    ],
    RegraElenco: [],
    CandidaturaOrganizador: [{ id: 'org-1', nome: 'Pessoa Um', organizacao: 'Liga Norte' }],
    LigaLocal: [],
    TimeClube: [],
    MembroEquipe: [],
    Inscricao: [],
  }
}

async function main() {
  const { listarCompeticoes } = await import('../src/lib/explorar-competicoes/servico')
  banco.atual = criarBancoEscrita(tabelas())
  const valores = async () => {
    const { itens } = await listarCompeticoes('lider', {}, AGORA)
    return Object.fromEntries(itens.map((i) => [i.categoriaId, i.valorInscricao]))
  }

  delete process.env.PAGAMENTO_COMPROVANTE_ATIVO
  const desligada = await valores()
  assert.ok(Object.values(desligada).every((v) => v === null), 'sem a flag nada muda: sempre nulo')

  process.env.PAGAMENTO_COMPROVANTE_ATIVO = '1'
  const ligada = await valores()
  assert.equal(ligada[CAT.NAO_DEFINIDO], null, 'não definido')
  assert.equal(ligada[CAT.GRATIS], 0, '0 explícito com modo NENHUM = Gratuito')
  assert.equal(ligada[CAT.COBRA], 125.5, 'centavos / 100')
  assert.equal(ligada[CAT.NENHUM_COM_VALOR], 30)
  assert.equal(ligada[CAT.COBRA_ZERO], null, 'cobrança com valor zero nunca vira Gratuito')
  assert.equal(ligada[CAT.SEM_CONFIG], null, 'categoria sem configuração')
  const { itens } = await listarCompeticoes('lider', {}, AGORA)
  assert.ok(!JSON.stringify(itens).includes('chave-secreta'), 'o explorar não leva a chave Pix')

  // Coluna ainda ausente neste banco: segue nulo, sem erro.
  banco.atual = criarBancoEscrita(Object.assign(tabelas(), { CategoriaConfiguracao: tabelas().CategoriaConfiguracao.map((c) => ({ categoriaCampeonatoId: c.categoriaCampeonatoId, ligaId: 1, genero: 'FEMININO' })) }))
  assert.ok(Object.values(await valores()).every((v) => v === null))

  console.log('pagamento-comprovante-explorar: ok')
}

main().catch((erro) => {
  console.error(erro)
  process.exit(1)
})
