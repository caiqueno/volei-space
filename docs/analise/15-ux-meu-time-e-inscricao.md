# 15 - UX de "Meu Time" e inscrição do líder de primeira viagem

Agente: `ux`. Data: 16/10/2026. Escopo: leitura de `docs/PROMPT-volei-space.md` (seção "Experiência prioritária"), `docs/requisitos/INSCRICOES-POR-EQUIPE.md`, `docs/analise/08-validacao-negocio.md` e das rotas de `src/app` (cadastro, inscricao, inscricao-rapida, capitao, ficha, painel, login). Nenhum código foi alterado. Não consultei o vault `volei.space — Plataforma de Campeonatos de Vôlei` (`04-FLUXOS`, `09-UI-UX`) porque a pasta não foi localizada nesta leitura; se existir, o `frontend` e o `designer` devem conferir contra ela.

**Legenda de confiança.** *Verificado* = li o código. *Aprovado/pendente* = está no requisito ou no prompt, mas não existe no código. *HIPÓTESE* = precisa de teste com pessoas reais (seção 9). Não há dado de usuário real neste documento; todo número de tempo é meta, não medição.

## 0. Decisão do dono e o que ela muda

Decisão: **"Meu Time" (conta do time + banco de atletas) é pilar central.** O convite por link do organizador, por categoria, com cadastro direto pelo líder e **sem aprovação**, continua como **porta de entrada**.

Consequências para o desenho:

1. O link do organizador deixa de ser "um formulário que cria uma equipe solta" e passa a ser **o primeiro passo de uma conta que fica**. O líder entra por um link, mas sai dele com um time permanente.
2. O item 2 da lista "fora do MVP" do doc 08 (seção 5: banco de atletas do clube) está **superado** por esta decisão. A camada "Clube com várias equipes" (prompt, linha 199) continua adiável: um time = um banco. Registrar isso no roadmap.
3. A inscrição passa a **copiar** atletas do banco para a inscrição (regra do prompt: "a lista da inscrição é uma cópia própria"). Mudar o banco depois não altera inscrição já concluída.
4. Sem aprovação: toda a segurança vira **aviso automático antes de enviar** e **ajuste a posteriori** pelo organizador (doc 08, 8.3). O texto de tela nunca promete aprovação.
5. Hoje o código tem **dois produtos separados** que não conversam (seção 1): o formulário rápido do link (sem conta) e o painel `/capitao` (com conta, mas amarrado à aprovação antiga). "Meu Time" é a junção dos dois.

## 1. Jornada atual mapeada e atritos

### 1.1 Mapa das rotas que o líder pode encontrar

| Rota | O que é hoje | Estado |
|---|---|---|
| `/inscricao/categoria/[token]` | Link do organizador por categoria. Mostra nome do campeonato e categoria e abre o formulário rápido (`src/app/inscricao/categoria/[token]/page.tsx:50-67`) | Funciona, sem conta |
| `/inscricao/vaga/[token]` | Link por vaga (convite por equipe apontada). Abre direto o rascunho já criado (`src/app/inscricao/vaga/[token]/page.tsx:15-45`) | Funciona, sem conta |
| `/inscricao/campeonato/[token]` | Link geral do campeonato, categoria escolhida pelo líder (`src/app/inscricao/campeonato/[token]/page.tsx:60-71`) | Legado, convive com os outros |
| `/inscricao-rapida` (sem token) | Beco: "Use o link da categoria" (`src/app/inscricao-rapida/page.tsx:8-11`) | Beco sem saída |
| `/inscricao-rapida/[token]` | Rascunho persistente da equipe + jogadores, autosave do cabeçalho (`src/app/inscricao-rapida/[token]/page.tsx:12-37`) | Funciona, sem conta |
| `/inscricao/[slug]` | Página pública que diz que não recebe atleta (`src/app/inscricao/[slug]/page.tsx:36-42`) | Beco sem saída |
| `/cadastro` | Cadastro de conta em 4 passos, com senha e "envio para análise" (`src/app/cadastro/page.tsx:1514-1519`) | Fluxo da LUVA antiga |
| `/login` | E-mail e senha (`src/app/login/login-screen.tsx:36-44`) | Funciona |
| `/capitao` | Painel da equipe: elenco, QR codes, agenda, campeonatos (`src/app/capitao/page.tsx:359-447`) | Depende de aprovação |
| `/ficha` | Redireciona para `/seja-membro` (`src/app/ficha/page.tsx:3-5`) | Rota morta, leva ao lugar errado |
| `/painel` | Painel do **organizador** | Não é do líder |

### 1.2 Jornada real de quem recebe um link (hoje)

Passos que o líder percorre agora, no celular:

