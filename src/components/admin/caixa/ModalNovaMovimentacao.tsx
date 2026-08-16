'use client'

import { useState, useEffect } from 'react'
import { ModalSheet } from '@/components/ui/modal-sheet'
import { Plus, Minus, Check, PlusCircle, X } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import type { Funcionario, CategoriaCaixa } from '@/lib/tipos-caixa'

type Props = {
  aberto: boolean
  tipo: 'entrada' | 'saida'
  funcionarios: Funcionario[]
  categorias: CategoriaCaixa[]
  onFechar: () => void
  onConfirmar: (
    tipo: 'entrada' | 'saida',
    valor: number,
    categoriaId: string,
    funcionarioId?: string,
    descricao?: string,
    formaPagamento?: string
  ) => Promise<boolean>
  onCategoriasCriadas?: () => void
}

export default function ModalNovaMovimentacao({ 
  aberto, tipo, funcionarios, categorias, onFechar, onConfirmar, onCategoriasCriadas 
}: Props) {
  const [valor, setValor] = useState('')
  const [categoriaId, setCategoriaId] = useState('')
  const [funcionarioId, setFuncionarioId] = useState('')
  const [descricao, setDescricao] = useState('')
  const [formaPagamento, setFormaPagamento] = useState('')
  const [processando, setProcessando] = useState(false)
  
  // Estados para criar nova categoria
  const [mostrarNovaCategoria, setMostrarNovaCategoria] = useState(false)
  const [novaCategoriaNome, setNovaCategoriaNome] = useState('')
  const [novaCategoriaIcone, setNovaCategoriaIcone] = useState('circle')
  const [novaCategoriaCor, setNovaCategoriaCor] = useState('#6b7280')
  const [criandoCategoria, setCriandoCategoria] = useState(false)
  const [categoriasLocais, setCategoriasLocais] = useState<CategoriaCaixa[]>([])

  // Sincronizar categorias locais com props
  useEffect(() => {
    setCategoriasLocais(categorias)
  }, [categorias])

  // Filtrar categorias pelo tipo
  const categoriasFiltradas = categoriasLocais.filter(c => c.tipo === tipo)

  // Resetar categoria quando trocar o tipo
  useEffect(() => {
    setCategoriaId('')
  }, [tipo])

  // Criar nova categoria
  const criarNovaCategoria = async () => {
    if (!novaCategoriaNome.trim()) return

    setCriandoCategoria(true)
    try {
      const { data, error } = await supabase
        .from('categorias_caixa')
        .insert({
          nome: novaCategoriaNome.trim(),
          tipo: tipo,
          icone: novaCategoriaIcone,
          cor: novaCategoriaCor,
          ativo: true,
          ordem: 50
        })
        .select()
        .single()

      if (error) throw error

      // Adicionar categoria localmente
      setCategoriasLocais(prev => [...prev, data])
      setCategoriaId(data.id)
      setMostrarNovaCategoria(false)
      setNovaCategoriaNome('')
      setNovaCategoriaIcone('circle')
      setNovaCategoriaCor('#6b7280')
      
      // Notificar componente pai
      onCategoriasCriadas?.()
    } catch (erro) {
      console.error('Erro ao criar categoria:', erro)
      toast.error('Erro ao criar categoria')
    } finally {
      setCriandoCategoria(false)
    }
  }

  const handleConfirmar = async () => {
    if (!valor || !categoriaId) return
    
    setProcessando(true)
    const sucesso = await onConfirmar(
      tipo,
      parseFloat(valor),
      categoriaId,
      funcionarioId || undefined,
      descricao || undefined,
      formaPagamento || undefined
    )
    setProcessando(false)
    
    if (sucesso) {
      limparFormulario()
      onFechar()
    }
  }

  const limparFormulario = () => {
    setValor('')
    setCategoriaId('')
    setFuncionarioId('')
    setDescricao('')
    setFormaPagamento('')
  }

  const handleFechar = () => {
    if (!processando) {
      limparFormulario()
      onFechar()
    }
  }

  const corTema = tipo === 'entrada' ? 'green' : 'red'

  return (
    <ModalSheet
      open={aberto}
      onOpenChange={(open) => {
        if (!open) handleFechar()
      }}
      title={tipo === 'entrada' ? 'Nova entrada' : 'Nova saída'}
      showCloseButton={false}
      className="sm:max-w-md"
    >
          <div className="flex max-h-[90dvh] w-full flex-col overflow-hidden">
            <div className={`border-b border-zinc-200 p-6 dark:border-zinc-800 ${
              tipo === 'entrada' 
                ? 'bg-green-50 dark:bg-green-950/20' 
                : 'bg-red-50 dark:bg-red-950/20'
            }`}>
              <div className="flex items-center gap-3">
                <div className={`rounded-xl p-2 ${
                  tipo === 'entrada'
                    ? 'bg-green-100 dark:bg-green-900/30'
                    : 'bg-red-100 dark:bg-red-900/30'
                }`}>
                  {tipo === 'entrada' ? (
                    <Plus className="w-6 h-6 text-green-600 dark:text-green-400" />
                  ) : (
                    <Minus className="w-6 h-6 text-red-600 dark:text-red-400" />
                  )}
                </div>
                <div>
                  <h2 className="text-xl font-bold text-zinc-900 dark:text-white">
                    Nova {tipo === 'entrada' ? 'Entrada' : 'Saída'}
                  </h2>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">
                    Registre a movimentação do caixa
                  </p>
                </div>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                  Valor (R$) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={valor}
                  onChange={(e) => setValor(e.target.value)}
                  placeholder="0,00"
                  disabled={processando}
                  className={`w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 
                           dark:border-zinc-700 rounded-xl text-zinc-900 dark:text-white text-lg
                           focus:ring-2 focus:ring-${corTema}-500 focus:border-transparent
                           disabled:opacity-50 disabled:cursor-not-allowed`}
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    Categoria *
                  </label>
                  <button
                    type="button"
                    onClick={() => setMostrarNovaCategoria(!mostrarNovaCategoria)}
                    className={`text-xs flex items-center gap-1 px-2 py-1 rounded-lg transition-colors ${
                      mostrarNovaCategoria 
                        ? 'bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300'
                        : 'text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/20'
                    }`}
                  >
                    {mostrarNovaCategoria ? (
                      <>
                        <X className="w-3 h-3" />
                        Cancelar
                      </>
                    ) : (
                      <>
                        <PlusCircle className="w-3 h-3" />
                        Nova Categoria
                      </>
                    )}
                  </button>
                </div>

                {/* Formulário de nova categoria */}
                {mostrarNovaCategoria && (
                  <div className="mb-3 p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-xl space-y-3">
                    <input
                      type="text"
                      value={novaCategoriaNome}
                      onChange={(e) => setNovaCategoriaNome(e.target.value)}
                      placeholder="Nome da categoria"
                      className="w-full px-3 py-2 bg-white dark:bg-zinc-800 border border-zinc-200 
                               dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-white text-sm"
                    />
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <label className="block text-xs text-zinc-600 dark:text-zinc-400 mb-1">Cor</label>
                        <input
                          type="color"
                          value={novaCategoriaCor}
                          onChange={(e) => setNovaCategoriaCor(e.target.value)}
                          className="w-full h-9 rounded-lg cursor-pointer"
                        />
                      </div>
                      <div className="flex-1">
                        <label className="block text-xs text-zinc-600 dark:text-zinc-400 mb-1">Ícone</label>
                        <select
                          value={novaCategoriaIcone}
                          onChange={(e) => setNovaCategoriaIcone(e.target.value)}
                          className="w-full px-2 py-2 bg-white dark:bg-zinc-800 border border-zinc-200 
                                   dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-white text-sm"
                        >
                          <option value="circle">● Círculo</option>
                          <option value="dollar-sign">$ Dinheiro</option>
                          <option value="shopping-cart">🛒 Compras</option>
                          <option value="user">👤 Pessoa</option>
                          <option value="wrench">🔧 Ferramenta</option>
                          <option value="fuel">⛽ Combustível</option>
                          <option value="trending-up">📈 Investimento</option>
                          <option value="megaphone">📢 Marketing</option>
                          <option value="wallet">💳 Carteira</option>
                        </select>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={criarNovaCategoria}
                      disabled={!novaCategoriaNome.trim() || criandoCategoria}
                      className="w-full py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg 
                               text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {criandoCategoria ? (
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : (
                        <>
                          <Check className="w-4 h-4" />
                          Criar Categoria
                        </>
                      )}
                    </button>
                  </div>
                )}

                <select
                  value={categoriaId}
                  onChange={(e) => setCategoriaId(e.target.value)}
                  disabled={processando}
                  className={`w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 
                           dark:border-zinc-700 rounded-xl text-zinc-900 dark:text-white
                           focus:ring-2 focus:ring-${corTema}-500 focus:border-transparent
                           disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  <option value="">Selecione a categoria</option>
                  {categoriasFiltradas.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.nome}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                  Funcionário (opcional)
                </label>
                <select
                  value={funcionarioId}
                  onChange={(e) => setFuncionarioId(e.target.value)}
                  disabled={processando}
                  className={`w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 
                           dark:border-zinc-700 rounded-xl text-zinc-900 dark:text-white
                           focus:ring-2 focus:ring-${corTema}-500 focus:border-transparent
                           disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  <option value="">Selecione o funcionário</option>
                  {funcionarios.map((func) => (
                    <option key={func.id} value={func.id}>
                      {func.nome} - {func.cargo}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                  Forma de Pagamento (opcional)
                </label>
                <select
                  value={formaPagamento}
                  onChange={(e) => setFormaPagamento(e.target.value)}
                  disabled={processando}
                  className={`w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 
                           dark:border-zinc-700 rounded-xl text-zinc-900 dark:text-white
                           focus:ring-2 focus:ring-${corTema}-500 focus:border-transparent
                           disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  <option value="">Selecione</option>
                  <option value="Dinheiro">Dinheiro</option>
                  <option value="PIX">PIX</option>
                  <option value="Cartão Débito">Cartão Débito</option>
                  <option value="Cartão Crédito">Cartão Crédito</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                  Descrição (opcional)
                </label>
                <textarea
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                  placeholder="Detalhes da movimentação..."
                  rows={3}
                  disabled={processando}
                  className={`w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 
                           dark:border-zinc-700 rounded-xl text-zinc-900 dark:text-white resize-none
                           focus:ring-2 focus:ring-${corTema}-500 focus:border-transparent
                           disabled:opacity-50 disabled:cursor-not-allowed`}
                />
              </div>
            </div>

            <div className="p-6 border-t border-zinc-200 dark:border-zinc-800 flex gap-3">
              <button
                onClick={handleFechar}
                disabled={processando}
                className="flex-1 px-4 py-3 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 
                         dark:text-zinc-300 rounded-xl font-medium hover:bg-zinc-200 
                         dark:hover:bg-zinc-700 transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmar}
                disabled={!valor || !categoriaId || processando}
                className={`flex-1 px-4 py-3 ${
                  tipo === 'entrada' 
                    ? 'bg-green-600 hover:bg-green-700' 
                    : 'bg-red-600 hover:bg-red-700'
                } text-white rounded-xl font-medium transition-colors flex items-center 
                justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {processando ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <Check className="w-5 h-5" />
                    Registrar
                  </>
                )}
              </button>
            </div>
          </div>
    </ModalSheet>
  )
}
