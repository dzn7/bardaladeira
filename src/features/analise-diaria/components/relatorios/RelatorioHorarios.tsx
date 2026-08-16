'use client'

import { useMemo } from 'react'
import { Bar } from 'react-chartjs-2'
import type { HorarioPico } from '../../types'

type RelatorioHorariosProps = {
  horarios: HorarioPico[]
}

export const RelatorioHorarios = ({ horarios }: RelatorioHorariosProps) => {
  const dadosGrafico = useMemo(() => {
    if (!horarios.length) return null
    const relevantes = horarios.filter((h) => h.quantidade > 0 || (h.hora >= 10 && h.hora <= 23))
    if (!relevantes.some((h) => h.quantidade > 0)) return null
    return {
      labels: relevantes.map((h) => `${h.hora}h`),
      datasets: [
        {
          label: 'Pedidos',
          data: relevantes.map((h) => h.quantidade),
          backgroundColor: 'rgba(100, 100, 110, 0.6)',
          borderRadius: 4,
        },
      ],
    }
  }, [horarios])

  if (!dadosGrafico) {
    return <p className="py-8 text-center text-sm text-muted-foreground">Nenhum pedido neste dia.</p>
  }

  return (
    <div className="h-56">
      <Bar
        data={dadosGrafico}
        options={{
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            y: { beginAtZero: true, ticks: { stepSize: 1 } },
          },
        }}
      />
    </div>
  )
}
