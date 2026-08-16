'use client'

import { CalendarDays, CreditCard, ListFilter } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { CHIP_FILTRO_DEFAULT } from '@/components/admin/filtros/chip-classes'
import { FiltroAvancado } from '@/components/admin/filtros/FiltroAvancado'
import { CampoSelectFiltro } from '@/components/admin/filtros/CampoSelectFiltro'
import type { PeriodoEntrega } from '@/features/entregas/types'
import { cn } from '@/lib/utils'

export type FiltroStatusPedidoAdmin =
  | 'todos'
  | 'aguardando_pagamento'
  | 'pendente'
  | 'confirmado'
  | 'preparando'
  | 'pronto'
  | 'saiu_para_entrega'
  | 'entregue'
  | 'cancelado'

export type FiltroTipoPedidoAdmin = 'todos' | 'entrega' | 'retirada' | 'local'
export type FiltroSituacaoPedidoAdmin = 'todos' | 'abertos' | 'encerrados'
export type FiltroPagamentoPedidoAdmin = 'todos' | 'pix_pendente' | 'fiado' | 'dinheiro' | 'cartao' | 'pix'
export type FiltroGarcomPedidoAdmin = 'todos' | 'com_garcom' | 'sem_garcom'
export type FiltroCanalSalaoAdmin = 'todos' | 'mesa' | 'comanda'

export type FiltrosPedidosAdminValor = {
  status: FiltroStatusPedidoAdmin
  tipo: FiltroTipoPedidoAdmin
  situacao: FiltroSituacaoPedidoAdmin
  pagamento: FiltroPagamentoPedidoAdmin
  garcom: FiltroGarcomPedidoAdmin
  canalSalao: FiltroCanalSalaoAdmin
  periodo: PeriodoEntrega
  dataInicio: string
  dataFim: string
}

type FiltroPedidosAdminProps = {
  valor: FiltrosPedidosAdminValor
  onChange: (proximo: Partial<FiltrosPedidosAdminValor>) => void
  onLimpar: () => void
  hasFilter: boolean
}

export const STATUS_PEDIDO_ADMIN: Array<{ valor: FiltroStatusPedidoAdmin; label: string }> = [
  { valor: 'todos', label: 'Todos' },
  { valor: 'aguardando_pagamento', label: 'Aguardando' },
  { valor: 'pendente', label: 'Pendente' },
  { valor: 'confirmado', label: 'Confirmado' },
  { valor: 'preparando', label: 'Preparando' },
  { valor: 'pronto', label: 'Pronto' },
  { valor: 'saiu_para_entrega', label: 'Em entrega' },
  { valor: 'entregue', label: 'Entregue' },
  { valor: 'cancelado', label: 'Cancelado' },
]

export const TIPOS_PEDIDO_ADMIN: Array<{ valor: FiltroTipoPedidoAdmin; label: string }> = [
  { valor: 'todos', label: 'Todos' },
  { valor: 'entrega', label: 'Entrega' },
  { valor: 'retirada', label: 'Retirada' },
  { valor: 'local', label: 'Salão' },
]

const ATALHOS_PERIODO: Array<{
  valor: Exclude<PeriodoEntrega, 'personalizado'>
  label: string
}> = [
  { valor: 'todos', label: 'Todos' },
  { valor: 'hoje', label: 'Hoje' },
  { valor: '7dias', label: '7 dias' },
  { valor: '30dias', label: '30 dias' },
  { valor: 'semana', label: 'Semana' },
  { valor: 'mes', label: 'Mês' },
]

export const LABEL_PERIODO_PEDIDOS: Record<PeriodoEntrega, string> = {
  todos: 'Todos',
  hoje: 'Hoje',
  '7dias': '7 dias',
  '30dias': '30 dias',
  semana: 'Semana',
  mes: 'Mês',
  personalizado: 'Personalizado',
}

