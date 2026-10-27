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
import { CalendarDots as CalendarDays, CaretLeft as ChevronLeft, CaretRight as ChevronRight } from '@phosphor-icons/react'
import { Botao, Chip, Gaveta } from '@/components/admin/ui'
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

  const irPara = (dia: Date) => handleSelecionar(dia)

  return (
    <>
      <Botao
        variante="contorno"
        className="h-11 justify-start capitalize md:h-10"
        onClick={() => handleAbrirChange(true)}
        aria-label={`Escolher dia: ${rotulo}`}
      >
        <CalendarDays className="text-muted-foreground" />
        <span className="max-w-[220px] truncate">{rotulo}</span>
      </Botao>

      <Gaveta
        aberto={aberto}
        aoFechar={() => handleAbrirChange(false)}
        titulo="Escolher dia"
        descricao="Veja como foi qualquer dia de trabalho até hoje."
      >
        <div className="space-y-5">
          <div className="flex gap-2">
            <Chip ativo={ehHoje} className="h-11 md:h-9" onClick={() => irPara(diaTrabalhoAtual)}>
              Hoje
            </Chip>
            <Chip ativo={ehOntem} className="h-11 md:h-9" onClick={() => irPara(subDays(diaTrabalhoAtual, 1))}>
              Ontem
            </Chip>
          </div>

          <div className="mx-auto max-w-sm">
            <div className="mb-3 flex items-center justify-between gap-2">
              <Botao variante="fantasma" tamanho="icone" className="size-11" onClick={mesAnterior} aria-label="Mês anterior">
                <ChevronLeft />
              </Botao>
              <p className="text-sm font-semibold capitalize text-foreground">
                {format(mesVisivel, 'MMMM yyyy', { locale: ptBR })}
              </p>
              <Botao
                variante="fantasma"
                tamanho="icone"
                className="size-11"
                onClick={mesSeguinte}
                disabled={proximoMesDesabilitado}
                aria-label="Próximo mês"
              >
                <ChevronRight />
              </Botao>
            </div>
            <div className="mb-1 grid grid-cols-7 gap-1" aria-hidden>
              {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((d, i) => (
                <div key={`${d}-${i}`} className="flex h-8 items-center justify-center text-xs text-muted-foreground">
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
                      'inline-flex aspect-square min-h-11 w-full items-center justify-center rounded-lg text-sm tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      foraMes && 'text-muted-foreground/50',
                      !foraMes && !selecionado && 'text-foreground hover:bg-accent',
                      selecionado && 'bg-primary font-medium text-primary-foreground hover:bg-primary',
                      hoje && !selecionado && 'ring-1 ring-inset ring-primary/40',
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
          </div>
        </div>
      </Gaveta>
    </>
  )
}
