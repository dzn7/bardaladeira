'use client'

import { useEffect, useState } from 'react'
import { Trash as Trash2 } from '@phosphor-icons/react'
import { AreaTexto, Botao, Campo, Contador, EntradaPreco, Gaveta } from '@/components/admin/ui'

export type ItemPedidoModalDadosAdmin = {
  id: string
  nome: string
  preco: number
  categoria?: string | null
  quantidade: number
  observacoes: string
  descontoManualInput: string
}

type ModalItemPedidoAdminProps = {
  aberto: boolean
  modoEdicao: boolean
  dados: ItemPedidoModalDadosAdmin | null
  descontosAtivos: boolean
  onFechar: () => void
  onConfirmar: (atualizado: { quantidade: number; observacoes: string; descontoManualInput: string }) => void
  onRemover?: () => void
}

const normalizarInputMonetario = (valor: string) => {
  const limpo = valor.replace(',', '.').replace(/[^\d.]/g, '')
  if (!limpo) return ''
  const partes = limpo.split('.')
  if (partes.length === 1) return partes[0]
  const inteira = partes[0]
  const decimal = partes.slice(1).join('').slice(0, 2)
  return decimal.length > 0 ? `${inteira}.${decimal}` : `${inteira}.`
}

const paraNumero = (valor: string) => {
  const n = Number(valor.replace(',', '.').trim())
  return Number.isFinite(n) && n >= 0 ? n : 0
}

export default function ModalItemPedidoAdmin({
  aberto,
  modoEdicao,
  dados,
  descontosAtivos,
  onFechar,
  onConfirmar,
  onRemover,
}: ModalItemPedidoAdminProps) {
  const [quantidade, setQuantidade] = useState(1)
  const [observacoes, setObservacoes] = useState('')
  const [desconto, setDesconto] = useState('')

  useEffect(() => {
    if (!aberto || !dados) return
    setQuantidade(Math.max(1, dados.quantidade || 1))
    setObservacoes(dados.observacoes || '')
    setDesconto(dados.descontoManualInput || '')
  }, [aberto, dados])

  if (!dados) return null

  const subtotalBruto = dados.preco * quantidade
  const descontoValor = descontosAtivos ? Math.min(subtotalBruto, paraNumero(desconto)) : 0
  const subtotalFinal = Math.max(0, subtotalBruto - descontoValor)

  const confirmar = () => {
    onConfirmar({
      quantidade,
      observacoes: observacoes.trim(),
      descontoManualInput: desconto,
    })
  }

  return (
    <Gaveta
      aberto={aberto}
      aoFechar={onFechar}
      titulo={<span className="line-clamp-2">{dados.nome}</span>}
      descricao={
        <>
          {modoEdicao ? 'Editar item' : 'Adicionar item'} ·{' '}
          <span className="font-mono tabular-nums">R$ {dados.preco.toFixed(2)}</span> cada
          {dados.categoria ? <> · {dados.categoria}</> : null}
        </>
      }
      rodape={
        <>
          {modoEdicao && onRemover ? (
            <Botao
              variante="perigoSuave"
              tamanho="lg"
              className="md:mr-auto md:h-10 md:text-sm"
              onClick={() => { onRemover(); onFechar() }}
            >
              <Trash2 />
              Remover
            </Botao>
          ) : null}
          <Botao variante="contorno" tamanho="lg" className="md:h-10 md:text-sm" onClick={onFechar}>
            Cancelar
          </Botao>
          <Botao tamanho="lg" className="md:h-10 md:text-sm" onClick={confirmar}>
            {modoEdicao ? 'Atualizar' : 'Adicionar'}
            <span className="font-mono tabular-nums">· R$ {subtotalFinal.toFixed(2)}</span>
          </Botao>
        </>
      }
    >
      <div className="space-y-5">
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm font-medium text-foreground">Quantidade</span>
          <Contador valor={quantidade} aoMudar={setQuantidade} minimo={1} maximo={99} rotuloAcessivel="quantidade" />
        </div>

        {descontosAtivos && (
          <Campo rotulo="Desconto do item" htmlFor="modal-item-desconto" ajuda="Aplicado uma vez sobre o subtotal do item." opcional>
            <EntradaPreco
              id="modal-item-desconto"
              valor={desconto}
              aoMudar={(valor) => setDesconto(normalizarInputMonetario(valor))}
            />
          </Campo>
        )}

        <Campo rotulo="Observações" htmlFor="modal-item-obs" opcional>
          <AreaTexto
            id="modal-item-obs"
            value={observacoes}
            onChange={(e) => setObservacoes(e.target.value)}
            placeholder="Ex: sem cebola, ponto da carne, embalagem"
            rows={2}
          />
        </Campo>

        <div className="space-y-1.5 rounded-xl border border-border/70 bg-muted/30 px-3 py-3 text-sm">
          <div className="flex items-center justify-between text-muted-foreground">
            <span>Subtotal</span>
            <span className="font-mono tabular-nums">R$ {subtotalBruto.toFixed(2)}</span>
          </div>
          {descontosAtivos && descontoValor > 0 && (
            <div className="flex items-center justify-between text-destructive">
              <span>Desconto</span>
              <span className="font-mono tabular-nums">- R$ {descontoValor.toFixed(2)}</span>
            </div>
          )}
          <div className="flex items-center justify-between border-t border-border/70 pt-2">
            <span className="font-medium text-foreground">Total do item</span>
            <span className="font-mono text-lg font-semibold tabular-nums">R$ {subtotalFinal.toFixed(2)}</span>
          </div>
        </div>
      </div>
    </Gaveta>
  )
}
