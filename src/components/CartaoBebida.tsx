'use client'

import { useState } from 'react'
import Image from 'next/image'
import { Plus, Wine } from 'lucide-react'
import { Bebida } from '@/lib/supabase'
import { useCarrinho } from '@/contexts/CarrinhoContext'
import { normalizarNomeCategoria } from '@/lib/categoriasCardapio'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

type CartaoBebidaProps = {
  bebida: Bebida
  onAdicionar?: (bebida: Bebida) => void
}

export default function CartaoBebida({ bebida, onAdicionar }: CartaoBebidaProps) {
  const [imagemCarregada, setImagemCarregada] = useState(false)
  const [erroImagem, setErroImagem] = useState(false)
  const { adicionarItem } = useCarrinho()
  const categoriaBebida = normalizarNomeCategoria(bebida.categoria)

  const srcImagem =
    !erroImagem && typeof bebida.imagem_url === 'string' && bebida.imagem_url.trim().length > 0
      ? bebida.imagem_url
      : ''
  const exibindoPlaceholder = !srcImagem

  const adicionarAoCarrinho = () => {
    if (onAdicionar) {
      onAdicionar(bebida)
      return
    }

    const produtoBebida = {
      id: bebida.id,
      nome: bebida.nome,
      descricao: bebida.descricao || '',
      preco: bebida.preco,
      categoria: categoriaBebida,
      imagem_url: bebida.imagem_url || '',
      disponivel: true,
      ordem: bebida.ordem,
      destaque: false,
      created_at: bebida.created_at,
      updated_at: bebida.updated_at,
    }

    adicionarItem(produtoBebida, 1, [], undefined)
  }

  return (
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
              alt={bebida.nome}
              fill
              className={`object-contain p-3 transition-opacity duration-300 ${imagemCarregada ? 'opacity-100' : 'opacity-0'
                }`}
              onLoad={() => setImagemCarregada(true)}
              onError={() => setErroImagem(true)}
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            />
          </>
        )}

        {exibindoPlaceholder && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-muted/60">
            <Wine className="mb-2 h-10 w-10 text-muted-foreground/45" strokeWidth={1.5} />
            <span className="text-[11px] font-medium text-muted-foreground">
              Foto em breve
            </span>
          </div>
        )}

        <div className="absolute left-2 top-2">
          <Badge
            variant="secondary"
            className="max-w-[11rem] truncate px-2 py-0.5 text-[10px] uppercase"
            title={categoriaBebida}
          >
            {categoriaBebida}
          </Badge>
        </div>
      </div>

      <div className="flex flex-1 flex-col p-3">
        <h3 className="mb-1 line-clamp-2 text-sm font-semibold leading-snug text-foreground">
          {bebida.nome}
        </h3>

        <div className="mb-3 flex flex-1 flex-col">
          <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
            {bebida.descricao || 'Gelada e pronta para acompanhar seu pedido.'}
          </p>
        </div>

        <div className="mt-auto space-y-2.5 border-t border-border/70 pt-3">
          <span className="text-lg font-semibold text-foreground">
            R$ {bebida.preco.toFixed(2)}
          </span>

          <Button
            type="button"
            onClick={adicionarAoCarrinho}
            size="sm"
            className="min-h-10 w-full gap-1.5 text-xs"
            aria-label={`Adicionar ${bebida.nome} ao carrinho`}
          >
            <Plus className="h-4 w-4" />
            Adicionar
          </Button>
        </div>
      </div>
    </article>
  )
}
