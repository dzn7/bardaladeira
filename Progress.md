# Progress

## [2026-08-22] Histórico de produto — 401 Não autorizado por token client podre

**Agente/Modelo:** Cursor Grok 4.6
**Objetivo:** o Dialog de histórico deixar de travar em "Não autorizado." quando o browser guarda um `adminToken` que o servidor rejeita.
**Arquivos alterados:** `src/lib/token-admin.ts` (novo), `src/contexts/AdminAuthContext.tsx`, `src/components/admin/ProtectedRoute.tsx`, `src/components/admin/produtos/DialogHistoricoProduto.tsx`, `tests/produto-historico.test.mjs`, `Progress.md`.
**O que foi feito:**
- Helper client `token-admin.ts` espelha os tokens locais e o regex UUID do `autorizacao-admin-legada.ts`.
- No load, token malformado (`admin-supabase-<Date.now()>` e afins) é removido; sessão admin só regrava token se o id produzir um token aceito pelo servidor; token local hardcoded é preservado.
- `ProtectedRoute` deixa de aceitar qualquer prefixo `admin-*` e manda ao login quando o token não passa na mesma regra do servidor.
- 401 no Dialog passa a orientar novo login em vez de ecoar `Não autorizado.`
**Decisões tomadas:** a validação server-side não foi relaxada — o client é que estava mentindo o estado autenticado. Sem mudança de RLS, grants ou contrato das rotas.
**Verificação:** TDD estrutural 10/10 ✓ · `./node_modules/.bin/tsc --noEmit --incremental false` 0 erros ✓ · IDE diagnostics nos arquivos editados 0 ✓ · `npm run lint` permanece indisponível (`next lint` resolve o diretório `lint`) · sem verificação no browser nesta sessão.
**Pendências / próximos passos:** recarregar o admin (ou sair e entrar de novo) para o auto-reparo rodar no localStorage; se o 401 continuar após login fresco com usuário admin ativo, o próximo alvo é o lookup em `usuarios_sistema` via service role.
**Armadilhas descobertas:** `ProtectedRoute` tratava `admin-supabase-*` como sessão válida, enquanto o servidor exige UUID RFC; quem já tinha o token antigo do PDV (`Date.now()`) ficava "logado" na UI e tomava 401 em toda API administrativa. `npx tsc` neste worktree cai no stub do npm sem `node_modules` prévio — usar o binário local.

## [2026-08-22] Histórico de produto — resposta 404 da publicação

**Agente/Modelo:** Codex GPT-5
**Objetivo:** impedir que a Timeline tente interpretar a página 404 da Vercel como JSON.
**Arquivos alterados:** `src/components/admin/produtos/DialogHistoricoProduto.tsx`, `tests/produto-historico.test.mjs`, `Progress.md`.
**O que foi feito:** o Dialog passa a ler texto, validar JSON e devolver mensagem operacional quando a resposta é HTML/texto. A UI deixa de exibir `Unexpected token`.
**Decisões tomadas:** não simulei dados nem escondi a indisponibilidade. A mensagem informa que a publicação precisa conter as rotas de histórico.
**Verificação:** reprodução remota ✓ — as duas rotas de produto retornaram 404/texto, enquanto `/api/admin/notificacoes` retornou JSON 401; teste TDD RED→GREEN 5/5 ✓ · `npx tsc --noEmit` ✓ · `git diff --check` ✓.
**Pendências / próximos passos:** publicar o código que contém `src/app/api/admin/produtos/[id]/historico/route.ts` e `inteligencia/route.ts` na Vercel; a publicação hoje acessada não possui essas rotas.
**Armadilhas descobertas:** chamar `Response.json()` direto em uma rota que pode retornar página de erro transforma um 404 diagnosticável em erro de parser sem contexto.

## [2026-08-22] Histórico, timeline e inteligência de produtos

**Agente/Modelo:** Codex GPT-5
**Objetivo:** tornar cada produto final auditável e analisável, sem reconstruir o estado atual por eventos nem inventar passado.
**Arquivos alterados:** `SPEC-produto-historico.md`, `supabase/migrations/20260822155525_produto_historico.sql`, `supabase/migrations/20260822160210_produto_historico_permissoes.sql`, `src/app/api/admin/produtos/[id]/historico/route.ts`, `src/app/api/admin/produtos/[id]/inteligencia/route.ts`, `src/components/admin/produtos/DialogHistoricoProduto.tsx`, `src/app/admin/produtos/page.tsx`, `tests/produto-historico.test.mjs`, `PRD.md`, `UI.md`, `Progress.md`.
**O que foi feito:**

- Mapeamento completo dos caminhos de escrita de `produtos`, estoque, itens/pedidos e promoção foi consolidado na SPEC; não havia ledger anterior, `itens_pedido` de produto nem promoções ativas para reconstruir auditoria comercial passada.
- Criado audit trail append-only com before/after, ator/origem, referências de pedido e episódios promocionais. Triggers cobrem produto, estoque e snapshot de venda; cancelamento restaura estoque sem duplicar a ocorrência comercial.
- Métricas agregadas no Postgres calculam pedidos, unidades, faturamento, preços realizados, desconto promocional, estoque, esgotamento, visibilidade, preços e episódios. Status não realizados não entram em receita.
- O card de produto final ganhou ação com Tooltip e Dialog responsivo: duas colunas no desktop, tabs no mobile, Timeline cursor-paginada, filtros independentes, skeleton e painel de desempenho sem N+1.
- As rotas administrativas usam `autorizarAdminLegado` e service role; RLS, grants e execução das funções foram fechados para `anon`/`authenticated`.

**Decisões tomadas:** estado corrente permanece em `produtos`; eventos são trilha de auditoria. Como o login administrativo atual é local/client-side, alterações diretas legadas são identificadas honestamente como `Sistema`/origem técnica — não se atribui um funcionário sem sessão server-side verificável. Bebidas permanecem fora deste recorte, pois não pertencem ao domínio de estoque final `produtos`.
**Verificação:** TDD estrutural RED→GREEN 5/5 ✓ · cenário SQL remoto pré e pós-aplicação com rollback (preço, promoção, idempotência, venda, snapshot, analytics, cancelamento e append-only) ✓ · schema/RLS/grants/triggers/índices remotos ✓ · `npx tsc --noEmit` ✓ · build 48/48 ✓ · `npm run lint` executado, mas o script legado `next lint` é incompatível com Next 16 e falha antes de lintar · `git diff --check` ✓ · bug-hunter ✓ · verification-before-completion ✓.
**Pendências / próximos passos:** uma autenticação server-side deve propagar o ator humano ao contexto da transação para substituir `Sistema` nas escritas diretas legadas; comparar vendas antes/durante/depois de promoção fica para quando houver volume histórico suficiente e janela de negócio definida.
**Armadilhas descobertas:** grants antigos do template mantinham `anon` com execução de função mesmo após revogar `PUBLIC`; a segunda migration revoga explicitamente `anon` e `authenticated`. O workspace não tinha `.env.local`; o build foi validado com valores inertes temporários, sem persistir segredo.

## [2026-08-21] Toggle de esgotado exclusivo do site

**Agente/Modelo:** Codex GPT-5.6 SOL
**Objetivo:** permitir configurar por produto quando saldo zero deve aparecer como esgotado no cardápio público, sem impedir pedidos físicos.
**Arquivos alterados:** `src/app/admin/estoque/page.tsx`, `src/components/admin/produtos/ModalFormularioProduto.tsx`, `src/components/ModalCarrinho.tsx`, `src/lib/server/pagamento-online.ts`, `src/app/admin/pedidos/novo/page.tsx`, `src/app/garcom/novo/page.tsx`, `supabase/migrations/20260821192101_estoque_bloqueio_apenas_site.sql`, `tests/estoque-migration.test.mjs`, `PRD.md`, `UI.md`, `Progress.md`.
**O que foi feito:** `/admin/estoque` ganhou o `Interruptor` “Esgotado no site” em cards e tabela, com atualização otimista, rollback e feedback. Checkout comum/PIX gravam `pedidos.origem = site`; Admin/Garçom gravam seus canais físicos. A trigger continua consumindo o saldo disponível em todos os canais, mas só rejeita saldo insuficiente para origem `site`. O texto equivalente no formulário de produto foi alinhado à mesma regra.
**Decisões tomadas:** reutilizado o campo `produtos.bloquear_venda_sem_estoque`, a coluna `pedidos.origem` e o componente `Interruptor`; nenhuma tabela, dependência ou sistema paralelo foi criado. Pedidos físicos sem saldo registram consumo zero e continuam vendáveis, sem quantidade negativa.
**Verificação:** regressão TDD vermelho→verde ✓ · suíte Node 46/46 ✓ · `npx tsc --noEmit --incremental false` 0 erros ✓ · build 48/48 ✓ · migration aplicada pela Management API e cenário remoto site-bloqueado/admin-permitido validado com rollback ✓ · `git diff --check` ✓ · bug-hunter ✓ · verification-before-completion ✓. `npm run lint` foi executado e permanece indisponível: o script legado `next lint` é interpretado como diretório pelo Next 16.
**Pendências / próximos passos:** corrigir o script global de lint em tarefa própria; cadastrar os saldos reais para que o toggle reflita a operação.
**Armadilhas descobertas:** o campo `pedidos.origem` já existia, mas nenhum dos criadores web o preenchia; inferir o canal pelo status temporário quebraria edições futuras de pedidos físicos.

## [2026-08-20] Estoque, lucro e Central de Notificações espelhados da Edienai

**Agente/Modelo:** Codex GPT-5.6 SOL
**Objetivo:** replicar no Bar da Ladeira toda a UI, contratos, reserva de banco e integrações atuais do estoque da Edienai, incluindo notificações e pagamentos da equipe associados.
**Arquivos alterados:** 64 arquivos — página/componentes/libs de estoque; catálogo, produtos, pedidos, carrinho e sidebar; Central de Notificações; finanças/pagamentos da equipe; três route handlers; sete migrations; specs/testes; `PRD.md`, `UI.md` e `Progress.md`.
**O que foi feito:** o bundle `9244bff` da origem foi transplantado sem reconstrução. `/admin/estoque` ganhou KPIs, busca/filtros, tabela/cards, paginação, deep-link e ajuste atômico. Cadastro de produto ganhou custo, saldo, mínimo e bloqueio. Cardápio/carrinho respeitam saldo e o banco reserva/restaura consumo por item/pedido. A Central persistente cobre estoque, pedidos e pagamentos; Finanças separa resultado de caixa de lucro bruto conhecido e agenda pagamentos mensais da equipe.
**Decisões tomadas:** identidade, tema público e Drawer de confirmação próprios do Bar foram preservados. O token local das novas rotas foi adaptado para `admin-authenticated-bar-da-ladeira`. Não foram copiados os 194 produtos nem quantidades comerciais da Edienai: os 13 produtos do Bar foram preservados e inicializados em saldo 0, mínimo 5 e bloqueio desligado. As seis relações administrativas novas têm RLS ativo e zero grants para `anon`/`authenticated`; o estoque operacional mantém o acesso client/anon da origem, risco legado documentado.
**Verificação:** suíte Node 43/43 ✓ · `npx tsc --noEmit --incremental false` 0 erros ✓ · build 48/48 ✓ · migrations ensaiadas duas vezes com rollback e aplicadas atomicamente pela Management API ✓ · cenários SQL remotos de estoque e financeiro/notificações com rollback ✓ · APIs locais: sem autenticação 401; notificações completas 200 com 13 alertas; lucro 200; pagamentos 200 ✓ · `git diff --check` ✓ · bug-hunter ✓ · code-reviewer ✓ · verification-before-completion ✓. `npm run lint` foi executado e permanece indisponível: o script legado `next lint` é interpretado como diretório pelo Next 16.
**Pendências / próximos passos:** cadastrar os saldos/custos reais dos 13 produtos no novo Estoque; rotacionar os dois access tokens compartilhados nesta conversa. Os avisos preexistentes de metadata `viewport/themeColor` do build não foram alterados nesta task.
**Armadilhas descobertas:** copiar literalmente a autorização da origem deixaria o login hardcoded do Bar em 401; `admin-authenticated-edienailanches` precisava acompanhar o token real do destino. O primeiro ensaio remoto foi revertido por nomes incorretos no verificador, não por falha da migration; o ensaio corrigido passou duas vezes antes do commit.

## [2026-08-16] Reset da conta `/dzn` no Supabase atual

**Agente/Modelo:** Cursor Grok 4.6
**Objetivo:** garantir login de `/dzn` no projeto `olkzbualikbyudupizxz`.
**Arquivos alterados:** nenhum de código (script temporário apagado).
**O que foi feito:** a conta `dzn` não existia neste banco; criei via RPC `criar_usuario_sistema` (papel `admin`, ativa) e confirmei com `verificar_senha_usuario`.
**Decisões tomadas:** senha só no banco (`senha_hash` SHA-256); não gravei plaintext no repositório nem no Progress.
**Verificação:** RPC de login retornou `dzn` / `admin`.
**Pendências / próximos passos:** entrar em `/dzn` com usuário `dzn` e a senha combinada nesta sessão.
**Armadilhas descobertas:** `/dzn` não usa os logins hardcoded do `/admin` (`dzndev` / `bardaladeira`); depende da linha em `usuarios_sistema`.

## [2026-08-15] Cardápio público rústico + pedido enviado em Drawer

**Agente/Modelo:** Cursor Grok 4.6
**Objetivo:** paleta rústica só no site do cliente (Bar da Ladeira) e confirmação de pedido enviado como Drawer.
**Arquivos alterados:** `src/app/globals.css`, `src/app/page.tsx`, `src/app/preview-mobile-frame/page.tsx`, `src/components/Header.tsx`, `src/components/ModalCarrinho.tsx`, `src/components/CartaoProduto.tsx`, `src/components/CartaoBebida.tsx`, `src/components/CartaoCombo.tsx`, `src/components/ModalComplementos.tsx`, `src/components/ModalPedidosCliente.tsx`, `src/components/ModalSelecionarMesa.tsx`, `UI.md`, `Progress.md`.
**O que foi feito:** tokens `tema-publico` (pergaminho/terracota no claro, madeira/creme no escuro) no `html` e no wrapper da Home; acentos `bordo-*` do fluxo público viraram `primary`; overlay legado de pedido enviado entrou no mesmo Drawer do checkout.
**Decisões tomadas:** não mexer em `:root` / `tailwind.config.js` (pintaria o admin). Classe no `html` para Drawers portalados herdarem. Logo do header em fundo preto como a marca. Sem fonte serif nova.
**Verificação:** `npx tsc --noEmit --incremental false` nesta sessão. Sem Playwright. Admin permanece Juridiq se a classe `tema-publico` não estiver no `html`.
**Pendências / próximos passos:** conferir visualmente `/` claro/escuro e um pedido até a tela Entendi; `/admin` deve continuar azul.
**Armadilhas descobertas:** `bordo-*` no Tailwind é escala slate hardcoded — só mudar CSS variables não recoloria CTAs do cliente. Drawers do Vaul saem no `body` e não herdam classe só do wrapper.

## [2026-08-15] Logo: png → webp

**Agente/Modelo:** Cursor Grok 4.6
**Objetivo:** todas as referências ativas de `/logo.png` passam a `/logo.webp`.
**Arquivos alterados:** `src/app/layout.tsx`, `src/app/contato/page.tsx`, `src/app/entregador/page.tsx`, `src/components/Header.tsx`, `src/components/admin/AdminLayout.tsx`, `src/components/garcom/GarcomLayout.tsx`, `src/components/login/TelaSelecaoPerfil.tsx`, `src/lib/useEntregador.ts`, `public/sw-entregador.js`, `UI.md`, `Progress.md`.
**O que foi feito:** troca do path da marca no header, sidebar, login, contato, entregador, OG/Twitter, notificações PWA do entregador e no UI.md. `public/logo.webp` já existia; `logo.png` não está mais em `public/`.
**Decisões tomadas:** entradas antigas do Progress.md que citam `/logo.png` ficaram (append-only).
**Verificação:** grep em `src/` e `public/` sem `logo.png` · `npx tsc --noEmit --incremental false` nesta sessão.
**Pendências / próximos passos:** nenhuma.
**Armadilhas descobertas:** manifests PWA usam favicon em `/assets/favicon/`, não o logo.

## [2026-08-15] Bebidas do Bar da Ladeira no Supabase

**Agente/Modelo:** Cursor Grok 4.6
**Objetivo:** gravar as 12 bebidas do flyer na tabela `bebidas` do projeto `olkzbualikbyudupizxz`.
**Arquivos alterados:** `supabase/migrations/20260816000200_bebidas_bar_da_ladeira.sql`, `Progress.md`.
**O que foi feito:** migration aplicada via CLI. Categorias tipo `bebida`: Águas, Refrigerantes, Alcoólicas. 12 itens com preço, `ordem` do flyer e `tamanho` (Lata/1L/2L) onde o nome trazia volume. Atualizei `ordem_categorias_produtos` para incluir as três categorias depois das de comida.
**Decisões tomadas:** 51 Ice ficou em Alcoólicas (não é refrigerante nem cerveja). Cajuína em Refrigerantes. Sem fotos.
**Verificação:** query remota ✓ 12 bebidas. Sem typecheck (só SQL).
**Pendências / próximos passos:** fotos no admin.
**Armadilhas descobertas:** `bebidas.categoria` é NOT NULL e precisa bater com `categorias_cardapio.nome` de tipo `bebida`.

## [2026-08-15] Cardápio do Bar da Ladeira no Supabase

**Agente/Modelo:** Cursor Grok 4.6
**Objetivo:** gravar o cardápio impresso do Bar da Ladeira no projeto `olkzbualikbyudupizxz`, no schema que o app já usa.
**Arquivos alterados:** `supabase/migrations/20260816000100_cardapio_bar_da_ladeira.sql`, `Progress.md`.
**O que foi feito:** migration idempotente aplicada via CLI (`db push --linked`): 4 categorias em `categorias_cardapio` (tipo `produto`) e 13 itens em `produtos`, com preço, descrição, `disponivel=true` e `ordem` do flyer. Config `ordenacao_produtos_site=manual` e `ordem_categorias_produtos`.
**Decisões tomadas:** o flyer não tem seções; agrupei em Porções, Pratos, Carnes, Camarões e peixes para os filtros do cardápio público. Sem bebidas/combos — não estavam no flyer. Sem fotos.
**Verificação:** query remota ✓ 13 produtos / 4 categorias / 2 chaves de config. Sem typecheck (só SQL).
**Pendências / próximos passos:** fotos no admin; cardápio de bebidas quando existir.
**Armadilhas descobertas:** `produtos.categoria` precisa bater exatamente com `categorias_cardapio.nome`.

## [2026-08-15] Supabase — apontar o app para o projeto do Bar da Ladeira

