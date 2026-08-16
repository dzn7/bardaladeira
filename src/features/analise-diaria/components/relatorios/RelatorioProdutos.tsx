'use client'

import type { ProdutoVendido } from '../../types'
import { formatarMoeda } from '../../lib/formatadores'

type RelatorioProdutosProps = {
  produtos: ProdutoVendido[]
}

export const RelatorioProdutos = ({ produtos }: RelatorioProdutosProps) => {
  if (!produtos.length) {
    return <p className="py-8 text-center text-sm text-muted-foreground">Nenhum produto vendido.</p>
  }

  const top = produtos.slice(0, 25)
  const receitaTop = top.reduce((s, p) => s + p.receita, 0)
  const qtdMax = Math.max(...top.map((p) => p.quantidade), 1)

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border/60 text-left text-xs text-muted-foreground">
            <th className="w-8 pb-2 font-medium">#</th>
            <th className="pb-2 font-medium">Produto</th>
            <th className="hidden pb-2 text-right font-medium sm:table-cell">Pedidos</th>
            <th className="pb-2 text-right font-medium">Qtd</th>
            <th className="hidden min-w-[7rem] pb-2 font-medium md:table-cell">Participação</th>
            <th className="pb-2 text-right font-medium">Receita</th>
            <th className="hidden pb-2 text-right font-medium sm:table-cell">%</th>
          </tr>
        </thead>
        <tbody>
          {top.map((produto, index) => {
            const pctReceita = receitaTop > 0 ? (produto.receita / receitaTop) * 100 : 0
            const pctBarra = (produto.quantidade / qtdMax) * 100
            return (
              <tr key={produto.nome} className="border-b border-border/40 last:border-0">
                <td className="py-2.5 tabular-nums text-muted-foreground">{index + 1}</td>
                <td className="max-w-[12rem] py-2.5 font-medium text-foreground sm:max-w-none">
                  <span className="line-clamp-2 sm:line-clamp-1">{produto.nome}</span>
                  <span className="mt-0.5 block text-[11px] font-normal text-muted-foreground sm:hidden">
                    {produto.pedidos} ped. · {pctReceita.toFixed(0)}%
                  </span>
                </td>
                <td className="hidden py-2.5 text-right tabular-nums text-muted-foreground sm:table-cell">
                  {produto.pedidos}
                </td>
                <td className="py-2.5 text-right tabular-nums text-foreground">{produto.quantidade}×</td>
                <td className="hidden py-2.5 md:table-cell">
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary/70"
                      style={{ width: `${pctBarra}%` }}
                    />
                  </div>
                </td>
                <td className="py-2.5 text-right tabular-nums text-foreground">
                  {formatarMoeda(produto.receita)}
                </td>
                <td className="hidden py-2.5 text-right tabular-nums text-muted-foreground sm:table-cell">
                  {pctReceita.toFixed(1)}%
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
