'use client'

import { CalendarDays, CreditCard, ListFilter } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { CHIP_FILTRO_DEFAULT } from '@/components/admin/filtros/chip-classes'
import { FiltroAvancado } from '@/components/admin/filtros/FiltroAvancado'
import type { PeriodoEntrega } from '@/features/entregas/types'
import { cn } from '@/lib/utils'

export type FiltroSituacaoGarcom = 'todos' | 'abertos' | 'encerrados'
export type FiltroPagamentoGarcom = 'todos' | 'pix_pendente' | 'fiado'

export type FiltrosPedidosGarcomValor = {
  periodo: PeriodoEntrega
  dataInicio: string
  dataFim: string
  situacao: FiltroSituacaoGarcom
  tipo: string
  pagamento: FiltroPagamentoGarcom
  status: string
}

type FiltroPedidosGarcomProps = {
  valor: FiltrosPedidosGarcomValor
  onChange: (proximo: Partial<FiltrosPedidosGarcomValor>) => void
  onLimpar: () => void
  hasFilter: boolean
}

const STATUS_OPCOES = [
  { valor: 'todos', label: 'Todos' },
  { valor: 'pendente', label: 'Pendente' },
  { valor: 'confirmado', label: 'Confirmado' },
  { valor: 'preparando', label: 'Preparando' },
  { valor: 'pronto', label: 'Pronto' },
  { valor: 'saiu_para_entrega', label: 'Em entrega' },
  { valor: 'entregue', label: 'Entregue' },
  { valor: 'cancelado', label: 'Cancelado' },
] as const

const TIPOS_OPCOES = [
  { valor: 'todos', label: 'Todos' },
  { valor: 'local', label: 'Salão' },
  { valor: 'entrega', label: 'Entrega' },
  { valor: 'retirada', label: 'Retirada' },
] as const

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

const CampoSelect = ({
  id,
  label,
  value,
  onChange,
  opcoes,
}: {
  id: string
  label: string
  value: string
  onChange: (valor: string) => void
  opcoes: ReadonlyArray<{ valor: string; label: string }>
}) => (
  <div className="space-y-2">
    <Label htmlFor={id} className="text-sm font-medium text-foreground">
      {label}
    </Label>
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger id={id} className="h-10 w-full border-border/70 shadow-none">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {opcoes.map((opcao) => (
          <SelectItem key={opcao.valor} value={opcao.valor}>
            {opcao.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  </div>
)

export const FiltroPedidosGarcom = ({
  valor,
  onChange,
  onLimpar,
  hasFilter,
}: FiltroPedidosGarcomProps) => {
  const geralAtivo =
    valor.situacao !== 'todos' ||
    valor.tipo !== 'todos' ||
    valor.status !== 'todos'

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
              <CampoSelect
                id="filtro-situacao"
                label="Situação"
                value={valor.situacao}
                onChange={(v) => onChange({ situacao: v as FiltroSituacaoGarcom })}
                opcoes={[
                  { valor: 'todos', label: 'Todas' },
                  { valor: 'abertos', label: 'Em aberto' },
                  { valor: 'encerrados', label: 'Encerrados' },
                ]}
              />
              <CampoSelect
                id="filtro-tipo"
                label="Tipo de pedido"
                value={valor.tipo}
                onChange={(v) => onChange({ tipo: v })}
                opcoes={TIPOS_OPCOES}
              />
              <CampoSelect
                id="filtro-status"
                label="Status"
                value={valor.status}
                onChange={(v) => onChange({ status: v })}
                opcoes={STATUS_OPCOES}
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
              <CampoSelect
                id="filtro-pagamento"
                label="Pagamento"
                value={valor.pagamento}
                onChange={(v) => onChange({ pagamento: v as FiltroPagamentoGarcom })}
                opcoes={[
                  { valor: 'todos', label: 'Todos' },
                  { valor: 'pix_pendente', label: 'PIX pendente' },
                  { valor: 'fiado', label: 'Fiado' },
                ]}
              />
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
                <Label htmlFor="filtro-data-inicio" className="text-sm font-medium">
                  Data inicial
                </Label>
                <Input
                  id="filtro-data-inicio"
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
                <Label htmlFor="filtro-data-fim" className="text-sm font-medium">
                  Data final
                </Label>
                <Input
                  id="filtro-data-fim"
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
