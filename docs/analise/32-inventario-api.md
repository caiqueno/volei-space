# 32. Inventário das rotas da API (Rodada 19)

Data: 2026-10-21. Fonte: varredura de todos os `route.ts` em `src/app/api` (196 arquivos). **Nada foi executado nem aberto no navegador**; é leitura estática do código da branch `cursor-teste`.

## Como este documento não envelhece

O teste `scripts/inventario-api.test.ts` (`npm run test:inventario-api`, também rodado por `npm run test:unit`) **falha** se existir rota em `src/app/api` que não esteja na tabela abaixo (ou se a tabela citar rota que não existe mais). Para atualizar depois de criar ou apagar uma rota:

```bash
node scripts/with-ts-node.mjs scripts/inventario-api.test.ts --gerar
```

O comando imprime as linhas da tabela; cole as novas aqui. As colunas de flag, acesso e envelope vêm de uma heurística (importações e chamadas de cada arquivo) mais ajustes manuais no próprio teste (`ACESSO_MANUAL`, `FLAG_MANUAL`). O teste só garante que o método e o caminho estão listados; **as demais colunas são orientação, não contrato**: antes de depender delas, abra o arquivo da última coluna.

## Como ler

- **Método**: os métodos exportados pelo arquivo. Quando há mais de um, o controle de acesso pode mudar por método (exemplo: `GET` público e escrita só do organizador); a coluna "Quem acessa" descreve o caso mais restrito, ou o descreve por método quando a varredura já sabia.
- **Flag**: variável de ambiente que liga a rota. Desligada, a rota responde **404** como se não existisse (padrão desta base). "nenhuma" quer dizer rota legada, sempre ligada. Quando a rota exige duas flags (por exemplo `MEU_TIME_ATIVO` e a do módulo), as duas aparecem. Lista e descrição: `.env.example` e `docs/COMO-TESTAR.md`.
- **Quem acessa**:
  - **público**: sem login (ainda assim com limite de requisições por IP em várias rotas);
  - **token**: o segredo vai no caminho (`[token]`): súmula, árbitro, banco, inscrição rápida, QR de atleta ou convite;
  - **líder ou técnico (sessão)**: cookie de sessão de equipe do Meu Time, validado pelo servidor com o vínculo à equipe;
  - **organizador**: sessão de organizador **liberado**, e a competição precisa ser dele;
  - **admin**: sessão de administrador (tabela `Admin`, `ADMIN_EMAIL`);
  - **cron**: `Authorization: Bearer` com `CRON_SECRET`; sem o segredo a rota "não existe";
  - **webhook externo**: chamada de terceiros (hoje só o da InfinitePay, desativado).
- **Envelope**: o formato das respostas.
  - `{ data } / { error, details }`: `success()` e `error()` de `src/lib/api-response.ts` (legado).
  - `{ data } / { error, codigo? }`: `sucesso()` e `falha()` de `src/lib/meu-time/acesso.ts` (Meu Time e módulos novos; `codigo` é uma sigla estável para a tela).
  - `JSON próprio`: resposta sem envelope padrão (por exemplo `/api/ping`, o ao vivo público e redirecionamentos).
  - `arquivo ou fluxo`: CSV, PDF ou similar.
  - `via helper`: o arquivo delega a um helper que monta a resposta (banco e papeleta; conferir o helper no arquivo).

## Tabela

