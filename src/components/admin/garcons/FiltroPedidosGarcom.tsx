'use client'

import { useState } from 'react'
import { FunnelSimple as ListFilter } from '@phosphor-icons/react'
import { Botao, Campo, Chip, Entrada, Gaveta, Selecao } from '@/components/admin/ui'
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
  <Campo rotulo={label} htmlFor={id}>
    <Selecao id={id} value={value} onChange={(e) => onChange(e.target.value)}>
      {opcoes.map((opcao) => (
        <option key={opcao.valor} value={opcao.valor}>
          {opcao.label}
        </option>
      ))}
    </Selecao>
  </Campo>
)

export const FiltroPedidosGarcom = ({
  valor,
  onChange,
  onLimpar,
  hasFilter,
}: FiltroPedidosGarcomProps) => {
  const [aberto, setAberto] = useState(false)

  const quantidadeAtivos =
    Number(valor.situacao !== 'todos') +
    Number(valor.tipo !== 'todos') +
    Number(valor.status !== 'todos') +
    Number(valor.pagamento !== 'todos') +
    Number(valor.periodo !== 'todos' && valor.periodo !== 'hoje')

  return (
    <>
      <Botao
        variante="contorno"
        className={cn('h-11 w-full sm:w-auto md:h-10', hasFilter && 'border-primary text-primary')}
        onClick={() => setAberto(true)}
      >
        <ListFilter />
        Filtros
        {quantidadeAtivos > 0 && (
          <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-semibold text-primary-foreground">
            {quantidadeAtivos}
          </span>
        )}
      </Botao>

      <Gaveta
        aberto={aberto}
        aoFechar={() => setAberto(false)}
        titulo="Filtrar pedidos"
        descricao="Os pedidos mudam na hora em que você escolhe."
        rodape={
          <>
            <Botao variante="contorno" tamanho="lg" className="md:h-10 md:text-sm" onClick={onLimpar} disabled={!hasFilter}>
              Limpar
            </Botao>
            <Botao tamanho="lg" className="md:h-10 md:text-sm" onClick={() => setAberto(false)}>
              Ver pedidos
            </Botao>
          </>
        }
      >
        <div className="space-y-6">
          <section className="space-y-3">
            <h3 className="text-sm font-medium text-foreground">Período</h3>
            <div role="group" aria-label="Atalhos de período" className="flex flex-wrap gap-2">
              {ATALHOS_PERIODO.map((atalho) => (
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
            <div className="grid grid-cols-2 gap-3">
              <Campo rotulo="De" htmlFor="filtro-data-inicio">
                <Entrada
                  id="filtro-data-inicio"
                  type="date"
                  value={valor.dataInicio}
                  max={valor.dataFim}
                  onChange={(e) => onChange({ periodo: 'personalizado', dataInicio: e.target.value })}
                />
              </Campo>
              <Campo rotulo="Até" htmlFor="filtro-data-fim">
                <Entrada
                  id="filtro-data-fim"
                  type="date"
                  value={valor.dataFim}
                  min={valor.dataInicio}
                  onChange={(e) => onChange({ periodo: 'personalizado', dataFim: e.target.value })}
                />
              </Campo>
            </div>
          </section>

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
      </Gaveta>
    </>
  )
}
