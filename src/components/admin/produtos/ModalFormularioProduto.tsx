'use client'

import { useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import { Camera, CaretDown, Crop, CircleNotch as Loader2, Plus, Trash as Trash2, X } from '@phosphor-icons/react'
import {
  AreaTexto,
  Botao,
  Campo,
  Entrada,
  EntradaPreco,
  Gaveta,
  LinhaInterruptor,
  Selecao,
} from '@/components/admin/ui'
import {
  ESTOQUE_MINIMO_PADRAO,
  ESTOQUE_QUANTIDADE_PADRAO,
  normalizarConfiguracaoEstoque,
  normalizarDinheiro,
} from '@/lib/estoque-produto.mjs'

export type ProdutoFormulario = {
  id: string
  nome: string
  descricao?: string
  preco: number
  preco_original?: number | null
  desconto?: number | null
  categoria: string
  imagem_url?: string
  disponivel: boolean
  tabela?: string
  custo_unitario?: number | null
  estoque_quantidade?: number
  estoque_minimo?: number
  bloquear_venda_sem_estoque?: boolean
}

export type DadosSalvarProduto = {
  nome: string
  descricao: string
  preco: string
  desconto: string
  categoria: string
  disponivel: boolean
  custoUnitario: string
  quantidadeEstoque: string
  estoqueMinimo: string
  bloquearVendaSemEstoque: boolean
}

type ModalFormularioProdutoProps = {
  aberto: boolean
  modo: 'criar' | 'editar'
  produto?: ProdutoFormulario | null
  categorias: string[]
  categoriasBebidas: string[]
  categoriaBebidasFallback?: string
  salvando?: boolean
  enviandoImagem?: boolean
  onFechar: () => void
  onSalvar: (dados: DadosSalvarProduto) => void | Promise<void>
  onCriarCategoria?: (nome: string) => Promise<string | null>
  onSelecionarFoto?: () => void
  onRecortarFoto?: () => void
  onRemoverFoto?: () => void
  onExcluir?: () => void
  previewImagemCriacao?: string | null
  onSelecionarFotoCriacao?: () => void
}

export const ModalFormularioProduto = ({
  aberto,
  modo,
  produto,
  categorias,
  categoriasBebidas,
  categoriaBebidasFallback = '',
  salvando = false,
  enviandoImagem = false,
  onFechar,
  onSalvar,
  onCriarCategoria,
  onSelecionarFoto,
  onRecortarFoto,
  onRemoverFoto,
  onExcluir,
  previewImagemCriacao,
  onSelecionarFotoCriacao,
}: ModalFormularioProdutoProps) => {
  const [nome, setNome] = useState('')
  const [descricao, setDescricao] = useState('')
  const [preco, setPreco] = useState('')
  const [desconto, setDesconto] = useState('0')
  const [categoria, setCategoria] = useState('')
  const [disponivel, setDisponivel] = useState(true)
  const [criandoCategoria, setCriandoCategoria] = useState(false)
  const [novaCategoria, setNovaCategoria] = useState('')
  const [criandoCat, setCriandoCat] = useState(false)
  const [custoUnitario, setCustoUnitario] = useState('')
  const [quantidadeEstoque, setQuantidadeEstoque] = useState(String(ESTOQUE_QUANTIDADE_PADRAO))
  const [estoqueMinimo, setEstoqueMinimo] = useState(String(ESTOQUE_MINIMO_PADRAO))
  const [bloquearVendaSemEstoque, setBloquearVendaSemEstoque] = useState(false)
  const [erros, setErros] = useState<Record<string, string>>({})
  const [maisOpcoes, setMaisOpcoes] = useState(false)

  useEffect(() => {
    if (!aberto) return
    if (modo === 'editar' && produto) {
      setNome(produto.nome)
      setDescricao(produto.descricao || '')
      setPreco(String(produto.preco_original ?? produto.preco ?? ''))
      setDesconto(String(produto.desconto || 0))
      setCategoria(produto.categoria)
      setDisponivel(produto.disponivel)
      setCustoUnitario(
        produto.custo_unitario === null || produto.custo_unitario === undefined
          ? ''
          : String(produto.custo_unitario),
      )
      setQuantidadeEstoque(String(produto.estoque_quantidade ?? ESTOQUE_QUANTIDADE_PADRAO))
      setEstoqueMinimo(String(produto.estoque_minimo ?? ESTOQUE_MINIMO_PADRAO))
      setBloquearVendaSemEstoque(produto.bloquear_venda_sem_estoque === true)
    } else {
      setNome('')
      setDescricao('')
      setPreco('')
      setDesconto('0')
      setCategoria(categorias[0] || categoriasBebidas[0] || categoriaBebidasFallback || '')
      setDisponivel(true)
      setCustoUnitario('')
      setQuantidadeEstoque(String(ESTOQUE_QUANTIDADE_PADRAO))
      setEstoqueMinimo(String(ESTOQUE_MINIMO_PADRAO))
      setBloquearVendaSemEstoque(false)
    }
    setErros({})
    setMaisOpcoes(false)
    setCriandoCategoria(false)
    setNovaCategoria('')
  }, [aberto, modo, produto, categorias, categoriasBebidas, categoriaBebidasFallback])

  const ehBebida = useMemo(() => {
    return (
      categoriasBebidas.some((item) => item.toLowerCase() === categoria.trim().toLowerCase()) ||
      categoria.trim().toLowerCase() === categoriaBebidasFallback.trim().toLowerCase() ||
      produto?.tabela === 'bebidas'
    )
  }, [categoria, categoriasBebidas, categoriaBebidasFallback, produto?.tabela])

  const categoriasSelect = useMemo(
    () =>
      Array.from(
        new Set([...categorias, ...categoriasBebidas, categoriaBebidasFallback].filter(Boolean)),
      ),
    [categoriaBebidasFallback, categorias, categoriasBebidas],
  )

  const preview =
    modo === 'criar'
      ? previewImagemCriacao || null
      : produto?.imagem_url || null

  const handleSalvar = () => {
    const proximosErros: Record<string, string> = {}
    if (!nome.trim()) proximosErros.nome = 'Informe o nome.'

    try {
      normalizarDinheiro(preco)
    } catch {
      proximosErros.preco = 'Informe um preço de venda válido.'
    }

    try {
      normalizarDinheiro(custoUnitario, { opcional: true })
    } catch {
      proximosErros.custo = 'Informe um custo válido ou deixe em branco.'
    }

    try {
      normalizarConfiguracaoEstoque({
        quantidade: quantidadeEstoque,
        minimo: estoqueMinimo,
        bloquear: bloquearVendaSemEstoque,
      })
    } catch {
      if (quantidadeEstoque.trim() === '') {
        proximosErros.quantidade = 'Informe a quantidade. Zero é válido; vazio não zera.'
      } else {
        try {
          normalizarConfiguracaoEstoque({ quantidade: quantidadeEstoque, minimo: 0 })
        } catch {
          proximosErros.quantidade = 'Quantidade deve ser um número inteiro.'
        }
      }
      if (estoqueMinimo.trim() === '') {
        proximosErros.minimo = 'Informe o estoque mínimo. Zero é válido.'
      } else {
        try {
          normalizarConfiguracaoEstoque({ quantidade: 0, minimo: estoqueMinimo })
        } catch {
          proximosErros.minimo = 'Estoque mínimo deve ser um inteiro não negativo.'
        }
      }
    }

    setErros(proximosErros)
    if (proximosErros.custo || proximosErros.quantidade || proximosErros.minimo) setMaisOpcoes(true)
    if (Object.keys(proximosErros).length > 0) {
      // Espera o "Estoque e custo" abrir antes de focar.
      const focar = (id: string) => requestAnimationFrame(() => document.getElementById(id)?.focus())
      if (proximosErros.preco) focar('modal-produto-preco')
      else if (proximosErros.custo) focar('modal-produto-custo')
      else if (proximosErros.quantidade) focar('modal-produto-quantidade')
      else if (proximosErros.minimo) focar('modal-produto-minimo')
      return
    }

    void onSalvar({
      nome: nome.trim(),
      descricao: descricao.trim(),
      preco,
      desconto,
      categoria,
      disponivel,
      custoUnitario,
      quantidadeEstoque,
      estoqueMinimo,
      bloquearVendaSemEstoque,
    })
  }

  const handleCriarCategoria = async () => {
    if (!onCriarCategoria || !novaCategoria.trim()) return
    try {
      setCriandoCat(true)
      const criada = await onCriarCategoria(novaCategoria.trim())
      if (criada) {
        setCategoria(criada)
        setCriandoCategoria(false)
        setNovaCategoria('')
      }
    } finally {
      setCriandoCat(false)
    }
  }

  const abrirSeletorFoto = modo === 'criar' ? onSelecionarFotoCriacao : onSelecionarFoto

  return (
    <Gaveta
      aberto={aberto}
      aoFechar={onFechar}
      largura="lg"
      bloqueada={salvando}
      titulo={modo === 'criar' ? (ehBebida ? 'Nova bebida' : 'Novo produto') : ehBebida ? 'Editar bebida' : 'Editar produto'}
      descricao={modo === 'criar' ? 'Preencha o básico. O resto já vem pronto.' : 'Altere o que precisar e toque em Salvar.'}
      rodape={
        <>
          {modo === 'editar' && onExcluir ? (
            <Botao variante="perigoSuave" className="md:mr-auto" onClick={onExcluir} disabled={salvando}>
              Excluir
            </Botao>
          ) : (
            <Botao variante="contorno" onClick={onFechar} disabled={salvando}>
              Cancelar
            </Botao>
          )}
          <Botao onClick={handleSalvar} carregando={salvando} disabled={!nome.trim() || !preco}>
            {modo === 'criar' ? (ehBebida ? 'Criar bebida' : 'Criar produto') : 'Salvar'}
          </Botao>
        </>
      }
    >
      <form
        className="space-y-5"
        onSubmit={(evento) => {
          evento.preventDefault()
          handleSalvar()
        }}
      >
        <div className="flex gap-4">
          <button
            type="button"
            onClick={abrirSeletorFoto}
            className="relative flex size-24 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-dashed border-border/70 bg-muted/40 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:size-28"
            aria-label={preview ? 'Trocar foto' : 'Adicionar foto'}
          >
            {preview ? (
              <Image src={preview} alt="" fill className="object-cover" unoptimized />
            ) : (
              <Camera className="size-6 text-muted-foreground" />
            )}
            {enviandoImagem ? (
              <span className="absolute inset-0 flex items-center justify-center bg-background/70">
                <Loader2 className="size-6 animate-spin text-foreground" />
              </span>
            ) : null}
          </button>
          <div className="flex min-w-0 flex-1 flex-col justify-center gap-1">
            <p className="text-sm font-medium text-foreground">Foto</p>
            <p className="text-[13px] leading-5 text-muted-foreground">
              {preview ? 'Toque na foto para trocar.' : 'Opcional. Produto com foto vende mais.'}
            </p>
            {modo === 'editar' && preview ? (
              <div className="-ml-2.5 flex flex-wrap gap-1">
                <Botao variante="fantasma" tamanho="sm" className="h-11 md:h-9" onClick={onRecortarFoto}>
                  <Crop />
                  Recortar
                </Botao>
                <Botao variante="perigoSuave" tamanho="sm" className="h-11 md:h-9" onClick={onRemoverFoto}>
                  <Trash2 />
                  Remover
                </Botao>
              </div>
            ) : null}
          </div>
        </div>

        <Campo rotulo={ehBebida ? 'Nome da bebida' : 'Nome'} htmlFor="modal-produto-nome" erro={erros.nome}>
          <Entrada
            id="modal-produto-nome"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder={ehBebida ? 'Ex.: Coca-Cola' : 'Ex.: X-Burguer especial'}
            aria-invalid={Boolean(erros.nome)}
            autoComplete="off"
          />
        </Campo>

        <div className={modo === 'editar' ? 'grid grid-cols-2 gap-3' : undefined}>
          <Campo rotulo="Preço" htmlFor="modal-produto-preco" erro={erros.preco}>
            <EntradaPreco
              id="modal-produto-preco"
              valor={preco}
              aoMudar={setPreco}
              aria-invalid={Boolean(erros.preco)}
            />
          </Campo>
          {modo === 'editar' ? (
            <Campo rotulo="Desconto" htmlFor="modal-produto-desconto" opcional>
              <div className="relative">
                <Entrada
                  id="modal-produto-desconto"
                  type="number"
                  inputMode="numeric"
                  min="0"
                  max="100"
                  step="1"
                  value={desconto}
                  onChange={(e) => setDesconto(e.target.value)}
                  className="pr-8 tabular-nums"
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">%</span>
              </div>
            </Campo>
          ) : null}
        </div>

        <Campo rotulo="Categoria" htmlFor="modal-produto-categoria">
          {!criandoCategoria ? (
            <Selecao
              id="modal-produto-categoria"
              value={categoria}
              onChange={(e) => {
                const valor = e.target.value
                if (valor === '__nova__') {
                  setCriandoCategoria(true)
                  setNovaCategoria('')
                  return
                }
                setCategoria(valor)
              }}
            >
              {!categoria ? <option value="">Escolha a categoria</option> : null}
              {categoriasSelect.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
              {onCriarCategoria ? <option value="__nova__">+ Criar nova categoria</option> : null}
            </Selecao>
          ) : (
            <div className="flex gap-2">
              <Entrada
                id="modal-produto-categoria"
                value={novaCategoria}
                onChange={(e) => setNovaCategoria(e.target.value)}
                placeholder="Nome da nova categoria"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    void handleCriarCategoria()
                  }
                }}
              />
              <Botao
                tamanho="icone"
                className="size-11 shrink-0 md:size-10"
                onClick={() => void handleCriarCategoria()}
                carregando={criandoCat}
                aria-label="Criar categoria"
              >
                {criandoCat ? null : <Plus />}
              </Botao>
              <Botao
                variante="contorno"
                tamanho="icone"
                className="size-11 shrink-0 md:size-10"
                onClick={() => {
                  setCriandoCategoria(false)
                  setNovaCategoria('')
                }}
                aria-label="Cancelar nova categoria"
              >
                <X />
              </Botao>
            </div>
          )}
        </Campo>

        <Campo rotulo={ehBebida ? 'Tamanho' : 'Descrição'} htmlFor="modal-produto-descricao" opcional>
          {ehBebida ? (
            <Entrada
              id="modal-produto-descricao"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Ex.: 350 ml, 600 ml, 2 L"
            />
          ) : (
            <AreaTexto
              id="modal-produto-descricao"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Ingredientes ou detalhes que o cliente vê no cardápio"
              rows={3}
            />
          )}
        </Campo>

        {modo === 'editar' ? (
          <LinhaInterruptor
            titulo="Aparece no cardápio"
            descricao="Desligue para esconder sem excluir."
            marcado={disponivel}
            aoMudar={setDisponivel}
          />
        ) : null}

        <div className="space-y-4">
          <button
            type="button"
            aria-expanded={maisOpcoes}
            aria-controls="modal-produto-mais-opcoes"
            onClick={() => setMaisOpcoes((atual) => !atual)}
            className="-mx-2 flex min-h-11 w-[calc(100%+1rem)] items-center justify-between rounded-lg px-2 text-left text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            <span>
              Estoque e custo
              <span className="block text-[13px] font-normal text-muted-foreground">
                Quantidade {quantidadeEstoque || '0'} · alerta em {estoqueMinimo || '0'}
              </span>
            </span>
            <CaretDown className={maisOpcoes ? 'size-4 rotate-180 transition-transform' : 'size-4 transition-transform'} />
          </button>

          <div id="modal-produto-mais-opcoes" hidden={!maisOpcoes} className="space-y-4">
            <Campo rotulo="Preço de custo" htmlFor="modal-produto-custo" erro={erros.custo} opcional ajuda="Usado para calcular o lucro.">
              <EntradaPreco
                id="modal-produto-custo"
                valor={custoUnitario}
                aoMudar={setCustoUnitario}
                placeholder="0,00"
                aria-invalid={Boolean(erros.custo)}
              />
            </Campo>
            <div className="grid grid-cols-2 gap-3">
              <Campo rotulo="Quantidade atual" htmlFor="modal-produto-quantidade" erro={erros.quantidade}>
                <Entrada
                  id="modal-produto-quantidade"
                  type="text"
                  inputMode="numeric"
                  value={quantidadeEstoque}
                  onChange={(e) => setQuantidadeEstoque(e.target.value)}
                  aria-invalid={Boolean(erros.quantidade)}
                  className="tabular-nums"
                />
              </Campo>
              <Campo rotulo="Avisar quando chegar a" htmlFor="modal-produto-minimo" erro={erros.minimo}>
                <Entrada
                  id="modal-produto-minimo"
                  type="text"
                  inputMode="numeric"
                  value={estoqueMinimo}
                  onChange={(e) => setEstoqueMinimo(e.target.value)}
                  aria-invalid={Boolean(erros.minimo)}
                  className="tabular-nums"
                />
              </Campo>
            </div>
            <LinhaInterruptor
              titulo="Esgotar no site quando acabar"
              descricao="No balcão e no salão a venda continua liberada."
              marcado={bloquearVendaSemEstoque}
              aoMudar={setBloquearVendaSemEstoque}
            />
          </div>
        </div>

        <button type="submit" className="hidden" aria-hidden tabIndex={-1} />
      </form>
    </Gaveta>
  )
}
