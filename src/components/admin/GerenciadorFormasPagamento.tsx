'use client'

import { useEffect, useMemo, useState } from 'react'
import { Money as Banknote, CreditCard, Plus, QrCode, ArrowsClockwise as RefreshCw } from '@phosphor-icons/react'
import { toast } from 'sonner'
import {
  Botao,
  CabecalhoPagina,
  Campo,
  Chip,
  Entrada,
  Gaveta,
  Interruptor,
  LinhaInterruptor,
  Lista,
  ListaCarregando,
  ListaVazia,
  Pagina,
  Segmentos,
  Selo,
  useConfirmar,
} from '@/components/admin/ui'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'

type TipoTaxaPagamento = 'nenhuma' | 'percentual' | 'fixa'

type FormaPagamentoBanco = {
  id: string
  codigo: string
  nome: string
  descricao: string | null
  tipo_taxa: TipoTaxaPagamento
  valor_taxa: number
  ativo: boolean
  visivel_cliente: boolean
  aceita_troco: boolean
  ordem: number
}

type FormaPagamento = Omit<FormaPagamentoBanco, 'descricao' | 'valor_taxa' | 'ordem'> & {
  descricao: string
  valor_taxa: string
  ordem: string
}

type NovaFormaPagamento = Omit<FormaPagamento, 'id'>

const FORMAS_PADRAO: NovaFormaPagamento[] = [
  {
    codigo: 'pix_online',
    nome: 'PIX Online',
    descricao: 'Confirmação automática',
    tipo_taxa: 'nenhuma',
    valor_taxa: '0',
    ativo: true,
    visivel_cliente: true,
    aceita_troco: false,
    ordem: '1',
  },
  {
    codigo: 'pix',
    nome: 'PIX',
    descricao: 'Pagamento via chave PIX',
    tipo_taxa: 'nenhuma',
    valor_taxa: '0',
    ativo: true,
    visivel_cliente: true,
    aceita_troco: false,
    ordem: '2',
  },
  {
    codigo: 'dinheiro',
    nome: 'Dinheiro',
    descricao: 'Pagamento no recebimento',
    tipo_taxa: 'nenhuma',
    valor_taxa: '0',
    ativo: true,
    visivel_cliente: true,
    aceita_troco: true,
    ordem: '3',
  },
  {
    codigo: 'cartao',
    nome: 'Cartão',
    descricao: 'Cartão na entrega',
    tipo_taxa: 'nenhuma',
    valor_taxa: '0',
    ativo: true,
    visivel_cliente: true,
    aceita_troco: false,
    ordem: '4',
  },
  {
    codigo: 'credito',
    nome: 'Cartão de Crédito',
    descricao: 'Crédito',
    tipo_taxa: 'nenhuma',
    valor_taxa: '0',
    ativo: true,
    visivel_cliente: true,
    aceita_troco: false,
    ordem: '5',
  },
  {
    codigo: 'debito',
    nome: 'Cartão de Débito',
    descricao: 'Débito',
    tipo_taxa: 'nenhuma',
    valor_taxa: '0',
    ativo: true,
    visivel_cliente: true,
    aceita_troco: false,
    ordem: '6',
  },
]

const NOVA_FORMA_INICIAL: NovaFormaPagamento = {
  nome: '',
  codigo: '',
  descricao: '',
  tipo_taxa: 'nenhuma',
  valor_taxa: '0',
  ativo: true,
  visivel_cliente: true,
  aceita_troco: false,
  ordem: '',
}

const MODELOS_RAPIDOS = [
  { nome: 'PIX', codigo: 'pix', icone: QrCode },
  { nome: 'Dinheiro', codigo: 'dinheiro', icone: Banknote },
  { nome: 'Cartão', codigo: 'cartao', icone: CreditCard },
]

const TIPOS_TAXA: Array<{ valor: TipoTaxaPagamento; rotulo: string }> = [
  { valor: 'nenhuma', rotulo: 'Sem taxa' },
  { valor: 'percentual', rotulo: 'Percentual (%)' },
  { valor: 'fixa', rotulo: 'Valor fixo (R$)' },
]

