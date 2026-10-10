# Requisito aprovado: categorias como competições isoladas

**Estado:** decisão de produto aprovada em 21/09/2026. A entidade `CategoriaCampeonato` e a chave `categoriaCampeonatoId` já existem no código e no schema. Em 10/10/2026 o aplicativo passou a isolar geração de grupos, calendário e chave, e as leituras de portal, tabela, jogos, ranking e pódio, por uma categoria. Isso não conclui o requisito inteiro: funções SQL de recálculo, convites e o restante do cadastro continuam como estavam, e este texto não descreve migration nova.

## Modelo e parametrização

1. `Liga` é o campeonato principal no código e funciona como contêiner das categorias. Cada categoria é uma competição interna independente, semelhante a um subcampeonato. Categoria não pode ser somente texto, rótulo ou filtro visual.
2. O modelo desejado possui entidade própria `CategoriaCampeonato`, vinculada à `Liga`. Na primeira etapa da parametrização, o organizador informa quantas categorias o campeonato terá e identifica cada uma pelo nome.
3. A quantidade informada deve ser coerente com as categorias efetivamente cadastradas. As categorias persistidas são a fonte de verdade; um contador isolado não cria nem substitui registros de categoria.
4. O campeonato principal pode compartilhar identidade visual, organizador, locais, período geral, pagamento e regras esportivas comuns. Não presumir configurações esportivas diferentes por categoria sem nova decisão de produto.

## Isolamento obrigatório

Cada `CategoriaCampeonato` deve isolar equipes; convites e inscrições; grupos; partidas e rodadas; classificação; classificados; eliminatórias e chaveamento; scouts e rankings; campeão, pódio e resultados. Entidades operacionais devem usar `categoriaCampeonatoId` como chave de relacionamento sempre que aplicável, além do vínculo ao campeonato principal.

Equipes de categorias diferentes nunca podem se enfrentar, compartilhar grupos, aparecer na mesma classificação ou disputar o mesmo chaveamento. Consultas, mutações, geração de estrutura e recálculos devem validar esse escopo no servidor, inclusive para resultados públicos e dados derivados.

Convites e inscrições devem ser vinculados no servidor ao par `ligaId` + `categoriaCampeonatoId`, e não somente ao nome textual da categoria. O convite não permite ao líder trocar a categoria. O requisito de cadastro por convite continua em [[docs/requisitos/INSCRICOES-POR-EQUIPE]]; seu modelo de vínculo deve seguir este requisito.

## Estado atual e migração

**Implementado atualmente:** `CategoriaCampeonato` persiste a categoria. Gerar grupos ou calendário em `POST /api/organizador/ligas/[id]/estrutura` e `PATCH .../calendario` exige uma categoria e apaga só os grupos e jogos de grupos dessa categoria. A chave em `POST .../mata-mata` e a leitura de `getMataMataBracket` usam a categoria dos times e a `CategoriaConfiguracao`. Portal, classificação, jogos, ranking e pódio filtram por `categoriaCampeonatoId` (a URL pública também aceita `categoria`). Campeonato sem categoria nas equipes continua legado e a geração responde 422, sem apagar o campeonato inteiro. Nenhuma migration nova entrou com esse isolamento.

**Aprovado, pendente:** o restante do requisito — convite imutável, recálculo SQL por categoria e o fim dos escritores da série antiga — não faz parte dessa entrega. Registros antigos podem ser preservados, mas valores legados não podem aparecer nem atuar como regra nos novos fluxos. Este documento não declara mudança de banco.

**Legado LUVA:** volei.space não utiliza séries. `OURO` e `PRATA` são valores históricos da LUVA e não podem substituir categorias. Não exibir série, Ouro ou Prata em interfaces novas nem usá-los para segmentar competições novas.

**Dependência do PR #1:** o PR de inscrições deve ser revisto antes do merge, pois o vínculo de convite/inscrição pode depender da categoria como texto. A revisão deve garantir `ligaId` + `categoriaCampeonatoId` no servidor e preservar o vínculo imutável do convite. Este requisito não altera o PR #1.

## Critérios de aceitação

- Duas categorias da mesma `Liga` mantêm equipes completamente isoladas, inclusive em consultas e mutações no servidor.
- Gerar partidas em uma categoria não envolve equipes de outra; uma partida nunca cruza categorias.
- Cada categoria possui tabela de classificação independente, com recálculo limitado às suas partidas.
- Grupos e eliminatórias pertencem a uma única categoria; classificados e chaveamento não cruzam categorias.
- Convite e inscrição são vinculados ao par `ligaId` + `categoriaCampeonatoId`; o líder não consegue trocar a categoria do convite, inclusive por chamada direta à API.
- Editar ou excluir uma categoria não afeta silenciosamente outra; vínculos e dependências são validados antes da operação.
- Consultas públicas permitem selecionar a categoria e exibem apenas equipes, partidas, classificação, rankings e resultados correspondentes.
- Nenhuma interface nova exibe série, Ouro ou Prata como divisão competitiva.
- A soma de partidas de todas as categorias pode alimentar a precificação geral do campeonato, sem misturar equipes, tabelas, resultados ou chaveamentos das competições.

Ver também [[02-ARQUITETURA]], [[03-REGRAS-DE-NEGOCIO]], [[06-BANCO-DE-DADOS]] e [[modulos/PARAMETRIZACAO]].
