# 30. Paridade entre o capitão / formulário legado e o líder do Meu Time (R15)

Decisão do dono: o time tem um perfil só, o líder do Meu Time. Os links do organizador (categoria, campeonato, vaga, rápida) viram **portas de entrada** para ele. Este documento lista o que o capitão (`/capitao`) e o formulário legado (`FormularioInscricaoRapida`, `team-registration-draft`) fazem e se o Meu Time já faz.

Estado em 2026-10-20. "Meu Time" = rotas em `src/app/api/meu-time/**` (atrás de `MEU_TIME_ATIVO=1`; campeonatos atrás também de `INSCRICAO_SOLICITACAO_ATIVO=1`).

## O que a rodada 15 entregou no servidor

| Item | Onde |
|---|---|
| Porta pública sem PII `GET /api/inscricao/entrada/[token]` (flag `INSCRICAO_VIA_MEU_TIME_ATIVO=1`, desligada = 404) | `src/app/api/inscricao/entrada/[token]/route.ts`, `src/lib/inscricao-entrada/resolver.ts` |
| Vitrine aceita `?convite=` (+ `categoriaId`) e inclui a categoria de competição privada liberada por esse convite | `src/app/api/meu-time/campeonatos/route.ts`, `abertaPorConvite` em `src/lib/inscricoes-solicitacao/servico.ts` |
| Solicitação já aceitava `categoriaId` + `convite`; nenhuma regra nova, só testes | `src/app/api/meu-time/campeonatos/solicitacoes/route.ts` |
| Escudo do time só por `https://` sem credenciais (fecha `javascript:`, `data:`, `http:`) | `escudoUrlSchema` em `src/lib/meu-time/schemas.ts` |

## Tabela de paridade

Legenda: SIM = o Meu Time já tem; PARCIAL = tem parte; NAO = falta.

