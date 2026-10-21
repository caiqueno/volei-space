# Roteiro de teste local — volei.space (dev `ibcsbq…`)

Para rodar no seu computador, com o banco de **desenvolvimento**. Nunca use produção. Marque cada passo: ✅ passou, ❌ falhou (anote o que apareceu) ou ⏭ não se aplica. Quando algo falhar, mande para o Claude: o passo, a tela, a mensagem e (se houver) o erro do terminal. **Sem chaves nem senhas.**

Complementa `docs/COMO-TESTAR.md` (fluxo clássico) e `docs/analise/29-qa-rodada-12.md` (QA por contrato). Aqui o foco é o que foi construído nas rodadas 9 a 14.

---

## 0. Preparação (10 min)

### 0.1 O que já existe no dev
| O quê | Valor |
| --- | --- |
| Campeonatos | Liga **2** "Copa Aberta de Teste (seed)" (ativa, pública), Liga **3** "Copa Privada de Teste (seed)" (ativa, `simulacao=true`, `visibilidade=PUBLICA`), Liga **4** "Copa Encerrada de Teste (seed)" |
| Categoria | "Masculino" na Liga 2, com `modoInscricao = AUTOMATICA` |
| Equipes (legadas) | 1 "Seed Falcões" e 2 "Seed Tubarões" (Liga 2); 3 "Seed Corujas" e 4 "Seed Leopardos" (Liga 4) |
| Jogos | **1** Falcões × Tubarões (EM_ANDAMENTO, Liga 2); **2** Tubarões × Falcões (AGENDADA, Liga 2); **3** Corujas × Leopardos (ENCERRADA, Liga 4) |
| Jogadores | 24 (dados de seed) |
| **Não existe** | conta de administrador, organizador, líder de time (`TimeClube`) e inscrições (`Inscricao` = 0) |

### 0.2 Flags (`.env.local`, valor exato `1`)
Para testar tudo, acrescente (descomentado) e **reinicie** o `npm run dev` (as `NEXT_PUBLIC_` exigem reinício):
```
MEU_TIME_ATIVO=1
MEU_TIME_FASE2_ATIVO=1
INSCRICAO_SOLICITACAO_ATIVO=1
BANCO_APP_ATIVO=1
BANCO_SESSAO_ATIVO=1
DESAFIO_ATIVO=1
AO_VIVO_ATIVO=1
NEXT_PUBLIC_MEU_TIME_FASE2_ATIVO=1
NEXT_PUBLIC_INSCRICAO_SOLICITACAO_ATIVO=1
NEXT_PUBLIC_BANCO_APP_ATIVO=1
NEXT_PUBLIC_BANCO_SESSAO_ATIVO=1
NEXT_PUBLIC_DESAFIO_ATIVO=1
NEXT_PUBLIC_AO_VIVO_ATIVO=1
NEXT_PUBLIC_PROTOTIPO_ATIVO=1
```
**Deixe para a seção 9** (por último): `SUMULA_EVENTOS_ATIVO`, `NEXT_PUBLIC_SUMULA_EVENTOS_ATIVO`, `SUMULA_SERVIDOR_SOMBRA`.

### 0.3 Conferências
- [ ] `SUPABASE_HOSTS_PROIBIDOS` contém o endereço do projeto de **produção**.
- [ ] `npm run dev` sobe sem erro e `http://localhost:3000` abre.
- [ ] `/prototipo` abre com os 7 perfis (não precisa de banco).
- [ ] Testes: `node scripts/with-ts-node.mjs scripts/category-selection.test.ts` e `…/category-setup-state.test.ts` (antes falhavam por falta de banco; agora devem passar).

### 0.4 Criar o administrador (uma vez)
O banco não tem admin. Gere o hash da senha **no seu terminal** (não compartilhe a senha):
```powershell
node -e "require('bcryptjs').hash('SUA-SENHA-FORTE',12).then(h=>console.log(h))"
```
No painel do Supabase do **dev** (SQL Editor), com o **mesmo e-mail do `ADMIN_EMAIL`**:
```sql
insert into public."Admin" (email, "senhaHash", nome)
values ('SEU-EMAIL@exemplo.com', 'COLE-O-HASH-AQUI', 'Administrador');
```
- [ ] Login em `/admin/login` funciona; senha errada várias vezes mostra "Muitas tentativas" (429).

