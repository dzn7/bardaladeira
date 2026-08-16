# AGENTS.md — Regras Operacionais para Agentes de IA

> **Análise cuidadosa · alterações seguras · máxima aderência ao código existente.**

Este documento é **normativo**. Toda instrução aqui tem precedência sobre suposições, hábitos do modelo ou padrões "recomendados" externos. Se você é um agente de IA lendo isto: você **não está autorizado** a escrever código antes de cumprir o §2.

App: **sistema de restaurante/delivery do Bar da Ladeira** — admin (PDV, caixa, pedidos, produtos, mesas, crediário, finanças), app do garçom, app do entregador, cardápio público e pagamentos Mercado Pago. Documentos irmãos: [`SKILLS.md`](SKILLS.md) · [`PRD.md`](PRD.md) · [`Progress.md`](Progress.md) · [`UI.md`](UI.md).

O código deste repositório veio da **Edienai Lanches somente como base inicial**. O produto oficial daqui para frente é **Bar da Ladeira**. Identificador técnico/slug: `bar-da-ladeira`. Nenhuma implementação futura deve voltar a usar nomenclaturas, marcas, textos visíveis ou slugs de produto da Edienai Lanches. Identificadores externos já existentes (project ref do Supabase, instância Evolution, valores gravados no banco) só mudam com autorização explícita — não rebatizar infraestrutura às cegas.

## §0. Template de Tarefa (aplique a TODA task)

**Independente de como o pedido chegar** — uma frase, um print, um áudio transcrito, um "arruma isso" — a sua **primeira ação** é enquadrar a task neste template e devolver o bloco preenchido **antes de tocar em qualquer arquivo**. Derive os campos da task + leitura do código; não pergunte o que dá para descobrir lendo. O que não der para derivar e mudar o resultado → §7 (pare e pergunte).

### §0.1 Abra a resposta com este bloco

```
TASK ENQUADRADA
- Objetivo: <o resultado esperado, 1–2 frases — não a implementação>
- Área: <admin | garçom | entregador | cardápio público | api/route handler |
         pagamento MP | banco/Supabase> + arquivos prováveis
- Fora de escopo: <o que você NÃO vai tocar>
- Toca dado sensível ou banco? <sim/não — qual tabela; lembrar §Segurança>
- Pronto quando: <critério observável: "webhook MP idempotente rejeita duplicado",
                  "lista de pedidos do admin filtra por dia sem trazer todos">
- Orçamento de arquivos: "deve tocar N arquivos: X, Y, Z"
- Reuso encontrado: <o que já existe (§5)> | nenhum (grep: "<termos>")
- Skills lidas: SKILLS.md ✓  (obrigatório — diz quais valem e quais quebram a stack)
```

Se não puder preencher honestamente, **pare e pergunte** (§7). Depois execute o protocolo §2.

### §0.2 Regras que valem em toda task

1. **Orçamento estourou 2×?** O desenho está errado, não a execução — pare e reavalie. Diff mínimo (§4).
2. **Mesma edição semântica em ≥3 arquivos** = abstração faltando. Pare e proponha. Mas não abstraia no 1º uso; no 2º, duplique. (Regra dos 3 usos, coerente com §4/§5.)
3. **Vai mudar contrato** (props, tipo exportado, retorno de route handler, shape de query)? `grep` os call sites **antes**.
4. **Discorde quando for o caso.** Pedido errado, ambíguo, ou com caminho mais simples → diga **antes** de executar. Não faça silenciosamente algo diferente do pedido.
5. **Dado de demonstração do onboarding é sempre client-side.** Qualquer tutorial que precise de um alvo (a "div interativa") cria o dado de exemplo **em memória no cliente** (store externa, ex.: `src/features/onboarding/demo/*`) e o remove ao concluir/fechar/abandonar. **Nunca** grava, altera ou apaga registro real no Supabase para fins de tutorial. Ver `src/features/onboarding/` e UI.md §Onboarding.
6. **Onboarding dirige a UI REAL — proibido componente paralelo.** O tutorial deve ensinar usando o **mesmo modal, linha, dropdown e botões que a tela já tem** (injetando o dado de exemplo no fluxo real e blindando as ações por `id`). É **proibido** criar um modal/card/lista paralelo que duplique o que já existe — gera confusão e viola o §5. Reusar > estender > generalizar > criar.

### §0.3 Stack real (para não escrever código de versão/ferramenta errada)

