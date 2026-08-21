import { ComponentType } from 'react'
import {
  Archive,
  Armchair,
  BadgePercent,
  BarChart3,
  CalendarDays,
  Coins,
  Contact,
  CookingPot,
  CreditCard,
  Kanban,
  Landmark,
  LayoutDashboard,
  Layers,
  ListPlus,
  MapPin,
  Package,
  PlusCircle,
  Printer,
  Receipt,
  ShoppingBasket,
  Trophy,
  Truck,
  UserCog,
  UtensilsCrossed,
  Wallet,
} from 'lucide-react'
import IconeMesa from '@/components/icons/IconeMesa'
import IconeWhatsApp from '@/components/icons/IconeWhatsApp'

export type IconeSidebar = ComponentType<{ className?: string; strokeWidth?: number | string }>

export type ItemSidebarRota = {
  id: string
  texto: string
  path: string
  icone: IconeSidebar
  categoria: string
}

export type GrupoSidebarRota = {
  titulo: string
  itens: ItemSidebarRota[]
}

export type SidebarConfigItem = {
  id: string
  visible: boolean
  category?: string
}

export const GRUPOS_MENU_ADMIN: GrupoSidebarRota[] = [
  {
    titulo: 'Operações',
    itens: [
      { id: '/admin/dashboard', texto: 'Dashboard', icone: LayoutDashboard, path: '/admin/dashboard', categoria: 'Operações' },
      { id: '/admin/painel', texto: 'Painel', icone: Kanban, path: '/admin/painel', categoria: 'Operações' },
      { id: '/admin/pdv', texto: 'PDV', icone: ShoppingBasket, path: '/admin/pdv', categoria: 'Operações' },
      { id: '/admin/pedidos', texto: 'Pedidos', icone: Receipt, path: '/admin/pedidos', categoria: 'Operações' },
      { id: '/admin/pedidos/novo', texto: 'Novo pedido', icone: PlusCircle, path: '/admin/pedidos/novo', categoria: 'Operações' },
    ],
  },
  {
    titulo: 'Operação',
    itens: [
      { id: '/admin/mesas', texto: 'Mesas', icone: IconeMesa, path: '/admin/mesas', categoria: 'Operação' },
      { id: '/admin/salao', texto: 'Salão', icone: Armchair, path: '/admin/salao', categoria: 'Operação' },
      { id: '/admin/caixa', texto: 'Caixa', icone: Wallet, path: '/admin/caixa', categoria: 'Operação' },
      { id: '/admin/formas-pagamento', texto: 'Pagamentos', icone: CreditCard, path: '/admin/formas-pagamento', categoria: 'Operação' },
      { id: '/admin/crediario', texto: 'Crediário', icone: Coins, path: '/admin/crediario', categoria: 'Operação' },
      { id: '/admin/entregas', texto: 'Entregas', icone: Truck, path: '/admin/entregas', categoria: 'Operação' },
      { id: '/admin/funcionarios', texto: 'Funcionários', icone: Contact, path: '/admin/funcionarios', categoria: 'Operação' },
      { id: '/admin/garcons', texto: 'Garçons', icone: UtensilsCrossed, path: '/admin/garcons', categoria: 'Operação' },
      { id: '/admin/usuarios', texto: 'Usuários', icone: UserCog, path: '/admin/usuarios', categoria: 'Operação' },
      { id: '/admin/bairros', texto: 'Bairros', icone: MapPin, path: '/admin/bairros', categoria: 'Operação' },
    ],
  },
  {
    titulo: 'Catálogo e canais',
    itens: [
      { id: '/admin/produtos', texto: 'Produtos', icone: CookingPot, path: '/admin/produtos', categoria: 'Catálogo e canais' },
      { id: '/admin/estoque', texto: 'Estoque', icone: Package, path: '/admin/estoque', categoria: 'Catálogo e canais' },
      { id: '/admin/combos', texto: 'Combos', icone: Layers, path: '/admin/combos', categoria: 'Catálogo e canais' },
      { id: '/admin/adicionais', texto: 'Adicionais', icone: ListPlus, path: '/admin/adicionais', categoria: 'Catálogo e canais' },
      { id: '/admin/cupons', texto: 'Cupons', icone: BadgePercent, path: '/admin/cupons', categoria: 'Catálogo e canais' },
      { id: '/admin/whatsapp', texto: 'WhatsApp', icone: IconeWhatsApp, path: '/admin/whatsapp', categoria: 'Catálogo e canais' },
      { id: '/admin/impressora', texto: 'Impressora', icone: Printer, path: '/admin/impressora', categoria: 'Catálogo e canais' },
    ],
  },
  {
    titulo: 'Análise',
    itens: [
      { id: '/admin/financas', texto: 'Finanças', icone: Landmark, path: '/admin/financas', categoria: 'Análise' },
      { id: '/admin/produtividade', texto: 'Produtividade', icone: Trophy, path: '/admin/produtividade', categoria: 'Análise' },
      { id: '/admin/analise-diaria', texto: 'Análise diária', icone: CalendarDays, path: '/admin/analise-diaria', categoria: 'Análise' },
      { id: '/admin/relatorios', texto: 'Relatórios', icone: BarChart3, path: '/admin/relatorios', categoria: 'Análise' },
      { id: '/admin/anos-anteriores', texto: 'Anos anteriores', icone: Archive, path: '/admin/anos-anteriores', categoria: 'Análise' },
    ],
  },
]

