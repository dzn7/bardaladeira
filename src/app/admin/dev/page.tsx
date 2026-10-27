'use client'

import { useState, useEffect } from 'react'
import { ArrowsClockwise as RefreshCw, Eye, EyeSlash as EyeOff, Lock } from '@phosphor-icons/react'
import ProtectedRoute from '@/components/admin/ProtectedRoute'
import AdminLayout from '@/components/admin/AdminLayout'
import { supabase } from '@/lib/supabase'
import { Botao, CabecalhoPagina, Campo, Cartao, Entrada, Esqueleto, Lista, Pagina, Secao } from '@/components/admin/ui'
import { cn } from '@/lib/utils'

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
    if (porcentagem < 75) return 'bg-primary'
    if (porcentagem < 90) return 'bg-amber-500'
    return 'bg-destructive'
  }

  if (!autenticado) {
    return (
      <ProtectedRoute>
        <AdminLayout>
          <div className="flex min-h-[60dvh] items-center justify-center">
            <Cartao className="w-full max-w-sm p-6">
              <form
                className="space-y-4"
                onSubmit={(e) => {
                  e.preventDefault()
                  verificarCredenciais()
                }}
              >
                <div className="space-y-1">
                  <span className="flex size-10 items-center justify-center rounded-lg bg-muted text-foreground">
                    <Lock className="size-5" />
                  </span>
                  <h1 className="pt-2 text-lg font-semibold text-foreground">Área do desenvolvedor</h1>
                  <p className="text-sm text-muted-foreground">Só para quem mantém o sistema.</p>
                </div>

                <Campo rotulo="Usuário" htmlFor="dev-usuario">
                  <Entrada
                    id="dev-usuario"
                    value={usuario}
                    autoComplete="off"
                    aria-invalid={erroLogin || undefined}
                    onChange={(e) => {
                      setUsuario(e.target.value)
                      setErroLogin(false)
                    }}
                  />
                </Campo>

                <Campo rotulo="Senha" htmlFor="dev-senha" erro={erroLogin ? 'Usuário ou senha incorretos.' : null}>
                  <div className="relative">
                    <Entrada
                      id="dev-senha"
                      type={mostrarSenha ? 'text' : 'password'}
                      value={senha}
                      aria-invalid={erroLogin || undefined}
                      onChange={(e) => {
                        setSenha(e.target.value)
                        setErroLogin(false)
                      }}
                      className="pr-12"
                    />
                    <button
                      type="button"
                      onClick={() => setMostrarSenha(!mostrarSenha)}
                      aria-label={mostrarSenha ? 'Esconder senha' : 'Mostrar senha'}
                      className="absolute right-0 top-0 flex size-11 items-center justify-center text-muted-foreground hover:text-foreground md:size-10"
                    >
                      {mostrarSenha ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
                    </button>
                  </div>
                </Campo>

                <Botao type="submit" tamanho="lg" className="w-full md:h-10 md:text-sm">
                  Entrar
                </Botao>
              </form>
            </Cartao>
          </div>
        </AdminLayout>
      </ProtectedRoute>
    )
  }

  const BarraUso = ({ usado, limite, rotulo }: { usado: number; limite: number; rotulo: string }) => {
    const porcentagem = calcularPorcentagem(usado, limite)
    return (
      <div>
        <div className="mb-2 flex justify-between gap-3 text-sm">
          <span className="text-muted-foreground">{rotulo}</span>
          <span className="font-medium tabular-nums text-foreground">
            {formatarBytes(usado)} de {formatarBytes(limite)}
          </span>
        </div>
        <div
          className="h-2 overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-valuenow={Math.round(porcentagem)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={rotulo}
        >
          <div className={cn('h-full transition-all', getCorPorcentagem(porcentagem))} style={{ width: `${porcentagem}%` }} />
        </div>
        <p className="mt-1 text-[13px] tabular-nums text-muted-foreground">{porcentagem.toFixed(2)}% usado</p>
      </div>
    )
  }

  const Numero = ({ rotulo, valor }: { rotulo: string; valor: number }) => (
    <div className="rounded-lg bg-muted/50 p-3">
      <p className="text-sm text-muted-foreground">{rotulo}</p>
      <p className="mt-0.5 text-xl font-semibold tabular-nums text-foreground">{valor}</p>
    </div>
  )

  const Carregando = () => (
    <div className="space-y-3">
      <Esqueleto className="h-4 w-1/2" />
      <Esqueleto className="h-2 w-full" />
      <Esqueleto className="h-20 w-full" />
    </div>
  )

  return (
    <ProtectedRoute>
      <AdminLayout>
        <Pagina>
          <CabecalhoPagina
            titulo="Desenvolvedor"
            descricao="Uso do Supabase no plano gratuito."
            acoes={
              <Botao variante="contorno" onClick={() => void carregarEstatisticas()} disabled={carregando}>
                <RefreshCw className={cn(carregando && 'animate-spin')} />
                Atualizar
              </Botao>
            }
          />

          <Secao titulo="Limites do plano gratuito">
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
              {[
                ['Banco', '500 MB'],
                ['Arquivos', '1 GB'],
                ['Tráfego', '2 GB/mês'],
                ['Upload', '50 MB por arquivo'],
              ].map(([rotulo, valor]) => (
                <Cartao key={rotulo} className="p-3">
                  <p className="text-sm text-muted-foreground">{rotulo}</p>
                  <p className="mt-0.5 font-medium text-foreground">{valor}</p>
                </Cartao>
              ))}
            </div>
          </Secao>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Secao titulo="Banco de dados">
              <Cartao className="space-y-4 p-4">
                {estatisticasDB ? (
                  <>
                    <BarraUso usado={estatisticasDB.tamanhoTotal} limite={LIMITES_FREE.database} rotulo="Uso estimado" />
                    <div className="grid grid-cols-2 gap-2">
                      <Numero rotulo="Produtos" valor={estatisticasDB.produtos} />
                      <Numero rotulo="Adicionais" valor={estatisticasDB.adicionais} />
                      <Numero rotulo="Bebidas" valor={estatisticasDB.bebidas} />
                      <Numero rotulo="Pedidos" valor={estatisticasDB.pedidos} />
                    </div>
                  </>
                ) : (
                  <Carregando />
                )}
              </Cartao>
            </Secao>

            <Secao titulo="Arquivos (Storage)">
              <div className="space-y-3">
                <Cartao className="space-y-4 p-4">
                  {estatisticasStorage ? (
                    <>
                      <BarraUso usado={estatisticasStorage.tamanhoTotal} limite={LIMITES_FREE.storage} rotulo="Uso total" />
                      <Numero rotulo="Total de arquivos" valor={estatisticasStorage.totalArquivos} />
                    </>
                  ) : (
                    <Carregando />
                  )}
                </Cartao>
                {estatisticasStorage && estatisticasStorage.porBucket.length > 0 && (
                  <Lista>
                    {estatisticasStorage.porBucket.map((bucket) => (
                      <li key={bucket.bucket} className="flex min-h-14 items-center justify-between gap-3 px-4 py-3">
                        <span className="min-w-0 truncate font-medium text-foreground">{bucket.bucket}</span>
                        <div className="shrink-0 text-right">
                          <p className="text-sm tabular-nums text-foreground">{formatarBytes(bucket.tamanho)}</p>
                          <p className="text-[13px] text-muted-foreground">{bucket.arquivos} arquivos</p>
                        </div>
                      </li>
                    ))}
                  </Lista>
                )}
              </div>
            </Secao>
          </div>

          <Secao titulo="O que já economiza espaço">
            <Cartao className="p-4">
              <ul className="list-disc space-y-2 pl-5 text-sm text-muted-foreground">
                <li>Imagens são comprimidas para no máximo 1 MB antes do upload.</li>
                <li>JPEG com qualidade entre 80% e 90%.</li>
                <li>Imagens com no máximo 1200 px.</li>
                <li>As imagens do topo do site ficam no próprio site, fora do Storage.</li>
                <li>Pedidos antigos podem ser arquivados de tempos em tempos.</li>
              </ul>
            </Cartao>
          </Secao>
        </Pagina>
      </AdminLayout>
    </ProtectedRoute>
  )
}