| Capacidade | Capitão / formulário legado | Meu Time | Situação |
|---|---|---|---|
| Criar a equipe | Cadastro de candidatura + `ensureEquipeForCandidatura` (`/api/candidaturas/equipe`) | `POST /api/meu-time/equipes` | SIM |
| Editar nome da equipe | `PUT /api/capitao/equipe` | `PATCH /api/meu-time/equipes/[id]` (só responsável) | SIM |
| Editar cidade | Cadastro da candidatura (`CandidateEditForm`) | `PATCH /api/meu-time/equipes/[id]` | SIM |
| Logo / escudo por link | `PUT /api/capitao/equipe`: só URL do Storage próprio, da equipe e da liga | `PATCH` com `escudoUrl`: agora https sem credenciais; qualquer host https | PARCIAL (host livre) |
| Logo / escudo por upload assinado | `uploadTeamLogo` + `/api/uploads/assinar` tipo `equipe-emblema` (escopo equipe = `Equipe.id` inteiro) | Nenhuma rota de envio para `TimeClube` (uuid) | NAO (grande) |
| Cadastrar atleta (nome, nascimento, número, posição) | `POST /api/capitao/jogadores` | `POST /api/meu-time/equipes/[id]/atletas` | SIM |
| Editar / remover atleta | `POST` com `id`, `DELETE ?id=` | `PATCH` / `DELETE /api/meu-time/equipes/[id]/atletas/[atletaId]` (DELETE com motivo) | SIM |
| Lote / lista colada do WhatsApp | `FormularioInscricaoRapida` ("Colar lista") | `POST .../atletas/lote` (mesmo parser) | SIM |
| Importação CSV com prévia | Não tem | `POST /api/meu-time/importacao`, `.../[id]/confirmar` | Meu Time à frente |
| Número da camisa único no elenco | `validateUniqueJerseyNumber` | `montarSelecaoDoBanco` numera na inscrição; regras em `inscreverEquipe` | SIM |
| Duplicidade de atleta na categoria | `mensagemDuplicataNaCategoria` | Chave nome + nascimento no banco do time; unicidade na categoria em `inscreverEquipe` | SIM |
| Líbero e capitão em quadra | Papel e posição `LB` | `novaInscricaoSchema.atletas[].capitao/libero` | SIM |
| Foto de rosto do atleta (upload assinado) | `uploadAtletaFiles('foto')`, tipo `atleta-foto-rosto`, `normalizarFotoRostoEntrada` | Nenhum campo nem rota; `AtletaPublico` não tem foto | NAO (grande: exige coluna e rota) |
| Documento do atleta (upload privado) | `uploadAtletaFiles('documento')`, tipo `atleta-documento`, `normalizarDocumentoEntrada` | Só o indicador `temDocumento` (hash); sem envio nem leitura assinada | NAO (grande) |
| CPF / tipo e número de documento | `jogadorCapitaoSchema` (`cpf`, `documentoTipo`, `documentoNumero`) | Nenhum campo de entrada em `novoAtletaSchema` | NAO (grande: hash/cifra) |
| Telefone e telefone de emergência do atleta | Campos do formulário do capitão | Nenhum | NAO (grande: dado pessoal, cifra) |
| Responsável legal de atleta menor | Formulário legado só pede data de nascimento | `responsavel` + `aceiteResponsavel`, `POST .../consentimento`, cifrado, `RESPONSAVEL_DESNECESSARIO` para maior | Meu Time à frente |
| Comissão técnica | Campo `tecnico` no rascunho (nome livre) | `POST/DELETE /api/meu-time/equipes/[id]/comissao` (5 funções) | SIM |
| Equipe de acesso (técnico e assistente) | Uma conta por candidatura | `.../membros`, `/api/meu-time/convites` | Meu Time à frente |
| Responsável / líder da equipe | `lider` no rascunho; `responsavel` na candidatura | Papel `RESPONSAVEL` em `MembroEquipe` | SIM |
| Editar dados de contato da candidatura (e-mail, telefone) | `CandidateEditForm` seção `cadastro` | Conta do líder (`/api/auth/**`); sem edição de contato no Meu Time | PARCIAL |
| Quadra (endereço, piso, fotos) | Seção `quadra` da candidatura, upload `quadra-foto` | Nada | NAO (grande; é cadastro de candidatura, fora de inscrição) |
| Agenda / disponibilidade | Seção `disponibilidade` da candidatura | Nada | NAO (grande; idem) |
| Rascunho por token (retomar inscrição) | `InscricaoEquipeRascunho` + token em `/api/inscricao-rapida/[token]` | Não precisa: tudo é gravado na conta do líder; o link só abre a porta | Substituído (sem lacuna) |
| Mensagem ao organizador | Não tem | `mensagem` (500) em `POST /campeonatos/solicitacoes` | Meu Time à frente |
| Solicitar / inscrever em campeonato | `POST /api/inscricoes-campeonato` | `GET /api/meu-time/campeonatos`, `POST /campeonatos/solicitacoes`, `DELETE .../[id]` | SIM |
| Modo automático x com aprovação | Fixo (automático) | Por categoria (`modoInscricao`) | Meu Time à frente |
| Competição privada com convite | `?convite=` e token da categoria | `convite` em `solicitarSchema`; agora também na vitrine e pela porta | SIM |
| Janela de inscrição | `registrationWindowDecision` | Mesma função em `solicitarInscricao` | SIM |
| Elegibilidade da categoria (naipe, idade, mín. e máx. de atletas) | `lerElegibilidadeDaCategoria` | `GET /api/meu-time/categorias/[id]/regras`, `RegraElenco`, `GET .../prontidao` | SIM |
| Formulário configurável pelo organizador (campos obrigatórios) | `formularioInscricaoConfig` por liga e categoria (`resolveFormularioRapidaConfig`) | Não consulta a configuração | NAO (média: decidir quais campos viram pendência) |
| Máscara de CPF, nascimento e documento na leitura | `mascarar*` em `team-registration-draft` | Projeção por whitelist (`paraAtleta`): nunca devolve CPF, documento nem telefone | SIM |
| Status e ajustes pedidos pela organização | `statusInfo` do capitão (aprovada, ajuste pedido) | Estados `PENDENTE/APROVADA/RECUSADA/CANCELADA` + `motivoRecusa` + `/api/meu-time/notificacoes` | SIM |
| Jogos da equipe | Placeholder ("será conectado") | `GET /api/meu-time/jogos` | Meu Time à frente |
| QR Codes de validação do elenco | Só texto de roteiro; QR por atleta em `generateQRToken` no `POST /jogadores` | Nada | NAO (média; depende do uso do QR na súmula) |
| Link de vaga (`ConviteVagaEquipe`) abre rascunho com nome "Equipe NN" | `abrirInscricaoDaVaga` | Porta devolve a categoria da vaga; não pré-nomeia a equipe nem consome a vaga | PARCIAL |
| Entrada pelos links (categoria, campeonato, vaga) | Páginas `/inscricao/**` com formulário próprio sem conta | `GET /api/inscricao/entrada/[token]` (nova) | SIM no servidor; falta a tela |

