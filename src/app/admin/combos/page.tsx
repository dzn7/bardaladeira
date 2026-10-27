'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { ArrowsClockwise as RefreshCw, Package, Camera, Trash as Trash2, Plus, Copy, ForkKnife as UtensilsCrossed, Drop as GlassWater, MagnifyingGlass as Search } from '@phosphor-icons/react'
import { toast } from 'sonner'
import ProtectedRoute from '@/components/admin/ProtectedRoute'
import AdminLayout from '@/components/admin/AdminLayout'
import ModalRecorteImagem from '@/components/admin/ModalRecorteImagem'
import { validarArquivoImagem, arquivoParaUrl } from '@/lib/recorteImagem'
import { enviarImagemParaR2 } from '@/lib/servicoUploadImagem'
import { supabase, Combo, ComboItem, Produto, Bebida } from '@/lib/supabase'
import {
    AreaTexto,
    Botao,
    CabecalhoPagina,
    Campo,
    Cartao,
    Contador,
    Entrada,
    EntradaPreco,
    Gaveta,
    Interruptor,
    LinhaInterruptor,
    Lista,
    ListaCarregando,
    ListaVazia,
    Pagina,
    Selecao,
    Selo,
    formatarPreco,
    lerPreco,
    useConfirmar,
} from '@/components/admin/ui'
import { cn } from '@/lib/utils'

type ComboExpandido = Combo & {
    itens: (ComboItem & {
        produto?: Produto
        bebida?: Bebida
    })[]
}

type ErrosCombo = { nome?: string; preco?: string; itens?: string }

const paraTextoPreco = (valor: number | null | undefined) =>
    valor === null || valor === undefined ? '' : String(valor).replace('.', ',')

