# Instruções do projeto volei.space

Este repositório contém a plataforma SaaS **volei.space**. Ela atende diferentes organizadores e campeonatos. `Liga`, `ligaId` e LUVA são nomes legados do código; não definem a identidade do produto.

## Consulta obrigatória antes de trabalhar

1. Abra `volei.space — Plataforma de Campeonatos de Vôlei/00-INICIO.md` (e, se existir, `AGENTS.md` / `hot.md` para o schema LLM-WIKI e o contexto da sessão).
2. Identifique o módulo da tarefa e leia a nota correspondente em `volei.space — Plataforma de Campeonatos de Vôlei/modulos/`, além das notas centrais pertinentes.
3. Para inscrições, leia também `docs/requisitos/INSCRICOES-POR-EQUIPE.md`. Para súmula, sets, substituições, MVP ou classificação, leia `docs/requisitos/SUMULA-DIGITAL-E-CLASSIFICACAO.md`.
4. Confira as rotas, modelos, migrations e testes atuais antes de implementar. As notas distinguem comportamento **implementado**, regra **aprovada mas pendente** e **histórico**. Não apresente regra pendente como funcionalidade pronta.
5. Se a documentação e o código divergirem, diga qual é a divergência, aplique o requisito aprovado ao escopo solicitado e atualize as notas afetadas quando entregar a mudança.

O `README.md` e o `BACKLOG-DESENVOLVIMENTO.md` da raiz ainda contêm fases históricas da LUVA. Não os use como fonte de regras atuais. A aprovação manual de equipe pertence à liga antiga: no fluxo novo de inscrição do volei.space cada categoria define o modo de inscrição (`modoInscricao`): `AUTOMATICA` (a equipe é cadastrada diretamente pelo líder, sem aprovação, padrão) ou `APROVACAO` (o líder solicita participação pela aba Campeonatos do Meu Time e o organizador aprova ou recusa, recebendo notificação). O link de convite de equipe continua existindo, em especial para competição privada.

## Entrega

Antes de concluir, informe quais notas consultou, o que mudou no código e na documentação, e os testes realizados. Preserve o isolamento entre organizadores, campeonatos, categorias e equipes; valide permissões e regras de negócio no servidor.