export const FiltroPedidosAdmin = ({
  valor,
  onChange,
  onLimpar,
  hasFilter,
}: FiltroPedidosAdminProps) => {
  const geralAtivo =
    valor.situacao !== 'todos' ||
    valor.status !== 'todos' ||
    valor.tipo !== 'todos' ||
    valor.garcom !== 'todos' ||
    valor.canalSalao !== 'todos'

  const pagamentoAtivo = valor.pagamento !== 'todos'
  const periodoAtivo = valor.periodo !== 'todos'
  const valorTogglePeriodo = valor.periodo === 'personalizado' ? undefined : valor.periodo

  return (
    <FiltroAvancado
      hasFilter={hasFilter}
      onLimpar={onLimpar}
      defaultAba="geral"
      triggerClassName="w-full sm:w-auto"
      abas={[
        {
          id: 'geral',
          label: 'Geral',
          icon: <ListFilter className="h-4 w-4 shrink-0" />,
          ativo: geralAtivo,
          conteudo: (
            <div className="space-y-4 pr-1">
              <CampoSelectFiltro
                id="pedidos-filtro-situacao"
                label="Situação"
                value={valor.situacao}
                onChange={(v) => onChange({ situacao: v as FiltroSituacaoPedidoAdmin })}
                opcoes={[
                  { valor: 'todos', label: 'Todas' },
                  { valor: 'abertos', label: 'Em aberto' },
                  { valor: 'encerrados', label: 'Encerrados' },
                ]}
              />
              <CampoSelectFiltro
                id="pedidos-filtro-status"
                label="Status"
                value={valor.status}
                onChange={(v) => onChange({ status: v as FiltroStatusPedidoAdmin })}
                opcoes={STATUS_PEDIDO_ADMIN}
              />
              <CampoSelectFiltro
                id="pedidos-filtro-tipo"
                label="Tipo de pedido"
                value={valor.tipo}
                onChange={(v) => onChange({ tipo: v as FiltroTipoPedidoAdmin })}
                opcoes={TIPOS_PEDIDO_ADMIN}
              />
              <CampoSelectFiltro
                id="pedidos-filtro-garcom"
                label="Garçom"
                value={valor.garcom}
                onChange={(v) => onChange({ garcom: v as FiltroGarcomPedidoAdmin })}
                opcoes={[
                  { valor: 'todos', label: 'Todos' },
                  { valor: 'com_garcom', label: 'Com garçom' },
                  { valor: 'sem_garcom', label: 'Sem garçom' },
                ]}
              />
              <CampoSelectFiltro
                id="pedidos-filtro-canal"
                label="Canal do salão"
                value={valor.canalSalao}
                onChange={(v) => onChange({ canalSalao: v as FiltroCanalSalaoAdmin })}
                opcoes={[
                  { valor: 'todos', label: 'Todos' },
                  { valor: 'mesa', label: 'Mesa' },
                  { valor: 'comanda', label: 'Comanda' },
                ]}
              />
            </div>
          ),
        },
        {
          id: 'pagamento',
          label: 'Pagamento',
          icon: <CreditCard className="h-4 w-4 shrink-0" />,
          ativo: pagamentoAtivo,
          conteudo: (
            <div className="space-y-4 pr-1">
              <CampoSelectFiltro
                id="pedidos-filtro-pagamento"
                label="Condição / forma"
                value={valor.pagamento}
                onChange={(v) => onChange({ pagamento: v as FiltroPagamentoPedidoAdmin })}
                opcoes={[
                  { valor: 'todos', label: 'Todos' },
                  { valor: 'pix_pendente', label: 'PIX online pendente' },
                  { valor: 'fiado', label: 'Fiado / crediário' },
                  { valor: 'dinheiro', label: 'Dinheiro' },
                  { valor: 'cartao', label: 'Cartão' },
                  { valor: 'pix', label: 'PIX (forma)' },
                ]}
              />
              <p className="text-xs text-muted-foreground">
                PIX online pendente usa o status do Mercado Pago. Fiado busca forma com “crediário”.
              </p>
            </div>
          ),
        },
        {
          id: 'periodo',
          label: 'Período',
          icon: <CalendarDays className="h-4 w-4 shrink-0" />,
          ativo: periodoAtivo,
          conteudo: (
            <div className="space-y-4 pr-1">
              <div className="space-y-2">
                <Label className="text-sm font-medium text-foreground">Atalhos</Label>
                <ToggleGroup
                  type="single"
                  value={valorTogglePeriodo}
                  onValueChange={(v) => {
                    if (!v) return
                    onChange({ periodo: v as Exclude<PeriodoEntrega, 'personalizado'> })
                  }}
                  aria-label="Atalhos de período"
                  className="flex flex-wrap justify-start gap-2"
                >
                  {ATALHOS_PERIODO.map((atalho) => (
                    <ToggleGroupItem
                      key={atalho.valor}
                      value={atalho.valor}
                      className={cn(CHIP_FILTRO_DEFAULT, 'h-8')}
                    >
                      {atalho.label}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
              </div>
              <div className="space-y-2">
                <Label htmlFor="pedidos-data-inicio" className="text-sm font-medium">
                  Data inicial
                </Label>
                <Input
                  id="pedidos-data-inicio"
                  type="date"
                  value={valor.dataInicio}
                  max={valor.dataFim}
                  onChange={(e) =>
                    onChange({ periodo: 'personalizado', dataInicio: e.target.value })
                  }
                  className="h-10 border-border/70 shadow-none"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pedidos-data-fim" className="text-sm font-medium">
                  Data final
                </Label>
                <Input
                  id="pedidos-data-fim"
                  type="date"
                  value={valor.dataFim}
                  min={valor.dataInicio}
                  onChange={(e) =>
                    onChange({ periodo: 'personalizado', dataFim: e.target.value })
                  }
                  className="h-10 border-border/70 shadow-none"
                />
              </div>
            </div>
          ),
        },
      ]}
    />
  )
}
