'use client'

import { useParams } from 'next/navigation'
import AdminLayout from '@/components/admin/AdminLayout'
import ProtectedRoute from '@/components/admin/ProtectedRoute'
import PedidosCriadosGarcom from '@/components/admin/garcons/PedidosCriadosGarcom'

export default function PedidosCriadosGarcomPage() {
  const params = useParams<{ id: string }>()

  return (
    <ProtectedRoute>
      <AdminLayout>
        <PedidosCriadosGarcom garcomId={params.id} />
      </AdminLayout>
    </ProtectedRoute>
  )
}
