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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

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
          <Select
            value={String(itensPorPagina)}
            onValueChange={(valor) => onItensPorPaginaChange(Number(valor))}
            disabled={carregando}
          >
            <SelectTrigger className="h-10 w-[92px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {OPCOES_POR_PAGINA.map((opcao) => (
                <SelectItem key={opcao} value={String(opcao)}>
                  {opcao}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-sm text-muted-foreground">itens</span>
        </div>
        <span className="text-xs text-muted-foreground">
          {primeiroItem}–{ultimoItem} de {totalItens}
        </span>
      </div>

      <Pagination className="mx-0 w-auto justify-start lg:justify-end">
        <PaginationContent className="flex-wrap">
          <PaginationItem>
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

          {itens.map((item) =>
            typeof item === 'number' ? (
              <PaginationItem key={item}>
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
              <PaginationItem key={item}>
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
          <PaginationItem>
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
