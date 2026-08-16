# SKILLS.md — Skills para o app Bar da Ladeira

Curadoria de skills filtrada pela **stack real deste projeto**. Normativo: leia antes de invocar qualquer skill.

> **Precedência:** skill que contradiz o `AGENTS.md` **perde**. Skill é conselho genérico; este arquivo e o `AGENTS.md` descrevem *este* app. Se a skill assume outra stack, use só os princípios.

Escopo: a **aplicação web principal** (`src`) — admin, garçom, entregador, cardápio público e route handlers. Este repositório é o produto **Bar da Ladeira**, copiado a partir da base da Edienai Lanches; não volte a usar nomenclatura da base antiga. Subprojetos Electron/bot da base original **não estão neste repositório**.

---

## Stack real (não presuma diferente)

| Item | Real | Consequência |
|---|---|---|
| **Next.js** | **16.2.6 — App Router** | `src/app/` com route groups. Route handlers em `src/app/api/*`. Na **Vercel** (`.vercel/`, `vercel.json`). |
| **React** | **18.2** | Sem React 19 APIs. |
| **TypeScript** | **`strict: true`** | O tipo protege. Não espalhe `any`. |
| **UI** | **shadcn/ui** (`src/components/ui/*`, 55) + **Radix** (18) + **framer-motion** (56) + **Tailwind v3** | ⚠️ `@mui/material` e `@emotion` estão nas deps mas **efetivamente sem uso em componentes** — trate como legado, **não** crie UI nova com MUI. |
| **Estado** | **React Context** (`AdminAuthContext`, `CarrinhoContext`, `ImpressoraContext`, `PreviewContext`) | ⚠️ **Sem Redux, Zustand, Jotai ou TanStack Query.** É deliberado. |
| Forms | **manuais** (`useState`) | ⚠️ **Sem react-hook-form, sem zod.** Validação é manual/TS. |
| Banco | **Supabase** (Postgres) — `supabase-js` | ⚠️ Ver §Segurança. `src/lib/supabase.ts` (anon, browser) e `src/lib/server/supabase-admin.ts` (service role). |
| Pagamento | **Mercado Pago** (`src/app/api/pagamentos/mercado-pago/*`) | Webhook público — idempotência + validação de origem. |
| Arquivos | **Backblaze B2 / S3** (`@aws-sdk/client-s3`, `src/lib/backblaze.ts`) | Upload em `api/upload`. |
| PDF / gráficos | **jspdf** + **chart.js/react-chartjs-2** | Relatórios de caixa/finanças. |
| Toast | **sonner** | |
| Datas | **date-fns** | |
| Testes | **nenhum framework** (1 `.test.mjs`, sem script `test`) | Verificação = `npx tsc --noEmit` + `npm run lint`. `AGENTS.md §3.4` proíbe teste de browser. |
| Package manager | **npm** (`package-lock.json`) | Não é pnpm. |

### Arquitetura real

```
src/app/
  admin/       # painel completo: pdv, caixa, pedidos, produtos, mesas, garcons,
               #   entregas, crediario, cupons, financas, relatorios, whatsapp…
  garcom/      # app do garçom: login, mesas, novo pedido, editar
  entregador/  # app do entregador: login, page
  api/         # 12 route handlers: bot/* (controle da Evolution) + pagamentos/mercado-pago/* + upload
  page.tsx     # cardápio público / checkout do cliente
src/features/  # crediario, entregas, financas, pedidos, salao
src/components/ # ui (shadcn) + admin/ + garcom/ + …
src/contexts/  # estado global (Context API)
src/lib/       # supabase.ts (anon), server/supabase-admin.ts (service role), + libs de domínio
```

### Banco compartilhado com o bot

O app web aponta para o projeto Supabase `olkzbualikbyudupizxz`. As tabelas `whatsapp_*` pertencem ao **bot** — não as trate como do app. Mudança de schema/grants/trigger afeta clientes que compartilhem este banco.

---

## 🔴 §Segurança — leia antes de tocar em dados

Estado **verificado via Management API** (2026-07-19):

