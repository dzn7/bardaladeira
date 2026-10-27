'use client'

import { useState } from 'react'
import ProtectedRoute from '@/components/admin/ProtectedRoute'
import AdminLayout from '@/components/admin/AdminLayout'
import GerenciadorUsuariosSistema from '@/components/admin/GerenciadorUsuariosSistema'
import GerenciadorUsuariosClientes from '@/components/admin/GerenciadorUsuariosClientes'
import GerenciadorPermissoesEquipe from '@/components/admin/GerenciadorPermissoesEquipe'
import { useAdminAuth } from '@/contexts/AdminAuthContext'
import { CabecalhoPagina, Pagina } from '@/components/admin/ui'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

export default function UsuariosSistemaPage() {
  const [abaAtiva, setAbaAtiva] = useState<'clientes' | 'sistema' | 'permissoes'>('clientes')
  const { usuarioAtual } = useAdminAuth()

  return (
    <ProtectedRoute>
      <AdminLayout>
        <Pagina className="max-w-6xl min-w-0">
          <CabecalhoPagina
            titulo={
              abaAtiva === 'clientes'
                ? 'Clientes'
                : abaAtiva === 'sistema'
                  ? 'Equipe e acessos'
                  : 'Permissões da equipe'
            }
            descricao={
              abaAtiva === 'clientes'
                ? 'Quem já comprou, quanto gastou e quem chamar de volta pelo WhatsApp.'
                : abaAtiva === 'sistema'
                  ? 'Quem entra no painel, no app do garçom e no do entregador.'
                  : 'O que garçons e entregadores podem fazer.'
            }
          />

          <Tabs value={abaAtiva} onValueChange={(valor) => setAbaAtiva(valor as typeof abaAtiva)}>
            <TabsList className="mb-4 grid h-auto w-full grid-cols-3 p-1 sm:inline-grid sm:w-auto">
              <TabsTrigger value="clientes" className="min-h-11 px-2 text-sm font-medium sm:px-4">
                Clientes
              </TabsTrigger>
              <TabsTrigger value="sistema" className="min-h-11 px-2 text-sm font-medium sm:px-4">
                Equipe
              </TabsTrigger>
              <TabsTrigger value="permissoes" className="min-h-11 px-2 text-sm font-medium sm:px-4">
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
        </Pagina>
      </AdminLayout>
    </ProtectedRoute>
  )
}
