'use client'

import { AlertTriangle, PackageCheck, ReceiptText, TrendingUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatarMoeda } from '../lib/formatadores'
import type { LucroProduto, ResumoLucroProdutos as ResumoLucro } from '../types'

type Props = {
  resumo: ResumoLucro
  produtos: LucroProduto[]
  carregando?: boolean
  erro?: string | null
  valoresOcultos: boolean
}

export function ResumoLucroProdutos({ resumo, produtos, carregando, erro, valoresOcultos }: Props) {
  const mostrar = (valor: number) => valoresOcultos ? '••••••' : formatarMoeda(valor)
  const principais = [...produtos]
    .filter((item) => item.receita_com_custo > 0)
    .sort((a, b) => b.lucro_bruto - a.lucro_bruto)
    .slice(0, 5)

  return (
    <section className="space-y-4 rounded-xl border border-border/70 bg-card p-4 sm:p-5" aria-labelledby="titulo-lucro-bruto">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 id="titulo-lucro-bruto" className="text-base font-semibold tracking-tight">Lucro bruto de produtos</h3>
          <p className="text-sm text-muted-foreground">Venda líquida dos itens menos o custo congelado no momento da venda.</p>
        </div>
        {resumo.receitaSemCusto > 0 ? (
          <span className="mt-2 inline-flex w-fit items-center gap-1.5 rounded-full border border-amber-300/60 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300 sm:mt-0">
            <AlertTriangle className="size-3.5" /> Cobertura parcial
          </span>
        ) : null}
      </div>

      {erro ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">{erro}</div>
      ) : null}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[
          { rotulo: 'Receita com custo', valor: resumo.receitaComCusto, Icone: ReceiptText },
          { rotulo: 'CMV conhecido', valor: resumo.custoConhecido, Icone: PackageCheck },
          { rotulo: 'Lucro bruto conhecido', valor: resumo.lucroBrutoConhecido, Icone: TrendingUp },
        ].map(({ rotulo, valor, Icone }) => (
          <div key={rotulo} className="rounded-lg border border-border/60 bg-muted/20 p-3.5">
            <div className="flex items-center gap-2 text-xs text-muted-foreground"><Icone className="size-4" /> {rotulo}</div>
            {carregando ? <div className="mt-2 h-6 w-24 animate-pulse rounded bg-muted" /> : (
              <p className={cn(
                'mt-1 text-lg font-semibold tabular-nums',
                rotulo.startsWith('Lucro') && (valor >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive'),
              )}>{mostrar(valor)}</p>
            )}
          </div>
        ))}
      </div>

      {!carregando && resumo.receitaComCusto > 0 ? (
        <p className="text-sm text-muted-foreground">
          Margem bruta conhecida: <strong className="font-semibold text-foreground">{resumo.margemBrutaConhecida.toFixed(2)}%</strong>
        </p>
      ) : null}

      {!carregando && resumo.receitaSemCusto > 0 ? (
        <div className="rounded-lg border border-amber-300/50 bg-amber-50/70 px-3 py-2 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/20 dark:text-amber-200">
          {mostrar(resumo.receitaSemCusto)} em receita e {resumo.unidadesSemCusto} unidade{resumo.unidadesSemCusto === 1 ? '' : 's'} estão sem custo histórico. Esses valores não entram no lucro acima.
        </div>
      ) : null}

      {principais.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border border-border/60">
          <table className="w-full min-w-[560px] text-sm">
            <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
              <tr><th className="px-3 py-2 font-medium">Produto</th><th className="px-3 py-2 text-right font-medium">Qtd.</th><th className="px-3 py-2 text-right font-medium">CMV</th><th className="px-3 py-2 text-right font-medium">Lucro bruto</th><th className="px-3 py-2 text-right font-medium">Margem</th></tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {principais.map((item) => (
                <tr key={`${item.mes}:${item.produto_id || item.nome_produto}`}>
                  <td className="max-w-[220px] truncate px-3 py-2.5 font-medium">{item.nome_produto}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{item.quantidade}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{mostrar(item.custo_mercadorias)}</td>
                  <td className="px-3 py-2.5 text-right font-medium tabular-nums">{mostrar(item.lucro_bruto)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{item.margem_bruta.toFixed(2)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : !carregando && !erro ? (
        <p className="rounded-lg border border-dashed border-border p-5 text-center text-sm text-muted-foreground">Nenhuma venda com custo histórico no período.</p>
      ) : null}
    </section>
  )
}

