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

## Regras do ambiente

- Banco local (opcional): `npm run reset-db` recria o Supabase **local**; ele recusa qualquer alvo remoto.
- Nada é publicado durante uma rodada de jogos. A `main` publica direto em produção na Vercel.
