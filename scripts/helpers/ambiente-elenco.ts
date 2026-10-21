// Ambiente comum dos testes da rodada 17 (elenco completo): sessão por cookie falso, Supabase falso com Storage
// em memória e uma base pequena (2 organizadores, 2 clubes, 1 inscrição). Chame ANTES de importar as rotas.
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest } from 'next/server'
import { criarBancoEscrita, type LinhaEscrita, type OpcoesEscrita } from './fake-supabase-escrita'

export const IDS = {
  EQ: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  EQ_B: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  CLUBE: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  CLUBE_B: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
  CAT1: '11111111-1111-4111-8111-111111111111',
  CAT2: '22222222-2222-4222-8222-222222222222',
  CAT3: '55555555-5555-4555-8555-555555555555',
  INS1: '33333333-3333-4333-8333-333333333333',
  INS_B: '44444444-4444-4444-8444-444444444444',
  atleta: (n: number) => `a000000${n}-0000-4000-8000-00000000000${n}`,
  atletaB: 'b0000001-0000-4000-8000-000000000001',
}

export type ObjetoStorage = { size: number; contentType: string }

export function criarAmbiente() {
  process.env.JWT_SECRET = 'segredo-de-teste-elenco-com-32-caracteres!'
  process.env.LGPD_CHAVE_CIFRA = Buffer.alloc(32, 7).toString('base64')
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://projeto-teste.supabase.co'
  const sessao: { token: string | null } = { token: null }
  const caminhoHeaders = require.resolve('next/headers')
  require.cache[caminhoHeaders] = {
    id: caminhoHeaders,
    filename: caminhoHeaders,
    loaded: true,
    exports: { cookies: async () => ({ get: () => (sessao.token ? { value: sessao.token } : undefined) }) },
  } as unknown as NodeJS.Module

  const objetos = new Map<string, ObjetoStorage>()
  const removidos: string[] = []
  const assinadosLeitura: Array<{ caminho: string; segundos: number }> = []
  const assinadosEnvio: string[] = []
  const storage = {
    bucketsAusentes: new Set<string>(),
    from(bucket: string) {
      const ausente = () => storage.bucketsAusentes.has(bucket)
      return {
        async createSignedUploadUrl(caminho: string) {
          if (ausente()) return { data: null, error: { message: 'Bucket not found' } }
          assinadosEnvio.push(`${bucket}/${caminho}`)
          return { data: { signedUrl: `https://projeto-teste.supabase.co/storage/v1/object/upload/sign/${bucket}/${caminho}?token=t`, token: 't', path: caminho }, error: null }
        },
        async info(caminho: string) {
          if (ausente()) return { data: null, error: { message: 'Bucket not found' } }
          const objeto = objetos.get(`${bucket}/${caminho}`)
          if (!objeto) return { data: null, error: { message: 'Object not found' } }
          return { data: { size: objeto.size, contentType: objeto.contentType }, error: null }
        },
        async remove(caminhos: string[]) {
          for (const caminho of caminhos) {
            objetos.delete(`${bucket}/${caminho}`)
            removidos.push(`${bucket}/${caminho}`)
          }
          return { data: [], error: null }
        },
        async createSignedUrl(caminho: string, segundos: number) {
          if (ausente()) return { data: null, error: { message: 'Bucket not found' } }
          assinadosLeitura.push({ caminho: `${bucket}/${caminho}`, segundos })
          return { data: { signedUrl: `https://projeto-teste.supabase.co/storage/v1/object/sign/${bucket}/${caminho}?token=leitura` }, error: null }
        },
      }
    },
  }

  const banco: { atual: { from: (nome: string) => any } } = { atual: criarBancoEscrita({}) }
  // Colunas que o "banco" não conhece, também em SELECT (o fake-supabase-escrita só vê escrita): tabela -> colunas.
  const colunasAusentes: Record<string, string[]> = {}
  const cliente = {
    storage,
    from: (nome: string) => {
      const construtor = banco.atual.from(nome)
      let colunas: string[] = []
      const proxy: any = new Proxy(construtor, {
        get(alvo, prop) {
          const valor = alvo[prop]
          if (typeof valor !== 'function') return valor
          return (...args: any[]) => {
            if (prop === 'select' && typeof args[0] === 'string') colunas = args[0].split(',').map((c: string) => c.trim())
            const ausente = (colunasAusentes[nome] ?? []).find((c) => colunas.includes(c))
            if (ausente && (prop === 'maybeSingle' || prop === 'single' || prop === 'then')) {
              const erro = { data: null, error: { code: '42703', message: `column "${ausente}" does not exist` } }
              return prop === 'then' ? Promise.resolve(erro).then(args[0], args[1]) : Promise.resolve(erro)
            }
            const saida = valor.apply(alvo, args)
            return saida === alvo ? proxy : saida
          }
        },
      })
      return proxy
    },
  }
  const caminhoSupabase = require.resolve('../../src/lib/supabase-admin')
  require.cache[caminhoSupabase] = {
    id: caminhoSupabase,
    filename: caminhoSupabase,
    loaded: true,
    exports: { supabaseAdmin: cliente, isSupabaseServiceConfigured: true },
  } as unknown as NodeJS.Module

  function req(metodo: string, caminho: string, corpo?: unknown) {
    return new NextRequest(`http://127.0.0.1:3001${caminho}`, {
      method: metodo,
      headers: { 'content-type': 'application/json', 'x-forwarded-for': '9.9.9.9' },
      body: corpo === undefined ? undefined : JSON.stringify(corpo),
    })
  }
  const json = async (resposta: Response) => (await resposta.json()) as any

  async function entrar(userId: string, tipo: 'equipe' | 'organizador' = 'equipe') {
    const { signPublicToken } = await import('../../src/lib/auth')
    sessao.token = await signPublicToken({ userId, email: `${userId}@volei.space`, nome: userId, tipo, status: 'ATIVO', trocarSenha: false })
  }

  return { sessao, banco, colunasAusentes, storage, objetos, removidos, assinadosLeitura, assinadosEnvio, req, json, entrar }
}

