'use client'

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { Produto, Adicional, ItemCarrinho } from '@/lib/supabase'
import {
  avaliarCompraProduto,
  somarQuantidadeProdutoNoCarrinho,
} from '@/lib/estoque-produto.mjs'

type CarrinhoContextType = {
  itens: ItemCarrinho[]
  adicionarItem: (produto: Produto, quantidade: number, adicionais: Adicional[], observacoes?: string) => boolean
  removerItem: (id: string) => void
  atualizarQuantidade: (id: string, quantidade: number) => boolean
  limparCarrinho: () => void
  total: number
  quantidadeTotal: number
}

const CarrinhoContext = createContext<CarrinhoContextType | undefined>(undefined)
const IMAGEM_PADRAO_PRODUTO = '/placeholder-produto.svg'

function normalizarUrlImagem(urlImagem: unknown): string {
  if (typeof urlImagem !== 'string') return IMAGEM_PADRAO_PRODUTO
  const urlTratada = urlImagem.trim()
  return urlTratada.length > 0 ? urlTratada : IMAGEM_PADRAO_PRODUTO
}

function normalizarProduto(produto: Produto): Produto {
  return {
    ...produto,
    imagem_url: normalizarUrlImagem(produto.imagem_url),
  }
}

function normalizarItemCarrinho(item: ItemCarrinho): ItemCarrinho {
  const produtoNormalizado = normalizarProduto(item.produto)
  const adicionais = Array.isArray(item.adicionais) ? item.adicionais : []
  const quantidade = Number.isFinite(item.quantidade) && item.quantidade > 0 ? item.quantidade : 1
  const subtotalAdicionais = adicionais.reduce((acc, ad) => acc + ad.preco, 0)
  const subtotalCalculado = (produtoNormalizado.preco + subtotalAdicionais) * quantidade

  return {
    ...item,
    produto: produtoNormalizado,
    adicionais,
    quantidade,
    subtotal: subtotalCalculado,
  }
}

export function CarrinhoProvider({ children }: { children: ReactNode }) {
  const [itens, setItens] = useState<ItemCarrinho[]>([])
  const [persistenciaCarregada, setPersistenciaCarregada] = useState(false)

  useEffect(() => {
    const carrinhoSalvo = localStorage.getItem('bar-da-ladeira-carrinho')
    if (carrinhoSalvo) {
      try {
        const itensSalvos = JSON.parse(carrinhoSalvo)
        if (Array.isArray(itensSalvos)) {
          setItens(itensSalvos.map((item) => normalizarItemCarrinho(item as ItemCarrinho)))
        } else {
          setItens([])
        }
      } catch (error) {
        console.error('Erro ao carregar carrinho:', error)
        setItens([])
      }
    }
    setPersistenciaCarregada(true)
  }, [])

  useEffect(() => {
    if (!persistenciaCarregada) return
    localStorage.setItem('bar-da-ladeira-carrinho', JSON.stringify(itens))
  }, [itens, persistenciaCarregada])

  const adicionarItem = (
    produto: Produto,
    quantidade: number,
    adicionais: Adicional[],
    observacoes?: string
  ) => {
    const jaNoCarrinho = somarQuantidadeProdutoNoCarrinho(itens, produto.id)
    const avaliacao = avaliarCompraProduto(produto, jaNoCarrinho, quantidade)
    if (!avaliacao.permitido) return false

    const produtoNormalizado = normalizarProduto(produto)
    const subtotalAdicionais = adicionais.reduce((acc, ad) => acc + ad.preco, 0)
    const subtotal = (produtoNormalizado.preco + subtotalAdicionais) * quantidade

    const novoItem: ItemCarrinho = {
      id: `${produtoNormalizado.id}-${Date.now()}`,
      produto: produtoNormalizado,
      quantidade,
      adicionais,
      observacoes,
      subtotal,
    }

    setItens((prev) => [...prev, novoItem])
    return true
  }

  const removerItem = (id: string) => {
    setItens((prev) => prev.filter((item) => item.id !== id))
  }

  const atualizarQuantidade = (id: string, quantidade: number) => {
    if (quantidade <= 0) {
      removerItem(id)
      return true
    }

    const atual = itens.find((item) => item.id === id)
    if (!atual) return false
    const jaNosOutros = somarQuantidadeProdutoNoCarrinho(
      itens.filter((item) => item.id !== id),
      atual.produto.id,
    )
    const avaliacao = avaliarCompraProduto(atual.produto, jaNosOutros, quantidade)
    if (!avaliacao.permitido) return false

    setItens((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          const subtotalAdicionais = item.adicionais.reduce((acc, ad) => acc + ad.preco, 0)
          const subtotal = (item.produto.preco + subtotalAdicionais) * quantidade
          return { ...item, quantidade, subtotal }
        }
        return item
      })
    )
    return true
  }

  const limparCarrinho = () => {
    setItens([])
  }

  const total = itens.reduce((acc, item) => acc + item.subtotal, 0)
  const quantidadeTotal = itens.reduce((acc, item) => acc + item.quantidade, 0)

  return (
    <CarrinhoContext.Provider
      value={{
        itens,
        adicionarItem,
        removerItem,
        atualizarQuantidade,
        limparCarrinho,
        total,
        quantidadeTotal,
      }}
    >
      {children}
    </CarrinhoContext.Provider>
  )
}

export function useCarrinho() {
  const context = useContext(CarrinhoContext)
  if (context === undefined) {
    throw new Error('useCarrinho deve ser usado dentro de um CarrinhoProvider')
  }
  return context
}