**Agente/Modelo:** Cursor Grok 4.6
**Objetivo:** o `.env.local` passou a usar a URL e as chaves do projeto Supabase `olkzbualikbyudupizxz`.
**Arquivos alterados:** `.env.local`, `PRD.md`, `SKILLS.md`, `Progress.md`.
**O que foi feito:** atualizei `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY`; incluí `SUPABASE_SERVICE_ROLE_KEY` (somente server-side, lida por `src/lib/server/supabase-admin.ts`). Não coloquei a service role em variável `NEXT_PUBLIC_*`.
**Decisões tomadas:** docs oficiais passam a citar o ref novo; o inventário de 52 tabelas no PRD ficou marcado como medido na instância antiga.
**Verificação:** conferência das três variáveis no `.env.local` · nomes batem com o código (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`). Sem typecheck/lint — não houve alteração de código TypeScript. Reiniciar o `next dev` é necessário para o Next recarregar env.
**Pendências / próximos passos:** confirmar que este projeto tem o schema operacional; o app não foi exercitado contra o banco novo nesta task.
**Armadilhas descobertas:** `.env.local` continua rastreado no git (AGENTS §3.10); a service role não deve ir para o browser.

## [2026-08-15] Migração de identidade: Edienai Lanches → Bar da Ladeira

**Agente/Modelo:** Cursor Grok 4.6
**Objetivo:** eliminar a identidade Edienai Lanches do produto copiado e passar a apresentar **Bar da Ladeira**, sem redesenhar UI, fluxos ou arquitetura.
**Arquivos alterados:** `AGENTS.md`, `PRD.md`, `SKILLS.md`, `UI.md`, `Progress.md`, `package.json`, `package-lock.json`, `tsconfig.json`, `.gitignore`, `src/app/layout.tsx`, `src/app/contato/*`, `src/components/Header.tsx`, `src/components/admin/AdminLayout.tsx`, `src/components/garcom/GarcomLayout.tsx`, `src/app/entregador/page.tsx`, `src/components/login/TelaSelecaoPerfil.tsx`, `src/components/ModalCarrinho.tsx`, `src/contexts/CarrinhoContext.tsx`, `src/contexts/AdminAuthContext.tsx`, `src/contexts/ImpressoraContext.tsx`, PWA managers + `public/sw*.js` + `public/manifest*.json`, PDFs/impressão, cobrança crediário, metadata/SEO, `public/cardapio.md`.
**O que foi feito:** troca de marca visível (títulos, sidebar, login, cardápio, PWA, tickets, PDFs, mensagens WhatsApp/cobrança, metadata). Slug interno `bar-da-ladeira`. Docs oficiais passam a tratar Bar da Ladeira como produto; Edienai fica só como base histórica.
**Decisões tomadas:** não rebatizar IDs externos (Supabase project name/ref, `EVOLUTION_INSTANCE`, valor de banco `migracao_edienai_antigo`). Chaves de localStorage/PWA/cache migraram para o slug novo. QR de mesa deixa de apontar para o Vercel da Edienai e usa o origin atual (ou `NEXT_PUBLIC_URL_QR_MESA_BASE`). Login hardcoded `edienailanches`/`1234` virou `bardaladeira`/`1234`. `Progress.md` histórico permanece append-only.
**Verificação:** `npx tsc --noEmit --incremental false` ✓ 0 erros · `npx next build` ✓ 47/47 páginas · `npm run lint` indisponível no Next 16 (`next lint` interpreta `lint` como diretório). Grep `edienai` no código restante só em IDs técnicos documentados. Sem teste de browser (AGENTS §3.4).
**Pendências / próximos passos:** logo/favicon/assets ainda são os da base; Instagram, domínio de produção, WhatsApp e endereço reais do Bar da Ladeira; instância Evolution e projeto Supabase continuam os da base até haver cutover.
**Armadilhas descobertas:** `migracao_edienai_antigo` é dado de banco; `EVOLUTION_INSTANCE=edienai` e o nome `edienai` no painel Supabase são infraestrutura. Limpeza de cache PWA ainda procura prefixos antigos de propósito.

## [2026-08-08] Permissões visuais e manutenção DZN

**Agente/Modelo:** Codex GPT-5.6 SOL
**Objetivo:** permitir que Edienai controle visualmente ações dos garçons/entregadores e que o DZN pause módulos operacionais.
**Arquivos alterados:** `src/lib/controle-acesso.ts`, `src/contexts/ControleAcessoContext.tsx`, `src/app/api/controle-acesso/route.ts`, `src/components/admin/GerenciadorPermissoesEquipe.tsx`, `src/app/admin/usuarios/page.tsx`, `src/components/dzn/GerenciadorVisibilidadeTelas.tsx`, `src/app/garcom/layout.tsx`, `src/components/garcom/GarcomLayout.tsx`, `src/app/garcom/page.tsx`, `src/app/garcom/mesas/page.tsx`, `src/app/garcom/editar/[id]/page.tsx`, `src/app/entregador/layout.tsx`, `src/app/entregador/page.tsx`, `src/features/salao/components/PainelSalaoAtual.tsx`, `src/features/salao/components/CardMesaSalao.tsx`, `PRD.md`, `UI.md`, `Progress.md`.
**O que foi feito:** permissões por cargo; overrides individuais; ocultação de criar/editar/excluir; bloqueio visual de rotas sem `ver`; modo manutenção; painel reutilizado no admin e `/dzn`.
**Banco:** Management API criou `permissoes_papel`, `permissoes_usuario` e `manutencao_modulos`; todas possuem RLS ativo e zero grants para `anon`/`authenticated`. Três RPCs com `search_path` fixo têm escopo mínimo: leitura operacional segura e gestão somente após validar senha administrativa. O usuário `dzn` foi criado como admin ativo com a senha solicitada.
**Decisões tomadas:** controle exclusivamente visual, conforme solicitado; cargos controlados são `garcom` e `entregador`; overrides individuais têm precedência; falha da API preserva a operação anterior; o admin reautentica antes de gerir acessos.
**Verificação:** schema remoto ✓ · RLS/grants/RPC ACL ✓ · login DZN ✓ · defaults remotos ✓ · API GET/POST/PUT ✓ · override individual e restauração ✓ · origem cruzada rejeitada ✓ · `npx tsc --noEmit --incremental false` ✓ · `npm run build` ✓ (47/47 páginas). `npm run lint` indisponível: `next lint` foi removido no Next 16 e não existe configuração ESLint.
**Pendências / próximos passos:** nenhuma dentro do escopo visual solicitado.
**Armadilhas descobertas:** estes controles não impedem chamadas diretas às tabelas operacionais já abertas; são deliberadamente visuais. As RPCs novas não concedem acesso direto às três tabelas de configuração.

## [2026-08-08] DZN — visibilidade global de telas

**Agente/Modelo:** Codex GPT-5.6 SOL
**Objetivo:** criar `/dzn` para o superusuário ocultar globalmente telas do admin e garçom.
**Arquivos alterados:** `src/app/dzn/page.tsx`, `src/components/dzn/GerenciadorVisibilidadeTelas.tsx`, `src/app/api/dzn/visibilidade/route.ts`, `src/lib/visibilidade-telas.ts`, `src/components/admin/AdminLayout.tsx`, `src/components/admin/SidebarPersonalizarModal.tsx`, `src/components/garcom/GarcomLayout.tsx`, `PRD.md`, `UI.md`, `Progress.md`.
**O que foi feito:** login validado pela RPC existente para o usuário `dzn`; toggles salvam em `admin_sidebar_config`; o admin remove telas da sidebar, Mais, busca, atalhos e personalizador; o garçom remove itens do menu desktop e mobile.
**Decisões tomadas:** reutilizar a tabela existente; manter senha apenas em memória; não criar RBAC nem bloquear URL direta.
**Verificação:** `npx tsc --noEmit --incremental false` ✓ · `npm run build` ✓ (47/47 páginas) · `git diff --check` ✓ · bug-hunter ✓ · verification-before-completion ✓. `npm run lint` indisponível: `next lint` foi removido no Next 16 e o projeto não possui configuração ESLint.
**Pendências / próximos passos:** cadastrar o usuário de sistema `dzn` com papel `admin` e a senha definida, caso ainda não exista.
**Armadilhas descobertas:** ocultação global e personalização individual compartilham a linha do usuário `dzn`; essa conta fica reservada para o controle global.

## [2026-08-03] Crediário — reparo pontual do pedido de Bastião

**Agente/Modelo:** Codex GPT-5.6 SOL
**Objetivo:** remover os R$ 288,00 fantasmas do pedido `45B61F27`, restaurando o valor comprovado pelas 24 Stellas sem quitar ou concluir o pedido.
**Arquivos alterados:** `Progress.md` (nenhum código ou migration).
**O que foi feito:** pela Supabase Management API, uma transação guardada restaurou `pedidos.subtotal/total`, o pagamento global vinculado, `crediario_movimentos.valor` e o saldo da conta de R$ 576,00 para R$ 288,00. O trigger existente sincronizou o movimento; os itens, valores originais, status `confirmado` e forma `Crediário` foram preservados. O movimento recebeu metadados do reparo.
**Decisões tomadas:** o pagamento global também foi corrigido para não deixar outra representação financeira em R$ 576,00; nenhum outro pedido ou movimento foi alterado.
**Verificação:** preflight remoto ✓ · ensaio integral com rollback ✓ · commit ✓ · consulta read-only pós-commit ✓ (`pedido=288`, `pagamento=288`, `movimento=288`, `saldo=288`, 24 unidades) · `npx tsc --noEmit --incremental false` ✓ (0 erros) · `npm run lint` indisponível no Next 16 (`next lint` interpreta `lint` como diretório) · diff check ✓ · bug-hunter ✓ · verification-before-completion ✓.
**Pendências / próximos passos:** tornar a edição de pedido transacional e recalcular valores a partir dos itens persistidos para impedir nova divergência.

## [2026-08-03] WhatsApp admin — accordions de consumo DeepSeek e OpenAI

**Agente/Modelo:** Codex GPT-5.6 SOL
**Objetivo:** permitir inspecionar separadamente o consumo dos dois provedores sem poluir o resumo operacional nem criar novas consultas externas.
**Implementação:** as linhas DeepSeek e OpenAI viraram accordions nativos acessíveis por clique e teclado. Ao expandir, exibem gasto estimado desde o boot, tarifa por 1M tokens, chamadas, sucessos/falhas, latência média/acumulada, entrada, cache, saída e última atividade. O cálculo usa somente o snapshot do `/status`, com tarifas oficiais cadastradas para `deepseek-v4-flash` e `gpt-5-mini`; modelo desconhecido mostra estimativa indisponível. A telemetria do bot passou a capturar `prompt_tokens_details.cached_tokens` da OpenAI.
**Egress:** abrir/fechar o accordion não chama OpenAI, DeepSeek, Evolution nem Supabase. Os valores continuam vindo do polling de status já existente.
**TDD RED→GREEN:** cálculo DeepSeek com cache, cálculo GPT-5 mini e recusa de tarifa desconhecida; teste do cliente OpenAI comprova captura real dos tokens em cache.
**Verificação final:** TDD do custo `node --test tests/ai-usage.test.mjs` ✓ (3/3) · suíte do admin ✓ (11/11) · `npx tsc --noEmit --incremental false` ✓ · `npm run build` ✓ (46/46 páginas) · bot `rtk npm test` ✓ (521/521) · bot `rtk npm run check` ✓ · `git diff --check` ✓. `npm run lint` permanece indisponível porque o script legado usa `next lint`, removido no Next 16. Tarifas conferidas nas documentações oficiais do DeepSeek e OpenAI em 03/08/2026.

## [2026-08-03] Crediário — cadastro de WhatsApp antes da cobrança

**Agente/Modelo:** Codex GPT-5.6 SOL
**Objetivo:** manter a cobrança acessível para contas sem telefone, solicitando e salvando o WhatsApp antes da confirmação, e corrigir o nome institucional para Edienai Lanches.
**Implementação:** o botão permanece ativo em contas abertas com saldo. Sem telefone válido, abre um diálogo com DDD, valida o número e segue para a revisão do envio. A rota aceita o telefone informado somente se a conta ainda não tiver um contato válido, salva o número normalizado e ignora tentativa de substituição de contato existente. A mensagem agora diz “aqui do Edienai Lanches”.
**Verificação final:** teste focado RED→GREEN `node --test tests/crediario-cobranca.test.mjs` ✓ (5/5) · suíte `node --test tests/*.test.mjs` ✓ (8/8) · `npx tsc --noEmit --incremental false` ✓ · `npm run build` ✓ (46/46 páginas) · `git diff --check` ✓. `npm run lint` segue indisponível porque o script legado usa `next lint`, removido no Next 16. Nenhum telefone real foi alterado e nenhuma cobrança foi enviada durante os testes.

## [2026-08-03] Cobrança individual do crediário pelo WhatsApp

**Agente/Modelo:** Codex GPT-5.6 SOL
**Objetivo:** permitir que o operador envie, no card ou na tabela do crediário, um lembrete personalizado e grounded da dívida usando o WhatsApp da Edienai.
**Arquivos alterados:** `src/lib/crediario-cobranca.mjs`, `src/app/api/crediario/cobranca/route.ts`, `src/features/crediario/components/CardContaCrediario.tsx`, `src/features/crediario/components/PainelCrediario.tsx`, `tests/crediario-cobranca.test.mjs`, `PRD.md`, `UI.md`, `Progress.md`.

**O que foi feito:** a ação direta usa o ícone real do WhatsApp no card mobile e na tabela desktop, fica disponível somente para conta aberta, com saldo e telefone válido, e exige confirmação mostrando cliente, telefone e saldo. O navegador envia apenas o UUID da conta. A rota relê conta e movimentos ativos no Supabase, monta o resumo do ciclo ainda em aberto e chama o `/send` já existente do bot, que usa Evolution, protege o próprio eco e registra a mensagem enviada.

**Banco e segurança:** a Management API foi usada na ordem `GET /v1/projects` → projeto `edienai` → uma query read-only consolidada. `vw_crediario_contas_resumo`, snapshots `crediario_movimentos.itens`, datas e índices existentes atendem o fluxo; não houve migration. A rota não aceita telefone nem mensagem arbitrários do cliente, valida UUID/content-type/origin e aplica cooldown local de 60 segundos contra clique duplicado. Nenhuma cobrança real foi enviada durante a implementação.

**TDD RED→GREEN:** o RED começou com o módulo de cobrança inexistente. Os GREENs cobrem mensagem com nome/pedido/dia/saldo, exclusão de ciclo já quitado, limite de resumo para contas longas e telefone brasileiro válido.

**Verificação final:** teste focado `node --test tests/crediario-cobranca.test.mjs` ✓ (4/4) · suíte `node --test tests/*.test.mjs` ✓ (7/7) · `npx tsc --noEmit --incremental false` ✓ · `npm run build` ✓ (46/46 páginas) · `git diff --check` ✓. `npm run lint` permanece indisponível porque o script legado usa `next lint`, removido no Next 16. Revisão bug-hunter: nenhum envio automático/em massa, nenhum dado financeiro aceito do navegador e nenhum eco do próprio bot tratado como atendimento humano.

## [2026-08-03] WhatsApp admin — pausa real, IA separada, conexão coerente e estatísticas

**Agente/Modelo:** Codex GPT-5.6 SOL
**Objetivo:** transformar `/admin/whatsapp` em controle operacional real da Carol: pausar atendimento ou apenas IA, mostrar conexão/número coerentes e exibir métricas com período definido.

**Diagnóstico confirmado:** a Management API foi usada na sequência correta (`GET /v1/projects` → projeto `edienai` → query read-only). Não existiam as chaves `bot_ativo` nem `ia_conversa_ativa`; o toggle antigo fazia somente `UPDATE`, afetava zero linhas e mostrava sucesso. O adaptador fixava recebidas/notificações em zero e usava apenas `connectionState`, que não traz número/perfil. A tela ainda chamava `connect`/QR a cada 5 segundos mesmo conectada.

**Fix:** toggles usam `upsert` allowlisted e exigem confirmação do refresh real do cache do bot. Pausar IA preserva regras determinísticas; pausar Carol interrompe respostas. O status combina `connectionState` com `fetchInstances`, removendo a contradição “Conectado / Não conectado”. O painel mostra mensagens em 24h, notificações em 7 dias, conversas, fila/outbox, takeover e telemetria DeepSeek/OpenAI desde o boot, sem expor credenciais. Polling de status passou a 15s; QR só é solicitado quando desconectado e visível, a cada 20s.

**Evidência:** Evolution respondeu `open` e retornou número/perfil reais pelos dois endpoints. Snapshot read-only: 198 recebidas/154 enviadas em 24h, 47 conversas em 24h, 12 notificações em 7 dias, 100 rascunhos ativos, outbox 974 enviadas/101 falhas. Nenhuma escrita de produção, migration, deploy ou git de escrita foi executada.

**Verificação final:** `npx tsc --noEmit --incremental false` ✓ · `npm run build` ✓ (46/46 páginas; avisos preexistentes de metadata) · `git diff --check` ✓. `npm run lint` permanece indisponível porque o script legado usa `next lint`, removido no Next 16.

## [2026-08-02] Crediário — conclusão atômica, saldo de Derick e cards quitados

**Agente/Modelo:** Codex (GPT-5)
**Objetivo:** Fazer toda conclusão futura quitar o consumo crediário do pedido, corrigir o saldo comprovadamente corrompido de Derick e impedir pagamentos acima da dívida.
**Arquivos alterados:** `scripts/migrations/20260802_crediario_conclusao_atomica.sql`, `scripts/migrations/20260802_reparar_saldo_derick_144.sql`, `src/lib/pedidos-utils.ts`, `src/app/admin/pedidos/page.tsx`, `src/components/admin/CardPedido.tsx`, `src/components/admin/painel/CardPedidoKanban.tsx`, `src/components/admin/garcons/PedidosCriadosGarcom.tsx`, `PRD.md`, `UI.md`, `Progress.md`.

**O que foi feito:**
- Trigger `BEFORE UPDATE OF status` aplicado em produção: ao passar de qualquer status para `entregue`, pedido crediário recebe pagamento vinculado ao consumo, preserva a trilha consumo + pagamento e grava `forma_pagamento='Concluído'` na mesma transação.
- A sincronização deixa de cancelar consumo já pareado com quitação do pedido e preserva movimentos zerados por pagamento de itens.
- `registrar_pagamento_crediario` agora bloqueia valor acima de `saldo_atual`; pagamento integral converte todos os pedidos crediários da conta para `Concluído`.
- Pagamento do último item também converte o pedido para `Concluído`.
- Reativado somente o consumo de R$ 143,00 comprovadamente cancelado após ter sido pago na conta de Derick; o crédito residual indevido saiu e o saldo real voltou de R$ 1,00 para R$ 144,00.
- `/admin/pedidos` usa a linha retornada pelo banco e remove imediatamente o estado visual de crediário; o CTA mostra “Concluir e quitar”.
- Predicado de crediário aberto foi centralizado e reutilizado no card principal, Kanban e lista do garçom; conta quitada não aparece como “Crediário”, “Crediário ok”, “Fiado” nem reexibe a barra vermelha do snapshot auditável.

**Decisões tomadas:** A regra ficou em trigger transacional porque existem cinco produtores web de `status='entregue'` e clientes externos compartilhando o banco; duplicar a lógica deixaria fluxos sem cobertura. A função de trigger é `security invoker`, sem nova elevação de privilégio. Os 80 pedidos históricos entregues/crediário (R$ 2.500,46) foram preservados por decisão explícita: entrega antiga não prova pagamento.
**Verificação:** Management API ✓ · ensaio transacional com rollback ✓ (excesso rejeitado, conclusão idempotente, consumo auditável) · pagamento integral/item com rollback ✓ · typecheck ✓ (0 erros) · `npm run lint` indisponível no Next 16 (`next lint` interpreta `lint` como diretório) · bug-hunter ✓ · verification-before-completion ✓ · diff check ✓.
**Pendências / próximos passos:** reconciliar em tarefa própria as 17 contas negativas históricas; revisar manualmente os 80 pedidos antigos antes de qualquer baixa.
**Armadilhas descobertas:** `crediario_contas.saldo_atual` soma todos os ciclos ativos da conta; cancelar um consumo já pago cria crédito residual que abate dívidas futuras. UI não pode inferir “Fiado” apenas pela existência de `crediario_status`.

## [2026-07-26] Bairro na criação pelo garçom + descontos no total da edição

**Agente/Modelo:** Claude Opus 5
**Objetivo:** Fechar as duas pendências da task anterior: o app do garçom criava pedido de entrega com `bairro: null` e taxa fixa, e o total do modal de edição ignorava cupom, frete grátis e desconto manual.
**Arquivos alterados:** `src/app/garcom/novo/page.tsx`, `src/components/admin/ModalEditarPedido.tsx`, `UI.md`, `Progress.md`.

**O que foi feito — app do garçom:**
- Select de bairro na seção de entrega (acima do endereço, com a taxa no rótulo), carga de `bairros` ativos e taxa derivada do bairro. `TAXA_ENTREGA_FIXA` saiu do arquivo.
- `bairro: null` no insert virou o nome do bairro selecionado; o insert em `entregas` passa a receber a taxa correta pela mesma variável.
- Bairro **obrigatório** em `entrega`, nas três barreiras já existentes (`dadosClienteValidos`, `pendenciaEtapaDados`, `pendenciaPrincipalSalvar`) e no guard de `salvarPedido`.
- Pré-preenchimento a partir do cliente salvo (`usuarios_cliente.bairro`) e de "repetir pedido" (o select do pedido base passou a trazer `bairro`).

**O que foi feito — modal de edição:**
- `desconto_cupom`, `desconto_frete` e `desconto_manual` buscados **dentro do modal** por `pedido.id` e aplicados ao total; os três aparecem no resumo do rodapé.
- `subtotal` gravado virou o líquido (`subtotalItens − desconto_manual`), alinhando com o significado da coluna no PDV.

**Decisões tomadas:**
- **Semântica das colunas conferida antes de mexer em dinheiro**, não presumida: `pedidos.subtotal` já vem líquido do `desconto_manual` (`/admin/pedidos/novo:772,996`) e `desconto_itens_total` já está embutido no subtotal de cada item — subtrair qualquer um dos dois de novo contaria em dobro. `desconto_cupom`/`desconto_frete` ficam **fora** do subtotal (`ModalCarrinho:1258,1270`). Fórmula final: `total = (subtotalItens − desconto_manual) + taxa_entrega + taxa_serviço − desconto_cupom − desconto_frete`.
- **`desconto_frete` limitado à taxa vigente** e regravado com o valor limitado: trocar para um bairro mais barato deixaria o desconto de frete maior que a própria taxa.
- **Descontos buscados no modal, não recebidos por prop.** São **7 call sites** (`/admin/pedidos`, `/admin/pedidos/[id]`, dashboard, painel, pdv, salão, `PedidosCriadosGarcom`) montando o objeto `pedido` com selects diferentes; mudar o tipo obrigaria a tocar todos (§4).
- **Validação exige bairro DO CADASTRO (`bairroSelecionado`), não texto preenchido.** Primeira versão validava `Boolean(bairro)` e tinha um furo: bairro vindo do cliente salvo ou de "repetir pedido" que tivesse sido desativado passava na validação e salvava com taxa 0. Validar pelo objeto encontrado também evita corrida com a carga assíncrona de `bairros`.

**Verificação:** `npx tsc --noEmit --incremental false` ✓ 0 erros · `npx next build` ✓ compilou · conferido que, com os três descontos em 0 (situação de **todos** os pedidos do banco hoje), a fórmula nova devolve exatamente o valor antigo — a mudança é inerte sobre os dados atuais e só age quando houver desconto · `npm run lint` indisponível no repositório.

**Pendências / próximos passos:**
- `src/lib/taxas-entrega.ts` ficou **sem nenhum importador** (`TAXA_ENTREGA_FIXA`, `obterTaxaEntrega`, `formatarTaxa`). Não apaguei (§3.7); é remoção de uma linha quando alguém confirmar.
- Os 83 pedidos já gravados com bairro nulo e taxa 2,00 continuam como estão — reprecificar histórico mexe em caixa/crediário/finanças.
- No modal de edição, mudar a quantidade de um item recalcula `subtotal` como `(preço + adicionais) × qtd`, **descartando o `desconto_manual` daquele item**. Pré-existente e não coberto aqui.

**Armadilhas descobertas:**
- `pedidos.subtotal` tem significado **diferente** conforme a origem: no PDV já vem líquido do desconto do pedido; no cardápio vem bruto e o cupom fica só nas colunas de desconto. Qualquer tela que recalcule total precisa das duas regras juntas.
- `<select>` com `value` que não bate com nenhuma `<option>` renderiza vazio mas mantém o estado preenchido — validar por "campo não vazio" deixa passar valor inválido.

## [2026-07-26] Editar pedido apagava o bairro e rebaixava a taxa de entrega para R$ 2

**Agente/Modelo:** Claude Opus 5
**Objetivo:** Editar um pedido de entrega deve preservar (e permitir trocar) o bairro e cobrar a taxa real desse bairro, em vez de zerar o bairro e forçar o valor fixo.
**Arquivos alterados:** `src/components/admin/ModalEditarPedido.tsx`, `UI.md`, `Progress.md`.

**O que foi feito:**
- Estado `bairro` + carga de `bairros` (`ativo=true`, ordenado por `ordem`) no `ModalEditarPedido`, espelhando `/admin/pedidos/novo`.
- Taxa **derivada do bairro** (`entrega_gratis ? 0 : taxa_entrega`); `TAXA_ENTREGA_FIXA` saiu do arquivo.
- `bairro: null` hard-coded no update virou `tipoEntrega === 'entrega' ? (bairro || null) : null`; o snapshot de impressão passou a usar o bairro editado em vez do original.
- Seletor de bairro na seção Dados, visível só em `entrega`, com o valor de cada taxa no rótulo. O aviso passou a mostrar a taxa efetiva.

**Diagnóstico (dados de produção, PostgREST/anon — a Management API respondeu 403 com o token do ambiente):**
- `bairros`: 13 ativos, taxas de **R$ 2, R$ 3 e R$ 5**. O fixo era R$ 2, o **mais barato** — editar um pedido de Morrins/Taboquinha/Lagoa de fora derrubava a taxa de R$ 5 para R$ 2.
- `pedidos` com `tipo_entrega='entrega'`: 1.341 no total, **121 sem bairro**, dos quais **83 com taxa exatamente 2,00**.
- Nos 15 mais recentes sem bairro, **13 tinham `updated_at > created_at`** (ou seja, passaram pelo modal) e **todos** ficaram com taxa 2,00 — inclusive um cujo endereço diz "Bairro Lorival", que custa R$ 3.

**Decisões tomadas:**
- **Sem bairro conhecido, preserva `pedido.taxa_entrega`** em vez de cair para 0 ou para um fixo. Os 121 pedidos legados não são reprecificados sozinhos ao serem abertos, e nenhum save silencioso muda dinheiro.
- **Bairro fora do cadastro continua selecionável** (opção "fora do cadastro"): se um bairro for desativado ou renomeado, abrir e salvar um pedido antigo não apaga o dado.
- **Casamento por `nome`, não por id.** `pedidos.bairro` é `text` (o PDV grava o nome); usar id exigiria migração de coluna — fora do escopo.
- Query client-side com anon, contra a preferência do §3.9, porque `bairros` já é lido assim pelo cardápio público e pelo PDV e o modal inteiro já consulta o Supabase direto. Não amplia exposição.

**Verificação:** `npx tsc --noEmit --incremental false` ✓ 0 erros · `npx next build` ✓ compilou · a query exata que o modal passa a fazer (`bairros?select=id,nome,taxa_entrega,entrega_gratis&ativo=eq.true&order=ordem`) respondeu **200 com os 13 bairros** · `npm run lint` indisponível no repositório (`next lint`, Next 16).

**Pendências / próximos passos:**
- **`src/app/garcom/novo/page.tsx:813` grava `bairro: null`** e usa `TAXA_ENTREGA_FIXA` (linha 651) — mesmo defeito, mas na **criação**. É a outra fonte dos 121 pedidos sem bairro. Corrigir exige adicionar seletor de bairro ao formulário do garçom: tarefa própria.
- **Os 83 pedidos já corrompidos não foram corrigidos** — reprecificar histórico mexe em caixa/crediário/finanças e precisa de autorização.
- `totalFinal` do modal é `subtotal + taxa + taxa_serviço` e **ignora `desconto_cupom`, `desconto_frete` e `desconto_manual`**: editar um pedido com cupom inflaria o total. Hoje é latente — nenhum pedido no banco tem esses campos > 0.

**Armadilhas descobertas:**
- `pedidos.bairro` é **texto solto**, não FK para `bairros`. Bairro renomeado no cadastro desliga a associação dos pedidos antigos em silêncio.
- Existem duas colunas de endereço em `pedidos` (`endereco` e `endereco_entrega`); o modal de edição só lê e grava `endereco`.
- A Management API respondeu **403** com o `SUPABASE_ACCESS_TOKEN` do ambiente ("account does not have the necessary privileges") — para análise de banco nesta máquina, o caminho que funciona é PostgREST com a anon key.

## [2026-07-25] Drawer do carrinho no mobile — seletor de bairro morto e painel cortado pelo teclado

**Agente/Modelo:** Claude Opus 5
**Objetivo:** Fazer o checkout público funcionar no mobile: escolher/rolar/fechar o bairro com o Drawer aberto e o painel não ficar cortado quando o teclado virtual abre, em Chromium e Safari.
**Arquivos alterados:** `src/hooks/useAjusteTecladoVirtual.ts` (novo), `src/components/ModalCarrinho.tsx`, `UI.md`, `Progress.md`.

**O que foi feito:**
- **Seletor de bairro virou `DrawerNested`** dentro do `DrawerContent` do checkout, espelhando o `ModalSelecionarMesa` que já estava certo. A lista rola pela cadeia flex (`min-h-0 flex-1 overflow-y-auto overscroll-contain`) em vez de `max-h-[60vh]`, e o fechar/swipe/Esc passam a ser do próprio Vaul.
- **Teclado virtual medido por conta própria:** `repositionInputs={false}` no `Drawer` + `useAjusteTecladoVirtual`, que deriva `height`/`bottom` do `visualViewport` a cada evento e devolve `null` quando o teclado fecha, devolvendo o painel ao `h-[92dvh]` do CSS.
- Efeito curto que realinha (`scrollIntoView({ block: 'center' })`) o campo em foco depois que o painel encolhe — o browser só alinha o campo *antes* do redimensionamento.

**Decisões tomadas:**
- **`DrawerNested` em vez de subir o z-index.** O overlay do bairro era irmão do `<Drawer>` com `z-[1100]`: aparecia por cima, mas o Radix (que o Vaul usa por baixo) põe `pointer-events:none` no `body` e o `react-remove-scroll` bloqueia `touchmove`/`wheel` fora do content. Daí os três sintomas juntos — não escolhia, não rolava, não fechava. O `ModalAlerta` escapa porque tem `pointer-events-auto` explícito.
- **Desligar o `repositionInputs` do Vaul em vez de ajustar o CSS.** O Vaul escreve `style.height`/`style.bottom` inline (vence o `h-[92dvh]`) e decide isso por um `keyboardIsOpen` que ele **alterna** (`!keyboardIsOpen`) a cada `visualViewport.resize` maior que 60px. Safari/Chromium emitem vários eventos durante a animação do teclado, o flag dessincroniza, o handler passa a sair cedo (`isInput(activeElement) || keyboardIsOpen`) e a altura em px fica congelada. O hook novo nunca acumula estado: recalcula da medida atual e volta a `null` sozinho.
- **Hook local, primitiva compartilhada intocada.** `src/components/ui/drawer.tsx` é usado pelo admin (sidebar, dialogs responsivos) — mexer nele arriscava regressão fora do escopo (§3.3).
- Perdemos o `usePreventScroll` do Vaul (o `isDisabled` dele inclui `!repositionInputs`), mas o bloqueio de scroll de fundo continua: quem tranca é o `DialogPrimitive.Overlay` do Radix, como o próprio código do Vaul comenta. De quebra sai o hack iOS de `translateY(-2000px)` no input.
- No modo simulação o bairro deixou de renderizar `absolute` dentro da moldura de iPhone. Já era incoerente: o Drawer pai sempre foi portal para o `body`, então o filho ficava dentro da moldura e o pai fora.

**Verificação:** `npx tsc --noEmit --incremental false` ✓ 0 erros · `npx next build` ✓ compilou e gerou todas as rotas · `npm run lint` **segue indisponível** no repositório (o script é `next lint`, removido no Next 16 — falha idêntica antes da mudança) · skill `bug-hunter` executada sobre o próprio diff ✓ (achado: com `bairros.length === 0`, o botão "No local" fecha um `DrawerNested` e abre o outro no mesmo commit; os efeitos rodam na ordem de montagem e o pai fica sem o recuo de 16px — cosmético, estado neutro, sem correção) · `verification-before-completion` **não** executada como skill; a verificação foi typecheck + build + releitura do diff.

**Pendências / próximos passos:**
- **O modal PIX (`modalPagamentoPixAberto`) tem exatamente o mesmo defeito** e continua quebrado: `fixed inset-0 z-[1100]` irmão do `<Drawer>`, sem `pointer-events-auto` — com o checkout aberto nenhum botão dele responde e o conteúdo não rola. Não entrou no escopo porque a correção certa (`DrawerNested`) muda a apresentação dele no desktop de diálogo centralizado para bottom sheet — decisão de UI a confirmar.
- O botão de fechar do `ModalAlerta` é clicável (tem `pointer-events-auto`), mas ele vive fora da árvore do Drawer; se um dia ganhar interação real, mover também.

**Armadilhas descobertas:**
- `z-index` não vence focus trap. Overlay irmão de Drawer modal fica visível e inerte: `pointer-events:none` no `body` (Radix) + `react-remove-scroll` fora do content.
- O `repositionInputs` do Vaul 1.1.2 **alterna** `keyboardIsOpen` em vez de setar; com mais de dois `visualViewport.resize` por animação de teclado ele dessincroniza e o drawer nunca volta à altura original.
- `dvh` **não** encolhe com o teclado virtual (nem no iOS nem no Chrome Android) — ele acompanha só a barra do browser. Painel que precisa caber acima do teclado tem que ler `visualViewport`.
- `visualViewport.offsetTop` importa no iOS: a conta é `innerHeight - vv.height - vv.offsetTop`, senão o painel fica deslocado quando o Safari rola o viewport visual.
## [2026-07-25] Cadastro casado funcionário ↔ usuário do sistema

**Agente/Modelo:** Claude Opus 5
**Objetivo:** Parar de exigir cadastro manual nas duas telas: um toggle pré-ativado em cada modal de criação passa a criar o outro lado já vinculado.
**Arquivos alterados:** `src/lib/cadastro-equipe.ts` (novo), `src/components/admin/GerenciadorFuncionarios.tsx`, `src/components/admin/GerenciadorUsuariosSistema.tsx`, `UI.md`, `Progress.md`.

**O que foi feito:**
- **Novo funcionário:** toggle “Criar acesso ao sistema” (ligado por padrão) abre foto (recorte real via `ModalRecorteAvatar`), login, senha com olho, papel e cor do avatar. Salvar grava o funcionário, cria o usuário com `funcionario_id` e sobe a foto depois (o upload precisa do id do usuário).
- **Novo usuário:** toggle “Cadastrar como funcionário” (ligado por padrão) com função na equipe e telefone. O funcionário é criado antes para o usuário já nascer vinculado.
- Login sugerido a partir do nome no padrão real da base (`joao_pedro`, `md_chefe`), com sufixo numérico quando já existe; a sugestão para de sobrescrever assim que o admin digita à mão.
- Papel e função se traduzem nos dois sentidos (`PAPEL_PARA_TIPO_FUNCIONARIO` / `TIPO_FUNCIONARIO_PARA_PAPEL`), sempre como valor inicial editável.
- Em edição, nenhum dos toggles aparece: alterar quem já existe continua sendo feito na tela do próprio cadastro.

**Decisões tomadas:**
- **Reaproveitar em vez de duplicar:** ao criar usuário com o toggle ligado, um funcionário de mesmo nome normalizado (sem acento/caixa) é vinculado. A base já tinha “Bom Parto”/“Bom parto”, “Edienai”/“edienai”, “Zacarias”/“Zacarias” — justamente o efeito do cadastro manual em duas telas.
- **Sem transação distribuída:** se o segundo passo falhar, o primeiro permanece e o toast diz o que ficou pendente. Repetir a operação reaproveita o cadastro criado, então não gera duplicata.
- `cozinheiro` mapeia para o papel `garcom` porque `usuarios_sistema.papel` tem CHECK (`admin|garcom|entregador`); o campo fica visível para correção.

**Verificação:** `npx tsc --noEmit --incremental false` ✓ 0 erros · RPC `criar_usuario_sistema` inspecionada ao vivo — ela de fato insere `funcionario_id` ✓ · cadeia completa testada no banco em bloco `DO` abortado por exceção (`vinculo_ok=t`, papel `garcom`) e resíduo conferido depois: 0 registros de teste, contagens intactas (8 funcionários / 11 usuários) ✓ · `/admin/funcionarios`, `/admin/usuarios` e `/admin/produtividade` compilam e respondem **200** em dev server temporário (porta 3005, derrubado ao fim; log sem erro de compilação) ✓ · geração de login conferida contra os nomes reais (`João Pedro`→`joao_pedro`, `MD Chefe`→`md_chefe`) ✓. `npm run lint` segue indisponível (o `next lint` legado é incompatível com Next 16).

**Pendências / próximos passos:**
- Os 11 usuários e 8 funcionários **já existentes** continuam sem vínculo: um backfill que case os pares por nome resolveria, mas é tarefa própria (mexe em dados de produção).
- `criar_usuario_sistema` guarda a senha como **SHA-256 sem salt**. Não foi tocado por estar fora do escopo, mas é fraqueza real de autenticação.

**Armadilhas descobertas:**
- `URL.createObjectURL` do preview precisa de `revokeObjectURL` ao limpar o formulário, senão o blob fica retido.
- O upload de avatar (`enviarImagemParaR2`) exige o id do usuário, então a foto só pode subir **depois** de criar o acesso — não dá para inverter a ordem.
- `funcionarios.tipo` não tem CHECK (aceita qualquer texto), mas `usuarios_sistema.papel` tem: a tradução precisa partir do lado restrito.

## [2026-07-25] Produtividade dos garçons — pontuação, ranking e boas práticas

**Agente/Modelo:** Claude Opus 5
**Objetivo:** Criar o módulo de produtividade (inspirado no `metrics` do Juridiq) medindo pedidos criados, entregues e editados por garçom, com desconto de pontos por cadastro ruim.
**Arquivos alterados:** `scripts/migrations/20260725_produtividade_garcons.sql` (novo, **aplicado em produção** via Management API), `src/lib/server/produtividade.ts`, `src/app/api/admin/produtividade/route.ts`, `src/app/api/admin/produtividade/ocorrencias/route.ts`, `src/app/api/admin/produtividade/config/route.ts`, `src/features/produtividade/*` (types, `lib/periodo.ts`, `lib/metricas.ts`, `hooks/useProdutividade.ts`, 7 componentes), `src/app/admin/produtividade/page.tsx`, `src/lib/admin-sidebar-routes.ts`, `PRD.md`, `UI.md`, `Progress.md`.

**O que foi feito:**
- Pontuação **calculada sob demanda** por funções SQL — nenhum trigger novo em `pedidos` (que já tem 9 e move caixa/crediário/impressão) e retroativa sobre os 2.996 pedidos de garçom já existentes.
- Ganhos: pedido criado (qualquer status, inclusive pendente), pedido entregue, item adicionado, pedido editado e bônus de cadastro completo. Descontos: nome de cliente genérico e retirada/entrega sem telefone ou endereço. Cancelado é neutro (peso 0, configurável).
- Pesos e metas em `produtividade_config`, editáveis pela UI; mudar um peso recalcula todo o histórico.
- Tela `/admin/produtividade`: faixa KPI + metas dia/semana/mês, ranking com pódio e selo de qualidade, gráfico de ganhos × perdas, evolução por dia operacional, lista paginada de "pontos perdidos" com deep-link para o pedido e modal de composição dos pontos por garçom.

**Decisões tomadas:**
- **Fechamento = pedido chega a `entregue`**, creditado ao dono (`garcom_id`). O app do garçom não foi instrumentado: em 313 edições registradas só 2 foram "status alterado para entregue" — o fechamento acontece no admin/salão.
- **`security definer` em vez de abrir a tabela.** `SUPABASE_SERVICE_ROLE_KEY` **não existe no `.env.local`**, então `obterSupabaseAdmin()` cai no fallback da anon key e um `REVOKE` puro deixava a tela sem dados (`permission denied for table produtividade_config`). As funções de topo rodam como o dono e a tabela continua inacessível ao anon; a escrita passa por `produtividade_salvar_config`, que só aceita as 11 chaves conhecidas com valor entre 0 e 100000.
- **Nenhum índice criado** — medido: o recorte de `pedidos` custa 2,4 ms pelo `idx_pedidos_created_at` existente e a agregação de `atividade_garcom` 3,4 ms em seq scan. O custo estava na avaliação das regras por linha.
- Pedido em aberto **não** desconta ponto (decisão do usuário), mas aparece como métrica e como aviso no modal do garçom.

**Verificação:** `npx tsc --noEmit --incremental false` ✓ 0 erros · funções conferidas ao vivo pela Management API (5 funções, todas `security definer`, tabela negada ao anon: `has_table_privilege('anon',…,'SELECT') = false`) · execução completa sob `set local role anon` ✓ · endpoints reais em `localhost:3000`: GET produtividade/ocorrências/config 200 e período inválido, ausente e janela de 3 anos → 400 ✓ · PUT válido grava e PUT com valor negativo ou chave desconhecida → 400 ✓ · consistência cruzada: pontos negativos do ranking = soma das ocorrências (587 em 7 dias; 6.820 em 90 dias) e total do ranking = soma da série em 7/30/90/365 dias ✓ · bug-hunter ✓ · verification-before-completion ✓. **`npm run lint` continua indisponível** no repositório (o script legado `next lint` é incompatível com Next 16 e não há config ESLint).

**Pendências / próximos passos:**
- Se um dia o garçom passar a fechar pedido pelo app, registrar `pedido_fechado` em `atividade_garcom` permite separar "fechou" de "foi fechado por outro".
- Quando `SUPABASE_SERVICE_ROLE_KEY` existir no ambiente, dá para revogar os `grant execute` do anon nas funções de topo.

**Armadilhas descobertas:**
- Função SQL com `WITH` **ou** com `SET search_path` não é inlineada pelo planner: `fn_produtividade_nome_generico` custava 88 ms por 3.000 linhas e caiu para ~46 ms quando virou expressão única com tudo qualificado em `pg_catalog` (a proteção contra search_path hijack é mantida pela qualificação).
- `revoke ... from anon` **não** fecha uma função: o `EXECUTE` default vem do pseudo-role `PUBLIC`. Só `revoke ... from public` fecha.
- Em `count(distinct (dia, pedido_id))` o par **não** é nulo quando só `pedido_id` é — sem `pedido_id is not null` no filtro, o único evento órfão de `atividade_garcom` entrava na conta e o total do ranking divergia da série em 3 pontos.
- `pedidos` não tem `status_atualizado_em` nem autoria de fechamento, e `updated_at` não serve como "fechado em" (média de 3,7 dias entre criação e último update).

## [2026-07-25] Pedidos — cache, scroll e recargas concorrentes

**Agente/Modelo:** Codex (GPT-5)
**Objetivo:** Eliminar a quebra intermitente da lista de Pedidos, o scroll fantasma e a necessidade de F5.
**Arquivos alterados:** `public/sw-admin.js`, `src/components/admin/PWAManagerAdmin.tsx`, `src/components/admin/AdminLayout.tsx`, `src/app/admin/pedidos/page.tsx`, `UI.md`, `Progress.md`.
**O que foi feito:**
- Service worker admin `v4.3.5`: navegações HTML e payloads RSC são sempre de rede; somente GETs não HTML/RSC podem entrar no cache; o cache antigo é invalidado na ativação.
- O novo worker usa `skipWaiting`, o gerenciador verifica atualização imediatamente e recarrega uma única vez na troca de controller; em desenvolvimento, registros e caches do admin são removidos.
- `AdminLayout` passou a identificar o container rolável e restaurá-lo sem animação em mudanças de rota.
- Pedidos restaura o scroll em mudanças de consulta/paginação, aceita somente a resposta assíncrona mais recente e preserva a grade já carregada durante recargas, com estado visual ocupado; skeleton aparece apenas na carga inicial.
**Decisões tomadas:** Preservado o fallback `/offline.html`, mas HTML/RSC do painel não têm fallback em cache porque misturar versões do App Router é mais perigoso do que apresentar o estado offline.
**Verificação:** `node --check public/sw-admin.js` ✓ · `npx tsc --noEmit --incremental false` ✓ · teste estrutural red/green e contratos críticos ✓ · `git diff --check` ✓ · bug-hunter ✓ · code-reviewer ✓ · verification-before-completion ✓. `npm run lint` indisponível: o script legado `next lint` é incompatível com Next 16.
**Pendências / próximos passos:** nenhuma dentro do escopo.
**Armadilhas descobertas:** `skipWaiting` precisa ser acompanhado por listener de `controllerchange` registrado antes da verificação explícita; listeners anônimos/recriados não são removidos corretamente.

## [2026-07-25] Dashboard — pedidos de hoje com corte às 03h

**Agente/Modelo:** Codex (GPT-5)
**Objetivo:** Corrigir os KPIs “Pedidos hoje” e “Receita hoje” para respeitarem o dia operacional real, encerrado às 03:00 do dia seguinte.
**Arquivos alterados:** `src/app/admin/dashboard/page.tsx`, `PRD.md`, `UI.md`, `Progress.md`.
**O que foi feito:**
- Substituído o helper legado de 10:00→09:59 pelo `obterIntervaloDiaOperacionalAtual`, já compartilhado por Garçons e Salão.
- A RPC `estatisticas_pedidos_periodo` foi preservada: ela estava correta e apenas recebia `p_inicio` errado do dashboard.
- O fim do payload de “hoje” continua sendo o instante atual; o início agora é 03:00 em `America/Sao_Paulo`.
**Decisões tomadas:** Reuso do helper único de dia operacional; nenhuma migration, índice ou alteração de função foi necessária.
**Verificação Management API:** em 25/07/2026 às 16:53 SP, RPC 10h retornou 6 pedidos/R$ 48,00 e RPC 03h retornou 9 pedidos/R$ 85,00. Os pedidos das 09:25, 09:34 e 09:45 eram os três excluídos pelo payload antigo.
**Verificação:** `npx tsc --noEmit --incremental false` ✓ · teste estrutural red/green do payload ✓ · `git diff --check` ✓ · conferência Management API ✓ · bug-hunter ✓ · verification-before-completion ✓. `npm run lint` indisponível: o script legado `next lint` é incompatível com Next 16; execução direta do ESLint também não encontra configuração no repositório.
**Pendências / próximos passos:** Auditar separadamente Análise Diária e Caixa, que ainda usam o helper legado de 10h; não foram alterados nesta tarefa.
**Armadilhas descobertas:** A RPC não define o dia operacional; o chamador define a janela. Comparar apenas a função do banco esconderia o erro no payload client-side.

## [2026-07-24] Checkout público — seletor de mesa aninhado

**Agente/Modelo:** Codex (GPT-5)
**Objetivo:** Impedir que o seletor de mesa bloqueie o carrinho e permitir fechar ou selecionar sem perder o checkout.
**Arquivos alterados:** `src/components/ModalCarrinho.tsx`, `src/components/ModalSelecionarMesa.tsx`, `src/components/ui/drawer.tsx`, `UI.md`, `Progress.md`.
**O que foi feito:**
- O seletor deixou de ser um overlay customizado irmão do checkout e passou a usar o `NestedRoot` oficial do Vaul.
- O componente agora é montado dentro da árvore do Drawer pai, preservando a coordenação de foco, eventos externos, Escape, overlay e scroll.
- Fechar a seleção encerra apenas o Drawer filho; o carrinho permanece aberto no mesmo estado.
- Título e descrição passaram a usar as primitivas acessíveis do Drawer; o botão de fechar mantém alvo mínimo de 44 px.
**Decisões tomadas:** Não foi usado `modal={false}` no carrinho: isso apenas relaxaria o bloqueio global e esconderia o sintoma. `DrawerNested` trata a relação pai/filho na origem.
**Verificação:** teste estrutural red/green ✓ · `npx tsc --noEmit --incremental false` ✓ (0 erros) · `git diff --check` ✓ · revisão da implementação instalada do Vaul ✓ · `npm run lint` bloqueado pelo script preexistente `next lint`, incompatível com Next 16 · bug-hunter ✓ · verification-before-completion ✓.
**Pendências / próximos passos:** Nenhuma funcional; validação visual manual no aparelho continua necessária porque teste de browser é proibido neste repositório.
**Armadilhas descobertas:** `z-index` maior não vence o focus trap nem `pointer-events` controlados por um Drawer modal.

## [2026-07-24] Cardápio público — correção estrutural do mobile, Drawer e hidratação

**Agente/Modelo:** Codex (GPT-5)
**Objetivo:** Corrigir o carrinho escurecido/inoperante, remover a navegação inferior durante fluxos modais, eliminar a divergência de hidratação e tornar a montagem do pedido mais clara no celular.
**Arquivos alterados:** `public/sw.js`, `src/app/page.tsx`, `src/components/AjudaPedidoPublica.tsx`, `src/components/Footer.tsx`, `src/components/Header.tsx`, `src/components/ModalAlerta.tsx`, `src/components/ModalCarrinho.tsx`, `src/components/ModalComplementos.tsx`, `src/components/ModalSelecionarMesa.tsx`, `src/components/PWAManager.tsx`, `src/contexts/CarrinhoContext.tsx`, `UI.md`, `Progress.md`.
**O que foi feito:**
- Corrigida a ordem de camadas do Vaul: overlay e superfície voltaram aos níveis compartilhados, enquanto seletor de bairro/mesa, alerta e PIX ficam acima do checkout.
- A navegação inferior deixa de ser renderizada enquanto carrinho, pedidos, ajuda, complementos ou notificação estiverem abertos; o aviso não bloqueante de loja fechada preserva a navegação.
- O service worker não registra em desenvolvimento, remove registros/caches antigos e não armazena HTML nem payload RSC; a navegação usa rede com fallback apenas para a página offline.
- O cabeçalho passou a ter árvore inicial estável entre servidor e cliente; apenas o ícone dependente do tema muda depois da montagem.
- A persistência do carrinho ganhou uma barreira de hidratação para não sobrescrever o `localStorage` com o estado vazio inicial.
- Adicionar produto, bebida, combo ou item personalizado agora confirma por toast com ação `Ver carrinho`, sem interromper a escolha nem abrir o checkout à força.
- O carrinho recebeu alvos de toque maiores, quantidade/total junto à decisão, rodapé fixo legível, scroll contido e etapas futuras realmente desabilitadas.
**Decisões tomadas:** Aplicados os princípios de `uxui-principles` de controle do usuário, alvo de toque, hierarquia, feedback imediato e redução de sobreposição; o checkout existente foi preservado como única fonte do pedido.
**Verificação:** `npx tsc --noEmit --incremental false` ✓ (0 erros) · `git diff --check` ✓ · `npm run lint` bloqueado pelo script preexistente `next lint` no Next 16 · ESLint direto também indisponível porque o repositório não possui arquivo de configuração · bug-hunter ✓ · code-reviewer ✓ · verification-before-completion ✓.
**Pendências / próximos passos:** Validação visual manual em celular real; teste de browser automatizado é proibido neste repositório.
**Armadilhas descobertas:** Um service worker cacheando `/` pode combinar HTML antigo com chunks novos do Next e produzir mismatch de classe literal; nunca baixar localmente o conteúdo de um Drawer abaixo do overlay compartilhado.

## [2026-07-24] Correção do cardápio público — Drawer e camadas mobile

**Agente/Modelo:** Codex (GPT-5)
**Objetivo:** Corrigir a regressão visual do CTA sobre o catálogo, o Drawer de ajuda bloqueado pelo próprio overlay e o carrinho que ainda era um modal customizado.
**Arquivos alterados:** `src/app/page.tsx`, `src/components/AjudaPedidoPublica.tsx`, `src/components/ModalCarrinho.tsx`, `src/components/ModalSelecionarMesa.tsx`, `src/components/ui/drawer.tsx`, `UI.md`, `Progress.md`; removido `src/components/BarraCarrinhoPublico.tsx`.
**O que foi feito:**
- Removidos CTA de carrinho, ajuda e WhatsApp flutuantes; carrinho permanece no menu inferior e ajuda somente na navbar.
- Corrigida a causa do Drawer de ajuda escurecido e sem clique: o conteúdo tinha `z-[80]` abaixo do overlay `z-[1000]`.
- Checkout passou a usar o Drawer Vaul compartilhado, preservando os seletores internos acima da superfície.
- Cards explicativos das etapas foram substituídos por progresso compacto; texto redundante antes dos itens foi removido.
- Ajuda virou instrução curta em linha, com ações reais para voltar ao cardápio ou chamar no WhatsApp.
**Decisões tomadas:** `DrawerContent` ganhou `overlayClassName` opcional para o checkout coexistir com os submodais legados de bairro, mesa, alerta e PIX sem alterar o z-index global dos demais Drawers.
**Verificação:** `npx tsc --noEmit --incremental false` ✓ (0 erros) · `git diff --check` ✓ · `npm run lint` bloqueado pelo script preexistente `next lint`, incompatível com Next 16 · bug-hunter ✓ · code-reviewer ✓ · verification-before-completion ✓.
**Pendências / próximos passos:** validação visual manual em celular real; teste de browser automatizado é proibido neste repositório.
**Armadilhas descobertas:** nunca aplicar z-index de conteúdo abaixo do `DrawerOverlay`; o menu inferior já era o controle persistente do carrinho, portanto uma segunda barra fixa sempre concorreria pelo mesmo espaço.

## [2026-07-24] Cardápio público — pedido mobile, ajuda e WhatsApp

**Agente/Modelo:** Codex (GPT-5)
**Objetivo:** Tornar o pedido pelo cardápio público mais direto no celular, com carrinho acessível, cores coerentes e ajuda imediata.
**Arquivos alterados:** `src/app/page.tsx`, `src/components/Header.tsx`, `src/components/BarraCarrinhoPublico.tsx`, `src/components/AjudaPedidoPublica.tsx`, `src/components/ModalCarrinho.tsx`, `UI.md`, `Progress.md`.
**O que foi feito:**
- Adicionada barra fixa de carrinho no mobile com quantidade e total; produtos, bebidas e combos permanecem no cardápio depois de adicionar.
- Checkout existente ganhou apresentação de bottom sheet no mobile, altura segura em `100dvh`, footer sempre alcançável e etapas mais legíveis em telas estreitas.
- Busca, filtros e superfícies da página pública passaram a usar tokens semânticos do tema.
- Criado Drawer “Como fazer seu pedido”, acionável no cabeçalho e por botão flutuante; botão flutuante de WhatsApp é exibido quando o número estiver configurado.
**Decisões tomadas:** foi preservado o `ModalCarrinho` existente como única finalização para não duplicar fluxo de checkout; o botão do WhatsApp usa a configuração já carregada por `useStatusLoja`.
**Verificação:** `npx tsc --noEmit` ✓ (0 erros) · `git diff --check` ✓ · `npm run lint` bloqueado por script preexistente (`next lint` é incompatível com Next 16) · bug-hunter ✓ · verification-before-completion ✓.
**Pendências / próximos passos:** validação visual manual em aparelhos reais continua recomendada; Playwright é proibido neste repositório.
**Armadilhas descobertas:** o `npm run lint` deste projeto chama `next lint`, comando incompatível com Next 16; registrar a falha se ela persistir.

## [2026-07-24] Crediário — excluir pedido cancela o consumo vinculado

**Agente/Modelo:** Codex (GPT-5)
**Objetivo:** Remover do saldo do Crediário o consumo de um pedido excluído.
**Arquivos alterados:** `scripts/migrations/20260724_cancelar_crediario_ao_excluir_pedido.sql`, `Progress.md`.
**O que foi feito:** Atualizada e aplicada a função trigger `limpar_dados_pedido_excluido`: antes da exclusão, ela cancela somente o consumo ativo de origem `pedido` ligado por `pedido_id` e registra o motivo no metadata.
**Decisões tomadas:** Cancelamento lógico, não exclusão física do movimento, para manter auditoria; o trigger já existente de movimentos recalcula o saldo da conta.
**Verificação:** Função confirmada ao vivo pela Supabase Management API · `npx tsc --noEmit` ✓ 0 erros · `npm run lint` indisponível no repositório (Next 16 interpreta `lint` como diretório).
**Pendências / próximos passos:** Nenhuma.
**Armadilhas descobertas:** A FK de `crediario_movimentos.pedido_id` usa `ON DELETE SET NULL`; sem a atualização antes do delete, o consumo ficava ativo, sem vínculo e continuava compondo o saldo.

## [2026-07-24] Crediário — ordenação das contas

**Agente/Modelo:** Codex (GPT-5)
**Objetivo:** Permitir ordenar as contas filtradas por atualização ou saldo.
**Arquivos alterados:** `src/features/crediario/components/PainelCrediario.tsx`, `Progress.md`.
**O que foi feito:** Adicionados pills de ordenação: Mais recentes, Mais antigas, Maior saldo e Menor saldo; a ordenação ocorre antes da paginação.
**Decisões tomadas:** Mais recentes é o padrão inicial e os filtros de status, origem e busca continuam sendo aplicados antes da ordenação.
**Verificação:** `npx tsc --noEmit` ✓ 0 erros · `npm run lint` indisponível no repositório (Next 16 interpreta `lint` como diretório).
**Pendências / próximos passos:** Nenhuma.
**Armadilhas descobertas:** A ordenação precisa ocorrer antes do `slice` da paginação para não produzir páginas inconsistentes.

## [2026-07-24] Crediário — contas mais recentes primeiro

**Agente/Modelo:** Codex (GPT-5)
**Objetivo:** Exibir as contas filtradas por atualização mais recente antes da paginação.
**Arquivos alterados:** `src/features/crediario/components/PainelCrediario.tsx`, `Progress.md`.
**O que foi feito:** Ordenada uma cópia de `contasFiltradas` por `atualizado_em` decrescente depois dos filtros de status, origem e busca.
**Decisões tomadas:** A conta de demonstração do onboarding permanece fixada no topo; todas as contas reais respeitam a ordem cronológica.
**Verificação:** `npx tsc --noEmit` ✓ 0 erros · `npm run lint` indisponível no repositório (Next 16 interpreta `lint` como diretório).
**Pendências / próximos passos:** Nenhuma.
**Armadilhas descobertas:** A paginação usa diretamente `contasFiltradas`; ordenar após o `slice` deixaria as páginas fora de ordem.

## [2026-07-24] Crediário — pagamento de item sincronizado ao pedido

**Agente/Modelo:** Codex (GPT-5)
**Objetivo:** Fazer o pagamento de unidades no Crediário refletir no pedido sem criar um segundo desconto no saldo.
**Arquivos alterados:** `src/components/admin/pagamento/ModalFormaPagamentoItens.tsx`, `src/components/admin/pagamento/pagamentoItens.ts`, `src/components/admin/ModalDetalhesPedido.tsx`, `src/features/crediario/components/PainelCrediario.tsx`, `scripts/migrations/20260724_pagamento_item_crediario_sincronizado.sql`, `UI.md`, `Progress.md`.
**O que foi feito:**
- Extraído o seletor real de quantidade e forma de pagamento para componente compartilhado; no Crediário ele oferece PIX, Dinheiro e Cartão.
- Adicionada a RPC `registrar_pagamento_item_crediario`, aplicada via Management API: bloqueia o consumo, valida o snapshot, reduz somente as unidades quitadas e grava `pagamentos_pedido` na mesma transação.
- O pagamento livre da conta foi preservado como fluxo separado.
**Decisões tomadas:** A RPC não cria `crediario_movimentos.tipo='pagamento'` e não altera `pedidos.forma_pagamento`; isso evita desconto duplicado e o cancelamento indevido do consumo pelo trigger existente.
**Verificação:** `npx tsc --noEmit` ✓ 0 erros · função confirmada ao vivo pela Management API · `npm run lint` indisponível no repositório (Next 16 interpreta `lint` como diretório).
**Pendências / próximos passos:** Validar manualmente, no admin, uma quitação parcial e uma total de item que possua taxa de entrega no mesmo consumo.
**Armadilhas descobertas:** Há consumos cujo `valor` excede a soma dos itens (taxas/ajustes); a RPC preserva o saldo residual ao quitar o último item, em vez de cancelar o movimento.

## [2026-07-24] Crediário — quitar conclui o pedido (migration aplicada)

**Agente/Modelo:** Claude Opus 4.8
**Objetivo:** Pedido salvo com forma de pagamento crediário continuava marcado como "Crediário" mesmo após a quitação. Ao quitar, deve virar "Concluído" no card.
**Arquivos alterados:** `scripts/migrations/20260724_crediario_concluir_pedidos.sql` (novo, **aplicado em produção** via Management API), `Progress.md`.
**Causa raiz:** `quitar_crediario` só inseria o pagamento e zerava a conta — **nunca escrevia em `pedidos`**; e nenhum trigger faz o caminho crediário → pedido. Como o card deriva o selo de `forma_pagamento` + status da conta (`pedidoEmCrediario` em `CardPedido.tsx`), o pedido ficava "Crediário" para sempre.
**Armadilha tratada:** `trigger_sincronizar_pedido_crediario` dispara em `UPDATE OF forma_pagamento` e **cancela o consumo** quando a forma deixa de casar com `%credi%`. Trocar para "Concluído" sem proteção deixaria o pagamento da quitação sozinho → **saldo negativo** na conta.
**O que foi feito (2 funções, 1 migration):**
- `quitar_crediario`: após zerar a conta, `update public.pedidos set forma_pagamento='Concluído'` para os pedidos com consumo ativo daquela conta. Statement único (locks atômicos, regra `lock-deadlock-prevention`), por último na transação, idempotente (`and pedido_usa_crediario(p.forma_pagamento)`). Também passa a concluir no caminho `saldo <= 0` (antes retornava cedo).
- `sincronizar_pedido_crediario`: não cancela consumo cuja conta já está `quitado` (evita o saldo negativo).
**Decisão (via skill `supabase-postgres-best-practices`):** feito **no banco**, não no app — atômico na mesma transação (app-side seria 2º round-trip que pode falhar após o RPC), fonte única para qualquer chamador, e não amplia a superfície da anon key (§Segurança). Índices já existentes (`idx_crediario_movimentos_conta_data`, `idx_crediario_movimentos_pedido`) cobrem o join; nenhum índice novo.
**Verificação:** migration aplicada com sucesso; `pg_get_functiondef` confirma as duas alterações nas funções em produção.
**Backfill (autorizado e aplicado):** `scripts/migrations/20260724_crediario_backfill_pedidos_concluidos.sql` — concluiu **107 pedidos** de contas já quitadas. Verificação pós-backfill:
- pedidos quitados ainda marcados como crediário: **107 → 0** ✓
- contas com saldo negativo: **17 → 17** (inalterado — backfill não danificou nada) ✓
- consumos desses 107 pedidos: **107 ativos, 0 cancelados** ✓ (a guarda no trigger funcionou)
- das 61 contas envolvidas, só **3** têm saldo ≠ 0 (todas negativas, do grupo pré-existente; soma −R$ 1.056,00)

**Pendência / achado (NÃO corrigido, precisa de decisão):**
- **17 contas com `saldo_atual` negativo** (pré-existente, anterior a esta correção). Provável causa: consumo cancelado com o pagamento mantido — exatamente o cenário que a nova guarda impede daqui pra frente. Precisa de decisão sobre como reconciliar (estorno, ajuste ou reativar o consumo).
**Armadilhas:** não trocar `forma_pagamento` para um valor sem "credi"/"fiado"/"conta" sem a guarda no trigger, sob pena de zerar o consumo e negativar a conta.

## [2026-07-23] Onboarding — módulo Painel (Kanban de produção)

**Agente/Modelo:** Claude Opus 4.8
**Objetivo:** Terceiro tour: Painel de produção (`/admin/painel`), ensinando o quadro Kanban de ponta a ponta.
**Arquivos alterados:**
- Novos: `onboarding/demo/painel-demo-store.ts`, `onboarding/demo/PainelDemoBridge.tsx`, `onboarding/config/painel.ts`.
- Tocados: `onboarding/config/index.ts`, `onboarding/index.ts`, `onboarding/components/onboarding-root.tsx`, `src/app/admin/painel/page.tsx`, `src/components/admin/painel/CardPedidoKanban.tsx`, `UI.md`, `Progress.md`.
**O que foi feito:**
- Tour de 11 etapas: problema → benefício → resumo/contadores → as 3 colunas → o card de exemplo → avançar status → menu ⋯ → arrastar → atalhos de coluna (mobile) → busca → conclusão.
- **Pedido de exemplo client-side** injetado no topo da coluna "Em análise" do board REAL (`pedidosNovos`), com itens/total/canal coerentes.
- **Blindagem central**: helper `comGuardaDemo` embrulha os 7 handlers do board (detalhes, avançar, mover, editar, apagar, imprimir, confirmar pagamento) — no pedido de exemplo mostram toast e **não tocam o banco**. As três colunas usam `acoesBoard`.
- Âncoras `data-onboarding` no page (resumo/busca/pills/board) e no `CardPedidoKanban` **condicionais ao id demo** (card/avançar/menu/arrastar), sem afetar cards reais.
**Decisões:** mesmo padrão de Crediário/Finanças — dado de exemplo client-side alimentando a UI real (AGENTS §0.2.5/§0.2.6). Guardas centralizadas num helper em vez de editar cada handler (diff menor, menos risco de esquecer um caminho).
**Verificação:** `npx tsc --noEmit` ✓ (0 erros). Lint não executável no repo (pré-existente). Sem teste de browser (AGENTS §3.4).
**Pendências:** smoke: iniciar pelo Ajuda em `/admin/painel`, ver o card de exemplo na 1ª coluna, testar avançar/menu (toast) e conferir que some ao concluir.
**Armadilhas:** `handleDragEnd` procura o pedido no estado `pedidos` — o demo NÃO está lá, então arrastar o card de exemplo é inócuo por construção (não precisa de guarda extra). `totalAtivos` e o contador da 1ª coluna incluem o demo enquanto o tour roda.

## [2026-07-23] Onboarding — módulo Finanças completo (com Diárias)

**Agente/Modelo:** Claude Opus 4.8
**Objetivo:** Segundo tour do onboarding: Finanças completo, incluindo a área de Diárias.
**Arquivos alterados:**
- Novos: `onboarding/demo/financas-demo-store.ts`, `onboarding/demo/FinancasDemoBridge.tsx`, `onboarding/config/financas.ts`.
- Tocados: `onboarding/config/index.ts` (registro), `onboarding/index.ts` (exports), `onboarding/components/onboarding-root.tsx` (monta o bridge), `PainelFinancas.tsx` (âncoras), `PainelDiarias.tsx` (âncoras + diária de exemplo + guardas), `UI.md`, `Progress.md`.
**O que foi feito:**
- Tour de 16 etapas cobrindo o módulo inteiro: lucro + ocultar valores → Receitas / Despesas / Salário → cards recebido×pago → período e filtros rápidos → lista de lançamentos → **Diárias** → Análise/Pagamentos → conclusão.
- **Diárias**: etapa de troca de aba com **demonstração ao vivo** (o tour clica em "Diárias" pelo usuário, via `demo.actions` + `advanceOn: element-visible`), depois ensina Nova diária, o calendário e a alternância calendário×lista.
- **Diária de exemplo client-side** injetada no calendário/lista **reais** do `PainelDiarias` (`diariasComDemo`), com data de hoje; contagem/total do header a incluem quando visível. Exclusão (detalhe e lista) blindada por `DIARIA_DEMO_ID` → **nada é gravado ou removido em `financas_diarias`/`movimentacoes_caixa`**.
- Âncoras `data-onboarding` adicionadas sem alterar lógica financeira (só atributos e um wrapper na lista).
**Decisões:** segui o padrão do Crediário — dado de exemplo client-side alimentando a UI real (AGENTS §0.2.5/§0.2.6), sem componente paralelo. Etapas dependentes de aba usam `skipIfMissing` para degradar sem travar.
**Verificação:** `npx tsc --noEmit` ✓ (0 erros). Lint não executável no repo (pré-existente). Sem teste de browser (AGENTS §3.4).
**Pendências:** smoke no browser: iniciar pelo botão Ajuda em `/admin/financas`, usar "Abrir as Diárias para mim", conferir a diária de exemplo no dia de hoje e que ela some ao concluir.
**Armadilhas:** a diária de exemplo só aparece quando o mês exibido contém a data de hoje (se o usuário navegar para outro mês, ela some — proposital). O seletor da demo usa `aria-label="Diárias"` dentro de `financas-toggle-principal`.

## [2026-07-23] Onboarding Crediário — ROOT CAUSE: modal Radix/vaul matava os cliques do tour

**Agente/Modelo:** Claude Opus 4.8
**Objetivo:** O tour continuava sem avançar ao abrir o modal (as correções anteriores de dismiss/z-index não resolveram). Achar a causa real.
**Root cause (real):** `Dialog`/`Drawer` são **`modal` por padrão**. O Radix `DismissableLayer` com `disableOutsidePointerEvents` aplica **`pointer-events: none` no `<body>`** e só o conteúdo do modal fica clicável — além de prender o foco e marcar o resto como `aria-hidden`. Como o popover/sheet do tour é renderizado FORA do modal, ele ficava **visível porém morto**: clicar em "Avançar" não fazia nada ("não avança"), e o tour travado gerava a sensação de "abre algo por baixo" e de "div incorreta".
**Arquivos alterados:** `components/tour-popover.tsx`, `components/tour-mobile-sheet.tsx`, `PainelCrediario.tsx`, `Progress.md`.
**O que foi feito:**
- `pointer-events-auto` no popover (desktop) e no slider (mobile) — necessário para receber clique sob qualquer modal da aplicação (correção geral do engine, não só do crediário).
- `modal={false}` no Dialog **apenas** enquanto a conta é a de exemplo: sem trava de pointer-events, sem focus trap, sem `aria-hidden`. Fora do tutorial nada muda.
- Popover com modal aberto passa a fixar no canto **inferior esquerdo** (antes superior direito) — no topo-direito ele cobria exatamente os botões Receber/Quitar/PDF que o tour ensina.
- Mobile: slider com `max-h-[52dvh]`, corpo rolável e `safe-area-inset-bottom` — o modal real no mobile é um Drawer alto e o slider não pode comer a tela.
**Verificação:** `npx tsc --noEmit` ✓ (0 erros). **Sem verificação em browser** — AGENTS §3.4 proíbe teste de browser/Playwright neste repo; validação de runtime é do usuário.
**Armadilhas:** qualquer UI de onboarding renderizada fora de um modal PRECISA de `pointer-events-auto`, senão fica inerte enquanto um `Dialog`/`Drawer` estiver aberto. Não basta z-index.

## [2026-07-23] Onboarding Crediário — fix: modal fechava ao interagir com o tour

**Agente/Modelo:** Claude Opus 4.8
**Objetivo:** Corrigir bugs relatados (ui-review): abrir o modal "abria algo por baixo" e não avançava; ao interagir, o modal fechava (devia ficar aberto). Melhorar o mobile.
**Arquivos alterados:** `src/components/ui/dialog.tsx` (prop `dismissible` → vaul), `PainelCrediario.tsx` (modal demo: `dismissible={false}`, `onInteractOutside`/`onEscapeKeyDown` preventDefault, X oculto), `Progress.md`.
**Root cause:** o modal real é Radix Dialog (desktop) / Drawer vaul (mobile). Ambos fecham em "interação externa" — clicar no popover/sheet do tour (que fica fora do modal) disparava o fechamento, quebrando os passos `modal-*` (alvo sumia → "não avança"/"div incorreta").
**O que foi feito:**
- Enquanto a conta é a de exemplo (`CONTA_DEMO_ID`), o modal só é controlado pelo tour: `preventDefault` em interação externa/ESC (desktop) + `dismissible={false}` (mobile vaul) + botão X do header oculto.
- O modal aberto é detectado como dialog (via `role="dialog"`, nas duas superfícies) → o tour esconde o spotlight e fixa o popover no canto: **modal real 100% visível** enquanto ensina (sem "abrir por baixo").
- Mobile: modal = Drawer vaul (bottom, botões no topo); sheet do tour no rodapé não cobre os botões; sem fechar por arraste durante o tutorial.
**Verificação:** `npx tsc --noEmit` ✓ (0 erros). Lint não executável no repo (pré-existente).
**Pendências:** smoke no browser (desktop + mobile): abrir a conta demo pelo tour, avançar por todos os passos do modal sem ele fechar, quitar (vira Quitado), PDF/toast, concluir (modal fecha e conta some).
**Armadilhas:** `ui/dialog.tsx` é responsivo — no mobile é **Drawer vaul**, não Radix. Prevenir fechamento exige `dismissible` (vaul) + `onInteractOutside`/`onEscapeKeyDown` (Radix). Não marcar o modal como `data-onboarding-ui` (deixá-lo ser "foreign" é o que faz o tour sair da frente e mostrar o modal inteiro).

## [2026-07-23] Onboarding Crediário — REUSAR o modal real (remoção do paralelo)

**Agente/Modelo:** Claude Opus 4.8
**Objetivo:** Correção pedida pelo usuário: o tutorial criava um modal paralelo — proibido. Deve reusar o MODAL REAL do Crediário (AGENTS §5). Também: sem auto-start; corrigir linha branca do Sheet.
**Arquivos alterados:**
- Removidos: `demo/CrediarioDemoRow.tsx`, `demo/CrediarioDemoModal.tsx` (UI paralela).
- `demo/crediario-demo-store.ts` (conta + consumos + flag `modalAberto`), `demo/CrediarioDemoBridge.tsx`, `config/crediario.ts` (10 etapas, `autoStart:false`, alvos do modal real), `index.ts`, `components/onboarding-root.tsx`, `components/help-panel.tsx` (`border-0`).
- `PainelCrediario.tsx`: injeta a conta demo em `contasFiltradas`; `contaSelecionada`/`contaPagamento`/efeito de movimentos reconhecem `CONTA_DEMO_ID`; efeito sincroniza `modalAberto`→abre/fecha o **modal real**; guardas em quitar/pagamento/PDF/cancelar/apagar (nada no banco); âncoras `data-onboarding` condicionais na linha, no ⋯ e nos botões do modal.
**O que foi feito:**
- A conta de exemplo agora é uma linha real no topo da lista; clicar abre o **modal real** da tela. O tour ensina dentro dele: visão (saldo/pedidos/pagamentos), Receber, Quitar (vira Quitado/R$0 na hora) e PDF — tudo simulado, **zero Supabase**.
- Etapa nova "menu ⋯" (dropdown) antes de abrir o modal.
- `autoStart:false` (só abre pelo botão Ajuda). Linha branca do Sheet corrigida (`border-0`).
**Decisões:** conta demo mapeada para `ContaCrediario`/`MovimentoCrediario` dentro do PainelCrediario (tipos moram lá); ciclo de vida do modal via flag `modalAberto` na store + efeito no painel (o engine segue genérico).
**Verificação:** `npx tsc --noEmit` ✓ (0 erros). Lint não executável no repo (pré-existente).
**Pendências:** smoke no browser — abrir a conta demo, quitar (Quitado/R$0), PDF/toast, e **confirmar que nenhuma linha é gravada em `crediario_contas`/`crediario_movimentos`** (via Management API, contar linhas `origem='tutorial'` = 0).
**Armadilhas:** linha 765 do PainelCrediario zera a seleção se a conta não estiver em `contasFiltradas` — por isso a conta demo é injetada lá (sempre no topo, mesmo quitada). NÃO reintroduzir modal paralelo (proibido pelo usuário / AGENTS §5).

## [2026-07-23] Onboarding Crediário — modal responsivo no mobile

**Agente/Modelo:** Claude Opus 4.8
**Objetivo:** Corrigir colisão no mobile — o modal de exemplo (centralizado) se sobrepunha ao slider inferior do tour.
**Arquivos alterados:** `demo/CrediarioDemoModal.tsx`, `config/crediario.ts`, `Progress.md`.
**O que foi feito:**
- Modal de demo agora é **responsivo**: no mobile ancora no TOPO (`inset-x-3 top-3 max-h-[56vh]`) com layout header (shrink-0) / corpo rolável (`overflow-y-auto`) / rodapé fixo com 3 botões em grid — deixa a metade de baixo livre para o slider do tutorial. No desktop segue centralizado.
- Rodapé compacto (ícone + rótulo curto, 3 colunas) para caber sem rolar no mobile.
- Etapa "abrir" passa a destacar o **card inteiro** (`data-onboarding="demo-card"`, placement bottom) em vez do botão pequeno — mais claro no toque.
**Verificação:** `npx tsc --noEmit` ✓ (0 erros).
**Armadilhas:** z-index mantido (modal 9985 < spotlight 9990 < slider 9995). No mobile, modal ocupa topo (~56vh) e slider ocupa base — não se sobrepõem.

## [2026-07-23] Onboarding Crediário — modal interativo + ajustes de UX

**Agente/Modelo:** Claude Opus 4.8
**Objetivo:** Tornar a conta de exemplo clicável e ensinar DENTRO do modal (abrir, registrar pagamento, quitar, gerar PDF) e pelo menu ⋯; desligar auto-start; remover a linha branca do Sheet.
**Arquivos alterados:**
- Novos: `src/features/onboarding/demo/{CrediarioDemoRow,CrediarioDemoModal}.tsx`.
- Reescritos: `demo/crediario-demo-store.ts` (agora com consumos + estado do modal + pagamento/quitação), `demo/CrediarioDemoBridge.tsx` (abre modal nas etapas `modal-*`), `config/crediario.ts` (10 etapas + `autoStart:false`), `index.ts` (exporta `CrediarioDemoRow`).
- Tocados: `components/onboarding-root.tsx` (monta `CrediarioDemoModal`), `components/help-panel.tsx` (`border-0` → some a linha branca), `PainelCrediario.tsx` (bloco inline da demo → `<CrediarioDemoRow />`), `UI.md`.
**O que foi feito:**
- Conta de exemplo virou **card clicável** (mobile e desktop) com botão "Abrir" e menu ⋯ (ver detalhes / registrar pagamento / quitar).
- **Modal de demonstração client-side** espelhando o real: consumos item a item, saldo, e botões Registrar pagamento / Quitar tudo / Gerar PDF — todos simulados (toast/store), **zero Supabase**. Fica em z abaixo do spotlight, então os destaques do tour recortam os botões dentro do modal.
- Tour ensina o ciclo dentro do modal (`modal-visao` → `modal-pagamento` → `modal-quitar` → `modal-pdf`) e depois o atalho pelo ⋯.
- **Auto-start desligado**: o tutorial só abre pelo botão Ajuda.
- Linha branca do Sheet corrigida (`border-0` via twMerge sobrepõe o `border-l` da variante `side=right`).
**Decisões:** modal de demo é um `motion.div` próprio (não Radix Dialog) para não brigar com focus-trap nem com o `useForeignDialog`; wrap `data-onboarding-ui` para não ser tratado como modal alheio.
**Verificação:** `npx tsc --noEmit` ✓ (0 erros). Lint segue não executável no repo (sem config ESLint / `next lint` quebrado — pré-existente).
**Pendências:** smoke no browser (abrir card → modal → quitar vira Quitado/R$0 → PDF/toast → menu ⋯; mobile Sheet; verificar que nada é gravado no banco).
**Armadilhas:** o bridge abre/fecha o modal por `stepId`; z-index: modal 9985 < spotlight 9990 < popover 9995 (ordem necessária para o recorte funcionar sobre o modal).

## [2026-07-23] Onboarding interativo (aulas dos módulos) — Crediário

**Agente/Modelo:** Claude Opus 4.8
**Objetivo:** Replicar o onboarding do Juridiq (sem vídeos, sem "IA faz por você"): central de Ajuda com catálogo de módulos + tour guiado com spotlight; 1º módulo completo = Crediário.
**Arquivos alterados:**
- Novos: `src/features/onboarding/` — `types.ts`, `storage.ts`, `progress.ts`, `registry.ts`, `context.tsx`, `index.ts`; `engine/{dom,route-match,element-tracker,positioning,use-foreign-dialog,demo-runner}.ts`; `components/{spotlight,tour-popover,tour-mobile-sheet,step-content,tour-renderer,help-button,help-panel,module-catalog,onboarding-root}.tsx`; `demo/{crediario-demo-store.ts,CrediarioDemoBridge.tsx}`; `config/{index,crediario}.ts`.
- Tocados: `src/app/admin/layout.tsx` (monta `OnboardingProvider` + `OnboardingRoot`); `src/features/crediario/components/PainelCrediario.tsx` (âncoras `data-onboarding` + linha da conta demo no topo); `AGENTS.md` (§0.2.5 regra do dado demo), `UI.md` (§Onboarding), `Progress.md`.
**O que foi feito:**
- Engine config-driven: spotlight com **overlay escuro + recorte** (SVG mask, `pointer-events:none` → tela clicável) e anel pulsante; popover que se reposiciona (desktop) e slider inferior (mobile, `useIsMobile`); continuidade entre rotas + auto-start na 1ª visita.
- Central **Ajuda**: pílula flutuante → `Sheet` (lateral desktop / inferior mobile) com "Ver tutorial desta tela", "Ver todos os treinamentos" (catálogo por grupo da sidebar via `GRUPOS_MENU_ADMIN`, status Concluído/Continuar/Iniciar/Em breve) e card de progresso.
- Progresso em **localStorage por usuário** (`useAdminAuth().usuarioAtual?.id`); sem tabela nova (sem migração coordenada).
- **Dado de demonstração 100% client-side** (regra registrada): store externa injeta uma conta de crediário FALSA como alvo da div interativa; `CrediarioDemoBridge` cria ao iniciar, marca "Quitado" na etapa e remove ao encerrar. **Zero escrita no Supabase.**
- Tour Crediário: problema → benefício → onde se cria (Pedidos/Fiado) → analisar conta a conta → buscar → filtrar → quitar → próximo passo.
**Decisões tomadas (confirmadas pelo usuário):** localStorage (não tabela); dado falso client-side (não grava banco); spotlight COM overlay/recorte; sem feature de IA. Sem deps novas. `demo-runner` (cursor) mantido para "Ver na prática".
**Verificação:** `npx tsc --noEmit` ✓ (0 erros). `npm run lint`: **não executável no repo** — não há config ESLint e `next lint` está quebrado no Next 16 (falha pré-existente, ver entradas anteriores); não é efeito desta mudança.
**Pendências / próximos passos:** smoke no browser (abrir `/admin/crediario`, iniciar tour, ver a conta demo, quitar, concluir, checar remoção; testar mobile Sheet e o painel Ajuda). Criar `config/*` dos demais módulos (hoje "Em breve" no catálogo).
**Armadilhas descobertas:**
- Repo **sem ESLint config**; verificação real é só `tsc --noEmit`.
- Estilo do repo: **sem ponto e vírgula**, aspas simples, `@/` alias (Juridiq original usa `;` — não copiar).
- A conta demo é renderizada **acima** do bloco loading/vazio do PainelCrediario para aparecer mesmo sem dados reais; alvo `data-onboarding="conta-demo"`.
- Etapa "onde se cria" mira `a[href="/admin/pedidos/novo"]` com `skipIfMissing` (no mobile a sidebar é Drawer fechado → a etapa pula sozinha).

## [2026-07-23] Garçons — accordion + troca de ícones

**Agente/Modelo:** Cursor Grok 4.5  
**Objetivo:** Remover UtensilsCrossed/Package ruins; lista mobile em accordion com Ver pedidos; ícones de canal melhores (Lucide).  
**Arquivos alterados:** `ListaGarcons.tsx`, `PedidosCriadosGarcom.tsx`, `UI.md`, `Progress.md`  
**O que foi feito:** Accordion com `AvatarUsuario` + métricas + CTA Ver pedidos; pedidos usam `Bike` / `ShoppingBag` / `UserRound` (sem Package/Store/Truck genéricos).  
**Verificação:** `npx tsc --noEmit` ✓  

## [2026-07-23] Garçons — dia 3h, vendas e UI densa

**Agente/Modelo:** Cursor Grok 4.5  
**Objetivo:** Corrigir criados/editados/hoje (query usava meia-noite); mostrar vendas do dia; valor total na tela de pedidos; UI densa Juridiq.  
**Arquivos alterados:** `src/lib/dia-operacional.ts`, `PainelGarcons.tsx`, `ListaGarcons.tsx`, `tipos.ts`, `PedidosCriadosGarcom.tsx`, `UI.md`, `Progress.md`  
**O que foi feito:**
- `obterIntervaloDiaOperacionalAtual` em America/Sao_Paulo com corte **03:00→03:00** (antes Painel usava 00:00 e zerava métricas).
- Métricas: criados/editados do dia + **vendas R$** + ticket; header com vendas da equipe.
- Lista: ordenação vendas/pedidos/nome; mobile em linhas densas (barra + UtensilsCrossed).
- Pedidos do garçom: default `hoje`; KPI **Vendas** = soma do filtro (exclui cancelado/aguardando), não da página; cards mobile densos por canal.
**Verificação Management API:** meia-noite=0 vs corte 3h=44 pedidos com `garcom_id`; Dilma 21/R$409, Luciane 13/R$339, Bom Parto 9/R$123.  
**Verificação:** `npx tsc --noEmit` ✓  
**Armadilhas:** análise diária usa corte **10h**; garçons/salão usam **3h** via `dia-operacional.ts` — não misturar.

## [2026-07-23] Análise Diária — correção UI (anti cards) + audit queries

**Agente/Modelo:** Cursor Grok 4.5  
**Objetivo:** Remover grid de metric cards (viola UI.md/Juridiq); KPIs inline Crediário; melhorar ranking de produtos; auditar schema/queries.  
**Arquivos alterados:** `FaixaKpiAnalise`, `page.tsx`, relatórios (canais/produtos/pagamentos/bairros/equipe/cancelamentos/taxas/fiado), `useAnaliseDiaria`, `processadores`, `types`, `UI.md`, `Progress.md`  
**O que foi feito:**
- KPIs voltam à faixa inline no header (4 métricas: faturamento/pedidos/ticket/entregas) — sem cards com ícone.
- Produtos: tabela densa com pedidos distintos, % receita e barra de participação; aberto por default.
- Canais/listas: `divide-y` em vez de mini-cards.
- Pagamentos: payload por `pedido_id` do dia (não `pagamentos_pedido.created_at`).
- Management API (`edienai` / `bawysvqqeqwxasmggfcn`): colunas `garcom_id`, `crediario_movimentos.tipo/status/origem/valor` confirmadas; fiado `consumo+ativo+origem=pedido` coerente.
**Verificação:** `npx tsc --noEmit` ✓  
**Armadilhas:** UI.md §admin mobile: “Evitar grid de metric cards”; §anti-padrões: não empilhar cards por métrica.

## [2026-07-23] Renovação Análise Diária (Juridiq)

**Agente/Modelo:** Cursor Grok 4.5  
**Objetivo:** Tela `/admin/analise-diaria` densa e útil, visual Juridiq, seletor de data sem clipping, relatórios em accordion.  
**Arquivos alterados:** `src/app/admin/analise-diaria/page.tsx`, `src/features/analise-diaria/**`, `UI.md`, `Progress.md`  
**O que foi feito:**
- Extraído `useAnaliseDiaria` + tipos/processadores (queries enriquecidas: cancelados, comparativo −1/−7d, taxas, `garcom_id`, fiado).
- `SeletorDiaOperacional` com Popover + grade mensal (`date-fns`); header sem `overflow-hidden`.
- `FaixaKpiAnalise` (ícones Lucide) + `SecaoRelatorio` accordion local (defaults: canais + pagamentos abertos).
- Relatórios refinados + novos: cancelamentos, comparativo, taxas entrega, equipe/PDV, fiado do dia.
**Decisões:** sem deps novas; sem tocar Finanças/Caixa; accordion sem Radix Accordion; calendário sem `react-day-picker`.  
**Verificação:** `npx tsc --noEmit` ✓ · `npm run lint` falha pré-existente (`next lint` → diretório `lint` inválido)  
**Pendências:** smoke no browser (Popover, trocar dia, accordions, dia operacional pré-10h).  
**Armadilhas:** seleção de data no calendário deve fixar 12:00 (não usar `obterDiaTrabalhoReferencia` em meia-noite — desloca o dia).

## [2026-07-20] Fix Suspense useSearchParams /admin/pedidos

**Agente/Modelo:** Cursor Grok 4.5  
**Objetivo:** Corrigir build Vercel: `useSearchParams()` sem Suspense em `/admin/pedidos`.  
**Arquivos alterados:** `src/app/admin/pedidos/page.tsx`, `Progress.md`  
**O que foi feito:** `PedidosContent` com deep-link `?pedido=` envolvido em `<Suspense>` (mesmo padrão de `/admin/pedidos/novo`).  
**Verificação:** `npx tsc --noEmit` ✓  

## [2026-07-20] Crediário → Pedidos deep-link

**Agente/Modelo:** Cursor Grok 4.5  
**Objetivo:** Do modal de Crediário, abrir o pedido em `/admin/pedidos` com ModalDetalhesPedido; edição via fluxo existente (refletir no crediário).  
**Arquivos alterados:** `src/features/crediario/components/PainelCrediario.tsx`, `src/app/admin/pedidos/page.tsx`, `Progress.md`, `UI.md`  
**O que foi feito:**
- Botão “Abrir pedido” em consumos com `pedido_id` → `/admin/pedidos?pedido=<uuid>` (fecha modal da conta).
- Consumo sem vínculo: botão desabilitado (legado/migração).
- Pedidos lê `?pedido=`, abre `ModalDetalhesPedido` e limpa a URL com `replace`.
**Decisões:** sem DDL; sync permanece em triggers/RPC + realtime existentes.  
**Verificação:** `npx tsc --noEmit` ✓  
**Pendências:** smoke browser; dump Management API completo se houver token do projeto Edienai.  
**Armadilhas:** ~781 consumos sem `pedido_id` não abrem pedido.

## [2026-07-20] Usuários Cliente UI Juridiq + modal 2 colunas

**Agente/Modelo:** Cursor Grok 4.5  
**Objetivo:** Polir tela de usuários cliente (não sistema) e modal de detalhes no padrão Crediário (2 colunas); WhatsApp com ícone real.  
**Arquivos alterados:** `src/components/admin/GerenciadorUsuariosClientes.tsx`, `src/app/admin/usuarios/page.tsx`, `Progress.md`, `UI.md`  
**O que foi feito:**
- Lista: faixa de resumo, busca + pills, tabela/cards Juridiq, `MenuAcoes`, paginação 15.
- Modal detalhes: Dialog full-height `p-0`, grid 2 colunas (`lg:grid-cols-[minmax(0,1fr)_1px_26rem]`) — histórico à esquerda, contato/resumo à direita.
- WhatsApp: `IconeWhatsApp` (verde `#25D366`) no menu, header do modal e CTA lateral.
- Shell `/admin/usuarios`: header Juridiq + tabs sem padding duplicado; aba sistema intocada.
**Decisões:** só clientes no escopo; sistema permanece como estava.  
**Verificação:** `npx tsc --noEmit` ✓  
**Pendências:** smoke no browser (lista, detalhes desktop 2 cols, WhatsApp, editar).  
**Armadilhas:** nenhuma.

## [2026-07-20] Caixa operacional + extrato Juridiq

**Agente/Modelo:** Cursor Grok 4.5  
**Objetivo:** Caixa como gaveta do dia (A) + extrato leve estilo Crediário; Finanças intocada.  
**Arquivos alterados:** `scripts/20260720_caixa_operacional_gaveta.sql`, `src/lib/caixa-gaveta.ts`, `src/lib/tipos-caixa.ts`, `src/lib/useCaixa.ts`, `src/app/admin/caixa/page.tsx`, modais em `src/components/admin/caixa/`, `Progress.md`, `UI.md`, `PRD.md`  
**O que foi feito:**
- SQL (Management API): categorias Sangria/Suprimento; `caixas.fechamento_formas jsonb`; índice `(caixa_id, created_at DESC)`.
- Domínio: saldo gaveta = dinheiro; fechamento confere dinheiro contado vs esperado; PIX/cartão informativos; `registrarSangria`/`registrarSuprimento`.
- UI Juridiq: header + tabs Hoje/Pedidos/Extrato; tabela extrato com Wallet/CheckCircle2 (padrão Crediário); Dialogs Abrir/Fechar/Sangria/Suprimento.
**Decisões:** Finanças sem diff; gaveta só Dinheiro.  
**Verificação:** `npx tsc --noEmit` ✓ · índices/categorias via Management API ✓  
**Pendências:** saldos/relatórios satélite sem redesign profundo.  
**Armadilhas:** movimentos sem `caixa_id` (Finanças) não entram no saldo da gaveta.

## [2026-07-20] Painel Kanban: desktop full-width

**Agente/Modelo:** Cursor Grok 4.5  
**Objetivo:** Com 3 colunas, desktop deve preencher 100% da largura; mobile permanece snap horizontal.  
**Arquivos alterados:** `ColunaKanban.tsx`, `painel/page.tsx`, `CardPedidoKanban.tsx`, `UI.md`, `Progress.md`  
**O que foi feito:**
- Coluna: mobile `w-[min(88vw,320px)] shrink-0 snap`; `md+` → `flex-1 min-w-0` sem snap.
- Board: `md:overflow-x-hidden md:snap-none w-full`.
- Cards/coluna com espaçamento um pouco maior no desktop; pills mobile usam `tituloCurto`.
**Verificação:** `npx tsc --noEmit` ✓  
**Pendências:** nenhuma  
**Armadilhas:** nenhuma

## [2026-07-20] Painel Kanban estilo Juridiq (mobile-first)

**Agente/Modelo:** Cursor Grok 4.5  
**Objetivo:** Alinhar `/admin/painel` ao kanban de Tarefas da Juridiq — board horizontal, cards densos e UX mobile.  
**Arquivos alterados:** `src/app/admin/painel/page.tsx`, `src/components/admin/painel/ColunaKanban.tsx`, `src/components/admin/painel/CardPedidoKanban.tsx`, `Progress.md`, `UI.md`  
**O que foi feito:**
- Board: `grid-cols-1` (empilhava 3 colunas no mobile) → scroll horizontal `snap-x` com colunas fixas ~320–350px (padrão Juridiq `w-[350px]`).
- Mobile: pills sticky de coluna + IntersectionObserver para destacar a coluna visível; `Mover →` no menu (alternativa ao drag).
- Cards: densos (`p-2.5`, borda-l por canal), `MenuAcoes` (imprimir/editar/mover/excluir), CTA único de avanço de status `h-9`.
- Coluna: badge colorido + contador circular; drop highlight com primary.
**Decisões:** sem `@hello-pangea/dnd` (deps novas proibidas); mantido DnD nativo + touch ghost.  
**Verificação:** `npx tsc --noEmit` ✓ · ReadLints ✓  
**Pendências / próximos passos:** densidade card/linha opcional se pedido.  
**Armadilhas:** overflow-x deve ficar no board interno (html/body bloqueiam overflow global).

## [2026-07-20] Corrigir métricas Criados/Editados/Total em Garçons


**Agente/Modelo:** Cursor Grok 4.5  
**Objetivo:** Corrigir queries de Criados hoje, Editados hoje e Total pedidos no painel de garçons, alinhadas ao schema real via Management API.  
**Arquivos alterados:** `src/components/admin/garcons/PainelGarcons.tsx`, `src/app/admin/pdv/page.tsx`, `Progress.md`  
**O que foi feito:**
- Causa: CHECK em `atividade_garcom.tipo_acao` só aceita `pedido_criado|pedido_modificado|item_adicionado|status_alterado`; PDV inseria `pdv_pedido` (falha silenciosa) → Dilma/Bom Parto com pedidos em `pedidos.garcom_id` e zero atividade.
- UI contava “Criados” só em `atividade_garcom` e “Total” em `pedidos` → inconsistente.
- **Criados hoje / Total** passam a vir de `pedidos` filtrado por `garcom_id` (janela “hoje” em America/Sao_Paulo).
- **Editados** = `atividade_garcom` com `pedido_modificado`, contagem distinta por `pedido_id`.
- PDV registra `tipo_acao: 'pedido_criado'` + `dados_extra.origem: 'pdv'`.
**Decisões:** Fonte canônica de criação = `pedidos.garcom_id` (cobre histórico PDV sem atividade); edição continua em atividade.  
**Verificação:** Management API ✓ (Dilma 13/0/433 hoje) · `npx tsc --noEmit` ✓  
**Pendências / próximos passos:** histórico de atividade PDV antigo não existe (métricas de criação já cobertas por `pedidos`).  
**Armadilhas descobertas:** não inventar `tipo_acao` fora do CHECK; meia-noite local do browser ≠ dia Brasília.

## [2026-07-20] Polish UI admin Adicionais (Juridiq)

**Agente/Modelo:** Cursor Grok 4.5  
**Objetivo:** Alinhar `/admin/adicionais` ao padrão visual Juridiq (header tipo bairros), sem mudar lógica.  
**Arquivos alterados:** `src/app/admin/adicionais/page.tsx`, `Progress.md`, `UI.md`  
**O que foi feito:**
- Shell `max-w-6xl space-y-5` + header card com `ListPlus` primary, contagem, Atualizar outline + Novo primary.
- Busca client por nome acima dos `FiltroChip`; empty via `@/components/ui/empty`.
- Lista mais densa, `min-w-0`/stack mobile; ações secundárias em `MenuAcoes` (vincular, crop, remover imagem, excluir).
- Loading com spinner `text-primary`; CTAs de dialogs com tokens primary (checkbox selecionado).
**Decisões:** Upload de foto permanece inline (ação frequente); crop/delete imagem no menu.  
**Verificação:** `npx tsc --noEmit` ✓ · lint do arquivo ✓  
**Pendências / próximos passos:** nenhuma  
**Armadilhas:** AdminLayout já tem `p-4 md:p-6` — não duplicar padding na page.

## [2026-07-20] Combos: polish Juridiq/admin

**Agente/Modelo:** Cursor Grok 4.5  
**Objetivo:** Polir `/admin/combos` no padrão Juridiq sem reescrever lógica de negócio.  
**Arquivos alterados:** `src/app/admin/combos/page.tsx`, `Progress.md`  
**O que foi feito:**
- Shell `max-w-6xl` + header card (Layers, count, Novo combo / Atualizar).
- Busca client-side por nome (`useMemo`); Empty + EmptyContent CTA.
- Cards densos com tokens (`border-border/70`, preço `text-primary`, hover `border-primary/40`); status via Badge; ações via `MenuAcoes`.
- Modal custom (framer-motion) → Dialog shadcn (drawer no mobile); Input/Label/Textarea/Checkbox; toasts sonner no lugar do modal de notificação.
**Verificação:** `npx tsc --noEmit` ✓ (zero erros em combos/page) · ReadLints ✓  
**Pendências / próximos passos:** nenhum  
**Armadilhas descobertas:** Dialog do projeto já é responsive (drawer no mobile); não recriar overlay fixed.

## [2026-07-20] Sidebar mobile: Mais abre inline (Vaul)

**Agente/Modelo:** Cursor Grok 4.5  
**Objetivo:** Dropdown/Popover "Mais" da sidebar admin abrir no drawer mobile.  
**Arquivos alterados:** `src/components/admin/AdminLayout.tsx`, `Progress.md`  
**O que foi feito:**
- Causa: Popover portaliza para `body` fora do Vaul Drawer → overlay/trap impede uso.
- Mobile: lista "Mais" expansível inline (sem portal); fecha drawer ao navegar.
- Desktop: Popover mantido com `modal={false}`.
**Verificação:** `npx tsc --noEmit` ✓ · eslint AdminLayout  
**Armadilhas:** Popover/Dropdown portaled dentro de Vaul Drawer não funciona — expandir inline ou portal com container do drawer.

## [2026-07-20] Migration financas_diarias aplicada

**Agente/Modelo:** Cursor Grok 4.5
**Objetivo:** Criar tabela `financas_diarias` + categoria Diária no projeto `bawysvqqeqwxasmggfcn`.
**Arquivos alterados:** nenhum de código (só SQL remoto) · `Progress.md`
**O que foi feito:** Management API executou `scripts/migrations/20260720_financas_diarias.sql`. Verify: tabela existe, 0 rows, categoria Diária ok; PostgREST 200.
**Verificação:** Management API ✓ · PostgREST `financas_diarias` 200 · `categorias_caixa` Diária 200
**Armadilhas:** token Management API não persistir no repo; token curto no env sem privilégio ≠ token válido.

## [2026-07-20] Diárias: CSS FC6 + calendário full-size

**Agente/Modelo:** Cursor Grok 4.5
**Objetivo:** Corrigir 500 (CSS inexistente) e calendário minúsculo em card aninhado.
**Arquivos alterados:** `CalendarioDiarias.tsx`, `PainelDiarias.tsx`, `PainelFinancas.tsx`, `globals.css`, `Progress.md`
**O que foi feito:**
- Removidos imports `@fullcalendar/*/index.css` (v6 injeta CSS via JS; arquivos não existem).
- Calendário sem card interno; altura 560–720px + `expandRows`; células maiores no CSS.
**Verificação:** `npx tsc --noEmit` ✓
**Armadilhas:** Nunca importar CSS de pacotes FC6; estilos vêm de `injectStyles`.

## [2026-07-20] Finanças: Diárias (calendário + despesa)

**Agente/Modelo:** Cursor Grok 4.5
**Objetivo:** Aba Diárias no mesmo nível de Lançamentos, calendário FullCalendar, lista e despesa vinculada.
**Arquivos alterados:** `PainelFinancas.tsx`, `PainelDiarias.tsx`, `CalendarioDiarias.tsx`, `ListaDiarias.tsx`, `ModalDiaria.tsx`, `useDiarias.ts`, `types.ts`, `globals.css`, migration SQL, `UI.md`, `PRD.md`, `Progress.md`, `package.json`
**O que foi feito:**
- Toggle Lançamentos | Diárias no card principal (não nas tabs de baixo); Diárias ocupa a tela.
- FullCalendar v6 (mês) + lista; modal Juridiq; detalhe em Dialog; mobile com CTA/toolbar densos.
- Tabela `financas_diarias` + categoria Diária; cada create = saída em `movimentacoes_caixa`.
**Verificação:** `npx tsc --noEmit` ✓ · migration Management API pendente (403 no ambiente; SQL em `scripts/migrations/20260720_financas_diarias.sql`)
**Armadilhas:** deps FullCalendar alinhadas em 6.1.21; CSS importado no componente + tokens em `.calendario-diarias`; Diárias fica no toggle do card principal, não nas tabs Análise/Pagamentos.

## [2026-07-20] Novo pedido barra fixa + sidebar personalizada sem flash

**Agente/Modelo:** Cursor Grok 4.5
**Objetivo:** Confirmar pedido não cobrir o Resumo; sidebar personalizada não “piscar” a ordem padrão ao navegar.
**Arquivos alterados:** `pedidos/novo/page.tsx`, `PainelTicketPedido.tsx`, `AdminLayout.tsx`, `Progress.md`
**O que foi feito:**
- Altura do shell desktop desconta a barra fixa (`100dvh - 104px - 5.5rem`); padding mobile maior; sticky do resumo sem sombra por cima do CTA.
- Config da sidebar em `sessionStorage` + `useLayoutEffect` (AdminLayout remonta a cada página) para pintar já na ordem personalizada; save otimista.
**Verificação:** `npx tsc --noEmit` ✓

## [2026-07-20] Novo pedido: polish Juridiq (UX + tokens)

**Agente/Modelo:** Cursor Grok 4.5
**Objetivo:** Tornar `/admin/pedidos/novo` fácil e consistente com o padrão Juridiq (desktop + mobile), sem mudar regra de negócio.
**Arquivos alterados:** `pedidos/novo/page.tsx`, `PainelCategoriasProduto.tsx`, `PainelTicketPedido.tsx`, `UI.md`, `Progress.md`
**O que foi feito:**
- Cards Cliente / Atendimento / Pagamento em tokens (`border-border/70`); removidos zinc/bordo/blue/purple e o `<select>` duplicado de tipo.
- Chip-resumo de atendimento + Trocar; stepper com label dinâmico; `carregarMesas` ao entrar na etapa Local.
- Catálogo 1-toque (padrão PDV) + Personalizar; abas com `focus-visible`.
- Prévia do carrinho na etapa Itens (mobile); resumo sticky no desktop; observação geral no insert.
- Highlight de campos inválidos (`aria-invalid` / ring) ao avançar/salvar.
**Verificação:** `npx tsc --noEmit` ✓ · ReadLints ✓
**Fora de escopo:** PDV, garçom, `GradeProdutosCategoria` morto.
**Armadilhas:** Não reintroduzir um segundo controle de `tipoEntrega` nos dados do cliente.

## [2026-07-20] Sidebar: scroll não reseta ao navegar

**Agente/Modelo:** Cursor Grok 4.5
**Objetivo:** Ao clicar item baixo da sidebar, o menu não deve “pular” pro topo.
**Arquivos alterados:** `AdminLayout.tsx`, `Progress.md`, `UI.md`
**O que foi feito:**
- Causa: `SidebarContent` era componente definido *dentro* do layout → identidade muda a cada render/pathname → React remonta o `<nav>` e zera o scroll.
- Troca para `renderSidebarContent(...)` (função de render, não componente).
- Backup: `sidebarNavRef` + `sidebarScrollTopRef` + `useLayoutEffect` restauram o scroll no desktop após troca de rota.
**Verificação:** `npx tsc --noEmit` ✓
**Armadilhas:** Não definir componentes React dentro de outro componente se o DOM interno precisa preservar estado (scroll, focus, inputs).

## [2026-07-20] Bairros: coluna entrega_gratis + toggle

**Agente/Modelo:** Cursor Grok 4.5
**Objetivo:** Corrigir PGRST204 e toggle “Grátis” invertido/desalinhado.
**Arquivos alterados:** `bairros/page.tsx`, `scripts/migrations/20260720_bairros_entrega_gratis.sql`, `Progress.md`
**O que foi feito:**
- Coluna `bairros.entrega_gratis boolean not null default false` criada via Management API (`bawysvqqeqwxasmggfcn`).
- Toggle refeito com `justify-start`/`justify-end` (sem `translate` absoluto); linha com `items-center`.
- Load normaliza `entrega_gratis`/`ativo` com `Boolean`.
**Verificação:** schema confirmado na API; `npx tsc --noEmit` ✓

## [2026-07-20] Produtos/Bairros/Mesas: tokens + ícones catálogo

**Agente/Modelo:** Cursor Grok 4.5
**Objetivo:** Corrigir cores antigas (Button bordo/zinc), polish Juridiq em Bairros e Mesas, ícones Produtos/Combos.
**Arquivos alterados:** `ui/button.tsx`, `admin-sidebar-routes.ts`, `bairros/page.tsx`, `mesas/page.tsx`, `combos/page.tsx`, `UI.md`, `Progress.md`
**O que foi feito:**
- `Button` → `primary` / `outline` com `border-border/70` / `destructive` (corrige modais e botões de Produtos e do admin inteiro).
- Sidebar: Produtos `CookingPot`, Combos `Layers`.
- Bairros reescrito com tokens, cards/header Juridiq, desktop tabela + ações densas no mobile.
- Mesas: zinc/amber → tokens semânticos (mantém HTML de impressão).
- Combos: limpeza bordo/zinc residual.
**Verificação:** `npx tsc --noEmit` ✓
**Ainda com zinc/bordo (fora deste escopo):** vários componentes em `anos-anteriores/`, caixa, cupons, etc.

## [2026-07-20] PDV: visual Juridiq (Geist + tokens)

**Agente/Modelo:** Cursor Grok 4.5
**Objetivo:** Tirar o PDV do visual “quadradão” com hex/JetBrains e alinhar à composição do admin/Juridiq.
**Arquivos alterados:** `src/app/admin/pdv/page.tsx`, `UI.md`, `Progress.md`
**O que foi feito:**
- Removidos JetBrains Mono e `pdvLightVars` (forçava tema claro e primary próprio).
- Hex (`#0f5bd8`, `#f7fbff`, etc.) → tokens (`primary`, `background`, `card`, `muted-foreground`, `destructive`, `border/70`).
- Tabs, cards de produto, header e superfícies com radius/hover mais leves; preços em `font-mono tabular-nums`.
**Verificação:** `npx tsc --noEmit` ✓
**Agente/Modelo:** Cursor Grok 4.5
**Objetivo:** Melhorar a sidebar fechada no padrão Juridiq.
**Arquivos alterados:** `AdminLayout.tsx`, `UI.md`, `Progress.md`
**O que foi feito:**
- Largura colapsada 64→112px (próximo aos 114px do Juridiq); aberta permanece 224px.
- Largura/margin via `--largura-sidebar-admin`.
- Ícones centralizados; ativo com barra absoluta + `bg-primary/10` (sem deslocar o ícone).
- Grupos com abreviação + divisores; rodapé com avatar + botões `size-10`; tooltips; sombra leve.
**Verificação:** `npx tsc --noEmit` ✓

## [2026-07-20] Sidebar: ícones distintos (usuários, crediário, finanças)

**Agente/Modelo:** Cursor Grok 4.5
**Objetivo:** Eliminar ícones repetidos na sidebar e diferenciar pessoas (funcionários / usuários / garçons).
**Arquivos alterados:** `admin-sidebar-routes.ts`, `AdminLayout.tsx`, `usuarios/page.tsx`, `Progress.md`, `UI.md`
**O que foi feito:**
- Crediário → `Coins`; Finanças → `Landmark`; Caixa permanece `Wallet`.
- Usuários → `UserCog`; Funcionários → `Contact`; Garçons permanece `UtensilsCrossed`.
- Produtos → `Package`; Adicionais → `ListPlus` (deixam de colidir com PDV / Novo pedido).
- Atalho Alt+U e header da página Usuários alinhados ao `UserCog`.
**Verificação:** `npx tsc --noEmit` ✓

## [2026-07-20] CardPedido visual Juridiq / restaurante

**Agente/Modelo:** Cursor Grok 4.5
**Objetivo:** Melhorar hierarquia e limpeza visual do card de pedidos.
**Arquivos alterados:** `CardPedido.tsx`, `Progress.md`
**O que foi feito:** Header (cliente + status); canal com ícone; itens em bloco; total destacado; ações críticas em botões; secundárias no `MenuAcoes`; barra lateral por tipo; sem min-heights forçados; badges semânticos.
**Verificação:** `npx tsc --noEmit` ✓

## [2026-07-20] Dashboard: cards ricos + loja com toggles

**Agente/Modelo:** Cursor Grok 4.5
**Objetivo:** Corrigir Dashboard minimalista demais — pedidos operacionais e loja com toggles de restaurante.
**Arquivos alterados:** `ControleStatusLoja.tsx`, `dashboard/page.tsx`, `Progress.md`
**O que foi feito:**
- Pedidos recentes de volta com `CardPedido` em grade (status, ações, WhatsApp, etc.).
- Loja: Abrir/Fechar destacado; toggle de horário automático; grade dos 7 dias; +30 min; Dialog de edição.
**Verificação:** `npx tsc --noEmit` ✓

## [2026-07-20] Dashboard Juridiq + jogo no WhatsApp

**Agente/Modelo:** Cursor Grok 4.5
**Objetivo:** Limpar Dashboard (KPI faixa, loja compacta, pedidos densos); mover aviso de jogo para WhatsApp.
**Arquivos alterados:** `dashboard/page.tsx`, `ControleStatusLoja.tsx`, `AvisoJogoBot.tsx`, `whatsapp/page.tsx`, `UI.md`, `Progress.md`
**O que foi feito:**
- Removido `AvisoJogoBot` do Dashboard; aba **Jogo** em `/admin/whatsapp`.
- KPI em faixa (sem grid de 4 cards); Skeleton no loading.
- `ControleStatusLoja` compacto: status + ações; horários em Dialog; confirmação em AlertDialog.
- Pedidos recentes: tabela `md+` / `CardPedido` no mobile; link Ver todos.
**Verificação:** `npx tsc --noEmit` ✓
**Próximos (mapa):** Painel, Caixa, Mesas, Combos/Adicionais/Cupons/Bairros, Novo pedido.

## [2026-07-20] Sidebar: migration + rename + mobile/UI

**Agente/Modelo:** Cursor Grok 4.5
**Objetivo:** Aplicar `admin_sidebar_config` no Supabase; renomear categorias; fechar menu mobile ao personalizar; UI-review do modal/sidebar.
**Arquivos alterados:** `SidebarPersonalizarModal.tsx`, `AdminLayout.tsx`, `UI.md`, `Progress.md` (+ SQL aplicado via Management API no projeto `bawysvqqeqwxasmggfcn`)
**O que foi feito:**
- Migration aplicada e tabela confirmada.
- Modal: renomear grupos (lápis), targets ≥44px no mobile, focus-visible, descrição atualizada.
- `handleAbrirPersonalizar` fecha Drawer + popover Mais antes de abrir o modal.
**Verificação:** `npx tsc --noEmit` ✓
**Armadilhas:** token Management API nunca versionar; Dialog responsivo vira Drawer no mobile — por isso fechar a sidebar evita dois drawers.

## [2026-07-20] Correção: período padrão “todos” + logo WhatsApp

**Agente/Modelo:** Cursor Grok 4.5
**Objetivo:** Filtros de pedidos sem período padrão “hoje”; header WhatsApp com marca do WhatsApp.
**Arquivos alterados:** `PeriodoEntrega`/`intervalo-entregas`, `FiltroPedidosAdmin`, `FiltroPedidosGarcom`, `pedidos/page`, `PedidosCriadosGarcom`, `entregas/page` (label), `whatsapp/page`, `Progress.md`
**O que foi feito:** Período `todos` (sem `gte/lt` de data) como padrão e ao limpar, em Pedidos e Garçons; WhatsApp usa `IconeWhatsApp` verde em vez de `/logo.png`.
**Verificação:** `npx tsc --noEmit` ✓

## [2026-07-20] Task 4 — Personalizar sidebar + DB

**Agente/Modelo:** Cursor Grok 4.5
**Objetivo:** Ocultar/reordenar itens da sidebar com persistência por usuário.
**Arquivos alterados:** `scripts/migrations/20260720_admin_sidebar_config.sql`, `src/app/api/admin/sidebar-config/route.ts`, `src/lib/admin-sidebar-routes.ts`, `src/components/admin/SidebarPersonalizarModal.tsx`, `AdminLayout.tsx`, `UI.md`, `Progress.md`
**O que foi feito:** Tabela `admin_sidebar_config` (SQL para aplicar no Supabase); API GET/PUT/DELETE com service role; modal drag + Eye/EyeOff + Restaurar; wire no AdminLayout com menu **Mais** para ocultos.
**Verificação:** `npx tsc --noEmit` ✓
**Pendências:** aplicar `scripts/migrations/20260720_admin_sidebar_config.sql` no Supabase antes de usar em produção.
**Armadilhas:** auth da API usa `usuarioId` da sessão localStorage (dívida conhecida); sem `@radix-ui/react-switch` — toggle Eye/EyeOff.

## [2026-07-20] Task 3 — Sidebar visual Juridiq

**Agente/Modelo:** Cursor Grok 4.5
**Objetivo:** Alinhar visual da sidebar ao Juridiq (logo, ativo primary, grupos, scroll).
**Arquivos alterados:** `AdminLayout.tsx`, `UI.md`, `Progress.md`
**O que foi feito:** Logo + marca; item ativo `border-l-primary` / `bg-primary/10`; títulos de grupo discretos; nav `min-h-0 flex-1`; footer com `AvatarUsuario`; colapso localStorage mantido.
**Verificação:** `npx tsc --noEmit` ✓

## [2026-07-20] Task 2 — AvatarUsuario Juridiq

**Agente/Modelo:** Cursor Grok 4.5
**Objetivo:** Unificar avatares do admin/login no estilo Juridiq.
**Arquivos alterados:** `src/components/ui/avatar.tsx`, `src/components/admin/AvatarUsuario.tsx`, `GerenciadorUsuariosSistema.tsx`, `ListaGarcons.tsx`, `PedidosCriadosGarcom.tsx`, `AdminLayout.tsx`, `CardPerfilUsuario.tsx`, `ModalSenhaLogin.tsx`, `TransicaoLogin.tsx`, `UI.md`, `Progress.md`, `package.json` (`@radix-ui/react-avatar`)
**O que foi feito:** Primitivo Radix Avatar + wrapper `AvatarUsuario` (iniciais + cor); call sites de listas, sidebar, header e login passam a usá-lo.
**Verificação:** `npx tsc --noEmit` ✓
**Armadilhas:** `@radix-ui/react-switch` não existe no projeto — personalizar sidebar usa toggle Eye/EyeOff.

## [2026-07-20] Task 1 — WhatsApp Juridiq + logo

**Agente/Modelo:** Cursor Grok 4.5
**Objetivo:** Redesign `/admin/whatsapp` com logo real e faixa de resumo.
**Arquivos alterados:** `src/app/admin/whatsapp/page.tsx`, `Progress.md`
**O que foi feito:** Header com `/logo.png`; KPI em faixa (status/número/msgs/notificações); tokens semânticos; AlertDialog e botões de admin alinhados ao padrão mobile.
**Verificação:** `npx tsc --noEmit` ✓ (fechamento das 4 tasks)

## [2026-07-20] Pedidos filtros + crop Juridiq + PDV/Usuários/Relatórios

**Agente/Modelo:** Cursor Grok 4.5
**Objetivo:** Enriquecer Filtrar de Pedidos; alinhar modais de recorte ao Juridiq; melhorar PDV (voltar dashboard), Usuários Sistema e Relatórios.
**Arquivos alterados:** `FiltroPedidosAdmin.tsx`, `pedidos/page.tsx`, `ModalRecorteImagem.tsx`, `ModalRecorteAvatar.tsx`, `pdv/page.tsx`, `usuarios/page.tsx`, `GerenciadorUsuariosSistema.tsx`, `relatorios/page.tsx`, `UI.md`, `Progress.md`

**O que foi feito:**
- Pedidos: abas Geral (situação/status/tipo/garçom/canal), Pagamento, Período — query com intervalo + chips.
- Crop produto/avatar: Dialog shadcn, tokens `primary`, footer sticky; sem amber/laranja.
- PDV: botão Painel → `/admin/dashboard`; chips de categoria; remove fullscreen agressivo no pointer/auto.
- Usuários Sistema + Relatórios: polish Juridiq (resumo, tabela/cards, KPI strip, Skeleton) — ver entradas abaixo.

**Verificação:** `npx tsc --noEmit` ✓ · browser não testado

**Decisão a revisar:** filtro padrão de Pedidos passou de “ano atual” para “hoje” (como garçom/entregas).

## [2026-07-20] Usuários Sistema: lista Juridiq + select seguro
**Agente/Modelo:** Cursor Grok 4.5
**Objetivo:** Alinhar página Usuários + GerenciadorUsuariosSistema ao padrão lista Juridiq (Clientes/Funcionários) e não expor senha_hash.
**Arquivos alterados:** `src/app/admin/usuarios/page.tsx`, `src/components/admin/GerenciadorUsuariosSistema.tsx`, `UI.md`, `Progress.md`

**O que foi feito:**
- Header da página: tokens `bg-primary/10 text-primary` / `foreground` / `muted-foreground`; acentos (Usuários, garçom).
- Sistema: faixa de resumo, busca + ToggleGroup de função + `FiltrosAtivosChips`, tabela md+ / cards mobile, `MenuAcoes`.
- Modais criar/editar e senha: `DialogContent` `flex flex-col p-0`, body scroll, footer sticky `h-11` no mobile.
- `select` só colunas seguras (sem `senha_hash`); `ModalRecorteAvatar` mantido.

**Decisões tomadas:** Espelhou `GerenciadorFuncionarios` (resumo + table/cards) + chips de filtro estilo Clientes; cor padrão do avatar `#0296F9` (primary) em vez de laranja.

**Verificação:** typecheck nos arquivos da task ✓ (erros pré-existentes em `ModalRecorteImagem.tsx` fora do escopo) · lint IDE ✓ · browser não testado

**Pendências / próximos passos:** nenhum nesta task

**Armadilhas descobertas:** coluna de login é `nome_usuario`, não `email`.

## [2026-07-20] Relatórios: polish Juridiq (faixa KPI + tokens)

**Agente/Modelo:** Cursor Grok 4.5
**Objetivo:** Melhorar UI/UX de `/admin/relatorios` no padrão Juridiq sem reescrever analytics.
**Arquivos alterados:** `src/app/admin/relatorios/page.tsx`, `UI.md`, `Progress.md`

**O que foi feito:**

- Faixa de resumo única (receita, pedidos, ticket, crescimento) no lugar de 4 cards gradiente.
- Loading com `Skeleton` (filtros/header permanecem); pills `CHIP_FILTRO_BOTAO`; `Button` shadcn.
- Tokens semânticos (`primary`, `muted`, `border`, `card`) no lugar de amber/zinc.
- Query de entregas concluídas filtrada pelo período da página (`gte`/`lte` created_at).
- Charts e PDF preservados; cores de gráfico alinhadas ao primary azul.

**Verificação:** `npx tsc --noEmit` sem erros em `relatorios/page.tsx` · `npm run lint` quebrado no Next 16 CLI · browser não testado

**Armadilhas:** Contadores hoje/semana/mês de entregas ainda usam janelas de calendário, mas só sobre pedidos já filtrados pelo período da tela.

## [2026-07-20] Produtos: modal completo + Dialog mobile (footer fixo)

**Agente/Modelo:** Cursor Grok 4.5
**Objetivo:** Eliminar edição inline e overflow/overlay dos modais em Produtos (e padrão Dialog no mobile).
**Arquivos alterados:** `dialog.tsx`, `ModalFormularioProduto.tsx`, `produtos/page.tsx`, `ActionDialog.tsx`, `ModalItemPedidoAdmin.tsx`, `UI.md`, `Progress.md`

**O que foi feito:**

- `Dialog` no mobile (Vaul): remove wrapper que enrolava tudo em `overflow-y-auto` — footer deixa de rolar com o formulário; `DialogFooter` com `mt-auto` + safe-area.
- `ModalFormularioProduto` (criar/editar): header/body/footer, botões `h-11` full-width no mobile, foto/categoria/preço/desconto/disponível/excluir.
- Lista de produtos: cards compactos + botão Editar abre modal (sem expansão inline).
- Ordenação manual: área com `max-height` + scroll interno; “Salvar ordem” sticky.
- Alinhados footers de `ActionDialog` e `ModalItemPedidoAdmin`.

**Verificação:** `npx tsc --noEmit` ✓ · `npm run lint` quebrado no Next 16 CLI (`lint` interpretado como diretório) · browser não testado

**Armadilhas:** Modais longos no mobile precisam de `p-0` + `overflow-hidden` + body `flex-1 overflow-y-auto` + footer separado; senão o footer some no scroll.

## [2026-07-19] FiltroAvancado em Pedidos/Entregas/Produtos/Funcionários + redesign Produtos

**Agente/Modelo:** Cursor Grok 4.5
**Objetivo:** Expandir o padrão Filtrar Juridiq às listas densas; redesenhar o topo/modais de Produtos.
**Arquivos alterados:** `FiltroAvancado.tsx`, `CampoSelectFiltro.tsx`, `FiltroPedidosAdmin.tsx`, `FiltroEntregasAdmin.tsx`, `FiltroProdutosAdmin.tsx`, `FiltroFuncionariosAdmin.tsx`, `pedidos/page.tsx`, `entregas/page.tsx`, `produtos/page.tsx`, `GerenciadorFuncionarios.tsx`, `UI.md`, `Progress.md`

**O que foi feito:**

- Shell reutilizável + `CampoSelectFiltro`; wrappers por domínio (Pedidos, Entregas, Produtos, Funcionários).
- Admin Pedidos / Entregas / Funcionários: busca + Filtrar (sem fileiras de pills / card de período).
- Entregas: período + status (+ entregador na aba Repasse) dentro do Filtrar.
- Produtos: faixa de resumo Juridiq; busca + Filtrar (status/tipo/foto/categoria); ordenação e lista sem caixas de ícone; modal Novo produto alinhado ao Dialog Juridiq.

**Verificação:** `npx tsc --noEmit` ✓ · browser não testado

**Pendências:** Cards de produto ainda usam expansão inline (lógica intacta); polish visual fino dos cards pode continuar depois.

## [2026-07-19] Filtro Juridiq (Filtrar + abas) nos pedidos do garçom

**Agente/Modelo:** Cursor Grok 4.5
**Objetivo:** Trocar filtros inline enormes pelo padrão Juridiq (botão Filtrar → popover/sheet com abas laterais) em desktop e mobile.
**Arquivos alterados:** `FiltroAvancado.tsx`, `FiltroPedidosGarcom.tsx`, `PedidosCriadosGarcom.tsx`, `UI.md`, `Progress.md`

**O que foi feito:**

- `FiltroAvancado` reutilizável: espelha Pessoas do Juridiq — desktop `DropdownMenu` 600×420 com abas laterais; mobile `Sheet` + Limpar/Aplicar; bolinha azul quando há filtro ativo.
- `FiltroPedidosGarcom`: abas Geral (situação/tipo/status), Pagamento, Período (atalhos + datas).
- Barra da lista: só busca + Filtrar; chips ativos abaixo; removidos card de período e fileiras de pills.

**Verificação:** `npx tsc --noEmit` ✓ · browser não testado

## [2026-07-19] Pedidos do garçom (monitoramento) + fix next/image R2

**Agente/Modelo:** Cursor Grok 4.5
**Objetivo:** Corrigir hostname R2 no Next Image; redesenhar `/admin/garcons/[id]/pedidos` no padrão Juridiq com filtros úteis, paginação e payload leve.
**Arquivos alterados:** `next.config.js`, `PedidosCriadosGarcom.tsx`, `UI.md`, `Progress.md` (também nesta sessão: `PainelGarcons`, `ListaGarcons`, `GerenciadorFuncionarios`, `funcionarios/page.tsx`, `menu-acoes`)

**O que foi feito:**

- `next.config.js`: unificou export — `images.remotePatterns` (R2 + B2) + `allowedDevOrigins` (antes a config de imagens nunca era exportada).
- Pedidos do garçom: removidos grid de metric cards e `CardPedido` na lista; faixa de resumo (período / em aberto / valor da página); `FiltroPeriodoEntregas` (hoje = dia operacional 03h); pills server-side (situação, tipo, pagamento, status) + busca debounced; tabela desktop + cards mobile; `PaginacaoPedidos` default 15.
- Payload: lista não carrega mais `itens_pedido` nem pagamentos parciais (só crediário leve); itens ficam nos modais de detalhe/edição/PDF.
- Ações operacionais preservadas via `MenuAcoes` (detalhes, editar, PDF, impressão, PIX, concluir, salão, fiado, excluir).

**Decisões tomadas:** Monitoramento prioriza filtros no servidor + lista leve; detalhe sob demanda. “Hoje” usa dia operacional (não meia-noite civil).

**Verificação:** `npx tsc --noEmit` ✓ · browser não testado (reiniciar `next dev` para aplicar `next.config.js`)

**Armadilhas:** Filtro “fiado” usa `forma_pagamento ilike %credi%` — pedidos só no crediário via movimento sem forma gravada podem não aparecer.

## [2026-07-19] Redesign Salão + Análise diária (Juridiq)

**Agente/Modelo:** Cursor Grok 4.5
**Objetivo:** Redesenhar Salão e Análise diária (desktop/mobile) no padrão Juridiq, sem quebrar fluxos críticos do salão.
**Arquivos alterados:** `CardMesaSalao.tsx`, `PainelSalaoAtual.tsx`, `salao/page.tsx`, `analise-diaria/page.tsx`, `UI.md`, `Progress.md`

**O que foi feito:**

- Salão: header limpo; painel com pills (Todas / Tempo crítico / Sem garçom / Pagamento); `CardMesaSalao` com hierarquia clara + `MenuAcoes`; Empty/Skeleton; ações primárias (pagar/imprimir/fechar) em destaque; lógica/RPC intacta.
- Análise diária: faixa de resumo no header (sem grid de 4 metric cards com ícone); canais em bloco único; gráficos/listas mais limpos; tabela desktop + cards mobile nos produtos; loading skeleton sem tela inteira de spinner; refresh realtime silencioso.

**Verificação:** `npx tsc --noEmit` ✓ · browser não testado

**Armadilhas:** No salão, filtros “urgentes” só aplicam a mesas (não a parceiros).

## [2026-07-19] MenuAcoes Juridiq + toasts topo + modais Crediário + fix refetch

**Agente/Modelo:** Cursor Grok 4.5
**Objetivo:** Dropdown reutilizável Juridiq; toasts no topo no mobile + toggle alertas de mesa; modais/card crediário legíveis; fechar modal sem skeleton.
**Arquivos alterados:** `menu-acoes.tsx`, `dropdown-menu.tsx`, `AppToaster.tsx`, `layout.tsx`, `AdminLayout.tsx`, `CardMovimentacaoFinancas.tsx`, `ListaMovimentacoes.tsx`, `CardContaCrediario.tsx`, `PainelCrediario.tsx`, `UI.md`, `Progress.md`

**O que foi feito:**

- `MenuAcoes` compartilhado (⋯ Juridiq com variantes default/success/destructive) + `dropdown-menu` alinhado (z-index, dark `#161717`).
- Reuso em movimentações e crediário (card + tabela).
- `AppToaster`: mobile `top-center`, desktop `top-right`; estilos mais limpos. Removido `position: bottom-right` forçado nos alertas de mesa.
- Toggle **Alertas de mesa** no menu do usuário (`localStorage admin:alertas-mesa`).
- Crediário: language leiga nos modais (fiado / ainda deve / receber pagamento); card mobile redesenhado; refetch silencioso; canal realtime sem depender de `contaSelecionadaId` (causa do skeleton ao fechar).

**Decisões tomadas:** Toggle de alertas no menu do avatar (lugar global e óbvio). Refresh pós-mutação silencioso para não flashar skeleton.

**Verificação:** `npx tsc --noEmit` ✓ · browser não testado

**Armadilhas descobertas:** `useEffect` do canal com `contaSelecionadaId` nas deps remonta o channel e chama `carregarContas()` a cada fechar de modal.

## [2026-07-19] Tabelas Juridiq (15/página) + redesign Crediário

**Agente/Modelo:** Cursor Grok 4.5
**Objetivo:** Tabelas de finanças (e correlatas) no visual Juridiq desktop/mobile com default 15/página; redesenhar Crediário sem amontoado de cards genéricos.
**Arquivos alterados:** `ListaMovimentacoes.tsx`, `CardMovimentacaoFinancas.tsx`, `PaginacaoFinancas.tsx`, `ListaPagamentos.tsx`, `ListaPedidosNaoPagos.tsx`, `ListaCrediarioPendente.tsx`, `PainelCrediario.tsx`, `CardContaCrediario.tsx`, `UI.md`, `Progress.md`

**O que foi feito:**

- Finanças movimentações: tabela desktop Juridiq (borda-l, status centrado, row clicável) + cards mobile; paginação default 15 (opções 15/30/50/100).
- Listas satélite (pagamentos, pedidos não pagos, crediário pendente): mesmo padrão mobile/desktop + Empty/Skeleton + paginação 15.
- Crediário: removido grid de 4 metric cards; faixa de resumo no header; pills ToggleGroup (status/origem); chips ativos; tabela desktop + `CardContaCrediario` mobile; menu ⋯; paginação 15; detalhe do modal sem caixas aninhadas de métricas.

**Decisões tomadas:** Reuso de `PaginacaoFinancas` no crediário (mesmo componente genérico). Lógica/RPC do crediário intacta — só visual.

**Verificação:** `npx tsc --noEmit` ✓ · `npm run lint` falha conhecida (Next resolve `lint` como dir) · browser não testado

**Pendências / próximos passos:** Validar visual no browser (mobile + desktop) em `/admin/financas` e `/admin/crediario`.

**Armadilhas descobertas:** ToggleGroup `type="single"` não desmarca ao reclicar — limpar via chips “Limpar tudo”.

## [2026-07-19] Empty/Skeleton + filtros Juridiq + chips ativos

**Agente/Modelo:** Cursor Grok 4.5
**Objetivo:** Listas principais com Empty/Skeleton; filtros em pills Juridiq; chips “Filtros ativos” + Limpar tudo.
**Arquivos alterados:** `filtros/chip-classes.ts`, `FiltrosAtivosChips.tsx`, `ListaEstado.tsx`, `pedidos/page.tsx`, `entregas/page.tsx`, `FiltroPeriodoEntregas.tsx`, `PainelFinancas.tsx`, `ListaMovimentacoes.tsx`, `GerenciadorUsuariosClientes.tsx`, `UI.md`, `Progress.md`

**O que foi feito:**

- Chips pill compartilhados (`CHIP_FILTRO_DEFAULT` / `ALERTA`) iguais ao Juridiq (`#0399F9` / `#E6F4FE`).
- `FiltrosAtivosChips` com label + valor + botão Limpar tudo.
- `ListaVazia` / `GradeSkeleton` / `ListaSkeleton` / `TabelaSkeleton` sobre Empty + Skeleton.
- Pedidos: selects → ToggleGroup pills (status + tipo); skeleton/empty; chips.
- Entregas: período e status em pills; skeleton nos cards/lista; chips; sem tela inteira de spinner.
- Finanças: chips ativos; Empty/Skeleton na lista; classes de chip unificadas.
- Clientes: Select → pills; skeleton/empty; chips.

**Verificação:** `npx tsc --noEmit` ✓ · browser não testado

**Armadilhas:** ToggleGroup `type="single"` não permite desmarcar o item ativo clicando de novo — limpar via “Limpar tudo”.

## [2026-07-19] Mobile Juridiq: Drawer (vaul) na sidebar e modais

**Agente/Modelo:** Cursor Grok 4.5
**Objetivo:** Sidebar e modais mobile iguais ao Juridiq (bottom sheet com handle + swipe para fechar) em admin, garçom e entregador.
**Arquivos alterados:** `package.json` (vaul), `src/hooks/useIsMobile.ts`, `src/components/ui/drawer.tsx`, `dialog.tsx`, `alert-dialog.tsx`, `modal-sheet.tsx`, `AdminLayout.tsx`, `ModalDetalhesPedido.tsx`, `ModalEditarPedido.tsx`, `ModalItemPedido.tsx`, `ModalCatalogoItensPedido.tsx`, `entregador/page.tsx`, modais de caixa (`ModalAbrirCaixa`, `ModalFecharCaixa`, `ModalNovaMovimentacao`, `ModalDetalhesCaixa`), `UI.md`, `Progress.md`

**O que foi feito:**

- Dependência `vaul` + primitivo `Drawer` (handle `h-1.5 w-[100px]` como Juridiq).
- `Dialog` responsivo: abaixo de 768px vira Drawer (arrastar para fechar); desktop mantém centrado. Prop `variant="dialog"` força centrado.
- `AlertDialog` no mobile sobe de baixo com handle visual (Radix mantido — Action/Cancel incompatíveis com Vaul).
- `ModalSheet` compartilhado para migrar overlays custom.
- Sidebar admin mobile: Sheet lateral → Drawer bottom.
- Migrados modais custom principais (detalhes/editar pedido, garçom, entregador notificações, caixa).

**Verificação:** `npx tsc --noEmit` ✓ · lint indisponível · browser não testado

**Pendências:** Modais custom restantes (recorte imagem/avatar, usuários sistema/clientes, cupons overlay, ControleStatusLoja, Preview mobile) ainda usam `fixed inset` — migrar sob demanda via `ModalSheet`. Cardápio público fora do escopo B.

**Armadilhas:** Não converter `AlertDialog` root para Vaul (quebra Action/Cancel). `Dialog` com `p-0` no mobile: padding fica a cargo do conteúdo.

## [2026-07-19] Auditoria UI /admin: scroll e alturas de viewport

**Agente/Modelo:** Cursor Grok 4.5
**Objetivo:** Varrer `/admin` por bugs da mesma família do scroll vazio em Pedidos (auto-rows-fr, h-screen, calc 100vh vs AdminLayout) e corrigir.
**Arquivos alterados:** `dashboard/page.tsx`, `painel/page.tsx`, `pedidos/page.tsx`, `PedidosCriadosGarcom.tsx`, `PainelCategoriasProduto.tsx`, `caixa/page.tsx`, `ModalPreviewMobile.tsx`, `UI.md`, `Progress.md`

**O que foi feito:**

- Removido `auto-rows-fr` em dashboard e lista de pedidos do garçom (mesma causa do bug de Pedidos).
- Loading do dashboard: `h-screen` → `py-24` (não força viewport dentro do `main`).
- Painel kanban: `h-[calc(100vh-80px)]` → `h-[calc(100dvh-5.5rem)]` / `md:…6.5rem` alinhado ao shell do AdminLayout.
- Pedidos: removido `overflow-hidden` no wrapper (evita clip estranho).
- Trocas pontuais `100vh` → `100dvh` em novo pedido (categorias), caixa (modal), preview mobile.
- Documentados anti-padrões em `UI.md`.

**Verificação:** `npx tsc --noEmit` ✓ · `npm run lint` falha (Next interpreta dir `lint` — problema conhecido no projeto) · browser não testado

**Pendências / próximos passos:** Inconsistências visuais (zinc legado vs tokens) e telas fullscreen próprias (PDV/login) ficaram de fora — não são bugs de scroll.

**Armadilhas:** Qualquer grid de cards com `auto-rows-fr` sem altura de pai definida = scroll fantasma. Conteúdo fullscreen dentro do AdminLayout deve usar `100dvh` menos header (~5.5–6.5rem), não `100vh` solto.

## [2026-07-19] Fix scroll vazio abaixo da paginação em Pedidos

**Agente/Modelo:** Cursor Grok 4.5
**Objetivo:** Impedir scroll além do conteúdo (lista + paginação) em `/admin/pedidos`.
**Arquivos alterados:** `src/app/admin/pedidos/page.tsx`, `src/components/admin/CardPedido.tsx`, `Progress.md`

**O que foi feito:**

- Removido `auto-rows-fr` do grid (com altura indefinida, `1fr` inflava as linhas e gerava espaço preto após a paginação).
- Removido `min-h-[380px]` do `CardPedido` (altura passa a seguir o conteúdo / stretch da linha).
- Scroll ao mudar página aponta para o `main` do AdminLayout (onde o overflow real acontece).

**Verificação:** `npx tsc --noEmit` ✓ · browser não testado

**Armadilhas:** `grid-auto-rows: 1fr` sem container com altura definida é anti-padrão e estoura o layout.

## [2026-07-19] Dark mode + sidebar ativa azul (Juridiq)

**Agente/Modelo:** Cursor Grok 4.5
**Objetivo:** Dark mode e sidebar iguais ao Juridiq; item da página atual em azul.
**Arquivos alterados:** `src/app/globals.css`, `src/components/admin/AdminLayout.tsx`, `Progress.md`

**O que foi feito:**

- Dark: fundo `240 6% 6%`, cards/sidebar `#1D1F1F` (`180 3% 12%`).
- Item ativo: texto/ícone `#0296F9`, fundo `rgba(2,150,249,0.08/0.12)`, borda esquerda 3px azul (igual `sidebar-buttons` Juridiq).
- Match de rota com prefixo inteligente (não marca Pedidos quando está em Novo pedido).

**Verificação:** `npx tsc --noEmit` ✓ · browser não testado

## [2026-07-19] Tema Juridiq: Geist único + tokens de cor


**Agente/Modelo:** Cursor Grok 4.5
**Objetivo:** Tipografia só Geist (como Juridiq) e cores alinhadas (claro/escuro).
**Arquivos alterados:** `src/lib/fonts.ts`, `public/fonts/Geist-*.woff2`, `src/app/layout.tsx`, `src/app/globals.css`, `tailwind.config.js`, `UI.md`, `Progress.md`

**O que foi feito:**

- Removidos Manrope, Bricolage Grotesque e Outfit do layout.
- Geist via `next/font/local` + `geist.className` no `body` (padrão Juridiq).
- Títulos herdam Geist (`font-family: inherit`); sem fallback `sans-serif` na stack do app.
- Tokens CSS / `primaryBlue` alinhados ao Juridiq; dark sem primário dourado.

**Verificação:** `npx tsc --noEmit` ✓ · lint indisponível · browser não testado

**Armadilhas:** `geist.className` é o que aplica a face real; só `--font-geist` no Tailwind sem className no body não basta.

## [2026-07-19] Finanças: dropdowns, edição, paginação Juridiq + fix R$ 1.561


**Agente/Modelo:** Cursor Grok 4.5
**Objetivo:** Menu ⋯ (visualizar/editar/excluir), modais receita/despesa no padrão Juridiq, paginação 30/50/100, corrigir receita do dia no fluxo.
**Arquivos alterados:** `ActionDialog.tsx`, `ModalMovimentacao.tsx`, `ModalNovaMovimentacao.tsx`, `PaginacaoFinancas.tsx`, `ListaMovimentacoes.tsx`, `PainelFinancas.tsx`, `useFinancas.ts`, `Progress.md`, `UI.md`

**O que foi feito:**

- Dropdown `MoreHorizontal` por linha: Visualizar · Editar (manual) · Excluir (todos, com confirm).
- Modal unificado criar/editar (descrição → valor/data → categoria/forma; botão Confirmar/Atualizar).
- `PaginacaoFinancas` espelhando Juridiq (`FinancePagination`): select 30/50/100 + first/prev/números/next/last.
- Bug 1561: fluxo passa a agregar por **dia de trabalho** (10h→09h59) e pedidos alinhados ao dashboard (`≠ cancelado/aguardando_pagamento`).
- `atualizarMovimentacao` no hook.

**Decisões:** Sync de pedido não edita (só visualizar/excluir o registro do caixa). Paginação client-side (lista já limitada a 1000).

**Verificação:** `npx tsc --noEmit` ✓ · lint indisponível · browser não testado

**Pendências:** Conferir no browser se o ponto de hoje no gráfico ≈ Receita Hoje do dashboard.

**Armadilhas:** Comparar gráfico (dia civil) com dashboard (dia operacional) gera falsa discrepância.

## [2026-07-19] Finanças: UI Juridiq real (ChartRadial + filtros + tabela)


**Agente/Modelo:** Cursor Grok 4.5
**Objetivo:** Reconstruir Finanças a partir do repo Juridiq (`finance-releases`, `chartStacked`, `finance-quick-filters`) + screenshots — não só “inspiração genérica”.
**Arquivos alterados:** `CardRadialFinancas.tsx` (novo), `PainelFinancas.tsx`, `ListaMovimentacoes.tsx`, `Progress.md`, `UI.md`

**O que foi feito:**

- Cards Receitas/Despesas no padrão `ChartRadialStacked`: faixas verde / laranja / azul + donut (Chart.js, sem recharts).
- Shell único de Lançamentos: título, nav de mês (← / Mês Atual / →), pills (Todos · A receber · Somente Receitas · Somente Despesas), busca por descrição, tabela embutida.
- Botões Receitas/Despesas com `PlusCircle`/`MinusCircle` nas cores Juridiq (`#00C247` / `#FF5151`).
- Lista com barra lateral de status, badges Pedido/Manual e valor colorido.

**Decisões tomadas:** Domínio restaurante — “Inadimplentes/A vencer” do Juridiq mapeados para “A receber” (pedidos não pagos + crediário). Sem dependência nova (Chart.js já existia).

**Verificação:** `npx tsc --noEmit` ✓ · lint indisponível (Next 16) · browser não testado

**Pendências:** Validar no browser; opcional remover `StatCardsFinanceiros` se ninguém mais usar.

**Armadilhas:** O Juridiq usa Phosphor `CaretLeft`/`CirclePlus` + Recharts; no Edienai usar Lucide equivalentes + Chart.js doughnut.

## [2026-07-19] Finanças: totais corretos + UI estilo Juridiq

**Agente/Modelo:** Cursor Grok 4.5
**Objetivo:** Eliminar receita duplicada (~2×) e redesenhar Finanças no visual do Juridiq.
**Arquivos alterados:** `src/features/financas/hooks/useFinancas.ts`, `lib/formatadores.ts`, `PainelFinancas.tsx`, `StatCardsFinanceiros.tsx`, `ActionDialog.tsx`, `ModalNovaMovimentacao.tsx`, `ModalPagamentoSalario.tsx`, `ListaMovimentacoes.tsx`, `Progress.md`, `UI.md`

**O que foi feito:**

- Receita extra e gráficos passam a ignorar `movimentacoes_caixa` com `pedido_id` (sync do caixa) — fim da contagem em dobro.
- “Hoje” usa dia de trabalho (10h); pedidos não pagos filtrados pelo período; selects estreitos.
- Header Juridiq: lucro com olho, pedidos/ticket, a receber + botões verdes/vermelhos de receita/despesa; modal e lista com marcação de sync.

**Decisões tomadas:** Sem base-ui (Juridiq usa Radix/Chakra; Edienai já tem Radix). Default do filtro = hoje operacional.

**Verificação:** `npx tsc --noEmit` ✓ · lint indisponível (Next 16) · browser não testado

**Pendências:** Validar no browser com caixa aberto e pedidos sincronizados.

**Armadilhas:** Somar pedidos + todas as entradas do caixa duplica receita sempre que o sync de pedidos estiver ativo.

## [2026-07-19] Otimização round 2 — painel, caixa, configuracoes_loja

**Agente/Modelo:** Cursor Grok 4.5
**Objetivo:** Cortar os 3 hotspots restantes de egress/compute sem mexer no fluxo de pedidos.
**Arquivos alterados:** `src/app/admin/painel/page.tsx`, `src/lib/useCaixa.ts`, `src/lib/useStatusLoja.ts`, `Progress.md`

**O que foi feito:**

- **Painel Kanban:** debounce 800ms no realtime; reload silencioso não busca mais a base de numeração 48h (reusa mapa local); INSERT agenda numeração; focus só recarrega se >30s desde a última carga.
- **useCaixa:** todos os `select('*')` de caixas/funcionarios/categorias/automação/movimentações trocados por colunas tipadas (joins estreitos).
- **useStatusLoja:** `select('chave, valor')`; realtime aplica o payload sem full-reload; sync automático de aberto/fechado debounced 5s (evita tempestade de upsert → realtime → select em loop com o timer de 30s).

**Decisões tomadas:** Sem schema novo — `configuracoes_loja` já tem índice em `chave`; o problema era volume de queries (17 linhas, 354k seq scans = muitas leituras, não índice faltando).

**Verificação:** `npx tsc --noEmit` ✓ · lint indisponível (Next 16) · browser não testado

**Pendências / próximos passos:** Monitorar seq_scan de `configuracoes_loja`/`funcionarios` em 24–48h; opcional estreitar outros call sites de `configuracoes_loja` (cardápio, ModalCarrinho, produtos).

**Armadilhas:** Timer de horário automático + upsert imediato era o principal gerador de tráfego em `configuracoes_loja`.

## [2026-07-19] Otimização de egress/compute (dashboard, garçom, relatórios)

**Agente/Modelo:** Cursor Grok 4.5
**Objetivo:** Reduzir egress e compute das queries pesadas do admin/garçom sem quebrar o fluxo de pedidos.
**Arquivos alterados:** `src/app/admin/dashboard/page.tsx`, `src/lib/useEntregas.ts`, `src/app/garcom/mesas/page.tsx`, `src/app/admin/relatorios/page.tsx`, `src/app/admin/analise-diaria/page.tsx`, `scripts/otimizar-egress-dashboard-management.sql`, `Progress.md`

**O que foi feito:**

- Auditoria via Management API (`pg_stat_user_tables`, EXPLAIN, índices): hotspots confirmados em `pedidos` (54M tuplas em seq scan), `item_adicionais` (624k seq scans sem índice no FK), `mesas`/`funcionarios`/`configuracoes_loja` (tabelas pequenas com polls/realtime agressivos).
- Banco: criado `idx_item_adicionais_item_pedido_id` e RPC `estatisticas_pedidos_periodo(p_inicio, p_fim)` (aggregates PostgREST estão desabilitados — `PGRST123`).
- Dashboard: removeu paginação do mês inteiro para somar `total`; usa RPC; realtime de itens/pagamentos/crediário só recarrega a lista dos 12; poll de stats a 120s.
- Entregas: select estreito (sem `*` / `funcionarios(*)`).
- Garçom mesas: select estreito; debounce 600ms no realtime; poll 20s → 90s.
- Relatórios: eliminou N+1 (`itens_pedido` por pedido); batch `.in` + colunas mínimas.
- Análise diária: colunas mínimas em pedidos/itens.

**Decisões tomadas:** Manter queries client+anon (pedido explícito). RPC em vez de `total.sum()` porque aggregates REST estão off. Índice no FK de `item_adicionais` porque embeds nested faziam seq scan a cada listagem.

**Verificação:** `npx tsc --noEmit` ✓ · `npm run lint` indisponível (Next 16 removeu `next lint`; sem `eslint.config`) · browser não testado · bug-hunter ✓ (filtro RPC alinhado a `NOT IN` como o `.neq` do client)

**Pendências / próximos passos:**

1. Monitorar egress no dashboard Supabase após 24–48h de operação.
2. Candidatos seguintes (não feitos): `admin/painel` (reload completo em realtime), `configuracoes_loja` (354k seq scans), `useCaixa` (`select *` em massa), realtime do bot WhatsApp (maior tabela: `whatsapp_messages` 47 MB).
3. Rotacionar o access token da Management API (foi exposto no chat).

**Armadilhas descobertas:**

- PostgREST aggregates (`select=total.sum()`) retornam `PGRST123` neste projeto — usar RPC.
- `CREATE INDEX CONCURRENTLY` pode falhar se a Management API rodar em transação; `CREATE INDEX IF NOT EXISTS` funciona.
- Dashboard antigo reexecutava o loop de ~1000 linhas do mês a cada mudança em `itens_pedido` (debounce 300ms) — principal vilão de egress no horário de pico.
- App e bot compartilham o mesmo banco; RPC/índice afetam ambos (só leitura/aditivo).

## [2026-07-19] Documentação para agentes + auditoria de segurança do banco

**Agente/Modelo:** Claude Opus 4.8
**Objetivo:** enriquecer a documentação operacional para IA (template de tarefa, curadoria de skills) e auditar o estado real do Supabase via Management API.
**Arquivos alterados:** `AGENTS.md` (§0 template + §3.9/§3.10 segurança + §6 skills), `SKILLS.md` (novo), `PRD.md` (nova seção §Segurança), `Progress.md`

**O que foi feito:**

- Adicionado ao `AGENTS.md`: §0 Template de Tarefa (aplicável a qualquer pedido), §0.3 stack real verificada, §3.9 estado de segurança do banco, §3.10 `.env.local` versionado, §6 reescrito apontando `SKILLS.md` como leitura obrigatória.
- Criado `SKILLS.md`: curadoria pela stack real (Next 16 App Router / React 18 / TS strict / shadcn+Radix+framer-motion+Tailwind v3 / React Context / Supabase / Mercado Pago / npm / Vercel), incluindo `supabase-postgres-best-practices` conforme pedido, e lista de skills que quebram a stack.
- Adicionada seção §Segurança ao `PRD.md`, elevando o acesso direto do cliente de "restrição arquitetural" (como estava na linha ~240) para **risco crítico explícito**.

**Auditoria via Management API (access token do usuário, sem MCP):**

- Projeto `bawysvqqeqwxasmggfcn` — **compartilhado com o bot**; 52 tabelas (as `whatsapp_*` são do bot).
- 🔴 **0 de 50 tabelas com RLS.** Roles `anon`/`authenticated` com grant total (incl. `TRUNCATE`) em `usuarios_cliente`, `pedidos`, `pagamentos_pedido`, `crediario_contas`, `usuarios_sistema` (com `senha_hash`), etc. Anon key vai ao browser (`src/lib/supabase.ts`); 69 componentes client consultam tabelas direto.
- 🔴 `.env.local` rastreado no git (`MERCADO_PAGO_ACCESS_TOKEN`, `EVOLUTION_API_KEY`, `VERCEL_OIDC_TOKEN`); branch 3 commits à frente de `origin/main`.

**Decisões tomadas:**

- **Não** reescrever `PRD.md`/`Progress.md`/`UI.md` (fortes e recém-datados 2026-07-12); apenas enriquecer/append. `SKILLS.md` e o template são o valor novo.
- **Não** corrigir RLS/grants nem `.env.local` (migração coordenada + rotação de chaves + Git de escrita = autorização do mantenedor). Apenas documentado e reportado.
- Access token do usuário usado só em memória/scratchpad de sessão; **não** escrito em nenhum doc, log ou commit.

**Verificação:** schema, RLS, grants e contagens lidos ao vivo pela Management API; stack confirmada em `package.json`/código (Next 16, TS strict, shadcn 55 / Radix 18 / framer 56, sem zod/rhf/zustand, npm). Sem alteração de código — sem `tsc`/lint nesta task (só documentação).

**Pendências / próximos passos (ordem de risco):**

1. **Rotacionar** service role do Supabase, `MERCADO_PAGO_ACCESS_TOKEN`, `EVOLUTION_API_KEY` — expostas no git/bundle.
2. Habilitar **RLS + policies** e **revogar grants do `anon`**; mover consultas sensíveis para route handlers server-side (migração coordenada web/Electron/bot).
3. `git rm --cached .env.local` e limpar histórico.

**Armadilhas descobertas:**

- App e bot **compartilham o mesmo banco**; mudança de schema/grant/trigger afeta web + 2 Electron + bot ao mesmo tempo.
- `@mui/material`/`@emotion` estão nas deps mas **sem uso real** — UI é shadcn; não criar UI nova com MUI.
- **Sem zod e sem react-hook-form**: forms são manuais; não presuma esse ferramental.
- Não há script `typecheck` nem framework de teste: verificação é `npx tsc --noEmit` + `npm run lint`.

## [2026-07-12] Controles sólidos da fila de impressão

**Agente/Modelo:** Codex (GPT-5)
**Objetivo:** Permitir desativar a impressão automática de itens adicionados na edição e impedir acúmulo de pedidos fora do horário, sem recompilar o Electron.
**Arquivos alterados:** `scripts/configurar-fila-impressao-management.sql`, `src/lib/filaImpressao.ts`, `src/components/admin/GerenciadorImpressao.tsx`, `src/app/admin/impressora/page.tsx`, call sites manuais de impressão, `PRD.md`, `UI.md`, `Progress.md`
**O que foi feito:**

- Substituído o toggle local/fictício por configuração persistida no Supabase.
- Adicionada janela diária da fila automática com suporte a período noturno que cruza meia-noite.
- Adicionado controle independente para impressão automática de itens novos após edição.
- Separadas impressões automáticas e manuais; reimpressão explícita continua disponível fora da janela.
- Pendências automáticas incompatíveis são canceladas ao salvar a configuração; eventos novos fora da regra não entram na fila.
- Migration aplicada no projeto `edienai` pela Supabase Management API, sem MCP.
- Electron preservado sem alterações e sem necessidade de novo empacotamento.

**Decisões tomadas:** A regra ficou no PostgreSQL para cobrir todos os produtores e consumidores atuais sem depender de o Electron conhecer a nova configuração. Defaults preservam o comportamento anterior (`ativa 24h`, itens editados ligados).
**Verificação:** `tsc --noEmit` ✓ · 3 testes Node ✓ · 5 cenários transacionais PostgreSQL ✓ com rollback · diff check ✓ · lint indisponível por configuração ausente/script incompatível na base
**Pendências / próximos passos:** Escolher no admin a janela operacional desejada; nenhum horário restritivo foi ativado automaticamente.
**Armadilhas descobertas:** `impressora_auto_imprimir` controla a impressão Web Bluetooth, não o Electron. O antigo botão Ativa/Pausada do dashboard alterava somente estado React e não pausava a fila real.

## [2026-07-12] Inicialização da documentação viva

**Agente/Modelo:** Codex (GPT-5)
**Objetivo:** Criar a governança documental e analisar a arquitetura do repositório e do Supabase antes da primeira tarefa de implementação.
**Arquivos alterados:** `AGENTS.md`, `PRD.md`, `Progress.md`, `UI.md`
**O que foi feito:**

- Criado o `AGENTS.md` normativo a partir do conteúdo fornecido pelo usuário.
- Criadas as bases de `PRD.md`, `Progress.md` e `UI.md` para enriquecimento durante o inventário.

**Decisões tomadas:** O token da Management API será usado apenas em memória/processo e nunca persistido nos documentos ou no código.
**Verificação:** Em andamento; documentação será revisada após o inventário completo.
**Pendências / próximos passos:** Mapear módulos, fluxos, componentes, integrações e schema real do Supabase; consolidar os documentos.
**Armadilhas descobertas:** A raiz possui múltiplas aplicações; o mapa deve separar claramente a aplicação Next.js, a impressora Electron e a integração WhatsApp.
