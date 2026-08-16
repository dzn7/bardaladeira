'use client'

import { useEffect } from 'react'
import { X } from 'lucide-react'
import { Produto } from '@/lib/supabase'

type ModalIngredientesProps = {
  produto: Produto | null
  aberto: boolean
  onFechar: () => void
}

// Extrai os ingredientes da descrição do produto
const extrairIngredientes = (descricao: string | null | undefined): string[] => {
  if (!descricao) return []
  
  let ingredientes: string[] = []
  
  // Tenta separar por diferentes delimitadores
  if (descricao.includes('•')) {
    ingredientes = descricao.split('•')
  } else if (descricao.includes(',')) {
    ingredientes = descricao.split(',')
  } else if (descricao.includes('-')) {
    ingredientes = descricao.split('-')
  } else {
    ingredientes = [descricao]
  }
  
  return ingredientes.map(i => i.trim()).filter(i => i.length > 0)
}

export default function ModalIngredientes({ produto, aberto, onFechar }: ModalIngredientesProps) {
  // Bloqueia scroll quando modal está aberto
  useEffect(() => {
    if (aberto) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [aberto])

  if (!aberto || !produto) return null

  const ingredientes = extrairIngredientes(produto.descricao)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn"
      onClick={(e) => {
        if (e.target === e.currentTarget) onFechar()
      }}
    >
      <div className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl overflow-hidden animate-scaleIn">
        {/* Cabeçalho simples com nome e categoria */}
        <div className="px-5 pt-4 pb-3 border-b border-zinc-200 dark:border-zinc-800 bg-gradient-to-r from-amber-500/10 to-orange-500/10 dark:from-amber-500/15 dark:to-orange-500/15 relative">
          <div className="pr-8">
            <span className="text-[11px] font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wider">
              {produto.categoria}
            </span>
            <h3 className="text-lg font-bold text-zinc-900 dark:text-white mt-1">
              {produto.nome}
            </h3>
          </div>

          <button
            onClick={onFechar}
            className="absolute top-3 right-3 p-2 rounded-full bg-zinc-200/70 dark:bg-zinc-700/70 hover:bg-zinc-300 dark:hover:bg-zinc-600 text-zinc-700 dark:text-zinc-100 transition-colors"
            aria-label="Fechar modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Lista de ingredientes */}
        <div className="p-5 max-h-[60vh] overflow-y-auto">
          <h4 className="font-semibold text-zinc-900 dark:text-white mb-3 text-sm">
            Ingredientes
          </h4>

          {ingredientes.length > 0 ? (
            <ul className="space-y-2 list-disc list-inside text-sm text-zinc-700 dark:text-zinc-300">
              {ingredientes.map((ingrediente, indice) => (
                <li key={indice}>{ingrediente}</li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-zinc-500 dark:text-zinc-400 text-center py-4">
              Ingredientes não disponíveis.
            </p>
          )}

          {/* Preço */}
          <div className="mt-5 pt-4 border-t border-zinc-200 dark:border-zinc-700 flex items-center justify-between">
            <span className="text-sm text-zinc-500 dark:text-zinc-400">
              Preço
            </span>
            <div className="flex items-center gap-2">
              {produto.desconto && produto.desconto > 0 && produto.preco_original && (
                <span className="text-sm text-zinc-400 line-through">
                  R$ {produto.preco_original.toFixed(2)}
                </span>
              )}
              <span className="text-xl font-bold text-amber-600 dark:text-amber-500">
                R$ {produto.preco.toFixed(2)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
