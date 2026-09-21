import { memo } from 'react'
import { ScrollText } from 'lucide-react'
import type { EntradaLog } from '../../electron/servicos/tipos'
import { ListaVazia, Painel, PainelCabecalho } from '@/components/ui/painel'
import { formatarDataHora } from '@/dominio/formatacao'
import { cn } from '@/lib/utils'

const corPorNivel = (nivel: EntradaLog['nivel']) => {
  if (nivel === 'erro') return 'text-destructive'
  if (nivel === 'sucesso') return 'text-success'
  if (nivel === 'aviso') return 'text-warning'
  return 'text-muted-foreground'
}

export const PainelLogs = memo(({ logs }: { logs: EntradaLog[] }) => (
  <Painel className="flex min-h-0 flex-col overflow-hidden">
    <PainelCabecalho
      titulo="Registro de execução"
      descricao={`${logs.length} evento${logs.length === 1 ? '' : 's'}`}
      icone={<ScrollText className="h-4 w-4" />}
    />

    {logs.length === 0 ? (
      <ListaVazia icone={<ScrollText className="h-6 w-6" />} titulo="Sem eventos registrados" />
    ) : (
      <ul className="max-h-72 divide-y divide-border/40 overflow-y-auto" data-selecionavel>
        {logs.map((registro) => (
          <li key={registro.id} className="flex items-baseline gap-3 px-4 py-2 text-xs">
            <span className="w-24 shrink-0 font-mono tabular-nums text-muted-foreground">
              {formatarDataHora(registro.criadoEm)}
            </span>
            <span className={cn('w-16 shrink-0 font-medium capitalize', corPorNivel(registro.nivel))}>
              {registro.nivel}
            </span>
            <span className="min-w-0 flex-1 break-words text-foreground/90">{registro.mensagem}</span>
          </li>
        ))}
      </ul>
    )}
  </Painel>
))

PainelLogs.displayName = 'PainelLogs'
