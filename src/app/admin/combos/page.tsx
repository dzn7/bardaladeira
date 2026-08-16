'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import {
    RefreshCw,
    Package,
    Layers,
    Camera,
    Trash2,
    Plus,
    Save,
    Copy,
    Pencil,
    UtensilsCrossed,
    GlassWater,
    Search,
} from 'lucide-react'
import { toast } from 'sonner'
import ProtectedRoute from '@/components/admin/ProtectedRoute'
import AdminLayout from '@/components/admin/AdminLayout'
import ModalRecorteImagem from '@/components/admin/ModalRecorteImagem'
import { validarArquivoImagem, arquivoParaUrl } from '@/lib/recorteImagem'
import { enviarImagemParaR2 } from '@/lib/servicoUploadImagem'
import { supabase, Combo, ComboItem, Produto, Bebida } from '@/lib/supabase'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import {
    Empty,
    EmptyContent,
    EmptyDescription,
    EmptyHeader,
    EmptyMedia,
    EmptyTitle,
} from '@/components/ui/empty'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { MenuAcoes } from '@/components/ui/menu-acoes'
import { Textarea } from '@/components/ui/textarea'

type ComboExpandido = Combo & {
    itens: (ComboItem & {
        produto?: Produto
        bebida?: Bebida
    })[]
}

