---
title: >-
  Inscrições
category: modulo
tags: [inscricoes]
sources: [repo:athrios/volei-space/docs/requisitos/INSCRICOES-POR-EQUIPE.md]
summary: >-
  O organizador gera um link por campeonato. O convite por equipe continua pendente.
status: misto
created: 2026-09-20
updated: 2026-10-01
---
# Inscrições por equipe

**Regra em vigor:** o organizador gera um link por campeonato na prévia e em Campeonatos → Ações. O endereço é `/inscricao/campeonato/{token}`. O token tem 32 caracteres hexadecimais e não é o id da liga. Um campeonato tem um registro em `LinkInscricaoCampeonato`. Gerar de novo devolve o mesmo token. Regenerar troca o token e o anterior deixa de abrir a página. Desativar mostra inscrições indisponíveis. O período (`inscricoesAberturaEm`, `inscricoesEncerramentoEm`, `inscricoesAbertas` e o status do campeonato) é conferido no servidor. A equipe usa o formulário já existente de inscrição rápida. Nome repetido na mesma liga responde que a equipe já está inscrita. A finalização continua no rascunho atual e não cria uma segunda fila de aprovação. O convite exclusivo por equipe, antes de `Equipe` existir, permanece a regra aprovada e pendente de `docs/requisitos/INSCRICOES-POR-EQUIPE.md`.

**Estado anterior:** requisito aprovado, implementação final pendente. Há rascunhos e tokens em `src/lib/team-registration-draft.ts`, rotas `src/app/api/inscricao-rapida` e migration `supabase/migrations/supabase-inscricao-equipe-rascunho.sql`. Isso não equivale automaticamente ao fluxo aprovado. Desde 26/09/2026 o rascunho recusa, ao salvar o atleta, número de camisa repetido e ausência de foto, nascimento ou documento quando o formulário do campeonato exige esses campos.

**Implementado em 27/09/2026:** ao criar o campeonato, o painel e a central de parametrização mostram o link `/inscricao-rapida?ligaId={id}`. Cada equipe que abre esse link preenche os próprios dados e jogadores segundo `formularioInscricaoConfig` daquele campeonato. No formulário o campo se chama Nome do torneio. Quando a categoria do campeonato é única, esse campo fica preenchido com o nome real da `Liga` e travado; a categoria continua gravada no servidor para a inscrição. O nome da equipe permanece editável: o rótulo acompanha o texto digitado e o navegador não reescreve o campo. O convite exclusivo por categoria, antes de existir `Equipe`, continua pendente.

## Regra do produto

Organizador cria categoria → aponta opcionalmente equipe a convidar → gera link exclusivo **antes de `Equipe` existir** → líder cadastra dados da equipe e jogadores com salvamento persistente → conclui → equipe e inscrição entram diretamente no campeonato, **sem aprovação manual**. Token é limitado ao campeonato, categoria e convite/equipe. Repetição não duplica registros. Gerar link não cria confronto ou classificação.

**Arquitetura aprovada, pendente:** convites e inscrições devem ser vinculados no servidor a `ligaId` + `categoriaCampeonatoId`, com categoria imutável para o líder. A entidade `CategoriaCampeonato` e a chave `categoriaCampeonatoId` são modelo-alvo, ainda não implementado. O vínculo textual atual pode misturar categorias e exige migração. Série, Ouro e Prata são legado LUVA e não devem aparecer nos novos fluxos. Ver [[references/CATEGORIAS-COMO-COMPETICOES]].

**Atenção ao PR #1:** revisão inicial identificou exigência de equipe já aprovada e documento divergente do `main`. Confirme novo estado do PR antes de considerar a correção entregue.

Revisar o PR #1 antes do merge também quanto à possível dependência da categoria como texto: o convite deve guardar `ligaId` + `categoriaCampeonatoId` no servidor. Esta nota não declara essa adaptação concluída nem altera o PR.

[Requisito completo e vigente](https://github.com/athrios/volei-space/blob/main/docs/requisitos/INSCRICOES-POR-EQUIPE.md). Relacionado: [[modulos/EQUIPES-E-ATLETAS]], [[07-SEGURANCA]], [[04-FLUXOS]].