---

## 1. Organizador cria o campeonato e o modo de inscrição (rodada 14)
1. [ ] Cadastre um organizador em `/cadastro` e **aprove** em `/admin/acessos`.
2. [ ] Entre em `/painel`. Crie um campeonato novo "Copa Local" e passe pela parametrização até a etapa **Inscrições**.
3. [ ] Na etapa Inscrições aparece **"Como as equipes entram neste campeonato?"** (Automática / Com aprovação). Escolha **Com aprovação** e salve.
4. [ ] A **Revisão** da etapa mostra "Com aprovação do organizador" (não mais "Automática (sem fila)").
5. [ ] Em outra categoria, deixe **Automática**.
6. [ ] No menu aparece **Solicitações** com contador 0 e o **sino** de notificações.
- Esperado: o modo é salvo por categoria; sem a flag, nada disso aparece.

## 2. Líder de time: Meu Time, convites e importação
1. [ ] Crie a conta do líder (perfil de equipe) e entre no Meu Time (`/meu-time`).
2. [ ] Crie um time com 3 atletas, um deles **menor de 18**.
3. [ ] **Convite de atleta** (`/meu-time/convites`): gere o link, copie, abra em janela anônima. Aparece o **aviso de privacidade** com caixa de ciência; sem marcar, o envio é bloqueado; marcando, o atleta entra. Reabrir o mesmo link mostra "indisponível". Menor aparece com a pendência de consentimento.
4. [ ] **Importar planilha** (`/meu-time/importar`): baixe o modelo, preencha 4 linhas (1 com erro, 1 duplicada), veja a **prévia** com erros em português; confirme; repita a confirmação (não duplica).
5. [ ] **Clube** (`/meu-time/clube`): crie o clube e vincule o time.
6. [ ] **Notificações**: o sino mostra o contador e a lista.

## 3. Aba Campeonatos: inscrição automática e com aprovação (rodada 14)
1. [ ] Em `/meu-time/campeonatos`, escolha o time. Aparecem as categorias abertas com selo **"Inscrição automática"** ou **"Com aprovação"**.
2. [ ] Categoria **automática** → "Inscrever": confirma, situação vira **Inscrita**.
3. [ ] Categoria **com aprovação** → "Solicitar participação" (mensagem opcional): situação **Aguardando aprovação**; repetir dá "já existe solicitação".
4. [ ] Time com mais atletas que o máximo da categoria: aparece a **escolha dos atletas** (caixas, contador "N de M").
5. [ ] Time sem atletas: mensagem "Cadastre atletas no time".
6. [ ] **Organizador** (`/painel/solicitacoes`): a solicitação aparece (contador e notificação). **Aprove** uma e **recuse** outra com motivo.
7. [ ] **Líder**: o sino mostra "aprovada" / "recusada com o motivo"; a situação muda na aba.
8. [ ] Aprovada → a equipe aparece no painel do organizador como inscrita.
- Esperado: um organizador **não** vê solicitações de outro; um líder não vê as de outro time.

## 4. Jogos e acesso único líder + banco (rodada 14)
Pré-requisito: a inscrição foi confirmada (seção 3) **e** o organizador gerou grupos/calendário (a "ponte" cria a equipe legada e o vínculo).
1. [ ] Organizador: gere a **tabela de jogos** da categoria.
2. [ ] Líder: aba **Jogos** (`/meu-time/jogos`) lista os jogos do time (próximos/do dia), com "Papeleta pendente".
3. [ ] Abra um jogo: abre o **app de banco** pela conta, **sem link**.
4. [ ] Se a lista vier **vazia** mesmo com inscrição e calendário: anote — é o vínculo `Inscricao.equipeLegadoId` (o reparo roda ao listar).
5. [ ] Convide um **assistente** no time: ele lê e pede tempo/troca, mas **não** envia a papeleta (mensagem explica).
6. [ ] Erro de sessão (saia da conta com a aba aberta): mensagem fala em **sessão**, não em "link inválido".

