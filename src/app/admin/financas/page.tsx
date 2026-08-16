'use client'

import AdminLayout from '@/components/admin/AdminLayout'
import ProtectedRoute from '@/components/admin/ProtectedRoute'
import { PainelFinancas } from '@/features/financas/components/PainelFinancas'

export default function FinancasPage() {
  return (
    <ProtectedRoute>
      <AdminLayout>
        <PainelFinancas />
      </AdminLayout>
    </ProtectedRoute>
  )
}
