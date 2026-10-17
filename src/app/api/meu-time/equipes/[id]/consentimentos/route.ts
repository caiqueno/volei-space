import { rotaMeuTime, sucesso } from '@/lib/meu-time/acesso'
import { exigirEquipe, listarAtletasDoClube } from '@/lib/meu-time/dados'
import { consentimentosAtivos, paraEstado } from '@/lib/lgpd/consentimento'
import { ehMenorDeIdade } from '@/lib/lgpd/idade'
import { TERMO_TEXTO_RASCUNHO, TERMO_VERSAO } from '@/lib/lgpd/termo'

export const dynamic = 'force-dynamic'

// GET /api/meu-time/equipes/:id/consentimentos: atletas menores do banco do time e o estado da autorização do
// responsável. Só RESPONSAVEL e TECNICO. NUNCA devolve o contato do responsável.
export const GET = rotaMeuTime<{ id: string }>(async ({ usuarioId, params }) => {
  const { equipe } = await exigirEquipe(usuarioId, params.id, 'escrita')
  const menores = (await listarAtletasDoClube(equipe.clubeId)).filter((linha) => ehMenorDeIdade(linha.dataNascimento))
  const ativos = await consentimentosAtivos(menores.map((linha) => linha.id as string))
  const atletas = menores.map((linha) => ({
    nome: linha.nome as string,
    dataNascimento: String(linha.dataNascimento).slice(0, 10),
    ...paraEstado(linha.id, ativos.get(linha.id)),
  }))
  return sucesso({
    termo: { versao: TERMO_VERSAO, texto: TERMO_TEXTO_RASCUNHO },
    totalMenores: atletas.length,
    pendentes: atletas.filter((item) => item.estado === 'PENDENTE').length,
    atletas,
  })
})
