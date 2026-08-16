'use client'

import { ImageIcon, ListFilter, Tag } from 'lucide-react'
import { FiltroAvancado } from '@/components/admin/filtros/FiltroAvancado'
import { CampoSelectFiltro } from '@/components/admin/filtros/CampoSelectFiltro'

export type FiltroStatusProduto = 'todos' | 'ativos' | 'ocultos'
export type FiltroTipoProduto = 'todos' | 'produtos' | 'bebidas'
export type FiltroFotoProduto = 'todos' | 'com-foto' | 'sem-foto'

export type FiltrosProdutosValor = {
  status: FiltroStatusProduto
  tipo: FiltroTipoProduto
  foto: FiltroFotoProduto
  categoria: string
}

type FiltroProdutosAdminProps = {
  valor: FiltrosProdutosValor
  categorias: string[]
  totais?: {
    disponiveis?: number
    ocultos?: number
    semFoto?: number
  }
  onChange: (proximo: Partial<FiltrosProdutosValor>) => void
  onLimpar: () => void
  hasFilter: boolean
}

export const FiltroProdutosAdmin = ({
  valor,
  categorias,
  totais,
  onChange,
  onLimpar,
  hasFilter,
}: FiltroProdutosAdminProps) => (
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
        ativo: valor.status !== 'todos' || valor.tipo !== 'todos',
        conteudo: (
          <div className="space-y-4 pr-1">
            <CampoSelectFiltro
              id="produtos-filtro-status"
              label="Status"
              value={valor.status}
              onChange={(v) => onChange({ status: v as FiltroStatusProduto })}
              opcoes={[
                { valor: 'todos', label: 'Todos' },
                {
                  valor: 'ativos',
                  label:
                    totais?.disponiveis !== undefined
                      ? `Ativos (${totais.disponiveis})`
                      : 'Ativos',
                },
                {
                  valor: 'ocultos',
                  label:
                    totais?.ocultos !== undefined
                      ? `Ocultos (${totais.ocultos})`
                      : 'Ocultos',
                },
              ]}
            />
            <CampoSelectFiltro
              id="produtos-filtro-tipo"
              label="Tipo"
              value={valor.tipo}
              onChange={(v) => onChange({ tipo: v as FiltroTipoProduto })}
              opcoes={[
                { valor: 'todos', label: 'Produtos e bebidas' },
                { valor: 'produtos', label: 'Só produtos' },
                { valor: 'bebidas', label: 'Só bebidas' },
              ]}
            />
          </div>
        ),
      },
      {
        id: 'foto',
        label: 'Foto',
        icon: <ImageIcon className="h-4 w-4 shrink-0" />,
        ativo: valor.foto !== 'todos',
        conteudo: (
          <div className="space-y-4 pr-1">
            <CampoSelectFiltro
              id="produtos-filtro-foto"
              label="Foto"
              value={valor.foto}
              onChange={(v) => onChange({ foto: v as FiltroFotoProduto })}
              opcoes={[
                { valor: 'todos', label: 'Todas' },
                { valor: 'com-foto', label: 'Com foto' },
                {
                  valor: 'sem-foto',
                  label:
                    totais?.semFoto !== undefined
                      ? `Sem foto (${totais.semFoto})`
                      : 'Sem foto',
                },
              ]}
            />
          </div>
        ),
      },
      {
        id: 'categoria',
        label: 'Categoria',
        icon: <Tag className="h-4 w-4 shrink-0" />,
        ativo: valor.categoria !== 'todas',
        conteudo: (
          <div className="space-y-4 pr-1">
            <CampoSelectFiltro
              id="produtos-filtro-categoria"
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
