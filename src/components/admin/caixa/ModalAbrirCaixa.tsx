'use client'

import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Botao, Campo, EntradaPreco, Gaveta, Segmentos, Selecao } from '@/components/admin/ui'
import { formatarMoedaCaixa } from '@/lib/caixa-gaveta'
import type { Funcionario } from '@/lib/tipos-caixa'
import type { PedidoDia } from '@/lib/useCaixa'

type ModoAbertura = 'manual' | 'pedidos' | 'saldo_atual'

type Props = {
  aberto: boolean
  funcionarios: Funcionario[]
  pedidosHoje: PedidoDia[]
  totalPedidosHoje: number
  onFechar: () => void
  onConfirmar: (
    valor: number,
    responsavel: string,
    dataReferencia?: Date,
    modoAbertura?: ModoAbertura,
  ) => Promise<boolean>
}

const opcoesModo: { valor: 'manual' | 'pedidos'; rotulo: string }[] = [
  { valor: 'manual', rotulo: 'Só o fundo' },
  { valor: 'pedidos', rotulo: 'Com pedidos do dia' },
]

export default function ModalAbrirCaixa({
  aberto,
  funcionarios,
  totalPedidosHoje,
  onFechar,
  onConfirmar,
}: Props) {
  const ativos = useMemo(
    () => funcionarios.filter((f) => f.ativo).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
    [funcionarios],
  )
  const [modo, setModo] = useState<ModoAbertura>('manual')
  const [valor, setValor] = useState('0')
  const [responsavel, setResponsavel] = useState('')
  const [processando, setProcessando] = useState(false)

  useEffect(() => {
    if (!aberto) return
    setModo('manual')
    setValor('0')
    setResponsavel(ativos[0]?.nome || '')
  }, [aberto, ativos])

  useEffect(() => {
    if (modo === 'pedidos') setValor(totalPedidosHoje.toFixed(2))
    if (modo === 'manual' && valor === '') setValor('0')
  }, [modo, totalPedidosHoje, valor])

  const handleConfirmar = async () => {
    if (!responsavel.trim()) {
      toast.error('Selecione o responsável')
      return
    }
    const numero = Number(valor.replace(',', '.'))
    if (Number.isNaN(numero) || numero < 0) {
      toast.error('Informe um valor válido')
      return
    }
    setProcessando(true)
    const ok = await onConfirmar(numero, responsavel.trim(), undefined, modo)
    setProcessando(false)
    if (ok) onFechar()
  }

  return (
    <Gaveta
      aberto={aberto}
      aoFechar={onFechar}
      bloqueada={processando}
      titulo="Abrir caixa"
      descricao="Começa o caixa do dia com o dinheiro que já está na gaveta."
      rodape={
        <>
          <Botao variante="contorno" onClick={onFechar} disabled={processando}>
            Cancelar
          </Botao>
          <Botao carregando={processando} onClick={() => void handleConfirmar()}>
            Abrir caixa
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
        <Campo rotulo="Responsável" htmlFor="responsavel-abertura">
          <Selecao id="responsavel-abertura" value={responsavel} onChange={(e) => setResponsavel(e.target.value)}>
            {ativos.length === 0 && <option value="">Nenhum funcionário ativo</option>}
            {ativos.map((f) => (
              <option key={f.id} value={f.nome}>
                {f.nome}
              </option>
            ))}
          </Selecao>
        </Campo>

        <Campo
          rotulo="Como abrir"
          ajuda={
            modo === 'pedidos'
              ? `Abre com R$ 0 e lança os pedidos de hoje como entradas (${formatarMoedaCaixa(totalPedidosHoje)}).`
              : undefined
          }
        >
          <Segmentos
            opcoes={opcoesModo}
            valor={modo === 'pedidos' ? 'pedidos' : 'manual'}
            aoMudar={setModo}
            rotuloAcessivel="Como abrir o caixa"
          />
        </Campo>

        {modo === 'manual' && (
          <Campo rotulo="Dinheiro na gaveta" htmlFor="valor-abertura" ajuda="Troco que fica na gaveta para começar o dia.">
            <EntradaPreco id="valor-abertura" valor={valor} aoMudar={setValor} />
          </Campo>
        )}
        <button type="submit" className="hidden" aria-hidden tabIndex={-1} />
      </form>
    </Gaveta>
  )
}
