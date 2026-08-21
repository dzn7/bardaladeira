'use client'

import { Tag } from 'lucide-react'
import { FiltroAvancado } from '@/components/admin/filtros/FiltroAvancado'
import { CampoSelectFiltro } from '@/components/admin/filtros/CampoSelectFiltro'

export type FiltrosEstoqueValor = {
  categoria: string
}

type FiltroEstoqueAdminProps = {
  valor: FiltrosEstoqueValor
  categorias: string[]
  onChange: (proximo: Partial<FiltrosEstoqueValor>) => void
  onLimpar: () => void
  hasFilter: boolean
}

export const FiltroEstoqueAdmin = ({
  valor,
  categorias,
  onChange,
  onLimpar,
  hasFilter,
}: FiltroEstoqueAdminProps) => (
  <FiltroAvancado
    hasFilter={hasFilter}
    onLimpar={onLimpar}
    defaultAba="categoria"
    triggerClassName="w-full sm:w-auto"
    abas={[
      {
        id: 'categoria',
        label: 'Categoria',
        icon: <Tag className="h-4 w-4 shrink-0" />,
        ativo: valor.categoria !== 'todas',
        conteudo: (
          <div className="space-y-4 pr-1">
            <CampoSelectFiltro
              id="estoque-filtro-categoria"
              label="Categoria"
              value={valor.categoria}
              onChange={(v) => onChange({ categoria: v })}
              opcoes={[
                { valor: 'todas', label: 'Todas' },
                ...categorias.map((categoria) => ({
                  valor: categoria,
                  label: categoria,
                })),
              ]}
            />
          </div>
        ),
      },
    ]}
  />
)