- **Nenhuma das 50 tabelas tem RLS habilitado.** Zero policies.
- Os roles **`anon` e `authenticated` têm grant TOTAL** (SELECT/INSERT/UPDATE/DELETE/**TRUNCATE**) em tabelas sensíveis: `usuarios_cliente` (667), `pedidos` (7.776), `pagamentos_pedido` (6.772), `crediario_contas` (480), `funcionarios`, **`usuarios_sistema`** (11 — contém `senha_hash` e `papel`).
- A **anon key vai para o browser** (`src/lib/supabase.ts`) e **69 componentes client** consultam tabelas direto com `.from(...)`.

**Consequência:** qualquer pessoa que abra o site, pegue a anon key do bundle e chame o PostgREST do Supabase pode **ler todos os clientes, pedidos, pagamentos e os hashes de senha do sistema**, além de **apagar/`TRUNCATE` qualquer tabela**. O "login" (`autenticacao.ts` via RPC + `localStorage`) é confiança no cliente — o banco já está aberto antes de qualquer login.

### Regras enquanto isso não for corrigido (é dívida conhecida, não padrão a imitar)

1. **Não amplie a superfície.** Ao criar tela/consulta, **prefira route handler server-side** (`src/app/api/*`) com `supabase-admin` (service role) a mais uma query client-side com anon.
2. **Nunca** exponha dado mais sensível ao cliente do que o já exposto. Nada de trazer `senha_hash`, tokens ou `usuarios_sistema` para componente client.
3. **Route handler novo = decida a auth.** Webhook (Mercado Pago) valida origem/assinatura e é idempotente.
4. Corrigir a base (ligar RLS + policies + revogar grants do anon + mover queries para o servidor) é **migração coordenada** com web/Electron/bot — **tarefa própria com autorização**, nunca de brinde. Se for mexer perto, **avise**.

Skill para isso: **`supabase`** (seção RLS) + **`backend-security-coder`**. Ver PRD §Segurança.

---

## Tier 1 — Use sempre

| Skill | Quando | Por quê |
|---|---|---|
| `systematic-debugging` | Qualquer bug, **antes** de propor fix | Root cause antes de remendo. |
| `verification-before-completion` | Antes de declarar concluído | Sem framework de teste, `tsc --noEmit` + `lint` são a rede — rodar é obrigatório (AGENTS §8). |
| `bug-hunter` | Investigação de bug | Já obrigatória pelo §6 do AGENTS. |
| `code-simplification` | Diff cresceu / ficou complexo | Reforça diff mínimo (§4). |
| `code-reviewer` | Antes de entregar | Diff cirúrgico; pega regressão. |

## Tier 2 — Stack-específicas

| Skill | Área | Observação |
|---|---|---|
| **`supabase-postgres-best-practices`** | Schema, índice, query, **RLS/policies** | ✅ Escrita pela Supabase. Central aqui: é a referência para a correção de RLS e para query eficiente sobre `pedidos`/`itens_pedido` (17k linhas). |
| **`supabase`** | supabase-js, Realtime, RLS, Storage | Fonte primária. O app usa Realtime (fila de impressão, pedidos) com polling de segurança. |
| `postgres-best-practices` | Postgres puro | Equivalente enxuto da anterior; use uma das duas. |
| **`backend-security-coder`** | Route handlers, webhook MP, upload, e a dívida de RLS | ⚠️ Prioridade alta dado o §Segurança. |
| `api-security-best-practices` | Superfície HTTP, webhook idempotente | Mercado Pago webhook é público. |
| `nextjs-app-router-patterns` | `app/(group)`, layouts, route handlers | ✅ App Router. |
| `nextjs-best-practices` | RSC vs client, data fetching | ✅ App Router; foi escrita p/ Next 14/15 — o essencial vale no 16. |
| `react-best-practices` (Vercel) | Componente novo, performance | ✅ Bate com a stack. |
| `react-component-performance` | Admin pesado: PDV, listas de pedidos, gráficos, `salao` | Re-render em telas grandes. |
| `shadcn` | `src/components/ui/*` | ✅ Reuse antes de criar primitivo. É Radix+cva — a skill se aplica. |
| `tailwind-patterns` | Estilização | ⚠️ A skill é para **Tailwind v4**; aqui é **v3 com `tailwind.config.js`**. Use os princípios, **ignore a config v4**. |
| `typescript-pro` | Tipos avançados | ✅ Aqui `strict: true` de verdade — a skill ajuda (diferente do bot). |
| `vercel:vercel-functions` / `vercel:deploy` / `vercel:env` | Route handlers, deploy, env | ✅ É Vercel de verdade. |
| `stripe-integration` | ❌ não — é **Mercado Pago** | Não há skill de MP; use `backend-security-coder` + doc oficial do MP para o webhook. |

---

## Tier 3 — Por sintoma

| Sintoma | Skill |
|---|---|
| Query lenta / lista pesada (`pedidos`, `itens_pedido`) | `supabase-postgres-best-practices` |
| Dado sensível exposto ao cliente / tabela sem proteção | `backend-security-coder` + §Segurança |
| Webhook Mercado Pago duplicando/aceitando forjado | `backend-security-coder` (idempotência + validação) |
| Re-render / tela admin lenta | `react-component-performance` |
| Realtime não atualiza (impressão/pedido) | `supabase` (Realtime) — lembrar do polling de fallback |
| Bug de fluxo | `systematic-debugging` → `bug-hunter` |

---

## 🚫 NÃO invoque — quebram esta stack

| Skill | Por quê |
|---|---|
| **`react-state-management`** | Empurra **Redux/Zustand/Jotai/TanStack Query**. Aqui o estado é **React Context** — nenhuma dessas existe. Introduzi-las viola o §3.2 (dependência nova). ⚠️ O §6 do AGENTS a lista como obrigatória — **conflito conhecido, ver abaixo**. |
| `tanstack-query-expert` | Não há TanStack Query. |
| `zod-validation-expert`, skills que assumem **react-hook-form** | ⚠️ **Não há zod nem react-hook-form.** Forms são manuais com `useState`. Se propuser adotar, é decisão de produto (§3.2), não brinde. |
| `nextjs-supabase-auth` | ⚠️ Auth **não** é Supabase Auth — é RPC `verificar_senha_usuario` + `localStorage` (`AdminAuthContext`). A skill faria reescrever o modelo de sessão. |
| `prisma-expert`, ORMs | Sem ORM — `supabase-js`. |
| Skills que assumem **MUI** como sistema principal | MUI está nas deps mas é legado; a UI real é shadcn. |
| Skills que assumem **Tailwind v4** literalmente | É **v3** (`tailwind.config.js`). |
| `jest-skill`, `vitest-skill`, `playwright-*`, `cypress-*`, `webapp-testing` | Sem framework de teste; §3.4 proíbe browser test. |
| Skills que assumem **pnpm** | É **npm**. |
| `stripe-integration` como se fosse o provedor | Pagamento é **Mercado Pago**. |

---

## ⚠️ Conflitos conhecidos com o `AGENTS.md §6`

O §6 manda invocar **`react-state-management`** ao escrever código. Verificado: essa skill recomenda Redux/Zustand/Jotai/TanStack Query, e **este app usa React Context** por decisão. Seguir a skill leva a violar o §3.2. **Trate-a como não aplicável** e siga este documento; se a task realmente exigir repensar estado, peça a decisão (§1/§7).

`typescript-pro` **aqui é válida** (o projeto é `strict: true`), ao contrário do bot — mas ignore recomendações de mudar `tsconfig`, que já está configurado.

---

## Combos por tipo de task

**Nova tela/consulta de dados**
1. Ler 2–3 telas vizinhas + reuso (§5 AGENTS). Reuse `components/ui` e libs de `src/lib`.
2. Prefira **route handler + service role** a mais query client-side com anon (§Segurança).
3. `supabase` / `supabase-postgres-best-practices` → `code-reviewer` → `verification-before-completion`.

**Mexendo em pagamento (Mercado Pago)**
1. `backend-security-coder` + `api-security-best-practices` — webhook idempotente e validado.
2. `verification-before-completion`.

**Trabalho de banco / RLS / performance**
1. `supabase-postgres-best-practices` — via **Management API** (AGENTS §3.8), nunca MCP.
2. Migração de RLS/grants = coordenar web/Electron/bot (§Segurança) → autorização explícita.