const descreverTaxa = (forma: FormaPagamento) => {
  if (forma.tipo_taxa === 'nenhuma') return null
  const valor = paraNumeroNaoNegativo(String(forma.valor_taxa).replace(',', '.'))
  if (valor === 0) return null
  return forma.tipo_taxa === 'percentual'
    ? `Taxa ${valor.toLocaleString('pt-BR')}%`
    : `Taxa ${valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`
}

const normalizarCodigo = (valor: string) => {
  return valor
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

const paraNumeroNaoNegativo = (valor: unknown) => {
  const numero = Number(valor)
  if (!Number.isFinite(numero) || numero < 0) return 0
  return numero
}

const paraFormaEditavel = (forma: FormaPagamentoBanco): FormaPagamento => ({
  ...forma,
  descricao: forma.descricao || '',
  valor_taxa: String(paraNumeroNaoNegativo(forma.valor_taxa)),
  ordem: String(Math.max(0, Math.round(Number(forma.ordem) || 0))),
})

const paraPayloadBanco = (forma: NovaFormaPagamento | FormaPagamento) => ({
  nome: forma.nome.trim(),
  codigo: normalizarCodigo(forma.codigo || forma.nome),
  descricao: forma.descricao.trim() || null,
  tipo_taxa: forma.tipo_taxa,
  valor_taxa: paraNumeroNaoNegativo(forma.valor_taxa),
  ativo: !!forma.ativo,
  visivel_cliente: !!forma.visivel_cliente,
  aceita_troco: !!forma.aceita_troco,
  ordem: Math.max(0, Math.round(Number(forma.ordem) || 0)),
})

const obterIconeFormaPagamento = (codigo: string) => {
  const normalizado = codigo.toLowerCase()
  if (normalizado.includes('pix')) return QrCode
  if (normalizado.includes('dinheiro')) return Banknote
  return CreditCard
}

export default function GerenciadorFormasPagamento() {
  const [formas, setFormas] = useState<FormaPagamento[]>([])
  const [carregando, setCarregando] = useState(true)
  const [restaurando, setRestaurando] = useState(false)
  const [gaveta, setGaveta] = useState<{ forma: FormaPagamento | null } | null>(null)

  const carregarFormasPagamento = async () => {
    try {
      setCarregando(true)
      const { data, error } = await supabase
        .from('formas_pagamento')
        .select('id, codigo, nome, descricao, tipo_taxa, valor_taxa, ativo, visivel_cliente, aceita_troco, ordem')
        .order('ordem', { ascending: true })
        .order('nome', { ascending: true })

      if (error) throw error

      setFormas(((data || []) as FormaPagamentoBanco[]).map(paraFormaEditavel))
    } catch (error) {
      console.error('[FormasPagamento] Erro ao carregar:', error)
      toast.error('Não foi possível carregar as formas de pagamento')
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => {
    void carregarFormasPagamento()

    const canal = supabase
      .channel('admin-formas-pagamento')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'formas_pagamento' }, () => {
        void carregarFormasPagamento()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(canal)
    }
  }, [])

  const proximaOrdem = useMemo(() => {
    if (formas.length === 0) return 1
    return Math.max(...formas.map((forma) => Number(forma.ordem) || 0)) + 1
  }, [formas])

  const resumo = useMemo(() => {
    return {
      total: formas.length,
      ativas: formas.filter((forma) => forma.ativo).length,
      cliente: formas.filter((forma) => forma.ativo && forma.visivel_cliente).length,
    }
  }, [formas])

  const alternarAtivo = async (forma: FormaPagamento) => {
    setFormas((prev) => prev.map((item) => (item.id === forma.id ? { ...item, ativo: !forma.ativo } : item)))
    const { error } = await supabase.from('formas_pagamento').update({ ativo: !forma.ativo }).eq('id', forma.id)
    if (error) {
      console.error('[FormasPagamento] Erro ao alternar:', error)
      setFormas((prev) => prev.map((item) => (item.id === forma.id ? { ...item, ativo: forma.ativo } : item)))
      toast.error('Não foi possível alterar', { description: forma.nome })
      return
    }
    toast.success(forma.ativo ? 'Forma desativada' : 'Forma ativada', { description: forma.nome })
  }

  const restaurarPadroes = async () => {
    setRestaurando(true)
    try {
      const payload = FORMAS_PADRAO.map(paraPayloadBanco)
      const { error } = await supabase
        .from('formas_pagamento')
        .upsert(payload, { onConflict: 'codigo', ignoreDuplicates: true })

      if (error) throw error

      toast.success('Formas padrão restauradas')
      void carregarFormasPagamento()
    } catch (error) {
      console.error('[FormasPagamento] Erro ao restaurar padrões:', error)
      toast.error('Não foi possível restaurar os padrões')
    } finally {
      setRestaurando(false)
    }
  }

  return (
    <Pagina>
      <CabecalhoPagina
        titulo="Formas de pagamento"
        descricao={`${resumo.ativas} ativas · ${resumo.cliente} aparecem para o cliente`}
        acoes={
          <>
            <Botao variante="contorno" carregando={restaurando} onClick={() => void restaurarPadroes()}>
              {!restaurando && <RefreshCw />}
              Restaurar padrões
            </Botao>
            <Botao onClick={() => setGaveta({ forma: null })}>
              <Plus />
              Nova forma
            </Botao>
          </>
        }
      />

      {carregando && formas.length === 0 ? (
        <ListaCarregando linhas={4} />
      ) : formas.length === 0 ? (
        <ListaVazia
          icone={<CreditCard />}
          titulo="Nenhuma forma de pagamento"
          descricao="Restaure as formas padrão (PIX, dinheiro e cartão) ou cadastre uma nova."
          acao={
            <Botao carregando={restaurando} onClick={() => void restaurarPadroes()}>
              Restaurar padrões
            </Botao>
          }
        />
      ) : (
        <Lista>
          {formas.map((forma) => {
            const IconeForma = obterIconeFormaPagamento(forma.codigo)
            const taxa = descreverTaxa(forma)
            return (
              <li key={forma.id}>
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => setGaveta({ forma })}
                  onKeyDown={(evento) => {
                    if (evento.key === 'Enter') setGaveta({ forma })
                  }}
                  className={cn(
                    'flex min-h-16 cursor-pointer items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
                    !forma.ativo && 'opacity-60',
                  )}
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                    <IconeForma className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-foreground">{forma.nome || 'Sem nome'}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[13px] text-muted-foreground">
                      {forma.descricao && <span className="truncate">{forma.descricao}</span>}
                      {taxa && <Selo>{taxa}</Selo>}
                      {forma.aceita_troco && <Selo>Troco</Selo>}
                      {!forma.visivel_cliente && <Selo>Só no balcão</Selo>}
                    </div>
                  </div>
                  <Interruptor
                    marcado={forma.ativo}
                    aoMudar={() => void alternarAtivo(forma)}
                    rotuloAcessivel={`${forma.ativo ? 'Desativar' : 'Ativar'} ${forma.nome}`}
                  />
                </div>
              </li>
            )
          })}
        </Lista>
      )}

      <p className="px-1 text-sm text-muted-foreground">
        Forma desativada não aparece em lugar nenhum. &quot;Só no balcão&quot; esconde do cardápio do cliente.
      </p>

      <GavetaFormaPagamento
        aberto={gaveta !== null}
        forma={gaveta?.forma ?? null}
        proximaOrdem={proximaOrdem}
        aoFechar={() => setGaveta(null)}
        aoSalvar={() => void carregarFormasPagamento()}
      />
    </Pagina>
  )
}