| Método | Caminho | Flag que liga | Quem acessa | Envelope | Arquivo |
|---|---|---|---|---|---|
| POST | `/api/admin/candidaturas/[id]/aprovar` | nenhuma | admin | { data } / { error, details } | `src/app/api/admin/candidaturas/[id]/aprovar/route.ts` |
| POST | `/api/admin/candidaturas/[id]/reenviar` | nenhuma | admin | { data } / { error, details } | `src/app/api/admin/candidaturas/[id]/reenviar/route.ts` |
| POST | `/api/admin/candidaturas/[id]/rejeitar` | nenhuma | admin | { data } / { error, details } | `src/app/api/admin/candidaturas/[id]/rejeitar/route.ts` |
| GET | `/api/admin/candidaturas` | nenhuma | admin | { data } / { error, details } | `src/app/api/admin/candidaturas/route.ts` |
| GET, POST | `/api/admin/codigos-acesso` | nenhuma | admin | { data } / { error, details } | `src/app/api/admin/codigos-acesso/route.ts` |
| GET, POST, PATCH | `/api/admin/organizadores` | nenhuma | admin | { data } / { error, details } | `src/app/api/admin/organizadores/route.ts` |
| POST | `/api/admin/partidas-candidaturas/[id]/aprovar` | nenhuma | admin | { data } / { error, details } | `src/app/api/admin/partidas-candidaturas/[id]/aprovar/route.ts` |
| GET, POST | `/api/admin/simulacoes` | nenhuma | admin | { data } / { error, details } | `src/app/api/admin/simulacoes/route.ts` |
| GET | `/api/ao-vivo/[partidaId]` | AO_VIVO_ATIVO + SUMULA_EVENTOS_ATIVO | público | JSON próprio | `src/app/api/ao-vivo/[partidaId]/route.ts` |
| GET | `/api/ao-vivo` | AO_VIVO_ATIVO | público | { data } / { error, details } | `src/app/api/ao-vivo/route.ts` |
| GET, POST | `/api/arbitro/jogo/[token]` | nenhuma | token (súmula, árbitro ou banco) | { data } / { error, details } | `src/app/api/arbitro/jogo/[token]/route.ts` |
| POST | `/api/arbitro/partidas/[token]/iniciar` | nenhuma | token (súmula, árbitro ou banco) | { data } / { error, details } | `src/app/api/arbitro/partidas/[token]/iniciar/route.ts` |
| POST | `/api/arbitro/partidas/[token]/numero` | nenhuma | token (súmula, árbitro ou banco) | { data } / { error, details } | `src/app/api/arbitro/partidas/[token]/numero/route.ts` |
| POST | `/api/arbitro/partidas/[token]/presenca` | nenhuma | token (súmula, árbitro ou banco) | { data } / { error, details } | `src/app/api/arbitro/partidas/[token]/presenca/route.ts` |
| GET | `/api/arbitro/partidas/[token]` | nenhuma | token (súmula, árbitro ou banco) | { data } / { error, details } | `src/app/api/arbitro/partidas/[token]/route.ts` |
| POST | `/api/arbitro/partidas/[token]/validar-qr` | nenhuma | token (súmula, árbitro ou banco) | { data } / { error, details } | `src/app/api/arbitro/partidas/[token]/validar-qr/route.ts` |
| POST | `/api/auth/ativar-conta` | nenhuma | público | { data } / { error, details } | `src/app/api/auth/ativar-conta/route.ts` |
| POST | `/api/auth/atividade` | nenhuma | sessão aberta (cookie) | { data } / { error, details } | `src/app/api/auth/atividade/route.ts` |
| POST | `/api/auth/codigo/confirmar` | LOGIN_SEM_SENHA_ATIVO | público (inicia a sessão) | { data } / { error, details } | `src/app/api/auth/codigo/confirmar/route.ts` |
| POST | `/api/auth/codigo/solicitar` | LOGIN_SEM_SENHA_ATIVO | público (inicia a sessão) | { data } / { error, details } | `src/app/api/auth/codigo/solicitar/route.ts` |
| POST | `/api/auth/forgot-password` | nenhuma | público | { data } / { error, details } | `src/app/api/auth/forgot-password/route.ts` |
| GET | `/api/auth/google/inicio` | LOGIN_SEM_SENHA_ATIVO | público (inicia a sessão) | JSON próprio | `src/app/api/auth/google/inicio/route.ts` |
| GET | `/api/auth/google/retorno` | LOGIN_SEM_SENHA_ATIVO | público (inicia a sessão) | { data } / { error, details } | `src/app/api/auth/google/retorno/route.ts` |
| POST | `/api/auth/perfil/trocar` | LOGIN_SEM_SENHA_ATIVO | sessão aberta (qualquer perfil) | { data } / { error, details } | `src/app/api/auth/perfil/trocar/route.ts` |
| GET | `/api/auth/perfis` | LOGIN_SEM_SENHA_ATIVO | sessão aberta (qualquer perfil) | { data } / { error, details } | `src/app/api/auth/perfis/route.ts` |
| POST | `/api/auth/reset-password` | nenhuma | público | { data } / { error, details } | `src/app/api/auth/reset-password/route.ts` |
| POST, DELETE | `/api/auth` | nenhuma | público (login e logout; a senha é conferida no servidor) | { data } / { error, details } | `src/app/api/auth/route.ts` |
| GET | `/api/auth/sessao` | nenhuma | sessão aberta (cookie); sem sessão responde vazio | { data } / { error, details } | `src/app/api/auth/sessao/route.ts` |
| POST | `/api/auth/trocar-senha` | nenhuma | sessão aberta (cookie) | { data } / { error, details } | `src/app/api/auth/trocar-senha/route.ts` |
| POST | `/api/banco/[token]/papeleta/[set]/enviar` | BANCO_APP_ATIVO | token (súmula, árbitro ou banco) | via helper | `src/app/api/banco/[token]/papeleta/[set]/enviar/route.ts` |
| PUT | `/api/banco/[token]/papeleta/[set]` | BANCO_APP_ATIVO | token (súmula, árbitro ou banco) | via helper | `src/app/api/banco/[token]/papeleta/[set]/route.ts` |
| DELETE | `/api/banco/[token]/pedidos/[id]` | BANCO_APP_ATIVO | token (súmula, árbitro ou banco) | via helper | `src/app/api/banco/[token]/pedidos/[id]/route.ts` |
| POST | `/api/banco/[token]/pedidos` | BANCO_APP_ATIVO | token (súmula, árbitro ou banco) | via helper | `src/app/api/banco/[token]/pedidos/route.ts` |
| GET | `/api/banco/[token]` | BANCO_APP_ATIVO | token (súmula, árbitro ou banco) | { data } / { error, details } | `src/app/api/banco/[token]/route.ts` |
| POST, GET, DELETE | `/api/banco/links` | BANCO_APP_ATIVO | organizador | { data } / { error, details } | `src/app/api/banco/links/route.ts` |
| POST | `/api/banco/sessao/[partidaId]/[equipeId]/papeleta/[set]/enviar` | BANCO_SESSAO_ATIVO + BANCO_APP_ATIVO | token (súmula, árbitro ou banco) | via helper | `src/app/api/banco/sessao/[partidaId]/[equipeId]/papeleta/[set]/enviar/route.ts` |
| PUT | `/api/banco/sessao/[partidaId]/[equipeId]/papeleta/[set]` | BANCO_SESSAO_ATIVO + BANCO_APP_ATIVO | token (súmula, árbitro ou banco) | via helper | `src/app/api/banco/sessao/[partidaId]/[equipeId]/papeleta/[set]/route.ts` |
| DELETE | `/api/banco/sessao/[partidaId]/[equipeId]/pedidos/[id]` | BANCO_SESSAO_ATIVO + BANCO_APP_ATIVO | token (súmula, árbitro ou banco) | via helper | `src/app/api/banco/sessao/[partidaId]/[equipeId]/pedidos/[id]/route.ts` |
| POST | `/api/banco/sessao/[partidaId]/[equipeId]/pedidos` | BANCO_SESSAO_ATIVO + BANCO_APP_ATIVO | token (súmula, árbitro ou banco) | via helper | `src/app/api/banco/sessao/[partidaId]/[equipeId]/pedidos/route.ts` |
| GET | `/api/banco/sessao/[partidaId]/[equipeId]` | BANCO_SESSAO_ATIVO + BANCO_APP_ATIVO + MEU_TIME_ATIVO | token (súmula, árbitro ou banco) | { data } / { error, details } | `src/app/api/banco/sessao/[partidaId]/[equipeId]/route.ts` |
| GET, PATCH | `/api/candidaturas/[tipo]/[id]` | nenhuma | dono do cadastro (sessão de equipe, árbitro ou quadra liberada) | { data } / { error, details } | `src/app/api/candidaturas/[tipo]/[id]/route.ts` |
| POST | `/api/candidaturas/arbitros` | nenhuma | público | { data } / { error, details } | `src/app/api/candidaturas/arbitros/route.ts` |
| POST | `/api/candidaturas/equipes` | nenhuma | público | { data } / { error, details } | `src/app/api/candidaturas/equipes/route.ts` |
| POST | `/api/candidaturas/organizadores` | nenhuma | público | { data } / { error, details } | `src/app/api/candidaturas/organizadores/route.ts` |
| POST | `/api/candidaturas/publico` | nenhuma | público | { data } / { error, details } | `src/app/api/candidaturas/publico/route.ts` |
| POST | `/api/candidaturas/quadras` | nenhuma | público | { data } / { error, details } | `src/app/api/candidaturas/quadras/route.ts` |
| GET, PUT | `/api/capitao/equipe` | nenhuma | líder ou técnico (sessão) | { data } / { error, details } | `src/app/api/capitao/equipe/route.ts` |
| GET, POST, DELETE | `/api/capitao/jogadores` | nenhuma | líder ou técnico (sessão) | { data } / { error, details } | `src/app/api/capitao/jogadores/route.ts` |
| GET | `/api/categorias` | nenhuma | público | { data } / { error, details } | `src/app/api/categorias/route.ts` |
| POST | `/api/classificacao/manual` | nenhuma | organizador | { data } / { error, details } | `src/app/api/classificacao/manual/route.ts` |
| GET | `/api/classificacao` | nenhuma | público | { data } / { error, details } | `src/app/api/classificacao/route.ts` |
| GET, POST | `/api/convite-atleta/[token]` | MEU_TIME_FASE2_ATIVO + MEU_TIME_ATIVO | líder ou técnico (sessão) ou token (no caminho) | { data } / { error, codigo? } | `src/app/api/convite-atleta/[token]/route.ts` |
| GET, POST | `/api/convites-equipe` | nenhuma | organizador | { data } / { error, details } | `src/app/api/convites-equipe/route.ts` |
| POST, GET | `/api/cron/expurgo-previas` | MEU_TIME_FASE2_ATIVO + MEU_TIME_ATIVO | cron (segredo no cabeçalho) | JSON próprio | `src/app/api/cron/expurgo-previas/route.ts` |
| POST, GET | `/api/cron/lembretes` | NOTIFICACOES_MULTICANAL_ATIVO | cron (segredo no cabeçalho) | via helper | `src/app/api/cron/lembretes/route.ts` |
| POST, GET | `/api/cron/notificacoes` | NOTIFICACOES_MULTICANAL_ATIVO | cron (segredo no cabeçalho) | via helper | `src/app/api/cron/notificacoes/route.ts` |
| GET, POST | `/api/dev/massa-qa` | nenhuma | admin | { data } / { error, details } | `src/app/api/dev/massa-qa/route.ts` |
| GET, PUT, DELETE | `/api/equipes/[id]` | nenhuma | GET público (filtrado pela sessão, se houver); escrita: organizador (ou admin) | { data } / { error, details } | `src/app/api/equipes/[id]/route.ts` |
| GET, POST | `/api/equipes` | nenhuma | GET público (filtrado pela sessão, se houver); escrita: organizador (ou admin) | { data } / { error, details } | `src/app/api/equipes/route.ts` |
| GET, POST | `/api/galeria` | nenhuma | GET público (filtrado pela sessão, se houver); escrita: organizador (ou admin) | { data } / { error, details } | `src/app/api/galeria/route.ts` |
| POST | `/api/inscricao-rapida/[token]/finalizar` | nenhuma | token (no caminho) | { data } / { error, details } | `src/app/api/inscricao-rapida/[token]/finalizar/route.ts` |
| PATCH, DELETE | `/api/inscricao-rapida/[token]/jogadores/[jogadorId]` | nenhuma | token (no caminho) | { data } / { error, details } | `src/app/api/inscricao-rapida/[token]/jogadores/[jogadorId]/route.ts` |
| POST | `/api/inscricao-rapida/[token]/jogadores` | nenhuma | token (no caminho) | { data } / { error, details } | `src/app/api/inscricao-rapida/[token]/jogadores/route.ts` |
| GET, PATCH | `/api/inscricao-rapida/[token]` | nenhuma | token (no caminho) | { data } / { error, details } | `src/app/api/inscricao-rapida/[token]/route.ts` |
| POST | `/api/inscricao-rapida` | nenhuma | público | { data } / { error, details } | `src/app/api/inscricao-rapida/route.ts` |
| POST | `/api/inscricao/[slug]/jogadores` | nenhuma | público | { data } / { error, details } | `src/app/api/inscricao/[slug]/jogadores/route.ts` |
| GET | `/api/inscricao/entrada/[token]` | INSCRICAO_VIA_MEU_TIME_ATIVO | token (no caminho) | JSON próprio | `src/app/api/inscricao/entrada/[token]/route.ts` |
| GET, POST, PATCH | `/api/inscricoes-campeonato` | nenhuma | organizador ou líder, conforme o método | { data } / { error, details } | `src/app/api/inscricoes-campeonato/route.ts` |
| POST | `/api/interessados` | nenhuma | público | { data } / { error, details } | `src/app/api/interessados/route.ts` |
| PUT, DELETE | `/api/jogadores/[id]` | nenhuma | escrita: organizador | { data } / { error, details } | `src/app/api/jogadores/[id]/route.ts` |
| GET | `/api/jogadores/qr/[token]` | nenhuma | token (no caminho) | { data } / { error, details } | `src/app/api/jogadores/qr/[token]/route.ts` |
| GET, POST | `/api/jogadores` | nenhuma | GET público (sem PII); escrita: organizador | { data } / { error, details } | `src/app/api/jogadores/route.ts` |
| GET, PUT, DELETE | `/api/ligas/[slug]` | nenhuma | GET público (filtrado pela sessão); escrita: organizador ou admin | { data } / { error, details } | `src/app/api/ligas/[slug]/route.ts` |
| GET, POST | `/api/ligas` | nenhuma | GET público (filtrado pela sessão); escrita: organizador ou admin | { data } / { error, details } | `src/app/api/ligas/route.ts` |
| PUT, DELETE | `/api/mensagens/[id]` | nenhuma | admin | { data } / { error, details } | `src/app/api/mensagens/[id]/route.ts` |
| GET, POST | `/api/mensagens` | nenhuma | admin | { data } / { error, details } | `src/app/api/mensagens/route.ts` |
| GET | `/api/meu-time/atletas/[id]/documento-url` | INSCRICAO_SOLICITACAO_ATIVO + MEU_TIME_ATIVO | líder ou técnico (sessão) | { data } / { error, codigo? } | `src/app/api/meu-time/atletas/[id]/documento-url/route.ts` |
| PATCH | `/api/meu-time/atletas/[id]` | MEU_TIME_ATIVO + ELENCO_COMPLETO_ATIVO | líder ou técnico (sessão) | { data } / { error, codigo? } | `src/app/api/meu-time/atletas/[id]/route.ts` |
| GET | `/api/meu-time/campeonatos` | INSCRICAO_SOLICITACAO_ATIVO + INSCRICAO_VIA_MEU_TIME_ATIVO + MEU_TIME_ATIVO | líder ou técnico (sessão) | { data } / { error, codigo? } | `src/app/api/meu-time/campeonatos/route.ts` |
| DELETE | `/api/meu-time/campeonatos/solicitacoes/[id]` | INSCRICAO_SOLICITACAO_ATIVO + MEU_TIME_ATIVO | líder ou técnico (sessão) | { data } / { error, codigo? } | `src/app/api/meu-time/campeonatos/solicitacoes/[id]/route.ts` |
| POST | `/api/meu-time/campeonatos/solicitacoes` | INSCRICAO_SOLICITACAO_ATIVO + MEU_TIME_ATIVO | líder ou técnico (sessão) | { data } / { error, codigo? } | `src/app/api/meu-time/campeonatos/solicitacoes/route.ts` |
| GET | `/api/meu-time/categorias/[categoriaId]/regras` | MEU_TIME_ATIVO | líder ou técnico (sessão) | { data } / { error, codigo? } | `src/app/api/meu-time/categorias/[categoriaId]/regras/route.ts` |
| POST | `/api/meu-time/clube/equipes` | MEU_TIME_FASE2_ATIVO + MEU_TIME_ATIVO | líder ou técnico (sessão) | { data } / { error, codigo? } | `src/app/api/meu-time/clube/equipes/route.ts` |
| GET, POST | `/api/meu-time/clube` | MEU_TIME_FASE2_ATIVO + MEU_TIME_ATIVO | líder ou técnico (sessão) | { data } / { error, codigo? } | `src/app/api/meu-time/clube/route.ts` |
| GET | `/api/meu-time/competicoes` | EXPLORAR_COMPETICOES_ATIVO + INSCRICAO_SOLICITACAO_ATIVO + MEU_TIME_ATIVO | líder ou técnico (sessão) | { data } / { error, codigo? } | `src/app/api/meu-time/competicoes/route.ts` |
| DELETE | `/api/meu-time/convites/[id]` | MEU_TIME_FASE2_ATIVO + MEU_TIME_ATIVO | líder ou técnico (sessão) | { data } / { error, codigo? } | `src/app/api/meu-time/convites/[id]/route.ts` |
| POST, GET | `/api/meu-time/convites` | MEU_TIME_FASE2_ATIVO + MEU_TIME_ATIVO | líder ou técnico (sessão) | { data } / { error, codigo? } | `src/app/api/meu-time/convites/route.ts` |
| POST, DELETE | `/api/meu-time/equipes/[id]/atletas/[atletaId]/consentimento` | MEU_TIME_ATIVO | líder ou técnico (sessão) | { data } / { error, codigo? } | `src/app/api/meu-time/equipes/[id]/atletas/[atletaId]/consentimento/route.ts` |
| PATCH, DELETE | `/api/meu-time/equipes/[id]/atletas/[atletaId]` | ELENCO_COMPLETO_ATIVO + MEU_TIME_ATIVO | líder ou técnico (sessão) | { data } / { error, codigo? } | `src/app/api/meu-time/equipes/[id]/atletas/[atletaId]/route.ts` |
| POST | `/api/meu-time/equipes/[id]/atletas/lote` | MEU_TIME_ATIVO | líder ou técnico (sessão) | { data } / { error, codigo? } | `src/app/api/meu-time/equipes/[id]/atletas/lote/route.ts` |
| POST | `/api/meu-time/equipes/[id]/atletas` | MEU_TIME_ATIVO | líder ou técnico (sessão) | { data } / { error, codigo? } | `src/app/api/meu-time/equipes/[id]/atletas/route.ts` |
| DELETE | `/api/meu-time/equipes/[id]/comissao/[membroId]` | MEU_TIME_ATIVO | líder ou técnico (sessão) | { data } / { error, codigo? } | `src/app/api/meu-time/equipes/[id]/comissao/[membroId]/route.ts` |
| GET, POST | `/api/meu-time/equipes/[id]/comissao` | MEU_TIME_ATIVO | líder ou técnico (sessão) | { data } / { error, codigo? } | `src/app/api/meu-time/equipes/[id]/comissao/route.ts` |
| GET | `/api/meu-time/equipes/[id]/consentimentos` | MEU_TIME_ATIVO | líder ou técnico (sessão) | { data } / { error, codigo? } | `src/app/api/meu-time/equipes/[id]/consentimentos/route.ts` |
| POST | `/api/meu-time/equipes/[id]/inscricoes` | MEU_TIME_ATIVO | líder ou técnico (sessão) | { data } / { error, codigo? } | `src/app/api/meu-time/equipes/[id]/inscricoes/route.ts` |
| GET, POST, DELETE | `/api/meu-time/equipes/[id]/membros` | MEU_TIME_ATIVO | líder ou técnico (sessão) | { data } / { error, codigo? } | `src/app/api/meu-time/equipes/[id]/membros/route.ts` |
| GET | `/api/meu-time/equipes/[id]/prontidao` | ELENCO_COMPLETO_ATIVO + MEU_TIME_ATIVO | líder ou técnico (sessão) | { data } / { error, codigo? } | `src/app/api/meu-time/equipes/[id]/prontidao/route.ts` |
| GET, PATCH | `/api/meu-time/equipes/[id]` | ELENCO_COMPLETO_ATIVO + MEU_TIME_ATIVO | líder ou técnico (sessão) | { data } / { error, codigo? } | `src/app/api/meu-time/equipes/[id]/route.ts` |
| POST | `/api/meu-time/equipes` | MEU_TIME_ATIVO | líder ou técnico (sessão) | { data } / { error, codigo? } | `src/app/api/meu-time/equipes/route.ts` |
| POST | `/api/meu-time/importacao/[id]/confirmar` | MEU_TIME_FASE2_ATIVO + MEU_TIME_ATIVO | líder ou técnico (sessão) | { data } / { error, codigo? } | `src/app/api/meu-time/importacao/[id]/confirmar/route.ts` |
| DELETE | `/api/meu-time/importacao/[id]` | MEU_TIME_FASE2_ATIVO + MEU_TIME_ATIVO | líder ou técnico (sessão) | { data } / { error, codigo? } | `src/app/api/meu-time/importacao/[id]/route.ts` |
| POST | `/api/meu-time/importacao` | MEU_TIME_FASE2_ATIVO + MEU_TIME_ATIVO | líder ou técnico (sessão) | { data } / { error, codigo? } | `src/app/api/meu-time/importacao/route.ts` |
| PATCH | `/api/meu-time/inscricoes/[id]/atletas` | INSCRICAO_SOLICITACAO_ATIVO + ELENCO_COMPLETO_ATIVO + MEU_TIME_ATIVO | líder ou técnico (sessão) | { data } / { error, codigo? } | `src/app/api/meu-time/inscricoes/[id]/atletas/route.ts` |
| GET, POST | `/api/meu-time/inscricoes/[id]/comentarios` | PAINEL_INSCRICOES_ATIVO + INSCRICAO_SOLICITACAO_ATIVO + MEU_TIME_ATIVO | líder ou técnico (sessão) | { data } / { error, codigo? } | `src/app/api/meu-time/inscricoes/[id]/comentarios/route.ts` |
| DELETE | `/api/meu-time/inscricoes/[id]/pedidos-troca/[pedidoId]` | INSCRICAO_SOLICITACAO_ATIVO + ELENCO_COMPLETO_ATIVO + MEU_TIME_ATIVO | líder ou técnico (sessão) | { data } / { error, codigo? } | `src/app/api/meu-time/inscricoes/[id]/pedidos-troca/[pedidoId]/route.ts` |
| GET, POST | `/api/meu-time/inscricoes/[id]/pedidos-troca` | INSCRICAO_SOLICITACAO_ATIVO + ELENCO_COMPLETO_ATIVO + MEU_TIME_ATIVO | líder ou técnico (sessão) | { data } / { error, codigo? } | `src/app/api/meu-time/inscricoes/[id]/pedidos-troca/route.ts` |
| GET | `/api/meu-time/jogos` | INSCRICAO_SOLICITACAO_ATIVO + BANCO_SESSAO_ATIVO + BANCO_APP_ATIVO + MEU_TIME_ATIVO | líder ou técnico (sessão) | { data } / { error, codigo? } | `src/app/api/meu-time/jogos/route.ts` |
| POST | `/api/meu-time/notificacoes/[id]/lida` | MEU_TIME_FASE2_ATIVO + MEU_TIME_ATIVO | líder ou técnico (sessão) | { data } / { error, codigo? } | `src/app/api/meu-time/notificacoes/[id]/lida/route.ts` |
| GET | `/api/meu-time/notificacoes` | MEU_TIME_FASE2_ATIVO + MEU_TIME_ATIVO | líder ou técnico (sessão) | { data } / { error, codigo? } | `src/app/api/meu-time/notificacoes/route.ts` |
| GET | `/api/meu-time` | MEU_TIME_ATIVO | líder ou técnico (sessão) | { data } / { error, codigo? } | `src/app/api/meu-time/route.ts` |
| POST | `/api/meu-time/uploads/assinar` | INSCRICAO_SOLICITACAO_ATIVO + MEU_TIME_ATIVO | líder ou técnico (sessão) | { data } / { error, codigo? } | `src/app/api/meu-time/uploads/assinar/route.ts` |
| POST | `/api/meu-time/uploads/confirmar` | INSCRICAO_SOLICITACAO_ATIVO + MEU_TIME_ATIVO | líder ou técnico (sessão) | { data } / { error, codigo? } | `src/app/api/meu-time/uploads/confirmar/route.ts` |
| GET, PUT | `/api/notificacoes/preferencias` | NOTIFICACOES_MULTICANAL_ATIVO + MEU_TIME_ATIVO | líder ou técnico (sessão) | { data } / { error, codigo? } | `src/app/api/notificacoes/preferencias/route.ts` |
| POST, DELETE | `/api/notificacoes/push/assinar` | NOTIFICACOES_MULTICANAL_ATIVO + MEU_TIME_ATIVO | líder ou técnico (sessão) | { data } / { error, codigo? } | `src/app/api/notificacoes/push/assinar/route.ts` |
| GET | `/api/notificacoes/push/chave` | NOTIFICACOES_MULTICANAL_ATIVO + MEU_TIME_ATIVO | líder ou técnico (sessão) | { data } / { error, codigo? } | `src/app/api/notificacoes/push/chave/route.ts` |
| GET, POST, PATCH | `/api/organizador/arbitros` | nenhuma | organizador | { data } / { error, details } | `src/app/api/organizador/arbitros/route.ts` |
| GET, PUT | `/api/organizador/categorias/[id]/inscricao` | INSCRICAO_SOLICITACAO_ATIVO + MEU_TIME_ATIVO | organizador | { data } / { error, codigo? } | `src/app/api/organizador/categorias/[id]/inscricao/route.ts` |
| GET, PUT | `/api/organizador/categorias/[id]/regra-elenco` | INSCRICAO_SOLICITACAO_ATIVO + ELENCO_COMPLETO_ATIVO + MEU_TIME_ATIVO | organizador | { data } / { error, codigo? } | `src/app/api/organizador/categorias/[id]/regra-elenco/route.ts` |
| GET | `/api/organizador/elenco` | nenhuma | organizador | { data } / { error, details } | `src/app/api/organizador/elenco/route.ts` |
| GET, POST, DELETE | `/api/organizador/equipe` | PAINEL_INSCRICOES_ATIVO + MEU_TIME_ATIVO | organizador | { data } / { error, codigo? } | `src/app/api/organizador/equipe/route.ts` |
| GET | `/api/organizador/inscricoes/[inscricaoId]/atletas/[atletaId]/documento-url` | INSCRICAO_SOLICITACAO_ATIVO + MEU_TIME_ATIVO | organizador | { data } / { error, codigo? } | `src/app/api/organizador/inscricoes/[inscricaoId]/atletas/[atletaId]/documento-url/route.ts` |
| POST | `/api/organizador/inscricoes/[inscricaoId]/decidir` | PAINEL_INSCRICOES_ATIVO + MEU_TIME_ATIVO | organizador | { data } / { error, codigo? } | `src/app/api/organizador/inscricoes/[inscricaoId]/decidir/route.ts` |
| GET | `/api/organizador/inscricoes/[inscricaoId]` | PAINEL_INSCRICOES_ATIVO + MEU_TIME_ATIVO | organizador | { data } / { error, codigo? } | `src/app/api/organizador/inscricoes/[inscricaoId]/route.ts` |
| GET | `/api/organizador/inscricoes/exportar` | PAINEL_INSCRICOES_ATIVO | organizador | arquivo ou fluxo | `src/app/api/organizador/inscricoes/exportar/route.ts` |
| POST | `/api/organizador/inscricoes/lote` | PAINEL_INSCRICOES_ATIVO + MEU_TIME_ATIVO | organizador | { data } / { error, codigo? } | `src/app/api/organizador/inscricoes/lote/route.ts` |
| GET | `/api/organizador/inscricoes` | PAINEL_INSCRICOES_ATIVO + MEU_TIME_ATIVO | organizador | { data } / { error, codigo? } | `src/app/api/organizador/inscricoes/route.ts` |
| PATCH | `/api/organizador/ligas/[id]/calendario` | nenhuma | organizador | { data } / { error, details } | `src/app/api/organizador/ligas/[id]/calendario/route.ts` |
| POST | `/api/organizador/ligas/[id]/categoria-inicial` | nenhuma | organizador | { data } / { error, details } | `src/app/api/organizador/ligas/[id]/categoria-inicial/route.ts` |
| GET | `/api/organizador/ligas/[id]/categorias/preco` | nenhuma | organizador | { data } / { error, details } | `src/app/api/organizador/ligas/[id]/categorias/preco/route.ts` |
| POST | `/api/organizador/ligas/[id]/categorias/replicar` | nenhuma | organizador | { data } / { error, details } | `src/app/api/organizador/ligas/[id]/categorias/replicar/route.ts` |
| GET, PUT | `/api/organizador/ligas/[id]/categorias` | nenhuma | organizador | { data } / { error, details } | `src/app/api/organizador/ligas/[id]/categorias/route.ts` |
| GET, POST | `/api/organizador/ligas/[id]/estrutura` | nenhuma | organizador | { data } / { error, details } | `src/app/api/organizador/ligas/[id]/estrutura/route.ts` |
| POST | `/api/organizador/ligas/[id]/finalizar` | nenhuma | organizador | { data } / { error, details } | `src/app/api/organizador/ligas/[id]/finalizar/route.ts` |
| PATCH, DELETE | `/api/organizador/ligas/[id]/galeria/[midiaId]` | nenhuma | organizador | { data } / { error, details } | `src/app/api/organizador/ligas/[id]/galeria/[midiaId]/route.ts` |
| GET, POST | `/api/organizador/ligas/[id]/link-inscricao` | nenhuma | organizador | { data } / { error, details } | `src/app/api/organizador/ligas/[id]/link-inscricao/route.ts` |
| GET, POST | `/api/organizador/ligas/[id]/links-categoria` | nenhuma | organizador | { data } / { error, details } | `src/app/api/organizador/ligas/[id]/links-categoria/route.ts` |
| POST | `/api/organizador/ligas/[id]/mata-mata/gerar` | nenhuma | organizador | { data } / { error, details } | `src/app/api/organizador/ligas/[id]/mata-mata/gerar/route.ts` |
| POST | `/api/organizador/ligas/[id]/mata-mata` | nenhuma | organizador | { data } / { error, details } | `src/app/api/organizador/ligas/[id]/mata-mata/route.ts` |
| GET, POST | `/api/organizador/ligas/[id]/mata-mata/vagas` | nenhuma | organizador | { data } / { error, details } | `src/app/api/organizador/ligas/[id]/mata-mata/vagas/route.ts` |
| POST | `/api/organizador/ligas/[id]/pagamento/confirmar` | nenhuma | organizador | { data } / { error, details } | `src/app/api/organizador/ligas/[id]/pagamento/confirmar/route.ts` |
| GET | `/api/organizador/ligas/[id]/pagamento` | PAGAMENTO_HABILITADO (desligada: responde pagamento desativado, não 404) | organizador | { data } / { error, details } | `src/app/api/organizador/ligas/[id]/pagamento/route.ts` |
| PATCH, DELETE | `/api/organizador/ligas/[id]/setup/calendario/locais/[localId]` | nenhuma | organizador | { data } / { error, details } | `src/app/api/organizador/ligas/[id]/setup/calendario/locais/[localId]/route.ts` |
| GET, POST | `/api/organizador/ligas/[id]/setup/calendario/locais` | nenhuma | organizador | { data } / { error, details } | `src/app/api/organizador/ligas/[id]/setup/calendario/locais/route.ts` |
| GET, PATCH | `/api/organizador/ligas/[id]/setup/calendario` | nenhuma | organizador | { data } / { error, details } | `src/app/api/organizador/ligas/[id]/setup/calendario/route.ts` |
| GET, PATCH | `/api/organizador/ligas/[id]/setup/classificacao` | nenhuma | organizador | { data } / { error, details } | `src/app/api/organizador/ligas/[id]/setup/classificacao/route.ts` |
| GET, PATCH | `/api/organizador/ligas/[id]/setup/eliminatorias` | nenhuma | organizador | { data } / { error, details } | `src/app/api/organizador/ligas/[id]/setup/eliminatorias/route.ts` |
| GET, PATCH | `/api/organizador/ligas/[id]/setup/estrutura` | nenhuma | organizador | { data } / { error, details } | `src/app/api/organizador/ligas/[id]/setup/estrutura/route.ts` |
| GET, PATCH | `/api/organizador/ligas/[id]/setup/informacoes` | nenhuma | organizador | { data } / { error, details } | `src/app/api/organizador/ligas/[id]/setup/informacoes/route.ts` |
| GET, PATCH | `/api/organizador/ligas/[id]/setup/inscricoes` | nenhuma | organizador | { data } / { error, details } | `src/app/api/organizador/ligas/[id]/setup/inscricoes/route.ts` |
| GET | `/api/organizador/ligas/[id]/setup/previa` | PAGAMENTO_HABILITADO (só muda o preço mostrado) | organizador | { data } / { error, details } | `src/app/api/organizador/ligas/[id]/setup/previa/route.ts` |
| GET | `/api/organizador/ligas/[id]/setup` | nenhuma | organizador | { data } / { error, details } | `src/app/api/organizador/ligas/[id]/setup/route.ts` |
| GET, POST | `/api/organizador/ligas/[id]/vagas-inscricao` | nenhuma | organizador | { data } / { error, details } | `src/app/api/organizador/ligas/[id]/vagas-inscricao/route.ts` |
| POST | `/api/organizador/notificacoes/[id]/lida` | INSCRICAO_SOLICITACAO_ATIVO + MEU_TIME_ATIVO | organizador | { data } / { error, codigo? } | `src/app/api/organizador/notificacoes/[id]/lida/route.ts` |
| GET | `/api/organizador/notificacoes` | INSCRICAO_SOLICITACAO_ATIVO + MEU_TIME_ATIVO | organizador | { data } / { error, codigo? } | `src/app/api/organizador/notificacoes/route.ts` |
| GET, POST | `/api/organizador/partidas/[id]/acesso-arbitro` | nenhuma | organizador | { data } / { error, details } | `src/app/api/organizador/partidas/[id]/acesso-arbitro/route.ts` |
| PATCH | `/api/organizador/partidas/[id]/arbitro` | nenhuma | organizador | { data } / { error, details } | `src/app/api/organizador/partidas/[id]/arbitro/route.ts` |
| GET | `/api/organizador/partidas` | nenhuma | organizador | { data } / { error, details } | `src/app/api/organizador/partidas/route.ts` |
| POST | `/api/organizador/pedidos-troca/[id]/decidir` | INSCRICAO_SOLICITACAO_ATIVO + ELENCO_COMPLETO_ATIVO + MEU_TIME_ATIVO | organizador | { data } / { error, codigo? } | `src/app/api/organizador/pedidos-troca/[id]/decidir/route.ts` |
| GET | `/api/organizador/pedidos-troca` | INSCRICAO_SOLICITACAO_ATIVO + ELENCO_COMPLETO_ATIVO + MEU_TIME_ATIVO | organizador | { data } / { error, codigo? } | `src/app/api/organizador/pedidos-troca/route.ts` |
| GET, PATCH | `/api/organizador/perfil` | nenhuma | organizador | { data } / { error, details } | `src/app/api/organizador/perfil/route.ts` |
| GET, PATCH | `/api/organizador/quadras` | nenhuma | organizador | { data } / { error, details } | `src/app/api/organizador/quadras/route.ts` |
| POST | `/api/organizador/solicitacoes/[id]/decidir` | INSCRICAO_SOLICITACAO_ATIVO + MEU_TIME_ATIVO | organizador | { data } / { error, codigo? } | `src/app/api/organizador/solicitacoes/[id]/decidir/route.ts` |
| GET | `/api/organizador/solicitacoes` | INSCRICAO_SOLICITACAO_ATIVO + MEU_TIME_ATIVO | organizador | { data } / { error, codigo? } | `src/app/api/organizador/solicitacoes/route.ts` |
| GET | `/api/partidas/[id]/ao-vivo` | nenhuma | público (acompanhamento; o token de árbitro, se enviado, só amplia) | { data } / { error, details } | `src/app/api/partidas/[id]/ao-vivo/route.ts` |
| POST | `/api/partidas/[id]/aprovar` | nenhuma | organizador | { data } / { error, details } | `src/app/api/partidas/[id]/aprovar/route.ts` |
| GET, PUT | `/api/partidas/[id]` | nenhuma | GET público (filtrado pela sessão, se houver); escrita: organizador (ou admin) | { data } / { error, details } | `src/app/api/partidas/[id]/route.ts` |
| GET | `/api/partidas/[id]/sumula-publica` | nenhuma | público | { data } / { error, details } | `src/app/api/partidas/[id]/sumula-publica/route.ts` |
| GET, POST | `/api/partidas` | nenhuma | GET público (filtrado pela sessão, se houver); escrita: organizador (ou admin) | { data } / { error, details } | `src/app/api/partidas/route.ts` |
| GET | `/api/ping` | nenhuma | público | JSON próprio | `src/app/api/ping/route.ts` |
| GET | `/api/portal-home` | nenhuma | organizador | { data } / { error, details } | `src/app/api/portal-home/route.ts` |
| GET | `/api/portal/ativos` | nenhuma | público | { data } / { error, details } | `src/app/api/portal/ativos/route.ts` |
| GET | `/api/portal/campeonatos` | nenhuma | público | { data } / { error, details } | `src/app/api/portal/campeonatos/route.ts` |
| GET | `/api/portal/classificacao` | nenhuma | público | { data } / { error, details } | `src/app/api/portal/classificacao/route.ts` |
| GET | `/api/portal/galeria` | nenhuma | público | { data } / { error, details } | `src/app/api/portal/galeria/route.ts` |
| GET | `/api/portal/jogos` | nenhuma | público | { data } / { error, details } | `src/app/api/portal/jogos/route.ts` |
| GET | `/api/portal/mata-mata` | nenhuma | público | { data } / { error, details } | `src/app/api/portal/mata-mata/route.ts` |
| GET | `/api/portal/rankings/jogadores` | nenhuma | público | { data } / { error, details } | `src/app/api/portal/rankings/jogadores/route.ts` |
| GET | `/api/portal/rankings` | nenhuma | público | { data } / { error, details } | `src/app/api/portal/rankings/route.ts` |
| GET | `/api/rankings` | nenhuma | público | { data } / { error, details } | `src/app/api/rankings/route.ts` |
| GET | `/api/regras-elenco/modelos` | ELENCO_COMPLETO_ATIVO + MEU_TIME_ATIVO | organizador | { data } / { error, codigo? } | `src/app/api/regras-elenco/modelos/route.ts` |
| GET, PATCH | `/api/resultados-manuais` | nenhuma | organizador | { data } / { error, details } | `src/app/api/resultados-manuais/route.ts` |
| PATCH, DELETE | `/api/scout/[token]/acoes/[id]` | SCOUT_ATIVO | token (súmula, árbitro ou banco) | { data } / { error, details } | `src/app/api/scout/[token]/acoes/[id]/route.ts` |
| GET, POST | `/api/scout/[token]/acoes` | SCOUT_ATIVO + SUMULA_EVENTOS_ATIVO | token (súmula, árbitro ou banco) | { data } / { error, details } | `src/app/api/scout/[token]/acoes/route.ts` |
| GET | `/api/scout/[token]/exportar` | SCOUT_ATIVO + SUMULA_EVENTOS_ATIVO | token (súmula, árbitro ou banco) | arquivo ou fluxo | `src/app/api/scout/[token]/exportar/route.ts` |
| GET | `/api/scout/[token]/resumo` | SCOUT_ATIVO + SUMULA_EVENTOS_ATIVO | token (súmula, árbitro ou banco) | { data } / { error, details } | `src/app/api/scout/[token]/resumo/route.ts` |
| POST | `/api/sumula/[token]/desafios/[id]/decidir` | DESAFIO_ATIVO + SUMULA_EVENTOS_ATIVO | token (súmula, árbitro ou banco) | { data } / { error, details } | `src/app/api/sumula/[token]/desafios/[id]/decidir/route.ts` |
| GET, POST | `/api/sumula/[token]/desafios` | DESAFIO_ATIVO | token (súmula, árbitro ou banco) | { data } / { error, details } | `src/app/api/sumula/[token]/desafios/route.ts` |
| GET, POST | `/api/sumula/[token]/eventos` | SUMULA_EVENTOS_ATIVO | token (súmula, árbitro ou banco) | { data } / { error, details } | `src/app/api/sumula/[token]/eventos/route.ts` |
| GET | `/api/meu-time/inscricoes/[id]/pagamento` | MEU_TIME_ATIVO + PAGAMENTO_COMPROVANTE_ATIVO | líder (RESPONSAVEL ou TECNICO) | { data } / { error, codigo? } | `src/app/api/meu-time/inscricoes/[id]/pagamento/route.ts` |
| GET, PUT | `/api/organizador/categorias/[id]/pagamento` | PAGAMENTO_COMPROVANTE_ATIVO | organizador (escrita: dono ou ADMINISTRADOR) | { data } / { error, codigo? } | `src/app/api/organizador/categorias/[id]/pagamento/route.ts` |
| GET | `/api/organizador/inscricoes/[inscricaoId]/pagamento` | PAGAMENTO_COMPROVANTE_ATIVO | organizador | { data } / { error, codigo? } | `src/app/api/organizador/inscricoes/[inscricaoId]/pagamento/route.ts` |
| GET | `/api/organizador/inscricoes/[inscricaoId]/pagamento/comprovante-url` | PAGAMENTO_COMPROVANTE_ATIVO | organizador (dono, ADMINISTRADOR ou FINANCEIRO) | { data } / { error, codigo? } | `src/app/api/organizador/inscricoes/[inscricaoId]/pagamento/comprovante-url/route.ts` |
| POST | `/api/organizador/inscricoes/[inscricaoId]/pagamento/decidir` | PAGAMENTO_COMPROVANTE_ATIVO | organizador (dono, ADMINISTRADOR ou FINANCEIRO) | { data } / { error, codigo? } | `src/app/api/organizador/inscricoes/[inscricaoId]/pagamento/decidir/route.ts` |
| GET | `/api/sumula/[token]/pdf` | SUMULA_PDF_ATIVO | token da súmula | arquivo PDF / { error } | `src/app/api/sumula/[token]/pdf/route.ts` |
| POST | `/api/sumula/[token]/papeleta/[set]/[equipeId]/aceitar` | BANCO_APP_ATIVO | token (súmula, árbitro ou banco) | via helper | `src/app/api/sumula/[token]/papeleta/[set]/[equipeId]/aceitar/route.ts` |
| GET | `/api/sumula/[token]/papeleta/[set]` | BANCO_APP_ATIVO | token (súmula, árbitro ou banco) | via helper | `src/app/api/sumula/[token]/papeleta/[set]/route.ts` |
| POST | `/api/sumula/[token]/pedidos-banco/[id]/decidir` | BANCO_APP_ATIVO | token (súmula, árbitro ou banco) | via helper | `src/app/api/sumula/[token]/pedidos-banco/[id]/decidir/route.ts` |
| GET | `/api/sumula/[token]/pedidos-banco` | BANCO_APP_ATIVO | token (súmula, árbitro ou banco) | via helper | `src/app/api/sumula/[token]/pedidos-banco/route.ts` |
| GET, POST, PUT | `/api/sumula/[token]` | nenhuma | token (súmula, árbitro ou banco) | { data } / { error, details } | `src/app/api/sumula/[token]/route.ts` |
| POST | `/api/uploads/assinar` | ELENCO_COMPLETO_ATIVO | organizador ou líder | { data } / { error, details } | `src/app/api/uploads/assinar/route.ts` |
| GET | `/api/uploads/documento` | ELENCO_COMPLETO_ATIVO | líder ou técnico (sessão) | { data } / { error, details } | `src/app/api/uploads/documento/route.ts` |
| POST | `/api/webhooks/infinitepay` | nenhuma | webhook externo desativado (responde 410 a qualquer evento) | JSON próprio | `src/app/api/webhooks/infinitepay/route.ts` |

