'use client'

import ProtectedRoute from '@/components/admin/ProtectedRoute'
import AdminLayout from '@/components/admin/AdminLayout'
import PainelGarcons from '@/components/admin/garcons/PainelGarcons'

export default function GarconsPage() {
  return (
    <ProtectedRoute>
      <AdminLayout>
        <PainelGarcons />
      </AdminLayout>
    </ProtectedRoute>
  )
}
