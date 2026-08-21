import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const migrationPath = new URL(
  '../supabase/migrations/20260820140153_estoque_produtos.sql',
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
