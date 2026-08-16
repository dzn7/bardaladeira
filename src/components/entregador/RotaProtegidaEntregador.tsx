'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { obterSessao } from '@/lib/autenticacao'
import { Loader2 } from 'lucide-react'

export default function RotaProtegidaEntregador({ children }: { children: React.ReactNode }) {
  const [autorizado, setAutorizado] = useState(false)
  const [verificando, setVerificando] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const sessao = obterSessao()
    if (sessao && sessao.papel === 'entregador') {
      setAutorizado(true)
    } else {
      router.push('/entregador/login')
    }
    setVerificando(false)
  }, [router])

  if (verificando) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-green-600 dark:text-green-500 animate-spin" />
      </div>
    )
  }

  if (!autorizado) return null

  return <>{children}</>
}
