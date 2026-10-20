# O que falta fazer — volei.space (branch `cursor-teste`)

Estado em 18/10/2026. O código do `PROMPT-volei-space.md` que dá para fazer sem navegador, sem banco e sem produção está pronto na `cursor-teste` (rodadas 5 a 14; a 14 trouxe o acesso único líder+banco, a aba Campeonatos e a aprovação de inscrição pelo organizador). Este arquivo lista **só o que sobrou**. Detalhes técnicos estão em `docs/HANDOFF-CURSOR.md` e `docs/analise/`.

**Regras que continuam valendo:** só vôlei de quadra (nada de praia); nada de push nem de mexer na `main` (publica direto em produção na Vercel) até todos os itens da seção 1 a 4 estarem feitos; nenhuma migration é aplicada sem ensaio em preview.

Verificação na última rodada: 158 arquivos de teste, só as 4 falhas conhecidas (`category-selection`, `category-setup-state`, `sumula-transacional`, `rls-publico`, as três primeiras precisam de `DATABASE_URL`); typecheck limpo; build 0.

---

## 1. Testar no navegador (nada das rodadas 9 a 13 foi visto numa tela real)

Roteiro por perfil em `docs/analise/29-qa-rodada-12.md`. Ligar as flags de desenvolvimento conforme `docs/COMO-TESTAR.md` (seção "Rodadas 9 a 12").

- [ ] Organizador: competição, tabela, súmulas, exportação do scout.
- [ ] Líder do time: cadastrar time, convidar atleta por link, importar planilha CSV (prévia com erros), notificações, clube.
- [ ] **Rodada 14:** aba Campeonatos (inscrição automática e solicitação com aprovação), aba Jogos (banco aberto pelo login, sem link), escolha de atletas quando o time passa do máximo da categoria.
- [ ] **Rodada 14:** organizador em `/painel`: seletor do modo de inscrição por categoria, fila de Solicitações (Aprovar/Recusar), sino de notificações e contador; conferir que o líder recebe a resposta no sino.
- [ ] Atleta convidado: abrir convite, aviso de LGPD, aceitar; testar com menor de 18.
- [ ] Apontador: placar, rotação, substituição, tempo, aceitar pedido do banco, papeletas, desafio, fechamento com assinaturas, súmula impressa (`/sumula/[token]/imprimir`).
- [ ] Banco da equipe (celular): papeleta de 6 posições, líbero(s), capitão, enviar e travar, pedir tempo/troca/desafio.
- [ ] Árbitro: consulta com atualização a cada 3 s.
- [ ] Espectador: placar ao vivo em tela cheia (`/ao-vivo/[partidaId]`), TV/tablet.
- [ ] Scout: lançar ações por toque, corrigir, desfazer, falta de rede, exportação CSV/JSON.
- [ ] Offline-first da súmula (`NEXT_PUBLIC_SUMULA_EVENTOS_ATIVO=1`): cortar a rede no meio do jogo, voltar, conferir conflito e bloqueio de fechamento.
- [ ] Protótipo (`/prototipo`) com os 7 perfis, no celular.
- [ ] Conferir contraste, foco, leitor de tela e alvos de 44 px (WCAG 2.2 AA) nas telas novas.
- [ ] Testes de usabilidade com pessoas reais (líder de time, apontador) e aprovação do escopo pelo analista de negócio.

## 2. Banco de dados (ensaiar em preview; nunca em produção direto)

Nenhuma das 42 migrations pendentes (`supabase/pendentes/migrations`) rodou num Postgres. Só passaram no teste estático.

- [ ] Rodar as consultas Q1–Q13 do `docs/analise/16-plano-aplicacao-migrations.md` no banco de desenvolvimento/preview.
- [ ] Ensaiar a aplicação na ordem do doc 16 (inclui 0001 RateLimit; 0033 a 0037, 0039, 0040, 0041; 0042 depois da 0037; 0043 depois da 0026; 0044 depois da 0043). **Não aplicar a 0038** (redundante com `TimeClube.clubeId`).
- [ ] Verificar no Postgres real: gatilho de imutabilidade da papeleta (inclui `libero2Id`), `unique` do `tokenHash`, CHECKs de `DesafioVideo`, função `expurgar_previas_importacao()`, acesso do `anon` negado em todas as tabelas novas.
- [ ] Rodada 14: ensaiar a ponte `TimeClube` → `Equipe` legada (criação de `Equipe` e `Jogador`, restrições `(categoriaCampeonatoId, nome)` e `(nome, ligaId, categoria, serie)`), o vínculo `Inscricao.equipeLegadoId` e o reparo ao listar jogos.
- [ ] Confirmar tipos de `id` reais (`Partida`, `Equipe`, `Jogador` são `integer` no código; o schema do Prisma está defasado).
- [ ] Rodar o reverso (`supabase/pendentes/rollback`) de cada uma para provar que volta.
- [ ] Decidir quando e como mover as migrations de `pendentes/` para `supabase/migrations`.

