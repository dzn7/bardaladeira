'use client'

import { Warning as AlertTriangle, Package as PackageCheck, Receipt as ReceiptText, TrendUp as TrendingUp } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'
import { Selo } from '@/components/admin/ui'
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
          <h3 id="titulo-lucro-bruto" className="text-base font-semibold text-foreground">Lucro bruto de produtos</h3>
          <p className="text-sm text-muted-foreground">Quanto sobrou das vendas depois do custo de cada item na hora da venda.</p>
        </div>
        {resumo.receitaSemCusto > 0 ? (
          <Selo tom="alerta" className="mt-2 w-fit sm:mt-0">
            <AlertTriangle className="size-3.5" /> Cobertura parcial
          </Selo>
        ) : null}
      </div>

      {erro ? (
        <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">{erro}</div>
      ) : null}

      <div className="grid grid-cols-1 divide-y divide-border/70 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        {[
          { rotulo: 'Receita com custo', valor: resumo.receitaComCusto, Icone: ReceiptText },
          { rotulo: 'Custo dos produtos', valor: resumo.custoConhecido, Icone: PackageCheck },
          { rotulo: 'Lucro bruto', valor: resumo.lucroBrutoConhecido, Icone: TrendingUp },
        ].map(({ rotulo, valor, Icone }) => (
          <div key={rotulo} className="py-3 sm:px-4 sm:py-1 sm:first:pl-0">
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
        <div className="rounded-lg bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-300">
          {mostrar(resumo.receitaSemCusto)} em receita e {resumo.unidadesSemCusto} unidade{resumo.unidadesSemCusto === 1 ? '' : 's'} estão sem custo histórico. Esses valores não entram no lucro acima.
        </div>
      ) : null}

      {principais.length > 0 ? (
        <>
          <ul className="divide-y divide-border/70 sm:hidden">
            {principais.map((item) => (
              <li key={`${item.mes}:${item.produto_id || item.nome_produto}`} className="flex items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{item.nome_produto}</p>
                  <p className="mt-0.5 text-[13px] tabular-nums text-muted-foreground">
                    {item.quantidade} un. · custo {mostrar(item.custo_mercadorias)} · {item.margem_bruta.toFixed(2)}%
                  </p>
                </div>
                <span className="shrink-0 text-sm font-semibold tabular-nums text-foreground">{mostrar(item.lucro_bruto)}</span>
              </li>
            ))}
          </ul>
          <div className="hidden overflow-x-auto rounded-lg border border-border/70 sm:block">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
                <tr><th className="px-3 py-2 font-medium">Produto</th><th className="px-3 py-2 text-right font-medium">Qtd.</th><th className="px-3 py-2 text-right font-medium">Custo</th><th className="px-3 py-2 text-right font-medium">Lucro bruto</th><th className="px-3 py-2 text-right font-medium">Margem</th></tr>
              </thead>
              <tbody className="divide-y divide-border/70">
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
        </>
      ) : !carregando && !erro ? (
        <p className="rounded-lg border border-dashed border-border/70 p-5 text-center text-sm text-muted-foreground">Nenhuma venda com custo histórico no período.</p>
      ) : null}
    </section>
  )
}

