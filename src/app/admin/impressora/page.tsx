'use client'

import { useState, useEffect } from 'react'
import { Bluetooth, BluetoothSlash, TestTube, WarningCircle } from '@phosphor-icons/react'
import { toast } from 'sonner'
import AdminLayout from '@/components/admin/AdminLayout'
import ProtectedRoute from '@/components/admin/ProtectedRoute'
import { useImpressora } from '@/contexts/ImpressoraContext'
import { TamanhoPapel } from '@/lib/impressora/types'
import GerenciadorImpressao from '@/components/admin/GerenciadorImpressao'
import {
  Botao,
  CabecalhoPagina,
  Campo,
  Cartao,
  Interruptor,
  LinhaInterruptor,
  ListaCarregando,
  Pagina,
  Secao,
  Segmentos,
  Selo,
} from '@/components/admin/ui'
import { cn } from '@/lib/utils'

// Detecta se é iOS/Safari
function detectarIOS(): boolean {
  if (typeof window === 'undefined') return false
  const userAgent = window.navigator.userAgent.toLowerCase()
  return /iphone|ipad|ipod/.test(userAgent) || 
    (userAgent.includes('mac') && 'ontouchend' in document)
}

function ConteudoPaginaImpressora() {
  const {
    status,
    dispositivo,
    configuracao,
    erroConexao,
    suportado,
    carregando,
    conectar,
    desconectar,
    testarImpressao,
    atualizarConfiguracao
  } = useImpressora()

  const [testando, setTestando] = useState(false)
  const [ehIOS, setEhIOS] = useState(false)

  useEffect(() => {
    setEhIOS(detectarIOS())
  }, [])

  const handleConectar = async () => {
    await conectar()
  }

  const handleTestar = async () => {
    setTestando(true)

    const sucesso = await testarImpressao()

    if (sucesso) {
      toast.success('Página de teste enviada')
    } else {
      toast.error('Não foi possível imprimir a página de teste')
    }

    setTestando(false)
  }

  if (carregando) {
    return <ListaCarregando linhas={3} />
  }

  const textoStatus =
    status === 'conectado' ? 'Conectada' :
    status === 'conectando' ? 'Conectando…' :
    status === 'erro' ? 'Erro na conexão' :
    'Desconectada'
  const tomStatus = status === 'conectado' ? 'sucesso' : status === 'conectando' ? 'alerta' : status === 'erro' ? 'perigo' : 'neutro'

  return (
    <div className="space-y-6">
      {ehIOS && (
        <div role="alert" className="flex items-start gap-3 rounded-xl border border-red-500/30 bg-red-500/5 p-4">
          <WarningCircle className="mt-0.5 size-5 shrink-0 text-red-600 dark:text-red-400" />
          <div className="text-sm">
            <p className="font-medium text-foreground">iPhone e iPad não conectam a impressora</p>
            <p className="mt-1 text-muted-foreground">
              A Apple não libera Bluetooth no navegador. Use um celular Android ou um computador com Chrome ou Edge.
            </p>
          </div>
        </div>
      )}

      {!suportado && !ehIOS && (
        <div role="alert" className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
          <WarningCircle className="mt-0.5 size-5 shrink-0 text-amber-600 dark:text-amber-400" />
          <div className="text-sm">
            <p className="font-medium text-foreground">Este navegador não conecta impressora</p>
            <p className="mt-1 text-muted-foreground">
              Abra no Chrome ou no Edge. No computador funciona com impressora Bluetooth comum (porta serial) e BLE.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Secao titulo="Conexão Bluetooth">
          <Cartao className="space-y-4 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-medium text-foreground">
                  {dispositivo?.nome || configuracao.dispositivoNome || 'Nenhuma impressora'}
                </p>
                <p className="mt-0.5 text-[13px] text-muted-foreground">
                  {dispositivo
                    ? 'Impressora em uso'
                    : configuracao.dispositivoNome
                      ? 'Última impressora usada'
                      : 'Conecte para imprimir os tickets'}
                </p>
              </div>
              <Selo tom={tomStatus}>{textoStatus}</Selo>
            </div>

            {erroConexao && (
              <p role="alert" className="text-sm text-destructive">{erroConexao}</p>
            )}

            <div className="flex flex-col gap-2 sm:flex-row [&>*]:flex-1">
              {status === 'conectado' ? (
                <>
                  <Botao variante="contorno" tamanho="lg" className="md:h-10 md:text-sm" onClick={() => void handleTestar()} carregando={testando}>
                    {!testando && <TestTube />}
                    Imprimir teste
                  </Botao>
                  <Botao variante="perigoSuave" tamanho="lg" className="md:h-10 md:text-sm" onClick={desconectar}>
                    <BluetoothSlash />
                    Desconectar
                  </Botao>
                </>
              ) : (
                <Botao
                  tamanho="lg"
                  className="md:h-10 md:text-sm"
                  onClick={() => void handleConectar()}
                  disabled={!suportado}
                  carregando={status === 'conectando'}
                >
                  {status !== 'conectando' && <Bluetooth />}
                  Conectar impressora
                </Botao>
              )}
            </div>

            <p className="text-[13px] leading-5 text-muted-foreground">
              No Chrome do computador pode abrir a lista de portas seriais: escolha a da impressora.
            </p>
          </Cartao>
        </Secao>

        <Secao titulo="Como imprimir">
          <Cartao className="space-y-5 p-4">
            <Campo rotulo="Largura do papel" ajuda={configuracao.tamanhoPapel === '58mm' ? '32 letras por linha' : '48 letras por linha'}>
              <Segmentos<TamanhoPapel>
                opcoes={[
                  { valor: '58mm', rotulo: '58 mm' },
                  { valor: '80mm', rotulo: '80 mm' },
                ]}
                valor={configuracao.tamanhoPapel}
                aoMudar={(tamanho) => atualizarConfiguracao({ tamanhoPapel: tamanho })}
                rotuloAcessivel="Largura do papel"
              />
            </Campo>

            <LinhaInterruptor
              titulo="Imprimir sozinho"
              descricao="Imprime cada pedido novo assim que ele entra na fila."
              marcado={configuracao.autoImprimir}
              aoMudar={(novoValor) => atualizarConfiguracao({ autoImprimir: novoValor })}
              desabilitado={!suportado}
              rotuloAcessivel="Impressão automática"
            />

            <TicketConfig
              titulo="Ticket do cliente"
              descricao="Comprovante com valores"
              ativo={configuracao.imprimirTicketCliente}
              aoAtivar={(novoValor) => atualizarConfiguracao({ imprimirTicketCliente: novoValor })}
              copias={configuracao.copiasCliente}
              aoMudarCopias={(n) => atualizarConfiguracao({ copiasCliente: n })}
            />
            <TicketConfig
              titulo="Ticket da cozinha"
              descricao="Itens e observações"
              ativo={configuracao.imprimirTicketCozinha}
              aoAtivar={(novoValor) => atualizarConfiguracao({ imprimirTicketCozinha: novoValor })}
              copias={configuracao.copiasCozinha}
              aoMudarCopias={(n) => atualizarConfiguracao({ copiasCozinha: n })}
            />
          </Cartao>
        </Secao>
      </div>

      <Secao titulo="Primeira vez?">
        <Cartao className="p-4">
          <ol className="list-decimal space-y-2 pl-5 text-sm text-muted-foreground marker:text-foreground">
            <li>Ligue a impressora e ative o Bluetooth dela.</li>
            <li>Toque em &quot;Conectar impressora&quot; e escolha ela na lista.</li>
            <li>Use &quot;Imprimir teste&quot; para conferir.</li>
            <li>Escolha a largura do papel (58 mm ou 80 mm).</li>
          </ol>
        </Cartao>
      </Secao>
    </div>
  )
}

function TicketConfig({
  titulo,
  descricao,
  ativo,
  aoAtivar,
  copias,
  aoMudarCopias,
}: {
  titulo: string
  descricao: string
  ativo: boolean
  aoAtivar: (ativo: boolean) => void
  copias: number
  aoMudarCopias: (copias: number) => void
}) {
  return (
    <div className="rounded-xl border border-border/70 p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">{titulo}</p>
          <p className="mt-0.5 text-[13px] text-muted-foreground">{descricao}</p>
        </div>
        <Interruptor marcado={ativo} aoMudar={aoAtivar} rotuloAcessivel={`Imprimir ${titulo.toLowerCase()}`} />
      </div>
      <div className={cn('mt-3 flex items-center gap-3', !ativo && 'opacity-50')}>
        <span className="text-sm text-muted-foreground">Cópias</span>
        <Segmentos
          opcoes={['1', '2', '3'].map((n) => ({ valor: n, rotulo: n }))}
          valor={String(copias)}
          aoMudar={(n) => aoMudarCopias(parseInt(n))}
          rotuloAcessivel={`Cópias do ${titulo.toLowerCase()}`}
        />
      </div>
    </div>
  )
}

export default function ImpressoraPage() {
  return (
    <ProtectedRoute>
      <AdminLayout>
        <Pagina>
          <CabecalhoPagina
            titulo="Impressora"
            descricao="Impressão de tickets por Bluetooth."
          />

          <GerenciadorImpressao />

          <ConteudoPaginaImpressora />
        </Pagina>
      </AdminLayout>
    </ProtectedRoute>
  )
}
