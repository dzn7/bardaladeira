'use client'

import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { Loader2, Minus, Plus } from 'lucide-react'
import { toast } from 'sonner'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ajustarEstoqueProduto, ErroEstoque } from '@/lib/estoque'
import { cn } from '@/lib/utils'
import { useNotificacoesAdmin } from '@/features/notificacoes'

type ControleEstoqueProdutoProps = {
  produtoId: string
  quantidade: number
  nomeProduto?: string
  desabilitado?: boolean
  onQuantidadeConfirmada: (quantidade: number) => void
}

const parsearInteiroNaoNegativo = (valor: string) => {
  const texto = valor.trim()
  if (!/^\d+$/.test(texto)) return null
  const numero = Number(texto)
  return Number.isInteger(numero) && numero >= 0 ? numero : null
}

export const ControleEstoqueProduto = ({
  produtoId,
  quantidade,
  nomeProduto,
  desabilitado = false,
  onQuantidadeConfirmada,
}: ControleEstoqueProdutoProps) => {
  const [texto, setTexto] = useState(String(quantidade))
  const [quantidadeLocal, setQuantidadeLocal] = useState(quantidade)
  const [ocupado, setOcupado] = useState(false)
  const [confirmarZerar, setConfirmarZerar] = useState(false)
  const campoRef = useRef<HTMLInputElement>(null)
  const quantidadePropRef = useRef(quantidade)
  const { invalidar: invalidarNotificacoes } = useNotificacoesAdmin()

  useEffect(() => {
    quantidadePropRef.current = quantidade
    if (ocupado) return
    if (document.activeElement === campoRef.current) return
    setQuantidadeLocal(quantidade)
    setTexto(String(quantidade))
  }, [quantidade, ocupado])

  const reconciliar = (confirmada: number) => {
    setQuantidadeLocal(confirmada)
    setTexto(String(confirmada))
    onQuantidadeConfirmada(confirmada)
  }

  const restaurar = (valor: number) => {
    setQuantidadeLocal(valor)
    setTexto(String(valor))
  }

  const executarAjuste = async (ajuste: { delta: number } | { quantidade: number }, previa: number) => {
    const anterior = quantidadePropRef.current
    setQuantidadeLocal(previa)
    setTexto(String(previa))
    setOcupado(true)
    try {
      const confirmada = await ajustarEstoqueProduto({ produtoId, ...ajuste })
      reconciliar(confirmada)
      void invalidarNotificacoes().catch(() => undefined)
    } catch (erro) {
      restaurar(anterior)
      const mensagem = erro instanceof ErroEstoque ? erro.message : 'Não foi possível atualizar o estoque.'
      toast.error(mensagem)
    } finally {
      setOcupado(false)
    }
  }

  const handleDelta = (delta: number) => {
    if (desabilitado || ocupado) return
    const previa = quantidadeLocal + delta
    if (previa < 0) return
    void executarAjuste({ delta }, previa)
  }

  const confirmarAbsoluto = () => {
    if (desabilitado || ocupado) return
    const interpretado = parsearInteiroNaoNegativo(texto)
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

  const handleBlur = () => {
    if (texto.trim() === '') {
      restaurar(quantidadeLocal)
      return
    }
    confirmarAbsoluto()
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

  const handleZerar = () => {
    setConfirmarZerar(false)
    if (quantidadeLocal === 0) return
    void executarAjuste({ quantidade: 0 }, 0)
  }

  const bloqueado = desabilitado || ocupado

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center rounded-lg border border-border/70 bg-background">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-11 w-11 min-h-11 min-w-11 rounded-r-none shadow-none"
          onClick={() => handleDelta(-1)}
          disabled={bloqueado || quantidadeLocal === 0}
          aria-label={`Diminuir estoque de ${nomeProduto || 'produto'}`}
        >
          <Minus className="h-4 w-4" />
        </Button>
        <Input
          ref={campoRef}
          value={texto}
          onChange={(evento) => setTexto(evento.target.value)}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          inputMode="numeric"
          disabled={bloqueado}
          aria-label={`Quantidade em estoque de ${nomeProduto || 'produto'}`}
          className={cn(
            'h-11 w-16 rounded-none border-0 border-x border-border/70 px-1 text-center font-mono tabular-nums shadow-none',
            ocupado && 'opacity-70',
          )}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-11 w-11 min-h-11 min-w-11 rounded-l-none shadow-none"
          onClick={() => handleDelta(1)}
          disabled={bloqueado}
          aria-label={`Aumentar estoque de ${nomeProduto || 'produto'}`}
        >
          {ocupado ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
        </Button>
      </div>
      <Button
        type="button"
        variant="outline"
        className="h-11 min-h-11 shadow-none"
        onClick={() => setConfirmarZerar(true)}
        disabled={bloqueado || quantidadeLocal === 0}
        aria-label={`Zerar estoque de ${nomeProduto || 'produto'}`}
      >
        Zerar
      </Button>

      <AlertDialog open={confirmarZerar} onOpenChange={setConfirmarZerar}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Zerar estoque?</AlertDialogTitle>
            <AlertDialogDescription>
              {nomeProduto
                ? `A quantidade de ${nomeProduto} vai para zero.`
                : 'A quantidade deste produto vai para zero.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-11">Cancelar</AlertDialogCancel>
            <AlertDialogAction className="h-11" onClick={handleZerar}>
              Zerar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
