'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import TelaSelecaoPerfil from '@/components/login/TelaSelecaoPerfil'
import { obterSessao, salvarSessao, type UsuarioSistema } from '@/lib/autenticacao'
import { Loader2 } from 'lucide-react'

export default function EntregadorLoginPage() {
  const router = useRouter()
  const [verificando, setVerificando] = useState(true)

  useEffect(() => {
    const sessao = obterSessao()
    if (sessao && sessao.papel === 'entregador') {
      router.push('/entregador')
      return
    }
    setVerificando(false)
  }, [router])

  if (verificando) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-green-500 animate-spin" />
      </div>
    )
  }

  const handleAutenticar = (usuario: UsuarioSistema) => {
    if (usuario.papel !== 'entregador') return
    salvarSessao(usuario)
    localStorage.setItem('entregadorToken', `entregador-supabase-${usuario.id}`)
    router.push('/entregador')
    window.location.reload()
  }

  return (
    <TelaSelecaoPerfil
      papel="entregador"
      aoAutenticar={handleAutenticar}
    />
  )
}
