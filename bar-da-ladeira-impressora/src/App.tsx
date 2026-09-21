import { useCallback, useMemo, useState } from 'react'
import { Toaster, toast } from 'sonner'
import { Inbox, ListChecks, RefreshCw, Settings2 } from 'lucide-react'
import type { TipoFilaImpressao } from '../electron/servicos/tipos'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { TelaPedidos } from '@/components/telas/TelaPedidos'
import { TelaFila } from '@/components/telas/TelaFila'
import { TelaConfiguracoes } from '@/components/telas/TelaConfiguracoes'
import { PainelLogs } from '@/components/PainelLogs'
import { useEstadoImpressao } from '@/hooks/useEstadoImpressao'
import { useRascunhoConfiguracao } from '@/hooks/useRascunhoConfiguracao'
import { useTema } from '@/hooks/useTema'
import { formatarHora } from '@/dominio/formatacao'
import { cn } from '@/lib/utils'

type Aba = 'pedidos' | 'fila' | 'configuracoes'

const mensagemDeErro = (erro: unknown, alternativa: string) =>
  erro instanceof Error && erro.message ? erro.message : alternativa

export default function App() {
  const { estado } = useEstadoImpressao()
  const { rascunho, alterar, alterado, confirmarSalvo, descartar } = useRascunhoConfiguracao(
    estado.configuracao
  )

  const [aba, setAba] = useState<Aba>('pedidos')
  const [salvando, setSalvando] = useState(false)
  const [processandoFila, setProcessandoFila] = useState(false)
  const [atualizando, setAtualizando] = useState(false)

  // O tema segue o rascunho para dar retorno imediato ao trocar no seletor.
  useTema(rascunho.tema)

  const filaAtiva = useMemo(
    () => estado.fila.filter((item) => item.status === 'pendente' || item.status === 'processando').length,
    [estado.fila]
  )

  const pedidoPreview = estado.pedidos[0] ?? null

  const atualizarPainel = useCallback(async () => {
    setAtualizando(true)
    try {
      await window.barDaLadeiraImpressao.atualizarPainel()
    } catch (erro) {
      toast.error(mensagemDeErro(erro, 'Falha ao atualizar o painel.'))
    } finally {
      setAtualizando(false)
    }
  }, [])

  const imprimirManual = useCallback(async (pedidoId: string, tipo: TipoFilaImpressao) => {
    try {
      const resultado = await window.barDaLadeiraImpressao.imprimirManual(pedidoId, tipo)

      if (resultado.sucesso) {
        toast.success(`Ticket de ${tipo} enviado para a fila.`)
        return
      }

      if (resultado.duplicado) {
        toast.warning('Esse pedido já está na fila de impressão.')
        return
      }

      toast.error(resultado.erro || 'Não foi possível enfileirar a impressão.')
    } catch (erro) {
      toast.error(mensagemDeErro(erro, 'Falha ao solicitar a impressão.'))
    }
  }, [])

  const reimprimirRegistro = useCallback(async (idFila: string) => {
    try {
      const resultado = await window.barDaLadeiraImpressao.reimprimirFila(idFila)
      if (resultado.sucesso) {
        toast.success('Registro reenviado para impressão.')
        return
      }
      toast.error(resultado.erro || 'Falha ao reenviar o registro.')
    } catch (erro) {
      toast.error(mensagemDeErro(erro, 'Falha na reimpressão do registro.'))
    }
  }, [])

  const processarFilaAgora = useCallback(async () => {
    setProcessandoFila(true)
    try {
      await window.barDaLadeiraImpressao.processarFilaAgora()
      toast.success('Processamento da fila iniciado.')
    } catch (erro) {
      toast.error(mensagemDeErro(erro, 'Falha ao processar a fila.'))
    } finally {
      setProcessandoFila(false)
    }
  }, [])

  const salvarConfiguracao = useCallback(async () => {
    setSalvando(true)
    try {
      const salva = await window.barDaLadeiraImpressao.salvarConfiguracao(rascunho)
      confirmarSalvo(salva)
      toast.success('Configurações salvas.')
      await window.barDaLadeiraImpressao.atualizarPainel()
    } catch (erro) {
      toast.error(mensagemDeErro(erro, 'Falha ao salvar as configurações.'))
    } finally {
      setSalvando(false)
    }
  }, [rascunho, confirmarSalvo])

  const atualizarImpressoras = useCallback(async () => {
    try {
      const impressoras = await window.barDaLadeiraImpressao.atualizarImpressoras()
      toast.success(
        impressoras.length
          ? `${impressoras.length} impressora${impressoras.length === 1 ? '' : 's'} encontrada${impressoras.length === 1 ? '' : 's'}.`
          : 'Nenhuma impressora encontrada no sistema.'
      )
    } catch (erro) {
      toast.error(mensagemDeErro(erro, 'Falha ao carregar as impressoras.'))
    }
  }, [])

  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      <Toaster
        position="bottom-right"
        theme={rascunho.tema === 'sistema' ? 'system' : rascunho.tema === 'escuro' ? 'dark' : 'light'}
        richColors
        closeButton
        duration={3200}
      />

      <header className="shrink-0 border-b border-border/70 bg-card">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 px-5 py-2.5">
          <div className="flex min-w-0 items-center gap-2.5">
            <img
              src="./logo.png"
              alt=""
              className="h-8 w-8 shrink-0 rounded-md border border-border/70 bg-white object-contain p-0.5"
            />
            <div className="min-w-0 leading-tight">
              <p className="truncate text-sm font-medium">Bar da Ladeira</p>
              <p className="truncate text-xs text-muted-foreground">Central de impressão</p>
            </div>
          </div>

          <div className="ml-auto flex flex-wrap items-center gap-2">
            <span
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium',
                estado.conexao.conectado
                  ? 'border-success/25 bg-success/10 text-success'
                  : 'border-destructive/25 bg-destructive/10 text-destructive'
              )}
              title={estado.conexao.mensagem}
            >
              <span
                className={cn(
                  'h-1.5 w-1.5 rounded-full',
                  estado.conexao.conectado ? 'bg-success' : 'bg-destructive'
                )}
              />
              {estado.conexao.conectado ? 'Conectado' : 'Desconectado'}
            </span>

            <span className="hidden items-center gap-1.5 text-xs text-muted-foreground sm:inline-flex">
              Fila ativa
              <span className="rounded-full bg-muted px-1.5 py-0.5 font-mono text-[11px] tabular-nums text-foreground">
                {filaAtiva}
              </span>
            </span>

            <span className="hidden text-xs text-muted-foreground lg:inline">
              Atualizado {formatarHora(estado.conexao.ultimaAtualizacao)}
            </span>

            <Button
              size="sm"
              variant="outline"
              onClick={atualizarPainel}
              disabled={atualizando}
              title="Atualizar pedidos e fila"
            >
              <RefreshCw className={cn('h-3.5 w-3.5', atualizando && 'animate-spin')} />
              Atualizar
            </Button>
          </div>
        </div>
      </header>

      <Tabs
        value={aba}
        onValueChange={(valor) => setAba(valor as Aba)}
        className="flex min-h-0 flex-1 flex-col"
      >
        <div className="shrink-0 border-b border-border/70 bg-card/60">
          <div className="mx-auto w-full max-w-6xl px-5 py-2">
            <TabsList>
              <TabsTrigger value="pedidos">
                <Inbox className="h-3.5 w-3.5" />
                Pedidos
              </TabsTrigger>
              <TabsTrigger value="fila">
                <ListChecks className="h-3.5 w-3.5" />
                Fila
                {filaAtiva > 0 ? (
                  <span className="ml-0.5 rounded-full bg-primary px-1.5 text-[10px] font-medium tabular-nums text-primary-foreground">
                    {filaAtiva}
                  </span>
                ) : null}
              </TabsTrigger>
              <TabsTrigger value="configuracoes">
                <Settings2 className="h-3.5 w-3.5" />
                Configurações
              </TabsTrigger>
            </TabsList>
          </div>
        </div>

        {/* Único container de rolagem: evita barras aninhadas e o salto de scroll
            que acontecia a cada atualização de estado vinda do processo principal. */}
        <main className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-6xl space-y-5 px-5 py-5">
            <TabsContent value="pedidos" className="m-0 space-y-5">
              <TelaPedidos pedidos={estado.pedidos} aoImprimir={imprimirManual} />
            </TabsContent>

            <TabsContent value="fila" className="m-0 space-y-5">
              <TelaFila
                fila={estado.fila}
                processando={processandoFila}
                aoProcessarAgora={processarFilaAgora}
                aoReimprimir={reimprimirRegistro}
              />
              <PainelLogs logs={estado.logs} />
            </TabsContent>

            <TabsContent value="configuracoes" className="m-0 space-y-5">
              <TelaConfiguracoes
                rascunho={rascunho}
                impressoras={estado.impressoras}
                alterado={alterado}
                salvando={salvando}
                pedidoPreview={pedidoPreview}
                aoAlterar={alterar}
                aoSalvar={salvarConfiguracao}
                aoDescartar={descartar}
                aoAtualizarImpressoras={atualizarImpressoras}
              />
            </TabsContent>
          </div>
        </main>
      </Tabs>
    </div>
  )
}
