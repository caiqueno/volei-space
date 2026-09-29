# O que a branch tem e este projeto ainda não tem

Comparação feita em 28/09/2026.

- Branch: `feature/segregacao-categoria-precificacao` do repositório `athrios/volei-space`, commit `108d0b5` (`feat: alterações para revisão caique`).
- Aqui: branch local `teste-integrado`, com o trabalho ainda não commitado (painel, finalização, simulação e cache).
- As duas histórias não têm ancestral em comum. Não dá para fazer merge. O código da branch está em `prototipo-plataforma/outputs/luva-platform/`.

Este arquivo lista o que precisava ser trazido. Em 28/09/2026 a fundação, o backfill e a ligação com parametrização, preço e consultas públicas foram aplicados neste working tree. A margem de set ficou a mínima de 2, sem teto. O texto abaixo registra o levantamento original.

## O que já está aqui

A tabela de preço do campeonato já é a mesma: ativação R$ 49,00 uma vez; R$ 3,90 por partida; súmula e scouts R$ 9,90 por partida; QR Code R$ 1,50 por partida; desconto de volume nas faixas 0%, 5%, 8%, 12% e 15%. Isso está em `src/lib/pricing/`.

Aqui a categoria ainda é texto em equipe e partida (`FEMININO`, `MISTO` e os demais), mais `Liga.categoriasConfig`. Não existe `CategoriaCampeonato`.

Aqui também existem peças que a branch não tem e que não devem ser apagadas na hora de trazer o código: campeonato `FINALIZADO`, Central de Simulações e o cache de consultas do navegador.

## O que precisa ser implementado

### 1. Categoria como competição

A branch cria a entidade e prende a operação nela.

Tabelas novas, nas migrations `supabase/migrations/202609220001_category_foundation.sql` até `202609230008_categoria_personalizada.sql`:

- `CategoriaCampeonato`: id, campeonato, código, nome, slug, ordem, status da configuração, versão e revisão.
- `CategoriaConfiguracao`: formato, grupos, sets, pontuação, eliminatória, inscrição, elenco, súmula e QR daquela categoria.
- `CategoriaSetupSecao`: andamento de cada seção da categoria.
- `CategoriaReplicacaoAuditoria`: registro de quando uma categoria copia a configuração de outra.

A coluna `categoriaCampeonatoId` entra em equipe, rascunho de inscrição, inscrição, grupo, equipe do grupo, partida, classificação, classificação eliminatória, premiação, voto de MVP e candidatura de equipe.

Arquivos que não existem aqui:

- `src/app/api/categorias/route.ts`
- `src/app/api/organizador/ligas/[id]/categorias/route.ts`
- `src/app/api/organizador/ligas/[id]/categorias/replicar/route.ts`
- `src/app/api/organizador/ligas/[id]/categorias/preco/route.ts`
- `src/components/parametrizacao/sections/categorias/CategoriasWizard.tsx`
- `src/components/parametrizacao/CategoryControls.tsx`
- `src/lib/category-scope.ts`
- `src/lib/category-replication.ts`
- `src/lib/category-replication-server.ts`
- `src/lib/category-match-rules.ts`
- `src/lib/category-pricing-server.ts`
- `docs/requisitos/PLANO-VALIDACAO-CATEGORIAS.md`
- `docs/requisitos/ROTEIRO-REVISAO-LOCAL.md`

A branch também altera rotas e telas que já existem aqui para exigir a categoria gravada: classificação, rankings, jogos, equipes, jogadores, partidas, súmula, resultados manuais, mata-mata, calendário, estrutura, inscrição e o wizard. A consulta pública passa a usar `categoriaCampeonatoId`. Os parâmetros `serie` e `categoria` na URL são recusados.

Comportamento da branch:

- O organizador escolhe categorias do catálogo (Feminino, Feminino Master, Masculino, Masculino Master, Misto) ou cria uma com nome livre.
- Desmarcar uma categoria sem operação só preenche `removidaEm`. A linha não é apagada.
- Duas categorias ativas do mesmo campeonato não podem ter o mesmo nome.
- Uma categoria não é excluída se ainda tiver equipe, jogo ou tabela.
- A categoria da equipe não muda depois de gravada.
- Série `OURO` e `PRATA` deixa de ser gravada nos fluxos novos.
- Copiar a configuração de uma categoria para outra usa versão. Se alguém salvou no meio, a cópia é recusada. A cópia pede revisão no destino.
- O líder não troca a categoria do convite: o vínculo é `ligaId` + `categoriaCampeonatoId`.

### 2. Preço somado das categorias

Aqui o preço é de um campeonato só. Lá, `src/lib/pricing/calculateCategoriesPrice.ts` soma as partidas de todas as categorias:

