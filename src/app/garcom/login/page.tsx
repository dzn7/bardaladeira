'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import TelaSelecaoPerfil from '@/components/login/TelaSelecaoPerfil'
import { obterSessao, salvarSessao, type UsuarioSistema } from '@/lib/autenticacao'
import { Loader2 } from 'lucide-react'

export default function GarcomLoginPage() {
  const router = useRouter()
  const [verificando, setVerificando] = useState(true)

  useEffect(() => {
    const sessao = obterSessao()
    if (sessao && sessao.papel === 'garcom') {
      router.push('/garcom')
      return
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

  const handleAutenticar = (usuario: UsuarioSistema) => {
    if (usuario.papel !== 'garcom') return
    salvarSessao(usuario)
    localStorage.setItem('garcomToken', `garcom-supabase-${usuario.id}`)
    router.push('/garcom')
    window.location.reload()
  }

  return (
    <TelaSelecaoPerfil
      papel="garcom"
      aoAutenticar={handleAutenticar}
    />
  )
}
