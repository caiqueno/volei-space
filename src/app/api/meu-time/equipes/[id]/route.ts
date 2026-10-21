import { lerCorpo, rotaMeuTime, sucesso, validar } from '@/lib/meu-time/acesso'
import { exigirEquipe, editarEquipe, listarAtletasPublicos, listarComissaoTolerante, listarMembros } from '@/lib/meu-time/dados'
import { elencoCompletoAtivo } from '@/lib/meu-time/elenco'
import { listarInscricoesDaEquipe } from '@/lib/meu-time/inscricao'
import { resumoProntidao } from '@/lib/meu-time/regras'
import { CAMPOS_DADOS_TIME, editarEquipeElencoSchema, editarEquipeSchema } from '@/lib/meu-time/schemas'
import { conferirColunasDoTime, gravarDadosDoTime, lerDadosDoTime, temCamposDoTime } from '@/lib/meu-time/time-dados'
import { documentosExigidosDaEquipe } from '@/lib/regras-elenco/servico'

export const dynamic = 'force-dynamic'

type Params = { id: string }

// GET /api/meu-time/equipes/:id: detalhe da equipe (só para quem é membro dela). `comissao` = comissão técnica; `membros` = contas com acesso.
// Com ELENCO_COMPLETO_ATIVO=1 acrescenta `dadosDoTime` (cnpj, contato com telefone mascarado, cores) e a prontidão conforme a regra de elenco.
export const GET = rotaMeuTime<Params>(async ({ usuarioId, params }) => {
  const { equipe, papel } = await exigirEquipe(usuarioId, params.id, 'leitura')
  const elenco = elencoCompletoAtivo()
  const [atletas, comissao, membros, inscricoes, dadosDoTime, exigidos] = await Promise.all([
    listarAtletasPublicos(equipe.clubeId),
    listarComissaoTolerante(equipe.id),
    listarMembros(equipe.id),
    listarInscricoesDaEquipe(equipe.id),
    elenco ? lerDadosDoTime(equipe.id) : Promise.resolve(null),
    elenco ? documentosExigidosDaEquipe(equipe.id) : Promise.resolve(undefined),
  ])
  return sucesso({
    equipe: { id: equipe.id, nome: equipe.nome, cidade: equipe.cidade, naipe: equipe.naipe, escudoUrl: equipe.escudoUrl },
    // Papel de quem está logado nesta equipe: a tela usa para mostrar ou esconder botões de gestão.
    meuPapel: papel,
    atletas,
    comissao,
    membros,
    inscricoes,
    prontidao: resumoProntidao(atletas, { exigidos }),
    ...(dadosDoTime ? { dadosDoTime } : {}),
  })
})

// PATCH {nome?, cidade?, escudoUrl?}: aba "Dados do time". Só o responsável; naipe não muda.
// Com ELENCO_COMPLETO_ATIVO=1 aceita também {cnpj?, contatoEmail?, contatoTelefone?, corPrimaria?, corSecundaria?}: CNPJ validado
// pelos dígitos verificadores, telefone cifrado (a resposta só traz máscara).
export const PATCH = rotaMeuTime<Params>(async ({ req, usuarioId, params }) => {
  await exigirEquipe(usuarioId, params.id, 'responsavel')
  const corpo = await lerCorpo(req)
  if (!elencoCompletoAtivo()) {
    const entrada = validar(editarEquipeSchema, corpo)
    const equipe = await editarEquipe(params.id, entrada)
    return sucesso({ id: equipe.id, nome: equipe.nome, cidade: equipe.cidade, naipe: equipe.naipe, escudoUrl: equipe.escudoUrl })
  }
  const entrada = validar(editarEquipeElencoSchema, corpo)
  const comDadosNovos = temCamposDoTime(entrada)
  if (comDadosNovos) await conferirColunasDoTime(params.id) // 503 antes de gravar qualquer coisa
  const basicos = Object.fromEntries(Object.entries(entrada).filter(([chave, valor]) => valor !== undefined && !(CAMPOS_DADOS_TIME as string[]).includes(chave)))
  const equipe = Object.keys(basicos).length > 0
    ? await editarEquipe(params.id, basicos)
    : (await exigirEquipe(usuarioId, params.id, 'responsavel')).equipe
  const dadosDoTime = comDadosNovos ? await gravarDadosDoTime(params.id, entrada) : await lerDadosDoTime(params.id)
  return sucesso({ id: equipe.id, nome: equipe.nome, cidade: equipe.cidade, naipe: equipe.naipe, escudoUrl: equipe.escudoUrl, dadosDoTime })
})