export function tabelasBase(extra: Record<string, LinhaEscrita[] | undefined> = {}): Record<string, LinhaEscrita[]> {
  const atletas: LinhaEscrita[] = []
  const vinculos: LinhaEscrita[] = []
  for (let n = 1; n <= 8; n += 1) {
    atletas.push({ id: IDS.atleta(n), nome: `Atleta ${n}`, dataNascimento: '2000-01-01', sexo: 'F', mescladoParaId: null })
    vinculos.push({ clubeId: IDS.CLUBE, atletaId: IDS.atleta(n), status: 'ATIVO' })
  }
  atletas.push({ id: IDS.atletaB, nome: 'Atleta Alheio', dataNascimento: '2000-01-01', sexo: 'F', mescladoParaId: null })
  vinculos.push({ clubeId: IDS.CLUBE_B, atletaId: IDS.atletaB, status: 'ATIVO' })

  const elenco: LinhaEscrita[] = []
  for (let n = 1; n <= 6; n += 1) {
    elenco.push({ id: `e000000${n}-0000-4000-8000-00000000000${n}`, inscricaoId: IDS.INS1, ligaId: 1, categoriaCampeonatoId: IDS.CAT1, atletaId: IDS.atleta(n), nomeSnapshot: `Atleta ${n}`, numero: n, capitao: n === 1, libero: false, ativo: true, inscricaoAtiva: true, posicao: null })
  }

  const base: Record<string, LinhaEscrita[]> = {
    Clube: [
      { id: IDS.CLUBE, nome: 'Clube A', criadoPor: 'lider', arquivadoEm: null },
      { id: IDS.CLUBE_B, nome: 'Clube B', criadoPor: 'outro', arquivadoEm: null },
    ],
    TimeClube: [
      { id: IDS.EQ, clubeId: IDS.CLUBE, nome: 'Equipe A', cidade: null, naipe: 'FEMININO', escudoUrl: null, arquivadoEm: null },
      { id: IDS.EQ_B, clubeId: IDS.CLUBE_B, nome: 'Equipe B', cidade: null, naipe: 'FEMININO', escudoUrl: null, arquivadoEm: null },
    ],
    MembroEquipe: [
      { timeId: IDS.EQ, usuarioId: 'lider', papel: 'RESPONSAVEL' },
      { timeId: IDS.EQ, usuarioId: 'tec', papel: 'TECNICO' },
      { timeId: IDS.EQ, usuarioId: 'assist', papel: 'ASSISTENTE' },
      { timeId: IDS.EQ_B, usuarioId: 'outro', papel: 'RESPONSAVEL' },
    ],
    Atleta: atletas,
    VinculoAtletaClube: vinculos,
    AtletaConsentimento: [],
    Liga: [
      { id: 1, nome: 'Liga 1', organizadorId: 'org1', status: 'ATIVA' },
      { id: 2, nome: 'Liga 2', organizadorId: 'org2', status: 'ATIVA' },
    ],
    CategoriaCampeonato: [
      { id: IDS.CAT1, ligaId: 1, nome: 'Adulto Feminino', removidaEm: null },
      { id: IDS.CAT2, ligaId: 2, nome: 'Adulto Misto', removidaEm: null },
      { id: IDS.CAT3, ligaId: 1, nome: 'Sub 23', removidaEm: null },
    ],
    RegraElenco: [],
    Inscricao: [
      { id: IDS.INS1, ligaId: 1, categoriaCampeonatoId: IDS.CAT1, timeId: IDS.EQ, status: 'CONFIRMADA', equipeLegadoId: null },
    ],
    InscricaoAtleta: elenco,
    InscricaoComissao: [],
    PedidoTroca: [],
    Notificacao: [],
    Equipe: [],
    Jogador: [],
    CandidaturaEquipe: [],
    ContaPublico: [],
  }
  return { ...base, ...(extra as Record<string, LinhaEscrita[]>) }
}

export const OPCOES_PADRAO: OpcoesEscrita = {
  idsNumericos: ['Equipe', 'Jogador'],
  // Defaults do SQL que o fake não conhece.
  padroes: { InscricaoAtleta: { ativo: true, inscricaoAtiva: true, removidoEm: null } },
}

/** Devolve o banco falso e as tabelas (mutáveis) para o teste conferir o que foi gravado. */
export function bancoComTabelas(extra: Record<string, LinhaEscrita[] | undefined> = {}, opcoes: OpcoesEscrita = {}) {
  const tabelas = tabelasBase(extra)
  return { banco: criarBancoEscrita(tabelas, { ...OPCOES_PADRAO, ...opcoes }), tabelas }
}
