'use client'

import type { ReactNode } from 'react'
import { useState } from 'react'
import { ListFilter } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useIsMobile } from '@/hooks/useIsMobile'
import { cn } from '@/lib/utils'

export type FiltroAvancadoAba = {
  id: string
  label: string
  icon: ReactNode
  ativo?: boolean
  conteudo: ReactNode
}

type FiltroAvancadoProps = {
  hasFilter: boolean
  onLimpar: () => void
  abas: FiltroAvancadoAba[]
  defaultAba?: string
  triggerClassName?: string
  contentClassName?: string
}

const triggerAtivo =
  'border-[#0399F9] text-[#0369A1] dark:border-[#0399F9] dark:text-[#7DD3FC]'

export const FiltroAvancado = ({
  hasFilter,
  onLimpar,
  abas,
  defaultAba,
  triggerClassName,
  contentClassName,
}: FiltroAvancadoProps) => {
  const isMobile = useIsMobile()
  const [aberto, setAberto] = useState(false)
  const abaInicial = defaultAba || abas[0]?.id || 'geral'

  const painel = (
    <Tabs defaultValue={abaInicial} className="flex h-full w-full items-start gap-4">
      <div className="flex h-full min-w-[120px] flex-col justify-between">
        <TabsList className="flex h-auto w-full flex-col items-stretch gap-0.5 rounded-none bg-transparent p-0">
          {abas.map((aba) => (
            <TabsTrigger
              key={aba.id}
              value={aba.id}
              className={cn(
                'w-full justify-start gap-2 rounded-none px-2 py-2 text-xs font-medium shadow-none sm:text-sm',
                'data-[state=active]:bg-[#0399F9]/10 data-[state=active]:text-[#0369A1] data-[state=active]:shadow-none',
                'dark:data-[state=active]:bg-[#0399F9]/15 dark:data-[state=active]:text-[#7DD3FC]',
              )}
            >
              {aba.icon}
              <span className="truncate">{aba.label}</span>
              {aba.ativo ? (
                <span className="ml-auto h-2 w-2 shrink-0 rounded-full bg-[#0399F9]" />
              ) : null}
            </TabsTrigger>
          ))}
        </TabsList>

        {hasFilter && !isMobile ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="mt-3 h-9 w-full shadow-none"
            onClick={onLimpar}
          >
            Limpar
          </Button>
        ) : null}
      </div>

      <div className="hidden w-px self-stretch bg-border/70 sm:block" />

      <div className="min-h-0 min-w-0 flex-1">
        {abas.map((aba) => (
          <TabsContent
            key={aba.id}
            value={aba.id}
            className="mt-0 h-full max-h-[340px] space-y-4 overflow-y-auto focus-visible:ring-0"
          >
            {aba.conteudo}
          </TabsContent>
        ))}
      </div>
    </Tabs>
  )

  const botao = (
    <Button
      type="button"
      size="sm"
      variant="outline"
      className={cn(
        'h-9 gap-2 border-border/70 bg-card text-foreground shadow-none hover:bg-muted',
        (aberto || hasFilter) && triggerAtivo,
        triggerClassName,
      )}
      aria-label="Abrir filtros"
      onClick={isMobile ? () => setAberto(true) : undefined}
    >
      <ListFilter className="h-4 w-4" />
      Filtrar
      {hasFilter ? <span className="h-2 w-2 animate-pulse rounded-full bg-[#0399F9]" /> : null}
    </Button>
  )

  if (isMobile) {
    return (
      <>
        {botao}
        <Sheet open={aberto} onOpenChange={setAberto}>
          <SheetContent
            side="right"
            className="flex w-full flex-col gap-0 bg-card p-0 sm:max-w-md"
          >
            <SheetHeader className="border-b border-border/60 px-5 py-4 text-left">
              <SheetTitle className="text-[15px] font-semibold">Filtros</SheetTitle>
            </SheetHeader>
            <div className={cn('min-h-0 flex-1 overflow-hidden p-4', contentClassName)}>
              {painel}
            </div>
            <SheetFooter className="mt-auto flex flex-col gap-2 border-t border-border/60 p-4 sm:flex-col sm:space-x-0">
              <Button
                type="button"
                variant="outline"
                className="h-10 w-full shadow-none"
                onClick={onLimpar}
              >
                Limpar
              </Button>
              <Button
                type="button"
                className="h-10 w-full shadow-none"
                onClick={() => setAberto(false)}
              >
                Aplicar
              </Button>
            </SheetFooter>
          </SheetContent>
        </Sheet>
      </>
    )
  }

  return (
    <DropdownMenu modal={false} open={aberto} onOpenChange={setAberto}>
      <DropdownMenuTrigger asChild>{botao}</DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className={cn(
          'w-[min(600px,calc(100vw-2rem))] p-5 dark:bg-[#161717]',
          'h-[420px]',
          contentClassName,
        )}
        onCloseAutoFocus={(event) => event.preventDefault()}
      >
        {painel}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
