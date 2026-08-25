import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const migrationPath = new URL(
  '../supabase/migrations/20260820140153_estoque_produtos.sql',
  import.meta.url,
)
const migrationBloqueioSitePath = new URL(
  '../supabase/migrations/20260821192101_estoque_bloqueio_apenas_site.sql',
  import.meta.url,
)

test('migration e aditiva, idempotente e preserva SECURITY INVOKER', async () => {
  const sql = await readFile(migrationPath, 'utf8')
  assert.match(sql, /add column if not exists custo_unitario numeric\(12,2\)/i)
  assert.match(sql, /add column if not exists estoque_quantidade integer/i)
  assert.match(sql, /add column if not exists estoque_quantidade_consumida integer/i)
  assert.match(sql, /security invoker/gi)
  assert.doesNotMatch(sql, /security definer/i)
  assert.match(sql, /revoke all on function public\.ajustar_estoque_produto/i)
  assert.match(sql, /grant execute on function public\.ajustar_estoque_produto[^;]+to anon/i)
})

test('reserva e reconciliacao bloqueiam produtos em ordem estavel', async () => {
  const sql = await readFile(migrationPath, 'utf8')
  const locksOrdenados = sql.match(/order by p\.id[\s\S]{0,80}for update/gi) || []
  assert.ok(locksOrdenados.length >= 2, 'faltam locks ordenados no item e no status do pedido')
  assert.match(sql, /least\(v_estoque, new\.quantidade\)/i)
  assert.match(sql, /estoque_quantidade_consumida/i)
  assert.match(sql, /ESTOQUE_INSUFICIENTE/i)
})

test('os dois fluxos administrativos usam o vinculo compartilhado', async () => {
  const [novoPedido, editarPedido] = await Promise.all([
    readFile(new URL('../src/app/admin/pedidos/novo/page.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/components/admin/ModalEditarPedido.tsx', import.meta.url), 'utf8'),
  ])
  assert.match(novoPedido, /\.insert\(\{[\s\S]{0,180}criarVinculoCatalogoItemPedido\(p\.tipo, p\.id\)/)
  assert.match(editarPedido, /criarVinculoCatalogoItemPedido\(produto\.tipo, produto\.id\)/)
  assert.match(editarPedido, /produto_id: item\.produto_id \|\| null/)
  assert.match(editarPedido, /bebida_id: item\.bebida_id \|\| null/)
  assert.match(editarPedido, /combo_id: item\.combo_id \|\| null/)
})

test('criadores de pedido preservam bebida fora de produto_id', async () => {
  const [novoPedido, tiposNovoPedido, pdv, novoGarcom] = await Promise.all([
    readFile(new URL('../src/app/admin/pedidos/novo/page.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/components/admin/pedidos/novo/tipos.ts', import.meta.url), 'utf8'),
    readFile(new URL('../src/app/admin/pdv/page.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/app/garcom/novo/page.tsx', import.meta.url), 'utf8'),
  ])

  assert.match(tiposNovoPedido, /TipoItemCatalogoPedido = 'produto' \| 'bebida' \| 'combo'/)
  assert.match(novoPedido, /tipo: 'produto' as const,[\s\S]{0,500}tipo: 'bebida' as const/)
  assert.match(novoPedido, /criarVinculoCatalogoItemPedido\(p\.tipo, p\.id\)/)

  assert.match(pdv, /if \(item\.tipo === 'produto'\) insertItem\.produto_id = item\.catalogoId/)
  assert.match(pdv, /if \(item\.tipo === 'bebida'\) insertItem\.bebida_id = item\.catalogoId/)
  assert.match(novoGarcom, /produto_id: p\.produto_id,[\s\S]{0,100}bebida_id: p\.bebida_id/)
})

test('bloqueio de saldo insuficiente pertence somente ao pedido do site', async () => {
  const sql = await readFile(migrationBloqueioSitePath, 'utf8')
  assert.match(sql, /select p\.status, p\.origem[\s\S]+into v_status, v_origem/i)
  assert.match(sql, /v_bloquear and v_origem = 'site' and new\.quantidade > v_estoque/i)
  assert.match(sql, /v_bloquear and v_origem = 'site' and v_item\.quantidade > v_estoque/i)
  assert.match(sql, /security invoker/gi)
  assert.doesNotMatch(sql, /security definer/i)
})

test('criadores de pedido declaram a origem do canal', async () => {
  const [checkout, pagamentoOnline, novoAdmin, novoGarcom] = await Promise.all([
    readFile(new URL('../src/components/ModalCarrinho.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/lib/server/pagamento-online.ts', import.meta.url), 'utf8'),
    readFile(new URL('../src/app/admin/pedidos/novo/page.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/app/garcom/novo/page.tsx', import.meta.url), 'utf8'),
  ])
  assert.match(checkout, /\.from\('pedidos'\)[\s\S]{0,1800}origem: 'site'/)
  assert.match(pagamentoOnline, /\.from\('pedidos'\)[\s\S]{0,1800}origem: 'site'/)
  assert.match(novoAdmin, /\.from\('pedidos'\)[\s\S]{0,1800}origem: 'admin'/)
  assert.match(novoGarcom, /\.from\('pedidos'\)[\s\S]{0,1800}origem: 'garcom'/)
})

test('tela de estoque expoe o toggle de esgotado no site', async () => {
  const paginaEstoque = await readFile(
    new URL('../src/app/admin/estoque/page.tsx', import.meta.url),
    'utf8',
  )
  assert.match(paginaEstoque, /<Interruptor/)
  assert.match(paginaEstoque, /bloquear_venda_sem_estoque/)
  assert.match(paginaEstoque, /Esgotado no site/)
})