- uma ativação por campeonato, sem desconto de volume;
- o desconto de volume usa o total de partidas do campeonato, não o de cada categoria;
- o desconto é repartido entre as categorias sem alterar o valor arredondado;
- súmula e QR continuam opcionais e podem diferir por categoria;
- se alguma categoria ainda não tem formato válido, o total não é calculado.

### 3. Classificação por categoria

A branch troca `recalcular_classificacao_liga` para percorrer cada categoria e chamar `recalcular_classificacao_categoria`.

A conta lê a configuração da categoria:

- vitória por 1 set: 2 pontos para o vencedor e 1 para o perdedor (padrão);
- vitória por 2 ou mais sets: 3 e 0 (padrão);
- o organizador pode alterar esses quatro números;
- a ordenação segue a lista `criteriosClassificacao` da categoria;
- só entram partidas daquela categoria, nas fases geral e grupos.

A função daqui continua fixa: 3 no 2×0, 2 no 2×1, 1 para quem perde de 2×1, e só conta inscrição `APROVADA`.

### 4. Testes que acompanham a branch

Há uma bateria só de categorias (`scripts/category-*.test.ts` e `scripts/category-test-database.ts`). O plano dela usa um Postgres descartável, não o banco deste ambiente. Não rode esse harness contra o Supabase daqui.

## Revisão das regras de negócio

Fonte aprovada: `docs/requisitos/CATEGORIAS-COMO-COMPETICOES.md` e a seção «Categorias como competições — aprovado, pendente» de `03-REGRAS-DE-NEGOCIO.md`. A branch não torna essa regra implementada neste projeto.

| Regra aprovada | Na branch | Aqui |
| --- | --- | --- |
| Cada categoria é uma competição isolada, com entidade própria | Implementado na branch, com `CategoriaCampeonato` | Ainda é texto. Continua pendente |
| Equipes, convites, grupos, jogos, tabela, chaveamento, scouts e pódio não se misturam | A coluna e as chaves estrangeiras fazem isso no banco | Não há essa chave |
| O organizador informa a quantidade e o nome; o registro gravado é a fonte | Catálogo mais nome livre; desmarcar não apaga | `categoriasConfig` e o campo texto |
| Séries Ouro e Prata não segmentam campeonato novo | A branch recusa gravação nova de série | O campo `serie` ainda existe no fluxo de inscrição |
| A soma das partidas alimenta o preço do campeonato, sem misturar tabelas | `calculateCategoriesPrice` faz essa soma | O preço não passa por categoria |
| Regras esportivas podem ser comuns; não presumir variação por categoria sem decisão nova | A branch grava sets, pontos, formato e critérios em cada categoria e permite que diferam | A regra esportiva está no campeonato, não na categoria |
| Set fecha no alvo com diferença mínima de 2, sem teto | A validação da branch exige margem exatamente 2 quando o placar passa do alvo | O simulador usa margem mínima de 2. A súmula real ainda não segue o requisito inteiro |
| Pontos do vencedor e do perdedor por margem de 1 set e de 2 ou mais | A função nova lê esses quatro números da categoria | A função do banco ainda usa 3 / 2 / 1 fixos |

Pontos para decidir antes de copiar o código:

1. A branch trata sets, tie-break e pontuação como configuração de cada categoria. A regra aprovada diz que isso pode ser comum ao campeonato e que não se presume diferença por categoria. Trazer a branch é aceitar essa variação, com a cópia entre categorias como caminho para repetir a mesma regra.
2. A validação de placar da branch recusa margem maior que 2 depois do alvo (27×25 passa, 28×25 não). O texto aprovado fala em diferença mínima de 2, sem teto. São regras diferentes.
3. A classificação nova conta equipe com `statusEquipe = ATIVA`. A função daqui conta inscrição `APROVADA`. Trocar isso muda quem entra na tabela.
4. O `on conflict` da classificação nova é `ligaId` + `equipeId` e, na atualização, não grava de novo o `categoriaCampeonatoId`. Um time em duas categorias, ou uma linha antiga, pode ficar com a categoria errada. Isso precisa ser corrigido na implementação, não copiado como está.
5. O plano da própria branch diz que nenhuma migration foi aplicada em produção e que o backfill dos dados antigos ainda precisa de ensaio. Os campeonatos reais daqui (VOLEI-SP, Copa Feminina, Copa Masculina, copa rio lo) e as linhas de simulação não podem receber essas migrations sem esse ensaio.
6. O pagamento de lá só abre quando todas as categorias estão `CONCLUIDA`. O servidor recalcula o preço na hora. A regra aprovada diz que o pagamento pode ser do campeonato; não exige esse portão por categoria.