## 5. Banco: papeleta e pedidos (rodada 9)
Use o jogo da seção 4, ou o **link por token** que o apontador gera (seção 6).
1. [ ] Monte a papeleta do set 1: 6 titulares nas posições I–VI, **líbero**, **capitão**. Tente repetir jogador/camisa → bloqueia com o motivo.
2. [ ] Capitão **no banco** (fora dos 6) é aceito (só um aviso).
3. [ ] **Enviar** → confirmação "depois de enviada não muda" → papeleta **trava**; tentar editar falha.
4. [ ] **Pedir tempo** e **pedir substituição** (quem sai/entra) → aparecem "aguardando apontador"; cancelar pendente funciona; um segundo pedido igual é barrado.
5. [ ] **Retorno de substituição** (A sai, B entra; depois B sai e A volta) é aceito.
6. [ ] Desligue a rede: aparece "sem conexão"; ao voltar, retoma.
7. [ ] **Pedir desafio** (só com `DESAFIO_ATIVO`): aparece o pedido.

## 6. Apontador: súmula, papeletas e pedidos do banco
Use o **jogo 1** do seed (EM_ANDAMENTO) ou um jogo novo. Abra `/sumula/[token]` (o link do jogo está no painel do organizador).
1. [ ] Escale os dois times e **gere o link do banco** de cada equipe (aba escalação): copiar e WhatsApp funcionam; **Revogar** derruba o link.
2. [ ] **Papeletas do set**: aparecem as enviadas; divergência com a escalação fica destacada; **Aceitar papeleta** aplica a formação.
3. [ ] Lance pontos nos dois lados. Confira **rotação** e **saque** a cada ponto (o time que ganha o saque gira uma posição).
4. [ ] **Pedido do banco**: aparece com os botões Aceitar/Recusar; aceitar registra o tempo/troca na súmula; recusar avisa o banco.
5. [ ] **Desafio**: registre um (link de vídeo http/https); decida **Mantida / Revertida / Inconclusiva / Cancelada**; Revertida e Inconclusiva não consomem o desafio.
6. [ ] Tente uma **substituição ilegal** (7ª no perfil FIVB): a caixa de regra explica e o árbitro decide.
7. [ ] **Desfazer** o último lance; confira o placar.
8. [ ] Encerre os sets, escolha o MVP, **feche a súmula** e **imprima** (`/sumula/[token]/imprimir`): quadro de pontos com rodízio, folha de líbero, sanções, assinaturas.

## 7. Placar ao vivo e espectador
1. [ ] `/ao-vivo/1` (jogo EM_ANDAMENTO): placar grande em tela cheia, atualiza sozinho a cada ~3 s enquanto você lança pontos na súmula.
2. [ ] `/ao-vivo/3` (encerrado) e `/ao-vivo/999`: mensagens corretas (não vaza dado).
4. [ ] Nenhuma página pública mostra CPF, telefone ou nascimento de atletas.

## 8. (Fora do escopo) Scout
Decisão do dono: scout e árbitro não fazem parte do produto. Pule esta seção; as flags `SCOUT_ATIVO` e `NEXT_PUBLIC_SCOUT_ATIVO` ficam desligadas.

## 9. Offline-first da súmula (por último, é o mais sensível)
Ligue `SUMULA_EVENTOS_ATIVO=1`, `NEXT_PUBLIC_SUMULA_EVENTOS_ATIVO=1` e reinicie.
1. [ ] Lance pontos; o indicador mostra **Salvo**.
2. [ ] Desligue a rede e lance 5 pontos: **N pendentes**; ao voltar, sincroniza na ordem.
3. [ ] Abra a mesma súmula em **dois aparelhos** e lance nos dois: aparece **Conflito**, com "Entendi", sem perder lançamento.
4. [ ] Tente **fechar a súmula com pendências**: é bloqueado.
5. [ ] Opcional: `SUMULA_SERVIDOR_SOMBRA=1` e veja avisos de divergência (nunca bloqueia).

