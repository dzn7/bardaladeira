'use client'

import { CalendarDays, ListFilter, User } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { CHIP_FILTRO_DEFAULT } from '@/components/admin/filtros/chip-classes'
import { FiltroAvancado } from '@/components/admin/filtros/FiltroAvancado'
import { CampoSelectFiltro } from '@/components/admin/filtros/CampoSelectFiltro'
import type { PeriodoEntrega } from '@/features/entregas/types'
import type { StatusEntrega } from '@/lib/tipos-entregas'
import { cn } from '@/lib/utils'

export type FiltrosEntregasValor = {
  periodo: PeriodoEntrega
  dataInicio: string
  dataFim: string
  status: StatusEntrega | 'todos'
  entregadorId: string
}

type EntregadorOpcao = {
  id: string
  nome: string
}

type FiltroEntregasAdminProps = {
  valor: FiltrosEntregasValor
  entregadores: EntregadorOpcao[]
  mostrarEntregador?: boolean
  onChange: (proximo: Partial<FiltrosEntregasValor>) => void
  onLimpar: () => void
  hasFilter: boolean
}

const STATUS_OPCOES: Array<{ valor: StatusEntrega | 'todos'; label: string }> = [
  { valor: 'todos', label: 'Todos' },
  { valor: 'pendente', label: 'Pendente' },
  { valor: 'em_rota', label: 'Em rota' },
  { valor: 'entregue', label: 'Entregue' },
  { valor: 'cancelada', label: 'Cancelada' },
]

const ATALHOS: Array<{ valor: Exclude<PeriodoEntrega, 'personalizado'>; label: string }> = [
  { valor: 'hoje', label: 'Hoje' },
  { valor: '7dias', label: '7 dias' },
  { valor: '30dias', label: '30 dias' },
  { valor: 'semana', label: 'Semana' },
  { valor: 'mes', label: 'Mês' },
]

export const FiltroEntregasAdmin = ({
  valor,
  entregadores,
  mostrarEntregador = false,
  onChange,
  onLimpar,
  hasFilter,
}: FiltroEntregasAdminProps) => {
  const valorToggle = valor.periodo === 'personalizado' ? undefined : valor.periodo

  const abas = [
    {
      id: 'periodo',
      label: 'Período',
      icon: <CalendarDays className="h-4 w-4 shrink-0" />,
      ativo: valor.periodo !== '7dias',
      conteudo: (
        <div className="space-y-4 pr-1">
          <div className="space-y-2">
            <Label className="text-sm font-medium">Atalhos</Label>
            <ToggleGroup
              type="single"
              value={valorToggle}
              onValueChange={(v) => {
                if (!v) return
                onChange({ periodo: v as Exclude<PeriodoEntrega, 'personalizado'> })
              }}
              className="flex flex-wrap justify-start gap-2"
            >
              {ATALHOS.map((atalho) => (
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
            <Label htmlFor="entregas-data-inicio">Data inicial</Label>
            <Input
              id="entregas-data-inicio"
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
            <Label htmlFor="entregas-data-fim">Data final</Label>
            <Input
              id="entregas-data-fim"
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
    {
      id: 'status',
      label: 'Status',
      icon: <ListFilter className="h-4 w-4 shrink-0" />,
      ativo: valor.status !== 'todos',
      conteudo: (
        <div className="space-y-4 pr-1">
          <CampoSelectFiltro
            id="entregas-filtro-status"
            label="Status da entrega"
            value={valor.status}
            onChange={(v) => onChange({ status: v as StatusEntrega | 'todos' })}
            opcoes={STATUS_OPCOES}
          />
        </div>
      ),
    },
    ...(mostrarEntregador
      ? [
          {
            id: 'entregador',
            label: 'Entregador',
            icon: <User className="h-4 w-4 shrink-0" />,
            ativo: valor.entregadorId !== 'todos',
            conteudo: (
              <div className="space-y-4 pr-1">
                <CampoSelectFiltro
                  id="entregas-filtro-entregador"
                  label="Entregador"
                  value={valor.entregadorId}
                  onChange={(v) => onChange({ entregadorId: v })}
                  opcoes={[
                    { valor: 'todos', label: 'Todos' },
                    ...entregadores.map((item) => ({
                      valor: item.id,
                      label: item.nome,
                    })),
                  ]}
                />
              </div>
            ),
          },
        ]
      : []),
  ]

  return (
    <FiltroAvancado
      hasFilter={hasFilter}
      onLimpar={onLimpar}
      defaultAba="periodo"
      triggerClassName="w-full sm:w-auto"
      abas={abas}
    />
  )
}
