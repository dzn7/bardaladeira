'use client'

import { AdminAuthProvider } from '@/contexts/AdminAuthContext'
import { ImpressoraProvider } from '@/contexts/ImpressoraContext'
import PWAManagerAdmin from '@/components/admin/PWAManagerAdmin'
import { OnboardingProvider, OnboardingRoot } from '@/features/onboarding'
import { ModalNotificacoesEntrada, NotificacoesAdminProvider } from '@/features/notificacoes'
import { ProvedorConfirmacao } from '@/components/admin/ui/confirmacao'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminAuthProvider>
      <NotificacoesAdminProvider>
        <ImpressoraProvider>
          <OnboardingProvider>
            <ProvedorConfirmacao>
              <PWAManagerAdmin />
              {children}
              <OnboardingRoot />
              <ModalNotificacoesEntrada />
            </ProvedorConfirmacao>
          </OnboardingProvider>
        </ImpressoraProvider>
      </NotificacoesAdminProvider>
    </AdminAuthProvider>
  )
}
