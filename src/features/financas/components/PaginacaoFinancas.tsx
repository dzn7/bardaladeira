'use client'

import { CaretLeft, CaretRight } from '@phosphor-icons/react'
import { Botao, Selecao } from '@/components/admin/ui'
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

  const total = Math.max(totalPaginas, 1)
  const botoes = criarBotoes(paginaAtual, total)

  return (
    <nav aria-label="Paginação" className="mt-4 flex w-full flex-wrap items-center justify-between gap-3 px-1 py-2">
      <div className="w-[170px]">
        <Selecao
          aria-label="Itens por página"
          value={String(itensPorPagina)}
          onChange={(e) => onItensPorPaginaChange(Number(e.target.value))}
          disabled={carregando}
        >
          {OPCOES.map((opcao) => (
            <option key={opcao} value={opcao}>
              {opcao} por página
            </option>
          ))}
        </Selecao>
      </div>

      {totalPaginas > 1 ? (
        <div className="flex items-center gap-1">
          <Botao
            variante="fantasma"
            tamanho="icone"
            className="size-11 md:size-10"
            aria-label="Página anterior"
            disabled={carregando || paginaAtual === 1}
            onClick={() => onPaginaChange(paginaAtual - 1)}
          >
            <CaretLeft />
          </Botao>

          <span className="px-2 text-sm tabular-nums text-muted-foreground md:hidden">
            {paginaAtual} de {total}
          </span>

          <div className="hidden items-center gap-1 md:flex">
            {botoes.map((item) =>
              typeof item === 'number' ? (
                <Botao
                  key={item}
                  variante={item === paginaAtual ? 'contorno' : 'fantasma'}
                  tamanho="icone"
                  disabled={carregando}
                  onClick={() => onPaginaChange(item)}
                  aria-label={`Ir para a página ${item}`}
                  aria-current={item === paginaAtual ? 'page' : undefined}
                  className={cn('tabular-nums', item !== paginaAtual && 'text-muted-foreground')}
                >
                  {item}
                </Botao>
              ) : (
                <span key={item} className="px-1 text-muted-foreground" aria-hidden>
                  …
                </span>
              ),
            )}
          </div>

          <Botao
            variante="fantasma"
            tamanho="icone"
            className="size-11 md:size-10"
            aria-label="Próxima página"
            disabled={carregando || paginaAtual === total}
            onClick={() => onPaginaChange(paginaAtual + 1)}
          >
            <CaretRight />
          </Botao>
        </div>
      ) : null}
    </nav>
  )
}
