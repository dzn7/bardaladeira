'use client'

import { Home, Receipt, ShoppingCart } from 'lucide-react'
import { useCarrinho } from '@/contexts/CarrinhoContext'

type FooterProps = {
  onAbrirCarrinho: () => void
  onAbrirPedidos: () => void
}

export default function Footer({ onAbrirCarrinho, onAbrirPedidos }: FooterProps) {
  const { quantidadeTotal } = useCarrinho()

  const scrollParaInicio = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40" aria-label="Navegação do cardápio" data-public-bottom-nav>
      <div className="border-t border-border/80 bg-background/95 backdrop-blur-xl">
        <div className="container mx-auto px-3">
          <div className="mx-auto flex max-w-md items-stretch justify-around py-1.5">
            {/* Início */}
            <button
              onClick={scrollParaInicio}
              className="group flex min-h-12 min-w-16 cursor-pointer flex-col items-center justify-center gap-0.5 rounded-xl px-3 py-1 text-muted-foreground transition-colors duration-200 hover:bg-accent hover:text-accent-foreground"
              aria-label="Ir para o início"
            >
              <Home className="h-[22px] w-[22px] transition-transform duration-200 group-active:scale-90" />
              <span className="text-[11px] font-medium">Início</span>
            </button>

            {/* Pedidos */}
            <button
              onClick={onAbrirPedidos}
              className="group flex min-h-12 min-w-16 cursor-pointer flex-col items-center justify-center gap-0.5 rounded-xl px-3 py-1 text-muted-foreground transition-colors duration-200 hover:bg-accent hover:text-accent-foreground"
              aria-label="Ver meus pedidos"
            >
              <Receipt className="h-[22px] w-[22px] transition-transform duration-200 group-active:scale-90" />
              <span className="text-[11px] font-medium">Pedidos</span>
            </button>

            {/* Carrinho */}
            <button
              onClick={onAbrirCarrinho}
              className="group relative flex min-h-12 min-w-16 cursor-pointer flex-col items-center justify-center gap-0.5 rounded-xl px-3 py-1 text-primary transition-colors duration-200 hover:bg-primary/10"
              aria-label={quantidadeTotal > 0 ? `Abrir carrinho com ${quantidadeTotal} itens` : 'Abrir carrinho vazio'}
            >
              <div className="relative">
                <ShoppingCart className="h-[22px] w-[22px] transition-transform duration-200 group-active:scale-90" />
                {quantidadeTotal > 0 && (
                  <span
                    className="absolute -right-2.5 -top-2 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold leading-none text-primary-foreground shadow-sm"
                    aria-live="polite"
                  >
                    {quantidadeTotal > 99 ? '99+' : quantidadeTotal}
                  </span>
                )}
              </div>
              <span className="text-[11px] font-semibold">Carrinho</span>
            </button>
          </div>
        </div>
      </div>

      {/* Safe area para dispositivos com barra inferior */}
      <div className="bg-background/95 backdrop-blur-xl" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }} />
    </nav>
  )
}