## Observações

- Rotas por área (arquivos): admin, arbitro, auth, banco, candidaturas, capitao, convite-atleta, cron, inscricao-rapida, meu-time, notificacoes, organizador, portal, scout, sumula, uploads e as rotas legadas de leitura e escrita do organizador (equipes, jogadores, partidas, ligas).
- Rotas **novas das rodadas 15 a 18** (todas atrás de flag): `auth/codigo/*`, `auth/google/*`, `auth/perfis`, `auth/perfil/trocar` (login sem senha); `meu-time/uploads/*`, `uploads/*`, `regras-elenco/modelos`, `meu-time/inscricoes/[id]/pedidos-troca`, `organizador/pedidos-troca` (elenco completo); `organizador/inscricoes/*`, `meu-time/inscricoes/[id]/comentarios` (painel de inscrições); `meu-time/competicoes` (explorar competições); `notificacoes/*`, `cron/lembretes`, `cron/notificacoes` (notificações multicanal).
- `GET /api/meu-time/atletas/[id]/documento-url` e `GET /api/organizador/inscricoes/[inscricaoId]/atletas/[atletaId]/documento-url` devolvem link temporário de documento de atleta (dado pessoal): conferir sempre a LGPD (`docs/analise/25-lgpd-menores.md`).
- Pagamento por comprovante **não existe no código**. A confirmação de pagamento hoje é a simulada (`organizador/ligas/[id]/pagamento/confirmar`, fechada por padrão: só admin, ou organizador com `ALLOW_SIMULATED_PAYMENT_CONFIRMATION`); o webhook da InfinitePay está desativado e responde 410.
- Contrato OpenAPI: `docs/analise/07-api-contrato.yaml` (rotas legadas e as da rodada 19 listadas ao final) e `docs/analise/20-contrato-meu-time.yaml`.
