# 21 - Uploads com URL assinada (volei.space)

Agente: backend (segurança, rodada 2). Branch `feat/r2-seguranca-b6-b7`. Escopo: biblioteca e rotas de servidor. Nenhum componente de cliente foi alterado: os uploads diretos do navegador (`capitao/page.tsx`, `FormularioInscricaoRapida.tsx`, `cadastro/page.tsx`, `CandidateEditForm.tsx`, `GaleriaOrganizador.tsx`, `OrganizacaoForm.tsx`, `InformacoesWizard.tsx`) continuam como estão e ficam para o frontend.

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

Os mesmos limites estão em `file_size_limit` e `allowed_mime_types` dos buckets na migration M2 (documento 8 MB e `jogador-fotos-rosto` 4 MB). `equipe-emblemas` não é alterado pela M2: confirmar o limite do bucket no painel antes de depender dele.

## POST /api/uploads/assinar

Corpo: `{ tipo, equipeId, mime, tamanho }` (tamanho em bytes, inteiro).

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
- Rascunho de inscrição por token (`/api/inscricao-rapida/{token}`) não tem sessão e portanto **não** tem rota de envio assinada aqui. O `FormularioInscricaoRapida` segue enviando direto até existir uma rota por token de rascunho (decisão de produto: o token de rascunho pode assinar envios para o próprio rascunho).
- O limite por IP é em memória por instância; em Vercel com várias instâncias ele é aproximado.
- Foto de rosto e emblema são públicos por decisão D5: a rota só assina o envio, a leitura é a URL pública do bucket.

## Ordem de adoção sugerida

1. Código desta branch em produção (as rotas são novas e não mudam nada existente).
2. Frontend: trocar os uploads de `atleta-arquivos` (`capitao/page.tsx`) e de foto de rosto por `/api/uploads/assinar`; trocar os links de documento (`admin/candidaturas/page.tsx` e telas do capitão) por `/api/uploads/documento`.
3. Só então a migration M2 (bucket privado). Sem o passo 2, os uploads diretos em `atleta-arquivos` falham.
4. Etapa 2 da M2 (reescrita das URLs gravadas para caminhos relativos, com as colunas `*Legado` preenchidas antes).

## Testes

`npm run test:uploads` cobre: validação de MIME e tamanho (inclui `image/svg+xml`, `text/html`, `application/octet-stream`, tamanho 0, negativo, fracionário e acima do limite), caminho (`..`, extensão fora da lista, nome livre, caminho legado), conversão de URL antiga, e as duas rotas com banco e Storage falsos: sem sessão 401; capitão e organizador de outra equipe, árbitro não escalado, quadra e público 403 sem assinar nada; organizador dono, capitão e árbitro escalado leem; árbitro pelo link do jogo vale só com token correto; caminho de foto de rosto ou malformado 404. A sessão é substituída por um stub porque o cookie só existe dentro de uma requisição real do Next; o banco e o Storage são respostas falsas do fetch. **Nada foi testado contra um Supabase real nem no navegador.**
