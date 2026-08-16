'use client'

import { useId } from 'react'
import { Calendar, ChevronDown, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { FiltroFinancas, TipoPeriodo } from '../types'
import { calcularPeriodo, isoDoDia, rotuloPeriodo } from '../lib/formatadores'

const OPCOES: { valor: TipoPeriodo; rotulo: string }[] = [
  { valor: 'hoje', rotulo: 'Hoje' },
  { valor: 'semana', rotulo: 'Esta semana' },
  { valor: 'mes', rotulo: 'Este mês' },
  { valor: 'ano', rotulo: 'Este ano' },
  { valor: 'personalizado', rotulo: 'Personalizado' },
]

interface FiltroPeriodoProps {
  filtro: FiltroFinancas
  onChange: (filtro: FiltroFinancas) => void
  onAtualizar: () => void
  carregando?: boolean
}

export function FiltroPeriodo({ filtro, onChange, onAtualizar, carregando }: FiltroPeriodoProps) {
  const idInicio = useId()
  const idFim = useId()
  const opcaoAtiva = OPCOES.find((o) => o.valor === filtro.tipo) ?? OPCOES[2]

  function aplicarPreset(tipo: TipoPeriodo) {
    if (tipo === 'personalizado') {
      onChange({ ...filtro, tipo: 'personalizado' })
      return
    }
    onChange(calcularPeriodo(tipo))
  }

  function alterarData(campo: 'inicio' | 'fim', isoDate: string) {
    if (!isoDate) return
    const d = new Date(isoDate + 'T00:00:00')
    if (Number.isNaN(d.getTime())) return
    if (campo === 'inicio') {
      d.setHours(0, 0, 0, 0)
      onChange({ ...filtro, tipo: 'personalizado', inicio: d.toISOString() })
    } else {
      d.setHours(23, 59, 59, 999)
      onChange({ ...filtro, tipo: 'personalizado', fim: d.toISOString() })
    }
  }

  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex flex-wrap items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-9 gap-2">
              <Calendar strokeWidth={1.6} className="h-4 w-4" />
              <span className="font-medium">{opcaoAtiva.rotulo}</span>
              <ChevronDown strokeWidth={1.6} className="h-[15px] w-[15px] text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-52">
            <DropdownMenuLabel className="text-[11px] font-medium uppercase tracking-[0.06em] text-muted-foreground">
              Período
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {OPCOES.map((opcao) => (
              <DropdownMenuItem
                key={opcao.valor}
                onSelect={() => aplicarPreset(opcao.valor)}
                className="cursor-pointer"
              >
                {opcao.rotulo}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <span className="rounded-md border border-border/70 bg-card px-2.5 py-1.5 text-xs tabular-nums text-muted-foreground">
          {rotuloPeriodo(filtro)}
        </span>

        <Button
          variant="ghost"
          size="sm"
          className="h-9 gap-2 text-muted-foreground hover:text-foreground"
          onClick={onAtualizar}
          disabled={carregando}
          aria-label="Atualizar"
        >
          <RotateCcw strokeWidth={1.6} className={`h-4 w-4 ${carregando ? 'animate-spin' : ''}`} />
          <span className="hidden sm:inline">Atualizar</span>
        </Button>
      </div>

      {filtro.tipo === 'personalizado' && (
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex flex-col gap-1">
            <Label
              htmlFor={idInicio}
              className="text-[11px] font-medium uppercase tracking-[0.06em] text-muted-foreground"
            >
              Início
            </Label>
            <Input
              id={idInicio}
              type="date"
              className="h-9 w-[150px]"
              value={isoDoDia(new Date(filtro.inicio))}
              onChange={(e) => alterarData('inicio', e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label
              htmlFor={idFim}
              className="text-[11px] font-medium uppercase tracking-[0.06em] text-muted-foreground"
            >
              Fim
            </Label>
            <Input
              id={idFim}
              type="date"
              className="h-9 w-[150px]"
              value={isoDoDia(new Date(filtro.fim))}
              onChange={(e) => alterarData('fim', e.target.value)}
            />
          </div>
        </div>
      )}
    </div>
  )
}
