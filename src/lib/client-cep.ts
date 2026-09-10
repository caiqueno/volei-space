export type CepAddress = {
  cep: string
  logradouro: string
  bairro: string
  cidade: string
  uf: string
  enderecoCompleto: string
}

const cepCache = new Map<string, CepAddress>()
const cepRequests = new Map<string, Promise<CepAddress>>()

export function normalizeCep(value: string) {
  return value.replace(/\D/g, '').slice(0, 8)
}

export function formatCep(value: string) {
  const digits = normalizeCep(value)
  if (digits.length <= 5) return digits
  return `${digits.slice(0, 5)}-${digits.slice(5)}`
}

export function isValidCep(value: string) {
  return normalizeCep(value).length === 8
}

export async function fetchCepAddress(value: string, timeoutMs = 4500): Promise<CepAddress> {
  const cep = normalizeCep(value)
  if (cep.length !== 8) {
    throw new Error('Informe um CEP com 8 números ou preencha o endereço manualmente.')
  }

  const cached = cepCache.get(cep)
  if (cached) return cached

  const pending = cepRequests.get(cep)
  if (pending) return pending

  const request = lookupCep(cep, timeoutMs).finally(() => cepRequests.delete(cep))
  cepRequests.set(cep, request)
  return request
}

async function lookupCep(cep: string, timeoutMs: number) {
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs)

  try {
    const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`, {
      signal: controller.signal,
      cache: 'force-cache',
    })
    const data = await res.json()

    if (!res.ok || data?.erro) {
      throw new Error('CEP não encontrado. Você pode preencher o endereço manualmente.')
    }

    const address: CepAddress = {
      cep: formatCep(cep),
      logradouro: String(data.logradouro || ''),
      bairro: String(data.bairro || ''),
      cidade: String(data.localidade || ''),
      uf: String(data.uf || ''),
      enderecoCompleto: [data.logradouro, data.bairro, data.localidade && data.uf ? `${data.localidade} - ${data.uf}` : '']
        .filter(Boolean)
        .join(', '),
    }

    cepCache.set(cep, address)
    return address
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('A consulta demorou mais que o esperado. Preencha o endereço manualmente e continue.')
    }
    if (error instanceof Error) throw error
    throw new Error('Não foi possível consultar o CEP agora. Preencha o endereço manualmente.')
  } finally {
    window.clearTimeout(timeout)
  }
}
