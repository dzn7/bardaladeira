import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const migrationPath = new URL(
  '../supabase/migrations/20260825233500_estoque_bebidas_catalogo.sql',
  import.meta.url,
)

test('migration adiciona promocao custo e estoque de bebidas sem backfill inventado', async () => {
  const sql = await readFile(migrationPath, 'utf8')

  assert.match(sql, /alter table public\.bebidas[\s\S]+add column if not exists preco_original numeric\(12,2\)/i)
  assert.match(sql, /add column if not exists desconto numeric\(5,2\)/i)
  assert.match(sql, /add column if not exists custo_unitario numeric\(12,2\)/i)
  assert.match(sql, /add column if not exists estoque_quantidade integer not null default 0/i)
  assert.match(sql, /add column if not exists estoque_minimo integer not null default 5/i)
  assert.match(sql, /add column if not exists bloquear_venda_sem_estoque boolean not null default false/i)
  assert.match(sql, /bebidas_estoque_quantidade_nao_negativa_ck/i)
  assert.match(sql, /bebidas_estoque_minimo_nao_negativo_ck/i)
  assert.doesNotMatch(sql, /set custo_unitario\s*=/i)
})

test('RPCs de bebida sao invoker, tipadas e com privilegios explicitos', async () => {
  const sql = await readFile(migrationPath, 'utf8')

  assert.match(sql, /function public\.ajustar_estoque_bebida\(\s*p_bebida_id uuid,\s*p_delta integer/i)
  assert.match(sql, /function public\.definir_estoque_bebida\(\s*p_bebida_id uuid,\s*p_quantidade integer/i)
  assert.match(sql, /security invoker/gi)
  assert.doesNotMatch(sql, /security definer/i)
  assert.match(sql, /set search_path = ''/gi)
  assert.match(sql, /revoke all on function public\.ajustar_estoque_bebida\(uuid, integer\) from public/i)
  assert.match(sql, /grant execute on function public\.ajustar_estoque_bebida\(uuid, integer\)[\s\S]+to anon, authenticated, service_role/i)
})

test('gatilhos de pedido consomem e restauram produto ou bebida', async () => {
  const sql = await readFile(migrationPath, 'utf8')

  assert.match(sql, /create or replace function public\.sincronizar_estoque_item_pedido\(\)/i)
  assert.match(sql, /old\.bebida_id/i)
  assert.match(sql, /new\.bebida_id/i)
  assert.match(sql, /update public\.bebidas/i)
  assert.match(sql, /create or replace function public\.reconciliar_estoque_status_pedido\(\)/i)
  assert.match(sql, /ip\.bebida_id/i)
  assert.match(sql, /order by p\.id[\s\S]{0,80}for update/gi)
})
