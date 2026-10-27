'use client'

import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { Minus, Plus } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { Botao, Entrada, useConfirmar } from '@/components/admin/ui'
import { ajustarEstoqueProduto, ErroEstoque } from '@/lib/estoque'
import { cn } from '@/lib/utils'
import { useNotificacoesAdmin } from '@/features/notificacoes'

type ControleEstoqueProdutoProps = {
  produtoId: string
  tabela?: 'produtos' | 'bebidas'
  quantidade: number
  nomeProduto?: string
  desabilitado?: boolean
  onQuantidadeConfirmada: (quantidade: number) => void
}

// Aceita negativo: a equipe pode registrar uma falta (ex.: -2) ou corrigir a contagem.
const parsearInteiro = (valor: string) => {
  const texto = valor.trim().replace('−', '-')
  return /^-?\d+$/.test(texto) ? Number(texto) : null
}

export const ControleEstoqueProduto = ({
  produtoId,
  tabela = 'produtos',
  quantidade,
  nomeProduto,
  desabilitado = false,
  onQuantidadeConfirmada,
}: ControleEstoqueProdutoProps) => {
  const confirmar = useConfirmar()
  const [texto, setTexto] = useState(String(quantidade))
  const [quantidadeLocal, setQuantidadeLocal] = useState(quantidade)
  const [ocupado, setOcupado] = useState(false)
  const campoRef = useRef<HTMLInputElement>(null)
  const quantidadePropRef = useRef(quantidade)
  const { invalidar: invalidarNotificacoes } = useNotificacoesAdmin()
  const nome = nomeProduto || 'produto'

  useEffect(() => {
    quantidadePropRef.current = quantidade
    if (ocupado) return
    if (document.activeElement === campoRef.current) return
    setQuantidadeLocal(quantidade)
    setTexto(String(quantidade))
  }, [quantidade, ocupado])

  const restaurar = (valor: number) => {
    setQuantidadeLocal(valor)
    setTexto(String(valor))
  }

  const executarAjuste = async (ajuste: { delta: number } | { quantidade: number }, previa: number) => {
    const anterior = quantidadePropRef.current
    restaurar(previa)
    setOcupado(true)
    try {
      const confirmada = await ajustarEstoqueProduto({ produtoId, tabela, ...ajuste })
      restaurar(confirmada)
      onQuantidadeConfirmada(confirmada)
      void invalidarNotificacoes().catch(() => undefined)
    } catch (erro) {
      restaurar(anterior)
      toast.error(erro instanceof ErroEstoque ? erro.message : 'Não foi possível atualizar o estoque.')
    } finally {
      setOcupado(false)
    }
  }

  const handleDelta = (delta: number) => {
    if (desabilitado || ocupado) return
    void executarAjuste({ delta }, quantidadeLocal + delta)
  }

  const confirmarAbsoluto = () => {
    if (desabilitado || ocupado) return
    const interpretado = parsearInteiro(texto)
    if (interpretado === null) {
      restaurar(quantidadeLocal)
      return
    }
    if (interpretado === quantidadeLocal) {
      setTexto(String(interpretado))
      return
    }
    void executarAjuste({ quantidade: interpretado }, interpretado)
  }

  const handleKeyDown = (evento: KeyboardEvent<HTMLInputElement>) => {
    if (evento.key === 'Enter') {
      evento.preventDefault()
      confirmarAbsoluto()
      campoRef.current?.blur()
      return
    }
    if (evento.key === 'Escape') {
      evento.preventDefault()
      restaurar(quantidadeLocal)
      campoRef.current?.blur()
    }
  }

  const handleZerar = async () => {
    const ok = await confirmar({
      titulo: `Zerar o estoque de ${nome}?`,
      descricao: 'O saldo vai para 0 e a correção fica no histórico.',
      confirmar: 'Zerar',
      perigo: true,
    })
    if (ok) void executarAjuste({ quantidade: 0 }, 0)
  }

  const bloqueado = desabilitado || ocupado

  return (
    <div className="flex items-center gap-2">
      <div className="flex h-11 items-center overflow-hidden rounded-lg border border-border/70 bg-background">
        <button
          type="button"
          onClick={() => handleDelta(-1)}
          disabled={bloqueado}
          aria-label={`Diminuir estoque de ${nome}`}
          className="flex h-full w-11 items-center justify-center text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-40"
        >
          <Minus className="size-4" />
        </button>
        <Entrada
          ref={campoRef}
          value={texto}
          onChange={(evento) => setTexto(evento.target.value)}
          onBlur={() => (texto.trim() === '' ? restaurar(quantidadeLocal) : confirmarAbsoluto())}
          onKeyDown={handleKeyDown}
          inputMode="text"
          disabled={bloqueado}
          aria-label={`Quantidade em estoque de ${nome}`}
          className={cn(
            'h-full w-16 rounded-none border-0 border-x border-border/70 px-1 text-center tabular-nums shadow-none focus-visible:ring-0',
            quantidadeLocal < 0 && 'text-destructive',
            ocupado && 'opacity-60',
          )}
        />
        <button
          type="button"
          onClick={() => handleDelta(1)}
          disabled={bloqueado}
          aria-label={`Aumentar estoque de ${nome}`}
          className="flex h-full w-11 items-center justify-center text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-40"
        >
          <Plus className="size-4" />
        </button>
      </div>
      <Botao
        variante="fantasma"
        className="h-11"
        onClick={() => void handleZerar()}
        disabled={bloqueado || quantidadeLocal === 0}
      >
        Zerar
      </Botao>
    </div>
  )
}
