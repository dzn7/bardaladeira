'use client'

import ProtectedRoute from '@/components/admin/ProtectedRoute'
import AdminLayout from '@/components/admin/AdminLayout'
import GerenciadorFormasPagamento from '@/components/admin/GerenciadorFormasPagamento'

export default function FormasPagamentoPage() {
  return (
    <ProtectedRoute>
      <AdminLayout>
        <GerenciadorFormasPagamento />
      </AdminLayout>
    </ProtectedRoute>
  )
}
