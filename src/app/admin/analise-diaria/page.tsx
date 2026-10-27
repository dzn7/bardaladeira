'use client'

import { useCallback, useMemo, useState } from 'react'
import { ArrowsClockwise as RefreshCw, ChartBar } from '@phosphor-icons/react'
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
import { Botao, CabecalhoPagina, Esqueleto, ListaVazia, Pagina } from '@/components/admin/ui'
import { cn } from '@/lib/utils'

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
        <Pagina>
          <CabecalhoPagina
            titulo="Análise diária"
            descricao="Como foi um dia de trabalho (das 10h às 9h59 do dia seguinte)."
            acoes={
              <>
                <SeletorDiaOperacional
                  dataSelecionada={dataSelecionada}
                  diaTrabalhoAtual={diaTrabalhoAtual}
                  onSelecionar={selecionarData}
                />
                <Botao
                  variante="contorno"
                  className="h-11 md:h-10"
                  onClick={() => void recarregar()}
                  disabled={carregando}
                  aria-label="Atualizar análise do dia"
                >
                  <RefreshCw className={cn(carregando && 'animate-spin')} />
                  Atualizar
                </Botao>
              </>
            }
          />

          <FaixaKpiAnalise itens={kpis} carregando={carregando && !dados} />

          {carregando && !dados ? (
            <div className="space-y-3" aria-busy="true" aria-label="Carregando">
              <Esqueleto className="h-14 w-full rounded-xl" />
              <Esqueleto className="h-48 w-full rounded-xl" />
              <Esqueleto className="h-14 w-full rounded-xl" />
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
                descricao="Comparado a ontem e ao mesmo dia da semana passada."
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
                descricao="Quem lançou os pedidos do dia."
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
            <ListaVazia
              icone={<ChartBar />}
              titulo="Não deu para carregar este dia"
              descricao="Confira a internet e tente de novo."
              acao={
                <Botao variante="contorno" onClick={() => void recarregar()}>
                  Tentar de novo
                </Botao>
              }
            />
          )}
        </Pagina>
      </AdminLayout>
    </ProtectedRoute>
  )
}
