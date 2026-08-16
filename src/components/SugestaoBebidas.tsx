'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { X, Plus, Check, GlassWater } from 'lucide-react'
import { Bebida, supabase } from '@/lib/supabase'
import { useCarrinho } from '@/contexts/CarrinhoContext'
import { normalizarNomeCategoria } from '@/lib/categoriasCardapio'

type SugestaoBebidaProps = {
  mostrar: boolean
  onFechar: () => void
  onBebidaAdicionada?: (nomeBebida: string) => void
}

export default function SugestaoBebidas({ mostrar, onFechar, onBebidaAdicionada }: SugestaoBebidaProps) {
  const [bebidas, setBebidas] = useState<Bebida[]>([])
  const [bebidaAdicionada, setBebidaAdicionada] = useState<string | null>(null)
  const { adicionarItem } = useCarrinho()

  useEffect(() => {
    if (mostrar) {
      carregarBebidas()
    }
  }, [mostrar])

  const carregarBebidas = async () => {
    try {
      const { data, error } = await supabase
        .from('bebidas')
        .select('*')
        .eq('disponivel', true)
        .order('ordem', { ascending: true })

      if (error) throw error
      setBebidas(data || [])
    } catch (error) {
      console.error('Erro ao carregar bebidas:', error)
    }
  }

  const adicionarBebida = (bebida: Bebida) => {
    setBebidaAdicionada(bebida.id)
    const categoriaBebida = normalizarNomeCategoria(bebida.categoria)
    
    const produtoBebida = {
      id: bebida.id,
      nome: bebida.nome,
      descricao: bebida.descricao || '',
      preco: bebida.preco,
      categoria: categoriaBebida,
      imagem_url: bebida.imagem_url || '/placeholder-produto.svg',
      disponivel: true,
      ordem: bebida.ordem,
      destaque: false,
      created_at: bebida.created_at,
      updated_at: bebida.updated_at,
    }
    
    adicionarItem(produtoBebida, 1, [], undefined)
    onBebidaAdicionada?.(bebida.nome)
    
    setTimeout(() => {
      setBebidaAdicionada(null)
      onFechar()
    }, 400)
  }

  if (!mostrar) return null

  return (
    <div className="bg-white dark:bg-zinc-900 border border-amber-200 dark:border-amber-800/50 
                    rounded-xl overflow-hidden mb-4 shadow-sm">
      
      {/* Cabeçalho compacto */}
      <div className="flex items-center justify-between px-3 py-2.5 bg-amber-500 dark:bg-amber-600">
        <div className="flex items-center gap-2">
          <GlassWater className="w-5 h-5 text-white" />
          <span className="font-semibold text-white text-sm">
            Adicionar bebida?
          </span>
        </div>
        <button
          onClick={onFechar}
          className="p-1 hover:bg-white/20 rounded-lg transition-colors"
          aria-label="Fechar"
        >
          <X className="w-4 h-4 text-white" />
        </button>
      </div>

      {/* Lista de Bebidas - Layout compacto horizontal */}
      <div className="p-3">
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-amber-200">
          {bebidas.map((bebida) => {
            const foiAdicionada = bebidaAdicionada === bebida.id
            
            return (
              <button
                key={bebida.id}
                onClick={() => adicionarBebida(bebida)}
                disabled={foiAdicionada}
                className={`relative flex-shrink-0 w-24 bg-gray-50 dark:bg-zinc-800 rounded-lg p-2 
                           border transition-all duration-200 text-center
                           ${foiAdicionada 
                             ? 'border-green-400 bg-green-50 dark:bg-green-950/30' 
                             : 'border-gray-100 dark:border-zinc-700 hover:border-amber-400 active:scale-95'
                           }`}
              >
                {foiAdicionada && (
                  <div className="absolute inset-0 flex items-center justify-center bg-green-500/90 rounded-lg z-10">
                    <Check className="w-5 h-5 text-white" />
                  </div>
                )}

                {/* Imagem pequena */}
                <div className="relative w-14 h-14 mx-auto mb-1.5 rounded-md overflow-hidden bg-white dark:bg-zinc-900">
                  {bebida.imagem_url ? (
                    <Image
                      src={bebida.imagem_url}
                      alt={bebida.nome}
                      fill
                      className="object-contain p-1"
                      sizes="56px"
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full">
                      <GlassWater className="w-6 h-6 text-gray-300 dark:text-gray-600" />
                    </div>
                  )}
                </div>

                {/* Nome e preço */}
                <p className="text-[11px] font-medium text-gray-800 dark:text-gray-200 
                              line-clamp-1 leading-tight">
                  {bebida.nome}
                </p>
                {bebida.descricao && (
                  <p className="text-[9px] text-gray-500 dark:text-gray-400">
                    {bebida.descricao}
                  </p>
                )}
                <p className="text-xs font-bold text-amber-600 dark:text-amber-400 mt-0.5">
                  R$ {Number(bebida.preco).toFixed(2).replace('.', ',')}
                </p>

                {/* Botão de adicionar */}
                <div className="absolute -top-1 -right-1 w-5 h-5 bg-amber-500 rounded-full 
                               flex items-center justify-center shadow-sm">
                  <Plus className="w-3 h-3 text-white" />
                </div>
              </button>
            )
          })}
        </div>

        {bebidas.length === 0 && (
          <div className="text-center py-4">
            <p className="text-gray-400 text-sm">Carregando...</p>
          </div>
        )}

        {/* Botão de pular */}
        <button
          onClick={onFechar}
          className="w-full mt-2 py-2 text-xs text-gray-400 hover:text-gray-600 
                     dark:hover:text-gray-300 transition-colors"
        >
          Não, obrigado
        </button>
      </div>
    </div>
  )
}