type GavetaFormaPagamentoProps = {
  aberto: boolean
  forma: FormaPagamento | null
  proximaOrdem: number
  aoFechar: () => void
  aoSalvar: () => void
}

function GavetaFormaPagamento({ aberto, forma, proximaOrdem, aoFechar, aoSalvar }: GavetaFormaPagamentoProps) {
  const confirmar = useConfirmar()
  const [dados, setDados] = useState<NovaFormaPagamento>(NOVA_FORMA_INICIAL)
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    if (!aberto) return
    if (forma) {
      const { id: _id, ...resto } = forma
      setDados(resto)
    } else {
      setDados({ ...NOVA_FORMA_INICIAL, ordem: String(proximaOrdem) })
    }
    // proximaOrdem muda com o realtime; só reinicia ao abrir.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto, forma])

  const atualizar = <K extends keyof NovaFormaPagamento>(campo: K, valor: NovaFormaPagamento[K]) => {
    setDados((prev) => ({ ...prev, [campo]: valor }))
  }

  const adicionarModeloRapido = (nome: string, codigo: string) => {
    setDados((prev) => ({
      ...prev,
      nome,
      codigo,
      descricao: '',
      tipo_taxa: 'nenhuma',
      valor_taxa: '0',
      ativo: true,
      visivel_cliente: true,
      aceita_troco: codigo === 'dinheiro',
      ordem: prev.ordem || String(proximaOrdem),
    }))
  }

  const salvar = async () => {
    const payload = paraPayloadBanco({ ...dados, ordem: dados.ordem || String(proximaOrdem) })
    if (!payload.nome || !payload.codigo) {
      toast.error(forma ? 'Nome e código são obrigatórios' : 'Informe nome e código')
      return
    }

    setSalvando(true)
    try {
      const { error } = forma
        ? await supabase.from('formas_pagamento').update(payload).eq('id', forma.id)
        : await supabase.from('formas_pagamento').insert(payload)
      if (error) throw error
      toast.success(forma ? 'Forma atualizada' : 'Forma criada', { description: payload.nome })
      aoSalvar()
      aoFechar()
    } catch (error) {
      console.error(forma ? '[FormasPagamento] Erro ao salvar:' : '[FormasPagamento] Erro ao criar:', error)
      toast.error(forma ? 'Não foi possível salvar' : 'Não foi possível criar', {
        description: 'Confira se já existe uma forma com esse código.',
      })
    } finally {
      setSalvando(false)
    }
  }

  const excluir = async () => {
    if (!forma) return
    const ok = await confirmar({
      titulo: `Excluir "${forma.nome}"?`,
      descricao: 'A forma some do caixa e do checkout. Não dá para desfazer.',
      confirmar: 'Excluir forma',
      perigo: true,
    })
    if (!ok) return
    setSalvando(true)
    try {
      const { error } = await supabase.from('formas_pagamento').delete().eq('id', forma.id)
      if (error) throw error
      toast.success('Forma excluída', { description: forma.nome })
      aoSalvar()
      aoFechar()
    } catch (error) {
      console.error('[FormasPagamento] Erro ao excluir:', error)
      toast.error('Não foi possível excluir', { description: 'Desative a forma para tirá-la de uso.' })
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Gaveta
      aberto={aberto}
      aoFechar={aoFechar}
      bloqueada={salvando}
      titulo={forma ? 'Editar forma de pagamento' : 'Nova forma de pagamento'}
      descricao="Como o cliente e o caixa podem pagar."
      rodape={
        forma ? (
          <>
            <Botao variante="perigoSuave" className="md:mr-auto" onClick={() => void excluir()} disabled={salvando}>
              Excluir
            </Botao>
            <Botao carregando={salvando} onClick={() => void salvar()}>
              Salvar
            </Botao>
          </>
        ) : (
          <>
            <Botao variante="contorno" onClick={aoFechar} disabled={salvando}>
              Cancelar
            </Botao>
            <Botao carregando={salvando} onClick={() => void salvar()}>
              Criar forma
            </Botao>
          </>
        )
      }
    >
      <form
        className="space-y-5"
        onSubmit={(evento) => {
          evento.preventDefault()
          void salvar()
        }}
      >
        {!forma && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-foreground">Começar de um modelo</p>
            <div className="flex flex-wrap gap-2">
              {MODELOS_RAPIDOS.map((modelo) => {
                const Icone = modelo.icone
                return (
                  <Chip
                    key={modelo.codigo}
                    ativo={dados.codigo === modelo.codigo}
                    className="h-10"
                    onClick={() => adicionarModeloRapido(modelo.nome, modelo.codigo)}
                  >
                    <Icone className="size-4" />
                    {modelo.nome}
                  </Chip>
                )
              })}
            </div>
          </div>
        )}

        <Campo rotulo="Nome" htmlFor="nova-forma-nome">
          <Entrada
            id="nova-forma-nome"
            value={dados.nome}
            onChange={(event) => atualizar('nome', event.target.value)}
            placeholder="Ex.: PIX"
            autoComplete="off"
          />
        </Campo>

        <Campo rotulo="Descrição" htmlFor="nova-forma-descricao" opcional>
          <Entrada
            id="nova-forma-descricao"
            value={dados.descricao}
            onChange={(event) => atualizar('descricao', event.target.value)}
            placeholder="Ex.: Pagamento na entrega"
          />
        </Campo>

        <Campo rotulo="Taxa">
          <Segmentos
            opcoes={TIPOS_TAXA}
            valor={dados.tipo_taxa}
            aoMudar={(valor) => atualizar('tipo_taxa', valor)}
            rotuloAcessivel="Tipo de taxa"
          />
        </Campo>

        {dados.tipo_taxa !== 'nenhuma' && (
          <Campo
            rotulo={dados.tipo_taxa === 'percentual' ? 'Percentual da taxa' : 'Valor da taxa'}
            htmlFor="nova-forma-valor"
          >
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                {dados.tipo_taxa === 'percentual' ? '%' : 'R$'}
              </span>
              <Entrada
                id="nova-forma-valor"
                type="number"
                inputMode="decimal"
                min={0}
                step="0.01"
                value={dados.valor_taxa}
                onChange={(event) => atualizar('valor_taxa', event.target.value)}
                onFocus={(event) => event.currentTarget.select()}
                className="pl-10 font-mono tabular-nums"
              />
            </div>
          </Campo>
        )}

        <div className="space-y-2">
          <LinhaInterruptor
            titulo="Ativa"
            descricao="Desligada, não aparece em lugar nenhum."
            marcado={dados.ativo}
            aoMudar={(valor) => atualizar('ativo', valor)}
          />
          <LinhaInterruptor
            titulo="Aparece para o cliente"
            descricao="Mostra no checkout do cardápio online."
            marcado={dados.visivel_cliente}
            aoMudar={(valor) => atualizar('visivel_cliente', valor)}
          />
          <LinhaInterruptor
            titulo="Aceita troco"
            descricao="Pergunta ao cliente se precisa de troco."
            marcado={dados.aceita_troco}
            aoMudar={(valor) => atualizar('aceita_troco', valor)}
          />
        </div>

        <details className="group rounded-xl border border-border/70">
          <summary className="flex min-h-11 cursor-pointer list-none items-center px-4 text-sm font-medium text-foreground [&::-webkit-details-marker]:hidden">
            Mais opções
          </summary>
          <div className="grid gap-4 border-t border-border/70 p-4 sm:grid-cols-2">
            <Campo rotulo="Código" htmlFor="nova-forma-codigo" ajuda="Usado pelo sistema. Sem espaços.">
              <Entrada
                id="nova-forma-codigo"
                value={dados.codigo}
                onChange={(event) => atualizar('codigo', normalizarCodigo(event.target.value))}
                placeholder="pix"
                className="font-mono"
              />
            </Campo>
            <Campo rotulo="Ordem" htmlFor="nova-forma-ordem" ajuda="Menor aparece primeiro.">
              <Entrada
                id="nova-forma-ordem"
                type="number"
                inputMode="numeric"
                min={0}
                step="1"
                value={dados.ordem}
                onChange={(event) => atualizar('ordem', event.target.value)}
                onFocus={(event) => event.currentTarget.select()}
                placeholder={String(proximaOrdem)}
                className="font-mono"
              />
            </Campo>
          </div>
        </details>
        <button type="submit" className="hidden" aria-hidden tabIndex={-1} />
      </form>
    </Gaveta>
  )
}
