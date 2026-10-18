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

`LGPD_CHAVE_CIFRA` (32 bytes em base64) é obrigatória para gravar dados pessoais no Meu Time; fica só no servidor, nunca com `NEXT_PUBLIC_`. Mudou uma flag `NEXT_PUBLIC_`? Faça novo build.

Migrations pendentes 0033 a 0041: só em banco de **preview** (nunca produção), uma por vez, na ordem do número, com a reversão à mão. Ordem: 0033, 0034, 0035 (`PedidoBanco`), 0036 e 0037 (precisam de 0024 e 0025), 0039, 0040 e por fim 0041 (**depende da 0035**; aborta se faltar). A 0038 (`ClubeEquipe`) NÃO é aplicada: é redundante com `TimeClube.clubeId`. Detalhes em `docs/analise/16-plano-aplicacao-migrations.md`.

Rodada 14b: ao inscrever um time do Meu Time (automática ou aprovada pelo organizador) o servidor cria ou reaproveita a `Equipe` legada (mesmo nome, campeonato e categoria), copia o elenco para `Jogador` e grava `Inscricao.equipeLegadoId`. Inscrições antigas sem o vínculo são corrigidas ao listar `GET /api/meu-time/jogos` (até 10 por chamada) e ao gerar grupos e calendário. Migration 0044 (opcional, depois da 0043): `SolicitacaoInscricao.atletasEscolhidos`, usada quando o líder envia `atletas` em categoria com aprovação. Teste: `npm run test:equipe-legada`.

## Regras do ambiente

- Banco local (opcional): `npm run reset-db` recria o Supabase **local**; ele recusa qualquer alvo remoto.
- Nada é publicado durante uma rodada de jogos. A `main` publica direto em produção na Vercel.