1. Abre o link no WhatsApp. Vê "Inscrição de equipe", nome do campeonato e a categoria (`categoria/[token]/page.tsx:50-56`).
2. Tela 1: "Inicie sua inscrição em {campeonato}". Preenche **nome da equipe** e toca **"Iniciar e salvar cadastro"** (`FormularioInscricaoRapida.tsx:331-341`).
3. A página é recarregada em outra URL (`router.replace`, `FormularioInscricaoRapida.tsx:226`). O líder não é avisado de que existe um link de retomada nem de que ele só aparece depois.
4. Tela 2: "Cadastre sua equipe para {campeonato}". Campos: nome, emblema, "Nome do torneio" (bloqueado), "Líder da equipe", "Técnico (opcional)" (`FormularioInscricaoRapida.tsx:376-382`).
5. Seção "Cadastro de jogadores": toca **"Novo jogador"**, abre um mini-formulário de **um atleta por vez**: nome, número, posição, CPF, nascimento, tipo e número do documento, foto (`FormularioInscricaoRapida.tsx:385-395`). Toca "Salvar", volta à lista, repete.
6. Toca **"Concluir inscrição"** (`FormularioInscricaoRapida.tsx:398`). Se faltar algo, vê "Não foi possível concluir o cadastro." e uma lista (`team-registration-draft.ts:406`).
7. Tela final "Inscrição enviada" com botão "Copiar link desta inscrição" (`FormularioInscricaoRapida.tsx:353-355`).

Tempo estimado para 10 atletas (HIPÓTESE, a medir): com todos os campos opcionais ligados são ~8 campos x 10 = 80 toques de campo mais 10 abrir/salvar. Se o organizador exigir foto, CPF e documento, cada atleta vira 1,5 a 3 minutos (foto e documento são o gargalo). **É muito provável que a meta de 5 min não seja atingida sem lista colada e campos opcionais** (HIPÓTESE).

### 1.3 Jornada real de quem vai para "conta" (hoje)

1. Abre `/cadastro` sem parâmetros: é **redirecionado para `/seja-membro`**, que é a página "Seja um organizador de campeonatos" (`src/app/cadastro/page.tsx:158-161`; `src/app/seja-membro/page.tsx:55`). Um líder que vá direto pelo site cai na tela errada.
2. Com `?perfil=equipe`: 4 etapas (Responsável com **senha**, Equipe, Perfil, Estrutura) e "envie para análise" (`cadastro/page.tsx:1515-1519`).
3. Pede dados que o líder de primeira viagem não tem pronto: gênero e categoria etária, nível, dias de treino, local de treino, piso, estrutura da quadra, "pode ceder quadra", Instagram (`cadastro/page.tsx:986-1089`).
4. Entra em `/capitao`: vê "A organização ainda está conferindo o cadastro" e o Elenco bloqueado: "Elenco aguardando aprovação" (`capitao/page.tsx:408-413`, `557-564`).

### 1.4 Atritos por gravidade

**Crítico (impede a decisão do dono)**

| # | Atrito | Onde | Por que importa |
|---|---|---|---|
| C1 | **Não existe "Meu Time" com banco de atletas.** O elenco nasce dentro de cada inscrição e some do horizonte do líder. Na segunda competição ele recadastra tudo | `FormularioInscricaoRapida.tsx:154` (jogadores só do rascunho); `team-registration-draft.ts:340-347` (insere no rascunho) | É o oposto de "cadastrar uma vez, usar sempre" (prompt, princípio 4) |
| C2 | **O link do organizador não cria conta.** O único "acesso" é a URL do rascunho. Perdeu a mensagem do WhatsApp, perdeu o time | `FormularioInscricaoRapida.tsx:367-368` ("Use este link para continuar depois") | Sem conta não há Meu Time. O texto da tela admite a fragilidade |
| C3 | **Dois sistemas contraditórios.** `/capitao` ainda exige aprovação para liberar elenco, enquanto o link rápido cria a inscrição direto | `capitao/page.tsx:189`, `443-447`, `456`, `557-564`, `169` | Contradiz a regra aprovada (sem aprovação) e mostra ao líder uma fila que não existe |
| C4 | **Atletas só um por vez, sem colar lista.** O ganho de tempo que o doc 08 aponta (8.4) não existe | `FormularioInscricaoRapida.tsx:385-395` | Principal risco para a meta de 5 min |
| C5 | **Não há aviso de elegibilidade (idade, naipe).** A validação verifica só campos obrigatórios e número repetido; não encontrei regra de faixa etária nem de naipe no momento de salvar ou concluir | `team-registration-draft.ts:386-406` (só obrigatórios e mín./máx.); busca por idade/naipe nesse arquivo não retorna regra | O líder descobre o problema depois, pelo organizador. Fere o princípio 6 do prompt |

**Alto**

| # | Atrito | Onde |
|---|---|---|
| A1 | `/cadastro` sem parâmetro manda o líder para a página do organizador | `cadastro/page.tsx:158-161` |
| A2 | Cadastro de conta pede ~25 campos de quadra, treino e Instagram antes de qualquer valor entregue; 4 etapas e senha | `cadastro/page.tsx:1515-1519`, `986-1089` |
| A3 | Mensagem de erro técnica ao enviar foto: "Verifique o bucket ... no Supabase" | `FormularioInscricaoRapida.tsx:105` |
| A4 | Erro de "concluir" é genérico no topo e a lista de pendências não leva ao atleta com problema | `FormularioInscricaoRapida.tsx:310-312`, `373`; `team-registration-draft.ts:406` |
| A5 | Três gerações de link (campeonato, categoria, vaga) com telas parecidas e comportamentos diferentes | `inscricao/campeonato/[token]/page.tsx:60-71`, `categoria/[token]/page.tsx:50-67`, `vaga/[token]/page.tsx:15-45` |
| A6 | Textos de aprovação ainda aparecem na tela final e no aviso de "já enviada" | `FormularioInscricaoRapida.tsx:354`, `370` ("A aprovação depende do organizador", "aguarda aprovação") |
| A7 | Botão "Concluir inscrição" só aparece quando o rascunho está em RASCUNHO e fica desabilitado sem motivo explicado (sem atletas) | `FormularioInscricaoRapida.tsx:398` |
| A8 | Nenhum contador de elenco na tela (mín./máx. só aparece como erro depois) | `team-registration-draft.ts:340`, `370`, `395-396`; sem indicador em `FormularioInscricaoRapida.tsx` |