## 10. Segurança e flags desligadas (rápido)
1. [ ] Com as flags **desligadas**, rotas novas respondem 404 e nenhuma tela nova aparece.
2. [ ] Um organizador **não** vê campeonatos, equipes, solicitações ou súmulas de outro.
3. [ ] Um link de banco **expirado/revogado** mostra mensagem de link (não erro técnico).
4. [ ] Competição **privada** (mude a visibilidade de uma liga no painel) some das listas públicas e de `/ao-vivo`.
5. [ ] O terminal do `npm run dev` não mostra segredo nem dado pessoal.

---

## 11. Inscrição pela porta de entrada e líder único (rodada 15)
Ligue `INSCRICAO_VIA_MEU_TIME_ATIVO=1` e `NEXT_PUBLIC_INSCRICAO_VIA_MEU_TIME_ATIVO=1` e reinicie. Pré-requisito: a seção 3 funcionando (aba Campeonatos).
1. [ ] No painel do organizador, gere o **link de inscrição da categoria** e abra em janela anônima (`/inscricao/categoria/[token]`): aparece a **porta de entrada** (campeonato, categorias, período, modo) e o botão **"Inscrever meu time"**, não o formulário antigo.
2. [ ] Sem conta: o botão leva ao **login/cadastro do líder** e, depois de entrar, **volta** para `/meu-time/campeonatos` com a categoria já escolhida.
3. [ ] Com conta: cai direto em `/meu-time/campeonatos?categoria=…`, escolhe o time, a confirmação abre sozinha e a inscrição segue a regra do modo (automática ou aprovação).
4. [ ] Teste os outros links: campeonato (`/inscricao/campeonato/[token]`), vaga, e `/inscricao-rapida/[token]`. Um link inválido ou expirado mostra "link inválido" igual para qualquer causa.
5. [ ] Competição **privada** (mude a visibilidade): a porta só mostra as categorias com o link certo; sem o link, nada vaza.
6. [ ] `/capitao` **redireciona** para o Meu Time com o aviso "O painel do capitão agora é o Meu Time".
7. [ ] `/inscricao/[slug]` mostra "Peça um novo convite ao líder do time" e **não** coleta dados.
8. [ ] Depois da inscrição, aparecem os **próximos passos** (completar atletas e documentos).
- Atenção: **fotos, documentos e escudo** ainda não têm upload no Meu Time (ver `docs/analise/30-paridade-capitao-lider.md`). Anote se isso impede completar algum passo.
- Atenção: o cadastro de equipe ainda pode gerar uma **candidatura pendente**; confira se isso trava o Meu Time.

## 12. Login sem senha e perfis (rodada 16)
Ligue `LOGIN_SEM_SENHA_ATIVO=1`, `NEXT_PUBLIC_LOGIN_SEM_SENHA_ATIVO=1` e, só em desenvolvimento, `LOGIN_CODIGO_DEV_CONSOLE=1` (o código aparece no console do `npm run dev`). Exige as migrations 0045 a 0047.
1. [ ] `/login` mostra **"Entrar com código"** e a opção "Prefiro usar senha". O e-mail do administrador **não** entra por código (só por senha).
2. [ ] Peça o código com um e-mail novo: a resposta é a mesma de um e-mail que existe. Digite o código do console: **expira em 10 min**, serve **uma vez** e bloqueia depois de 5 erros.
3. [ ] E-mail sem conta cai no **onboarding** "O que você quer fazer hoje?" (cadastrar time, organizar, convite de atleta), sem painel vazio.
4. [ ] Conta com líder e organizador: aparece "Como você quer entrar hoje?" e o **seletor de perfil** troca entre os dois.
5. [ ] Navegação do líder: **Início · Meu Time · Competições · Jogos · Perfil**.
6. [ ] Google e WhatsApp: só testáveis depois de configurar (ver `.env.example`).

