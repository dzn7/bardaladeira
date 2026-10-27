'use client'

import { useState } from 'react'
import { SquaresFour as LayoutDashboard, ShoppingCart, ChartBar as BarChart3, Truck, ArrowsClockwise as RefreshCw, Wallet, Users, Warning } from '@phosphor-icons/react'
import { Botao, CabecalhoPagina, Chip, Esqueleto, ListaCarregando, ListaVazia, Pagina, Selecao } from '@/components/admin/ui'
import { cn } from '@/lib/utils'
import ProtectedRoute from '@/components/admin/ProtectedRoute'
import AdminLayout from '@/components/admin/AdminLayout'
import { useAnosAnteriores } from '@/lib/useAnosAnteriores'
import { obterAnosAnterioresDisponiveis } from '@/lib/filtros-ano'
import {
  DashboardAnoAnterior,
  PedidosAnoAnterior,
  RelatoriosAnoAnterior,
  EntregasAnoAnterior,
  ModalDetalhesPedidoHistorico,
  SaldosAnoAnterior,
  SalariosAnoAnterior
} from '@/components/admin/anos-anteriores'
import type { PedidoHistorico, AbaAnosAnteriores } from '@/lib/tipos-anos-anteriores'

const abas: { id: AbaAnosAnteriores; label: string; icone: typeof LayoutDashboard }[] = [
  { id: 'dashboard', label: 'Resumo', icone: LayoutDashboard },
  { id: 'pedidos', label: 'Pedidos', icone: ShoppingCart },
  { id: 'relatorios', label: 'Relatórios', icone: BarChart3 },
  { id: 'entregas', label: 'Entregas', icone: Truck },
  { id: 'saldos', label: 'Saldos', icone: Wallet },
  { id: 'salarios', label: 'Salários', icone: Users },
]

export default function AnosAnterioresPage() {
  const anosDisponiveis = obterAnosAnterioresDisponiveis()
  const [anoSelecionado, setAnoSelecionado] = useState(anosDisponiveis[0] || 2025)
  const [abaAtiva, setAbaAtiva] = useState<AbaAnosAnteriores>('dashboard')
  const [pedidoDetalhes, setPedidoDetalhes] = useState<PedidoHistorico | null>(null)
  const [modalDetalhesAberto, setModalDetalhesAberto] = useState(false)

  const { dados, carregando, erro, recarregar } = useAnosAnteriores(anoSelecionado)

  const handleVerDetalhesPedido = (pedido: PedidoHistorico) => {
    setPedidoDetalhes(pedido)
    setModalDetalhesAberto(true)
  }

  return (
    <ProtectedRoute>
      <AdminLayout>
        <Pagina>
          <CabecalhoPagina
            titulo="Anos anteriores"
            descricao="Pedidos, relatórios e entregas de anos que já fecharam."
            acoes={
              <>
                <div className="w-32">
                  <Selecao
                    value={anoSelecionado}
                    onChange={(e) => setAnoSelecionado(Number(e.target.value))}
                    aria-label="Ano"
                  >
                    {anosDisponiveis.map(ano => (
                      <option key={ano} value={ano}>{ano}</option>
                    ))}
                  </Selecao>
                </div>
                <Botao variante="contorno" className="h-11 md:h-10" onClick={recarregar} disabled={carregando}>
                  <RefreshCw className={cn(carregando && 'animate-spin')} />
                  Atualizar
                </Botao>
              </>
            }
          />

          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:px-0" role="tablist" aria-label="Seções">
            {abas.map((aba) => {
              const Icone = aba.icone
              const ativo = abaAtiva === aba.id
              return (
                <Chip
                  key={aba.id}
                  role="tab"
                  aria-selected={ativo}
                  ativo={ativo}
                  onClick={() => setAbaAtiva(aba.id)}
                  className="h-11 normal-case md:h-9"
                >
                  <Icone className="size-4" aria-hidden />
                  {aba.label}
                </Chip>
              )
            })}
          </div>

          {carregando ? (
            <div className="space-y-3" aria-busy="true" aria-label={`Carregando ${anoSelecionado}`}>
              <Esqueleto className="h-[76px] w-full rounded-xl" />
              <ListaCarregando linhas={4} />
            </div>
          ) : erro ? (
            <ListaVazia
              icone={<Warning />}
              titulo="Não deu para carregar este ano"
              descricao={erro}
              acao={
                <Botao variante="contorno" onClick={recarregar}>
                  Tentar de novo
                </Botao>
              }
            />
          ) : (
            <div key={abaAtiva}>
              {abaAtiva === 'dashboard' && (
                <DashboardAnoAnterior
                  estatisticas={dados.estatisticas}
                  entregasPorBairro={dados.entregasPorBairro}
                  ano={anoSelecionado}
                />
              )}

              {abaAtiva === 'pedidos' && (
                <PedidosAnoAnterior
                  pedidos={dados.pedidos}
                  ano={anoSelecionado}
                  onVerDetalhes={handleVerDetalhesPedido}
                />
              )}

              {abaAtiva === 'relatorios' && (
                <RelatoriosAnoAnterior
                  vendasPorDia={dados.vendasPorDia}
                  produtosMaisVendidos={dados.produtosMaisVendidos}
                  vendasPorCategoria={dados.vendasPorCategoria}
                  horariosPico={dados.horariosPico}
                  faturamentoPorPagamento={dados.faturamentoPorPagamento}
                  ano={anoSelecionado}
                />
              )}

              {abaAtiva === 'entregas' && (
                <EntregasAnoAnterior
                  entregas={dados.entregas}
                  ano={anoSelecionado}
                />
              )}

              {abaAtiva === 'saldos' && (
                <SaldosAnoAnterior ano={anoSelecionado} />
              )}

              {abaAtiva === 'salarios' && (
                <SalariosAnoAnterior ano={anoSelecionado} />
              )}
            </div>
          )}

          <p className="px-1 text-sm text-muted-foreground">
            Aqui aparecem só os registros de {anoSelecionado}. O ano atual ({new Date().getFullYear()}) fica nas telas normais do sistema.
          </p>
        </Pagina>

        {/* Modal de detalhes do pedido */}
        <ModalDetalhesPedidoHistorico
          pedido={pedidoDetalhes}
          aberto={modalDetalhesAberto}
          onFechar={() => {
            setModalDetalhesAberto(false)
            setPedidoDetalhes(null)
          }}
        />
      </AdminLayout>
    </ProtectedRoute>
  )
}
