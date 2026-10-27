'use client'

import { useState } from 'react'
import { FunnelSimple } from '@phosphor-icons/react'
import { Botao, Campo, Chip, Entrada, Gaveta, Segmentos, Selecao } from '@/components/admin/ui'
import type { PeriodoEntrega } from '@/features/entregas/types'
import type { StatusEntrega } from '@/lib/tipos-entregas'

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

const STATUS_OPCOES: Array<{ valor: StatusEntrega | 'todos'; rotulo: string }> = [
  { valor: 'todos', rotulo: 'Todos' },
  { valor: 'pendente', rotulo: 'Pendente' },
  { valor: 'em_rota', rotulo: 'Em rota' },
  { valor: 'entregue', rotulo: 'Entregue' },
  { valor: 'cancelada', rotulo: 'Cancelada' },
]

const ATALHOS: Array<{ valor: Exclude<PeriodoEntrega, 'personalizado'>; label: string }> = [
  { valor: 'hoje', label: 'Hoje' },
  { valor: '7dias', label: '7 dias' },
  { valor: '30dias', label: '30 dias' },
  { valor: 'semana', label: 'Semana' },
  { valor: 'mes', label: 'Mês' },
]

const formatarDataCurta = (data: string) => {
  const [ano, mes, dia] = data.split('-')
  return ano && mes && dia ? `${dia}/${mes}` : data
}

/** Período sempre à vista (chips); status, datas e entregador ficam na gaveta "Filtros". */
export const FiltroEntregasAdmin = ({
  valor,
  entregadores,
  mostrarEntregador = false,
  onChange,
  onLimpar,
  hasFilter,
}: FiltroEntregasAdminProps) => {
  const [aberto, setAberto] = useState(false)
  const extrasAtivos =
    (valor.status !== 'todos' ? 1 : 0) +
    (mostrarEntregador && valor.entregadorId !== 'todos' ? 1 : 0) +
    (valor.periodo === 'personalizado' ? 1 : 0)

  return (
    <>
      <div className="flex items-center gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
        {ATALHOS.map((atalho) => (
          <Chip
            key={atalho.valor}
            ativo={valor.periodo === atalho.valor}
            onClick={() => onChange({ periodo: atalho.valor })}
            className="h-10"
          >
            {atalho.label}
          </Chip>
        ))}
        {valor.periodo === 'personalizado' && (
          <Chip ativo onClick={() => setAberto(true)} className="h-10">
            {formatarDataCurta(valor.dataInicio)} a {formatarDataCurta(valor.dataFim)}
          </Chip>
        )}
        <span className="mx-1 h-6 w-px shrink-0 bg-border" aria-hidden />
        <Chip ativo={extrasAtivos > 0} onClick={() => setAberto(true)} className="h-10" aria-label="Abrir filtros">
          <FunnelSimple className="size-4" />
          Filtros{extrasAtivos > 0 ? ` (${extrasAtivos})` : ''}
        </Chip>
        {hasFilter && (
          <Botao variante="fantasma" tamanho="sm" onClick={onLimpar} className="h-10 shrink-0 text-muted-foreground">
            Limpar
          </Botao>
        )}
      </div>

      <Gaveta
        aberto={aberto}
        aoFechar={() => setAberto(false)}
        titulo="Filtros"
        rodape={
          <>
            <Botao variante="contorno" onClick={onLimpar} disabled={!hasFilter}>
              Limpar
            </Botao>
            <Botao onClick={() => setAberto(false)}>Ver resultado</Botao>
          </>
        }
      >
        <div className="space-y-6">
          <Campo rotulo="Período">
            <div className="flex flex-wrap gap-2">
              {ATALHOS.map((atalho) => (
                <Chip
                  key={atalho.valor}
                  ativo={valor.periodo === atalho.valor}
                  onClick={() => onChange({ periodo: atalho.valor })}
                  className="h-10"
                >
                  {atalho.label}
                </Chip>
              ))}
            </div>
          </Campo>

          <div className="grid grid-cols-2 gap-3">
            <Campo rotulo="De" htmlFor="entregas-data-inicio">
              <Entrada
                id="entregas-data-inicio"
                type="date"
                value={valor.dataInicio}
                max={valor.dataFim}
                onChange={(e) => onChange({ periodo: 'personalizado', dataInicio: e.target.value })}
              />
            </Campo>
            <Campo rotulo="Até" htmlFor="entregas-data-fim">
              <Entrada
                id="entregas-data-fim"
                type="date"
                value={valor.dataFim}
                min={valor.dataInicio}
                onChange={(e) => onChange({ periodo: 'personalizado', dataFim: e.target.value })}
              />
            </Campo>
          </div>

          <Campo rotulo="Situação da entrega">
            <div id="entregas-filtro-status">
              <Segmentos
                rotuloAcessivel="Situação da entrega"
                opcoes={STATUS_OPCOES}
                valor={valor.status}
                aoMudar={(status) => onChange({ status })}
              />
            </div>
          </Campo>

          {mostrarEntregador && (
            <Campo rotulo="Entregador" htmlFor="entregas-filtro-entregador">
              <Selecao
                id="entregas-filtro-entregador"
                value={valor.entregadorId}
                onChange={(e) => onChange({ entregadorId: e.target.value })}
              >
                <option value="todos">Todos</option>
                {entregadores.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.nome}
                  </option>
                ))}
              </Selecao>
            </Campo>
          )}
        </div>
      </Gaveta>
    </>
  )
}
