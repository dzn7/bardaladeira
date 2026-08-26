import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

import {
  combinarItensEstoque,
  produtoCorrespondeBuscaEstoque,
} from '../src/lib/estoque-produto.mjs'

test('une produtos e bebidas preservando a tabela de origem', () => {
  const itens = combinarItensEstoque(
    [{ id: 'produto-1', nome: 'X-Burguer', categoria: 'Lanches' }],
    [{ id: 'bebida-1', nome: 'Cerveja Skol', categoria: 'Alcoólicas' }],
  )

  assert.deepEqual(itens.map(({ id, tabela }) => ({ id, tabela })), [
    { id: 'bebida-1', tabela: 'bebidas' },
    { id: 'produto-1', tabela: 'produtos' },
  ])
  assert.equal(itens.filter((item) => produtoCorrespondeBuscaEstoque(item, 'skol')).length, 1)
  assert.equal(itens.find((item) => item.nome === 'Cerveja Skol')?.tabela, 'bebidas')
})

test('tela de estoque consulta as duas origens com colunas explicitas', async () => {
  const pagina = await readFile(
    new URL('../src/app/admin/estoque/page.tsx', import.meta.url),
    'utf8',
  )

  assert.match(pagina, /\.from\('produtos'\)[\s\S]{0,300}\.select\(COLUNAS_ESTOQUE_ADMIN\)/)
  assert.match(pagina, /\.from\('bebidas'\)[\s\S]{0,300}\.select\(COLUNAS_ESTOQUE_ADMIN\)/)
  assert.match(pagina, /combinarItensEstoque/)
})

test('ajuste de estoque encaminha a origem para a RPC correspondente', async () => {
  const estoque = await readFile(new URL('../src/lib/estoque.ts', import.meta.url), 'utf8')
  assert.match(estoque, /tabela\??: 'produtos' \| 'bebidas'/)
  assert.match(estoque, /ajustar_estoque_bebida/)
  assert.match(estoque, /definir_estoque_bebida/)
})
