---
name: volei-space
description: Orienta alterações no produto SaaS volei.space existente; leia os requisitos aprovados e confira a implementação atual antes de editar inscrições, súmula ou classificação.
---

# volei.space — contexto de desenvolvimento

volei.space é uma plataforma para diferentes organizadores criarem e operarem seus próprios campeonatos de vôlei. Não é a aplicação de uma liga específica. Termos técnicos legados como `Liga`, `ligaId` e `LUVA` podem permanecer no código por compatibilidade; na linguagem do produto, `Liga` representa um campeonato.

## Antes de alterar código

1. Identifique o módulo, as rotas, os modelos, as migrations e os fluxos públicos afetados. Leia a implementação atual antes de propor novas estruturas.
2. Para inscrições por categoria e links exclusivos por equipe, leia [docs/requisitos/INSCRICOES-POR-EQUIPE.md](docs/requisitos/INSCRICOES-POR-EQUIPE.md).
3. Para súmula digital, sets, substituições, MVP, correção de resultado e classificação, leia [docs/requisitos/SUMULA-DIGITAL-E-CLASSIFICACAO.md](docs/requisitos/SUMULA-DIGITAL-E-CLASSIFICACAO.md).
4. Esses dois documentos registram **regras aprovadas ainda pendentes de implementação**. Compare cada regra com o código; não a apresente como funcionalidade pronta antes de verificar.
5. Preserve o isolamento entre organizadores, campeonatos, categorias e equipes nas consultas e mutações. Valide autorização e regras de negócio no servidor, inclusive quando a tela já as verifica.
6. Ao modificar dados derivados como classificação, scouts e resultado, verifique também os caminhos de recálculo, consultas públicas e correção. Migrações de registros passados são aceitáveis neste período de validação, mas devem ser explícitas e verificadas.
7. Se documentação e implementação divergirem, registre a diferença e siga o requisito aprovado para a mudança solicitada; não altere módulos não relacionados por conta de documentação legada.

## Estado da documentação

`README.md` e `BACKLOG-DESENVOLVIMENTO.md` ainda descrevem fases históricas da LUVA. Não os use como fonte de regras atuais. A reestruturação completa da documentação virá após a implementação e verificação dos fluxos novos. O código, o schema, as migrations e os testes são fontes para entender a implementação **atual**; os documentos de requisitos acima descrevem o comportamento **desejado**.
