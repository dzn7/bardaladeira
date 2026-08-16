'use client'

import { ListFilter } from 'lucide-react'
import { FiltroAvancado } from '@/components/admin/filtros/FiltroAvancado'
import { CampoSelectFiltro } from '@/components/admin/filtros/CampoSelectFiltro'

export type TipoFuncionarioFiltro =
  | 'todos'
  | 'entregador'
  | 'cozinheiro'
  | 'atendente'
  | 'gerente'
  | 'dono'

export type FiltrosFuncionariosValor = {
  tipo: TipoFuncionarioFiltro
  status: 'todos' | 'ativos' | 'inativos'
}

type FiltroFuncionariosAdminProps = {
  valor: FiltrosFuncionariosValor
  onChange: (proximo: Partial<FiltrosFuncionariosValor>) => void
  onLimpar: () => void
  hasFilter: boolean
}

const TIPOS = [
  { valor: 'todos', label: 'Todas' },
  { valor: 'entregador', label: 'Entregador' },
  { valor: 'cozinheiro', label: 'Cozinheiro' },
  { valor: 'atendente', label: 'Atendente' },
  { valor: 'gerente', label: 'Gerente' },
  { valor: 'dono', label: 'Dono' },
] as const

export const FiltroFuncionariosAdmin = ({
  valor,
  onChange,
  onLimpar,
  hasFilter,
}: FiltroFuncionariosAdminProps) => (
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
        ativo: valor.tipo !== 'todos' || valor.status !== 'todos',
        conteudo: (
          <div className="space-y-4 pr-1">
            <CampoSelectFiltro
              id="func-filtro-tipo"
              label="Função"
              value={valor.tipo}
              onChange={(v) => onChange({ tipo: v as TipoFuncionarioFiltro })}
              opcoes={[...TIPOS]}
            />
            <CampoSelectFiltro
              id="func-filtro-status"
              label="Status"
              value={valor.status}
              onChange={(v) => onChange({ status: v as 'todos' | 'ativos' | 'inativos' })}
              opcoes={[
                { valor: 'todos', label: 'Todos' },
                { valor: 'ativos', label: 'Ativos' },
                { valor: 'inativos', label: 'Inativos' },
              ]}
            />
          </div>
        ),
      },
    ]}
  />
)
