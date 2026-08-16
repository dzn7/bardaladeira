'use client'

import { useState } from 'react'
import Image from 'next/image'
import { Plus, Info, UtensilsCrossed } from 'lucide-react'
import { Produto } from '@/lib/supabase'
import ModalIngredientes from './ModalIngredientes'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

type CartaoProdutoProps = {
  produto: Produto
  onAdicionar: (produto: Produto) => void
}

export default function CartaoProduto({ produto, onAdicionar }: CartaoProdutoProps) {
  const [imagemCarregada, setImagemCarregada] = useState(false)
  const [erroImagem, setErroImagem] = useState(false)
  const [modalIngredientesAberto, setModalIngredientesAberto] = useState(false)

  const precoOriginal = typeof produto.preco_original === 'number' ? produto.preco_original : null
  const possuiDesconto = Boolean(produto.desconto && produto.desconto > 0 && precoOriginal)
  const srcImagem =
    !erroImagem && typeof produto.imagem_url === 'string' && produto.imagem_url.trim().length > 0
      ? produto.imagem_url
      : ''
  const exibindoPlaceholder = !srcImagem

  return (
    <>
      <article className="group flex h-full flex-col overflow-hidden rounded-xl border border-border/70 bg-card text-card-foreground transition-colors hover:border-border">
        <div className="relative aspect-[4/5] w-full overflow-hidden bg-muted">
          {!exibindoPlaceholder && (
            <>
              {!imagemCarregada && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-border border-t-primary" />
                </div>
              )}
              <Image
                src={srcImagem}
                alt={produto.nome}
                fill
                className={`object-cover transition-opacity duration-300 ${
                  imagemCarregada ? 'opacity-100' : 'opacity-0'
                }`}
                onLoad={() => setImagemCarregada(true)}
                onError={() => setErroImagem(true)}
                sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
              />
            </>
          )}

          {exibindoPlaceholder && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-muted/60">
              <UtensilsCrossed className="mb-2 h-10 w-10 text-muted-foreground/45" strokeWidth={1.5} />
              <span className="text-[11px] font-medium text-muted-foreground">
                Foto em breve
              </span>
            </div>
          )}

          <div className="absolute left-2 top-2">
            <Badge variant="secondary" className="max-w-[10rem] truncate px-2 py-0.5 text-[10px] uppercase">
              {produto.categoria}
            </Badge>
          </div>

          {possuiDesconto && (
            <div className="absolute right-2 top-2">
              <Badge className="bg-destructive px-2 py-0.5 text-[10px] text-destructive-foreground">
                -{produto.desconto}%
              </Badge>
            </div>
          )}
        </div>

        <div className="flex flex-1 flex-col p-3">
          <h3 className="mb-1 line-clamp-2 text-sm font-semibold leading-snug text-foreground">
            {produto.nome}
          </h3>

          <div className="mb-3 flex flex-1 flex-col">
            <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
              {produto.descricao}
            </p>

            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setModalIngredientesAberto(true)}
              className="mt-1.5 h-7 self-start px-0 text-[11px] font-medium text-muted-foreground hover:bg-transparent hover:text-foreground"
              aria-label={`Ver ingredientes de ${produto.nome}`}
            >
              <Info className="h-3 w-3" />
              <span>Ver ingredientes</span>
            </Button>
          </div>

          <div className="mt-auto space-y-2.5 border-t border-border/70 pt-3">
            <div className="flex items-baseline gap-2">
              {possuiDesconto && (
                <span className="text-[11px] text-muted-foreground line-through">
                  R$ {precoOriginal?.toFixed(2)}
                </span>
              )}
              <span className="text-lg font-semibold text-foreground">
                R$ {produto.preco.toFixed(2)}
              </span>
            </div>

            <Button
              type="button"
              onClick={() => onAdicionar(produto)}
              size="sm"
              className="min-h-10 w-full gap-1.5 text-xs"
              aria-label={`Adicionar ${produto.nome} ao carrinho`}
            >
              <Plus className="h-4 w-4" />
              Adicionar
            </Button>
          </div>
        </div>
      </article>

      <ModalIngredientes
        produto={produto}
        aberto={modalIngredientesAberto}
        onFechar={() => setModalIngredientesAberto(false)}
      />
    </>
  )
}
