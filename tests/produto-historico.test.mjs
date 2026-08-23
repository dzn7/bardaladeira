import test from 'node:test'
import assert from 'node:assert/strict'
import { readdir, readFile } from 'node:fs/promises'

const raiz = new URL('..', import.meta.url)
const caminho = (relativo) => new URL(relativo, raiz)

const lerMigration = async () => {
  const arquivos = await readdir(caminho('supabase/migrations'))
  const nome = arquivos.find((arquivo) => /produto_historico/i.test(arquivo))
  assert.ok(nome, 'a migration produto_historico deve existir')
  return readFile(caminho(`supabase/migrations/${nome}`), 'utf8')
}

test('audit trail de produto é privado, append-only e indexado para cursor', async () => {
  const sql = await lerMigration()

  assert.match(sql, /create table if not exists public\.produto_historico_eventos/i)
  assert.match(sql, /create table if not exists public\.produto_promocoes_historico/i)
  assert.match(sql, /enable row level security/i)
  assert.match(sql, /revoke all on table public\.produto_historico_eventos from anon, authenticated/i)
  assert.match(sql, /revoke all on table public\.produto_promocoes_historico from anon, authenticated/i)
  assert.match(sql, /produto_id, ocorreu_em desc, id desc/i)
  assert.match(sql, /produto_id, categoria, ocorreu_em desc, id desc/i)
  assert.match(sql, /before update or delete on public\.produto_historico_eventos/i)
})

test('mudanças e promoções são registradas pelo banco, sem evento para valor idêntico', async () => {
  const sql = await lerMigration()

  assert.match(sql, /after insert or update on public\.produtos/i)
  assert.match(sql, /old\.preco is not distinct from new\.preco/i)
  assert.match(sql, /promocao_iniciada/i)
  assert.match(sql, /promocao_alterada/i)
  assert.match(sql, /promocao_encerrada/i)
  assert.match(sql, /produto_ocultado/i)
  assert.match(sql, /produto_publicado/i)
})

test('estoque preserva causa sem duplicar a reserva e o cancelamento', async () => {
  const sql = await lerMigration()

  assert.match(sql, /ajuste_estoque/i)
  assert.match(sql, /estoque_reservado_pedido/i)
  assert.match(sql, /estoque_restaurado_pedido/i)
  assert.match(sql, /set_config\('app\.produto_historico_contexto'/i)
  assert.match(sql, /old\.status is not distinct from new\.status/i)
  assert.match(sql, /estoque_esgotado/i)
  assert.match(sql, /estoque_recuperado/i)
})

test('venda futura congela episódio, preço-base e preço promocional', async () => {
  const sql = await lerMigration()

  assert.match(sql, /add column if not exists promocao_produto_historico_id uuid/i)
  assert.match(sql, /add column if not exists preco_base_produto numeric/i)
  assert.match(sql, /add column if not exists preco_promocional_produto numeric/i)
  assert.match(sql, /trg_snapshot_promocao_item_pedido/i)
  assert.match(sql, /promocao_produto_historico_id/i)
  assert.match(sql, /count\(distinct (?:ip\.)?pedido_id\)/i)
  assert.match(sql, /sum\((?:ip\.|v\.)?subtotal\)/i)
})

test('Dialog e rota administrativa usam dados agregados e paginação cursor', async () => {
  const [dialog, rota] = await Promise.all([
    readFile(caminho('src/components/admin/produtos/DialogHistoricoProduto.tsx'), 'utf8'),
    readFile(caminho('src/app/api/admin/produtos/[id]/historico/route.ts'), 'utf8'),
  ])

  assert.match(dialog, /Histórico do produto/i)
  assert.match(dialog, /Carregar mais/i)
  assert.match(dialog, /Promise\.all/i)
  assert.match(dialog, /resposta\.text\(\)/i)
  assert.match(dialog, /Histórico indisponível no servidor/i)
  assert.match(rota, /autorizarAdminLegado/i)
  assert.match(rota, /obterSupabaseAdmin\(\{ exigirServiceRole: true \}\)/i)
  assert.match(rota, /CURSOR_INVALIDO|cursor/i)
})

test('Vercel não redireciona APIs do Next para localhost', async () => {
  const configuracao = JSON.parse(await readFile(caminho('vercel.json'), 'utf8'))

  assert.ok(
    !(configuracao.rewrites || []).some((regra) => regra.source === '/api/:path*' && /localhost/i.test(regra.destination)),
    'rotas /api devem ser atendidas pelos route handlers publicados, não por localhost',
  )
})

test('sessão administrativa envia o UUID real ao histórico do produto', async () => {
  const [contexto, pdv] = await Promise.all([
    readFile(caminho('src/contexts/AdminAuthContext.tsx'), 'utf8'),
    readFile(caminho('src/app/admin/pdv/page.tsx'), 'utf8'),
  ])

  assert.match(pdv, /admin-supabase-\$\{resultado\.usuario\.id\}/)
  assert.doesNotMatch(pdv, /admin-supabase-\$\{Date\.now\(\)\}/)
  assert.match(contexto, /admin-supabase-\$\{sessaoSalva\.id\}/)
})

test('token administrativo client espelha as mesmas regras do servidor', async () => {
  const [helper, servidor] = await Promise.all([
    readFile(caminho('src/lib/token-admin.ts'), 'utf8'),
    readFile(caminho('src/lib/server/autorizacao-admin-legada.ts'), 'utf8'),
  ])

  assert.match(helper, /admin-authenticated-bar-da-ladeira/)
  assert.match(helper, /admin-authenticated-dzndev/)
  assert.match(helper, /export function tokenAdminEhValido/)
  assert.match(helper, /export function lerTokenAdmin/)

  const padraoUuidServidor = servidor.match(/\/\^admin-supabase-[^/]+\//)?.[0]
  const padraoUuidCliente = helper.match(/\/\^admin-supabase-[^/]+\//)?.[0]
  assert.ok(padraoUuidServidor, 'servidor define o padrão do token supabase')
  assert.equal(padraoUuidCliente, padraoUuidServidor, 'cliente usa o mesmo padrão do servidor')
})

test('estado administrativo corrompido se auto-repara em vez de travar em Não autorizado', async () => {
  const [contexto, protegida] = await Promise.all([
    readFile(caminho('src/contexts/AdminAuthContext.tsx'), 'utf8'),
    readFile(caminho('src/components/admin/ProtectedRoute.tsx'), 'utf8'),
  ])

  assert.match(contexto, /tokenAdminEhValido/)
  assert.match(contexto, /localStorage\.removeItem\('adminToken'\)/)
  assert.match(protegida, /tokenAdminEhValido/)
})

test('401 no histórico orienta novo login em vez de exibir apenas Não autorizado', async () => {
  const dialog = await readFile(
    caminho('src/components/admin/produtos/DialogHistoricoProduto.tsx'),
    'utf8',
  )

  assert.match(dialog, /resposta\.status === 401/)
  assert.match(dialog, /Faça login novamente/)
})
