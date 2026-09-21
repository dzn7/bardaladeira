import { memo, useMemo, useState, type ReactNode } from 'react'
import {
  ChevronRight,
  Eye,
  EyeOff,
  MonitorCog,
  Printer,
  RefreshCw,
  RotateCcw,
  Save,
  Ticket,
  Wifi
} from 'lucide-react'
import type { ConfiguracaoAplicacao, PedidoLista } from '../../../electron/servicos/tipos'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { CampoNumero } from '@/components/ui/campo-numero'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Painel, PainelCabecalho } from '@/components/ui/painel'
import { PreviewTicket } from '@/components/PreviewTicket'
import { largurasPapelSugeridas, limitesConfiguracao } from '@/dominio/configuracao'
import { cn } from '@/lib/utils'

type AlterarConfiguracao = <Chave extends keyof ConfiguracaoAplicacao>(
  chave: Chave,
  valor: ConfiguracaoAplicacao[Chave]
) => void

type Props = {
  rascunho: ConfiguracaoAplicacao
  impressoras: string[]
  alterado: boolean
  salvando: boolean
  pedidoPreview: PedidoLista | null
  aoAlterar: AlterarConfiguracao
  aoSalvar: () => void
  aoDescartar: () => void
  aoAtualizarImpressoras: () => void
}

const SEM_IMPRESSORA = '__sem_impressora__'

const GrupoCampos = ({
  titulo,
  icone,
  children
}: {
  titulo: string
  icone: ReactNode
  children: ReactNode
}) => (
  <div>
    <div className="flex items-center gap-2 border-b border-border/50 bg-surface-raised/50 px-4 py-2">
      <span className="text-primary">{icone}</span>
      <h3 className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{titulo}</h3>
    </div>
    <div className="divide-y divide-border/40">{children}</div>
  </div>
)

const LinhaCampo = ({
  rotulo,
  ajuda,
  children,
  largura = 'w-56'
}: {
  rotulo: string
  ajuda?: string
  children: ReactNode
  largura?: string
}) => (
  <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3">
    <div className="min-w-[10rem] flex-1">
      <p className="text-sm text-foreground">{rotulo}</p>
      {ajuda ? <p className="text-xs text-muted-foreground">{ajuda}</p> : null}
    </div>
    <div className={cn('shrink-0', largura)}>{children}</div>
  </div>
)