**Next 16 App Router** · **React 18** · **TS `strict: true`** · UI **shadcn/ui + Radix + framer-motion + Tailwind v3** (MUI/Emotion são legado, não use) · estado **React Context** (sem Redux/Zustand/TanStack) · **sem zod / sem react-hook-form** (forms manuais) · **Supabase** (anon no browser + service role no server) · **Mercado Pago** · **npm** · **Vercel** · sem framework de teste. Detalhes e skills por área: [`SKILLS.md`](SKILLS.md).

### §0.4 Verificação e fechamento

Comandos: `npx tsc --noEmit` (typecheck; **não há script `typecheck`**) · `npm run lint`. Rodou **nesta resposta**, ou não rodou — "deve passar" não conta. Feche com o bloco `CONCLUÍDO` do §8, acrescentando **arquivos vs. orçamento** (§0.1) e **decisão que tomei sozinho e você deveria revisar**.

## §1. Hierarquia de regras (resolução de conflitos)

Quando duas orientações conflitarem, obedeça nesta ordem:

1. Instrução explícita e recente do usuário nesta sessão
2. `AGENTS.md` do subdiretório onde você está editando
3. Este `AGENTS.md` (raiz)
4. `PRD.md` / `Progress.md` / `UI.md`
5. Padrões observados na base de código existente
6. Convenções gerais da linguagem/framework
7. Sua opinião sobre "a melhor prática"

**Nunca** promova o item 7 acima dos demais. Se você discordar de um padrão do projeto, diga isso — não o contorne silenciosamente.

## §2. Protocolo de início de sessão (bloqueante)

Nenhuma edição de arquivo é permitida antes de concluir **todos** os passos abaixo.

- [ ] Ler `AGENTS.md` da raiz **e** o `AGENTS.md` do subdiretório alvo (se existir)
- [ ] Ler `PRD.md`, `Progress.md` e `UI.md`. Se não existirem, **criá-los** conforme §9 antes de prosseguir
- [ ] Ler no mínimo **2–3 arquivos vizinhos** do código a ser alterado (mesmo diretório ou imports diretos)
- [ ] Rodar `grep` / busca semântica para checar se o que você vai criar **já existe** (§5)
- [ ] Declarar em uma frase: o que vai mudar, onde, e por quê

Abra sua primeira resposta da sessão com:

```text
CONTEXTO CARREGADO
- AGENTS.md: [raiz | raiz + <subdir>]
- Docs lidos: PRD.md ✓ | Progress.md ✓ | UI.md ✓  (ou "criados")
- Arquivos vizinhos lidos: <lista>
- Reuso encontrado: <o que já existe> | nenhum (grep: "<termos usados>")
- Plano: <1 frase>
```

Se você não pode preencher essa saída honestamente, **pare e pergunte**.

## §3. Regras invioláveis

| # | Regra |
|---|---|
| 1 | **Nenhum comando Git** (`commit`, `push`, `checkout`, `reset`, `rebase`, `stash`, `branch`, `merge`) sem autorização explícita e literal do usuário nesta sessão. Ler estado (`status`, `diff`, `log`) é permitido. |
| 2 | **Nenhuma dependência nova** (npm/pip/cargo/etc.), lib, framework ou padrão arquitetural sem alinhamento prévio. Proponha, aguarde aprovação. |
| 3 | **Nenhuma regressão.** Não remova, renomeie ou altere assinatura de código existente fora do escopo da task. |
| 4 | **Nenhum Playwright / teste de browser.** A verificação é feita **pelo código**: typecheck, lint e leitura do diff. |
| 5 | **Nenhuma alteração fora do escopo.** Não "aproveite para" refatorar, reformatar, reorganizar imports ou "melhorar" arquivos que a task não pediu. |
| 6 | **Não invente.** Se um arquivo, função, env var ou endpoint não foi verificado por você, não afirme que ele existe. |
| 7 | **Não delete comentários, testes ou código morto** sem pedir. Código que parece inútil frequentemente não é. |
| 8 | **Supabase administrativo somente pela Management API.** Para análise, migrations, SQL, schema e verificações de produção, use `https://api.supabase.com` com o access token fornecido pelo usuário; não use MCP. Nunca persista o token no repositório, logs ou documentação. |
| 9 | **Segurança de dados (§3.9).** O banco está **sem RLS e aberto pela anon key** (ver abaixo). Não amplie a exposição; prefira route handler server-side. Não traga dado sensível (`senha_hash`, `usuarios_sistema`, tokens) para componente client. |

### §3.9 🔴 Estado de segurança do banco (verificado 2026-07-19)

