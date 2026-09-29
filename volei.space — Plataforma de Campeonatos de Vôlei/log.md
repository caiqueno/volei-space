---
title: >-
  Log da wiki
category: area
tags: [log, llm-wiki]
sources: [repo:athrios/volei-space]
summary: >-
  Registro append-only de ingestões, atualizações e manutenções do vault.
status: implementado
created: 2026-09-25
updated: 2026-09-29
---

# Log

## [2026-09-29] fix | login do administrador no banco em uso

- pages_updated=`07-SEGURANCA`, `log`, `hot`
- O login reconhece a conta que está na tabela `Admin` do Supabase ligado ao ambiente. O e-mail legado `admin@luv.com.br` deixa de ser o único administrador quando `ADMIN_EMAIL` não está definido.

## [2026-09-29] fix | status da inscrição rápida no build

- pages_updated=`log`
- A página do link trata inscrição ainda aberta como rascunho e inscrição concluída como enviada, para o build aceitar os status do rascunho. Os outros erros de tipo do mesmo build (fases do mata-mata, salvamento do wizard, card público e o organizador da simulação) foram alinhados. Os testes em `scripts/` ficam fora do typecheck do Next.

## [2026-09-29] perf | consultas do perfil do organizador

- pages_updated=`09-UI-UX`, `log`, `hot`
- Início, tabela e galeria passam a ler os campeonatos numa consulta. A guia já aberta permanece montada, então voltar para ela não espera a rede de novo.

## [2026-09-29] fix | oficializar súmula abre o resultado público

- pages_updated=`modulos/SUMULA-DIGITAL`, `log`, `hot`
- Partida encerrada sem `sumulaAprovadaEm` era recusada antes de gravar a súmula. O envio agora publica o resultado e o botão entrega `/partidas/{id}/ao-vivo`, visível sem login.

## [2026-09-29] fix | lado da quadra e nome na 2D

- pages_updated=`09-UI-UX`, `modulos/SUMULA-DIGITAL`, `log`
- Na quadra 2D, inverter lados passa a trocar as equipes de metade. O nome do atleta aparece abaixo do número.

## [2026-09-29] fix | quadra 2D com as equipes de frente

- pages_updated=`09-UI-UX`, `modulos/SUMULA-DIGITAL`, `log`, `hot`
- A grade 2D foi virada. As duas equipes ficam uma de frente para a outra, com a rede no meio.

## [2026-09-29] fix | portal público sem os jogos oficiais

- pages_updated=`modulos/PARTIDAS`, `09-UI-UX`, `log`, `hot`
- A consulta pública usava o vínculo antigo da equipe, falhava e o portal mostrava a agenda vazia. A abertura sem campeonato escolhido também caía no campeonato mais novo, ainda sem jogos. Agora a agenda lê o registro oficial, separa em andamento, próximos e encerrados, reúne os campeonatos que não são simulação e atualiza a cada 8 segundos.

## [2026-09-29] feat | escolha entre quadra 2D e 3D

- pages_updated=`09-UI-UX`, `modulos/SUMULA-DIGITAL`, `log`
- Ao lado de acompanhar ao vivo, a súmula deixa escolher a grade original (2D) ou a quadra com imagem (3D).

## [2026-09-29] fix | ovais do fundo menores

- pages_updated=`09-UI-UX`, `log`
- P1, P5 e P6 usam o mesmo tamanho dos ovais da rede.

## [2026-09-29] fix | espaço na rede da quadra

- pages_updated=`09-UI-UX`, `log`
- Os ovais de P2, P3 e P4 ficam menores e afastados da malha, para não encostar na equipe do outro lado.

## [2026-09-29] fix | ações do oval na quadra

- pages_updated=`09-UI-UX`, `modulos/SUMULA-DIGITAL`, `log`
- P1 a P6 ficam em negrito acima do oval. O sacador pisca em amarelo e só ele tem ace. A rede tem bloqueio; o fundo tem ponto e substituição.

## [2026-09-28] fix | imagem padrão da quadra

- pages_updated=`09-UI-UX`, `log`
- A súmula passa a usar `public/images/quadra-padrao.png`, com o piso laranja e a rede no centro. As posições continuam nas duas metades.

## [2026-09-28] fix | desenho oficial na quadra da súmula

- pages_updated=`09-UI-UX`, `log`
- A quadra da súmula passa a usar o desenho oficial, cortado na área de jogo e dividido nas duas metades com a linha de ataque a 3 m da rede.

## [2026-09-28] feat | quadra da súmula

- pages_updated=`modulos/SUMULA-DIGITAL`, `09-UI-UX`, `log`
- A pontuação e a escalação passam a mostrar a quadra vista de cima. Os atletas usam a formação já salva. Arrastar só organiza a escalação antes de confirmar.

## [2026-09-28] fix | acompanhamento ao vivo

- pages_updated=`modulos/PARTIDAS`, `log`
- «Acompanhar ao vivo» abria a partida e a consulta falhava no vínculo antigo da equipe, então a tela dizia que a partida não existia.

## [2026-09-28] fix | cabeçalho compacto da súmula