## 13. Elenco completo e pedido de troca (rodada 17)
Ligue `ELENCO_COMPLETO_ATIVO=1` e `NEXT_PUBLIC_ELENCO_COMPLETO_ATIVO=1`. Exige as migrations 0048 a 0050 e `LGPD_CHAVE_CIFRA`.
1. [ ] Atleta: envie **foto de rosto** e **documento** (foto ou PDF); CPF, telefone e documento aparecem **só mascarados** depois de salvos. CPF inválido e CPF repetido no mesmo time são recusados.
2. [ ] Dados do time: e-mail, telefone, **cores** e **escudo** (sem CNPJ).
3. [ ] Organizador, parametrização > Elenco: escolha um **modelo** (FIVB, CBV, amador livre) e ajuste mínimo, máximo, líberos, faixa de nascimento, documentos exigidos e **prazo de troca**. Confira o selo "Valores a confirmar".
4. [ ] A inscrição respeita a regra e a prontidão do time diz "X atletas sem documento/foto/CPF".
5. [ ] Depois do prazo, o líder usa **"Pedir troca"**; o organizador aprova ou recusa em `/painel/pedidos-troca`; a aprovação muda a lista da inscrição.

## 14. Painel de inscrições, explorar e notificações (rodada 18)
Ligue `PAINEL_INSCRICOES_ATIVO`, `EXPLORAR_COMPETICOES_ATIVO`, `NOTIFICACOES_MULTICANAL_ATIVO` e as `NEXT_PUBLIC_` correspondentes. Exige as migrations 0051 a 0053.
1. [ ] `/painel/inscricoes`: abas Em análise, Pendência, Lista de espera, Aprovadas e Recusadas; aprovar em um clique e em lote; **Pedir correção** com comentário; o líder responde pela tela da inscrição.
2. [ ] Categoria com poucas vagas: aprovar além do limite vai para a **lista de espera**; ao liberar uma vaga o primeiro da fila é promovido e avisado.
3. [ ] **Exportar planilha** abre no Excel com acentos e **sem CPF nem telefone**.
4. [ ] `/painel/equipe`: convide um membro com papel Financeiro ou Arbitragem; ele **não** consegue decidir inscrição.
5. [ ] Líder, **Competições**: cartões com selo ✅/⚠️/⛔ e o motivo, filtros e busca. Valor aparece como "Valor a combinar" (sem fonte no banco) e a cidade pode vir vazia.
6. [ ] Preferências de aviso por canal; "Ativar avisos neste aparelho" só pede permissão **depois do clique**. Push, e-mail e WhatsApp reais só funcionam com as chaves e os crons configurados.

## 15. Pagamento por comprovante e PDF da súmula (rodada 19)
Ligue `PAGAMENTO_COMPROVANTE_ATIVO`, `SUMULA_PDF_ATIVO` e as `NEXT_PUBLIC_`. Exige as migrations 0054 e 0055.
1. [ ] Organizador, parametrização > Pagamento: bloco **Pix com comprovante** (valor, chave, beneficiário, instruções). A chave Pix **não aparece** para quem não está inscrito na categoria.
2. [ ] Líder: no passo "Revisar e enviar" aparece o valor; depois de enviar, aparecem a chave (com **Copiar**) e o campo de **comprovante**.
3. [ ] Organizador: **Ver comprovante** abre um link que expira em 60 s; **Confirmar**, **Recusar** (com motivo) e **Isentar**.
4. [ ] **Aprovar** a inscrição sem pagamento confirmado é bloqueado com a explicação.
5. [ ] PDF: em `/sumula/[token]/imprimir`, **Baixar PDF** (token do jogo, não o id público). **Abra o arquivo e confira o layout** (acentos, quadro de pontos, assinaturas). É a primeira vez que alguém o vê.

## Como relatar
Para cada ❌: **seção/passo**, o que você fez, o que apareceu (texto ou print **sem dados reais**), e a mensagem do terminal. O Claude corrige e devolve a lista do que mudou. Itens ⏭ também importam: dizem o que ficou sem teste.

## Limpeza no fim
Se quiser voltar ao estado original: apague os registros criados nas tabelas de teste pelo painel do Supabase do **dev** (nunca produção) ou use `npm run reset-db` apenas no banco **local**.