export const ITENS_MENU_ADMIN: ItemSidebarRota[] = GRUPOS_MENU_ADMIN.flatMap((grupo) => grupo.itens)

export const mapaItensMenuAdmin = () =>
  new Map(ITENS_MENU_ADMIN.map((item) => [item.id, item]))

export const configPadraoSidebar = (): SidebarConfigItem[] =>
  ITENS_MENU_ADMIN.map((item) => ({
    id: item.id,
    visible: true,
    category: item.categoria,
  }))

export const mesclarConfigSidebar = (
  salva: SidebarConfigItem[] | null | undefined,
): { visiveis: GrupoSidebarRota[]; ocultos: ItemSidebarRota[] } => {
  const mapa = mapaItensMenuAdmin()
  const ordenados: { item: ItemSidebarRota; visible: boolean; category: string }[] = []

  if (salva && salva.length > 0) {
    for (const cfg of salva) {
      const matched = mapa.get(cfg.id)
      if (!matched) continue
      ordenados.push({
        item: matched,
        visible: cfg.visible !== false,
        category: (cfg.category?.trim() || matched.categoria),
      })
      mapa.delete(cfg.id)
    }
  }

  Array.from(mapa.values()).forEach((matched) => {
    ordenados.push({
      item: matched,
      visible: true,
      category: matched.categoria,
    })
  })

  const categorias = Array.from(new Set(ordenados.map((entry) => entry.category)))
  const visiveis: GrupoSidebarRota[] = categorias
    .map((titulo) => ({
      titulo,
      itens: ordenados
        .filter((entry) => entry.category === titulo && entry.visible)
        .map((entry) => ({ ...entry.item, categoria: titulo })),
    }))
    .filter((grupo) => grupo.itens.length > 0)

  const ocultos = ordenados
    .filter((entry) => !entry.visible)
    .map((entry) => entry.item)

  return { visiveis, ocultos }
}

export const isRotaAtivaSidebar = (path: string, pathname: string | null | undefined) => {
  if (!pathname) return false
  if (pathname === path) return true
  if (!pathname.startsWith(`${path}/`)) return false
  const temFilhoMaisEspecifico = ITENS_MENU_ADMIN.some(
    (outro) =>
      outro.path !== path &&
      outro.path.startsWith(`${path}/`) &&
      (pathname === outro.path || pathname.startsWith(`${outro.path}/`)),
  )
  return !temFilhoMaisEspecifico
}