**Médio**

| # | Atrito | Onde |
|---|---|---|
| M1 | Campo "Nome do torneio" bloqueado e com rótulo de campo: parece editável e confunde. Deveria ser texto fixo no topo | `FormularioInscricaoRapida.tsx:336`, `379` |
| M2 | Primeira tela pede só o nome da equipe e "cria o link"; o líder não entende o que "Criando link" significa | `FormularioInscricaoRapida.tsx:332`, `339` |
| M3 | Autosave silencioso: só salva com nome e categoria preenchidos; se não salvar, nada é dito (apenas "Falha ao salvar" depois do erro) | `FormularioInscricaoRapida.tsx:195-197`, `374` |
| M4 | Remover jogador sem confirmação nem desfazer | `FormularioInscricaoRapida.tsx:284-293` |
| M5 | Copiar link sem tratamento de erro (`navigator.clipboard` falha em alguns navegadores de celular) | `FormularioInscricaoRapida.tsx:320-324` |
| M6 | Termos técnicos: "CIN", "CTPS", "Documento", "Série", "Rascunho", "slug", "ID" | `FormularioInscricaoRapida.tsx:12-16`; `capitao/page.tsx:527-529` |
| M7 | Páginas de "Inscrições encerradas / não abertas" não dizem o que fazer (falar com quem, quando abre) | `categoria/[token]/page.tsx:39-47`; `campeonato/[token]/page.tsx:34`, `44` |
| M8 | Rotas mortas: `/ficha` leva a `seja-membro`; `/inscricao-rapida` é beco; `/inscricao/[slug]` é beco | `ficha/page.tsx:5`; `inscricao-rapida/page.tsx:8`; `inscricao/[slug]/page.tsx:36-42` |
| M9 | Painel `/capitao` do time aprovado abre com "Ver página inicial" como ação principal, não com "Inscrever/ver atletas" | `capitao/page.tsx:415-420` |
| M10 | Rótulos de erro de login ("Usuário ou senha não conferem") não oferecem "Esqueci a senha" na própria mensagem | `login-screen.tsx:43` |

## 2. Princípios de desenho para esta jornada

1. **Um link, um próximo passo.** Toda tela termina com um botão principal e uma frase dizendo o que acontece depois.
2. **Valor antes de cadastro.** O líder entra no link e começa a cadastrar atletas **antes** de preencher perfil de quadra. Dados de quadra, treino e Instagram saem do caminho obrigatório (ficam em "Dados do time", depois).
3. **Conta leve.** O líder deixa e-mail ou WhatsApp **uma vez**, no ponto em que ele já tem algo a perder (time com nome e alguns atletas). Senha é opcional no primeiro acesso (alinhado ao prompt, linha 175: "sem senha obrigatória"); código por e-mail/WhatsApp é a forma alvo. Como o login atual é e-mail e senha (`login-screen.tsx:36-38`), a fase 1 pode manter a senha, mas pedida **no fim**, com a mensagem "para você voltar depois".
4. **Nunca perder trabalho.** Tudo salva sozinho e mostra "Salvo" com horário. Fechou o app, voltou, está lá.
5. **Avisar sem bloquear.** Elegibilidade mostra aviso amarelo com motivo e como corrigir. Só bloqueia o que o servidor realmente não pode aceitar (número repetido, atleta em duas equipes da mesma categoria, fora dos limites do elenco).
6. **Linguagem do vôlei, não do sistema.** "Time", "atleta", "camisa", "categoria". Nada de "rascunho", "série", "slug", "token", "ID".
7. **Celular primeiro.** Polegar, uma mão, teclado certo para cada campo (numérico no número, calendário nativo na data, câmera na foto).

## 3. Jornada alvo do líder de primeira viagem

Caminho: **link do organizador, cria conta, Meu Time, atletas, inscrição, status.**

### 3.1 Linha do tempo com metas (HIPÓTESES de tempo, a validar)

| Etapa | O que o líder faz | Meta de tempo | Toques/campos máx. |
|---|---|---|---|
| E1 Chegada pelo link | Lê "você foi convidado" e toca em "Começar" | 15 s | 1 toque |
| E2 Criar o time | Nome do time, cidade, e o próprio nome e contato | 60 s | 4 campos |
| E3 Atletas | Cola a lista do WhatsApp (nome e número) e confere | 120 s para 10 atletas | 1 colar + 1 conferir + 1 confirmar |
| E4 Completar o que falta | Data de nascimento (e o que o organizador exigir) por quem estiver faltando | 90 s | 1 campo por atleta |
| E5 Enviar a inscrição | Revisa o resumo, marca "li o regulamento" e envia | 30 s | 2 toques |
| E6 Status | Vê "Inscrição confirmada" ou o que falta | 5 s | 0 |
| **Total** | **Time + 10 atletas inscritos** | **< 5 min (meta); mediana alvo 4 min** | |

