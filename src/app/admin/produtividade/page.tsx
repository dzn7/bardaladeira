'use client'

import ProtectedRoute from '@/components/admin/ProtectedRoute'
import AdminLayout from '@/components/admin/AdminLayout'
import PainelProdutividade from '@/features/produtividade/components/PainelProdutividade'

export default function ProdutividadePage() {
  return (
    <ProtectedRoute>
      <AdminLayout>
        <PainelProdutividade />
      </AdminLayout>
    </ProtectedRoute>
  )
}
