'use client'

import {
  Pagination,
  PaginationButton,
  PaginationContent,
  PaginationEllipsis,
  PaginationFirst,
  PaginationItem,
  PaginationLast,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination'
import { Selecao } from '@/components/admin/ui'

type ItemPagina = number | 'inicio-ellipsis' | 'fim-ellipsis'

type PaginacaoPedidosProps = {
  paginaAtual: number
  totalPaginas: number
  itensPorPagina: number
  totalItens: number
  carregando?: boolean
  onPaginaChange: (pagina: number) => void
  onItensPorPaginaChange: (quantidade: number) => void
}

const OPCOES_POR_PAGINA = [15, 30, 50, 100] as const

const criarItensPaginacao = (paginaAtual: number, totalPaginas: number): ItemPagina[] => {
  if (totalPaginas <= 7) {
    return Array.from({ length: totalPaginas }, (_, indice) => indice + 1)
  }

  if (paginaAtual <= 4) {
    return [1, 2, 3, 4, 5, 'fim-ellipsis', totalPaginas]
  }

  if (paginaAtual >= totalPaginas - 3) {
    return [
      1,
      'inicio-ellipsis',
      totalPaginas - 4,
      totalPaginas - 3,
      totalPaginas - 2,
      totalPaginas - 1,
      totalPaginas,
    ]
  }

  return [
    1,
    'inicio-ellipsis',
    paginaAtual - 1,
    paginaAtual,
    paginaAtual + 1,
    'fim-ellipsis',
    totalPaginas,
  ]
}

export default function PaginacaoPedidos({
  paginaAtual,
  totalPaginas,
  itensPorPagina,
  totalItens,
  carregando = false,
  onPaginaChange,
  onItensPorPaginaChange,
}: PaginacaoPedidosProps) {
  if (totalItens === 0) return null

  const itens = criarItensPaginacao(paginaAtual, totalPaginas)
  const primeiroItem = (paginaAtual - 1) * itensPorPagina + 1
  const ultimoItem = Math.min(paginaAtual * itensPorPagina, totalItens)

  return (
    <div className="flex flex-col gap-3 border-t border-border/70 pt-4 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Exibir</span>
          <Selecao
            value={String(itensPorPagina)}
            onChange={(evento) => onItensPorPaginaChange(Number(evento.target.value))}
            disabled={carregando}
            aria-label="Pedidos por página"
            className="w-24"
          >
            {OPCOES_POR_PAGINA.map((opcao) => (
              <option key={opcao} value={String(opcao)}>
                {opcao}
              </option>
            ))}
          </Selecao>
          <span className="text-sm text-muted-foreground">por página</span>
        </div>
        <span className="text-sm text-muted-foreground">
          {primeiroItem}–{ultimoItem} de {totalItens}
        </span>
      </div>

      <Pagination className="mx-0 w-auto justify-start lg:justify-end">
        <PaginationContent className="flex-wrap">
          <PaginationItem className="hidden sm:block">
            <PaginationFirst
              disabled={carregando || paginaAtual === 1}
              onClick={() => onPaginaChange(1)}
            />
          </PaginationItem>
          <PaginationItem>
            <PaginationPrevious
              disabled={carregando || paginaAtual === 1}
              onClick={() => onPaginaChange(paginaAtual - 1)}
            />
          </PaginationItem>

          <PaginationItem className="px-2 text-sm tabular-nums text-muted-foreground sm:hidden">
            Página {paginaAtual} de {totalPaginas}
          </PaginationItem>

          {itens.map((item) =>
            typeof item === 'number' ? (
              <PaginationItem key={item} className="hidden sm:block">
                <PaginationButton
                  isActive={item === paginaAtual}
                  disabled={carregando}
                  onClick={() => onPaginaChange(item)}
                  aria-label={`Ir para a página ${item}`}
                >
                  {item}
                </PaginationButton>
              </PaginationItem>
            ) : (
              <PaginationItem key={item} className="hidden sm:block">
                <PaginationEllipsis />
              </PaginationItem>
            ),
          )}

          <PaginationItem>
            <PaginationNext
              disabled={carregando || paginaAtual === totalPaginas}
              onClick={() => onPaginaChange(paginaAtual + 1)}
            />
          </PaginationItem>
          <PaginationItem className="hidden sm:block">
            <PaginationLast
              disabled={carregando || paginaAtual === totalPaginas}
              onClick={() => onPaginaChange(totalPaginas)}
            />
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    </div>
  )
}