Observação: **foto e documento** de cada atleta, quando o organizador os exige, não cabem nos 5 minutos. A solução é deixá-los como **pendência pós-inscrição** (seção 7) sempre que a configuração do campeonato permitir, e dar ao atleta um link para enviar o próprio documento. Isso depende de uma decisão do dono (pergunta 2 da seção 10).

### 3.2 Fluxo desenhado em passos

```
[WhatsApp] Organizador envia link  ->  /inscricao/...  (continua sendo a porta de entrada)
      |
      v
T1  Convite ("Você foi chamado para jogar em {Campeonato} · {Categoria}")
      |  [Começar]
      v
T2  Criar meu time (nome, cidade, seu nome, seu WhatsApp ou e-mail)
      |  salva o time e cria a conta ("Meu Time") ligada ao convite
      v
T3  Meu Time > Atletas (vazio com atalho "Colar lista")
      |  colar lista -> conferência -> confirmar
      v
T4  Meu Time > Atletas (lista + indicador de prontidão + o que falta)
      |  [Inscrever em {Campeonato} · {Categoria}]
      v
T5  Inscrição: escolher quem joga, camisa, capitão e líbero (1 tela, com contador)
      |  [Revisar]
      v
T6  Revisar e enviar (resumo + regulamento + [Enviar inscrição])
      |
      v
T7  Status ("Inscrição confirmada" ou "Falta resolver 2 itens")
      |
      v
T8  Meu Time (início): próximos passos, outras competições, convidar atletas
```

Ponto-chave da regra aprovada: no T6 não existe "aguardar aprovação". Ao enviar, a inscrição **entra** na categoria do convite (requisito, regra 3). O único "pode não entrar" é a validação automática (vagas esgotadas, dados obrigatórios, número repetido), explicada em linguagem simples.

### 3.3 Retomada e multiplicidade

- O link do organizador continua abrindo o mesmo cadastro (requisito, regras 4 e 5). Se o visitante **já tem conta**, o link pede só "Entrar" e leva direto ao T4/T5 com o convite já ligado ao time.
- Se o líder já tem um time cadastrado e recebe um **segundo convite** (outra competição, outra categoria), a tela T1 pergunta "Usar {Nome do time}?" e pula T2 e T3 (cadastrar uma vez, usar sempre).
- Se o convite já foi concluído por outra pessoa, T1 diz "Este convite já foi usado pelo time {Nome}. É o seu? [Entrar]".

## 4. Telas e estados em wireframe textual

Convenções: `[Botão]` ação principal, `(link)` ação secundária, `{variável}`, `[ ]` campo. Largura de referência 375 px, um coluna. Altura do botão principal fixa na base da tela (alcançável pelo polegar).

### T1 Convite

```
+---------------------------------+
|  volei.space                    |
|                                 |
|  Você foi chamado para jogar    |
|  {Campeonato}                   |
|  {Categoria} · {Naipe}          |
|  Organizado por {Organizador}   |
|                                 |
|  Em 5 minutos você cadastra     |
|  seu time e os atletas.         |
|  Não precisa esperar aprovação. |
|                                 |
|  [ Começar ]                    |
|  (Já tenho conta · Entrar)      |
+---------------------------------+
```

Estados:
- **Normal** (acima).
- **Inscrições ainda não abertas**: "As inscrições abrem em {data}. Volte neste link nesse dia." (sem botão Começar; botão "Avisar quando abrir" fica como melhoria futura).
- **Inscrições encerradas**: "As inscrições para {Campeonato} terminaram em {data}. Fale com {Organizador} se precisar de ajuda." com contato do organizador, se houver.
- **Convite já concluído**: ver 3.3.
- **Link inválido**: "Não encontramos este convite. Peça um novo link a {Organizador}." Hoje: `categoria/[token]/page.tsx:23`, `campeonato/[token]/page.tsx:14`.
- **Vagas esgotadas**: "As vagas desta categoria acabaram. Fale com {Organizador}." (hoje a mensagem técnica é "limite de equipes aprovadas", `team-registration-draft.ts:179`).

### T2 Criar meu time

```
+---------------------------------+
|  <  Passo 1 de 3 · Seu time     |
|  ●○○                            |
|                                 |
|  Como se chama o seu time?      |
|  [ Nome do time              ]  |
|  [ Cidade                    ]  |
|                                 |
|  Quem é você?                   |
|  [ Seu nome                  ]  |
|  [ WhatsApp ou e-mail        ]  |
|  (Escudo e uniforme: depois)    |
|                                 |
|  Seus dados ficam só com o      |
|  organizador e com o seu time.  |
|                                 |
|  [ Continuar ]                  |
|  Salvo automaticamente          |
+---------------------------------+
```

Regras de tela:
- Naipe e categoria **não aparecem como pergunta**: vêm do convite (hoje isso já é verdade no link por categoria, `FormularioInscricaoRapida.tsx:336`). Mostrar como texto fixo no topo, não como campo bloqueado (M1).
- Salvar o time no "Continuar". No mesmo toque cria a conta Meu Time. Senha: pedida só em T8 ("Quer entrar sem código da próxima vez? Crie uma senha"), HIPÓTESE a testar contra pedir já aqui.
- Erros: "Esse nome já existe nesta categoria. Use outro nome ou entre na conta do time." (hoje: `team-registration-draft.ts:274`, `437`).

### T3 Meu Time > Atletas (vazio)

