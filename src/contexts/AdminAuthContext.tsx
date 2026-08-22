'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import {
  loginUsuarioSistema,
  obterSessao,
  limparSessao,
  type UsuarioSistema,
} from '@/lib/autenticacao'

type AdminAuthContextType = {
  isAuthenticated: boolean
  usuarioAtual: UsuarioSistema | null
  login: (username: string, password: string) => boolean
  loginAsync: (username: string, password: string) => Promise<boolean>
  logout: () => void
  loading: boolean
}

const TOKENS_VALIDOS = [
  'admin-authenticated-bar-da-ladeira',
  'admin-authenticated-dzndev',
]

const AdminAuthContext = createContext<AdminAuthContextType | undefined>(undefined)

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [usuarioAtual, setUsuarioAtual] = useState<UsuarioSistema | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const adminToken = localStorage.getItem('adminToken')
    if (adminToken && TOKENS_VALIDOS.includes(adminToken)) {
      setIsAuthenticated(true)
    }

    const sessaoSalva = obterSessao()
    if (sessaoSalva && sessaoSalva.papel === 'admin') {
      const tokenDaSessao = `admin-supabase-${sessaoSalva.id}`
      if (!TOKENS_VALIDOS.includes(adminToken || '') && adminToken !== tokenDaSessao) {
        localStorage.setItem('adminToken', tokenDaSessao)
      }
      setUsuarioAtual(sessaoSalva)
      setIsAuthenticated(true)
    }

    setLoading(false)
  }, [])

  const login = (username: string, password: string): boolean => {
    const usuario = username.toLowerCase().trim()

    if (usuario === 'bardaladeira' && password === '1234') {
      localStorage.setItem('adminToken', 'admin-authenticated-bar-da-ladeira')
      setIsAuthenticated(true)
      return true
    }
    if (usuario === 'dzndev' && password === '1503') {
      localStorage.setItem('adminToken', 'admin-authenticated-dzndev')
      setIsAuthenticated(true)
      return true
    }
    return false
  }

  const loginAsync = async (username: string, password: string): Promise<boolean> => {
    const hardcoded = login(username, password)
    if (hardcoded) return true

    const resultado = await loginUsuarioSistema(username, password)
    if (resultado.sucesso && resultado.usuario) {
      if (resultado.usuario.papel !== 'admin') {
        return false
      }
      setUsuarioAtual(resultado.usuario)
      setIsAuthenticated(true)
      localStorage.setItem('adminToken', `admin-supabase-${resultado.usuario.id}`)
      return true
    }
    return false
  }

  const logout = () => {
    localStorage.removeItem('adminToken')
    localStorage.removeItem('admin_saved_username')
    localStorage.removeItem('admin_saved_password')
    localStorage.removeItem('admin_remember_me')
    limparSessao()
    setUsuarioAtual(null)
    setIsAuthenticated(false)
    router.push('/admin/login')
  }

  return (
    <AdminAuthContext.Provider
      value={{ isAuthenticated, usuarioAtual, login, loginAsync, logout, loading }}
    >
      {children}
    </AdminAuthContext.Provider>
  )
}

export function useAdminAuth() {
  const context = useContext(AdminAuthContext)
  if (context === undefined) {
    throw new Error('useAdminAuth deve ser usado dentro de AdminAuthProvider')
  }
  return context
}
