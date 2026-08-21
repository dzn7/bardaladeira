'use client'

import { AdminAuthProvider } from '@/contexts/AdminAuthContext'
import { ImpressoraProvider } from '@/contexts/ImpressoraContext'
import PWAManagerAdmin from '@/components/admin/PWAManagerAdmin'
import { OnboardingProvider, OnboardingRoot } from '@/features/onboarding'
import { ModalNotificacoesEntrada, NotificacoesAdminProvider } from '@/features/notificacoes'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminAuthProvider>
      <NotificacoesAdminProvider>
        <ImpressoraProvider>
          <OnboardingProvider>
            <PWAManagerAdmin />
            {children}
            <OnboardingRoot />
            <ModalNotificacoesEntrada />
          </OnboardingProvider>
        </ImpressoraProvider>
      </NotificacoesAdminProvider>
    </AdminAuthProvider>
  )
}
