'use client'

import { HelpCircle, MessageCircle } from 'lucide-react'
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from '@/components/ui/drawer'

type AjudaPedidoPublicaProps = {
  aberto: boolean
  numeroWhatsApp?: string | null
  onFechar: () => void
}

export function AjudaPedidoPublica({ aberto, numeroWhatsApp, onFechar }: AjudaPedidoPublicaProps) {
  const telefone = String(numeroWhatsApp || '').replace(/\D/g, '')
  const linkWhatsApp = telefone ? `https://wa.me/${telefone}?text=${encodeURIComponent('Olá! Preciso de ajuda para fazer um pedido.')}` : null

  return (
    <Drawer open={aberto} onOpenChange={(open) => !open && onFechar()}>
      <DrawerContent className="mx-auto max-w-lg">
        <DrawerHeader className="text-left">
          <DrawerTitle className="flex items-center gap-2">
            <HelpCircle className="size-5 text-primary" />
            Como fazer seu pedido
          </DrawerTitle>
          <DrawerDescription>Escolha seus itens e finalize pelo Carrinho no menu inferior.</DrawerDescription>
        </DrawerHeader>
        <div className="space-y-4 overflow-y-auto px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)]">
          <ol className="space-y-3 border-l border-border pl-4 text-sm">
            <li><strong className="text-foreground">Escolha:</strong> <span className="text-muted-foreground">toque em Adicionar e personalize quando houver opções.</span></li>
            <li><strong className="text-foreground">Revise:</strong> <span className="text-muted-foreground">abra Carrinho para mudar quantidades e conferir o total.</span></li>
            <li><strong className="text-foreground">Confirme:</strong> <span className="text-muted-foreground">informe entrega, seus dados e a forma de pagamento.</span></li>
          </ol>
          {linkWhatsApp && (
            <a
              href={linkWhatsApp}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-border/70 bg-card text-sm font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              <MessageCircle className="size-4 text-emerald-600" />
              Falar pelo WhatsApp
            </a>
          )}
          <button
            type="button"
            onClick={onFechar}
            className="inline-flex h-11 w-full items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Voltar ao cardápio
          </button>
        </div>
      </DrawerContent>
    </Drawer>
  )
}
