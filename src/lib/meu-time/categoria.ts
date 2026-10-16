// Regras públicas de uma categoria para o assistente de inscrição do Meu Time.
// Só leitura. Não devolve token de convite, financeiro nem dados de outras equipes.
import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { registrationWindowDecision } from '@/lib/team-registration-draft'
import { ErroMeuTime, idValido, lerDados } from '@/lib/meu-time/acesso'
import { paraRegra } from '@/lib/meu-time/inscricao'
import type { Naipe } from '@/lib/meu-time/regras'

export type RegrasDaCategoria = {
  categoriaId: string
  nome: string
  naipe: Naipe
  minimoAtletas: number | null
  maximoAtletas: number | null
  maximoLiberos: number
  maximoComissao: number | null
  anoNascimentoMinimo: number | null
  anoNascimentoMaximo: number | null
  inscricoesAbertas: boolean
}

function ano(data: unknown): number | null {
  const texto = String(data ?? '').slice(0, 4)
  return /^\d{4}$/.test(texto) ? Number(texto) : null
}

function naipeDaCategoria(genero: unknown): Naipe {
  const valor = String(genero ?? '').toUpperCase()
  return valor === 'FEMININO' || valor === 'MASCULINO' ? valor : 'MISTO'
}

export async function lerRegrasDaCategoria(categoriaId: string): Promise<RegrasDaCategoria> {
  const naoEncontrada = () => new ErroMeuTime('Categoria não encontrada.', 404, 'CATEGORIA_NAO_ENCONTRADA')
  if (!idValido(categoriaId)) throw naoEncontrada()
  const categoria = lerDados(
    await supabase.from('CategoriaCampeonato').select('id,ligaId,nome').eq('id', categoriaId).is('removidaEm', null).maybeSingle(),
    'categoria',
  ) as { id: string; ligaId: number; nome: string } | null
  if (!categoria) throw naoEncontrada()

  const [liga, regraLinha, configuracao] = await Promise.all([
    supabase.from('Liga').select('id,status,inscricoesAbertas,inscricoesAberturaEm,inscricoesEncerramentoEm').eq('id', categoria.ligaId).maybeSingle(),
    supabase.from('RegraElenco').select('*').eq('categoriaCampeonatoId', categoria.id).maybeSingle(),
    supabase.from('CategoriaConfiguracao').select('genero').eq('ligaId', categoria.ligaId).eq('categoriaCampeonatoId', categoria.id).maybeSingle(),
  ])
  const ligaDados = lerDados(liga, 'campeonato') as any
  const regra = paraRegra(lerDados(regraLinha, 'regra de elenco'))
  // Configuração de elegibilidade ausente (coluna ou tabela): categoria sem naipe definido, como na inscrição.
  const genero = configuracao.error ? null : (configuracao.data as { genero?: string } | null)?.genero

  return {
    categoriaId: categoria.id,
    nome: categoria.nome,
    naipe: naipeDaCategoria(genero),
    minimoAtletas: regra.atletasMin,
    maximoAtletas: regra.atletasMax,
    maximoLiberos: regra.liberosMax,
    maximoComissao: regra.comissaoMax,
    anoNascimentoMinimo: ano(regra.nascimentoDe),
    anoNascimentoMaximo: ano(regra.nascimentoAte),
    inscricoesAbertas: ligaDados ? registrationWindowDecision(ligaDados).allowed : false,
  }
}
