'use client'

import { AdminAuthProvider } from '@/contexts/AdminAuthContext'
import { ImpressoraProvider } from '@/contexts/ImpressoraContext'
import PWAManagerAdmin from '@/components/admin/PWAManagerAdmin'
import { OnboardingProvider, OnboardingRoot } from '@/features/onboarding'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminAuthProvider>
      <ImpressoraProvider>
        <OnboardingProvider>
          <PWAManagerAdmin />
          {children}
          <OnboardingRoot />
        </OnboardingProvider>
      </ImpressoraProvider>
    </AdminAuthProvider>
  )
}
