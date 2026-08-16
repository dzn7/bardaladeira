'use client'

import { useCallback, useMemo, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js'
import ProtectedRoute from '@/components/admin/ProtectedRoute'
import AdminLayout from '@/components/admin/AdminLayout'
import { FaixaKpiAnalise, type KpiItem } from '@/features/analise-diaria/components/FaixaKpiAnalise'
import { SecaoRelatorio } from '@/features/analise-diaria/components/SecaoRelatorio'
import { SeletorDiaOperacional } from '@/features/analise-diaria/components/SeletorDiaOperacional'
import { RelatorioBairros } from '@/features/analise-diaria/components/relatorios/RelatorioBairros'
import { RelatorioCanais } from '@/features/analise-diaria/components/relatorios/RelatorioCanais'
import { RelatorioCancelamentos } from '@/features/analise-diaria/components/relatorios/RelatorioCancelamentos'
import { RelatorioComparativo } from '@/features/analise-diaria/components/relatorios/RelatorioComparativo'
import { RelatorioEquipe } from '@/features/analise-diaria/components/relatorios/RelatorioEquipe'
import { RelatorioFiado } from '@/features/analise-diaria/components/relatorios/RelatorioFiado'
import { RelatorioHorarios } from '@/features/analise-diaria/components/relatorios/RelatorioHorarios'
import { RelatorioPagamentos } from '@/features/analise-diaria/components/relatorios/RelatorioPagamentos'
import { RelatorioProdutos } from '@/features/analise-diaria/components/relatorios/RelatorioProdutos'
import { RelatorioTaxasEntrega } from '@/features/analise-diaria/components/relatorios/RelatorioTaxasEntrega'
import { useAnaliseDiaria } from '@/features/analise-diaria/hooks/useAnaliseDiaria'
import { formatarMoeda } from '@/features/analise-diaria/lib/formatadores'

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Title, Tooltip, Legend)

const SECOES_PADRAO = new Set(['canais', 'pagamentos', 'produtos'])

