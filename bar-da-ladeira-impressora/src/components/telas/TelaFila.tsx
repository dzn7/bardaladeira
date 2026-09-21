import { memo } from 'react'
import { ListChecks, Play, RotateCcw } from 'lucide-react'
import type { RegistroFilaImpressao } from '../../../electron/servicos/tipos'
import { Button } from '@/components/ui/button'
import { Badge, type BadgeProps } from '@/components/ui/badge'
import { ListaVazia, Painel, PainelCabecalho } from '@/components/ui/painel'
import { formatarDataHora } from '@/dominio/formatacao'

type Props = {
  fila: RegistroFilaImpressao[]
  processando: boolean
  aoProcessarAgora: () => void
  aoReimprimir: (idFila: string) => void
}

const variantePorStatus = (status: string): BadgeProps['variant'] => {
  if (status === 'impresso') return 'sucesso'
  if (status === 'erro') return 'erro'
  if (status === 'processando') return 'primario'
  if (status === 'pendente') return 'aviso'
  return 'neutro'
}

const LinhaFila = memo(
  ({ registro, aoReimprimir }: { registro: RegistroFilaImpressao; aoReimprimir: Props['aoReimprimir'] }) => (
    <tr className="border-b border-border/40 last:border-b-0 transition-colors hover:bg-accent/50">
      <td className="px-4 py-2 font-mono text-xs tabular-nums text-foreground">
        #{registro.pedido_id.slice(0, 8)}
      </td>
      <td className="py-2 pr-3 text-xs capitalize text-foreground">{registro.tipo}</td>
      <td className="py-2 pr-3 text-xs text-muted-foreground">
        {registro.escopo === 'itens_novos' ? 'Itens novos' : 'Pedido completo'}
      </td>
      <td className="py-2 pr-3">
        <Badge variant={variantePorStatus(registro.status)} className="capitalize">
          {registro.status}
        </Badge>
      </td>
      <td className="py-2 pr-3 text-xs tabular-nums text-muted-foreground">{registro.tentativas || 0}</td>
      <td className="py-2 pr-3 text-xs tabular-nums text-muted-foreground">
        {formatarDataHora(registro.criado_em || registro.created_at)}
      </td>
      <td className="py-2 pr-4 text-right">
        <Button size="xs" variant="ghost" onClick={() => aoReimprimir(registro.id)}>
          <RotateCcw className="h-3.5 w-3.5" />
          Reimprimir
        </Button>
      </td>
    </tr>
  )
)

LinhaFila.displayName = 'LinhaFila'

export const TelaFila = memo(({ fila, processando, aoProcessarAgora, aoReimprimir }: Props) => {
  const visiveis = fila.slice(0, 120)

  return (
    <Painel className="overflow-hidden">
      <PainelCabecalho
        titulo="Fila de impressão"
        descricao={`${fila.length} registro${fila.length === 1 ? '' : 's'} recente${fila.length === 1 ? '' : 's'}`}
        icone={<ListChecks className="h-4 w-4" />}
        acoes={
          <Button size="sm" variant="outline" onClick={aoProcessarAgora} disabled={processando}>
            <Play className="h-3.5 w-3.5" />
            {processando ? 'Processando…' : 'Processar agora'}
          </Button>
        }
      />

      {visiveis.length === 0 ? (
        <ListaVazia
          icone={<ListChecks className="h-6 w-6" />}
          titulo="Fila vazia"
          descricao="Nenhum ticket aguardando impressão no momento."
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-left">
            <thead>
              <tr className="border-b border-border/60 text-[11px] uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-2 font-medium">Pedido</th>
                <th className="py-2 pr-3 font-medium">Tipo</th>
                <th className="py-2 pr-3 font-medium">Escopo</th>
                <th className="py-2 pr-3 font-medium">Status</th>
                <th className="py-2 pr-3 font-medium">Tent.</th>
                <th className="py-2 pr-3 font-medium">Criado</th>
                <th className="py-2 pr-4 text-right font-medium">Ação</th>
              </tr>
            </thead>
            <tbody>
              {visiveis.map((registro) => (
                <LinhaFila key={registro.id} registro={registro} aoReimprimir={aoReimprimir} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Painel>
  )
})

TelaFila.displayName = 'TelaFila'
