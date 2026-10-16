# 21 - Uploads com URL assinada (volei.space)

Agente: backend (segurança, rodada 2); ampliado na rodada 4 (branch `feat/r4-uploads-completos`). A rodada 2 entregou biblioteca e rotas. A rodada 4 acrescentou os tipos de candidatura, quadra, galeria e logo, e migrou para `src/lib/uploads-cliente.ts` os componentes `cadastro/page.tsx`, `CandidateEditForm.tsx`, `GaleriaOrganizador.tsx`, `OrganizacaoForm.tsx` e `InformacoesWizard.tsx` (a página do capitão já usava o fluxo). **Única exceção: `FormularioInscricaoRapida.tsx`**, ver "Rascunho por token" abaixo. Os componentes migrados saíram da lista de exceções de `scripts/anon-client-guard.test.ts`.

Contexto: a migration `supabase/pendentes/migrations/202610170004_bucket_atleta_privado.sql` (M2) torna `atleta-arquivos` privado e cria o bucket público `jogador-fotos-rosto`. Ela lista como pré-requisito uma rota de servidor que valide tipo e tamanho e gere URL assinada de curta duração. Este documento descreve essa rota. **Status: implementado no código e coberto por teste; nada foi aplicado em banco nem em Storage.**

## O que existe

| Peça | Arquivo | Função |
|---|---|---|
| Tipos e limites | `src/lib/uploads/config.ts` | `atleta-documento`, `atleta-foto-rosto`, `equipe-emblema`: bucket, MIME aceitos, tamanho máximo, privado ou público |
| Validação | `src/lib/uploads/validacao.ts` | MIME e tamanho declarados contra a tabela acima; a extensão sai do MIME, nunca do nome do arquivo |
| Caminho | `src/lib/uploads/caminho.ts` | `<tipo>/liga-<ligaId>/equipe-<equipeId>/<uuid>.<ext>`; leitura estrita do caminho; conversão de URL pública antiga em caminho |
| Posse | `src/lib/uploads/acesso-equipe.ts` | Quem é o ator sobre uma equipe: organizador dono, capitão, árbitro escalado |
| Storage | `src/lib/uploads/assinatura.ts` | `createSignedUploadUrl` e `createSignedUrl` com a chave de serviço |
| Rota de envio | `src/app/api/uploads/assinar/route.ts` | `POST /api/uploads/assinar` |
| Rota de leitura | `src/app/api/uploads/documento/route.ts` | `GET /api/uploads/documento` |
| Teste | `scripts/uploads-assinados.test.ts` | `npm run test:uploads` |

## Tipos e limites (valem no servidor)

| Tipo | Bucket | Visibilidade | MIME | Máximo |
|---|---|---|---|---|
| `atleta-documento` | `atleta-arquivos` | privado | jpeg, png, webp, pdf | 8 MB |
| `atleta-foto-rosto` | `jogador-fotos-rosto` | público (D5) | jpeg, png, webp | 4 MB |
| `equipe-emblema` | `equipe-emblemas` | público | jpeg, png, webp | 4 MB |

Tipos acrescentados na rodada 4 (cada um com MIME, tamanho e caminho próprios, validados no servidor):

| Tipo | Bucket | Visibilidade | MIME | Máximo | Quem assina | Caminho (gerado no servidor) |
|---|---|---|---|---|---|---|
| `candidatura-emblema` | `equipe-emblemas` | público | jpeg, png, webp | 4 MB | cadastro sem sessão, com limite por IP; sessão liberada passa a ter pasta própria | `candidatura-emblema/anonimo/<uuid>.<ext>` ou `candidatura-emblema/usuario-<id>/<uuid>.<ext>` |
| `quadra-foto` | `quadra-fotos` | público | jpeg, png, webp | 5 MB | idem candidatura | `quadra-foto/anonimo/<uuid>.<ext>` ou `quadra-foto/usuario-<id>/<uuid>.<ext>` |
| `galeria-campeonato` | `galeria-campeonato` | público | jpeg, png, webp | 4 MB | só o organizador dono da liga (`ligaId` no corpo, conferido no banco) | `ligas/<ligaId>/<uuid>.<ext>` (o prefixo `ligas/<id>/` é o que as rotas de galeria já exigem) |
| `organizador-logo` | `organizador-logos` | público | jpeg, png, webp | 4 MB | só o próprio organizador (id da sessão) | `organizador-logo/organizador-<id>/<uuid>.<ext>` |