export default function CombosPage() {
    const [combos, setCombos] = useState<ComboExpandido[]>([])
    const [produtos, setProdutos] = useState<Produto[]>([])
    const [bebidas, setBebidas] = useState<Bebida[]>([])
    const [carregando, setCarregando] = useState(true)
    const [salvando, setSalvando] = useState<string | null>(null)
    const [busca, setBusca] = useState('')

    const [modalAberto, setModalAberto] = useState(false)
    const [comboEditando, setComboEditando] = useState<ComboExpandido | null>(null)
    const [nomeCombo, setNomeCombo] = useState('')
    const [descricaoCombo, setDescricaoCombo] = useState('')
    const [precoCombo, setPrecoCombo] = useState('')
    const [precoOriginal, setPrecoOriginal] = useState('')
    const [descontoAtivo, setDescontoAtivo] = useState(false)
    const [itensCombo, setItensCombo] = useState<{ tipo: 'produto' | 'bebida', id: string, quantidade: number }[]>([])
    const [imagemCombo, setImagemCombo] = useState<string | null>(null)
    const [blobImagem, setBlobImagem] = useState<Blob | null>(null)
    const [salvandoCombo, setSalvandoCombo] = useState(false)

    const [recorteAberto, setRecorteAberto] = useState(false)
    const [imagemParaRecorte, setImagemParaRecorte] = useState('')

    const inputFileRef = useRef<HTMLInputElement>(null)

    useEffect(() => {
        carregarDados()

        const channelCombos = supabase
            .channel('admin-combos-changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'combos' }, () => {
                carregarDados()
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'combo_itens' }, () => {
                carregarDados()
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'produtos' }, () => {
                carregarDados()
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'bebidas' }, () => {
                carregarDados()
            })
            .subscribe()

        return () => {
            supabase.removeChannel(channelCombos)
        }
    }, [])

    const carregarDados = async () => {
        setCarregando(true)
        try {
            const { data: combosData, error: combosError } = await supabase
                .from('combos')
                .select('*')
                .order('preco', { ascending: false })

            if (combosError) throw combosError

            const combosComItens: ComboExpandido[] = []
            for (const combo of combosData || []) {
                const { data: itensData } = await supabase
                    .from('combo_itens')
                    .select(`
            *,
            produto:produtos(*),
            bebida:bebidas(*)
          `)
                    .eq('combo_id', combo.id)

                combosComItens.push({
                    ...combo,
                    itens: itensData || []
                })
            }

            setCombos(combosComItens)

            const { data: produtosData } = await supabase
                .from('produtos')
                .select('*')
                .order('nome')

            setProdutos(produtosData || [])

            const { data: bebidasData } = await supabase
                .from('bebidas')
                .select('*')
                .order('nome')

            setBebidas(bebidasData || [])
        } catch (erro) {
            console.error('Erro ao carregar dados:', erro)
            toast.error('Não foi possível carregar os dados.')
        } finally {
            setCarregando(false)
        }
    }

    const combosFiltrados = useMemo(() => {
        const termo = busca.trim().toLowerCase()
        if (!termo) return combos
        return combos.filter((combo) => combo.nome.toLowerCase().includes(termo))
    }, [combos, busca])

    const abrirModalNovo = () => {
        setComboEditando(null)
        setNomeCombo('')
        setDescricaoCombo('')
        setPrecoCombo('')
        setPrecoOriginal('')
        setDescontoAtivo(false)
        setItensCombo([])
        setImagemCombo(null)
        setBlobImagem(null)
        setModalAberto(true)
    }

    const abrirModalEditar = (combo: ComboExpandido) => {
        setComboEditando(combo)
        setNomeCombo(combo.nome)
        setDescricaoCombo(combo.descricao || '')
        setPrecoCombo(combo.preco.toString())
        setPrecoOriginal((combo as any).preco_original?.toString() || '')
        setDescontoAtivo(!!(combo as any).preco_original || !!(combo as any).desconto_percentual)
        setImagemCombo(combo.imagem_url)
        setBlobImagem(null)

        const itens = combo.itens.map(item => ({
            tipo: item.produto_id ? 'produto' as const : 'bebida' as const,
            id: item.produto_id || item.bebida_id || '',
            quantidade: item.quantidade
        }))
        setItensCombo(itens)

        setModalAberto(true)
    }

    const fecharModal = () => {
        setModalAberto(false)
        setComboEditando(null)
    }

    const selecionarImagem = async (evento: React.ChangeEvent<HTMLInputElement>) => {
        const arquivo = evento.target.files?.[0]
        if (!arquivo) return

        const validacao = validarArquivoImagem(arquivo)
        if (!validacao.valido) {
            toast.error(validacao.erro || 'O arquivo selecionado não é válido.')
            evento.target.value = ''
            return
        }

        try {
            const urlImagem = await arquivoParaUrl(arquivo)
            setImagemParaRecorte(urlImagem)
            setRecorteAberto(true)
        } catch (erro) {
            console.error('Erro ao ler arquivo:', erro)
        }
        evento.target.value = ''
    }

    const confirmarRecorte = (base64: string, blob: Blob) => {
        setImagemCombo(base64)
        setBlobImagem(blob)
        setRecorteAberto(false)
    }

    const adicionarItem = (tipo: 'produto' | 'bebida') => {
        const primeiroItem = tipo === 'produto'
            ? produtos[0]?.id
            : bebidas[0]?.id

        if (primeiroItem) {
            setItensCombo([...itensCombo, { tipo, id: primeiroItem, quantidade: 1 }])
        }
    }

    const removerItem = (indice: number) => {
        setItensCombo(itensCombo.filter((_, i) => i !== indice))
    }

    const atualizarItem = (indice: number, campo: 'id' | 'quantidade', valor: string | number) => {
        const novosItens = [...itensCombo]
        if (campo === 'id') {
            novosItens[indice].id = valor as string
        } else {
            novosItens[indice].quantidade = valor as number
        }
        setItensCombo(novosItens)
    }

    const salvarCombo = async () => {
        if (!nomeCombo.trim()) {
            toast.warning('Preencha o nome do combo.')
            return
        }
        if (!precoCombo || parseFloat(precoCombo) <= 0) {
            toast.warning('Preencha o preço do combo.')
            return
        }
        if (itensCombo.length === 0) {
            toast.warning('Adicione pelo menos um item ao combo.')
            return
        }

        setSalvandoCombo(true)
        try {
            let comboId: string

            const precoFinal = parseFloat(precoCombo)
            const precoOrig = descontoAtivo && precoOriginal ? parseFloat(precoOriginal) : null
            const descontoCalc = precoOrig && precoOrig > precoFinal
                ? Math.round(((precoOrig - precoFinal) / precoOrig) * 100)
                : null

            if (comboEditando) {
                const { error: erroUpdate } = await supabase
                    .from('combos')
                    .update({
                        nome: nomeCombo.trim(),
                        descricao: descricaoCombo.trim() || null,
                        preco: precoFinal,
                        preco_original: precoOrig,
                        desconto_percentual: descontoCalc
                    })
                    .eq('id', comboEditando.id)

                if (erroUpdate) throw erroUpdate
                comboId = comboEditando.id

                await supabase
                    .from('combo_itens')
                    .delete()
                    .eq('combo_id', comboId)
            } else {
                const { data: novoCombo, error: erroInsert } = await supabase
                    .from('combos')
                    .insert({
                        nome: nomeCombo.trim(),
                        descricao: descricaoCombo.trim() || null,
                        preco: precoFinal,
                        preco_original: precoOrig,
                        desconto_percentual: descontoCalc,
                        disponivel: true
                    })
                    .select()
                    .single()

                if (erroInsert) throw erroInsert
                comboId = novoCombo.id
            }

            const itensParaInserir = itensCombo.map(item => ({
                combo_id: comboId,
                produto_id: item.tipo === 'produto' ? item.id : null,
                bebida_id: item.tipo === 'bebida' ? item.id : null,
                quantidade: item.quantidade
            }))

            const { error: erroItens } = await supabase
                .from('combo_itens')
                .insert(itensParaInserir)

            if (erroItens) throw erroItens

            if (blobImagem) {
                const resultadoUpload = await enviarImagemParaR2(blobImagem, 'combos', comboId)
                if (resultadoUpload.sucesso && resultadoUpload.url) {
                    await supabase
                        .from('combos')
                        .update({ imagem_url: resultadoUpload.url })
                        .eq('id', comboId)
                }
            }

            toast.success(comboEditando ? 'Combo atualizado com sucesso!' : 'Combo cadastrado com sucesso!')

            fecharModal()
            carregarDados()
        } catch (erro) {
            console.error('Erro ao salvar combo:', erro)
            toast.error('Não foi possível salvar o combo. Tente novamente.')
        } finally {
            setSalvandoCombo(false)
        }
    }

    const duplicarCombo = async (combo: ComboExpandido) => {
        setSalvando(combo.id)
        try {
            const { data: novoCombo, error: erroInsert } = await supabase
                .from('combos')
                .insert({
                    nome: `${combo.nome} (Cópia)`,
                    descricao: combo.descricao,
                    preco: combo.preco,
                    imagem_url: combo.imagem_url,
                    disponivel: false,
                    ordem: combo.ordem + 1
                })
                .select()
                .single()

            if (erroInsert) throw erroInsert

            const itensParaCopiar = combo.itens.map(item => ({
                combo_id: novoCombo.id,
                produto_id: item.produto_id,
                bebida_id: item.bebida_id,
                quantidade: item.quantidade
            }))

            await supabase
                .from('combo_itens')
                .insert(itensParaCopiar)

            toast.success('Combo duplicado. Ele foi criado como desabilitado.')
            carregarDados()
        } catch (erro) {
            console.error('Erro ao duplicar combo:', erro)
            toast.error('Não foi possível duplicar o combo.')
        } finally {
            setSalvando(null)
        }
    }

    const alternarDisponibilidade = async (combo: ComboExpandido) => {
        setSalvando(combo.id)
        try {
            const { error } = await supabase
                .from('combos')
                .update({ disponivel: !combo.disponivel })
                .eq('id', combo.id)

            if (error) throw error

            setCombos(combos.map(c =>
                c.id === combo.id ? { ...c, disponivel: !c.disponivel } : c
            ))
        } catch (erro) {
            console.error('Erro ao alterar disponibilidade:', erro)
            toast.error('Não foi possível alterar a disponibilidade.')
        } finally {
            setSalvando(null)
        }
    }

    const excluirCombo = async (combo: ComboExpandido) => {
        if (!confirm(`Deseja realmente excluir o combo "${combo.nome}"?`)) return

        setSalvando(combo.id)
        try {
            const { error } = await supabase
                .from('combos')
                .delete()
                .eq('id', combo.id)

            if (error) throw error

            toast.success('Combo excluído com sucesso!')
            carregarDados()
        } catch (erro) {
            console.error('Erro ao excluir combo:', erro)
            toast.error('Não foi possível excluir o combo.')
        } finally {
            setSalvando(null)
        }
    }

    const formatarPreco = (valor: number) => {
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL'
        }).format(valor)
    }

    return (
        <ProtectedRoute>
            <AdminLayout>
                <div className="mx-auto w-full max-w-6xl space-y-5">
                    <div className="flex flex-col gap-3 rounded-xl border border-border/70 bg-card p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-5">
                        <div className="min-w-0">
                            <h1 className="flex items-center gap-2 text-lg font-semibold tracking-tight text-foreground">
                                <Layers className="size-5 text-primary" />
                                Combos
                            </h1>
                            <p className="mt-1 text-sm text-muted-foreground">
                                Combos promocionais · {combos.length} cadastrado{combos.length === 1 ? '' : 's'}
                            </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-9 shadow-none"
                                onClick={carregarDados}
                                disabled={carregando}
                            >
                                <RefreshCw className={`mr-2 size-4 ${carregando ? 'animate-spin' : ''}`} />
                                Atualizar
                            </Button>
                            <Button
                                type="button"
                                size="sm"
                                className="h-9 shadow-none"
                                onClick={abrirModalNovo}
                            >
                                <Plus className="mr-2 size-4" />
                                Novo combo
                            </Button>
                        </div>
                    </div>

                    <div className="relative">
                        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            value={busca}
                            onChange={(e) => setBusca(e.target.value)}
                            placeholder="Buscar combo por nome…"
                            className="h-10 pl-9"
                            aria-label="Buscar combo por nome"
                        />
                    </div>

                    {carregando ? (
                        <div className="flex justify-center items-center py-16">
                            <RefreshCw className="size-8 text-primary animate-spin" />
                        </div>
                    ) : combos.length === 0 ? (
                        <Empty className="border border-dashed border-border/70 bg-card">
                            <EmptyHeader>
                                <EmptyMedia variant="icon">
                                    <Package />
                                </EmptyMedia>
                                <EmptyTitle>Nenhum combo cadastrado</EmptyTitle>
                                <EmptyDescription>
                                    Crie combos promocionais com produtos e bebidas.
                                </EmptyDescription>
                            </EmptyHeader>
                            <EmptyContent>
                                <Button type="button" size="sm" className="h-9 shadow-none" onClick={abrirModalNovo}>
                                    <Plus className="mr-2 size-4" />
                                    Criar primeiro combo
                                </Button>
                            </EmptyContent>
                        </Empty>
                    ) : combosFiltrados.length === 0 ? (
                        <Empty className="border border-dashed border-border/70 bg-card">
                            <EmptyHeader>
                                <EmptyMedia variant="icon">
                                    <Search />
                                </EmptyMedia>
                                <EmptyTitle>Nenhum resultado</EmptyTitle>
                                <EmptyDescription>
                                    Nenhum combo corresponde a “{busca.trim()}”.
                                </EmptyDescription>
                            </EmptyHeader>
                            <EmptyContent>
                                <Button type="button" variant="outline" size="sm" className="h-9 shadow-none" onClick={() => setBusca('')}>
                                    Limpar busca
                                </Button>
                            </EmptyContent>
                        </Empty>
                    ) : (
                        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                            {combosFiltrados.map((combo) => (
                                <div
                                    key={combo.id}
                                    className="overflow-hidden rounded-xl border border-border/70 bg-card transition-colors hover:border-primary/40"
                                >
                                    <div className="flex items-start gap-3 border-b border-border/60 p-3.5">
                                        <div className="size-14 shrink-0 overflow-hidden rounded-lg border border-border/70 bg-muted">
                                            {combo.imagem_url ? (
                                                <img
                                                    src={combo.imagem_url}
                                                    alt={combo.nome}
                                                    className="h-full w-full object-cover"
                                                />
                                            ) : (
                                                <div className="flex h-full w-full items-center justify-center">
                                                    <Package className="size-5 text-muted-foreground" />
                                                </div>
                                            )}
                                        </div>

                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-start justify-between gap-2">
                                                <h3 className="line-clamp-2 text-sm font-semibold leading-tight text-foreground">
                                                    {combo.nome}
                                                </h3>
                                                <MenuAcoes
                                                    ariaLabel={`Ações do combo ${combo.nome}`}
                                                    disabled={salvando === combo.id}
                                                    items={[
                                                        {
                                                            key: 'editar',
                                                            label: 'Editar',
                                                            icon: <Pencil className="size-4" />,
                                                            onSelect: () => abrirModalEditar(combo),
                                                        },
                                                        {
                                                            key: 'duplicar',
                                                            label: 'Duplicar',
                                                            icon: <Copy className="size-4" />,
                                                            onSelect: () => { void duplicarCombo(combo) },
                                                        },
                                                        {
                                                            key: 'excluir',
                                                            label: 'Excluir',
                                                            icon: <Trash2 className="size-4" />,
                                                            variant: 'destructive',
                                                            separatorBefore: true,
                                                            onSelect: () => { void excluirCombo(combo) },
                                                        },
                                                    ]}
                                                />
                                            </div>
                                            <p className="mt-1 text-base font-bold tabular-nums text-primary">
                                                {formatarPreco(combo.preco)}
                                            </p>
                                            <button
                                                type="button"
                                                onClick={() => void alternarDisponibilidade(combo)}
                                                disabled={salvando === combo.id}
                                                className="mt-1.5 inline-flex"
                                                aria-label={combo.disponivel ? 'Desativar combo' : 'Ativar combo'}
                                            >
                                                <Badge
                                                    variant={combo.disponivel ? 'default' : 'secondary'}
                                                    className={
                                                        combo.disponivel
                                                            ? 'cursor-pointer bg-primary/15 text-primary hover:bg-primary/20'
                                                            : 'cursor-pointer text-muted-foreground'
                                                    }
                                                >
                                                    {combo.disponivel ? 'Ativo' : 'Inativo'}
                                                </Badge>
                                            </button>
                                        </div>
                                    </div>

                                    <div className="bg-muted/40 px-3.5 py-2.5">
                                        <p className="mb-1.5 text-xs font-medium text-muted-foreground">Itens inclusos</p>
                                        <div className="flex flex-wrap gap-1.5">
                                            {combo.itens.map((item, idx) => (
                                                <span
                                                    key={idx}
                                                    className="inline-flex items-center gap-1 rounded-md border border-border/70 bg-card px-2 py-0.5 text-xs text-foreground"
                                                >
                                                    <span className="font-medium text-primary">{item.quantidade}x</span>
                                                    <span className="max-w-[120px] truncate">
                                                        {item.produto?.nome || item.bebida?.nome || 'Item'}
                                                    </span>
                                                </span>
                                            ))}
                                            {combo.itens.length === 0 && (
                                                <span className="text-xs italic text-muted-foreground">Nenhum item</span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    <input
                        ref={inputFileRef}
                        type="file"
                        accept="image/*"
                        onChange={selecionarImagem}
                        className="hidden"
                    />

                    <Dialog open={modalAberto} onOpenChange={(aberto) => { if (!aberto) fecharModal() }}>
                        <DialogContent className="flex max-h-[min(92dvh,880px)] flex-col gap-0 overflow-hidden p-0 sm:max-w-xl">
                            <DialogHeader className="shrink-0 border-b border-border/70 px-4 py-3 sm:px-6 sm:py-4">
                                <DialogTitle>
                                    {comboEditando ? 'Editar Combo' : 'Novo Combo'}
                                </DialogTitle>
                            </DialogHeader>

                            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-4 sm:px-6">
                                <div className="flex flex-col gap-4 sm:flex-row">
                                    <button
                                        type="button"
                                        onClick={() => inputFileRef.current?.click()}
                                        className="flex h-36 w-full shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-border/70 bg-muted transition-colors hover:border-primary sm:w-36"
                                        aria-label="Adicionar imagem do combo"
                                    >
                                        {imagemCombo ? (
                                            <img
                                                src={imagemCombo}
                                                alt="Preview"
                                                className="h-full w-full object-cover"
                                            />
                                        ) : (
                                            <div className="p-2 text-center">
                                                <Camera className="mx-auto mb-1 size-8 text-muted-foreground" />
                                                <p className="text-xs text-muted-foreground">Adicionar imagem</p>
                                            </div>
                                        )}
                                    </button>

                                    <div className="flex-1 space-y-3">
                                        <div className="space-y-1.5">
                                            <Label htmlFor="combo-nome">Nome do Combo</Label>
                                            <Input
                                                id="combo-nome"
                                                value={nomeCombo}
                                                onChange={(e) => setNomeCombo(e.target.value)}
                                                placeholder="Ex: 2 MAX TOP + 2 COCA COLA"
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label htmlFor="combo-preco">Preço Final (R$)</Label>
                                            <div className="relative">
                                                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">R$</span>
                                                <Input
                                                    id="combo-preco"
                                                    type="number"
                                                    step="0.01"
                                                    min="0"
                                                    value={precoCombo}
                                                    onChange={(e) => setPrecoCombo(e.target.value)}
                                                    placeholder="0,00"
                                                    className="pl-10"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="rounded-xl border border-border/70 bg-card p-3 text-card-foreground">
                                    <p className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                                        Prévia do card no cliente
                                    </p>
                                    <div className="mx-auto w-40 overflow-hidden rounded-xl border border-border/70 bg-card">
                                        <div className="relative aspect-[4/5] bg-muted">
                                            {imagemCombo ? (
                                                <img src={imagemCombo} alt="Prévia do combo" className="h-full w-full object-cover" />
                                            ) : (
                                                <div className="flex h-full w-full items-center justify-center">
                                                    <Package className="size-8 text-muted-foreground/50" />
                                                </div>
                                            )}
                                            <div className="absolute left-2 top-2 rounded-md border border-border/70 bg-background/90 px-2 py-0.5 text-[9px] font-semibold uppercase text-foreground backdrop-blur">
                                                Combo
                                            </div>
                                        </div>
                                        <div className="space-y-2 border-t border-border/70 p-2.5">
                                            <p className="line-clamp-1 text-[11px] font-semibold text-foreground">
                                                {nomeCombo || 'Nome do combo'}
                                            </p>
                                            <p className="text-xs font-semibold leading-none text-foreground">
                                                R$ {(parseFloat(precoCombo || '0') || 0).toFixed(2)}
                                            </p>
                                            <div className="rounded-md bg-primary px-2 py-1.5 text-center text-[10px] font-semibold text-primary-foreground">
                                                + Adicionar
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="rounded-xl border border-border/70 bg-muted/30 p-4">
                                    <label className="flex cursor-pointer items-start gap-3">
                                        <Checkbox
                                            checked={descontoAtivo}
                                            onCheckedChange={(checked) => {
                                                const ativo = checked === true
                                                setDescontoAtivo(ativo)
                                                if (!ativo) setPrecoOriginal('')
                                            }}
                                            className="mt-0.5"
                                            aria-label="Ativar desconto"
                                        />
                                        <div>
                                            <span className="text-sm font-medium text-foreground">Ativar Desconto</span>
                                            <p className="text-xs text-muted-foreground">Mostra badge de economia no site</p>
                                        </div>
                                    </label>

                                    {descontoAtivo && (
                                        <div className="mt-4 space-y-3">
                                            <div className="space-y-1.5">
                                                <Label htmlFor="combo-preco-original">Preço Original (De:)</Label>
                                                <div className="relative">
                                                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">R$</span>
                                                    <Input
                                                        id="combo-preco-original"
                                                        type="number"
                                                        step="0.01"
                                                        min="0"
                                                        value={precoOriginal}
                                                        onChange={(e) => setPrecoOriginal(e.target.value)}
                                                        placeholder="0,00"
                                                        className="pl-10"
                                                    />
                                                </div>
                                            </div>

                                            {precoOriginal && precoCombo && parseFloat(precoOriginal) > parseFloat(precoCombo) && (
                                                <div className="flex items-center gap-3 rounded-lg border border-border/70 bg-card p-3">
                                                    <div className="flex size-12 items-center justify-center rounded-lg bg-primary text-lg font-bold text-primary-foreground">
                                                        {Math.round(((parseFloat(precoOriginal) - parseFloat(precoCombo)) / parseFloat(precoOriginal)) * 100)}%
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-medium text-foreground">Preview do Badge</p>
                                                        <p className="text-xs text-muted-foreground">
                                                            <span className="text-muted-foreground line-through">R$ {parseFloat(precoOriginal).toFixed(2)}</span>
                                                            {' → '}
                                                            <span className="font-bold text-primary">R$ {parseFloat(precoCombo).toFixed(2)}</span>
                                                        </p>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>

                                <div className="space-y-1.5">
                                    <Label htmlFor="combo-descricao">Descrição (opcional)</Label>
                                    <Textarea
                                        id="combo-descricao"
                                        value={descricaoCombo}
                                        onChange={(e) => setDescricaoCombo(e.target.value)}
                                        placeholder="Descreva o combo..."
                                        rows={2}
                                        className="resize-none"
                                    />
                                </div>

                                <div>
                                    <div className="mb-2 flex items-center justify-between">
                                        <Label>Itens do Combo</Label>
                                        <span className="text-xs text-muted-foreground">{itensCombo.length} item(ns)</span>
                                    </div>

                                    <div className="mb-3 space-y-2">
                                        {itensCombo.map((item, idx) => (
                                            <div key={idx} className="flex items-center gap-2 rounded-lg border border-border/70 bg-muted/40 p-2">
                                                <select
                                                    value={item.tipo}
                                                    onChange={(e) => {
                                                        const novoTipo = e.target.value as 'produto' | 'bebida'
                                                        const novosItens = [...itensCombo]
                                                        novosItens[idx].tipo = novoTipo
                                                        novosItens[idx].id = novoTipo === 'produto'
                                                            ? produtos[0]?.id || ''
                                                            : bebidas[0]?.id || ''
                                                        setItensCombo(novosItens)
                                                    }}
                                                    className="rounded-md border border-border/70 bg-card px-2 py-1.5 text-xs font-medium"
                                                    aria-label={`Tipo do item ${idx + 1}`}
                                                >
                                                    <option value="produto">Produto</option>
                                                    <option value="bebida">Bebida</option>
                                                </select>

                                                <select
                                                    value={item.id}
                                                    onChange={(e) => atualizarItem(idx, 'id', e.target.value)}
                                                    className="min-w-0 flex-1 truncate rounded-md border border-border/70 bg-card px-2 py-1.5 text-xs"
                                                    aria-label={`Item ${idx + 1}`}
                                                >
                                                    {item.tipo === 'produto'
                                                        ? produtos.map(p => (
                                                            <option key={p.id} value={p.id}>{p.nome}</option>
                                                        ))
                                                        : bebidas.map(b => (
                                                            <option key={b.id} value={b.id}>{b.nome}</option>
                                                        ))
                                                    }
                                                </select>

                                                <div className="flex items-center gap-1">
                                                    <span className="text-xs text-muted-foreground">Qtd:</span>
                                                    <Input
                                                        type="text"
                                                        inputMode="numeric"
                                                        pattern="[0-9]*"
                                                        value={item.quantidade === 0 ? '' : item.quantidade}
                                                        onChange={(e) => {
                                                            const valor = e.target.value.replace(/\D/g, '')
                                                            if (valor === '') {
                                                                atualizarItem(idx, 'quantidade', 0)
                                                            } else {
                                                                atualizarItem(idx, 'quantidade', parseInt(valor))
                                                            }
                                                        }}
                                                        onBlur={(e) => {
                                                            if (!e.target.value || parseInt(e.target.value) < 1) {
                                                                atualizarItem(idx, 'quantidade', 1)
                                                            }
                                                        }}
                                                        onFocus={(e) => e.target.select()}
                                                        className="h-8 w-12 px-2 text-center text-xs"
                                                        aria-label={`Quantidade do item ${idx + 1}`}
                                                    />
                                                </div>

                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="icon"
                                                    className="size-8 shrink-0 text-muted-foreground hover:text-destructive"
                                                    onClick={() => removerItem(idx)}
                                                    aria-label={`Remover item ${idx + 1}`}
                                                >
                                                    <Trash2 className="size-3.5" />
                                                </Button>
                                            </div>
                                        ))}

                                        {itensCombo.length === 0 && (
                                            <div className="py-6 text-center text-sm text-muted-foreground">
                                                Adicione itens ao combo
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex flex-wrap gap-2">
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            className="h-8 shadow-none"
                                            onClick={() => adicionarItem('produto')}
                                        >
                                            <UtensilsCrossed className="mr-1.5 size-3.5" />
                                            Adicionar Produto
                                        </Button>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            className="h-8 shadow-none"
                                            onClick={() => adicionarItem('bebida')}
                                        >
                                            <GlassWater className="mr-1.5 size-3.5" />
                                            Adicionar Bebida
                                        </Button>
                                    </div>
                                </div>
                            </div>

                            <DialogFooter className="shrink-0 border-t border-border/70 bg-muted/40 px-4 py-3 sm:px-6">
                                <Button type="button" variant="outline" size="sm" className="h-9 shadow-none" onClick={fecharModal}>
                                    Cancelar
                                </Button>
                                <Button
                                    type="button"
                                    size="sm"
                                    className="h-9 shadow-none"
                                    onClick={() => void salvarCombo()}
                                    disabled={salvandoCombo}
                                >
                                    {salvandoCombo ? (
                                        <>
                                            <RefreshCw className="mr-2 size-4 animate-spin" />
                                            Salvando...
                                        </>
                                    ) : (
                                        <>
                                            <Save className="mr-2 size-4" />
                                            {comboEditando ? 'Salvar' : 'Criar Combo'}
                                        </>
                                    )}
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>

                    <ModalRecorteImagem
                        aberto={recorteAberto}
                        imagemUrl={imagemParaRecorte}
                        onConfirmar={confirmarRecorte}
                        onFechar={() => setRecorteAberto(false)}
                    />
                </div>
            </AdminLayout>
        </ProtectedRoute>
    )
}
