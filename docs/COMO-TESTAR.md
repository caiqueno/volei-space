# Como testar o volei.space (fluxo atual)

Roteiro manual para conferir o produto de ponta a ponta no ambiente **local ou de desenvolvimento**. Nunca use o banco de produção. Não há credencial padrão: use a conta de administrador do seu ambiente (tabela `Admin`, com `ADMIN_EMAIL` definido).

## Antes de começar

```bash
npm run setup      # dependências, .env.local e Prisma Client
npm run dev        # http://localhost:3000
```

Confira que o `.env.local` aponta para o projeto de **desenvolvimento** (ou para o Supabase local). Para a suíte automática: `npm run test:unit`, `npm run typecheck` e `npm run build`.

## 1. Organizador cria o campeonato

1. Entre como organizador liberado (cadastro de organizador aprovado pelo administrador).
2. Crie um campeonato e passe pela central de parametrização: informações, categorias, inscrições, calendário e regras.
3. Crie uma categoria e **gere o link de inscrição da categoria** (`/inscricao/categoria/[token]`).
4. Confirme: a inscrição é automática (não existe fila de aprovação) e o limite de vagas é respeitado.

## 2. Líder cadastra a equipe

1. Abra o link da categoria no **celular** (de preferência pelo WhatsApp).
2. Informe o nome da equipe e continue. Guarde o link de continuação: sem conta, ele é a única forma de voltar ao rascunho.
3. Cadastre os atletas, um por um ou com **Colar lista** (nome e número).
4. Confira o contador de elenco e a mensagem do botão "Concluir" quando ele está desabilitado.
5. Conclua. A equipe aparece como inscrita no painel do organizador, sem aprovação.

## 3. Jogos e súmula

1. Gere a tabela de jogos da categoria.
2. Abra a súmula do jogo (`/sumula/[token]`) e escale os times.
3. Lance pontos: o "+1" grava na hora; a faixa "Quem fez?" aparece por alguns segundos, com "Desfazer".
4. Faça uma substituição e confira o contador "Troca X de N" e os motivos de bloqueio.
5. Encerre os sets, escolha o MVP e feche a súmula.

## 4. Classificação e público

1. Confira a classificação da categoria (`/classificacao`) depois do fechamento da súmula.
2. Abra o placar ao vivo (`/partidas/[id]/ao-vivo`) e o placar de telão (`/placar/[id]`, com `?fundo=transparente` para transmissão). Derrube a conexão e confira que o último placar permanece.
3. Confira que nenhuma página pública mostra CPF, documento, telefone ou data de nascimento de atletas.

## 5. Segurança (rápido)

- Login com senha errada muitas vezes devolve "Muitas tentativas" (429).
- Um organizador não enxerga campeonatos, equipes ou súmulas de outro.
- O link de recuperação de senha do administrador só serve para trocar a senha, nunca como sessão.

## Rodadas 9 a 14: como ligar cada módulo em desenvolvimento

Tudo vem desligado. Em `.env.local`, descomente (seção própria em `.env.example`) a flag de servidor e a de tela do módulo:

| Módulo | Servidor | Tela |
| --- | --- | --- |
| Aplicativo do banco | `BANCO_APP_ATIVO` | `NEXT_PUBLIC_BANCO_APP_ATIVO` |
| Scout | `SCOUT_ATIVO` | `NEXT_PUBLIC_SCOUT_ATIVO` |
| Desafio por vídeo | `DESAFIO_ATIVO` (`DESAFIO_LIMITE_POR_SET`) | `NEXT_PUBLIC_DESAFIO_ATIVO` |
| Placar ao vivo | `AO_VIVO_ATIVO` | `NEXT_PUBLIC_AO_VIVO_ATIVO` |
| Meu Time | `MEU_TIME_ATIVO`, `MEU_TIME_FASE2_ATIVO` | `NEXT_PUBLIC_MEU_TIME_FASE2_ATIVO` |
| Solicitar vaga em campeonato (R14; exige Meu Time e a migration 0043) | `INSCRICAO_SOLICITACAO_ATIVO` | `NEXT_PUBLIC_INSCRICAO_SOLICITACAO_ATIVO` |
| Banco pela conta do Meu Time e "Meus jogos" (R14; exige banco e Meu Time) | `BANCO_SESSAO_ATIVO` | `NEXT_PUBLIC_BANCO_SESSAO_ATIVO` |
| Eventos da súmula | `SUMULA_EVENTOS_ATIVO`, `SUMULA_SERVIDOR_SOMBRA` | `NEXT_PUBLIC_SUMULA_EVENTOS_ATIVO` |
| Protótipos | nenhuma | `NEXT_PUBLIC_PROTOTIPO_ATIVO` |

### Rodadas 15 a 18: módulos acrescentados

Mesma regra: tudo desligado, valor exato `1`, reinício do servidor (e novo build para `NEXT_PUBLIC_*`). Exceto o login sem senha, todos exigem também `MEU_TIME_ATIVO`.