export default function AnaliseDiariaPage() {
  const {
    dataSelecionada,
    selecionarData,
    diaTrabalhoAtual,
    dados,
    carregando,
    recarregar,
  } = useAnaliseDiaria()

  const [abertas, setAbertas] = useState<Set<string>>(() => new Set(SECOES_PADRAO))

  const handleToggleSecao = useCallback((id: string) => {
    setAbertas((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const kpis: KpiItem[] = useMemo(
    () => [
      {
        id: 'faturamento',
        label: 'Faturamento',
        valor: formatarMoeda(dados?.faturamentoTotal || 0),
        variacao: dados?.comparativo.variacaoOntem.faturamento,
      },
      {
        id: 'pedidos',
        label: 'Pedidos',
        valor: String(dados?.totalPedidos || 0),
        variacao: dados?.comparativo.variacaoOntem.pedidos,
      },
      {
        id: 'ticket',
        label: 'Ticket médio',
        valor: formatarMoeda(dados?.ticketMedio || 0),
      },
      {
        id: 'entregas',
        label: 'Entregas',
        valor: String(dados?.pedidosPorTipo.entregas.quantidade || 0),
      },
    ],
    [dados],
  )

  return (
    <ProtectedRoute>
      <AdminLayout>
        <div className="space-y-5 pb-8">
          <div className="rounded-xl border border-border/70 bg-card p-4 shadow-sm md:p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <h1 className="text-lg font-semibold tracking-tight text-foreground">Análise diária</h1>
                <p className="mt-1 text-sm text-muted-foreground">Dia de trabalho · corte 10h</p>
              </div>
              <FaixaKpiAnalise
                itens={kpis}
                carregando={carregando && !dados}
                acoes={
                  <div className="flex flex-wrap items-center gap-2">
                    <SeletorDiaOperacional
                      dataSelecionada={dataSelecionada}
                      diaTrabalhoAtual={diaTrabalhoAtual}
                      onSelecionar={selecionarData}
                    />
                    <button
                      type="button"
                      onClick={() => void recarregar()}
                      disabled={carregando}
                      className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border/70 bg-background px-3 text-sm font-medium shadow-none transition-colors hover:bg-muted disabled:opacity-50"
                      aria-label="Atualizar análise do dia"
                    >
                      <RefreshCw className={`h-3.5 w-3.5 ${carregando ? 'animate-spin' : ''}`} strokeWidth={1.6} />
                      Atualizar
                    </button>
                  </div>
                }
              />
            </div>
          </div>

          {carregando && !dados ? (
            <div className="space-y-3">
              <div className="h-24 animate-pulse rounded-xl border border-border/70 bg-muted/40" />
              <div className="h-48 animate-pulse rounded-xl border border-border/70 bg-muted/40" />
            </div>
          ) : dados ? (
            <div className="space-y-3">
              <SecaoRelatorio
                id="canais"
                titulo="Pedidos por canal"
                descricao="Entrega, retirada e salão."
                aberto={abertas.has('canais')}
                onToggle={handleToggleSecao}
              >
                <RelatorioCanais dados={dados} />
              </SecaoRelatorio>

              <SecaoRelatorio
                id="pagamentos"
                titulo="Formas de pagamento"
                descricao="Quanto entrou em cada forma."
                aberto={abertas.has('pagamentos')}
                onToggle={handleToggleSecao}
              >
                <RelatorioPagamentos pagamentos={dados.faturamentoPorPagamento} />
              </SecaoRelatorio>

              <SecaoRelatorio
                id="produtos"
                titulo="Produtos mais vendidos"
                descricao="Ranking do dia por quantidade, com participação na receita."
                aberto={abertas.has('produtos')}
                onToggle={handleToggleSecao}
              >
                <RelatorioProdutos produtos={dados.produtosMaisVendidos} />
              </SecaoRelatorio>

              <SecaoRelatorio
                id="horarios"
                titulo="Pedidos por horário"
                descricao="Horários com mais movimento."
                aberto={abertas.has('horarios')}
                onToggle={handleToggleSecao}
              >
                <RelatorioHorarios horarios={dados.horariosPico} />
              </SecaoRelatorio>

              <SecaoRelatorio
                id="bairros"
                titulo="Entregas por bairro"
                descricao="Onde as entregas concentraram."
                aberto={abertas.has('bairros')}
                onToggle={handleToggleSecao}
              >
                <RelatorioBairros bairros={dados.entregasPorBairro} />
              </SecaoRelatorio>

              <SecaoRelatorio
                id="cancelamentos"
                titulo="Cancelamentos"
                descricao="Pedidos cancelados e valor perdido."
                aberto={abertas.has('cancelamentos')}
                onToggle={handleToggleSecao}
              >
                <RelatorioCancelamentos cancelamentos={dados.cancelamentos} />
              </SecaoRelatorio>

              <SecaoRelatorio
                id="comparativo"
                titulo="Comparativo"
                descricao="Versus ontem e o mesmo weekday −7d."
                aberto={abertas.has('comparativo')}
                onToggle={handleToggleSecao}
              >
                <RelatorioComparativo
                  atual={{
                    faturamento: dados.faturamentoTotal,
                    pedidos: dados.totalPedidos,
                    ticketMedio: dados.ticketMedio,
                  }}
                  comparativo={dados.comparativo}
                />
              </SecaoRelatorio>

              <SecaoRelatorio
                id="taxas"
                titulo="Taxas de entrega"
                descricao="Total e média nas entregas do dia."
                aberto={abertas.has('taxas')}
                onToggle={handleToggleSecao}
              >
                <RelatorioTaxasEntrega taxas={dados.taxasEntrega} />
              </SecaoRelatorio>

              <SecaoRelatorio
                id="equipe"
                titulo="Equipe / PDV"
                descricao="Quem criou pedidos (garçom_id)."
                aberto={abertas.has('equipe')}
                onToggle={handleToggleSecao}
              >
                <RelatorioEquipe equipe={dados.equipe} />
              </SecaoRelatorio>

              <SecaoRelatorio
                id="fiado"
                titulo="Fiado do dia"
                descricao="Consumos ativos no crediário do dia."
                aberto={abertas.has('fiado')}
                onToggle={handleToggleSecao}
              >
                <RelatorioFiado fiado={dados.fiado} />
              </SecaoRelatorio>
            </div>
          ) : (
            <p className="rounded-xl border border-border/70 bg-card p-8 text-center text-sm text-muted-foreground shadow-sm">
              Não foi possível carregar a análise deste dia.
            </p>
          )}
        </div>
      </AdminLayout>
    </ProtectedRoute>
  )
}