## Varredura da branch inteira

Revisto em 28/09/2026 o commit `108d0b5` por completo, não só os arquivos novos de categoria.

O snapshot do produto tem 398 arquivos em `prototipo-plataforma/outputs/luva-platform/`. 291 deles diferem do working tree. A maior parte dessa diferença é este projeto ter seguido outro caminho (visual, cache de consultas, campeonato `FINALIZADO`, simulação, conta pública e código de acesso do organizador). Não são 291 funcionalidades novas.

Fora dessa pasta, a raiz da branch é material da LUVA antiga ou laboratório: `brain/`, `TESTES/`, `landing-page/`, `loginHostgator/`, `sumula-digital-main/`, `images/`, PDFs, HTML de landing, `auditoria-redator/` e quatro SQL soltos de candidatura (`supabase-candidatura-equipe-ficha.sql`, `supabase-candidaturas-cep.sql`, `supabase-desbloqueio-cadastro-equipe.sql`, `supabase-luva-cadastros.sql`). Nada disso entra no volei.space.

O relatório `auditoria-redator/lote-1-categorias-inscricao/` descreve 16 arquivos. Os de categoria já estão na lista de implementar. Os de inscrição rápida (`src/lib/inscricao-rapida.ts` e as rotas `src/app/api/inscricao-rapida/**`) já existem aqui; na branch eles passam a listar e gravar o rascunho pela categoria, e a equipe só nasce na finalização do formulário.

### Funções de banco que a lista anterior não nomeava

Além das tabelas, a branch cria estas funções. Todas precisam vir juntas com as migrations, senão a tela chama um nome que o banco não tem.

- `validar_config_formulario_categoria` — o formulário de inscrição só aceita os campos previstos, como obrigatório, opcional ou desativado.
- `guard_player_team` — o atleta não muda para equipe de outra categoria.
- `guard_match_participant` — a partida não cruza categorias.
- `guard_category_vote` — o voto de MVP fica na categoria da partida.
- `guard_category_scope` — o restante das escritas confere campeonato e categoria.
- `selecionar_categorias_campeonato` — cria ou reativa categorias. A migration `202609230008` troca a assinatura: deixa de receber só códigos e passa a receber catálogo, id já existente ou nome livre.
- `salvar_configuracao_categoria` — autosave com versão. Gravação atrasada não cobre a mais nova.
- `replicar_configuracao_categorias` — cópia com auditoria e conflito de versão.
- `criar_formulario_categoria` e `editar_formulario_categoria` — o link de inscrição nasce sem equipe.
- `finalizar_inscricao_equipe_rascunho` — uma finalização repetida não cria a segunda equipe.
- `classificados_categoria`, `substituir_estrutura_categoria` e `criar_confronto_categoria` — grupos e jogos de uma categoria só.
- `classificar_equipe_categoria` — classificação manual dentro da categoria.
- `atualizar_calendario_categoria` — data, local e árbitro recusados se a revisão estiver velha ou o árbitro não estiver aprovado. O lote inteiro volta atrás se um item falha.

### O que parece novidade e já está aqui

Pódio, papeleta, rodízio, saque inicial, chave de mata-mata, golden set marcado como «em breve», quantidade fixa de sets e o aviso de 6 substituições por set estão nos dois lados. A branch não acrescenta essas regras. O limite de 6 também não é a regra aprovada, que pede 8; isso já vale para o código daqui.

`GrupoCampeonato` e `GrupoEquipeCampeonato` aparecem no Prisma da branch e não no Prisma daqui, mas as telas daqui já leem essas tabelas pelas migrations SQL. Não é uma tela nova.

`equipe-categoria.ts` existe nos dois. A branch só avisa para não usar `Liga.categoriasConfig` como fonte.

### O que a branch não tem e este projeto tem

`ContaPublico`, `CodigoAcessoOrganizador`, campeonato `FINALIZADO`, Central de Simulações e o cache de consultas. Copiar a branch por cima apaga isso.

## O que não trazer

- `senha-teste.txt`, que está na branch. Não copiar.
- A pasta `brain/`, `TESTES/`, `landing-page/`, `loginHostgator/`, `sumula-digital-main/`, imagens, PDFs e o HTML de landing. São da liga antiga.
- Os quatro SQL soltos na raiz da branch. O cadastro daqui já seguiu outro caminho.
- A cópia aninhada `volei.space/volei.space/` dentro do vault da branch.
- O harness Docker das portas 55439 e 3005. É só laboratório. O teste de pagamento dele não pode rodar contra o banco daqui.
- Não substituir daqui a finalização de campeonato, a simulação nem o cache de consultas.