- pages_updated=`09-UI-UX`, `log`
- O título da partida na súmula usava até 4,25rem e empurrava a quadra. Passa a no máximo 1,55rem, com menos padding.

## [2026-09-28] fix | presença do árbitro e abertura da súmula

- pages_updated=`03-REGRAS-DE-NEGOCIO`, `modulos/SUMULA-DIGITAL`, `hot`, `log`
- A súmula deixava de carregar porque a consulta ainda usava o vínculo simples de equipe. A leitura passa a exigir sessão e escala, e a rota estável é o id da partida. O árbitro grava presença na partida e, ao iniciar, abre essa súmula.

## [2026-09-28] fix | escala do árbitro e simulação operável

- pages_updated=`03-REGRAS-DE-NEGOCIO`, `modulos/PARTIDAS`, `modulos/SUMULA-DIGITAL`, `hot`, `log`
- O organizador grava o árbitro na tabela de jogos. O árbitro deixa de se candidatar e só abre a partida da escala. A súmula passa a exigir essa escala e a recusar placar incompatível com o set configurado.
- migration=`202609280001_category_operation_definer`: a revisão da categoria passa a rodar como dona da função, senão a escala falha com a chave atual.

## [2026-09-28] fix | login sem tela intermediária

- pages_updated=`09-UI-UX`, `hot`, `log`
- O painel esperava a sessão no efeito e, no primeiro desenho, mostrava «Acesso restrito». O cabeçalho da identificação também montava o menu da sessão já gravada. A área da equipe e a lista de campeonatos separam «sem sessão» de «conta sem permissão».

## [2026-09-28] apply | categorias e preço agregado

- source=`feature/segregacao-categoria-precificacao` @ `108d0b5`, aplicado no working tree sem substituir finalização nem simulação
- pages_updated=`03-REGRAS-DE-NEGOCIO`, `hot`, `log`
- divergência mantida: set fecha com margem mínima 2, sem teto

## [2026-09-28] compare | segregação de categoria e precificação

- source=`feature/segregacao-categoria-precificacao` @ `108d0b5`, código em `prototipo-plataforma/outputs/luva-platform`
- pages_created=`docs/comparacao-segregacao-categoria-precificacao.md`
- pages_updated=`03-REGRAS-DE-NEGOCIO`, `hot`, `log`
- local_gap=categoria ainda é texto; preço por categoria e `CategoriaCampeonato` não estão neste working tree
- rule_gap=a branch varia sets e pontuação por categoria e exige margem exatamente 2 acima do alvo; a regra aprovada daqui não presume essa variação e fala em diferença mínima de 2
- sweep=398 arquivos do snapshot; 291 diferem sobretudo pelo trabalho local. Funções SQL de guarda, formulário, estrutura e calendário entraram no mesmo arquivo. Pódio, papeleta e mata-mata já existem aqui. A raiz da branch é legado LUVA

## [2026-09-27] ingest | central de simulações

- pages_updated=`03-REGRAS-DE-NEGOCIO`, `hot`, `log`
- code=`src/lib/simulacao.ts`, `src/lib/simulacao-dados.ts`, `/admin/simulacoes`, migration `simulacao`
- tests=`npm run test:simulacao` ok
- isolation=portal público continuou só com os campeonatos já ativos; linhas `simulacao=true` ficaram fora

## [2026-09-25] lint | prontidão e APIs

- pages_created=`synthesis/PRONTIDAO-E-APIS.md`
- pages_updated=`index`, `hot`, `02-ARQUITETURA`, `08-INTEGRACOES`, `11-DECISOES`, `modulos/INSCRICOES`, wikilinks `docs/requisitos` → `references`
- removed=`vault/.claude/skills` (cópia triplicada das skills)
- code=`scripts/team-registration-draft.test.ts` aponta para `supabase/migrations/`
- tests=pricing, team-sync, championship-setup, organizer-flow, registration-draft ok
- live=`GET /api/ping` 200 not_configured; rotas de dados 500 sem `.env`

## [2026-09-25] ingest | kepano/obsidian-skills

- source=`url:https://github.com/kepano/obsidian-skills`
- installed_to=`.agents/skills/`, `.cursor/skills/`, vault `.claude/skills/`
- skills=`obsidian-markdown`, `obsidian-bases`, `json-canvas`, `obsidian-cli`, `defuddle`, `knap`
- pages_created=`references/OBSIDIAN-SKILLS-KEPANO.md`

## [2026-09-25] ingest | LLM Wiki (Karpathy gist)

- source=`url:https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f`
- pages_created=`raw/LLM-WIKI-KARPATHY.md`, `references/LLM-WIKI-KARPATHY.md`, `synthesis/LLM-WIKI-NO-VOLEI-SPACE.md`
- pages_updated=`AGENTS.md`, `00-INICIO.md`, `index.md`, `hot.md`, `.manifest.json`

## [2026-09-25] setup | schema llm-wiki-adaptado

- pages_created=index,log,hot,AGENTS,references/requisitos
- decisao="Aplicar mentalidade LLM Wiki ao vault de produto sem reorganizar áreas/módulos para concepts/entities"
