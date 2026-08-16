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
import { cn } from '@/lib/utils'

type PaginacaoFinancasProps = {
  paginaAtual: number
  totalPaginas: number
  totalItens: number
  itensPorPagina: number
  onPaginaChange: (pagina: number) => void
  onItensPorPaginaChange: (quantidade: number) => void
  carregando?: boolean
}

const OPCOES = [15, 30, 50, 100] as const

const criarBotoes = (paginaAtual: number, totalPaginas: number) => {
  const sibling = 2
  const inicio = Math.max(paginaAtual - sibling, 1)
  const fim = Math.min(paginaAtual + sibling, totalPaginas)
  const itens: Array<number | 'ellipsis-l' | 'ellipsis-r'> = []

  if (inicio > 1) {
    itens.push(1)
    if (inicio > 2) itens.push('ellipsis-l')
  }
  for (let i = inicio; i <= fim; i++) itens.push(i)
  if (fim < totalPaginas) {
    if (fim < totalPaginas - 1) itens.push('ellipsis-r')
    itens.push(totalPaginas)
  }
  return itens
}

export function PaginacaoFinancas({
  paginaAtual,
  totalPaginas,
  totalItens,
  itensPorPagina,
  onPaginaChange,
  onItensPorPaginaChange,
  carregando = false,
}: PaginacaoFinancasProps) {
  if (totalItens === 0) return null

  const botoes = criarBotoes(paginaAtual, Math.max(totalPaginas, 1))
  const btnClass =
    'h-11 min-w-[44px] border-[#D9E3F0] px-3 text-sm font-semibold shadow-none disabled:opacity-40 dark:border-[#2A3441] dark:bg-transparent dark:hover:bg-[#252727]'

  return (
    <div className="mt-4 flex w-full flex-col gap-4 px-1 py-2 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex items-center">
        <Select
          value={String(itensPorPagina)}
          onValueChange={(v) => onItensPorPaginaChange(Number(v))}
          disabled={carregando}
        >
          <SelectTrigger className="h-11 w-[180px] border-[#D9E3F0] text-sm font-medium shadow-none dark:border-[#2A3441] dark:bg-[#1D1F1F]">
            <SelectValue placeholder="Itens por página">
              {itensPorPagina} itens por página
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {OPCOES.map((opcao) => (
              <SelectItem key={opcao} value={String(opcao)}>
                {opcao} itens por página
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {totalPaginas > 1 ? (
        <Pagination className="mx-0 w-auto justify-start lg:justify-end">
          <PaginationContent className="flex-wrap gap-2">
            <PaginationItem>
              <PaginationFirst
                className={btnClass}
                disabled={carregando || paginaAtual === 1}
                onClick={() => onPaginaChange(1)}
              />
            </PaginationItem>
            <PaginationItem>
              <PaginationPrevious
                className={btnClass}
                disabled={carregando || paginaAtual === 1}
                onClick={() => onPaginaChange(paginaAtual - 1)}
              />
            </PaginationItem>

            {botoes.map((item) =>
              typeof item === 'number' ? (
                <PaginationItem key={item}>
                  <PaginationButton
                    isActive={item === paginaAtual}
                    disabled={carregando}
                    onClick={() => onPaginaChange(item)}
                    className={cn(
                      btnClass,
                      'px-4',
                      item === paginaAtual &&
                        'border-[#F4F6FA] bg-[#F4F6FA] text-[#1F2940] hover:bg-[#F4F6FA] dark:border-[#2A3441] dark:bg-[#252727] dark:text-white',
                    )}
                    aria-label={`Ir para a página ${item}`}
                  >
                    {item}
                  </PaginationButton>
                </PaginationItem>
              ) : (
                <PaginationItem key={item}>
                  <PaginationEllipsis className="text-[#63738D] dark:text-[#A6B4C7]" />
                </PaginationItem>
              ),
            )}

            <PaginationItem>
              <PaginationNext
                className={btnClass}
                disabled={carregando || paginaAtual === totalPaginas}
                onClick={() => onPaginaChange(paginaAtual + 1)}
              />
            </PaginationItem>
            <PaginationItem>
              <PaginationLast
                className={btnClass}
                disabled={carregando || paginaAtual === totalPaginas}
                onClick={() => onPaginaChange(totalPaginas)}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      ) : null}
    </div>
  )
}