export default function CombosPage() {
    const confirmar = useConfirmar()
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
    const [erros, setErros] = useState<ErrosCombo>({})
    // Evita insert duplicado se um passo posterior (itens, upload) falhar e o usuário tentar de novo.
    const idCriado = useRef<string | null>(null)

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
        setErros({})
        idCriado.current = null
        setModalAberto(true)
    }

    const abrirModalEditar = (combo: ComboExpandido) => {
        setComboEditando(combo)
        setNomeCombo(combo.nome)
        setDescricaoCombo(combo.descricao || '')
        setPrecoCombo(paraTextoPreco(combo.preco))
        setPrecoOriginal(paraTextoPreco(combo.preco_original))
        setDescontoAtivo(!!combo.preco_original || !!combo.desconto_percentual)
        setImagemCombo(combo.imagem_url)
        setBlobImagem(null)
        setErros({})
        idCriado.current = null

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
            setErros((atual) => ({ ...atual, itens: undefined }))
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

    const alterarTipoItem = (indice: number, novoTipo: 'produto' | 'bebida') => {
        const novosItens = [...itensCombo]
        novosItens[indice].tipo = novoTipo
        novosItens[indice].id = novoTipo === 'produto'
            ? produtos[0]?.id || ''
            : bebidas[0]?.id || ''
        setItensCombo(novosItens)
    }

    const precoFinalNumero = lerPreco(precoCombo)
    const precoOriginalNumero = lerPreco(precoOriginal)
    const percentualDesconto =
        precoFinalNumero !== null && precoOriginalNumero !== null && precoOriginalNumero > precoFinalNumero
            ? Math.round(((precoOriginalNumero - precoFinalNumero) / precoOriginalNumero) * 100)
            : null

    const salvarCombo = async () => {
        const proximosErros: ErrosCombo = {}
        if (!nomeCombo.trim()) proximosErros.nome = 'Informe o nome do combo.'
        if (precoFinalNumero === null || precoFinalNumero <= 0) proximosErros.preco = 'Informe o preço do combo.'
        if (itensCombo.length === 0) proximosErros.itens = 'Adicione pelo menos um item ao combo.'
        setErros(proximosErros)
        if (Object.keys(proximosErros).length > 0 || precoFinalNumero === null) return

        setSalvandoCombo(true)
        try {
            let comboId: string

            const precoFinal = precoFinalNumero
            const precoOrig = descontoAtivo && precoOriginalNumero ? precoOriginalNumero : null
            const descontoCalc = precoOrig && precoOrig > precoFinal
                ? Math.round(((precoOrig - precoFinal) / precoOrig) * 100)
                : null

            const idExistente = comboEditando?.id ?? idCriado.current

            if (idExistente) {
                const { error: erroUpdate } = await supabase
                    .from('combos')
                    .update({
                        nome: nomeCombo.trim(),
                        descricao: descricaoCombo.trim() || null,
                        preco: precoFinal,
                        preco_original: precoOrig,
                        desconto_percentual: descontoCalc
                    })
                    .eq('id', idExistente)

                if (erroUpdate) throw erroUpdate
                comboId = idExistente

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
                idCriado.current = comboId
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

            toast.success(comboEditando ? 'Combo salvo' : 'Combo criado', { description: nomeCombo.trim() })

            fecharModal()
            carregarDados()
        } catch (erro) {
            console.error('Erro ao salvar combo:', erro)
            toast.error('Não foi possível salvar o combo.', { description: 'Tente novamente.' })
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

            toast.success('Combo duplicado', { description: 'A cópia foi criada pausada.' })
            fecharModal()
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
        setCombos((atual) => atual.map(c => c.id === combo.id ? { ...c, disponivel: !combo.disponivel } : c))
        try {
            const { error } = await supabase
                .from('combos')
                .update({ disponivel: !combo.disponivel })
                .eq('id', combo.id)

            if (error) throw error
            toast.success(combo.disponivel ? 'Pausado no cardápio' : 'Voltou ao cardápio', { description: combo.nome })
        } catch (erro) {
            console.error('Erro ao alterar disponibilidade:', erro)
            setCombos((atual) => atual.map(c => c.id === combo.id ? { ...c, disponivel: combo.disponivel } : c))
            toast.error('Não foi possível alterar a disponibilidade.', { description: combo.nome })
        } finally {
            setSalvando(null)
        }
    }

    const excluirCombo = async (combo: ComboExpandido) => {
        const ok = await confirmar({
            titulo: `Excluir "${combo.nome}"?`,
            descricao: 'O combo some do cardápio. Não dá para desfazer.',
            confirmar: 'Excluir combo',
            perigo: true,
        })
        if (!ok) return

        setSalvando(combo.id)
        try {
            const { error } = await supabase
                .from('combos')
                .delete()
                .eq('id', combo.id)

            if (error) throw error

            toast.success('Combo excluído', { description: combo.nome })
            fecharModal()
            carregarDados()
        } catch (erro) {
            console.error('Erro ao excluir combo:', erro)
            toast.error('Não foi possível excluir o combo.', { description: 'Pause o combo para tirá-lo do cardápio.' })
        } finally {
            setSalvando(null)
        }
    }

    const ativos = combos.filter((combo) => combo.disponivel).length
    const ocupado = salvandoCombo || (comboEditando !== null && salvando === comboEditando.id)

    const botaoNovo = (
        <Botao onClick={abrirModalNovo}>
            <Plus />
            Novo combo
        </Botao>
    )

    return (
        <ProtectedRoute>
            <AdminLayout>
                <Pagina>
                    <CabecalhoPagina
                        titulo="Combos"
                        descricao={`${combos.length} cadastrado${combos.length === 1 ? '' : 's'} · ${ativos} no cardápio`}
                        acoes={
                            <>
                                <Botao variante="contorno" onClick={carregarDados} disabled={carregando}>
                                    <RefreshCw className={cn(carregando && 'animate-spin')} />
                                    Atualizar
                                </Botao>
                                {botaoNovo}
                            </>
                        }
                    />

                    {combos.length > 0 && (
                        <div className="relative">
                            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                            <Entrada
                                type="search"
                                value={busca}
                                onChange={(e) => setBusca(e.target.value)}
                                placeholder="Buscar combo"
                                className="pl-9"
                                aria-label="Buscar combo por nome"
                            />
                        </div>
                    )}

                    {carregando && combos.length === 0 ? (
                        <ListaCarregando linhas={4} />
                    ) : combos.length === 0 ? (
                        <ListaVazia
                            icone={<Package />}
                            titulo="Nenhum combo cadastrado"
                            descricao="Junte produtos e bebidas num preço especial."
                            acao={
                                <Botao onClick={abrirModalNovo}>
                                    <Plus />
                                    Criar primeiro combo
                                </Botao>
                            }
                        />
                    ) : combosFiltrados.length === 0 ? (
                        <ListaVazia
                            icone={<Search />}
                            titulo="Nenhum combo encontrado"
                            descricao={`Nenhum combo com “${busca.trim()}”.`}
                            acao={<Botao variante="contorno" onClick={() => setBusca('')}>Limpar busca</Botao>}
                        />
                    ) : (
                        <Lista>
                            {combosFiltrados.map((combo) => {
                                const resumoItens = combo.itens
                                    .map((item) => `${item.quantidade}x ${item.produto?.nome || item.bebida?.nome || 'Item'}`)
                                    .join(' · ')
                                return (
                                    <li key={combo.id}>
                                        <div
                                            role="button"
                                            tabIndex={0}
                                            onClick={() => abrirModalEditar(combo)}
                                            onKeyDown={(evento) => {
                                                if (evento.key === 'Enter') abrirModalEditar(combo)
                                            }}
                                            className={cn(
                                                'flex min-h-16 cursor-pointer items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
                                                !combo.disponivel && 'opacity-60',
                                            )}
                                        >
                                            <div className="size-12 shrink-0 overflow-hidden rounded-lg bg-muted">
                                                {combo.imagem_url ? (
                                                    <img src={combo.imagem_url} alt="" className="h-full w-full object-cover" />
                                                ) : (
                                                    <div className="flex h-full w-full items-center justify-center">
                                                        <Package className="size-5 text-muted-foreground" />
                                                    </div>
                                                )}
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <p className="truncate font-medium text-foreground">{combo.nome}</p>
                                                <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                                                    <span className="text-sm font-medium tabular-nums text-primary">{formatarPreco(combo.preco)}</span>
                                                    {combo.desconto_percentual ? <Selo tom="primario">-{combo.desconto_percentual}%</Selo> : null}
                                                    {!combo.disponivel ? <Selo>Pausado</Selo> : null}
                                                </div>
                                                <p className="mt-0.5 truncate text-[13px] text-muted-foreground">
                                                    {resumoItens || 'Nenhum item'}
                                                </p>
                                            </div>
                                            <Interruptor
                                                marcado={combo.disponivel}
                                                aoMudar={() => void alternarDisponibilidade(combo)}
                                                desabilitado={salvando === combo.id}
                                                rotuloAcessivel={`${combo.disponivel ? 'Pausar' : 'Ativar'} ${combo.nome} no cardápio`}
                                            />
                                        </div>
                                    </li>
                                )
                            })}
                        </Lista>
                    )}

                    {combos.length > 0 && (
                        <p className="px-1 text-sm text-muted-foreground">
                            Toque no combo para editar. Combo pausado não aparece no cardápio.
                        </p>
                    )}
                </Pagina>

                <Gaveta
                    aberto={modalAberto}
                    aoFechar={fecharModal}
                    bloqueada={ocupado}
                    largura="lg"
                    titulo={comboEditando ? 'Editar combo' : 'Novo combo'}
                    descricao="Escolha os itens e o preço que o cliente paga."
                    rodape={
                        comboEditando ? (
                            <>
                                <Botao
                                    variante="perigoSuave"
                                    className="md:mr-auto"
                                    onClick={() => void excluirCombo(comboEditando)}
                                    disabled={ocupado}
                                >
                                    Excluir
                                </Botao>
                                <Botao
                                    variante="contorno"
                                    onClick={() => void duplicarCombo(comboEditando)}
                                    disabled={ocupado}
                                    carregando={salvando === comboEditando.id && !salvandoCombo}
                                >
                                    <Copy />
                                    Duplicar
                                </Botao>
                                <Botao carregando={salvandoCombo} disabled={ocupado} onClick={() => void salvarCombo()}>
                                    Salvar
                                </Botao>
                            </>
                        ) : (
                            <>
                                <Botao variante="contorno" onClick={fecharModal} disabled={salvandoCombo}>Cancelar</Botao>
                                <Botao carregando={salvandoCombo} onClick={() => void salvarCombo()}>Criar combo</Botao>
                            </>
                        )
                    }
                >
                    <form
                        className="space-y-5"
                        onSubmit={(evento) => {
                            evento.preventDefault()
                            void salvarCombo()
                        }}
                    >
                        <input
                            ref={inputFileRef}
                            type="file"
                            accept="image/*"
                            onChange={selecionarImagem}
                            className="hidden"
                        />

                        <div className="flex flex-col gap-4 sm:flex-row">
                            <div className="shrink-0 space-y-1.5">
                                <button
                                    type="button"
                                    onClick={() => inputFileRef.current?.click()}
                                    className="flex aspect-square w-32 items-center justify-center overflow-hidden rounded-xl border border-dashed border-border/70 bg-muted transition-colors hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                    aria-label={imagemCombo ? 'Trocar foto do combo' : 'Adicionar foto do combo'}
                                >
                                    {imagemCombo ? (
                                        <img src={imagemCombo} alt="" className="h-full w-full object-cover" />
                                    ) : (
                                        <span className="flex flex-col items-center gap-1 p-2 text-center text-[13px] text-muted-foreground">
                                            <Camera className="size-6" />
                                            Adicionar foto
                                        </span>
                                    )}
                                </button>
                                {imagemCombo && (
                                    <Botao variante="fantasma" tamanho="sm" className="w-32" onClick={() => inputFileRef.current?.click()}>
                                        Trocar foto
                                    </Botao>
                                )}
                            </div>

                            <div className="flex-1 space-y-4">
                                <Campo rotulo="Nome" htmlFor="combo-nome" erro={erros.nome}>
                                    <Entrada
                                        id="combo-nome"
                                        value={nomeCombo}
                                        onChange={(e) => setNomeCombo(e.target.value)}
                                        placeholder="Ex.: 2 X-Burguer + 2 Coca-Cola"
                                        autoComplete="off"
                                    />
                                </Campo>
                                <Campo rotulo="Preço" htmlFor="combo-preco" erro={erros.preco} ajuda="O valor que o cliente paga pelo combo.">
                                    <EntradaPreco id="combo-preco" valor={precoCombo} aoMudar={setPrecoCombo} />
                                </Campo>
                            </div>
                        </div>

                        <section className="space-y-2">
                            <div className="flex items-baseline justify-between gap-3">
                                <h3 className="text-sm font-medium text-foreground">Itens do combo</h3>
                                <span className="text-[13px] text-muted-foreground">
                                    {itensCombo.length} {itensCombo.length === 1 ? 'item' : 'itens'}
                                </span>
                            </div>

                            {itensCombo.length === 0 ? (
                                <p className="rounded-xl border border-dashed border-border/70 px-4 py-5 text-center text-sm text-muted-foreground">
                                    Adicione os produtos e bebidas que vêm no combo.
                                </p>
                            ) : (
                                <div className="space-y-2">
                                    {itensCombo.map((item, idx) => (
                                        <Cartao key={idx} className="space-y-2 p-3">
                                            <div className="flex gap-2">
                                                <div className="w-28 shrink-0">
                                                    <Selecao
                                                        value={item.tipo}
                                                        onChange={(e) => alterarTipoItem(idx, e.target.value as 'produto' | 'bebida')}
                                                        aria-label={`Tipo do item ${idx + 1}`}
                                                    >
                                                        <option value="produto">Produto</option>
                                                        <option value="bebida">Bebida</option>
                                                    </Selecao>
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <Selecao
                                                        value={item.id}
                                                        onChange={(e) => atualizarItem(idx, 'id', e.target.value)}
                                                        className="truncate"
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
                                                    </Selecao>
                                                </div>
                                            </div>
                                            <div className="flex items-center justify-between gap-2">
                                                <Contador
                                                    valor={item.quantidade}
                                                    aoMudar={(valor) => atualizarItem(idx, 'quantidade', valor)}
                                                    minimo={1}
                                                    rotuloAcessivel={`quantidade do item ${idx + 1}`}
                                                />
                                                <Botao
                                                    variante="perigoSuave"
                                                    tamanho="sm"
                                                    className="h-11"
                                                    onClick={() => removerItem(idx)}
                                                    aria-label={`Remover item ${idx + 1}`}
                                                >
                                                    <Trash2 />
                                                    Remover
                                                </Botao>
                                            </div>
                                        </Cartao>
                                    ))}
                                </div>
                            )}

                            {erros.itens && <p className="text-[13px] text-destructive" role="alert">{erros.itens}</p>}

                            <div className="grid grid-cols-2 gap-2">
                                <Botao variante="contorno" onClick={() => adicionarItem('produto')}>
                                    <UtensilsCrossed />
                                    Produto
                                </Botao>
                                <Botao variante="contorno" onClick={() => adicionarItem('bebida')}>
                                    <GlassWater />
                                    Bebida
                                </Botao>
                            </div>
                        </section>

                        <div className="space-y-3">
                            <LinhaInterruptor
                                titulo="Mostrar desconto"
                                descricao="Exibe o preço antigo riscado e o selo de economia no cardápio."
                                marcado={descontoAtivo}
                                aoMudar={(ativo) => {
                                    setDescontoAtivo(ativo)
                                    if (!ativo) setPrecoOriginal('')
                                }}
                                rotuloAcessivel="Ativar desconto"
                            />

                            {descontoAtivo && (
                                <Campo
                                    rotulo="Preço antes do desconto"
                                    htmlFor="combo-preco-original"
                                    ajuda={
                                        percentualDesconto !== null && precoOriginalNumero !== null && precoFinalNumero !== null ? (
                                            <span>
                                                Selo de <strong className="font-semibold text-primary">-{percentualDesconto}%</strong>:{' '}
                                                <span className="line-through">{formatarPreco(precoOriginalNumero)}</span> por{' '}
                                                <span className="font-medium text-foreground">{formatarPreco(precoFinalNumero)}</span>
                                            </span>
                                        ) : (
                                            'Precisa ser maior que o preço do combo para aparecer o selo.'
                                        )
                                    }
                                >
                                    <EntradaPreco id="combo-preco-original" valor={precoOriginal} aoMudar={setPrecoOriginal} />
                                </Campo>
                            )}
                        </div>

                        <Campo rotulo="Descrição" htmlFor="combo-descricao" opcional>
                            <AreaTexto
                                id="combo-descricao"
                                value={descricaoCombo}
                                onChange={(e) => setDescricaoCombo(e.target.value)}
                                placeholder="Conte o que vem no combo"
                                rows={2}
                            />
                        </Campo>

                        <div className="space-y-2">
                            <p className="text-sm font-medium text-foreground">Como aparece no cardápio</p>
                            <div className="w-40 overflow-hidden rounded-xl border border-border/70 bg-card">
                                <div className="relative aspect-[4/5] bg-muted">
                                    {imagemCombo ? (
                                        <img src={imagemCombo} alt="Prévia do combo" className="h-full w-full object-cover" />
                                    ) : (
                                        <div className="flex h-full w-full items-center justify-center">
                                            <Package className="size-8 text-muted-foreground/50" />
                                        </div>
                                    )}
                                    <span className="absolute left-2 top-2 rounded-md bg-background/90 px-2 py-0.5 text-[10px] font-semibold text-foreground">
                                        Combo
                                    </span>
                                </div>
                                <div className="space-y-2 border-t border-border/70 p-2.5">
                                    <p className="line-clamp-1 text-xs font-semibold text-foreground">
                                        {nomeCombo || 'Nome do combo'}
                                    </p>
                                    <p className="text-xs font-semibold leading-none tabular-nums text-foreground">
                                        {formatarPreco(precoFinalNumero ?? 0)}
                                    </p>
                                    <div className="rounded-md bg-primary px-2 py-1.5 text-center text-[11px] font-semibold text-primary-foreground">
                                        + Adicionar
                                    </div>
                                </div>
                            </div>
                        </div>

                        <button type="submit" className="hidden" aria-hidden tabIndex={-1} />
                    </form>
                </Gaveta>

                <ModalRecorteImagem
                    aberto={recorteAberto}
                    imagemUrl={imagemParaRecorte}
                    onConfirmar={confirmarRecorte}
                    onFechar={() => setRecorteAberto(false)}
                />
            </AdminLayout>
        </ProtectedRoute>
    )
}