```
+---------------------------------+
|  Meu Time · {Nome do time}      |
|  [Atletas][Comissão][Time][Insc]|
|                                 |
|  Seu time ainda não tem atletas |
|                                 |
|  [ Colar lista do WhatsApp ]    |
|  Ex.:                           |
|   João Silva, 7                 |
|   Maria Souza, 10               |
|                                 |
|  (Adicionar um por um)          |
|  (Mandar link para o atleta)    |
+---------------------------------+
```

Colar lista (modal em tela cheia):
```
+---------------------------------+
|  Cole a lista de atletas        |
|  [ campo grande                ]|
|  Uma pessoa por linha:          |
|  nome, número da camisa         |
|                                 |
|  [ Conferir lista ]             |
+---------------------------------+
        |
        v  Conferência
+---------------------------------+
|  Achamos 10 atletas             |
|  ✓ João Silva        #7         |
|  ✓ Maria Souza       #10        |
|  ! Ana L.            sem número |
|  ! Pedro  #7         número     |
|                      repetido   |
|  Toque numa linha para corrigir |
|                                 |
|  [ Salvar 10 atletas ]          |
+---------------------------------+
```

Regras: separadores aceitos vírgula, ponto e vírgula, tab, hífen, "nº" e "#"; linhas vazias ignoradas; nomes com "nº 7" ou "7 - João" também; nada é salvo até o líder confirmar; atletas com linha em alerta ficam salvos mesmo assim, com a pendência marcada.

### T4 Meu Time > Atletas (com lista)

```
+---------------------------------+
|  Seu time tem 10 atletas        |
|  ▓▓▓▓▓▓▓░░░  7 de 10 completos  |
|  3 sem data de nascimento  [Ver]|
|                                 |
|  João Silva    #7  Levantador ✓ |
|  Maria Souza   #10 Ponteira   ✓ |
|  Ana L.        --  --         ! |
|  ...                            |
|  [ + Adicionar atleta ]         |
|                                 |
|  ----------------------------   |
|  [ Inscrever em {Campeonato} ]  |
+---------------------------------+
```

- O cartão de prontidão é o do prompt (linhas 197): "Seu time tem 9 atletas. 2 estão sem documento." Cada pendência leva direto ao atleta.
- Estado **banco vazio** (T3), **banco com pendência** (acima), **banco completo**: "Tudo certo. Seu time está pronto para se inscrever." e o botão ganha destaque.
- Edição de atleta em folha inferior (bottom sheet) com só os campos que importam. O que o organizador não exige fica recolhido em "Mais dados (opcional)".

### T5 Inscrição: quem joga

```
+---------------------------------+
|  <  Inscrição · Passo 2 de 3    |
|  {Campeonato} · {Categoria}     |
|                                 |
|  10 escolhidos · mínimo 6 ·     |
|  máximo 14 · líberos 1 de 2     |
|                                 |
|  [x] João Silva     camisa [ 7 ]|
|       ( ) Capitão   ( ) Líbero  |
|  [x] Maria Souza    camisa [10 ]|
|  [ ] Pedro Alves   (apagado)    |
|      Nasceu antes de 2008, a    |
|      categoria é Sub-17.        |
|                                 |
|  [ + Novo atleta ]              |
|  [ Revisar ]                    |
+---------------------------------+
```

- Contador fixo no topo (A8 resolvido). Atleta não elegível aparece apagado com motivo (seção 5), com opção "Incluir mesmo assim" **somente** quando a regra for aviso, não bloqueio.
- Camisa sugerida a partir do banco; número repetido avisa na hora: "Já existe a camisa 7 neste time. Escolha outro número."
- Comissão técnica: fica fora do caminho de 5 min, salvo se o organizador exigir. Se exigir, entra como passo opcional "Quem vai ao banco de reservas?" (prompt, passo 3).

### T6 Revisar e enviar

```
+---------------------------------+
|  Revise antes de enviar         |
|  Time: {Nome} · {Cidade}        |
|  Categoria: {Categoria}         |
|  Atletas: 10  (editar)          |
|  Pendências: 0                  |
|  [x] Li e aceito o regulamento  |
|      (abrir regulamento)        |
|  [ Enviar inscrição ]           |
+---------------------------------+
```

- Se houver pendência bloqueante: botão desabilitado **com a frase do motivo logo acima**, nunca desabilitado em silêncio (A7).
- Taxa: se o organizador cobra por fora, mostrar "A inscrição é paga direto ao organizador: {instrução}" (pagamento pela plataforma está fora do MVP, doc 08 seção 5). Não prometer confirmação de pagamento.

### T7 Status

Estados da inscrição para o time (sem aprovação):

| Status na tela | Quando | Mensagem |
|---|---|---|
| Em preenchimento | Rascunho, antes de enviar | "Faltam {n} passos para enviar." |
| **Inscrição confirmada** | Enviada e válida | "Seu time está na categoria {Categoria}. Você pode ajustar atletas até {prazo}." |
| Confirmada, com pendências | Enviada, mas faltam itens que o organizador pediu | "Seu time está inscrito. Faltam {n} itens: {lista}. Resolva até {prazo}." |
| Ajuste pedido pelo organizador | Organizador pediu mudança depois (fora do fluxo de aprovação) | "O organizador pediu um ajuste: {comentário}." |
| Removido pelo organizador | Organizador removeu a equipe | "Sua inscrição foi removida por {Organizador}. Motivo: {motivo}. Fale com ele para resolver." |
| Encerrada para edição | Passou o prazo | "O prazo de ajustes acabou. Para trocar um atleta, peça ao organizador." |

