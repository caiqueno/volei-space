# Consolidado dos relatórios e próximos passos

Resumo dos relatórios 01 a 18 (exceto 05 a 07, 09 a 11, que foram substituídos pelos agentes de `.claude/agents/`). Nada aqui foi executado: todos os relatórios foram feitos lendo código e documentação.

## Decisão de produto vigente
- **Meu Time é pilar central** (conta do time + banco de atletas reutilizável). O convite por link do organizador por categoria, com cadastro direto pelo líder e sem aprovação, continua como porta de entrada.
- Segurança vem primeiro: um banco de atletas com menores amplia o risco de LGPD.

## Ações que dependem de você (nenhum agente fez)
1. **Trocar ou apagar a conta de admin legada** (README.md:35-36, COMO-TESTAR.txt:120, setup-db.mjs:236-245; a senha está em 12 pontos do histórico do git) e definir `ADMIN_EMAIL`.
2. **Rodar as consultas de verificação** do banco real (13-auditoria-seguranca.md seção 4 e 14-banco-de-dados.md A1 a A10) para confirmar quais políticas RLS e permissões estão realmente aplicadas.
3. **Gerar o dump de estrutura (DDL)** do banco de desenvolvimento para criar o baseline (18-ambiente-local-e-ci.md).
4. **Decidir** os itens da seção "Decisões" abaixo.

## Ordem proposta de implementação

| Fase | Entrega | Agentes | Relatórios |
|---|---|---|---|
| 0.1 | Verificar o banco real (consultas somente leitura) | você + banco-de-dados | 13, 14 |
| 0.2 | Código: trocar cliente anônimo por `supabaseAdmin` com colunas explícitas nas rotas públicas (jogadores, equipes, rankings, equipes/[slug]); limite de tentativas no login; validar URLs https; cabeçalhos/CSP | backend, seguranca | 13 |
| 0.3 | Banco: fechar RLS, grants e storage (**só depois do 0.2**, senão o site público quebra) | banco-de-dados | 13, 14 |
| 0.4 | Ambiente local: baseline do schema, `.env.example` corrigido, `supabase/seed.sql`, scripts com `cross-env`, CI | devops-infra, banco-de-dados | 18 |
| 0.5 | Testes: corrigir os que não rodam, runner único, primeiros 9 testes de segurança e isolamento | qa | 17 |
| 1A | Meu Time núcleo: tabelas novas, link do organizador cria conta e time, colar lista de atletas, inscrição como cópia | banco-de-dados, backend, frontend, ux, designer | 12, 14, 15 |
| 1B | Motor de regras da súmula no servidor, log de eventos, correções (terceiro set, cartão vermelho, líbero, substituições configuráveis) | arquiteto, backend, regras-de-volei, qa | 12, 16 |
| 2 | Papeleta digital, offline, app de banco, placar ao vivo, planilha e convite ao atleta | todos | 04 |
| 3 | Busca pública, selo de elegibilidade, scout `.dvw`, desafio de vídeo | todos | 04 |

Regra de trabalho: uma branch por tarefa (`fix/…`, `feat/…`) a partir de `teste-integrado`, PR para `teste-integrado`, teste local integrado e só então PR para `main`. Nenhum agente faz push direto, commit sem pedido ou ação em produção.

## Decisões em aberto (resumo; detalhes nos relatórios)
- **Súmula (03, 16):** substituições por set 6 ou 8 (recomendação: configurável, padrão 6, sem repetição de par); terceiro set após 2x0 (recomendação: desligado por padrão e corrigir o bug do autosave 422).
- **Link (04, 08):** revogação e validade do link de convite (recomendação: organizador revoga + prazo opcional).
- **Meu Time (14, 15):** login por senha ou por código; atleta exclusivo por categoria ou por campeonato; foto e documento bloqueiam o envio ou viram pendência; idade e naipe avisam ou bloqueiam; sexo do atleta obrigatório para o selo de naipe; perfil autônomo de atleta no MVP; quem autoriza menores.
- **Elegibilidade sem aprovação (04):** regras automáticas que geram pendência, sem fila de aprovação.
- **Pendente de especialista (03, 16):** combinação de sanções, saque após penalidade entre sets, WO em melhor de 3 e WO duplo (COBRAV/FMV ou Livro de Casos CBV).

## Achados que mais pesam
- **Dados pessoais expostos:** `using(true)` em Jogador, bucket de documentos público, `senhaHash` e `sumulaToken` legíveis por anônimo (13, 14).
- **Banco não reproduzível:** nenhuma migration cria as tabelas do núcleo (14, 18).
- **Súmula:** o servidor só valida o placar; toda a regra vive no navegador (`lancar/page.tsx`); terceiro set obrigatório quebra o autosave; cartão vermelho dá ponto sem passar o saque; líbero nunca entra em quadra (16).
- **Inscrição:** o servidor não valida idade nem naipe; `/capitao` ainda exige aprovação, contra a regra aprovada (15).
- **Testes:** 13 em `scripts/`, 2 não rodam por importarem arquivo inexistente; nenhum cobre rotação, auth, isolamento ou classificação (17).
