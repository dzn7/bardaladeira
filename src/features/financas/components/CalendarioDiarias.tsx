'use client'

import { useMemo, useRef } from 'react'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import interactionPlugin from '@fullcalendar/interaction'
import listPlugin from '@fullcalendar/list'
import type { DateClickArg } from '@fullcalendar/interaction'
import type { EventClickArg, EventInput } from '@fullcalendar/core'
import ptBrLocale from '@fullcalendar/core/locales/pt-br'
import type { FinancasDiaria } from '../types'
import { formatarMoeda } from '../lib/formatadores'
import { cn } from '@/lib/utils'

type CalendarioDiariasProps = {
  diarias: FinancasDiaria[]
  vista: 'calendario' | 'lista'
  mesReferencia: Date
  onMudarMes: (data: Date) => void
  onCliqueDia: (dataYmd: string) => void
  onCliqueDiaria: (diaria: FinancasDiaria) => void
  className?: string
}

const paraYmd = (d: Date) => {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function CalendarioDiarias({
  diarias,
  vista,
  mesReferencia,
  onMudarMes,
  onCliqueDia,
  onCliqueDiaria,
  className,
}: CalendarioDiariasProps) {
  const mapaRef = useRef(new Map<string, FinancasDiaria>())

  const eventos: EventInput[] = useMemo(() => {
    const mapa = new Map<string, FinancasDiaria>()
    const lista = diarias.map((d) => {
      mapa.set(d.id, d)
      return {
        id: d.id,
        title: `${d.nome_pessoa} · ${formatarMoeda(d.valor)}`,
        start: d.data_referencia,
        allDay: true,
        backgroundColor: 'hsl(var(--destructive) / 0.12)',
        borderColor: 'hsl(var(--destructive) / 0.35)',
        textColor: 'hsl(var(--destructive))',
      } satisfies EventInput
    })
    mapaRef.current = mapa
    return lista
  }, [diarias])

  const handleDateClick = (arg: DateClickArg) => {
    onCliqueDia(arg.dateStr)
  }

  const handleEventClick = (arg: EventClickArg) => {
    const diaria = mapaRef.current.get(arg.event.id)
    if (diaria) onCliqueDiaria(diaria)
  }

  return (
    <div
      className={cn(
        'calendario-diarias flex min-h-[560px] w-full min-w-0 flex-col sm:min-h-[640px] lg:min-h-[720px]',
        className,
      )}
    >
      <FullCalendar
        key={`${vista}-${mesReferencia.getFullYear()}-${mesReferencia.getMonth()}`}
        plugins={[dayGridPlugin, listPlugin, interactionPlugin]}
        initialView={vista === 'lista' ? 'listMonth' : 'dayGridMonth'}
        initialDate={mesReferencia}
        locale={ptBrLocale}
        headerToolbar={{
          left: 'prev,next today',
          center: 'title',
          right: '',
        }}
        buttonText={{
          today: 'Hoje',
          month: 'Mês',
          list: 'Lista',
        }}
        height="100%"
        expandRows
        stickyHeaderDates={false}
        events={eventos}
        dateClick={handleDateClick}
        eventClick={handleEventClick}
        datesSet={(info) => {
          const meio = new Date((info.start.getTime() + info.end.getTime()) / 2)
          const atual = mesReferencia
          if (meio.getFullYear() !== atual.getFullYear() || meio.getMonth() !== atual.getMonth()) {
            onMudarMes(new Date(meio.getFullYear(), meio.getMonth(), 1))
          }
        }}
        dayMaxEvents={4}
        moreLinkText={(n) => `+${n}`}
        noEventsText="Nenhuma diária neste mês"
        fixedWeekCount={false}
      />
      <span className="sr-only">{paraYmd(mesReferencia)}</span>
    </div>
  )
}
