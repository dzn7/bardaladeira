'use client'

import { useState, useEffect } from 'react'
import { 
  Printer, 
  Bluetooth, 
  BluetoothOff, 
  Settings, 
  TestTube, 
  Check, 
  X, 
  Loader2,
  AlertCircle,
  FileText,
  ChefHat,
  Info
} from 'lucide-react'
import AdminLayout from '@/components/admin/AdminLayout'
import ProtectedRoute from '@/components/admin/ProtectedRoute'
import { useImpressora } from '@/contexts/ImpressoraContext'
import Interruptor from '@/components/admin/Interruptor'
import { TamanhoPapel } from '@/lib/impressora/types'
import GerenciadorImpressao from '@/components/admin/GerenciadorImpressao'

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
  const [mensagemTeste, setMensagemTeste] = useState<{ tipo: 'sucesso' | 'erro', texto: string } | null>(null)
  const [ehIOS, setEhIOS] = useState(false)

  useEffect(() => {
    setEhIOS(detectarIOS())
  }, [])

  const handleConectar = async () => {
    setMensagemTeste(null)
    await conectar()
  }

  const handleTestar = async () => {
    setTestando(true)
    setMensagemTeste(null)
    
    const sucesso = await testarImpressao()
    
    if (sucesso) {
      setMensagemTeste({ tipo: 'sucesso', texto: 'Página de teste enviada com sucesso!' })
    } else {
      setMensagemTeste({ tipo: 'erro', texto: 'Falha ao imprimir página de teste' })
    }
    
    setTestando(false)
  }

  if (carregando) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Loader2 className="w-10 h-10 text-laranja-500 animate-spin mx-auto mb-4" />
          <p className="text-zinc-500 dark:text-zinc-400">Carregando configurações...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Aviso de compatibilidade iOS */}
      {ehIOS && (
        <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-medium text-red-900 dark:text-red-100">
                iOS não suportado
              </h3>
              <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                A Apple não permite Web Bluetooth no Safari/iOS. Para usar impressão Bluetooth, acesse este painel de um dispositivo Android ou computador com Chrome/Edge.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded text-xs font-medium">
                  <Check className="w-3 h-3" /> Android + Chrome
                </span>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded text-xs font-medium">
                  <Check className="w-3 h-3" /> Windows/Mac + Chrome
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Aviso de compatibilidade geral */}
      {!suportado && !ehIOS && (
        <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-medium text-amber-900 dark:text-amber-100">
                Navegador não compatível
              </h3>
              <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                Este recurso precisa de Chrome ou Edge. No desktop, o sistema pode usar Web Serial para impressoras Bluetooth Classico e Web Bluetooth para impressoras BLE.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Card de Conexão */}
        <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-700 overflow-hidden">
          <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-700">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-white flex items-center gap-2">
              <Bluetooth className="w-5 h-5 text-blue-500" />
              Conexão Bluetooth
            </h2>
          </div>
          
          <div className="p-6">
            <div className="flex flex-col gap-5">
              {/* Status */}
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <div className={`w-2.5 h-2.5 rounded-full ${
                    status === 'conectado' ? 'bg-green-500 animate-pulse' :
                    status === 'conectando' ? 'bg-amber-500 animate-pulse' :
                    status === 'erro' ? 'bg-red-500' :
                    'bg-zinc-400'
                  }`} />
                  <span className="font-medium text-zinc-900 dark:text-white">
                    {status === 'conectado' ? 'Conectado' :
                     status === 'conectando' ? 'Conectando...' :
                     status === 'erro' ? 'Erro na conexão' :
                     'Desconectado'}
                  </span>
                </div>

                {dispositivo && (
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">
                    <Printer className="w-4 h-4 inline mr-1" />
                    {dispositivo.nome}
                  </p>
                )}

                {configuracao.dispositivoNome && !dispositivo && (
                  <p className="text-sm text-zinc-500 dark:text-zinc-500">
                    Última impressora: {configuracao.dispositivoNome}
                  </p>
                )}

                {erroConexao && (
                  <p className="text-sm text-red-600 dark:text-red-400 mt-1">
                    {erroConexao}
                  </p>
                )}

                <p className="text-xs text-zinc-500 dark:text-zinc-500 mt-2">
                  No Chrome desktop, a conexao pode abrir o seletor de porta serial para impressoras Bluetooth Classico.
                </p>
              </div>

              {/* Ações */}
              <div className="flex flex-col sm:flex-row gap-2">
                {status === 'conectado' ? (
                  <>
                    <button
                      onClick={handleTestar}
                      disabled={testando}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-zinc-100 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-200 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-600 transition-colors disabled:opacity-50"
                    >
                      {testando ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <TestTube className="w-4 h-4" />
                      )}
                      Testar impressão
                    </button>
                    <button
                      onClick={desconectar}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors"
                    >
                      <BluetoothOff className="w-4 h-4" />
                      Desconectar
                    </button>
                  </>
                ) : (
                  <button
                    onClick={handleConectar}
                    disabled={!suportado || status === 'conectando'}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {status === 'conectando' ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Bluetooth className="w-4 h-4" />
                    )}
                    Conectar impressora
                  </button>
                )}
              </div>
            </div>

            {/* Mensagem de teste */}
            {mensagemTeste && (
              <div className={`mt-4 p-3 rounded-lg flex items-center gap-2 ${
                mensagemTeste.tipo === 'sucesso' 
                  ? 'bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-300'
                  : 'bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300'
              }`}>
                {mensagemTeste.tipo === 'sucesso' ? (
                  <Check className="w-4 h-4" />
                ) : (
                  <X className="w-4 h-4" />
                )}
                {mensagemTeste.texto}
              </div>
            )}
          </div>
        </div>

        {/* Card de Configurações */}
        <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-700 overflow-hidden">
          <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-700">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-white flex items-center gap-2">
              <Settings className="w-5 h-5 text-zinc-500" />
              Configurações
            </h2>
          </div>
          
          <div className="p-6 space-y-6">
          {/* Tamanho do Papel */}
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-3">
              Tamanho do Papel
            </label>
            <div className="grid grid-cols-2 gap-3 max-w-sm">
              {(['58mm', '80mm'] as TamanhoPapel[]).map((tamanho) => (
                <button
                  key={tamanho}
                  onClick={() => atualizarConfiguracao({ tamanhoPapel: tamanho })}
                  className={`p-4 rounded-xl border-2 transition-all ${
                    configuracao.tamanhoPapel === tamanho
                      ? 'border-laranja-500 bg-laranja-50 dark:bg-laranja-950/20'
                      : 'border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600'
                  }`}
                >
                  <div className="text-center">
                    <div className={`w-8 h-12 mx-auto mb-2 rounded border-2 ${
                      tamanho === '58mm' ? 'w-6' : 'w-10'
                    } ${
                      configuracao.tamanhoPapel === tamanho
                        ? 'border-laranja-500 bg-laranja-100 dark:bg-laranja-900/30'
                        : 'border-zinc-300 dark:border-zinc-600'
                    }`} />
                    <span className={`text-sm font-medium ${
                      configuracao.tamanhoPapel === tamanho
                        ? 'text-laranja-600 dark:text-laranja-400'
                        : 'text-zinc-600 dark:text-zinc-400'
                    }`}>
                      {tamanho}
                    </span>
                    <p className="text-xs text-zinc-500 mt-1">
                      {tamanho === '58mm' ? '32 caracteres' : '48 caracteres'}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Impressão Automática */}
          <div className="py-4 border-t border-zinc-100 dark:border-zinc-700">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="font-medium text-zinc-900 dark:text-white">Impressão automática</p>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  Imprime novos pedidos assim que entrarem na fila
                </p>
              </div>
              <Interruptor
                ativado={configuracao.autoImprimir}
                aoAlternar={(novoValor) => atualizarConfiguracao({ autoImprimir: novoValor })}
                desabilitado={!suportado}
                aria-label="Alternar impressão automática"
                tamanho="lg"
              />
            </div>
          </div>

          {/* Tickets */}
          <div className="border-t border-zinc-100 dark:border-zinc-700 pt-4">
            <p className="font-medium text-zinc-900 dark:text-white mb-4">Tickets</p>

            <div className="space-y-3">
              {/* Cliente */}
              <div className="p-4 bg-zinc-50 dark:bg-zinc-900/40 rounded-xl border border-zinc-200/60 dark:border-zinc-700/60">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center flex-shrink-0">
                      <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-zinc-900 dark:text-white">Ticket cliente</p>
                      <p className="text-sm text-zinc-500 dark:text-zinc-400">Comprovante com valores</p>
                      <div className="mt-3 flex flex-col sm:flex-row sm:items-center gap-2">
                        <span className="text-sm text-zinc-600 dark:text-zinc-300">Cópias</span>
                        <select
                          value={configuracao.copiasCliente}
                          onChange={(e) => atualizarConfiguracao({ copiasCliente: parseInt(e.target.value) })}
                          className="w-full sm:w-24 px-3 py-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm"
                        >
                          {[1, 2, 3].map(n => (
                            <option key={n} value={n}>{n}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>

                  <Interruptor
                    ativado={configuracao.imprimirTicketCliente}
                    aoAlternar={(novoValor) => atualizarConfiguracao({ imprimirTicketCliente: novoValor })}
                    aria-label="Alternar impressão do ticket do cliente"
                    tamanho="lg"
                  />
                </div>
              </div>

              {/* Cozinha */}
              <div className="p-4 bg-zinc-50 dark:bg-zinc-900/40 rounded-xl border border-zinc-200/60 dark:border-zinc-700/60">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="w-10 h-10 bg-amber-100 dark:bg-amber-900/30 rounded-lg flex items-center justify-center flex-shrink-0">
                      <ChefHat className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-zinc-900 dark:text-white">Ticket cozinha</p>
                      <p className="text-sm text-zinc-500 dark:text-zinc-400">Itens e observações</p>
                      <div className="mt-3 flex flex-col sm:flex-row sm:items-center gap-2">
                        <span className="text-sm text-zinc-600 dark:text-zinc-300">Cópias</span>
                        <select
                          value={configuracao.copiasCozinha}
                          onChange={(e) => atualizarConfiguracao({ copiasCozinha: parseInt(e.target.value) })}
                          className="w-full sm:w-24 px-3 py-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm"
                        >
                          {[1, 2, 3].map(n => (
                            <option key={n} value={n}>{n}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>

                  <Interruptor
                    ativado={configuracao.imprimirTicketCozinha}
                    aoAlternar={(novoValor) => atualizarConfiguracao({ imprimirTicketCozinha: novoValor })}
                    aria-label="Alternar impressão do ticket da cozinha"
                    tamanho="lg"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      </div>

      {/* Card de Instruções */}
      <div className="bg-white dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700 overflow-hidden">
        <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-700">
          <h3 className="font-semibold text-zinc-900 dark:text-white flex items-center gap-2">
            <Info className="w-5 h-5 text-zinc-400" />
            Instruções de uso
          </h3>
        </div>
        <div className="p-6">
          <ol className="space-y-3 text-sm text-zinc-600 dark:text-zinc-400">
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-5 h-5 bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300 rounded flex items-center justify-center text-xs font-medium">1</span>
              <span>Ligue a impressora térmica e ative o modo Bluetooth</span>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-5 h-5 bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300 rounded flex items-center justify-center text-xs font-medium">2</span>
              <span>Clique em &quot;Conectar Impressora&quot; e selecione na lista</span>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-5 h-5 bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300 rounded flex items-center justify-center text-xs font-medium">3</span>
              <span>Use &quot;Testar&quot; para verificar a conexão</span>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-5 h-5 bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300 rounded flex items-center justify-center text-xs font-medium">4</span>
              <span>Configure o tamanho do papel (58mm ou 80mm)</span>
            </li>
          </ol>
        </div>
      </div>
    </div>
  )
}

export default function ImpressoraPage() {
  return (
    <ProtectedRoute>
      <AdminLayout>
        <div className="p-4 md:p-6 lg:p-8">
          {/* Cabeçalho */}
          <div className="mb-6">
            <h1 className="text-2xl md:text-3xl font-bold text-zinc-900 dark:text-white flex items-center gap-2">
              <Printer className="w-7 h-7 text-laranja-500" />
              Impressora Térmica
            </h1>
            <p className="text-zinc-500 dark:text-zinc-400 mt-1">
              Configure a impressão de tickets via Bluetooth
            </p>
          </div>

          <div className="mb-6">
            <GerenciadorImpressao />
          </div>

          <ConteudoPaginaImpressora />
        </div>
      </AdminLayout>
    </ProtectedRoute>
  )
}