export const TelaConfiguracoes = memo(
  ({
    rascunho,
    impressoras,
    alterado,
    salvando,
    pedidoPreview,
    aoAlterar,
    aoSalvar,
    aoDescartar,
    aoAtualizarImpressoras
  }: Props) => {
    const [mostrarChave, setMostrarChave] = useState(false)
    const [avancadoAberto, setAvancadoAberto] = useState(false)

    // Mantém a impressora salva na lista mesmo quando ela some do sistema —
    // caso contrário o seletor esvaziava sozinho e a seleção parecia se perder.
    const opcoesImpressoras = useMemo(() => {
      const conjunto = new Set(impressoras.filter(Boolean))
      if (rascunho.nomeImpressora) conjunto.add(rascunho.nomeImpressora)
      return Array.from(conjunto)
    }, [impressoras, rascunho.nomeImpressora])

    return (
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] xl:items-start">
        <Painel className="overflow-hidden">
          <PainelCabecalho
            titulo="Configurações"
            descricao="Impressora, ticket e automação da fila."
            icone={<MonitorCog className="h-4 w-4" />}
            acoes={
              alterado ? (
                <span className="rounded-full border border-warning/30 bg-warning/10 px-2 py-0.5 text-[11px] font-medium text-warning">
                  Alterações não salvas
                </span>
              ) : null
            }
          />

          <GrupoCampos titulo="Impressora" icone={<Printer className="h-3.5 w-3.5" />}>
            <LinhaCampo rotulo="Dispositivo" ajuda="Impressora térmica usada para os tickets.">
              <div className="flex items-center gap-1.5">
                <Select
                  value={rascunho.nomeImpressora || SEM_IMPRESSORA}
                  onValueChange={(valor) =>
                    aoAlterar('nomeImpressora', valor === SEM_IMPRESSORA ? '' : valor)
                  }
                >
                  <SelectTrigger className="h-9 flex-1 text-sm">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={SEM_IMPRESSORA}>Padrão do sistema</SelectItem>
                    {opcoesImpressoras.map((impressora) => (
                      <SelectItem key={impressora} value={impressora}>
                        {impressora}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  size="icon-sm"
                  variant="outline"
                  onClick={aoAtualizarImpressoras}
                  title="Atualizar lista de impressoras"
                  aria-label="Atualizar lista de impressoras"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                </Button>
              </div>
            </LinhaCampo>

            <LinhaCampo rotulo="Largura do papel" ajuda="Milímetros úteis da bobina." largura="w-64">
              <div className="flex items-center gap-1.5">
                <div className="flex flex-1 rounded-lg border border-border p-0.5">
                  {largurasPapelSugeridas.map((largura) => {
                    const ativo = Number(rascunho.larguraPapelMm) === largura
                    return (
                      <button
                        key={largura}
                        type="button"
                        onClick={() => aoAlterar('larguraPapelMm', largura)}
                        className={cn(
                          'flex-1 rounded-md px-1.5 py-1 text-xs font-medium transition-colors',
                          ativo
                            ? 'bg-primary text-primary-foreground'
                            : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                        )}
                      >
                        {largura}
                      </button>
                    )
                  })}
                </div>
                <CampoNumero
                  valor={rascunho.larguraPapelMm}
                  aoAlterar={(valor) => aoAlterar('larguraPapelMm', valor)}
                  min={limitesConfiguracao.larguraPapelMm.min}
                  max={limitesConfiguracao.larguraPapelMm.max}
                  className="h-9 w-20 text-sm"
                  aria-label="Largura do papel em milímetros"
                />
              </div>
            </LinhaCampo>

            <LinhaCampo rotulo="Cópias" ajuda="Vias impressas por ticket." largura="w-24">
              <CampoNumero
                valor={rascunho.copias}
                aoAlterar={(valor) => aoAlterar('copias', Math.trunc(valor))}
                min={limitesConfiguracao.copias.min}
                max={limitesConfiguracao.copias.max}
                className="h-9 text-sm"
              />
            </LinhaCampo>
          </GrupoCampos>

          <GrupoCampos titulo="Ticket" icone={<Ticket className="h-3.5 w-3.5" />}>
            <LinhaCampo rotulo="Tamanho da fonte" ajuda="Base em pixels do corpo do ticket." largura="w-24">
              <CampoNumero
                valor={rascunho.tamanhoFonteBasePx}
                aoAlterar={(valor) => aoAlterar('tamanhoFonteBasePx', valor)}
                min={limitesConfiguracao.tamanhoFonteBasePx.min}
                max={limitesConfiguracao.tamanhoFonteBasePx.max}
                className="h-9 text-sm"
              />
            </LinhaCampo>

            <LinhaCampo rotulo="Altura da linha" ajuda="Multiplicador do espaçamento vertical." largura="w-24">
              <CampoNumero
                valor={rascunho.espacamentoLinha}
                aoAlterar={(valor) => aoAlterar('espacamentoLinha', valor)}
                min={limitesConfiguracao.espacamentoLinha.min}
                max={limitesConfiguracao.espacamentoLinha.max}
                step={limitesConfiguracao.espacamentoLinha.passo}
                className="h-9 text-sm"
              />
            </LinhaCampo>

            <LinhaCampo rotulo="Espaço entre itens" ajuda="Pixels entre cada item impresso." largura="w-24">
              <CampoNumero
                valor={rascunho.espacamentoItensPx}
                aoAlterar={(valor) => aoAlterar('espacamentoItensPx', valor)}
                min={limitesConfiguracao.espacamentoItensPx.min}
                max={limitesConfiguracao.espacamentoItensPx.max}
                className="h-9 text-sm"
              />
            </LinhaCampo>
          </GrupoCampos>

          <GrupoCampos titulo="Automação e aparência" icone={<MonitorCog className="h-3.5 w-3.5" />}>
            <LinhaCampo rotulo="Impressão automática" ajuda="Imprime a fila assim que um ticket entra." largura="w-auto">
              <Switch
                checked={rascunho.autoImpressao}
                onCheckedChange={(marcado) => aoAlterar('autoImpressao', marcado)}
                aria-label="Impressão automática da fila"
              />
            </LinhaCampo>

            <LinhaCampo rotulo="Intervalo de verificação" ajuda="Segundos entre cada consulta à fila." largura="w-24">
              <CampoNumero
                valor={rascunho.intervaloPollingSegundos}
                aoAlterar={(valor) => aoAlterar('intervaloPollingSegundos', Math.trunc(valor))}
                min={limitesConfiguracao.intervaloPollingSegundos.min}
                max={limitesConfiguracao.intervaloPollingSegundos.max}
                className="h-9 text-sm"
              />
            </LinhaCampo>

            <LinhaCampo rotulo="Tema" ajuda="Claro, escuro ou seguindo o sistema." largura="w-40">
              <Select
                value={rascunho.tema}
                onValueChange={(valor) =>
                  aoAlterar('tema', valor as ConfiguracaoAplicacao['tema'])
                }
              >
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sistema">Sistema</SelectItem>
                  <SelectItem value="claro">Claro</SelectItem>
                  <SelectItem value="escuro">Escuro</SelectItem>
                </SelectContent>
              </Select>
            </LinhaCampo>
          </GrupoCampos>

          <div className="border-t border-border/50">
            <button
              type="button"
              onClick={() => setAvancadoAberto((atual) => !atual)}
              aria-expanded={avancadoAberto}
              className="flex w-full items-center gap-2 px-4 py-2.5 text-left transition-colors hover:bg-accent/50"
            >
              <ChevronRight
                className={cn(
                  'h-3.5 w-3.5 text-muted-foreground transition-transform',
                  avancadoAberto && 'rotate-90'
                )}
              />
              <Wifi className="h-3.5 w-3.5 text-primary" />
              <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Conexão do servidor (avançado)
              </span>
            </button>

            {avancadoAberto ? (
              <div className="divide-y divide-border/40 border-t border-border/40 animate-fade-in">
                <LinhaCampo rotulo="URL do projeto" largura="w-72">
                  <Input
                    value={rascunho.supabaseUrl}
                    onChange={(evento) => aoAlterar('supabaseUrl', evento.target.value)}
                    placeholder="https://seu-projeto.supabase.co"
                    spellCheck={false}
                    className="h-9 font-mono text-xs"
                  />
                </LinhaCampo>
                <LinhaCampo rotulo="Chave pública" ajuda="Alterar aqui pode derrubar a conexão." largura="w-72">
                  <div className="flex items-center gap-1.5">
                    <Input
                      type={mostrarChave ? 'text' : 'password'}
                      value={rascunho.supabaseAnonKey}
                      onChange={(evento) => aoAlterar('supabaseAnonKey', evento.target.value)}
                      spellCheck={false}
                      className="h-9 flex-1 font-mono text-xs"
                    />
                    <Button
                      size="icon-sm"
                      variant="outline"
                      onClick={() => setMostrarChave((atual) => !atual)}
                      aria-label={mostrarChave ? 'Ocultar chave' : 'Mostrar chave'}
                    >
                      {mostrarChave ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </Button>
                  </div>
                </LinhaCampo>
              </div>
            ) : null}
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-border/60 bg-surface-raised/50 px-4 py-3">
            <Button variant="ghost" size="sm" onClick={aoDescartar} disabled={!alterado || salvando}>
              <RotateCcw className="h-3.5 w-3.5" />
              Descartar
            </Button>
            <Button size="sm" onClick={aoSalvar} disabled={!alterado || salvando}>
              <Save className="h-3.5 w-3.5" />
              {salvando ? 'Salvando…' : 'Salvar alterações'}
            </Button>
          </div>
        </Painel>

        <div className="xl:sticky xl:top-0">
          <PreviewTicket pedido={pedidoPreview} configuracao={rascunho} />
        </div>
      </div>
    )
  }
)

TelaConfiguracoes.displayName = 'TelaConfiguracoes'
