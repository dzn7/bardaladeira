'use client'

import { useState } from 'react'
import Image from 'next/image'
import { Plus, Package } from 'lucide-react'
import { Combo } from '@/lib/supabase'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

type CartaoComboProps = {
  combo: Combo & {
    preco_original?: number | null
    desconto_percentual?: number | null
  }
  onAdicionar: (combo: Combo) => void
}

export default function CartaoCombo({ combo, onAdicionar }: CartaoComboProps) {
  const [imagemCarregada, setImagemCarregada] = useState(false)
  const [erroImagem, setErroImagem] = useState(false)

  const srcImagem =
    !erroImagem && typeof combo.imagem_url === 'string' && combo.imagem_url.trim().length > 0
      ? combo.imagem_url
      : ''
  const exibindoPlaceholder = !srcImagem
  const possuiDesconto = Boolean(combo.preco_original && combo.desconto_percentual && combo.desconto_percentual > 0)
  const economia = possuiDesconto ? combo.preco_original! - combo.preco : 0

  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-xl border border-border/70 bg-card text-card-foreground transition-colors hover:border-border">
      <div className="relative aspect-[4/5] w-full overflow-hidden bg-muted">
        {!exibindoPlaceholder && (
          <>
            {!imagemCarregada && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-200 border-t-bordo-600 dark:border-zinc-700 dark:border-t-bordo-400" />
              </div>
            )}
            <Image
              src={srcImagem}
              alt={combo.nome}
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
            <Package className="mb-2 h-10 w-10 text-muted-foreground/45" strokeWidth={1.5} />
            <span className="text-[11px] font-medium text-muted-foreground">
              Foto em breve
            </span>
          </div>
        )}

        <div className="absolute left-2 top-2">
          <Badge variant="secondary" className="px-2 py-0.5 text-[10px] uppercase">
            Combo
          </Badge>
        </div>

        {possuiDesconto && (
          <div className="absolute right-2 top-2">
            <Badge className="bg-destructive px-2 py-0.5 text-[10px] text-destructive-foreground">
              -{combo.desconto_percentual}%
            </Badge>
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col p-3">
        <h3 className="mb-1 line-clamp-2 text-sm font-semibold leading-snug text-foreground">
          {combo.nome}
        </h3>

        <div className="mb-3 flex flex-1 flex-col">
          <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
            {combo.descricao || 'Uma combinacao pronta para pedir sem complicacao.'}
          </p>
        </div>

        <div className="mt-auto space-y-2.5 border-t border-border/70 pt-3">
          <div>
            <div className="flex items-baseline gap-2">
              {possuiDesconto && (
                <span className="text-[11px] text-muted-foreground line-through">
                  R$ {combo.preco_original!.toFixed(2)}
                </span>
              )}
              <span className="text-lg font-semibold text-foreground">
                R$ {combo.preco.toFixed(2)}
              </span>
            </div>
            {possuiDesconto && economia > 0 && (
              <p className="mt-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                Economize R$ {economia.toFixed(2)}
              </p>
            )}
          </div>

          <Button
            type="button"
            onClick={() => onAdicionar(combo as Combo)}
            size="sm"
            className="min-h-10 w-full gap-1.5 text-xs"
            aria-label={`Adicionar ${combo.nome} ao carrinho`}
          >
            <Plus className="h-4 w-4" />
            Adicionar
          </Button>
        </div>
      </div>
    </article>
  )
}
