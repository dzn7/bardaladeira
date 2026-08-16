'use client'

import AdminLayout from '@/components/admin/AdminLayout'
import ProtectedRoute from '@/components/admin/ProtectedRoute'
import PainelCrediario from '@/features/crediario/components/PainelCrediario'

export default function CrediarioPage() {
  return (
    <ProtectedRoute>
      <AdminLayout>
        <PainelCrediario />
      </AdminLayout>
    </ProtectedRoute>
  )
}
