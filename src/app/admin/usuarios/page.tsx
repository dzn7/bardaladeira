'use client'

import { useState } from 'react'
import ProtectedRoute from '@/components/admin/ProtectedRoute'
import AdminLayout from '@/components/admin/AdminLayout'
import GerenciadorUsuariosSistema from '@/components/admin/GerenciadorUsuariosSistema'
import GerenciadorUsuariosClientes from '@/components/admin/GerenciadorUsuariosClientes'
import GerenciadorPermissoesEquipe from '@/components/admin/GerenciadorPermissoesEquipe'
import { useAdminAuth } from '@/contexts/AdminAuthContext'
import { ShieldCheck, UserCog, Users } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

export default function UsuariosSistemaPage() {
  const [abaAtiva, setAbaAtiva] = useState<'clientes' | 'sistema' | 'permissoes'>('clientes')
  const { usuarioAtual } = useAdminAuth()

  return (
    <ProtectedRoute>
      <AdminLayout>
        <div className="mx-auto w-full max-w-6xl min-w-0 space-y-5">
          <div className="overflow-hidden rounded-xl border border-border/70 bg-card p-4 shadow-sm md:p-5">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-primary/10 p-2.5">
                {abaAtiva === 'clientes' ? (
                  <Users className="h-6 w-6 text-primary" strokeWidth={1.6} />
                ) : abaAtiva === 'sistema' ? (
                  <UserCog className="h-6 w-6 text-primary" strokeWidth={1.6} />
                ) : (
                  <ShieldCheck className="h-6 w-6 text-primary" strokeWidth={1.6} />
                )}
              </div>
              <div className="min-w-0">
                <h1 className="text-lg font-semibold tracking-tight text-foreground md:text-xl">
                  {abaAtiva === 'clientes'
                    ? 'Usuários Cliente'
                    : abaAtiva === 'sistema'
                      ? 'Usuários do Sistema'
                      : 'Permissões da Equipe'}
                </h1>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {abaAtiva === 'clientes'
                    ? 'Base de clientes, vendas e recuperação por WhatsApp'
                    : abaAtiva === 'sistema'
                      ? 'Acessos ao painel, garçom e entregador'
                      : 'Controle visual de garçons e entregadores'}
                </p>
              </div>
            </div>
          </div>

          <Tabs value={abaAtiva} onValueChange={(valor) => setAbaAtiva(valor as typeof abaAtiva)}>
            <TabsList className="mb-4 grid h-auto w-full grid-cols-3 p-1 sm:inline-grid sm:w-auto">
              <TabsTrigger value="clientes" className="min-h-11 px-3 text-sm font-semibold sm:px-4">
                Usuários Cliente
              </TabsTrigger>
              <TabsTrigger value="sistema" className="min-h-11 px-3 text-sm font-semibold sm:px-4">
                Usuários do Sistema
              </TabsTrigger>
              <TabsTrigger value="permissoes" className="min-h-11 px-3 text-sm font-semibold sm:px-4">
                Permissões
              </TabsTrigger>
            </TabsList>
            <TabsContent value="clientes" className="m-0">
              <GerenciadorUsuariosClientes />
            </TabsContent>
            <TabsContent value="sistema" className="m-0">
              <GerenciadorUsuariosSistema />
            </TabsContent>
            <TabsContent value="permissoes" className="m-0">
              <GerenciadorPermissoesEquipe
                modo="admin"
                nomeUsuarioAdmin={usuarioAtual?.nome_usuario ?? 'admin'}
              />
            </TabsContent>
          </Tabs>
        </div>
      </AdminLayout>
    </ProtectedRoute>
  )
}