Candidatura: o cadastro ainda não tem equipe nem conta, então não há dono a conferir. A defesa é o limite próprio de 30 envios por hora por IP (além dos 60 por 10 minutos gerais), o caminho temporário sob controle do servidor (o cliente não escolhe pasta nem nome, e `equipeId`/`ligaId` enviados nesse tipo são ignorados) e o MIME/tamanho fixos. O limite é em memória por instância, logo aproximado em Vercel. O arquivo temporário só vira "da equipe" quando a candidatura grava a URL; arquivos órfãos não são limpos automaticamente (limpeza por prefixo `anonimo/` fica como evolução). A galeria envia foto e miniatura em duas chamadas, cada uma com seu caminho. Os buckets `quadra-fotos`, `galeria-campeonato` e `organizador-logos` não são alterados por migration deste trabalho: conferir `file_size_limit` e `allowed_mime_types` no painel.

Os mesmos limites estão em `file_size_limit` e `allowed_mime_types` dos buckets na migration M2 (documento 8 MB e `jogador-fotos-rosto` 4 MB). `equipe-emblemas` não é alterado pela M2: confirmar o limite do bucket no painel antes de depender dele.

## POST /api/uploads/assinar

Corpo: `{ tipo, equipeId?, ligaId?, mime, tamanho }` (tamanho em bytes, inteiro). `equipeId` é obrigatório nos tipos de equipe (`atleta-*`, `equipe-emblema`); `ligaId` só em `galeria-campeonato`; os demais não usam nenhum dos dois. O passo 4 abaixo e a regra do ator valem para os tipos de equipe; para os outros, a posse é a descrita na tabela de tipos (organizador dono da liga: 401/403/404 como nas demais rotas de organizador).

Ordem das checagens (todas no servidor):
1. Limite por IP (60 por 10 minutos, memória; vale por instância).
2. Corpo válido (422) e `tipo` conhecido.
3. MIME na lista do tipo (415) e tamanho de 1 byte até o máximo (413; 422 se não for inteiro positivo).
4. A equipe existe (404). O `ligaId` do caminho vem do banco, não do corpo.
5. O ator é **organizador dono do campeonato** ou **capitão da equipe** (401 sem sessão; 403 com sessão sem poder). Árbitro não envia arquivo. Organizador ou capitão com senha a trocar ou perfil não liberado recebem 403.

Resposta 201 (`Cache-Control: private, no-store`): `{ data: { bucket, caminho, token, urlAssinada, urlPublica, mime, tamanhoMaximo } }`. `urlPublica` só vem em bucket público.

Uso previsto no cliente (a mudança dos componentes fica para o frontend): enviar com `supabase.storage.from(bucket).uploadToSignedUrl(caminho, token, arquivo, { contentType: mime })`. O caminho é novo a cada chamada (uuid) e o Storage não sobrescreve, então o token só serve para aquele objeto. A URL assinada de envio vale 2 horas (padrão do Storage; a API não permite encurtar).

## GET /api/uploads/documento

Devolve `{ data: { url, expiraEm } }` com URL assinada de **120 segundos** (`Cache-Control: private, no-store`). Só o bucket `atleta-arquivos`. Dois modos:
- `?caminho=atleta-documento/liga-7/equipe-1/<uuid>.pdf`: a equipe está no próprio caminho; qualquer outro formato (`..`, foto de rosto, caminho legado) responde 404 sem tocar no Storage.
- `?jogadorId=10&indice=0`: documento `indice` de `Jogador.documentosUrls` (URL pública antiga do bucket ou caminho relativo). A equipe vem do banco. URL de outro host ou de outro bucket responde 404. Este modo cobre os documentos já gravados antes da migração para o caminho novo.

Quem pode ler (401 sem sessão, 403 com sessão sem poder):
- organizador dono do campeonato da equipe;
- capitão da equipe (`CandidaturaEquipe.equipeId`);
- árbitro escalado em algum jogo da equipe (conta `CandidaturaArbitro` com `EscalaArbitro`), ou árbitro que entrou pelo link exclusivo do jogo (`AcessoArbitroJogo` ativo, mesmo token, jogo da equipe).

Administrador do sistema, quadra e público não leem documento por esta rota. Todo documento negado, inexistente ou malformado responde sem indicar se o arquivo existe.

## O que o servidor não garante (limites conhecidos)

- O tamanho e o MIME são os **declarados**. Quem impõe o limite real na hora do envio é o bucket (`file_size_limit`, `allowed_mime_types`). Se a configuração do bucket divergir da tabela acima, o limite do servidor vira só uma checagem de cortesia. Uma rota de confirmação que consulte o objeto enviado (tamanho e `mimetype` reais) e apague o que divergir é a evolução natural, não está feita.
- O conteúdo não é inspecionado (antivírus, assinatura de arquivo). PDF e imagem chegam como enviados.
- Rascunho de inscrição por token: ver a seção seguinte.
- O limite por IP é em memória por instância; em Vercel com várias instâncias ele é aproximado.
- Foto de rosto e emblema são públicos por decisão D5: a rota só assina o envio, a leitura é a URL pública do bucket.

