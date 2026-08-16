'use client'

import { useState, useEffect } from 'react'
import { X, Check, Minus, Plus, ShoppingBag, ChevronDown, ChevronUp } from 'lucide-react'
import Image from 'next/image'
import { Produto, Adicional, supabase } from '@/lib/supabase'
import { useCarrinho } from '@/contexts/CarrinhoContext'

type ModalComplementosProps = {
  produto: Produto | null
  aberto: boolean
  onFechar: () => void
  onItemAdicionado: (nomeItem: string) => void
}

// Extrai ingredientes da descrição do produto
const extrairIngredientes = (descricao: string | null | undefined): string[] => {
  if (!descricao) return []

  let ingredientes: string[] = []

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

// Agrupa adicionais por categoria
const agruparPorCategoria = (adicionais: Adicional[]): Record<string, Adicional[]> => {
  return adicionais.reduce((grupos, adicional) => {
    const categoria = adicional.categoria || 'Extras'
    if (!grupos[categoria]) {
      grupos[categoria] = []
    }
    grupos[categoria].push(adicional)
    return grupos
  }, {} as Record<string, Adicional[]>)
}

export default function ModalComplementos({ produto, aberto, onFechar, onItemAdicionado }: ModalComplementosProps) {
  const { adicionarItem } = useCarrinho()
  const [adicionais, setAdicionais] = useState<Adicional[]>([])
  const [adicionaisSelecionados, setAdicionaisSelecionados] = useState<Adicional[]>([])
  const [quantidade, setQuantidade] = useState(1)
  const [observacoes, setObservacoes] = useState('')
  const [carregando, setCarregando] = useState(false)
  const [ingredientesExpandidos, setIngredientesExpandidos] = useState(false)

  useEffect(() => {
    if (aberto) {
      const scrollY = window.scrollY
      document.body.style.overflow = 'hidden'
      document.body.style.position = 'fixed'
      document.body.style.top = `-${scrollY}px`
      document.body.style.left = '0'
      document.body.style.right = '0'
      document.documentElement.style.overflow = 'hidden'
    } else {
      const scrollY = document.body.style.top
      document.body.style.overflow = ''
      document.body.style.position = ''
      document.body.style.top = ''
      document.body.style.left = ''
      document.body.style.right = ''
      document.documentElement.style.overflow = ''
      if (scrollY) {
        window.scrollTo(0, parseInt(scrollY || '0') * -1)
      }
    }

    return () => {
      document.body.style.overflow = ''
      document.body.style.position = ''
      document.body.style.top = ''
      document.body.style.left = ''
      document.body.style.right = ''
      document.documentElement.style.overflow = ''
    }
  }, [aberto])

  useEffect(() => {
    if (aberto && produto) {
      carregarAdicionais()
      setQuantidade(1)
      setObservacoes('')
      setAdicionaisSelecionados([])
      setIngredientesExpandidos(false)
    }
  }, [aberto, produto])

  const carregarAdicionais = async () => {
    if (!produto) return
    setCarregando(true)
    try {
      // Busca adicionais disponíveis e vínculos do produto
      const [{ data: todosAdicionais, error: erroAdicionais }, { data: vinculos, error: erroVinculos }] = await Promise.all([
        supabase
          .from('adicionais')
          .select('*')
          .eq('disponivel', true)
          .order('categoria', { ascending: true })
          .order('nome', { ascending: true }),
        supabase
          .from('produto_adicionais')
          .select('adicional_id')
          .eq('produto_id', produto.id)
      ])

      if (erroAdicionais) throw erroAdicionais

      const listaAdicionais = todosAdicionais || []

      if (!erroVinculos && vinculos && vinculos.length > 0) {
        // Produto tem vínculos específicos: mostrar apenas os vinculados
        const idsVinculados = new Set(vinculos.map(v => v.adicional_id))
        setAdicionais(listaAdicionais.filter(a => idsVinculados.has(a.id)))
      } else {
        // Verificar se existem adicionais com vínculos específicos
        // Adicionais sem nenhum vínculo = disponíveis para todos
        const { data: todosVinculos } = await supabase
          .from('produto_adicionais')
          .select('adicional_id')

        if (todosVinculos && todosVinculos.length > 0) {
          const idsComVinculo = new Set(todosVinculos.map(v => v.adicional_id))
          // Mostrar apenas adicionais que NÃO têm vínculos (disponíveis para todos)
          setAdicionais(listaAdicionais.filter(a => !idsComVinculo.has(a.id)))
        } else {
          // Nenhum vínculo existe: todos os adicionais para todos os produtos
          setAdicionais(listaAdicionais)
        }
      }
    } catch (error) {
      console.error('Erro ao carregar adicionais:', error)
      setAdicionais([])
    } finally {
      setCarregando(false)
    }
  }

  const toggleAdicional = (adicional: Adicional) => {
    setAdicionaisSelecionados((prev) => {
      const existe = prev.find((a) => a.id === adicional.id)
      if (existe) {
        return prev.filter((a) => a.id !== adicional.id)
      }
      return [...prev, adicional]
    })
  }

  const calcularTotal = () => {
    if (!produto) return 0
    const subtotalAdicionais = adicionaisSelecionados.reduce((acc, ad) => acc + ad.preco, 0)
    return (produto.preco + subtotalAdicionais) * quantidade
  }

  const confirmar = () => {
    if (!produto) return
    adicionarItem(produto, quantidade, adicionaisSelecionados, observacoes)
    onFechar()
    onItemAdicionado(produto.nome)
  }

  if (!aberto || !produto) return null

  const ingredientes = extrairIngredientes(produto.descricao)
  const adicionaisAgrupados = agruparPorCategoria(adicionais)
  const categoriasAdicionais = Object.keys(adicionaisAgrupados)
  const temImagem = produto.imagem_url && produto.imagem_url.trim() !== ''

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
      style={{ animation: 'fadeIn 0.2s ease-out' }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onFechar()
      }}
    >
      {/* Container tela cheia no mobile, modal grande no desktop */}
      <div
        className="fixed inset-0 sm:inset-4 md:inset-y-6 md:inset-x-auto md:max-w-2xl md:mx-auto 
                   bg-white dark:bg-zinc-900 sm:rounded-2xl overflow-hidden flex flex-col
                   shadow-2xl"
        style={{ animation: 'slideUp 0.25s ease-out' }}
      >
        {/* Header fixo com imagem e info do produto */}
        <div className="flex-shrink-0">
          {/* Barra superior com botão fechar */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-100 dark:border-zinc-800">
            <button
              onClick={onFechar}
              className="p-2 -ml-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              aria-label="Fechar"
            >
              <X className="w-5 h-5 text-zinc-500 dark:text-zinc-400" />
            </button>
            <h2 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">
              Personalizar pedido
            </h2>
            <div className="w-9" />
          </div>

          {/* Info do produto */}
          <div className="flex gap-3 px-4 py-3 bg-zinc-50 dark:bg-zinc-800/50">
            {temImagem && (
              <div className="relative w-16 h-16 flex-shrink-0 rounded-xl overflow-hidden bg-zinc-200 dark:bg-zinc-700">
                <Image
                  src={produto.imagem_url}
                  alt={produto.nome}
                  fill
                  className="object-cover"
                  sizes="64px"
                />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <span className="text-[10px] font-semibold text-bordo-600 dark:text-bordo-400 uppercase tracking-wider">
                {produto.categoria}
              </span>
              <h3 className="text-base font-bold text-zinc-900 dark:text-white leading-tight truncate">
                {produto.nome}
              </h3>
              <span className="text-sm font-bold text-bordo-600 dark:text-bordo-400">
                R$ {produto.preco.toFixed(2)}
              </span>
            </div>
          </div>

          {/* Ingredientes colapsáveis */}
          {ingredientes.length > 0 && (
            <div className="border-b border-zinc-100 dark:border-zinc-800">
              <button
                onClick={() => setIngredientesExpandidos(!ingredientesExpandidos)}
                className="w-full flex items-center justify-between px-4 py-2.5 
                         hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors"
              >
                <span className="text-xs font-semibold text-zinc-600 dark:text-zinc-400 uppercase tracking-wide">
                  Ingredientes ({ingredientes.length})
                </span>
                {ingredientesExpandidos ? (
                  <ChevronUp className="w-4 h-4 text-zinc-400" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-zinc-400" />
                )}
              </button>
              {ingredientesExpandidos && (
                <div className="px-4 pb-3">
                  <div className="flex flex-wrap gap-1.5">
                    {ingredientes.map((ingrediente, indice) => (
                      <span
                        key={indice}
                        className="inline-block text-xs bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 
                                 px-2.5 py-1 rounded-full"
                      >
                        {ingrediente}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Conteúdo scrollável - Adicionais + Observações */}
        <div className="flex-1 overflow-y-auto overscroll-contain">
          {carregando ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-8 h-8 border-3 border-bordo-200 border-t-bordo-600 rounded-full animate-spin" />
            </div>
          ) : adicionais.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Nenhum adicional disponível
              </p>
            </div>
          ) : (
            <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {categoriasAdicionais.map((categoria) => (
                <div key={categoria}>
                  {/* Título da categoria */}
                  <div className="px-4 py-2 bg-zinc-50 dark:bg-zinc-800/40 sticky top-0 z-10">
                    <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                      {categoria}
                    </span>
                  </div>

                  {/* Lista de adicionais */}
                  {adicionaisAgrupados[categoria].map((adicional) => {
                    const selecionado = adicionaisSelecionados.some((a) => a.id === adicional.id)

                    return (
                      <button
                        key={adicional.id}
                        onClick={() => toggleAdicional(adicional)}
                        className={`w-full flex items-center gap-3 px-4 py-3 transition-colors text-left
                          ${selecionado
                            ? 'bg-bordo-50 dark:bg-bordo-950/20'
                            : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/30'
                          }`}
                        aria-pressed={selecionado}
                        role="checkbox"
                        aria-checked={selecionado}
                      >
                        {/* Indicador de seleção */}
                        <div
                          className={`w-5 h-5 rounded flex-shrink-0 flex items-center justify-center border-2 transition-all duration-200
                            ${selecionado
                              ? 'bg-bordo-600 border-bordo-600'
                              : 'border-zinc-300 dark:border-zinc-600'
                            }`}
                        >
                          {selecionado && (
                            <Check className="w-3 h-3 text-white" />
                          )}
                        </div>

                        {/* Nome */}
                        <span className={`flex-1 text-sm font-medium transition-colors
                          ${selecionado
                            ? 'text-bordo-700 dark:text-bordo-300'
                            : 'text-zinc-800 dark:text-zinc-200'
                          }`}>
                          {adicional.nome}
                        </span>

                        {/* Preço */}
                        <span className={`text-sm font-bold flex-shrink-0 transition-colors
                          ${selecionado
                            ? 'text-bordo-600 dark:text-bordo-400'
                            : 'text-zinc-500 dark:text-zinc-400'
                          }`}>
                          +R$ {adicional.preco.toFixed(2)}
                        </span>
                      </button>
                    )
                  })}
                </div>
              ))}
            </div>
          )}

          {/* Observações */}
          <div className="px-4 py-4 border-t border-zinc-100 dark:border-zinc-800">
            <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide mb-2">
              Observações
            </label>
            <textarea
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              placeholder="Ex: Sem cebola, molho à parte..."
              rows={2}
              className="w-full px-3 py-2.5 text-sm bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 
                       rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-bordo-500 focus:border-transparent
                       text-zinc-900 dark:text-white placeholder:text-zinc-400"
            />
          </div>
        </div>

        {/* Footer fixo - Quantidade + Total + Botão */}
        <div className="flex-shrink-0 border-t border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-4 py-3 space-y-3">
          {/* Quantidade */}
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
              Quantidade
            </span>
            <div className="flex items-center gap-1 bg-zinc-100 dark:bg-zinc-800 rounded-lg">
              <button
                onClick={() => setQuantidade(Math.max(1, quantidade - 1))}
                className="w-9 h-9 flex items-center justify-center rounded-l-lg 
                         hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
                aria-label="Diminuir quantidade"
              >
                <Minus className="w-4 h-4 text-zinc-600 dark:text-zinc-400" />
              </button>
              <span className="w-8 text-center text-sm font-bold text-zinc-900 dark:text-white">
                {quantidade}
              </span>
              <button
                onClick={() => setQuantidade(quantidade + 1)}
                className="w-9 h-9 flex items-center justify-center rounded-r-lg 
                         hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
                aria-label="Aumentar quantidade"
              >
                <Plus className="w-4 h-4 text-zinc-600 dark:text-zinc-400" />
              </button>
            </div>
          </div>

          {/* Resumo de adicionais selecionados */}
          {adicionaisSelecionados.length > 0 && (
            <p className="text-xs text-zinc-500 dark:text-zinc-400 text-center">
              {adicionaisSelecionados.length} {adicionaisSelecionados.length === 1 ? 'adicional selecionado' : 'adicionais selecionados'}
            </p>
          )}

          {/* Botão de confirmar */}
          <button
            onClick={confirmar}
            className="w-full flex items-center justify-between py-3.5 px-5 rounded-xl
                     bg-bordo-600 hover:bg-bordo-700 active:bg-bordo-800
                     text-white font-bold transition-colors shadow-lg shadow-bordo-600/20"
          >
            <div className="flex items-center gap-2">
              <ShoppingBag className="w-5 h-5" />
              <span>Adicionar ao pedido</span>
            </div>
            <span className="text-base font-extrabold">
              R$ {calcularTotal().toFixed(2)}
            </span>
          </button>
        </div>
      </div>
    </div>
  )
}

