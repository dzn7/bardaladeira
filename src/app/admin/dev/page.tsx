'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  Database,
  HardDrive,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  Server,
  Image as ImageIcon,
  FileText,
  Users,
  ShoppingBag,
  Coffee,
  Plus,
  Trash2,
  Lock,
  Eye,
  EyeOff,
} from 'lucide-react'
import ProtectedRoute from '@/components/admin/ProtectedRoute'
import AdminLayout from '@/components/admin/AdminLayout'
import { supabase } from '@/lib/supabase'

// Credenciais de acesso do desenvolvedor
const DEV_USER = 'dzn'
const DEV_PASSWORD = '1503'

// Limites do plano Free do Supabase
const LIMITES_FREE = {
  database: 500 * 1024 * 1024, // 500MB
  storage: 1 * 1024 * 1024 * 1024, // 1GB
  bandwidth: 2 * 1024 * 1024 * 1024, // 2GB/mês
  fileUpload: 50 * 1024 * 1024, // 50MB por arquivo
}

type EstatisticasDB = {
  produtos: number
  adicionais: number
  bebidas: number
  pedidos: number
  tamanhoTotal: number
}

type EstatisticasStorage = {
  totalArquivos: number
  tamanhoTotal: number
  porBucket: { bucket: string; arquivos: number; tamanho: number }[]
}