Nota: "Pendência" aqui **não** é aprovação. É um aviso de dado faltando. Os estados "Em análise" e "Recusada" do prompt (linha 203) ficam **fora** do desenho, para respeitar a regra aprovada.

### T8 Meu Time (início)

```
+---------------------------------+
|  Olá, {Nome}                    |
|  {Nome do time}   {Cidade}      |
|                                 |
|  Próximo passo                  |
|  [ Completar 3 atletas ]        |
|                                 |
|  Inscrições                     |
|  {Campeonato} · {Categoria}     |
|  ● Inscrição confirmada         |
|                                 |
|  [Atletas] [Comissão] [Time]    |
|  [Inscrições]                   |
|  (Convidar atletas por link)    |
+---------------------------------+
```

Abas, conforme o prompt (linhas 185-189): **Atletas, Comissão técnica, Dados do time, Inscrições**. Os dados que hoje o cadastro de conta pede à força (quadra, treino, Instagram, piso) vão para "Dados do time", todos opcionais (A2).

## 5. Regras de elegibilidade explicadas ao usuário

Estado de implementação: **o servidor hoje não valida idade nem naipe na inscrição** (conferido em `team-registration-draft.ts:386-406`: só campos obrigatórios, mínimo/máximo do elenco e número repetido; `team-registration-draft.ts:173` bloqueia equipe com mesmo nome). As regras abaixo são **aprovadas no prompt** (linhas 161 e 205-208) e ainda **pendentes**. A UX deve ser construída para quando existirem, e as mensagens estão prontas para o `frontend`.

Regra de ouro de texto: **motivo + o que fazer**, em uma frase, sem sigla.

| Regra | Quando avisa | Tipo | Texto na tela |
|---|---|---|---|
| Faixa etária | Atleta fora do ano permitido | Aviso (ou bloqueio, conforme o organizador definir) | "{Nome} nasceu em {ano}. Nesta categoria só podem jogar atletas nascidos de {ano_min} a {ano_max}." + "Escolha outro atleta ou fale com o organizador." |
| Data de nascimento faltando | Categoria tem limite de idade e o atleta está sem nascimento | Aviso | "Falta a data de nascimento de {Nome}. Sem ela não dá para saber se ele pode jogar nesta categoria." + [Preencher] |
| Naipe | Time com naipe diferente do da categoria | Bloqueio | "Esta categoria é só {masculina/feminina}. O seu time é {outro}. Procure uma categoria {do seu naipe} deste campeonato." (misto aceita ambos; mostrar a regra do misto definida pelo organizador) |
| Mínimo de atletas | Menos atletas que o mínimo | Bloqueio no envio | "Faltam {n} atletas. Esta categoria precisa de pelo menos {min}." |
| Máximo de atletas | Mais que o máximo | Bloqueio | "Você marcou {n}. O máximo é {max}. Desmarque {n-max}." |
| Líberos | Mais líberos que o limite | Bloqueio | "Você marcou {n} líberos. Esta categoria aceita {max}." |
| Camisa repetida | Dois atletas com o mesmo número | Bloqueio | "A camisa {n} já está com {Nome}. Escolha outro número." (hoje: `team-registration-draft.ts:322`, `346`: "Já existe um jogador ativo com esse número nesta equipe.") |
| Atleta em dois times da mesma competição | Mesmo atleta em outro time | Bloqueio | "{Nome} já está inscrito no time {Outro time} nesta competição. Um atleta só pode jogar por um time por competição." (regra do prompt, linha 215; **ainda não existe**, e exige decidir como identificar o atleta: CPF? ver pergunta 3) |
| Documento / foto obrigatórios | Organizador exigiu | Aviso na inscrição, bloqueio só se o organizador exigir antes do envio | "O organizador pede {foto/documento} de cada atleta. Faltam {n}." |
| Vagas esgotadas | Categoria cheia | Bloqueio | "As vagas desta categoria acabaram." (hoje a mensagem é técnica, `team-registration-draft.ts:179`) |
| Prazo encerrado | Depois do prazo | Bloqueio | "O prazo de inscrição terminou em {data}." |
| Nome de time repetido | Mesmo nome na categoria | Bloqueio | "Já existe um time com esse nome nesta categoria. Use outro nome." (hoje `team-registration-draft.ts:274`) |

Princípio: o motivo aparece **no momento em que a pessoa escolhe o atleta**, não só ao enviar. Hoje todos os problemas aparecem juntos depois do "Concluir" (`FormularioInscricaoRapida.tsx:310-312`), que é tarde (A4).

## 6. Textos de tela em linguagem simples

Troca de termos (vale para toda a interface do líder):

| Evitar | Usar |
|---|---|
| Rascunho | Em preenchimento / Ainda não enviada |
| Concluir cadastro | Enviar inscrição |
| Série, categoria/série | Categoria |
| Slug, token, ID | (nunca mostrar) |
| Elenco | Atletas do time (aceitar "elenco" em subtítulos) |
| Comissão técnica | Comissão técnica (já é termo do esporte) |
| CIN, CTPS, Passaporte | "RG ou outro documento com foto" (lista longa só em "Mais opções") |
| Aprovada, aguardando aprovação | Inscrição confirmada |
| Criando link | Salvando seu time |
| Falha ao salvar | Não salvou. Vamos tentar de novo (e botão [Tentar agora]) |