## Lacunas pequenas fechadas no servidor

1. Escudo do time do Meu Time aceitava qualquer URL válida pelo Zod (incluindo `http:` e credenciais embutidas). O capitão já recusa host estranho. Agora só `https://` sem usuário e senha. Restringir ao Storage do projeto depende do envio assinado (abaixo).

## Lacunas grandes (só listadas)

1. Upload assinado de escudo, foto de rosto e documento de atleta para `TimeClube`/`Atleta`: os tipos de `src/lib/uploads/**` e o ator de `acesso-equipe.ts` assumem `Equipe.id` inteiro e `CandidaturaEquipe`. Precisa de caminho por uuid de time, regra de posse por `MembroEquipe` e, para foto/documento, colunas novas em `Atleta` (pedir ao agente `banco-de-dados`).
2. CPF, tipo e número de documento, telefone e telefone de emergência do atleta: dado pessoal que exige hash ou cifra e coluna (hoje só existem `cpfHash`/`documentoHash` sem rota de entrada).
3. Respeitar `formularioInscricaoConfig` (campo obrigatório por categoria) na inscrição do Meu Time: decisão de produto aberta no handoff (foto e documento bloqueiam ou viram pendência).
4. Quadra e agenda da candidatura: pertencem ao cadastro de candidatura, não à inscrição; decidir se entram no perfil do líder.
5. QR Code de validação por atleta.
6. Link de vaga: decidir se a vaga é consumida/nomeada ao entrar pelo Meu Time. Hoje o token de vaga não é aceito como convite por `avaliarConvite`, portanto a porta não devolve `conviteTokenParaApi` para vaga em competição privada. Se o organizador espera que o link de vaga libere a privada, é regra nova de convite e precisa de aprovação.
7. Telas: `/inscricao/**` e `/inscricao-rapida/**` ainda abrem o formulário legado; o redirecionamento para o Meu Time (consumindo a porta) é trabalho de frontend.

## Contrato da porta

`GET /api/inscricao/entrada/[token]` (pública, 30 requisições por minuto por IP, `Cache-Control: no-store`):

- 200 `{ data: { tipo: 'CATEGORIA'|'CAMPEONATO'|'VAGA', campeonato, ligaId, categorias: [{ categoriaId, nome, naipe?, modoInscricao, periodo: { abre, fecha }, situacao: 'ABERTA'|'FECHADA'|'ENCERRADA' }], privada, conviteTokenParaApi? } }`.
- `conviteTokenParaApi` só existe em competição privada quando o token é de categoria ou de link de campeonato vigente. Use-o como `convite` em `POST /api/meu-time/campeonatos/solicitacoes` e como `?convite=` em `GET /api/meu-time/campeonatos`.
- 404 `{ error }` idêntico para token inexistente, de formato inválido, desativado, revogado, expirado ou de campeonato não publicado.
- 404 com a flag desligada; 429 com `Retry-After`; 500 genérico.
- A resposta nunca contém o token (exceto o `conviteTokenParaApi`, que o chamador já possui), dados do organizador, vaga, rascunho ou PII.
