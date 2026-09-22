# Inscrições por equipe

**Estado:** requisito aprovado, implementação final pendente. Há rascunhos e tokens em `src/lib/team-registration-draft.ts`, rotas `src/app/api/inscricao-rapida` e migration `supabase-inscricao-equipe-rascunho.sql`. Isso não equivale automaticamente ao fluxo aprovado.

## Regra do produto

Organizador cria categoria → aponta opcionalmente equipe a convidar → gera link exclusivo **antes de `Equipe` existir** → líder cadastra dados da equipe e jogadores com salvamento persistente → conclui → equipe e inscrição entram diretamente no campeonato, **sem aprovação manual**. Token é limitado ao campeonato, categoria e convite/equipe. Repetição não duplica registros. Gerar link não cria confronto ou classificação.

**Arquitetura aprovada, pendente:** convites e inscrições devem ser vinculados no servidor a `ligaId` + `categoriaCampeonatoId`, com categoria imutável para o líder. A entidade `CategoriaCampeonato` e a chave `categoriaCampeonatoId` são modelo-alvo, ainda não implementado. O vínculo textual atual pode misturar categorias e exige migração. Série, Ouro e Prata são legado LUVA e não devem aparecer nos novos fluxos. Ver [[docs/requisitos/CATEGORIAS-COMO-COMPETICOES]].

**Atenção ao PR #1:** revisão inicial identificou exigência de equipe já aprovada e documento divergente do `main`. Confirme novo estado do PR antes de considerar a correção entregue.

Revisar o PR #1 antes do merge também quanto à possível dependência da categoria como texto: o convite deve guardar `ligaId` + `categoriaCampeonatoId` no servidor. Esta nota não declara essa adaptação concluída nem altera o PR.

[Requisito completo e vigente](https://github.com/athrios/volei-space/blob/main/docs/requisitos/INSCRICOES-POR-EQUIPE.md). Relacionado: [[modulos/EQUIPES-E-ATLETAS]], [[07-SEGURANCA]], [[04-FLUXOS]].
