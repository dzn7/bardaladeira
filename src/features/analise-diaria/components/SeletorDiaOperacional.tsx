'use client'

import { useMemo, useState } from 'react'
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
  subDays,
  subMonths,
} from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'

type SeletorDiaOperacionalProps = {
  dataSelecionada: Date
  diaTrabalhoAtual: Date
  onSelecionar: (data: Date) => void
}

export const SeletorDiaOperacional = ({
  dataSelecionada,
  diaTrabalhoAtual,
  onSelecionar,
}: SeletorDiaOperacionalProps) => {
  const [aberto, setAberto] = useState(false)
  const [mesVisivel, setMesVisivel] = useState(() => startOfMonth(dataSelecionada))

  const ehHoje = isSameDay(dataSelecionada, diaTrabalhoAtual)
  const ehOntem = isSameDay(dataSelecionada, subDays(diaTrabalhoAtual, 1))

  const rotulo = useMemo(() => {
    if (ehHoje) return 'Hoje'
    if (ehOntem) return 'Ontem'
    return format(dataSelecionada, "EEEE, dd 'de' MMMM", { locale: ptBR })
  }, [dataSelecionada, ehHoje, ehOntem])

  const diasGrade = useMemo(() => {
    const inicio = startOfWeek(startOfMonth(mesVisivel), { weekStartsOn: 0 })
    const fim = endOfWeek(endOfMonth(mesVisivel), { weekStartsOn: 0 })
    return eachDayOfInterval({ start: inicio, end: fim })
  }, [mesVisivel])

  const handleAbrirChange = (open: boolean) => {
    setAberto(open)
    if (open) setMesVisivel(startOfMonth(dataSelecionada))
  }

  const handleSelecionar = (dia: Date) => {
    const ref = new Date(dia)
    ref.setHours(12, 0, 0, 0)
    if (ref > diaTrabalhoAtual) return
    onSelecionar(ref)
    setAberto(false)
  }

  const mesAnterior = () => setMesVisivel((m) => subMonths(m, 1))
  const mesSeguinte = () => {
    const proximo = addMonths(mesVisivel, 1)
    if (startOfMonth(proximo) > startOfMonth(diaTrabalhoAtual)) return
    setMesVisivel(proximo)
  }

  const proximoMesDesabilitado = startOfMonth(addMonths(mesVisivel, 1)) > startOfMonth(diaTrabalhoAtual)

  return (
    <Popover open={aberto} onOpenChange={handleAbrirChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex h-9 items-center gap-2 rounded-lg border border-border/70 bg-background px-3 text-sm font-medium capitalize shadow-none transition-colors hover:bg-muted"
          aria-label="Selecionar dia operacional"
        >
          <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.6} />
          <span className="max-w-[220px] truncate">{rotulo}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-auto p-3" sideOffset={8}>
        <div className="mb-3 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={mesAnterior}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border/60 hover:bg-muted"
            aria-label="Mês anterior"
          >
            <ChevronLeft className="h-4 w-4" strokeWidth={1.6} />
          </button>
          <p className="text-sm font-semibold capitalize text-foreground">
            {format(mesVisivel, 'MMMM yyyy', { locale: ptBR })}
          </p>
          <button
            type="button"
            onClick={mesSeguinte}
            disabled={proximoMesDesabilitado}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border/60 hover:bg-muted disabled:opacity-40"
            aria-label="Próximo mês"
          >
            <ChevronRight className="h-4 w-4" strokeWidth={1.6} />
          </button>
        </div>
        <div className="mb-1 grid grid-cols-7 gap-1">
          {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((d, i) => (
            <div key={`${d}-${i}`} className="h-8 text-center text-[10px] font-medium uppercase text-muted-foreground">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {diasGrade.map((dia) => {
            const ref = new Date(dia)
            ref.setHours(12, 0, 0, 0)
            const foraMes = !isSameMonth(dia, mesVisivel)
            const futuro = ref > diaTrabalhoAtual
            const selecionado = isSameDay(dia, dataSelecionada)
            const hoje = isSameDay(dia, diaTrabalhoAtual)
            return (
              <button
                key={dia.toISOString()}
                type="button"
                disabled={futuro}
                onClick={() => handleSelecionar(dia)}
                className={cn(
                  'inline-flex h-8 w-8 items-center justify-center rounded-md text-xs tabular-nums transition-colors',
                  foraMes && 'text-muted-foreground/50',
                  !foraMes && !selecionado && 'text-foreground hover:bg-muted',
                  selecionado && 'bg-primary text-primary-foreground hover:bg-primary',
                  hoje && !selecionado && 'ring-1 ring-primary/40',
                  futuro && 'cursor-not-allowed opacity-30 hover:bg-transparent',
                )}
                aria-label={format(dia, "dd 'de' MMMM", { locale: ptBR })}
                aria-pressed={selecionado}
              >
                {format(dia, 'd')}
              </button>
            )
          })}
        </div>
      </PopoverContent>
    </Popover>
  )
}