## 3. Configuração e segredos (só o dono)

- [ ] Definir `LGPD_CHAVE_CIFRA` em cada ambiente (obrigatória para contato de responsável de menor e convite com contato).
- [ ] Definir `CRON_SECRET` e **agendar o expurgo** das prévias de importação (Vercel cron chamando `/api/cron/expurgo-previas`, ou pg_cron). Hoje nada está agendado.
- [ ] Conferir `DATABASE_URL`, `DIRECT_URL`, `ADMIN_EMAIL` e os demais segredos na Vercel; nenhum `NEXT_PUBLIC_*` pode carregar segredo.
- [ ] Trocar a senha do admin legado (continua no histórico git; não reescrevemos o histórico).
- [ ] Proteção de branches e secret scanning no GitHub; revisar o workflow `seguranca.yml` rodando de verdade.
- [ ] Decidir quais flags ligar em cada ambiente (todas nascem desligadas): `MEU_TIME_ATIVO`, `MEU_TIME_FASE2_ATIVO`, `BANCO_APP_ATIVO`, `SCOUT_ATIVO`, `DESAFIO_ATIVO`, `AO_VIVO_ATIVO`, `SUMULA_EVENTOS_ATIVO`, `SUMULA_SERVIDOR_SOMBRA`, `PROTOTIPO` e as `NEXT_PUBLIC_*` correspondentes.
- [ ] Rodar o modo sombra da súmula (`SUMULA_SERVIDOR_SOMBRA=1`) em jogos reais e medir divergências antes de qualquer bloqueio (critérios em `docs/analise/07-arquitetura-backend.md`).

## 4. Decisões que não são de código

**Jurídicas (dono + advogado), lista completa em `docs/analise/25-lgpd-menores.md`, seção 6:** base legal para dados de menores; texto final do termo e do aviso do convite (hoje "v1-rascunho"); prazos de retenção (prévias confirmadas, notificações, fotos, documentos); manter o nome do atleta no histórico depois de anonimizar; papéis de controlador/operador, DPO e ROPA; quem pode pedir exclusão; maioridade em 29/02; inscrição de menor só com aviso; compartilhamento com organizadores/árbitros e fotos públicas; comunicação de incidente à ANPD.

**De produto (dono):**
- [ ] Foto e documento do atleta bloqueiam a inscrição ou só viram pendência?
- [ ] Rascunho de inscrição por token sem rota assinada: manter?
- [ ] Vincular equipe a outro clube: a regra atual move a equipe e responde 409 se o clube de origem tiver outras equipes. Confirmar.
- [ ] Desafio de vídeo: ligar por campeonato (hoje por variável de ambiente), limite por equipe por set (padrão 2, não confirmado) e janela de 7 s.
- [ ] Perfil AMADOR com 8 substituições e par repetido: confirmar como padrão ou exigir configuração explícita.
- [ ] `arbitro-access.ts` mantém `/^d+$/` de propósito: só corrigir com testes e decisão do dono (o id da partida passaria a valer como credencial).

**Com árbitro COBRAV / regulamento (itens `[M]` sem teste que os fixe):** WO em melhor de 3 e WO duplo; sanções mistas; saque em 0x0 após penalidade entre sets; placar CJ-03; líbero redesignado; tolerância de WO; assistente pode pedir tempo/substituição; colunas A/P/E/D e uso de "R" no modelo físico; capitão que também é líbero ou que começa no banco; desafio de vídeo oficial (ler o PDF FIVB VCS); zonas 7–9 do scout e qualidade de recepção do DataVolley; rotação K1–K6 do levantador.

## 5. Pendências de código (pequenas, nenhuma bloqueia o teste)

