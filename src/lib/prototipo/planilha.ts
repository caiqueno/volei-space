export interface LinhaPlanilha {
  linha: number
  nome: string
  nascimento: string
  camisa: string
  erros: string[]
}

export function ehDataValida(valor: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false
  const d = new Date(`${valor}T00:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === valor
}

/** Menor de 18 anos na data de referência (ambas AAAA-MM-DD). */
export function ehMenor(nascimento: string, hoje: string): boolean {
  if (!ehDataValida(nascimento) || !ehDataValida(hoje)) return false
  const [ny, nm, nd] = nascimento.split('-').map(Number)
  const [hy, hm, hd] = hoje.split('-').map(Number)
  let idade = hy - ny
  if (hm < nm || (hm === nm && hd < nd)) idade -= 1
  return idade < 18
}

export function validarPlanilha(texto: string): LinhaPlanilha[] {
  const dados = texto
    .split(/\r?\n/)
    .filter((l) => l.trim() !== '')
    .slice(1)
  const camisas = new Map<string, number>()
  for (const l of dados) {
    const c = (l.split(';')[2] ?? '').trim()
    if (c) camisas.set(c, (camisas.get(c) ?? 0) + 1)
  }
  return dados.map((l, i) => {
    const [nome = '', nascimento = '', camisa = ''] = l.split(';').map((x) => x.trim())
    const erros: string[] = []
    if (!nome) erros.push('Nome obrigatório')
    if (!ehDataValida(nascimento)) erros.push('Data de nascimento inválida (use AAAA-MM-DD)')
    if (!/^\d{1,2}$/.test(camisa)) erros.push('Número da camisa inválido')
    else if ((camisas.get(camisa) ?? 0) > 1) erros.push('Número da camisa repetido')
    return { linha: i + 2, nome, nascimento, camisa, erros }
  })
}