## documentosUrls do atleta (POST /api/capitao/jogadores)

A rota do capitão só tem POST (cria, ou atualiza quando o corpo traz `id`). `documentosUrls` aceita até 8 valores, cada um:
- caminho puro do bucket privado no formato novo (`atleta-documento/liga-<L>/equipe-<E>/<uuid>.<ext>`), desde que `L` e `E` sejam da equipe do capitão logado (outra equipe, outra liga, outro tipo ou `..` resultam em 422);
- URL do bucket `atleta-arquivos` (pública antiga ou referência `sign` sem token), convertida para caminho antes de gravar;
- caminho legado (objeto antigo do bucket) só se já estiver gravado nesse mesmo atleta.
Qualquer outro valor (URL de outro host, por exemplo) responde 422. Não exige mais `url()`. O que sai gravado é sempre o caminho. O GET devolve só caminhos; valores antigos que não pertençam ao bucket privado saem da resposta (nunca se devolve URL pública), e os documentos continuam abrindo por `/api/uploads/documento?caminho=` ou `?jogadorId=&indice=`. Valores antigos em formato de URL no banco continuam funcionando na leitura; eles são reescritos como caminho na próxima gravação do atleta. Atenção: a página do capitão ainda guarda no estado a `referencia` (URL sem token) devolvida pelo envio, que o servidor converte; migrar para guardar o `caminho` é opcional. O `schemas.ts` (candidatura) continua com `documentosUrls` como URL e não foi alterado.

## Rascunho por token (FormularioInscricaoRapida): decisão de produto pendente

`src/components/inscricao-rapida/FormularioInscricaoRapida.tsx` **continua enviando direto com a chave anon** e é a única exceção restante em `anon-client-guard`. O rascunho por token (`/api/inscricao-rapida/{token}`) não tem sessão, e uma rota assinada precisa decidir quem prova posse. Opções:
1. Token de rascunho como prova: nova rota `POST /api/inscricao-rapida/{token}/uploads` que valida o token (existente, não expirado, rascunho aberto), aplica limite por token e IP e assina em caminho `inscricao-rapida/<rascunhoId>/<uuid>.<ext>`. Recomendada: o dono do caminho é o rascunho.
2. Tratar como candidatura anônima (tipos `candidatura-*` com limite por IP): mais rápido, sem amarrar ao rascunho, mais abuso possível.
3. Manter o envio direto até a revogação do `INSERT` do anon em `storage.objects` (a migration que fecha isso exige primeiro decidir 1 ou 2).
Nada disso está implementado.

## Ordem de adoção sugerida

1. Código desta branch em produção (as rotas são novas e não mudam nada existente).
2. Frontend: trocar os uploads de `atleta-arquivos` (`capitao/page.tsx`) e de foto de rosto por `/api/uploads/assinar`; trocar os links de documento (`admin/candidaturas/page.tsx` e telas do capitão) por `/api/uploads/documento`.
3. Só então a migration M2 (bucket privado). Sem o passo 2, os uploads diretos em `atleta-arquivos` falham.
4. Etapa 2 da M2 (reescrita das URLs gravadas para caminhos relativos, com as colunas `*Legado` preenchidas antes).

## Testes

`npm run test:uploads-tipos-novos` (rodada 4): limites por tipo, caminhos amarrados ao dono, assinatura anônima e com sessão em candidatura (incluindo sessão não liberada e `equipeId`/`ligaId` ignorados), limite de 30 por hora por IP, galeria só para o dono da liga, logo só para o organizador, tipos de equipe ainda exigindo equipe, e a normalização de `documentosUrls` (caminho próprio, outra equipe/liga, URL antiga, legado, `..`, host externo). A rota `/api/capitao/jogadores` em si não tem teste de integração; a regra está na biblioteca `uploads/documentos.ts`, testada.

`npm run test:uploads` cobre: validação de MIME e tamanho (inclui `image/svg+xml`, `text/html`, `application/octet-stream`, tamanho 0, negativo, fracionário e acima do limite), caminho (`..`, extensão fora da lista, nome livre, caminho legado), conversão de URL antiga, e as duas rotas com banco e Storage falsos: sem sessão 401; capitão e organizador de outra equipe, árbitro não escalado, quadra e público 403 sem assinar nada; organizador dono, capitão e árbitro escalado leem; árbitro pelo link do jogo vale só com token correto; caminho de foto de rosto ou malformado 404. A sessão é substituída por um stub porque o cookie só existe dentro de uma requisição real do Next; o banco e o Storage são respostas falsas do fetch. **Nada foi testado contra um Supabase real nem no navegador.**