- [ ] Desafio: consequência no jogo (cancelar ponto, repetir rally) continua manual da arbitragem; falta lista fechada de lances.
- [ ] Aceitar pedido do banco: há uma janela entre a súmula registrar e o servidor recusar (422); hoje só avisa o apontador.
- [ ] Scout: o `PATCH` não limpa zona/jogador; sem `.dvw` (formato oficial não confirmado, nada inventado); rotação relativa à formação inicial, não K1–K6.
- [ ] Offline-first: o estado da tela continua derivado localmente e gravado pelo PUT legado; ler o estado do log só depois de o modo sombra provar equivalência. Ocorrências descartadas na tradução (atleta desconhecido, formação incompleta) não entram na fila.
- [ ] Sombra do servidor: redesignação de líbero, protesto, discrepância de papeleta, capitão e sacador ainda não traduzidos; ruído em súmulas sem formação.
- [ ] Súmula impressa: sem hora por ponto, sem súmula em branco (pré-jogo), RG-PTO-003 (ampulheta) e RG-INT-007 (log de edição) só parciais; config da partida na impressão é inferida quando a rota pública não traz as regras; a rota pública não traz o log (o rodízio ponto a ponto exige `/eventos`).
- [ ] Meu Time: notificação `AJUSTE_PEDIDO` sem quem a dispare; "Atletas" na navegação é só atalho; contato do responsável da planilha não é guardado.
- [ ] LGPD: sem rota de acesso/portabilidade do titular, sem rotação da chave de cifra, sem verificação de que o responsável existe, colunas antigas de responsável em `AtletaDocumento` (0025) sem uso.
- [ ] Pedidos do banco: criação sem lock (dois simultâneos podem passar a checagem; o limite é reconferido ao decidir); sem janela "papeleta visível 12 min antes".
- [ ] Competição privada: payloads de estrutura/mata-mata sem `campeonatoPublicado`; gravação mista de `visibilidade` não atômica; cache de ids privados só no processo; `buscarAgendaCampeonato` e `/jogos` sem `liga` não filtram privadas.
- [ ] Navegação global de produto: `package.json` ainda se chama `luva-platform`; limpar `.claude/worktrees/` (`git worktree remove`) e branches `feat/*`/`worktree-agent-*` antigas.
- [ ] 11 IDs de papel/PDF do doc 03 já têm teste no motor de impressão; RG-FEC-003 (capitão ausente/recusa) e RG-PTO-003 ficam parciais.

- [ ] Rodada 14: a vitrine `GET /api/meu-time/campeonatos` não devolve a contagem de atletas nem o máximo da categoria (a tela lê esses números da mensagem de erro do servidor); devolver os números no contrato.
- [ ] Rodada 14: mudanças no elenco da inscrição depois de confirmada não são sincronizadas com `Jogador` legado; mata-mata só recebe a ponte pela inscrição e pelo reparo da estrutura.
- [ ] Rodada 14: sino do organizador não aparece no menu do celular do `/painel`; barra lateral e menu do celular consultam a lista de pendentes duas vezes.
- [ ] Rodada 14: em competição pública a vitrine apresenta o token da categoria em nome da equipe (o controle passa a ser o `modoInscricao`); confirmar com o dono se quer outro comportamento.
- [ ] Banco por sessão: capitão só lê, assistente faz pedidos mas não envia papeleta (interpretação do papel; confirmar).

## 6. Caminho até a `main` (só depois das seções 1 a 4)

1. [ ] Cursor analisa a `cursor-teste` (inclusive este arquivo) e corrige o que o teste no navegador mostrar.
2. [ ] Migrations ensaiadas em preview e reversão provada.
3. [ ] PR da `cursor-teste` para `main` com testes verdes (D11: PR + testes, sem revisor obrigatório). **Atenção: `main` publica direto em produção.**
4. [ ] Aplicar migrations em produção na janela combinada, com backup (doc 16), só depois do merge ou antes, conforme a ordem do doc 16.
5. [ ] Ligar as flags aos poucos, uma por vez, começando por leitura/consulta (ao vivo, impressão), depois banco, depois Meu Time fase 2, por último offline-first e scout.
6. [ ] Plano de rollback: desligar a flag; reverter a migration só se não houver dado novo gravado.

## 7. Fora do escopo (decidido)

- Vôlei de praia (RG-PRA-001..011): o produto é só vôlei de quadra.
- Reescrever o histórico git (D10).
- Homologação própria (D7): usa-se o ambiente de desenvolvimento.

- Scout e árbitro (consulta ao vivo): fora do escopo por decisão do dono (21/10/2026). Ficam desligados (`SCOUT_ATIVO`, `NEXT_PUBLIC_SCOUT_ATIVO`) e fora dos roteiros e das pendências. NÃO remover `src/lib/arbitro-access.ts` nem `requireArbitroPartidaAccess`: o apontador usa essas funções para abrir a súmula.

## Rodada 15: inscrição dentro do líder (pendências)
- [ ] Upload assinado de escudo, foto de rosto e documento do atleta para `TimeClube`/`Atleta` (hoje o upload assume `Equipe.id` inteiro e `CandidaturaEquipe`): **bloqueia ligar `INSCRICAO_VIA_MEU_TIME_ATIVO`**.
- [ ] CPF, documento e telefone do atleta no Meu Time; respeitar `formularioInscricaoConfig` (campos obrigatórios por categoria); quadra e agenda da candidatura; QR Code por atleta.
- [ ] Decidir se o link de vaga libera competição privada (hoje não; é regra nova).
- [ ] Escolha automática do time quando o líder tem um só; retomada de rascunho em `/inscricao-rapida/[token]`; checar se a candidatura PENDENTE do cadastro de equipe trava o Meu Time.
- [ ] Tabela completa em `docs/analise/30-paridade-capitao-lider.md`.
