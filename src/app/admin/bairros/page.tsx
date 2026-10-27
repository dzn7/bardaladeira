'use client'

import { useEffect, useMemo, useState } from 'react'
import { MagnifyingGlass, MapPin, Plus } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import AdminLayout from '@/components/admin/AdminLayout'
import {
  Botao,
  CabecalhoPagina,
  Campo,
  Entrada,
  EntradaPreco,
  Gaveta,
  Interruptor,
  LinhaInterruptor,
  Lista,
  ListaCarregando,
  ListaVazia,
  Pagina,
  Selo,
  formatarPreco,
  lerPreco,
  useConfirmar,
} from '@/components/admin/ui'
import { cn } from '@/lib/utils'

type Bairro = {
  id: string
  nome: string
  taxa_entrega: number
  ativo: boolean
  entrega_gratis: boolean
  ordem: number
  created_at: string
}

const normalizar = (texto: string) =>
  texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

export default function BairrosPage() {
  const [bairros, setBairros] = useState<Bairro[]>([])
  const [carregando, setCarregando] = useState(true)
  const [busca, setBusca] = useState('')
  const [gaveta, setGaveta] = useState<{ bairro: Bairro | null } | null>(null)

  useEffect(() => {
    void carregarBairros()

    const channel = supabase
      .channel('bairros-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'bairros' },
        () => {
          void carregarBairros()
        },
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [])

  async function carregarBairros() {
    try {
      const { data, error } = await supabase
        .from('bairros')
        .select('*')
        .order('ordem', { ascending: true })
        .order('nome', { ascending: true })

      if (error) throw error
      setBairros(
        (data || []).map((bairro) => ({
          ...bairro,
          entrega_gratis: Boolean(bairro.entrega_gratis),
          ativo: bairro.ativo !== false,
        })),
      )
    } catch (error) {
      console.error('Erro ao carregar bairros:', error)
      toast.error('Não foi possível carregar os bairros.')
    } finally {
      setCarregando(false)
    }
  }

  async function alternarAtivo(bairro: Bairro) {
    setBairros((atual) => atual.map((item) => (item.id === bairro.id ? { ...item, ativo: !bairro.ativo } : item)))
    const { error } = await supabase.from('bairros').update({ ativo: !bairro.ativo }).eq('id', bairro.id)
    if (error) {
      console.error('Erro ao alternar status:', error)
      setBairros((atual) => atual.map((item) => (item.id === bairro.id ? { ...item, ativo: bairro.ativo } : item)))
      toast.error('Não foi possível alterar o bairro.', { description: bairro.nome })
      return
    }
    toast.success(bairro.ativo ? 'Bairro pausado no checkout' : 'Bairro voltou ao checkout', { description: bairro.nome })
  }

  const filtrados = useMemo(() => {
    const termo = normalizar(busca)
    return termo ? bairros.filter((bairro) => normalizar(bairro.nome).includes(termo)) : bairros
  }, [bairros, busca])

  const ativos = bairros.filter((bairro) => bairro.ativo).length

  return (
    <AdminLayout>
      <Pagina>
        <CabecalhoPagina
          titulo="Bairros"
          descricao={`${bairros.length} cadastrados · ${ativos} no checkout`}
          acoes={
            <Botao onClick={() => setGaveta({ bairro: null })}>
              <Plus className="size-4" />
              Novo bairro
            </Botao>
          }
        />

        {bairros.length > 0 ? (
          <div className="relative">
            <MagnifyingGlass className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Entrada
              type="search"
              value={busca}
              onChange={(evento) => setBusca(evento.target.value)}
              placeholder="Buscar bairro"
              aria-label="Buscar bairro"
              className="pl-9"
            />
          </div>
        ) : null}

        {carregando ? (
          <ListaCarregando linhas={5} />
        ) : bairros.length === 0 ? (
          <ListaVazia
            icone={<MapPin />}
            titulo="Nenhum bairro cadastrado"
            descricao="Cadastre os bairros atendidos e a taxa de entrega de cada um."
            acao={
              <Botao onClick={() => setGaveta({ bairro: null })}>
                <Plus className="size-4" />
                Novo bairro
              </Botao>
            }
          />
        ) : filtrados.length === 0 ? (
          <ListaVazia
            icone={<MagnifyingGlass />}
            titulo="Nenhum bairro encontrado"
            descricao="Tente outro nome."
            acao={<Botao variante="contorno" onClick={() => setBusca('')}>Limpar busca</Botao>}
          />
        ) : (
          <Lista>
            {filtrados.map((bairro) => (
              <li key={bairro.id}>
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => setGaveta({ bairro })}
                  onKeyDown={(evento) => {
                    if (evento.key === 'Enter') setGaveta({ bairro })
                  }}
                  className={cn(
                    'flex min-h-16 cursor-pointer items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
                    !bairro.ativo && 'opacity-60',
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-foreground">{bairro.nome}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      {bairro.entrega_gratis ? (
                        <Selo tom="primario">Entrega grátis</Selo>
                      ) : (
                        <span className="text-sm tabular-nums text-muted-foreground">{formatarPreco(bairro.taxa_entrega)}</span>
                      )}
                      {!bairro.ativo ? <Selo>Pausado</Selo> : null}
                    </div>
                  </div>
                  <Interruptor
                    marcado={bairro.ativo}
                    aoMudar={() => void alternarAtivo(bairro)}
                    rotuloAcessivel={`${bairro.ativo ? 'Pausar' : 'Ativar'} ${bairro.nome} no checkout`}
                  />
                </div>
              </li>
            ))}
          </Lista>
        )}

        <p className="px-1 text-sm text-muted-foreground">
          Bairro pausado não aparece no checkout. Entrega grátis zera a taxa para o cliente.
        </p>
      </Pagina>

      <GavetaBairro
        aberto={gaveta !== null}
        bairro={gaveta?.bairro ?? null}
        proximaOrdem={bairros.length + 1}
        aoFechar={() => setGaveta(null)}
      />
    </AdminLayout>
  )
}

type GavetaBairroProps = {
  aberto: boolean
  bairro: Bairro | null
  proximaOrdem: number
  aoFechar: () => void
}

function GavetaBairro({ aberto, bairro, proximaOrdem, aoFechar }: GavetaBairroProps) {
  const confirmar = useConfirmar()
  const [nome, setNome] = useState('')
  const [taxa, setTaxa] = useState('')
  const [entregaGratis, setEntregaGratis] = useState(false)
  const [erros, setErros] = useState<{ nome?: string; taxa?: string }>({})
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    if (!aberto) return
    setNome(bairro?.nome ?? '')
    setTaxa(bairro ? String(bairro.taxa_entrega).replace('.', ',') : '')
    setEntregaGratis(bairro?.entrega_gratis ?? false)
    setErros({})
  }, [aberto, bairro])

  async function salvar() {
    const taxaNumero = lerPreco(taxa)
    const proximosErros: typeof erros = {}
    if (!nome.trim()) proximosErros.nome = 'Informe o nome do bairro.'
    if (taxaNumero === null) proximosErros.taxa = 'Informe a taxa. Use 0 se não cobrar.'
    setErros(proximosErros)
    if (Object.keys(proximosErros).length > 0 || taxaNumero === null) return

    setSalvando(true)
    const dados = { nome: nome.trim(), taxa_entrega: taxaNumero, entrega_gratis: entregaGratis }
    const { error } = bairro
      ? await supabase.from('bairros').update(dados).eq('id', bairro.id)
      : await supabase.from('bairros').insert({ ...dados, ativo: true, ordem: proximaOrdem })
    setSalvando(false)

    if (error) {
      console.error('Erro ao salvar bairro:', error)
      toast.error(bairro ? 'Não foi possível salvar o bairro.' : 'Não foi possível criar o bairro.', {
        description: 'Confira se já existe um bairro com esse nome.',
      })
      return
    }
    toast.success(bairro ? 'Bairro salvo' : 'Bairro criado', { description: dados.nome })
    aoFechar()
  }

  async function excluir() {
    if (!bairro) return
    const ok = await confirmar({
      titulo: `Excluir "${bairro.nome}"?`,
      descricao: 'O bairro some do checkout. Não dá para desfazer.',
      confirmar: 'Excluir bairro',
      perigo: true,
    })
    if (!ok) return
    setSalvando(true)
    const { error } = await supabase.from('bairros').delete().eq('id', bairro.id)
    setSalvando(false)
    if (error) {
      console.error('Erro ao excluir bairro:', error)
      toast.error('Não foi possível excluir o bairro.', { description: 'Pause o bairro para tirá-lo do checkout.' })
      return
    }
    toast.success('Bairro excluído', { description: bairro.nome })
    aoFechar()
  }

  return (
    <Gaveta
      aberto={aberto}
      aoFechar={aoFechar}
      bloqueada={salvando}
      titulo={bairro ? 'Editar bairro' : 'Novo bairro'}
      descricao="Nome e taxa que o cliente vê no checkout."
      rodape={
        bairro ? (
          <>
            <Botao variante="perigoSuave" className="md:mr-auto" onClick={() => void excluir()} disabled={salvando}>
              Excluir
            </Botao>
            <Botao carregando={salvando} onClick={() => void salvar()}>Salvar</Botao>
          </>
        ) : (
          <>
            <Botao variante="contorno" onClick={aoFechar} disabled={salvando}>Cancelar</Botao>
            <Botao carregando={salvando} onClick={() => void salvar()}>Criar bairro</Botao>
          </>
        )
      }
    >
      <form
        className="space-y-4"
        onSubmit={(evento) => {
          evento.preventDefault()
          void salvar()
        }}
      >
        <Campo rotulo="Nome" htmlFor="bairro-nome" erro={erros.nome}>
          <Entrada
            id="bairro-nome"
            value={nome}
            onChange={(evento) => setNome(evento.target.value)}
            placeholder="Ex.: Centro"
            autoComplete="off"
          />
        </Campo>
        <Campo rotulo="Taxa de entrega" htmlFor="bairro-taxa" erro={erros.taxa}>
          <EntradaPreco id="bairro-taxa" valor={taxa} aoMudar={setTaxa} />
        </Campo>
        <LinhaInterruptor
          titulo="Entrega grátis"
          descricao="Zera a taxa deste bairro para o cliente."
          marcado={entregaGratis}
          aoMudar={setEntregaGratis}
          rotuloAcessivel="Entrega grátis"
        />
        <button type="submit" className="hidden" aria-hidden tabIndex={-1} />
      </form>
    </Gaveta>
  )
}
