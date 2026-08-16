'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  Banknote,
  Check,
  CreditCard,
  Eye,
  EyeOff,
  Loader2,
  Plus,
  QrCode,
  RefreshCw,
  Save,
  Trash2,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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

const TIPOS_TAXA: Array<{ valor: TipoTaxaPagamento; label: string }> = [
  { valor: 'nenhuma', label: 'Sem taxa' },
  { valor: 'percentual', label: 'Percentual' },
  { valor: 'fixa', label: 'Valor fixo' },
]

const CAMPO_COMPACTO = 'h-8 rounded-md px-2 text-xs'

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

const TogglePill = ({
  pressed,
  onClick,
  children,
}: {
  pressed: boolean
  onClick: () => void
  children: React.ReactNode
}) => (
  <Button
    type="button"
    variant={pressed ? 'default' : 'outline'}
    size="sm"
    aria-pressed={pressed}
    onClick={onClick}
    className={cn('gap-1.5', pressed && 'shadow-none')}
  >
    {pressed && <Check className="h-3.5 w-3.5" />}
    {children}
  </Button>
)

export default function GerenciadorFormasPagamento() {
  const [formas, setFormas] = useState<FormaPagamento[]>([])
  const [carregando, setCarregando] = useState(true)
  const [salvandoId, setSalvandoId] = useState<string | null>(null)
  const [criando, setCriando] = useState(false)
  const [restaurando, setRestaurando] = useState(false)
  const [excluindoId, setExcluindoId] = useState<string | null>(null)
  const [confirmandoExclusaoId, setConfirmandoExclusaoId] = useState<string | null>(null)
  const [novaForma, setNovaForma] = useState<NovaFormaPagamento>(NOVA_FORMA_INICIAL)

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

  const atualizarFormaLocal = <K extends keyof FormaPagamento>(id: string, campo: K, valor: FormaPagamento[K]) => {
    setFormas((prev) => prev.map((forma) => (forma.id === id ? { ...forma, [campo]: valor } : forma)))
  }

  const atualizarNovaForma = <K extends keyof NovaFormaPagamento>(campo: K, valor: NovaFormaPagamento[K]) => {
    setNovaForma((prev) => ({ ...prev, [campo]: valor }))
  }

  const salvarForma = async (id: string) => {
    const forma = formas.find((item) => item.id === id)
    if (!forma) return

    const payload = paraPayloadBanco(forma)
    if (!payload.nome || !payload.codigo) {
      toast.error('Nome e código são obrigatórios')
      return
    }

    setSalvandoId(id)
    try {
      const { error } = await supabase.from('formas_pagamento').update(payload).eq('id', id)
      if (error) throw error
      toast.success('Forma atualizada')
    } catch (error) {
      console.error('[FormasPagamento] Erro ao salvar:', error)
      toast.error('Não foi possível salvar')
    } finally {
      setSalvandoId(null)
    }
  }

  const criarForma = async () => {
    const payload = paraPayloadBanco({
      ...novaForma,
      ordem: novaForma.ordem || String(proximaOrdem),
    })

    if (!payload.nome || !payload.codigo) {
      toast.error('Informe nome e código')
      return
    }

    setCriando(true)
    try {
      const { error } = await supabase.from('formas_pagamento').insert(payload)
      if (error) throw error

      setNovaForma({ ...NOVA_FORMA_INICIAL, ordem: String(proximaOrdem + 1) })
      toast.success('Forma criada')
      void carregarFormasPagamento()
    } catch (error) {
      console.error('[FormasPagamento] Erro ao criar:', error)
      toast.error('Não foi possível criar')
    } finally {
      setCriando(false)
    }
  }

  const excluirForma = async (forma: FormaPagamento) => {
    setExcluindoId(forma.id)
    try {
      const { error } = await supabase.from('formas_pagamento').delete().eq('id', forma.id)
      if (error) throw error

      setConfirmandoExclusaoId(null)
      toast.success('Forma excluída')
      void carregarFormasPagamento()
    } catch (error) {
      console.error('[FormasPagamento] Erro ao excluir:', error)
      toast.error('Não foi possível excluir')
    } finally {
      setExcluindoId(null)
    }
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

  const adicionarModeloRapido = (nome: string, codigo: string) => {
    setNovaForma((prev) => ({
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

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 border-b border-border/70 pb-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">Formas de Pagamento</h1>
          <p className="text-sm text-muted-foreground">Ativação, taxas e checkout.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void carregarFormasPagamento()}
            className="h-9 rounded-md"
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Atualizar
          </Button>
          <Button
            type="button"
            variant="default"
            size="sm"
            onClick={() => void restaurarPadroes()}
            disabled={restaurando}
            className="h-9 rounded-md shadow-none"
          >
            {restaurando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
            Restaurar padrões
          </Button>
        </div>
      </div>

      <div className="grid gap-2 md:grid-cols-3">
        <Card className="border-border/70 shadow-none">
          <CardContent className="flex items-center justify-between p-3">
            <p className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">Cadastradas</p>
            <p className="font-mono text-xl font-semibold tabular-nums">{resumo.total}</p>
          </CardContent>
        </Card>
        <Card className="border-border/70 shadow-none">
          <CardContent className="flex items-center justify-between p-3">
            <p className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">Ativas</p>
            <p className="font-mono text-xl font-semibold tabular-nums">{resumo.ativas}</p>
          </CardContent>
        </Card>
        <Card className="border-border/70 shadow-none">
          <CardContent className="flex items-center justify-between p-3">
            <p className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">No cliente</p>
            <p className="font-mono text-xl font-semibold tabular-nums">{resumo.cliente}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/70 shadow-none">
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-base">Adicionar forma</CardTitle>
          <CardDescription>Use um modelo ou preencha manualmente.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 p-4 pt-0">
          <div className="flex flex-wrap gap-2">
            {MODELOS_RAPIDOS.map((modelo) => {
              const Icone = modelo.icone
              return (
                <Button
                  key={modelo.codigo}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => adicionarModeloRapido(modelo.nome, modelo.codigo)}
                  className="h-8 rounded-md"
                >
                  <Icone className="mr-2 h-4 w-4" />
                  {modelo.nome}
                </Button>
              )
            })}
          </div>

          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1.5">
              <Label htmlFor="nova-forma-nome">Nome</Label>
              <Input
                id="nova-forma-nome"
                value={novaForma.nome}
                onChange={(event) => atualizarNovaForma('nome', event.target.value)}
                placeholder="Ex.: PIX"
                className={CAMPO_COMPACTO}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nova-forma-codigo">Código</Label>
              <Input
                id="nova-forma-codigo"
                value={novaForma.codigo}
                onChange={(event) => atualizarNovaForma('codigo', normalizarCodigo(event.target.value))}
                placeholder="pix"
                className={cn(CAMPO_COMPACTO, 'font-mono')}
              />
            </div>
            <div className="space-y-1.5 lg:col-span-2">
              <Label htmlFor="nova-forma-descricao">Descrição</Label>
              <Input
                id="nova-forma-descricao"
                value={novaForma.descricao}
                onChange={(event) => atualizarNovaForma('descricao', event.target.value)}
                placeholder="Opcional"
                className={CAMPO_COMPACTO}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nova-forma-valor">Valor da taxa</Label>
              <Input
                id="nova-forma-valor"
                type="number"
                min={0}
                step="0.01"
                value={novaForma.valor_taxa}
                onChange={(event) => atualizarNovaForma('valor_taxa', event.target.value)}
                onFocus={(event) => event.currentTarget.select()}
                className={CAMPO_COMPACTO}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nova-forma-ordem">Ordem</Label>
              <Input
                id="nova-forma-ordem"
                type="number"
                min={0}
                step="1"
                value={novaForma.ordem}
                onChange={(event) => atualizarNovaForma('ordem', event.target.value)}
                onFocus={(event) => event.currentTarget.select()}
                placeholder={String(proximaOrdem)}
                className={CAMPO_COMPACTO}
              />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label>Tipo de taxa</Label>
              <div className="flex flex-wrap gap-2">
                {TIPOS_TAXA.map((tipo) => (
                  <TogglePill
                    key={tipo.valor}
                    pressed={novaForma.tipo_taxa === tipo.valor}
                    onClick={() => atualizarNovaForma('tipo_taxa', tipo.valor)}
                  >
                    {tipo.label}
                  </TogglePill>
                ))}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <TogglePill pressed={novaForma.ativo} onClick={() => atualizarNovaForma('ativo', !novaForma.ativo)}>
              Ativo
            </TogglePill>
            <TogglePill
              pressed={novaForma.visivel_cliente}
              onClick={() => atualizarNovaForma('visivel_cliente', !novaForma.visivel_cliente)}
            >
              Cliente
            </TogglePill>
            <TogglePill
              pressed={novaForma.aceita_troco}
              onClick={() => atualizarNovaForma('aceita_troco', !novaForma.aceita_troco)}
            >
              Troco
            </TogglePill>
          </div>

          <Button type="button" onClick={() => void criarForma()} disabled={criando} className="h-9 rounded-md shadow-none">
            {criando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
            Adicionar
          </Button>
        </CardContent>
      </Card>

      <Card className="overflow-hidden border-border/70 shadow-none">
        <CardHeader className="p-4 pb-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base">Formas cadastradas</CardTitle>
              <CardDescription>Cards numerados para edição rápida.</CardDescription>
            </div>
            <span className="rounded-md bg-muted px-2 py-1 font-mono text-xs text-muted-foreground">
              {formas.length.toString().padStart(2, '0')}
            </span>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {carregando ? (
            <div className="flex items-center gap-2 px-6 pb-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Carregando...
            </div>
          ) : formas.length === 0 ? (
            <div className="mx-6 mb-6 rounded-xl border border-dashed border-border/80 bg-muted/30 p-6 text-sm text-muted-foreground">
              Nenhuma forma cadastrada.
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 p-4 pt-0 lg:grid-cols-3 2xl:grid-cols-4">
              {formas.map((forma, index) => {
                const IconeForma = obterIconeFormaPagamento(forma.codigo)

                return (
                  <div
                    key={forma.id}
                    className="rounded-xl border border-border/70 bg-card p-3 transition-colors hover:border-border"
                  >
                    <div className="mb-3 flex items-start justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="flex h-8 min-w-8 items-center justify-center rounded-md border border-border bg-muted/50 font-mono text-[11px] font-semibold tabular-nums">
                          {(index + 1).toString().padStart(2, '0')}
                        </span>
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                          <IconeForma className="h-4 w-4" />
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-foreground">{forma.nome || 'Sem nome'}</p>
                          <p className="truncate font-mono text-[11px] text-muted-foreground">{forma.codigo || 'sem_codigo'}</p>
                        </div>
                      </div>
                      <Input
                        type="number"
                        min={0}
                        step="1"
                        value={forma.ordem}
                        onChange={(event) => atualizarFormaLocal(forma.id, 'ordem', event.target.value)}
                        onFocus={(event) => event.currentTarget.select()}
                        className={cn(CAMPO_COMPACTO, 'w-14 shrink-0 font-mono')}
                        aria-label={`Ordem de ${forma.nome}`}
                      />
                    </div>

                    <div className="space-y-2">
                      <Input
                        value={forma.nome}
                        onChange={(event) => atualizarFormaLocal(forma.id, 'nome', event.target.value)}
                        className={cn(CAMPO_COMPACTO, 'font-medium')}
                        aria-label={`Nome da forma ${index + 1}`}
                      />
                      <Input
                        value={forma.codigo}
                        onChange={(event) => atualizarFormaLocal(forma.id, 'codigo', normalizarCodigo(event.target.value))}
                        className={cn(CAMPO_COMPACTO, 'font-mono')}
                        aria-label={`Código da forma ${index + 1}`}
                      />
                      <Input
                        value={forma.descricao}
                        onChange={(event) => atualizarFormaLocal(forma.id, 'descricao', event.target.value)}
                        placeholder="Descrição"
                        className={CAMPO_COMPACTO}
                        aria-label={`Descrição de ${forma.nome}`}
                      />

                      <div className="grid grid-cols-[1fr_74px] gap-2">
                        <div className="grid grid-cols-3 gap-1">
                          {TIPOS_TAXA.map((tipo) => (
                            <Button
                              key={tipo.valor}
                              type="button"
                              variant={forma.tipo_taxa === tipo.valor ? 'default' : 'outline'}
                              size="sm"
                              onClick={() => atualizarFormaLocal(forma.id, 'tipo_taxa', tipo.valor)}
                              className="h-7 rounded-md px-1 text-[10px] shadow-none"
                            >
                              {tipo.label === 'Sem taxa' ? 'Sem' : tipo.label === 'Percentual' ? '%' : 'R$'}
                            </Button>
                          ))}
                        </div>
                        <Input
                          type="number"
                          min={0}
                          step="0.01"
                          value={forma.valor_taxa}
                          onChange={(event) => atualizarFormaLocal(forma.id, 'valor_taxa', event.target.value)}
                          onFocus={(event) => event.currentTarget.select()}
                          className={cn(CAMPO_COMPACTO, 'font-mono')}
                          aria-label={`Taxa de ${forma.nome}`}
                        />
                      </div>

                      <div className="grid grid-cols-3 gap-1">
                        <Button
                          type="button"
                          variant={forma.ativo ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => atualizarFormaLocal(forma.id, 'ativo', !forma.ativo)}
                          className="h-7 rounded-md px-1 text-[10px] shadow-none"
                        >
                          Ativo
                        </Button>
                        <Button
                          type="button"
                          variant={forma.visivel_cliente ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => atualizarFormaLocal(forma.id, 'visivel_cliente', !forma.visivel_cliente)}
                          className="h-7 rounded-md px-1 text-[10px] shadow-none"
                        >
                          {forma.visivel_cliente ? <Eye className="mr-1 h-3 w-3" /> : <EyeOff className="mr-1 h-3 w-3" />}
                          Cliente
                        </Button>
                        <Button
                          type="button"
                          variant={forma.aceita_troco ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => atualizarFormaLocal(forma.id, 'aceita_troco', !forma.aceita_troco)}
                          className="h-7 rounded-md px-1 text-[10px] shadow-none"
                        >
                          Troco
                        </Button>
                      </div>
                    </div>

                    <div className="mt-3 flex justify-end gap-2 border-t border-border/70 pt-3">
                      {confirmandoExclusaoId === forma.id ? (
                        <>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setConfirmandoExclusaoId(null)}
                            className="h-8 rounded-md"
                          >
                            Cancelar
                          </Button>
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            onClick={() => void excluirForma(forma)}
                            disabled={excluindoId === forma.id}
                            className="h-8 w-8 rounded-md px-0"
                            aria-label={`Confirmar exclusão de ${forma.nome}`}
                          >
                            {excluindoId === forma.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => void salvarForma(forma.id)}
                            disabled={salvandoId === forma.id}
                            className="h-8 rounded-md"
                          >
                            {salvandoId === forma.id ? (
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                              <Save className="mr-2 h-4 w-4" />
                            )}
                            Salvar
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setConfirmandoExclusaoId(forma.id)}
                            className="h-8 w-8 rounded-md px-0 text-muted-foreground hover:text-destructive"
                            aria-label={`Excluir ${forma.nome}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
