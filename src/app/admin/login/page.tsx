'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAdminAuth } from '@/contexts/AdminAuthContext'
import TelaSelecaoPerfil from '@/components/login/TelaSelecaoPerfil'
import { salvarSessao, type UsuarioSistema } from '@/lib/autenticacao'
import { Loader2 } from 'lucide-react'

export default function AdminLogin() {
  const { isAuthenticated, login, loading } = useAdminAuth()
  const router = useRouter()

  useEffect(() => {
    const savedUsername = localStorage.getItem('admin_saved_username')
    const savedPassword = localStorage.getItem('admin_saved_password')
    const savedRemember = localStorage.getItem('admin_remember_me')

    if (savedRemember === 'true' && savedUsername && savedPassword) {
      const sucesso = login(savedUsername, savedPassword)
      if (sucesso) {
        router.push('/admin/dashboard')
      }
    }
  }, [])

  useEffect(() => {
    if (!loading && isAuthenticated) {
      router.push('/admin/dashboard')
    }
  }, [loading, isAuthenticated, router])

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-laranja-500 animate-spin" />
      </div>
    )
  }

  if (isAuthenticated) return null

  const handleAutenticar = (usuario: UsuarioSistema) => {
    if (usuario.papel !== 'admin') return
    salvarSessao(usuario)
    localStorage.setItem('adminToken', `admin-supabase-${usuario.id}`)
    router.push('/admin/dashboard')
    window.location.reload()
  }

  const handleLoginHardcoded = (usuario: string, senha: string): boolean => {
    const sucesso = login(usuario, senha)
    if (sucesso) {
      router.push('/admin/dashboard')
    }
    return sucesso
  }

  return (
    <TelaSelecaoPerfil
      papel="admin"
      aoAutenticar={handleAutenticar}
      loginHardcoded={handleLoginHardcoded}
    />
  )
}

