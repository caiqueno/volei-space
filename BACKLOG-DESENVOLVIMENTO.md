# Backlog de Desenvolvimento - LUVA Platform

## Status inicial

- Base principal definida: `prototipo-plataforma/outputs/luva-platform`.
- Stack atual: Next.js 14, React 18, TypeScript, Tailwind CSS, Supabase e Prisma.
- Build local validado com sucesso.
- Servidor local rodando em `http://localhost:3000`.
- `.env.local` criado com placeholders para desenvolvimento.
- Supabase ainda precisa receber credenciais reais.

## Etapa 1 - Fundação técnica

- [x] Instalar dependências locais.
- [x] Adicionar dependências faltantes: `nodemailer`, `qrcode`, `slugify`.
- [x] Gerar Prisma Client.
- [x] Corrigir erro de build em `infinitepay.ts`.
- [x] Reconstruir `globals.css`.
- [x] Corrigir textos principais com encoding quebrado em arquivos críticos.
- [x] Fazer `/api/ping` responder sem quebrar quando Supabase ainda não estiver configurado.
- [ ] Criar projeto Supabase definitivo.
- [ ] Configurar `DATABASE_URL`, `DIRECT_URL`, `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- [ ] Aplicar schema no Supabase.
- [ ] Criar seed inicial da LUVA 2026.

## Etapa 2 - Autenticação e segurança

- [ ] Revisar login administrativo.
- [ ] Trocar credenciais de desenvolvimento por usuário admin real.
- [ ] Proteger rotas administrativas.
- [ ] Validar cookies HTTP-only em ambiente local e produção.
- [ ] Definir política básica de permissões por perfil.

## Etapa 3 - Cadastros essenciais

- [ ] Finalizar CRUD de liga.
- [ ] Finalizar CRUD de equipes.
- [ ] Finalizar CRUD de jogadores.
- [ ] Adicionar edição completa, não apenas criação/exclusão.
- [ ] Validar campos obrigatórios.
- [ ] Padronizar mensagens de erro e sucesso.

## Etapa 4 - Inscrição e QR Code

- [ ] Revisar fluxo de inscrição pública de atletas.
- [ ] Gerar QR Code individual com URL final correta.
- [ ] Criar tela amigável de validação do atleta.
- [ ] Ajustar validação por árbitro/responsável antes da partida.
- [ ] Definir comportamento para atleta inválido, removido ou sem equipe.

## Etapa 5 - Partidas, calendário e classificação

- [ ] Finalizar criação de partidas.
- [ ] Adicionar edição de partidas.
- [ ] Organizar calendário por rodada, data, horário e local.
- [ ] Revisar regras de pontuação.
- [ ] Garantir atualização da classificação após aprovação de resultado.
- [ ] Validar critérios de desempate.

## Etapa 6 - Súmula digital

- [ ] Comparar a súmula simples da plataforma com o protótipo avançado em React.
- [ ] Definir o nível da primeira versão operacional.
- [ ] Integrar presenças, sets, ocorrências e fechamento de resultado.
- [ ] Avaliar inclusão de rotação, tempos, substituições e anotações.
- [ ] Criar fluxo de envio e aprovação da súmula.
- [ ] Testar a súmula em celular.

## Etapa 7 - Área pública

- [x] Revisar home pública da liga.
- [x] Revisar página de jogos.
- [x] Revisar página de classificação.
- [x] Revisar páginas de rankings e galeria.
- [x] Criar estados vazios profissionais.
- [x] Ajustar responsividade mobile em todas as telas públicas.
- [x] Corrigir textos com encoding quebrado nas telas públicas.
- [x] Aplicar segunda passada visual na home com layout mais moderno, esportivo e completo.

## Etapa 8 - Candidaturas, árbitros e quadras

- [ ] Revisar candidatura de equipes.
- [ ] Revisar candidatura de árbitros.
- [ ] Definir escopo real de fornecedores de quadra para a primeira versão.
- [ ] Ajustar aprovação/rejeição no painel administrativo.
- [ ] Deixar pagamentos como opcional ou etapa futura, se não houver credenciais InfinitePay.

## Etapa 9 - Deploy Vercel

- [ ] Garantir repositório GitHub pronto.
- [ ] Configurar projeto na Vercel.
- [ ] Configurar variáveis de ambiente na Vercel.
- [ ] Validar build na Vercel.
- [ ] Atualizar `NEXT_PUBLIC_APP_URL` para URL de produção.
- [ ] Testar QR Code apontando para produção.

## Etapa 10 - Homologação

- [ ] Testar fluxo ponta a ponta: equipe, atleta, QR Code, partida, súmula e classificação.
- [ ] Testar painel administrativo em desktop.
- [ ] Testar área pública e súmula em celular.
- [ ] Corrigir bugs encontrados.
- [ ] Preparar checklist de aceite para o cliente.