Mensagens prontas:

- **Título T1:** "Você foi chamado para jogar {Campeonato}".
- **Botão T1:** "Começar".
- **Ajuda T2:** "Só o nome do time e o seu contato. O resto você completa depois."
- **Confirmação de time salvo:** "Time criado. Agora vamos colocar os atletas."
- **Estado vazio de atletas:** "Seu time ainda não tem atletas. Cole a lista do WhatsApp e a gente separa nome e camisa."
- **Prontidão:** "Seu time tem {n} atletas. {k} estão sem {item}."
- **Autosave:** "Salvo às {hh:mm}".
- **Falha de rede:** "Sem internet agora. Seus dados estão guardados neste celular e serão enviados quando voltar."
- **Foto:** "Não conseguimos enviar a foto. Tente de novo ou pule e envie depois." (substitui o texto do bucket, A3)
- **Excluir atleta:** "Remover {Nome} do time?" [Remover] [Cancelar], e depois "Removido. Desfazer".
- **Sucesso do envio:** "Inscrição enviada. {Nome do time} está na categoria {Categoria}." + [Ver minha inscrição]. Não dizer "aprovação".
- **Convite já usado:** "Este convite já foi usado pelo time {Nome}. É o seu?"
- **Link do organizador quebrado:** "Esse link não funciona mais. Peça outro a {Organizador}."
- **Pós-prazo:** "O prazo terminou. Para mudar um atleta agora, peça ao organizador."
- **Login:** erro "E-mail ou senha incorretos. [Esqueci minha senha]".

## 7. Onboarding

Meta: o líder **nunca vê um painel vazio**. O primeiro dia tem um único caminho.

1. **Entrada pelo link do organizador** (principal): T1, T2, T3. Não há pergunta "O que você quer fazer hoje?" (prompt, linha 176) porque o link já diz a intenção. Essa pergunta só aparece para quem chega pelo site sem link (`/cadastro` sem parâmetros), com 2 botões: "Tenho um convite de organizador" (pede o link ou código) e "Quero cadastrar meu time" (cria o time e vai para Meu Time). A opção "Sou organizador" continua levando para `/seja-membro`. Isso corrige A1.
2. **Checklist fixo no topo do Meu Time** (some quando completo):
   - Criar o time (feito)
   - Colocar os atletas
   - Completar quem está faltando
   - Inscrever em uma competição
   - Convidar um atleta para completar o próprio perfil (opcional)
3. **Dica contextual única por tela**, sempre dispensável: no T3 "Dica: copie a lista do grupo do time e cole aqui"; no T5 "Quem não pode jogar aparece apagado com o motivo".
4. **Retorno**: ao reabrir o link ou o app, a tela inicial é o "Próximo passo" (T8), nunca um menu.
5. **Mensagem de volta ao WhatsApp**: depois de concluir, botão "Compartilhar com o time" com texto pronto: "Nosso time {Nome} está inscrito em {Campeonato} ({Categoria}). Veja aqui: {link}". (HIPÓTESE: ajuda o boca a boca; validar uso.)
6. **Atleta** (opcional no MVP, doc 08 seção 5): o líder pode mandar um link para cada atleta completar nascimento, foto e documento. Para menores, o responsável legal autoriza (prompt, linha 194). Sem isso, o líder digita tudo, e a meta de tempo depende de quanto o organizador exige.

## 8. Métricas

Meta principal (prompt e doc 08): **time + 10 atletas em menos de 5 minutos, no celular, por pelo menos 90% das pessoas, sem ajuda.**

### 8.1 Eventos a registrar (por convite, sem dados pessoais nos eventos)

`convite_aberto`, `time_criado`, `lista_colada`, `lista_confirmada`, `atleta_adicionado` (origem: lista, um a um, link), `prontidao_exibida` (com n de pendências), `inscricao_iniciada`, `inscricao_enviada`, `inscricao_confirmada`, `erro_exibido` (código da regra), `retomada_pelo_link`, `retomada_por_login`. Medição por convite permite separar organizador, categoria e dispositivo.

### 8.2 Indicadores

| Camada | Métrica | Meta (HIPÓTESE) | Como medir |
|---|---|---|---|
| Tempo | Mediana do clique no link até "inscrição enviada" com 10 atletas | < 5 min; p90 < 8 min | Timestamps dos eventos; teste moderado com cronômetro |
| Conclusão | % de convites abertos que chegam a `inscricao_enviada` em 7 dias | >= 60% (doc 08) | Funil por convite |
| Passo a passo | Saída por etapa (T1 a T6) | Nenhuma etapa com > 20% de saída (doc 08) | Funil por etapa |
| Sem ajuda | % de testes concluídos sem intervenção | >= 90% | 5 a 8 testes no celular, sem ajuda |
| Erros por tela | Média de erros exibidos por sessão | < 1 por sessão; nenhum erro técnico (bucket, ID) | `erro_exibido` por tela |
| Lista colada | % de times que usam "Colar lista" | >= 70% dos times com 6+ atletas | Evento `lista_colada` |
| Prontidão | % de atletas completos no envio | >= 80% (se o organizador exigir mais, medir) | Estado do banco |
| Retomada | % dos que voltam e continuam (por link ou login) | Sem meta até ter linha de base | `retomada_*` |
| Reuso do banco | % de times com 2+ inscrições que reaproveitam o banco | >= 50% (HIPÓTESE; mede o pilar Meu Time) | Inscrições por time |
| Conta | % de líderes que criam senha ou verificam e-mail/WhatsApp em até 7 dias | Medir; sem meta | Eventos de conta |
| Satisfação | "Foi fácil cadastrar seu time?" (1 pergunta, 1 a 5) no T7 | Mediana >= 4 | Pergunta in-app |