**As 50 tabelas do Supabase estão sem RLS**, e os roles `anon`/`authenticated` têm grant **total** (inclusive `DELETE`/`TRUNCATE`) em `usuarios_cliente`, `pedidos`, `pagamentos_pedido`, `crediario_contas`, `usuarios_sistema` (com `senha_hash`) e outras. A **anon key vai para o browser** e 69 componentes consultam tabelas direto. Ou seja: quem tiver a anon key (pública, no bundle) pode ler todos os clientes/pedidos/pagamentos/hashes e apagar tabelas.

- Ao criar consulta nova, **prefira route handler em `src/app/api/*` com `supabase-admin` (service role)** a mais uma query client-side com anon.
- **Nunca** exponha ao cliente dado mais sensível do que o já exposto; nada de `usuarios_sistema`/`senha_hash`/tokens em client.
- Corrigir a base (RLS + policies + revogar grants do anon + mover queries para o servidor) é **migração coordenada** entre web, Electron e bot — **tarefa própria com autorização**, nunca de brinde. Detalhes: [`SKILLS.md`](SKILLS.md) §Segurança e [`PRD.md`](PRD.md) §Segurança.

### §3.10 🔴 `.env.local` versionado

`.env.local` **está rastreado no git** (contém `MERCADO_PAGO_ACCESS_TOKEN`, `EVOLUTION_API_KEY`, `VERCEL_OIDC_TOKEN`), apesar de estar no `.gitignore` — foi commitado antes. Nunca imprima/cole o conteúdo dele; não adicione segredo novo esperando proteção do `.gitignore`. Remediação (untrack + rotação + limpeza de histórico) é tarefa própria com autorização.

## §4. Padrão e arquitetura

- Siga **estritamente** o padrão da base de código existente: nomenclatura, estrutura de pastas, tratamento de erro, estilo de tipagem, forma de exportação, camadas.
- Antes de introduzir uma abstração, pergunte-se: *"existem 3+ usos reais hoje?"* Se não, não abstraia.
- Menor diff possível que resolve o problema completo. Elegância > engenhosidade.
- Mudanças que atravessam camadas (ex.: UI → domínio → infra) exigem pausa e confirmação (§7).
- Ao alterar contrato público (props, tipo exportado, retorno de API), liste **todos** os call sites afetados antes de editar.

## §5. Reutilização antes de criação

Antes de criar **qualquer** componente, hook, função utilitária, tipo, schema, constante ou estrutura:

1. Busque no projeto. Exemplos de varredura mínima:
   ```bash
   grep -rn "NomeProvavel" src/ --include=*.ts --include=*.tsx
   grep -rni "verbo\|substantivo" src/**/utils src/**/hooks src/**/components
   ```
2. Cheque os barris/índices (`index.ts`), a pasta de `shared/`, `lib/`, `ui/`, `types/`.
3. Ordem de preferência:
   **reusar** → **estender o existente** → **generalizar o existente** → **criar novo**

Criar algo novo exige justificar em uma linha por que as três opções anteriores falharam.

## §6. Skills

### §6.1 Leitura obrigatória (bloqueante)

Antes de codificar, **leia [`SKILLS.md`](SKILLS.md)** — obrigatório, independente de você pretender invocar alguma skill. Ele lista o que vale para a stack real (Next 16 / shadcn / Supabase / Mercado Pago) e **o que a quebra**, com os conflitos conhecidos. Declare "Skills lidas: SKILLS.md ✓" no bloco `TASK ENQUADRADA` (§0.1). Skill que contradiz este AGENTS ou o SKILLS.md: **eles vencem**.

### §6.2 Skills obrigatórias por momento

| Momento | Skills |
|---|---|
| Bug / erro / comportamento inesperado | `systematic-debugging` (**antes** do fix) |
| Ao escrever/alterar código | `typescript-pro` (o projeto é `strict: true`) |
| Banco / consulta / RLS | `supabase-postgres-best-practices` + `supabase` |
| Route handler / webhook / dado sensível | `backend-security-coder` (ver §3.9) |
| Antes de declarar concluído | `bug-hunter`, `verification-before-completion` |

> ⚠️ O `react-state-management` **não** é aplicável aqui (o estado é React Context; a skill empurra Redux/Zustand). Ver `SKILLS.md` §Conflitos conhecidos. Não a invoque.

Invocar a skill certa é obrigatório, não opcional. Se uma skill apontar um problema, **corrija antes de responder** — não relate o problema e entregue mesmo assim.

## §7. Ambiguidade → pare

Pause e pergunte, **antes de codificar**, quando:

- A task admite duas interpretações razoáveis
- Existe uma decisão arquitetural embutida (onde mora o estado, quem é dono do dado, qual camada valida)
- O padrão do projeto é ambíguo ou você encontrou dois padrões conflitantes
- A mudança exigiria dependência nova, quebra de contrato ou migração
- Você precisaria adivinhar o nome de um arquivo, env var ou endpoint

