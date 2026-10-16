import type { ArmazenamentoFila } from './tipos'

export function criarArmazenamentoMemoria(inicial: Record<string, string> = {}): ArmazenamentoFila & { dados: Map<string, string> } {
  const dados = new Map<string, string>(Object.entries(inicial))
  return {
    dados,
    async carregar(chave) {
      return dados.get(chave) ?? null
    },
    async salvar(chave, valor) {
      dados.set(chave, valor)
    },
    async remover(chave) {
      dados.delete(chave)
    },
  }
}

export function criarArmazenamentoLocalStorage(): ArmazenamentoFila {
  return {
    async carregar(chave) {
      return window.localStorage.getItem(chave)
    },
    async salvar(chave, valor) {
      window.localStorage.setItem(chave, valor)
    },
    async remover(chave) {
      window.localStorage.removeItem(chave)
    },
  }
}

const NOME_BANCO = 'volei-space-sumula'
const NOME_STORE = 'fila'

function abrirBanco(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = window.indexedDB.open(NOME_BANCO, 1)
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(NOME_STORE)) req.result.createObjectStore(NOME_STORE)
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error('indexedDB indisponível'))
    req.onblocked = () => reject(new Error('indexedDB bloqueado'))
  })
}

function pedido<T>(banco: IDBDatabase, modo: IDBTransactionMode, fazer: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const tx = banco.transaction(NOME_STORE, modo)
    const req = fazer(tx.objectStore(NOME_STORE))
    tx.oncomplete = () => resolve(req.result)
    tx.onerror = () => reject(tx.error ?? new Error('falha no indexedDB'))
    tx.onabort = () => reject(tx.error ?? new Error('transação abortada'))
  })
}

/** IndexedDB; se não abrir ou falhar em qualquer operação, cai para localStorage (e, no pior caso, memória). */
export function criarArmazenamentoIndexedDb(): ArmazenamentoFila {
  let banco: Promise<IDBDatabase> | null = null
  const fallback = criarArmazenamentoLocalStorage()
  const memoria = criarArmazenamentoMemoria()

  function obterBanco() {
    if (!banco) banco = abrirBanco()
    return banco
  }

  async function comFallback<T>(idb: (b: IDBDatabase) => Promise<T>, ls: () => Promise<T>, mem: () => Promise<T>): Promise<T> {
    try {
      if (typeof window === 'undefined' || !window.indexedDB) throw new Error('sem indexedDB')
      return await idb(await obterBanco())
    } catch {
      banco = null
      try {
        return await ls()
      } catch {
        return mem()
      }
    }
  }

  return {
    carregar: (chave) =>
      comFallback(
        async (b) => ((await pedido(b, 'readonly', (s) => s.get(chave))) as string | undefined) ?? null,
        () => fallback.carregar(chave),
        () => memoria.carregar(chave)
      ),
    salvar: (chave, valor) =>
      comFallback(
        async (b) => void (await pedido(b, 'readwrite', (s) => s.put(valor, chave))),
        () => fallback.salvar(chave, valor),
        () => memoria.salvar(chave, valor)
      ),
    remover: (chave) =>
      comFallback(
        async (b) => void (await pedido(b, 'readwrite', (s) => s.delete(chave))),
        () => fallback.remover(chave),
        () => memoria.remover(chave)
      ),
  }
}

export function escolherArmazenamento(): ArmazenamentoFila {
  return criarArmazenamentoIndexedDb()
}
