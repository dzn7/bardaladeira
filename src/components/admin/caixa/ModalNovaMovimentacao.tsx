'use client'

import { useState, useEffect } from 'react'
import { Plus, X } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import {
  AreaTexto,
  Botao,
  Campo,
  Chip,
  Entrada,
  EntradaPreco,
  Gaveta,
  Selecao,
  lerPreco,
} from '@/components/admin/ui'
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

const FORMAS = ['Dinheiro', 'PIX', 'Cartão Débito', 'Cartão Crédito']

const ICONES = [
  { valor: 'circle', rotulo: 'Círculo' },
  { valor: 'dollar-sign', rotulo: 'Dinheiro' },
  { valor: 'shopping-cart', rotulo: 'Compras' },
  { valor: 'user', rotulo: 'Pessoa' },
  { valor: 'wrench', rotulo: 'Ferramenta' },
  { valor: 'fuel', rotulo: 'Combustível' },
  { valor: 'trending-up', rotulo: 'Investimento' },
  { valor: 'megaphone', rotulo: 'Marketing' },
  { valor: 'wallet', rotulo: 'Carteira' },
]

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

  const valorNumero = lerPreco(valor)

  const handleConfirmar = async () => {
    if (!valorNumero || !categoriaId) return

    setProcessando(true)
    const sucesso = await onConfirmar(
      tipo,
      valorNumero,
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

  const ehEntrada = tipo === 'entrada'

  return (
    <Gaveta
      aberto={aberto}
      aoFechar={handleFechar}
      bloqueada={processando}
      titulo={ehEntrada ? 'Nova entrada' : 'Nova saída'}
      descricao={ehEntrada ? 'Dinheiro que entrou no caixa.' : 'Dinheiro que saiu do caixa.'}
      rodape={
        <>
          <Botao variante="contorno" onClick={handleFechar} disabled={processando}>
            Cancelar
          </Botao>
          <Botao
            variante={ehEntrada ? 'primario' : 'perigo'}
            carregando={processando}
            disabled={!valorNumero || !categoriaId}
            onClick={() => void handleConfirmar()}
          >
            {ehEntrada ? 'Registrar entrada' : 'Registrar saída'}
          </Botao>
        </>
      }
    >
      <form
        className="space-y-5"
        onSubmit={(evento) => {
          evento.preventDefault()
          void handleConfirmar()
        }}
      >
        <Campo rotulo="Valor" htmlFor="mov-valor">
          <EntradaPreco id="mov-valor" valor={valor} aoMudar={setValor} disabled={processando} />
        </Campo>

        <div className="space-y-2">
          <Campo rotulo="Categoria" htmlFor="mov-categoria">
            <Selecao
              id="mov-categoria"
              value={categoriaId}
              onChange={(e) => setCategoriaId(e.target.value)}
              disabled={processando}
            >
              <option value="">Escolha a categoria</option>
              {categoriasFiltradas.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.nome}
                </option>
              ))}
            </Selecao>
          </Campo>

          {mostrarNovaCategoria ? (
            <div className="space-y-3 rounded-xl border border-border/70 bg-muted/30 p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-foreground">Nova categoria</p>
                <Botao
                  variante="fantasma"
                  tamanho="iconeSm"
                  aria-label="Cancelar nova categoria"
                  onClick={() => setMostrarNovaCategoria(false)}
                >
                  <X />
                </Botao>
              </div>
              <Entrada
                value={novaCategoriaNome}
                onChange={(e) => setNovaCategoriaNome(e.target.value)}
                placeholder="Nome da categoria"
                aria-label="Nome da nova categoria"
              />
              <div className="grid grid-cols-[auto_1fr] gap-3">
                <Campo rotulo="Cor" htmlFor="mov-cat-cor">
                  <input
                    id="mov-cat-cor"
                    type="color"
                    value={novaCategoriaCor}
                    onChange={(e) => setNovaCategoriaCor(e.target.value)}
                    className="h-11 w-14 cursor-pointer rounded-lg border border-border/70 bg-card p-1 md:h-10"
                  />
                </Campo>
                <Campo rotulo="Ícone" htmlFor="mov-cat-icone">
                  <Selecao
                    id="mov-cat-icone"
                    value={novaCategoriaIcone}
                    onChange={(e) => setNovaCategoriaIcone(e.target.value)}
                  >
                    {ICONES.map((icone) => (
                      <option key={icone.valor} value={icone.valor}>
                        {icone.rotulo}
                      </option>
                    ))}
                  </Selecao>
                </Campo>
              </div>
              <Botao
                className="w-full"
                carregando={criandoCategoria}
                disabled={!novaCategoriaNome.trim()}
                onClick={() => void criarNovaCategoria()}
              >
                Criar categoria
              </Botao>
            </div>
          ) : (
            <Botao variante="fantasma" tamanho="sm" className="-ml-2 text-primary" onClick={() => setMostrarNovaCategoria(true)}>
              <Plus />
              Nova categoria
            </Botao>
          )}
        </div>

        <Campo rotulo="Forma de pagamento" opcional>
          <div role="group" aria-label="Forma de pagamento" className="flex flex-wrap gap-2">
            {FORMAS.map((forma) => (
              <Chip
                key={forma}
                ativo={formaPagamento === forma}
                className="h-10 normal-case"
                disabled={processando}
                onClick={() => setFormaPagamento(formaPagamento === forma ? '' : forma)}
              >
                {forma}
              </Chip>
            ))}
          </div>
        </Campo>

        <Campo rotulo="Funcionário" htmlFor="mov-funcionario" opcional>
          <Selecao
            id="mov-funcionario"
            value={funcionarioId}
            onChange={(e) => setFuncionarioId(e.target.value)}
            disabled={processando}
          >
            <option value="">Nenhum</option>
            {funcionarios.map((func) => (
              <option key={func.id} value={func.id}>
                {func.nome} - {func.cargo}
              </option>
            ))}
          </Selecao>
        </Campo>

        <Campo rotulo="Descrição" htmlFor="mov-descricao" opcional>
          <AreaTexto
            id="mov-descricao"
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            placeholder="Detalhes da movimentação"
            rows={3}
            disabled={processando}
          />
        </Campo>
        <button type="submit" className="hidden" aria-hidden tabIndex={-1} />
      </form>
    </Gaveta>
  )
}
