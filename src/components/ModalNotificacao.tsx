'use client'

import { AlertCircle, AlertTriangle, CheckCircle, Info } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

type TipoNotificacao = 'sucesso' | 'erro' | 'aviso' | 'info' | 'confirmacao'

type ModalNotificacaoProps = {
  aberto: boolean
  tipo: TipoNotificacao
  titulo: string
  mensagem: string
  onFechar: () => void
  onConfirmar?: () => void
  textoBotaoConfirmar?: string
  textoBotaoCancelar?: string
}

const TIPO_CONFIG = {
  sucesso: { Icone: CheckCircle, cor: 'text-emerald-500' },
  erro: { Icone: AlertCircle, cor: 'text-destructive' },
  aviso: { Icone: AlertTriangle, cor: 'text-amber-500' },
  confirmacao: { Icone: AlertTriangle, cor: 'text-amber-500' },
  info: { Icone: Info, cor: 'text-muted-foreground' },
} as const

export default function ModalNotificacao({
  aberto,
  tipo,
  titulo,
  mensagem,
  onFechar,
  onConfirmar,
  textoBotaoConfirmar = 'Confirmar',
  textoBotaoCancelar = 'Cancelar',
}: ModalNotificacaoProps) {
  const { Icone, cor } = TIPO_CONFIG[tipo]

  return (
    <Dialog open={aberto} onOpenChange={(open) => { if (!open) onFechar() }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-start gap-3">
            <Icone className={`mt-0.5 h-5 w-5 shrink-0 ${cor}`} strokeWidth={1.6} />
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-base">{titulo}</DialogTitle>
              <DialogDescription className="mt-1.5">{mensagem}</DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <DialogFooter>
          {tipo === 'confirmacao' ? (
            <>
              <Button variant="outline" onClick={onFechar}>
                {textoBotaoCancelar}
              </Button>
              <Button
                variant="destructive"
                onClick={() => { onConfirmar?.(); onFechar() }}
              >
                {textoBotaoConfirmar}
              </Button>
            </>
          ) : (
            <Button onClick={onFechar}>Fechar</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
