'use client'

import { useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import {
  Camera,
  Crop,
  ImageIcon,
  Loader2,
  Plus,
  Save,
  Trash2,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

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
}

export type DadosSalvarProduto = {
  nome: string
  descricao: string
  preco: string
  desconto: string
  categoria: string
  disponivel: boolean
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

  useEffect(() => {
    if (!aberto) return
    if (modo === 'editar' && produto) {
      setNome(produto.nome)
      setDescricao(produto.descricao || '')
      setPreco(String(produto.preco_original ?? produto.preco ?? ''))
      setDesconto(String(produto.desconto || 0))
      setCategoria(produto.categoria)
      setDisponivel(produto.disponivel)
    } else {
      setNome('')
      setDescricao('')
      setPreco('')
      setDesconto('0')
      setCategoria(categorias[0] || categoriasBebidas[0] || categoriaBebidasFallback || '')
      setDisponivel(true)
    }
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
    void onSalvar({
      nome: nome.trim(),
      descricao: descricao.trim(),
      preco,
      desconto,
      categoria,
      disponivel,
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

  return (
    <Dialog open={aberto} onOpenChange={(proximo) => !proximo && onFechar()}>
      <DialogContent
        className={cn(
          'flex max-h-[92dvh] w-full max-w-lg flex-col gap-0 overflow-hidden p-0',
          'sm:max-h-[90dvh]',
        )}
      >
        <DialogHeader className="shrink-0 space-y-1 border-b border-border/60 px-5 pb-4 pt-5 pr-12 text-left">
          <DialogTitle className="text-[15px] font-semibold tracking-tight">
            {modo === 'criar' ? 'Novo produto' : 'Editar produto'}
          </DialogTitle>
          <DialogDescription className="text-[13px] text-muted-foreground">
            {modo === 'criar'
              ? 'Cadastre produto ou bebida nas categorias do cardápio.'
              : 'Altere dados, foto e disponibilidade do item.'}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-5 py-4">
          <div className="space-y-2">
            <Label>Foto</Label>
            <button
              type="button"
              onClick={modo === 'criar' ? onSelecionarFotoCriacao : onSelecionarFoto}
              className="relative flex h-40 w-full items-center justify-center overflow-hidden rounded-xl border border-dashed border-border/70 bg-muted/30 transition-colors hover:bg-muted/50"
              aria-label={preview ? 'Trocar foto' : 'Adicionar foto'}
            >
              {preview ? (
                <Image src={preview} alt="" fill className="object-cover" unoptimized />
              ) : (
                <span className="flex flex-col items-center gap-2 text-sm text-muted-foreground">
                  <Camera className="h-6 w-6" />
                  Adicionar foto
                </span>
              )}
              {enviandoImagem ? (
                <span className="absolute inset-0 flex items-center justify-center bg-background/70">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </span>
              ) : null}
            </button>
            {modo === 'editar' && preview ? (
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="h-10 shadow-none"
                  onClick={onRecortarFoto}
                >
                  <Crop className="mr-2 h-4 w-4" />
                  Recortar
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="h-10 shadow-none text-destructive hover:text-destructive"
                  onClick={onRemoverFoto}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Remover foto
                </Button>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">Imagem comprimida antes do envio.</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Categoria *</Label>
            {!criandoCategoria ? (
              <Select
                value={categoria}
                onValueChange={(valor) => {
                  if (valor === '__nova__') {
                    setCriandoCategoria(true)
                    setNovaCategoria('')
                    return
                  }
                  setCategoria(valor)
                }}
              >
                <SelectTrigger className="h-11 border-border/70 shadow-none">
                  <SelectValue placeholder="Selecione a categoria" />
                </SelectTrigger>
                <SelectContent>
                  {categoriasSelect.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                  {onCriarCategoria ? (
                    <SelectItem value="__nova__">Criar nova categoria</SelectItem>
                  ) : null}
                </SelectContent>
              </Select>
            ) : (
              <div className="flex gap-2">
                <Input
                  value={novaCategoria}
                  onChange={(e) => setNovaCategoria(e.target.value)}
                  placeholder="Nome da nova categoria"
                  className="h-11 border-border/70 shadow-none"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      void handleCriarCategoria()
                    }
                  }}
                />
                <Button
                  type="button"
                  size="icon"
                  className="h-11 w-11 shrink-0 shadow-none"
                  onClick={() => void handleCriarCategoria()}
                  disabled={criandoCat}
                >
                  {criandoCat ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-11 w-11 shrink-0 shadow-none"
                  onClick={() => {
                    setCriandoCategoria(false)
                    setNovaCategoria('')
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="modal-produto-nome">
              {ehBebida ? 'Nome da bebida' : 'Nome do produto'} *
            </Label>
            <Input
              id="modal-produto-nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder={ehBebida ? 'Ex: Coca-Cola' : 'Ex: X-Burguer Especial'}
              className="h-11 border-border/70 shadow-none"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="modal-produto-descricao">{ehBebida ? 'Tamanho' : 'Descrição'}</Label>
            {ehBebida ? (
              <Input
                id="modal-produto-descricao"
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                placeholder="Ex: 350ml, 600ml, 2L"
                className="h-11 border-border/70 shadow-none"
              />
            ) : (
              <Textarea
                id="modal-produto-descricao"
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                placeholder="Descreva os ingredientes"
                rows={3}
                className="border-border/70 shadow-none"
              />
            )}
          </div>

          <div className={cn('grid gap-3', modo === 'editar' ? 'grid-cols-2' : 'grid-cols-1')}>
            <div className="space-y-2">
              <Label htmlFor="modal-produto-preco">Preço (R$) *</Label>
              <Input
                id="modal-produto-preco"
                type="number"
                step="0.01"
                min="0"
                value={preco}
                onChange={(e) => setPreco(e.target.value)}
                placeholder="0.00"
                className="h-11 border-border/70 shadow-none"
              />
            </div>
            {modo === 'editar' ? (
              <div className="space-y-2">
                <Label htmlFor="modal-produto-desconto">Desconto (%)</Label>
                <Input
                  id="modal-produto-desconto"
                  type="number"
                  min="0"
                  max="100"
                  step="1"
                  value={desconto}
                  onChange={(e) => setDesconto(e.target.value)}
                  className="h-11 border-border/70 shadow-none"
                />
              </div>
            ) : null}
          </div>

          {modo === 'editar' ? (
            <div className="flex items-center justify-between rounded-xl border border-border/60 px-3 py-3">
              <div>
                <p className="text-sm font-medium text-foreground">Disponível no cardápio</p>
                <p className="text-xs text-muted-foreground">Itens ocultos não aparecem no site</p>
              </div>
              <Checkbox
                checked={disponivel}
                onCheckedChange={(valor) => setDisponivel(valor === true)}
                aria-label="Disponível no cardápio"
              />
            </div>
          ) : null}

          {!preview && modo === 'editar' ? (
            <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
              <ImageIcon className="h-3.5 w-3.5" />
              Este item está sem foto
            </div>
          ) : null}
        </div>

        <DialogFooter className="gap-2 border-t border-border/60 bg-card px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 sm:gap-2 sm:px-5 sm:pb-4">
          {modo === 'editar' && onExcluir ? (
            <Button
              type="button"
              variant="outline"
              className="h-11 w-full shadow-none text-destructive hover:text-destructive sm:mr-auto sm:w-auto"
              onClick={onExcluir}
              disabled={salvando}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Excluir
            </Button>
          ) : null}
          <Button
            type="button"
            variant="outline"
            className="h-11 w-full shadow-none sm:w-auto"
            onClick={onFechar}
            disabled={salvando}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            className="h-11 w-full shadow-none sm:min-w-[140px] sm:w-auto"
            onClick={handleSalvar}
            disabled={salvando || !nome.trim() || !preco}
          >
            {salvando ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            {modo === 'criar' ? 'Salvar' : 'Salvar alterações'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
