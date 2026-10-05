---
title: >-
  Inscrições
category: modulo
tags: [inscricoes]
sources: [repo:athrios/volei-space/docs/requisitos/INSCRICOES-POR-EQUIPE.md]
summary: >-
  O organizador gera um link por categoria. A equipe entra direto. O convite exclusivo por equipe continua pendente.
status: misto
created: 2026-09-20
updated: 2026-10-04
---
# Inscrições por equipe

**Regra em vigor desde 4 de outubro de 2026:** o organizador gera um link por categoria em Campeonatos, na estrutura e na prévia. O endereço é `/inscricao/categoria/{token}`. O token fica em `CategoriaCampeonato.tokenInscricao`. O líder não troca a categoria. Ao concluir, a inscrição fica `APROVADA` e a equipe entra no campeonato. `/inscricao-rapida` sem rascunho já aberto pede esse link. O link antigo `/inscricao/campeonato/{token}` continua abrindo convites já enviados, mas o painel não oferece mais um link único do campeonato.

**Regra anterior:** o organizador gerava um link por campeonato. O endereço era `/inscricao/campeonato/{token}`. O token tem 32 caracteres hexadecimais e não é o id da liga. Um campeonato tem um registro em `LinkInscricaoCampeonato`. Gerar de novo devolve o mesmo token. Regenerar troca o token e o anterior deixa de abrir a página. Desativar mostra inscrições indisponíveis. O período (`inscricoesAberturaEm`, `inscricoesEncerramentoEm`, `inscricoesAbertas` e o status do campeonato) é conferido no servidor. A equipe usa o formulário já existente de inscrição rápida. Nome repetido na mesma liga responde que a equipe já está inscrita. A finalização continua no rascunho atual e não cria uma segunda fila de aprovação. O convite exclusivo por equipe, antes de `Equipe` existir, permanece a regra aprovada e pendente de `docs/requisitos/INSCRICOES-POR-EQUIPE.md`.

**Estado anterior:** requisito aprovado, implementação final pendente. Há rascunhos e tokens em `src/lib/team-registration-draft.ts`, rotas `src/app/api/inscricao-rapida` e migration `supabase/migrations/supabase-inscricao-equipe-rascunho.sql`. Isso não equivale automaticamente ao fluxo aprovado. Desde 26/09/2026 o rascunho recusa, ao salvar o atleta, número de camisa repetido e ausência de foto, nascimento ou documento quando o formulário do campeonato exige esses campos.

**Histórico de 27/09/2026:** o painel mostrava `/inscricao-rapida?ligaId={id}`. Esse atalho saiu do fluxo em 4 de outubro de 2026. O rascunho já aberto em `/inscricao-rapida/{token}` continua editável.

## Regra do produto

Organizador cria categoria → aponta opcionalmente equipe a convidar → gera link exclusivo **antes de `Equipe` existir** → líder cadastra dados da equipe e jogadores com salvamento persistente → conclui → equipe e inscrição entram diretamente no campeonato, **sem aprovação manual**. Token é limitado ao campeonato, categoria e convite/equipe. Repetição não duplica registros. Gerar link não cria confronto ou classificação.

**Arquitetura:** o link da categoria grava `ligaId` e `categoriaCampeonatoId`. O líder não troca a categoria. O convite exclusivo de uma equipe apontada, antes de existir `Equipe`, continua pendente. Série, Ouro e Prata saíram do cadastro novo de equipe e de partida. Ver [[references/CATEGORIAS-COMO-COMPETICOES]].

**Atenção ao PR #1:** revisão inicial identificou exigência de equipe já aprovada e documento divergente do `main`. Confirme novo estado do PR antes de considerar a correção entregue.

Revisar o PR #1 antes do merge também quanto à possível dependência da categoria como texto: o convite deve guardar `ligaId` + `categoriaCampeonatoId` no servidor. Esta nota não declara essa adaptação concluída nem altera o PR.

[Requisito completo e vigente](https://github.com/athrios/volei-space/blob/main/docs/requisitos/INSCRICOES-POR-EQUIPE.md). Relacionado: [[modulos/EQUIPES-E-ATLETAS]], [[07-SEGURANCA]], [[04-FLUXOS]].