export default function DevPage() {
  const [autenticado, setAutenticado] = useState(false)
  const [usuario, setUsuario] = useState('')
  const [senha, setSenha] = useState('')
  const [mostrarSenha, setMostrarSenha] = useState(false)
  const [erroLogin, setErroLogin] = useState(false)
  const [carregando, setCarregando] = useState(false)
  const [estatisticasDB, setEstatisticasDB] = useState<EstatisticasDB | null>(null)
  const [estatisticasStorage, setEstatisticasStorage] = useState<EstatisticasStorage | null>(null)

  const verificarCredenciais = () => {
    if (usuario === DEV_USER && senha === DEV_PASSWORD) {
      setAutenticado(true)
      setErroLogin(false)
      carregarEstatisticas()
    } else {
      setErroLogin(true)
    }
  }

  const carregarEstatisticas = async () => {
    setCarregando(true)
    try {
      // Estatísticas do banco de dados
      const [produtosRes, adicionaisRes, bebidasRes, pedidosRes] = await Promise.all([
        supabase.from('produtos').select('id', { count: 'exact', head: true }),
        supabase.from('adicionais').select('id', { count: 'exact', head: true }),
        supabase.from('bebidas').select('id', { count: 'exact', head: true }),
        supabase.from('pedidos').select('id', { count: 'exact', head: true }),
      ])

      // Estimar tamanho do banco (aproximado)
      const totalRegistros = 
        (produtosRes.count || 0) + 
        (adicionaisRes.count || 0) + 
        (bebidasRes.count || 0) + 
        (pedidosRes.count || 0)
      
      // Estimativa: ~2KB por registro em média
      const tamanhoEstimado = totalRegistros * 2 * 1024

      setEstatisticasDB({
        produtos: produtosRes.count || 0,
        adicionais: adicionaisRes.count || 0,
        bebidas: bebidasRes.count || 0,
        pedidos: pedidosRes.count || 0,
        tamanhoTotal: tamanhoEstimado,
      })

      // Estatísticas do Storage
      const { data: buckets } = await supabase.storage.listBuckets()
      
      let totalArquivos = 0
      let tamanhoTotal = 0
      const porBucket: { bucket: string; arquivos: number; tamanho: number }[] = []

      if (buckets) {
        for (const bucket of buckets) {
          try {
            const { data: arquivos } = await supabase.storage.from(bucket.name).list('', {
              limit: 1000,
            })
            
            if (arquivos) {
              let tamanhoBucket = 0
              for (const arquivo of arquivos) {
                if (arquivo.metadata?.size) {
                  tamanhoBucket += arquivo.metadata.size
                }
              }
              
              totalArquivos += arquivos.length
              tamanhoTotal += tamanhoBucket
              porBucket.push({
                bucket: bucket.name,
                arquivos: arquivos.length,
                tamanho: tamanhoBucket,
              })
            }
          } catch (e) {
            console.error(`Erro ao listar bucket ${bucket.name}:`, e)
          }
        }
      }

      setEstatisticasStorage({
        totalArquivos,
        tamanhoTotal,
        porBucket,
      })
    } catch (error) {
      console.error('Erro ao carregar estatísticas:', error)
    } finally {
      setCarregando(false)
    }
  }

  const formatarBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const calcularPorcentagem = (usado: number, limite: number): number => {
    return Math.min((usado / limite) * 100, 100)
  }

  const getCorPorcentagem = (porcentagem: number): string => {
    if (porcentagem < 50) return 'bg-green-500'
    if (porcentagem < 75) return 'bg-yellow-500'
    if (porcentagem < 90) return 'bg-orange-500'
    return 'bg-red-500'
  }

  if (!autenticado) {
    return (
      <ProtectedRoute>
        <AdminLayout>
          <div className="min-h-screen flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl p-8 max-w-md w-full"
            >
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Lock className="w-8 h-8 text-red-600" />
                </div>
                <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">
                  Área Restrita
                </h1>
                <p className="text-zinc-600 dark:text-zinc-400 mt-2">
                  Acesso exclusivo para desenvolvedores
                </p>
              </div>

              <div className="space-y-4">
                {/* Usuário */}
                <input
                  type="text"
                  value={usuario}
                  onChange={(e) => {
                    setUsuario(e.target.value)
                    setErroLogin(false)
                  }}
                  placeholder="Usuário"
                  className={`w-full px-4 py-3 rounded-lg border ${
                    erroLogin 
                      ? 'border-red-500 bg-red-50 dark:bg-red-900/20' 
                      : 'border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800'
                  } text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500`}
                />

                {/* Senha */}
                <div className="relative">
                  <input
                    type={mostrarSenha ? 'text' : 'password'}
                    value={senha}
                    onChange={(e) => {
                      setSenha(e.target.value)
                      setErroLogin(false)
                    }}
                    onKeyDown={(e) => e.key === 'Enter' && verificarCredenciais()}
                    placeholder="Senha"
                    className={`w-full px-4 py-3 pr-12 rounded-lg border ${
                      erroLogin 
                        ? 'border-red-500 bg-red-50 dark:bg-red-900/20' 
                        : 'border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800'
                    } text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500`}
                  />
                  <button
                    type="button"
                    onClick={() => setMostrarSenha(!mostrarSenha)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500"
                  >
                    {mostrarSenha ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>

                {erroLogin && (
                  <p className="text-red-500 text-sm flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" />
                    Credenciais incorretas
                  </p>
                )}

                <button
                  onClick={verificarCredenciais}
                  className="w-full py-3 bg-amber-600 hover:bg-amber-700 text-white font-medium rounded-lg transition-colors"
                >
                  Acessar
                </button>
              </div>
            </motion.div>
          </div>
        </AdminLayout>
      </ProtectedRoute>
    )
  }

  return (
    <ProtectedRoute>
      <AdminLayout>
        <div className="p-4 md:p-6 lg:p-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold text-zinc-900 dark:text-white flex items-center gap-3">
                <Server className="w-8 h-8 text-red-600" />
                Painel do Desenvolvedor
              </h1>
              <p className="text-zinc-600 dark:text-zinc-400 mt-1">
                Monitoramento de recursos do Supabase (Plano Free)
              </p>
            </div>
            <button
              onClick={carregarEstatisticas}
              disabled={carregando}
              className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${carregando ? 'animate-spin' : ''}`} />
              Atualizar
            </button>
          </div>

          {/* Limites do Plano Free */}
          <div className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 rounded-xl p-6 mb-8 border border-amber-200 dark:border-amber-800">
            <h2 className="text-lg font-bold text-amber-800 dark:text-amber-200 mb-4 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              Limites do Plano Free do Supabase
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div className="bg-white dark:bg-zinc-800 rounded-lg p-3">
                <p className="text-zinc-600 dark:text-zinc-400">Database</p>
                <p className="font-bold text-zinc-900 dark:text-white">500 MB</p>
              </div>
              <div className="bg-white dark:bg-zinc-800 rounded-lg p-3">
                <p className="text-zinc-600 dark:text-zinc-400">Storage</p>
                <p className="font-bold text-zinc-900 dark:text-white">1 GB</p>
              </div>
              <div className="bg-white dark:bg-zinc-800 rounded-lg p-3">
                <p className="text-zinc-600 dark:text-zinc-400">Bandwidth</p>
                <p className="font-bold text-zinc-900 dark:text-white">2 GB/mês</p>
              </div>
              <div className="bg-white dark:bg-zinc-800 rounded-lg p-3">
                <p className="text-zinc-600 dark:text-zinc-400">Upload Máx</p>
                <p className="font-bold text-zinc-900 dark:text-white">50 MB/arquivo</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Database Stats */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6"
            >
              <h2 className="text-xl font-bold text-zinc-900 dark:text-white mb-6 flex items-center gap-2">
                <Database className="w-6 h-6 text-blue-600" />
                Banco de Dados
              </h2>

              {estatisticasDB ? (
                <div className="space-y-6">
                  {/* Uso estimado */}
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-zinc-600 dark:text-zinc-400">Uso estimado</span>
                      <span className="font-medium text-zinc-900 dark:text-white">
                        {formatarBytes(estatisticasDB.tamanhoTotal)} / 500 MB
                      </span>
                    </div>
                    <div className="h-3 bg-zinc-200 dark:bg-zinc-700 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${getCorPorcentagem(calcularPorcentagem(estatisticasDB.tamanhoTotal, LIMITES_FREE.database))} transition-all duration-500`}
                        style={{ width: `${calcularPorcentagem(estatisticasDB.tamanhoTotal, LIMITES_FREE.database)}%` }}
                      />
                    </div>
                    <p className="text-xs text-zinc-500 mt-1">
                      {calcularPorcentagem(estatisticasDB.tamanhoTotal, LIMITES_FREE.database).toFixed(2)}% utilizado
                    </p>
                  </div>

                  {/* Contagem de registros */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-zinc-50 dark:bg-zinc-800 rounded-lg p-4">
                      <div className="flex items-center gap-2 text-zinc-600 dark:text-zinc-400 mb-1">
                        <ShoppingBag className="w-4 h-4" />
                        <span className="text-sm">Produtos</span>
                      </div>
                      <p className="text-2xl font-bold text-zinc-900 dark:text-white">
                        {estatisticasDB.produtos}
                      </p>
                    </div>
                    <div className="bg-zinc-50 dark:bg-zinc-800 rounded-lg p-4">
                      <div className="flex items-center gap-2 text-zinc-600 dark:text-zinc-400 mb-1">
                        <Plus className="w-4 h-4" />
                        <span className="text-sm">Adicionais</span>
                      </div>
                      <p className="text-2xl font-bold text-zinc-900 dark:text-white">
                        {estatisticasDB.adicionais}
                      </p>
                    </div>
                    <div className="bg-zinc-50 dark:bg-zinc-800 rounded-lg p-4">
                      <div className="flex items-center gap-2 text-zinc-600 dark:text-zinc-400 mb-1">
                        <Coffee className="w-4 h-4" />
                        <span className="text-sm">Bebidas</span>
                      </div>
                      <p className="text-2xl font-bold text-zinc-900 dark:text-white">
                        {estatisticasDB.bebidas}
                      </p>
                    </div>
                    <div className="bg-zinc-50 dark:bg-zinc-800 rounded-lg p-4">
                      <div className="flex items-center gap-2 text-zinc-600 dark:text-zinc-400 mb-1">
                        <FileText className="w-4 h-4" />
                        <span className="text-sm">Pedidos</span>
                      </div>
                      <p className="text-2xl font-bold text-zinc-900 dark:text-white">
                        {estatisticasDB.pedidos}
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center py-12">
                  <RefreshCw className="w-8 h-8 text-zinc-400 animate-spin" />
                </div>
              )}
            </motion.div>

            {/* Storage Stats */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6"
            >
              <h2 className="text-xl font-bold text-zinc-900 dark:text-white mb-6 flex items-center gap-2">
                <HardDrive className="w-6 h-6 text-purple-600" />
                Storage
              </h2>

              {estatisticasStorage ? (
                <div className="space-y-6">
                  {/* Uso total */}
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-zinc-600 dark:text-zinc-400">Uso total</span>
                      <span className="font-medium text-zinc-900 dark:text-white">
                        {formatarBytes(estatisticasStorage.tamanhoTotal)} / 1 GB
                      </span>
                    </div>
                    <div className="h-3 bg-zinc-200 dark:bg-zinc-700 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${getCorPorcentagem(calcularPorcentagem(estatisticasStorage.tamanhoTotal, LIMITES_FREE.storage))} transition-all duration-500`}
                        style={{ width: `${calcularPorcentagem(estatisticasStorage.tamanhoTotal, LIMITES_FREE.storage)}%` }}
                      />
                    </div>
                    <p className="text-xs text-zinc-500 mt-1">
                      {calcularPorcentagem(estatisticasStorage.tamanhoTotal, LIMITES_FREE.storage).toFixed(2)}% utilizado
                    </p>
                  </div>

                  {/* Total de arquivos */}
                  <div className="bg-zinc-50 dark:bg-zinc-800 rounded-lg p-4">
                    <div className="flex items-center gap-2 text-zinc-600 dark:text-zinc-400 mb-1">
                      <ImageIcon className="w-4 h-4" />
                      <span className="text-sm">Total de Arquivos</span>
                    </div>
                    <p className="text-2xl font-bold text-zinc-900 dark:text-white">
                      {estatisticasStorage.totalArquivos}
                    </p>
                  </div>

                  {/* Por bucket */}
                  {estatisticasStorage.porBucket.length > 0 && (
                    <div>
                      <h3 className="text-sm font-medium text-zinc-600 dark:text-zinc-400 mb-3">
                        Por Bucket
                      </h3>
                      <div className="space-y-2">
                        {estatisticasStorage.porBucket.map((bucket) => (
                          <div
                            key={bucket.bucket}
                            className="flex items-center justify-between bg-zinc-50 dark:bg-zinc-800 rounded-lg p-3"
                          >
                            <span className="font-medium text-zinc-900 dark:text-white">
                              {bucket.bucket}
                            </span>
                            <div className="text-right">
                              <p className="text-sm text-zinc-900 dark:text-white">
                                {formatarBytes(bucket.tamanho)}
                              </p>
                              <p className="text-xs text-zinc-500">
                                {bucket.arquivos} arquivos
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center justify-center py-12">
                  <RefreshCw className="w-8 h-8 text-zinc-400 animate-spin" />
                </div>
              )}
            </motion.div>
          </div>

          {/* Recomendações */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mt-6 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6"
          >
            <h2 className="text-xl font-bold text-zinc-900 dark:text-white mb-4 flex items-center gap-2">
              <CheckCircle className="w-6 h-6 text-green-600" />
              Boas Práticas para Economizar Recursos
            </h2>
            <ul className="space-y-3 text-sm text-zinc-600 dark:text-zinc-400">
              <li className="flex items-start gap-2">
                <span className="text-green-500 mt-0.5">✓</span>
                <span>Imagens são comprimidas automaticamente para no máximo 1MB antes do upload</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-500 mt-0.5">✓</span>
                <span>Formato JPEG com qualidade otimizada (80-90%) para melhor compressão</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-500 mt-0.5">✓</span>
                <span>Dimensão máxima de 1200px para evitar arquivos grandes desnecessários</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-500 mt-0.5">✓</span>
                <span>Imagens do Hero são servidas localmente (sem usar Storage)</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-500 mt-0.5">✓</span>
                <span>Pedidos antigos podem ser arquivados periodicamente para liberar espaço</span>
              </li>
            </ul>
          </motion.div>
        </div>
      </AdminLayout>
    </ProtectedRoute>
  )
}
