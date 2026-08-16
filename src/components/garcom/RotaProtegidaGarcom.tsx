'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { obterSessao } from '@/lib/autenticacao'
import { Loader2 } from 'lucide-react'

export default function RotaProtegidaGarcom({ children }: { children: React.ReactNode }) {
  const [autorizado, setAutorizado] = useState(false)
  const [verificando, setVerificando] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const sessao = obterSessao()
    if (sessao && sessao.papel === 'garcom') {
      setAutorizado(true)
    } else {
      router.push('/garcom/login')
    }
    setVerificando(false)
  }, [router])

  if (verificando) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-laranja-500 animate-spin" />
      </div>
    )
  }

  if (!autorizado) return null

  return <>{children}</>
}
