'use client'

import ProtectedRoute from '@/components/admin/ProtectedRoute'
import AdminLayout from '@/components/admin/AdminLayout'
import GerenciadorFuncionarios from '@/components/admin/GerenciadorFuncionarios'

export default function FuncionariosPage() {
  return (
    <ProtectedRoute>
      <AdminLayout>
        <GerenciadorFuncionarios />
      </AdminLayout>
    </ProtectedRoute>
  )
}
