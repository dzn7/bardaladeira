'use client'

import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { AreaTexto, Botao, Campo, EntradaPreco, Gaveta, Selecao } from '@/components/admin/ui'
import { cn } from '@/lib/utils'
import { formatarMoedaCaixa, type ResumoFormasCaixa } from '@/lib/caixa-gaveta'
import type { Caixa, EstatisticasCaixa, Funcionario } from '@/lib/tipos-caixa'

type Props = {
  aberto: boolean
  caixa: Caixa | null
  funcionarios: Funcionario[]
  estatisticas: EstatisticasCaixa
  resumoFormas: ResumoFormasCaixa
  onFechar: () => void
  onConfirmar: (contadoDinheiro: number, responsavel: string, observacoes?: string) => Promise<boolean>
}

export default function ModalFecharCaixa({
  aberto,
  caixa,
  funcionarios,
  estatisticas,
  resumoFormas,
  onFechar,
  onConfirmar,
}: Props) {
  const ativos = useMemo(
    () => funcionarios.filter((f) => f.ativo).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
    [funcionarios],
  )
  const esperado = estatisticas.esperadoDinheiro
  const [contado, setContado] = useState('')
  const [responsavel, setResponsavel] = useState('')
  const [observacoes, setObservacoes] = useState('')
  const [processando, setProcessando] = useState(false)

  useEffect(() => {
    if (!aberto) return
    setContado(esperado.toFixed(2))
    setResponsavel(ativos[0]?.nome || '')
    setObservacoes('')
  }, [aberto, esperado, ativos])

  const contadoNumero = Number(String(contado).replace(',', '.')) || 0
  const diferenca = contadoNumero - esperado

  const handleConfirmar = async () => {
    if (!responsavel.trim()) {
      toast.error('Selecione o responsável')
      return
    }
    setProcessando(true)
    const ok = await onConfirmar(contadoNumero, responsavel.trim(), observacoes.trim() || undefined)
    setProcessando(false)
    if (ok) onFechar()
  }

  if (!caixa) return null

  return (
    <Gaveta
      aberto={aberto}
      aoFechar={onFechar}
      bloqueada={processando}
      titulo="Fechar caixa"
      descricao="Conte o dinheiro da gaveta. PIX e cartão aparecem só para conferência."
      rodape={
        <>
          <Botao variante="contorno" onClick={onFechar} disabled={processando}>
            Cancelar
          </Botao>
          <Botao carregando={processando} onClick={() => void handleConfirmar()}>
            Fechar caixa
          </Botao>
        </>
      }
    >
      <form
        className="space-y-5"
        onSubmit={(evento) => {
          evento.preventDefault()
          void handleConfirmar()
        }}
      >
        <div className="grid grid-cols-2 divide-x divide-border/70 rounded-xl border border-border/70">
          <div className="p-3">
            <p className="text-[13px] text-muted-foreground">Esperado em dinheiro</p>
            <p className="mt-1 font-mono text-lg font-semibold tabular-nums text-foreground">{formatarMoedaCaixa(esperado)}</p>
          </div>
          <div className="p-3">
            <p className="text-[13px] text-muted-foreground">Diferença</p>
            <p
              className={cn(
                'mt-1 font-mono text-lg font-semibold tabular-nums',
                diferenca === 0 ? 'text-foreground' : diferenca > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive',
              )}
            >
              {formatarMoedaCaixa(diferenca)}
            </p>
          </div>
        </div>

        <Campo rotulo="Dinheiro contado na gaveta" htmlFor="contado-dinheiro">
          <EntradaPreco id="contado-dinheiro" valor={contado} aoMudar={setContado} />
        </Campo>

        <div className="space-y-2">
          <p className="text-sm font-medium text-foreground">Outras formas (não entram na gaveta)</p>
          <dl className="grid grid-cols-3 gap-2 text-sm">
            {[
              { rotulo: 'PIX', valor: resumoFormas.pix },
              { rotulo: 'Cartão', valor: resumoFormas.cartao },
              { rotulo: 'Outros', valor: resumoFormas.outros },
            ].map((item) => (
              <div key={item.rotulo} className="rounded-lg bg-muted/50 px-3 py-2">
                <dt className="text-[13px] text-muted-foreground">{item.rotulo}</dt>
                <dd className="font-mono tabular-nums text-foreground">{formatarMoedaCaixa(item.valor)}</dd>
              </div>
            ))}
          </dl>
        </div>

        <Campo rotulo="Responsável" htmlFor="responsavel-fechamento">
          <Selecao id="responsavel-fechamento" value={responsavel} onChange={(e) => setResponsavel(e.target.value)}>
            {ativos.length === 0 && <option value="">Nenhum funcionário ativo</option>}
            {ativos.map((f) => (
              <option key={f.id} value={f.nome}>
                {f.nome}
              </option>
            ))}
          </Selecao>
        </Campo>

        <Campo rotulo="Observações" htmlFor="obs-fechamento" opcional>
          <AreaTexto
            id="obs-fechamento"
            value={observacoes}
            onChange={(e) => setObservacoes(e.target.value)}
            rows={2}
          />
        </Campo>
        <button type="submit" className="hidden" aria-hidden tabIndex={-1} />
      </form>
    </Gaveta>
  )
}