Formato da pergunta: **contexto + as opções + sua recomendação + o que você faria por padrão.** Uma pergunta por vez, direta.

Adivinhar custa mais caro que perguntar. Sempre.

## §8. Definição de "concluído"

Uma task só está concluída quando **todos** os itens abaixo são verdadeiros e você os declara explicitamente:

- [ ] `typecheck` executado nos arquivos editados — **zero** erros
- [ ] `lint` executado nos arquivos editados — **zero** erros e zero warnings novos
- [ ] Skill `bug-hunter` executada
- [ ] Skill `verification-before-completion` executada
- [ ] Diff relido linha a linha: nenhuma alteração fora do escopo
- [ ] Nenhum `TODO`, `console.log`, código comentado ou stub deixado para trás
- [ ] `Progress.md` atualizado (§9)
- [ ] `PRD.md` / `UI.md` atualizados **se** o escopo ou a interface mudaram

Encerre com:

```text
CONCLUÍDO
- Arquivos alterados: <lista>
- typecheck: ✓ 0 erros | lint: ✓ 0 erros
- bug-hunter: ✓ | verification-before-completion: ✓
- Docs atualizados: Progress.md ✓ | PRD.md ✓/n-a | UI.md ✓/n-a
- Fora do escopo: nada
- Riscos / o que não foi coberto: <honesto, ou "nenhum">
```

**"Deve funcionar" não é verificação.** Se você não rodou, não está concluído. Se algo falhou e você não conseguiu resolver, diga — entregar quebrado silenciosamente é a única falha inaceitável.

## §9. Documentação viva (obrigatória)

O objetivo é **zero perda de contexto** entre sessões, entre modelos e entre agentes. Um agente novo, lendo apenas estes três arquivos, deve conseguir retomar o trabalho sem fazer perguntas básicas.

Se qualquer um dos arquivos abaixo não existir, **crie-o na primeira ação da sessão**, preenchido com o que for possível inferir da base de código, e sinalize as lacunas com `[?]`.

### `PRD.md` — o que é o projeto e por quê

Estável. Muda pouco. Atualize quando o escopo mudar.

```markdown
# PRD — <Nome do Projeto>
## Problema
## Usuário e caso de uso
## Escopo (o que é)
## Fora de escopo (o que explicitamente NÃO é)
## Stack e decisões arquiteturais
| Decisão | Escolha | Por quê | Data |
## Glossário de domínio
## Restrições e não-negociáveis
```

### `Progress.md` — o que já foi feito

Append-only. **Nunca reescreva ou apague entradas antigas.** Entrada nova no topo.

```markdown
# Progress

## [AAAA-MM-DD] <Título curto da task>
**Agente/Modelo:** <ex: Claude Opus 4.8>
**Objetivo:** 1 frase
**Arquivos alterados:** <lista>
**O que foi feito:** bullets objetivos
**Decisões tomadas:** e o motivo
**Verificação:** typecheck ✓ · lint ✓ · bug-hunter ✓
**Pendências / próximos passos:**
**Armadilhas descobertas:** (o que o próximo agente precisa saber para não errar)
```

### `UI.md` — o sistema de interface

Fonte da verdade visual. Consulte **antes** de criar qualquer componente.

```markdown
# UI
## Design tokens (cores, espaçamento, tipografia, radius, sombras)
## Componentes existentes  ← consulte aqui antes de criar qualquer coisa
| Componente | Caminho | Props principais | Quando usar |
## Padrões de layout, estados (loading/erro/vazio), responsividade
## Acessibilidade: regras mínimas
## Anti-padrões (o que já foi tentado e rejeitado, e por quê)
```

### Regra de ouro da documentação

> **Se não está documentado, não aconteceu.**
> Toda alteração de código exige a atualização correspondente de documentação **no mesmo turno**, antes de declarar a task concluída. Documentação não é entrega opcional — é parte do diff.

## §10. Nota para o `CLAUDE.md`

O `CLAUDE.md` da raiz deve conter apenas:

```markdown
# CLAUDE.md
Leia e obedeça integralmente o `AGENTS.md` da raiz antes de qualquer ação.
Leia também o `AGENTS.md` do subdiretório alvo, se existir.

Contexto obrigatório a cada sessão: PRD.md · Progress.md · UI.md
Se não existirem, crie-os conforme §9 do AGENTS.md antes de codificar.

Nenhum comando Git sem autorização explícita.
```

Fonte única da verdade: este arquivo. Não duplique regras — aponte para elas.
