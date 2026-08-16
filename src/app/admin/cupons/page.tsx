'use client'

import ProtectedRoute from '@/components/admin/ProtectedRoute'
import AdminLayout from '@/components/admin/AdminLayout'
import GerenciadorCupons from '@/components/admin/cupons/GerenciadorCupons'

export default function CuponsPage() {
  return (
    <ProtectedRoute>
      <AdminLayout>
        <GerenciadorCupons />
      </AdminLayout>
    </ProtectedRoute>
  )
}
