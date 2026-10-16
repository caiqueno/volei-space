# Volei Space: avaliar a plataforma e planejar a evolução a partir do e-Scoresheet

## Objetivo

Avaliar a plataforma **Volei Space** (branch `main`) e montar um plano para torná-la o melhor software de gestão de partidas de vôlei do mercado. A referência funcional é o **e-Scoresheet**, a súmula eletrônica da Data Project usada por federações filiadas à FIVB, à CEV e à NORCECA.

O trabalho tem duas etapas:

1. **Análise e design:** uma **análise de lacunas** e um **plano de evolução priorizado**, sem código novo.
2. **Correções e novas versões:** executar o plano aprovado em ciclos curtos, sempre rodando e testando **localmente** antes de publicar (ver "Fluxo de correções e publicações").

---

## Contexto

| Item | Referência |
|---|---|
| Nosso repositório | https://github.com/athrios/volei-space (branch `main`) |
| Ferramenta de engenharia reversa | REA: Reverse Engineer Anything (https://github.com/morluto/rea, pacote npm `rea-agents`) |
| Produto de referência | Data Project e-Scoresheet (https://www.dataproject.com/Products/EN/en/Volleyball/eScoresheet) |
| Concorrente secundário | VolleyStation (súmula, scout e desafio; adotado no modelo de desafio da Superliga 2025/26) |
| Regras oficiais | FIVB Official Volleyball Rules e Instruções de Preenchimento da Súmula (CBV/COBRAV, revisão de fev/2025) |

---

## Agentes já criados (sem duplicar)

Os agentes permanentes do projeto ficam em `.claude/agents/`. **Papéis que já existem lá não são recriados**; os agentes numerados abaixo usam os existentes quando a função é a mesma:

| Agente do prompt | Agente em `.claude/agents/` |
|---|---|
| 1 `analista-codigo`, 6 `arquiteto-frontend`, 7 `arquiteto-backend` | `arquiteto`, `frontend`, `backend`, `banco-de-dados` |
| 3 `especialista-regras`, 9 `especialista-arbitragem` | `regras-de-volei` |
| 5 `designer-ux-ui` | `ux` e `designer` |
| 10 `engenheiro-qa` | `qa` |
| 11 `engenheiro-devops` | `devops-infra` e `devops-app` |
| (novos) | `seguranca`, `dados-do-campeonato`, `suporte-organizacao`, `conteudo-instagram` |

Sem equivalente em `.claude/agents/` e, por isso, ainda a criar quando necessário: 2 `engenheiro-reverso`, 4 `arquiteto-produto` e 8 `analista-negocio` (os relatórios 01, 02, 03 e 08 já foram gerados por execuções pontuais).

## Agentes da análise

Crie os agentes abaixo. Cada um entrega um relatório em Markdown dentro de `docs/analise/`.

### 1. `analista-codigo`: diagnóstico do Volei Space
- Clonar o repositório e mapear a arquitetura: stack, módulos, modelo de dados, APIs, autenticação e testes.
- Listar as funcionalidades que já existem, com o caminho do arquivo e a linha que comprova cada uma.
- Apontar dívida técnica, riscos de segurança e lacunas de testes.
- **Entrega:** `01-diagnostico-volei-space.md`

### 2. `engenheiro-reverso`: estudo do e-Scoresheet com o REA
- Instalar o REA (`npx rea-agents setup`) somente a partir das fontes oficiais.
- Estudar o e-Scoresheet pelo **comportamento observável** e pela documentação pública (manual do usuário, páginas do produto, vídeos de treinamento), extraindo:
  - fluxo completo de uma partida: pré-jogo, papeleta, sets, tempos, substituições, líbero, sanções, protestos, encerramento e assinaturas;
  - regras de validação: rotação, limite de substituições, substituição excepcional, líbero e redesignação, tempo técnico, set de desempate;
  - integrações: Web Competition Manager, Live Score, app de banco, app do árbitro e exportação para Data Volley;
  - formatos de saída: PDF oficial da súmula e dados para placar e estatística.
- Para cada conclusão, registrar a evidência e as limitações, como o REA exige.
- **Entrega:** `02-referencia-e-scoresheet.md`

### 3. `especialista-regras`: regras oficiais como especificação
- Converter as regras da FIVB e o guia de súmula da CBV em uma **lista de regras testáveis**, no formato "dado / quando / então".
- Marcar o que muda entre indoor e praia e entre competições FIVB, CBV e estaduais.
- **Entrega:** `03-regras-validaveis.md`

### 4. `arquiteto-produto`: lacunas e roadmap
- Cruzar os relatórios 01, 02 e 03 em uma **matriz de lacunas** com as colunas: funcionalidade · e-Scoresheet · VolleyStation · Volei Space · prioridade · esforço.
- Propor onde o Volei Space pode **superar** a referência. Exemplos: rodar 100% no navegador e offline-first, papeleta digital no celular do técnico, sincronização em tempo real, validação explicada ao apontador e preço acessível para federações estaduais e clubes.
- Montar o roadmap em fases (MVP, Federação, Profissional) com critérios de aceite.
- **Entrega:** `04-gap-analysis-e-roadmap.md`

---

## Time de design: front-end e back-end

Estes agentes começam depois do relatório 04 e desenham a solução a partir do roadmap. O produto desta fase é **especificação e protótipo**, não código de produção. Os três trabalham juntos, e o contrato da API é o ponto de encontro entre front e back.

### 5. `designer-ux-ui`: experiência e interface
- Mapear as personas: apontador, árbitro, técnico, organizador da competição, torcedor e imprensa.
- Desenhar os fluxos críticos. O principal é a súmula ao vivo: o apontador registra um ponto em **um toque** e uma substituição em **até três**, sem tirar os olhos da quadra.
- Criar o design system: cores, tipografia, componentes, estados de erro e validação. Tudo com tema claro e escuro e alto contraste para ginásio iluminado.
- Prototipar as telas: papeleta no celular, súmula no tablet, app de banco, app do árbitro, placar ao vivo e painel do organizador.
- Garantir acessibilidade (WCAG 2.2 AA) e uso em tablet na horizontal, celular e telão.
- **Entregas:** `05-ux-fluxos-e-personas.md` e protótipo navegável (Figma ou HTML)

### 6. `arquiteto-frontend`: aplicações cliente
- Escolher e justificar a stack: framework web, PWA ou app nativo, gerenciamento de estado e biblioteca de componentes.
- Projetar o **offline-first**: a súmula precisa funcionar sem internet no ginásio e sincronizar sem conflito quando a conexão voltar.
- Definir a estrutura dos apps (súmula, banco, árbitro, placar, painel) e o que eles compartilham: componentes, regras de validação no cliente e tipos gerados a partir do contrato da API.
- Planejar tempo real (WebSocket ou SSE), internacionalização (pt-BR, en, es), geração do PDF oficial e testes (unitários, de componente e ponta a ponta).
- **Entrega:** `06-arquitetura-frontend.md`

### 7. `arquiteto-backend`: servidor, dados e integrações
- Escolher e justificar a stack: linguagem, framework, banco de dados e hospedagem.
- Modelar o domínio: competição, equipe, atleta, partida, set, rally, papeleta, substituição, sanção, protesto e assinatura.
- Implementar a súmula como **log de eventos imutável** (event sourcing): cada ação é um evento, o placar é derivado dos eventos, e é possível desfazer e auditar tudo.
- Concentrar as regras do `03-regras-validaveis.md` em um **motor de regras** único, compartilhado com o front-end e coberto por testes.
- Escrever o contrato da API (OpenAPI para REST e eventos de tempo real) antes do código.
- Cobrir autenticação e perfis de acesso (apontador, árbitro, técnico, organizador), assinatura digital da súmula, LGPD para dados de atletas, escalabilidade em dia de rodada cheia, observabilidade e backups.
- Planejar as integrações: exportação `.dvw`, placar para transmissão, sites de federações e importação de atletas.
- **Entregas:** `07-arquitetura-backend.md` e `07-api-contrato.yaml`

---

## Time de validação e operação

### 8. `analista-negocio`: o que estamos criando faz sentido?
Trabalha **desde o início, em paralelo**, e revisa a entrega de cada fase antes de ela ser aprovada.
- Definir os segmentos de cliente e o problema de cada um: federações estaduais, ligas amadoras, campeonatos escolares e universitários, torneios empresariais, clubes e organizadores independentes.
- Montar o roteiro de entrevistas com técnicos, organizadores e apontadores, e resumir o que eles pagam hoje, o que os irrita e o que os faria trocar de ferramenta.
- Propor o modelo de receita e justificar. Hipótese inicial: o time usa de graça; o organizador paga por competição ou por assinatura; a federação paga um plano anual. Avaliar também uma taxa sobre as inscrições pagas pela plataforma.
- Dizer **o que fica fora do MVP**, para lançar rápido.
- Definir as métricas de sucesso. Exemplos: tempo até a primeira inscrição (meta: menos de 10 minutos), taxa de inscrições concluídas, competições criadas por mês e partidas com súmula eletrônica.
- Revisar a experiência de cadastro de times (seção abaixo) com usuários reais antes do desenvolvimento.
- **Entrega:** `08-validacao-negocio.md`

### 9. `especialista-arbitragem`: guardião das regras
- Revisar o `03-regras-validaveis.md` e os protótipos da súmula com olhar de árbitro e apontador.
- Montar **casos de jogo reais e difíceis** para testar o sistema: substituição excepcional por lesão, líbero redesignado, sanções acumuladas, erro de rotação descoberto depois, set de desempate e partida interrompida.
- Validar se o PDF gerado seria aceito por um delegado técnico da CBV e da FIVB.
- **Entrega:** `09-casos-de-jogo-e-validacao-arbitragem.md`

### 10. `engenheiro-qa`: qualidade
- Definir a estratégia de testes: motor de regras (meta: 100% das regras cobertas), API, interface e ponta a ponta.
- Transformar os casos do agente 9 em testes automatizados.
- Testar o uso real no ginásio: internet caindo, tablet com bateria fraca, dois apontadores no mesmo jogo e sincronização depois de horas offline.
- Testar a usabilidade do cadastro com pessoas que nunca usaram o sistema.
- **Entrega:** `10-estrategia-de-qualidade.md`

### 11. `engenheiro-devops`: infraestrutura
- Desenhar ambientes (desenvolvimento, homologação, produção), CI/CD, infraestrutura como código e custos estimados por mês.
- Garantir disponibilidade em dia de rodada cheia, com monitoramento, alertas, logs e backups testados.
- Cobrir segurança: segredos, criptografia, LGPD (dados de menores de idade) e plano de recuperação de desastre.
- **Entrega:** `11-infraestrutura-e-operacao.md`

---

## Módulos que a plataforma final deve cobrir

1. **Meu Time e Competições:** cadastro de times e atletas, competições de vários organizadores, inscrições e escala de arbitragem. É a porta de entrada do produto (detalhes na seção seguinte).
2. **Papeleta digital:** o técnico envia a rotação inicial, o sistema valida, e a papeleta fica bloqueada depois de enviada.
3. **Súmula eletrônica:** o núcleo do produto. Todas as regras são validadas em tempo real e a súmula oficial sai em PDF.
4. **App de banco:** pedido de tempo, substituição e desafio.
5. **App do árbitro:** consulta da súmula em tempo real.
6. **Placar ao vivo:** telão, site e overlay para transmissão.
7. **Estatística (scout):** por fundamento, com exportação compatível com `.dvw`.
8. **Desafio de vídeo:** fase posterior.

---

## Experiência prioritária: cadastro de times e inscrição em competições

É o primeiro contato da maioria dos usuários com o Volei Space. Se o cadastro for difícil, ninguém chega até a súmula. Por isso os agentes 5, 6, 7 e 8 tratam esta seção como **requisito de primeira classe**.

### Princípios
1. **Pensado para quem nunca usou.** Linguagem simples, sem termos técnicos, e um próximo passo claro em todas as telas.
2. **Celular primeiro.** O técnico cadastra o time no celular, no intervalo do treino.
3. **Nenhum beco sem saída.** Se a pessoa clicar em "Participar" sem ter time, cria o time ali mesmo e continua a inscrição. Nada se perde no caminho.
4. **Cadastrar uma vez, usar sempre.** Os atletas ficam no banco do time e são reaproveitados em qualquer competição.
5. **Salva sozinho.** Todo formulário longo guarda rascunho automaticamente.
6. **O sistema avisa antes de errar.** Idade, naipe, documentos e limites de elenco são conferidos na hora, com a explicação do motivo.

### Os três perfis e o que cada um vê

| Perfil | O que faz |
|---|---|
| **Responsável pelo time** (técnico, dirigente, capitão) | Cadastra o time e os atletas, se inscreve em competições, monta a papeleta nos jogos |
| **Organizador** | Cria competições, aprova inscrições, monta tabela e escala arbitragem. Pode haver **N organizadores** independentes na plataforma |
| **Atleta** | Recebe convite, completa o próprio perfil e acompanha seus jogos (opcional no MVP) |

Uma mesma pessoa pode ter mais de um perfil. Exemplo: técnico de dois times e organizador de um torneio. A troca de perfil fica no menu do usuário.

### Primeiro acesso (onboarding)
1. Entrar com Google, e-mail ou código pelo WhatsApp. Sem senha obrigatória.
2. Pergunta única: **"O que você quer fazer hoje?"**
   - Cadastrar meu time
   - Organizar um campeonato
   - Sou atleta e recebi um convite
3. O sistema leva direto para o fluxo escolhido. Nenhum painel vazio.

### Área "Meu Time"

**Criar o time em 30 segundos:** só nome, cidade, naipe (feminino, masculino ou misto) e escudo (opcional). O resto pode ser preenchido depois.

**Abas:**
- **Atletas:** o banco de jogadores do time.
- **Comissão técnica:** técnico, assistente, preparador físico, fisioterapeuta e médico. Esses dados vão para a súmula.
- **Dados do time:** CNPJ (opcional), contato, cores do uniforme e outros responsáveis com acesso.
- **Inscrições:** competições em que o time está inscrito e o status de cada uma.

**Formas de adicionar atletas (da mais rápida à mais completa):**
1. **Colar uma lista:** o técnico cola "nome, número" do WhatsApp ou de uma planilha e o sistema separa tudo.
2. **Importar planilha** (modelo para baixar).
3. **Link de convite:** o atleta preenche os próprios dados e documentos pelo celular. Para menores de idade, o responsável legal autoriza.
4. **Um por um:** nome e data de nascimento são obrigatórios. Número preferido, posição, foto, CPF e documento podem vir depois.

**Indicador de prontidão:** um cartão no topo mostra, por exemplo, "Seu time tem 9 atletas. 2 estão sem documento." e leva direto ao que falta.

**Clube com várias equipes:** se o responsável tiver mais de uma equipe (Sub-17 feminino, Adulto masculino…), o banco de atletas é do **clube** e cada equipe usa os atletas que precisar. Para quem tem só um time, essa camada fica invisível e a tela continua se chamando "Meu Time".

### Área "Competições"

**Explorar:** cartões com nome, organizador, datas, cidade, categoria, naipe, vagas restantes, prazo e valor da inscrição. Filtros por cidade, data, categoria, naipe e "inscrições abertas".

**Selo de elegibilidade em cada cartão**, calculado com base no banco de atletas do time:
- ✅ "Seu time pode participar"
- ⚠️ "Faltam 2 atletas na idade permitida"
- ⛔ "Competição só para o naipe masculino"

**Competição privada:** o organizador compartilha um link ou código e só quem tem o link a encontra.

### Inscrição (assistente em 4 passos)

1. **Confirmar o time.** Escolher qual equipe vai jogar (se houver mais de uma) e conferir os dados.
2. **Escolher os atletas do banco.**
   - Lista com caixas de seleção. Quem não é elegível aparece apagado, com o motivo ("nasceu antes de 2008").
   - Para cada selecionado: número da camisa, capitão e líbero. O sistema sugere o número preferido e avisa se houver número repetido.
   - Contador fixo na tela: "10 selecionados · mínimo 6 · máximo 14 · líberos: 1 de 2".
   - Botão "+ Novo atleta" para cadastrar sem sair da inscrição. O atleta entra no banco também.
3. **Comissão técnica.** Escolher quem vai ao banco de reservas, respeitando o limite da competição.
4. **Revisar e enviar.** Resumo completo, aceite do regulamento (com link para o PDF), pagamento se houver (Pix ou cartão) e botão **Enviar inscrição**.

**Status da inscrição**, sempre visível para o time:
Rascunho → Enviada → Em análise → **Pendência** (o organizador pede correção com um comentário) → Aprovada · Recusada (com motivo) · Lista de espera.

**Regras importantes:**
- A lista de atletas da inscrição é uma **cópia própria**. Mudanças no banco do time não alteram inscrições já enviadas.
- Até o prazo de inscrição, o time edita a lista livremente. Depois do prazo, a troca vira um **pedido** que o organizador aprova ou recusa.
- Um atleta não pode estar em dois times da mesma competição. O sistema bloqueia e explica o motivo.
- Nos jogos, a papeleta usa os atletas da inscrição aprovada, sem novo cadastro.

### Visão do organizador

**Criar competição** (assistente): nome, modalidade (quadra ou praia), naipe, categoria, datas, local, número de vagas, prazo, valor, visibilidade (pública ou privada) e aprovação automática ou manual.

**Regras de elenco** configuráveis, com modelos prontos ("Padrão FIVB", "Padrão CBV", "Amador livre"): mínimo e máximo de atletas, número de líberos, faixa de idade, documentos exigidos, limite de comissão técnica e prazo de troca de atletas.

**Painel de inscrições:** lista com filtros por status, aprovação em um clique, pedido de correção com comentário, visualização de documentos e exportação em planilha ou PDF.

**Equipe do organizador:** vários membros com papéis diferentes (administrador, financeiro, arbitragem).

**Privacidade entre organizadores:** cada organizador vê **somente** os times e atletas inscritos nas suas competições. O banco completo de atletas de um time nunca fica visível para organizadores.

### Notificações
E-mail, WhatsApp e push para: inscrição aprovada, pendência, prazo terminando em 48 horas, tabela publicada e jogo amanhã.

### Navegação sugerida (responsável pelo time)
`Início` · `Meu Time` · `Competições` · `Jogos` · `Perfil`

### Modelo de dados de referência (para o agente 7)
`Usuario` · `Clube` · `Equipe` · `MembroEquipe (papel)` · `Atleta` · `VinculoAtletaClube` · `Organizador` · `MembroOrganizador (papel)` · `Competicao` · `RegraElenco` · `Inscricao (status)` · `InscricaoAtleta (número, capitão, líbero)` · `InscricaoComissao` · `PedidoTroca`

### Metas de usabilidade (para os agentes 8 e 10)
- Quem nunca usou cria o time e cadastra 10 atletas em **menos de 5 minutos** no celular.
- Do cartão da competição até "Inscrição enviada" em **menos de 3 minutos**, com o time já cadastrado.
- Pelo menos 90% dos participantes do teste concluem a inscrição sem ajuda.

---

## Fluxo de correções e publicações (ambiente local)

Toda correção ou funcionalidade nova segue este ciclo: **rodar local → corrigir → testar → revisar → publicar versão**. O agente 11 (`engenheiro-devops`) é dono deste fluxo e entrega os scripts. Os demais agentes seguem o fluxo.

### 1. Preparar o ambiente local (uma vez)
O agente 1 descobre a stack real do repositório e documenta os comandos exatos no `README.md`. O ambiente precisa ter:
- Pré-requisitos com versões fixas (por exemplo Node.js, Python, Docker), registradas em arquivo de versão (`.nvmrc`, `.tool-versions` ou equivalente).
- `.env.example` com todas as variáveis necessárias e valores de teste. **Nunca** commitar `.env` com segredos reais.
- Banco de dados e serviços auxiliares subindo com **um comando** (`docker compose up -d`).
- **Dados de exemplo (seed):** 2 organizadores, 3 competições (uma aberta, uma privada, uma encerrada), 4 times com atletas e uma partida em andamento. Assim qualquer tela pode ser testada logo depois de instalar.
- Comandos padronizados para que qualquer pessoa ou agente rode o projeto do mesmo jeito:

| Comando | O que faz |
|---|---|
| `setup` | Instala dependências, cria o `.env` a partir do exemplo, sobe o banco e roda migrations e seed |
| `dev` | Sobe front-end e back-end com recarga automática |
| `test` | Roda todos os testes |
| `lint` | Confere estilo e tipos |
| `build` | Gera a versão de produção localmente |
| `reset-db` | Apaga e recria o banco local com o seed |

Os nomes exatos dependem da stack (`npm run`, `make` ou `just`). O importante é existir um comando para cada linha.

### Branches
| Branch | Papel |
|---|---|
| `main` | Versão estável. Só recebe código que já passou pela `teste-integrado` |
| `teste-integrado` | Ambiente de **teste integrado, rodando localmente**. Todas as correções e novidades entram aqui primeiro e são testadas juntas |
| `fix/…`, `feat/…`, `docs/…` | Branches de trabalho, criadas a partir da `teste-integrado` |

Fluxo: `fix/…` ou `feat/…` → PR para **`teste-integrado`** → teste integrado local → PR de `teste-integrado` para **`main`** → nova versão.

### 2. Fazer uma correção ou funcionalidade
1. Atualizar a `teste-integrado` local: `git checkout teste-integrado && git pull`. Se a branch não existir, criar a partir da `main`.
2. Criar uma branch de trabalho a partir dela, com nome padronizado:
   - `fix/<descricao-curta>` para correções
   - `feat/<descricao-curta>` para funcionalidades
   - `docs/<descricao-curta>` para documentação
3. Implementar a mudança com testes. Toda correção de bug ganha um teste que falhava antes e passa depois.
4. Rodar localmente `lint`, `test` e `build`. **Tudo precisa passar.**
5. Testar a tela afetada no navegador com o seed, incluindo a versão de celular.
6. Fazer commits no padrão Conventional Commits (`fix: corrige contagem de líberos na inscrição`).
7. Abrir um Pull Request contra a **`teste-integrado`** com: o que mudou, por quê, como testar e prints das telas alteradas.
8. Revisão por outro agente ou pessoa: back-end revisa back-end, front-end revisa front-end, e mudanças em regras de jogo passam pelo agente 9.
9. Só fazer merge com o CI verde e a revisão aprovada.
10. Depois do merge, rodar a `teste-integrado` localmente (`reset-db`, `dev`, `test`) e conferir que a mudança funciona junto com as outras.

### 3. Publicar uma nova versão
1. Versionar no padrão **SemVer**:
   - `MAJOR` (2.0.0): mudança que quebra compatibilidade (API, formato de dados)
   - `MINOR` (1.3.0): funcionalidade nova
   - `PATCH` (1.2.1): correção
2. Atualizar o `CHANGELOG.md` em linguagem simples, separando Novidades, Correções e Mudanças importantes.
3. Na `teste-integrado`, rodar a versão final localmente com `build` e testar os fluxos críticos: primeiro acesso, cadastro de time, inscrição, papeleta e uma súmula completa.
4. Com tudo aprovado, abrir o PR de `teste-integrado` para `main`, fazer o merge, criar a tag na `main` (`v1.3.0`) e publicar primeiro em **homologação**, depois em **produção**.
5. Manter um **plano de volta** documentado: como reverter para a versão anterior em menos de 10 minutos, incluindo as migrations do banco.
6. Nunca publicar em produção durante uma rodada com jogos em andamento.

### 4. Regras para os agentes
- Nenhum agente faz push direto na `main` ou na `teste-integrado`, publica versão ou altera produção sem aprovação humana.
- Cada ciclo deve ser pequeno: um PR por correção ou funcionalidade.
- Um problema encontrado e não corrigido na hora vira issue, com passos para reproduzir.
- **Entrega do agente 11:** `12-guia-ambiente-local-e-publicacao.md`, scripts dos comandos acima, `docker-compose.yml`, `.env.example`, seed e pipeline de CI.

---

## Limites (obrigatórios)

- **Não copiar código, assets, textos ou layouts proprietários** da Data Project ou da VolleyStation. A engenharia reversa serve para **entender o comportamento e os requisitos**. A implementação é nossa, escrita do zero.
- Antes de qualquer análise de binário, verificar a licença de uso (EULA) do e-Scoresheet. Se ela proibir engenharia reversa, limitar o estudo à documentação pública e ao uso normal do software.
- Não usar credenciais, chaves ou contas reais de terceiros.
- Toda afirmação nos relatórios precisa de fonte: link, arquivo:linha ou evidência do REA.

---

## Critérios de pronto

- [ ] Os onze relatórios existem em `docs/analise/` e citam suas fontes.
- [ ] O protótipo cobre o primeiro acesso, Meu Time, Competições, o assistente de inscrição, o painel do organizador, a papeleta, a súmula ao vivo, o app de banco e o placar.
- [ ] O fluxo de cadastro e inscrição foi testado com pelo menos 5 pessoas que nunca usaram o sistema e atingiu as metas de usabilidade.
- [ ] O analista de negócio aprovou o escopo do MVP e o modelo de receita.
- [ ] Uma pessoa nova consegue clonar o repositório, rodar `setup` e `dev` e ver o sistema com dados de exemplo em menos de 15 minutos, seguindo só o `README.md`.
- [ ] Existem `CHANGELOG.md`, versionamento SemVer, CI rodando `lint`, `test` e `build` em todo PR, e um plano de volta testado.
- [ ] O contrato da API foi revisado pelos arquitetos de front-end e back-end.
- [ ] As decisões de stack trazem as alternativas consideradas e o motivo da escolha.
- [ ] Todas as funcionalidades do e-Scoresheet aparecem na matriz de lacunas.
- [ ] Cada item do roadmap tem prioridade, esforço estimado e critério de aceite.
- [ ] Há uma lista com pelo menos 5 diferenciais em que o Volei Space supera a referência.