| Módulo | Servidor | Tela | Observação |
| --- | --- | --- | --- |
| Inscrição pelo Meu Time (porta de entrada dos links do organizador, R15) | `INSCRICAO_VIA_MEU_TIME_ATIVO` | `NEXT_PUBLIC_INSCRICAO_VIA_MEU_TIME_ATIVO` | Exige `INSCRICAO_SOLICITACAO_ATIVO`; a variável de servidor ainda não consta no `.env.example` |
| Login sem senha e troca de perfil (R16) | `LOGIN_SEM_SENHA_ATIVO`, `GOOGLE_LOGIN_ATIVO` | `NEXT_PUBLIC_LOGIN_SEM_SENHA_ATIVO`, `NEXT_PUBLIC_LOGIN_WHATSAPP_ATIVO` | Migrations 0045 a 0047. Em desenvolvimento use `LOGIN_CODIGO_DEV_CONSOLE=1` (o código sai no terminal); WhatsApp exige `WHATSAPP_WEBHOOK_URL` e `LGPD_CHAVE_CIFRA` |
| Elenco completo: foto, documento, CPF, regras de elenco, pedido de troca (R17) | `ELENCO_COMPLETO_ATIVO` | `NEXT_PUBLIC_ELENCO_COMPLETO_ATIVO` | Migrations 0048 a 0050, os três buckets do Storage, `LGPD_CHAVE_CIFRA` e, opcional, `LGPD_PEPPER_HASH` |
| Painel de inscrições do organizador e equipe do organizador (R18) | `PAINEL_INSCRICOES_ATIVO` | `NEXT_PUBLIC_PAINEL_INSCRICOES_ATIVO` | Migrations 0051 e 0052 |
| Explorar competições com selo de elegibilidade (R18) | `EXPLORAR_COMPETICOES_ATIVO` | `NEXT_PUBLIC_EXPLORAR_COMPETICOES_ATIVO` | Exige `INSCRICAO_SOLICITACAO_ATIVO` |
| Notificações por e-mail, WhatsApp e push (R18) | `NOTIFICACOES_MULTICANAL_ATIVO` | `NEXT_PUBLIC_NOTIFICACOES_MULTICANAL_ATIVO` | Migration 0053; `CRON_SECRET` e `VAPID_*` para os envios agendados e o push; nada está agendado |

Quais rotas cada flag liga, e quem as acessa: `docs/analise/32-inventario-api.md`. Migrations 0045 a 0053 seguem o mesmo cuidado das anteriores (preview, uma por vez, na ordem do doc 16).

### Dados de exemplo (seed)

`supabase/seed.sql` cria, num banco **de desenvolvimento**, 1 liga pública fictícia com 2 categorias (Masculino e Feminino), 6 equipes, 48 jogadores com nomes inventados e 6 jogos (3 encerrados, 1 em andamento, 2 agendados). Cole no SQL Editor; pode repetir sem duplicar. Os ids ficam na faixa 9001, 9101 a 9106 e 9201 a 9206. Não cria administrador (veja `docs/ROTEIRO-TESTE-LOCAL.md`, seção 0.4) nem times do Meu Time. Conferência estática: `npm run test:seed`.

`LGPD_CHAVE_CIFRA` (32 bytes em base64) é obrigatória para gravar dados pessoais no Meu Time; fica só no servidor, nunca com `NEXT_PUBLIC_`. Mudou uma flag `NEXT_PUBLIC_`? Faça novo build.

Migrations pendentes (0001 a 0055, sem a 0038): só em banco de **preview** (nunca produção), uma por vez, na ordem do número, com a reversão à mão. Ordem: 0033, 0034, 0035 (`PedidoBanco`), 0036 e 0037 (precisam de 0024 e 0025), 0039, 0040 e por fim 0041 (**depende da 0035**; aborta se faltar). A 0038 (`ClubeEquipe`) NÃO é aplicada: é redundante com `TimeClube.clubeId`. Detalhes em `docs/analise/16-plano-aplicacao-migrations.md`.

Rodada 14b: ao inscrever um time do Meu Time (automática ou aprovada pelo organizador) o servidor cria ou reaproveita a `Equipe` legada (mesmo nome, campeonato e categoria), copia o elenco para `Jogador` e grava `Inscricao.equipeLegadoId`. Inscrições antigas sem o vínculo são corrigidas ao listar `GET /api/meu-time/jogos` (até 10 por chamada) e ao gerar grupos e calendário. Migration 0044 (opcional, depois da 0043): `SolicitacaoInscricao.atletasEscolhidos`, usada quando o líder envia `atletas` em categoria com aprovação. Teste: `npm run test:equipe-legada`.

## Regras do ambiente

- Banco local (opcional): `npm run reset-db` recria o Supabase **local**; ele recusa qualquer alvo remoto.
- Nada é publicado durante uma rodada de jogos. A `main` publica direto em produção na Vercel.