### 8.3 Como validar antes de construir tudo (ver seção 9)

Teste com 5 a 8 líderes reais, no próprio celular, usando o link atual (baseline) e depois o protótipo. Baseline atual é desconhecido: **não temos medição**. A primeira tarefa é medir o fluxo de hoje para saber o quanto a lista colada e a conta leve realmente ganham.

## 9. Plano de validação com pessoas reais

1. **Baseline (esta semana):** 5 líderes, link por vaga atual, "cadastre este time com 10 atletas a partir da lista do grupo". Cronometrar, contar toques, registrar travas e frases literais. Meta: ter o tempo atual e o top 3 de travas.
2. **Protótipo de baixa fidelidade (T1 a T6 no Figma ou papel):** 5 líderes diferentes, mesma tarefa. Medir tempo e erros.
3. **Teste de compreensão dos textos (seção 6):** mostrar 8 mensagens de erro/aviso e perguntar "o que você faria agora?". Meta: >= 90% acertam a ação.
4. **Teste de conta:** comparar duas variantes para a hipótese "senha só no fim": A) e-mail/WhatsApp no T2 e senha no T8; B) senha no T2. Medir saída em T2.
5. **Roteiro do doc 08** (3.2) cobre perguntas de contexto: quem junta documentos, onde vive a lista do time, quantas competições por ano. Aproveitar as mesmas entrevistas.

## 10. Recomendações priorizadas para `frontend`, `designer` e dono do produto

**P0 (sem isso, o pilar não existe)**
1. Criar a conta Meu Time **no ato do T2**, ligada ao convite (resolve C2). Banco de atletas por time (C1).
2. Colar lista do WhatsApp (C4). Maior ganho de tempo; prompt linha 192 e doc 08 8.4.
3. Alinhar `/capitao` com a regra sem aprovação: remover os textos e bloqueios de aprovação (C3: `capitao/page.tsx:189`, `443-447`, `456`, `557-564`, `169`; `FormularioInscricaoRapida.tsx:354`, `370`).
4. Contador de elenco e prontidão na tela (A8, C5 parcial).

**P1**
5. Aviso de elegibilidade por idade e naipe na escolha do atleta (C5), depois que o servidor passar a validar.
6. Tirar do cadastro de conta os campos de quadra, treino e Instagram (A2, `cadastro/page.tsx:986-1089`) e levar para "Dados do time".
7. Corrigir o destino de `/cadastro` sem parâmetros (A1, `cadastro/page.tsx:158-161`) e as rotas mortas (M8).
8. Trocar mensagens técnicas e termos (A3, M6) e tratar o erro do clipboard (M5).
9. Consolidar os três tipos de link em um padrão de tela (A5) e melhorar os estados de prazo (M7).

**P2**
10. Link para o atleta completar o próprio perfil (menores com autorização do responsável).
11. Comissão técnica como aba.
12. Compartilhar com o time pelo WhatsApp; "Avisar quando abrir" nas inscrições futuras.
13. Importar planilha; clube com várias equipes (camada adiada).

### Perguntas em aberto para o dono do produto (afetam o desenho)

1. **Login do líder:** manter e-mail e senha (como hoje) ou adotar código por e-mail/WhatsApp (prompt)? Isso muda o T2 e o T8.
2. **Foto e documento obrigatórios:** quando o organizador exigir, devem bloquear o envio ou podem ficar como pendência com prazo? Define se a meta de 5 minutos vale com ou sem esses campos.
3. **Atleta em dois times:** como identificar o mesmo atleta (CPF obrigatório? nome + nascimento)? Sem isso a regra do prompt não pode ser implementada nem explicada.
4. **Idade e naipe:** violação bloqueia o envio ou apenas avisa e o organizador resolve depois (coerente com "sem aprovação")? Minha recomendação: **avisar** idade e **bloquear** só quando o servidor não puder aceitar.
5. **Link do organizador após a conta:** o convite expira após a inscrição ser enviada, ou continua editável pela configuração do campeonato (requisito, regra 4)? A UX do T1 "convite já usado" depende disso.
6. **Menores de idade:** autorização do responsável fica com o líder (termo no envio) ou com a plataforma (doc 08, pergunta 4)?

## 11. Resumo de aderência às regras aprovadas

- Link por categoria, líder cadastra direto, sem aprovação: **respeitado** em todo o desenho (T6 envia e confirma; sem estado "Em análise" ou "Recusada").
- Meu Time central: T2 cria a conta, T4 é o banco, T5 usa o banco, T8 é a home.
- Nenhuma regra de revogação ou validade de link foi presumida (requisito, regra 8); a pergunta 5 apenas registra a dependência.
- Tudo marcado como HIPÓTESE precisa ser validado na seção 9 antes de virar compromisso.
