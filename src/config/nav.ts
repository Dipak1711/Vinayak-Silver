import type { LucideIcon } from 'lucide-react'
import {
  BarChart3,
  Boxes,
  Briefcase,
  Factory,
  FileText,
  Handshake,
  LayoutDashboard,
  LayoutGrid,
  PackageOpen,
  Receipt,
  Target,
  Truck,
  Users,
} from 'lucide-react'

export interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  description: string
  /** Sidebar section this module belongs to. */
  group: SidebarGroupId
}

export type SidebarGroupId = 'main' | 'sales' | 'operations' | 'masters' | 'insights'

export interface SidebarGroup {
  id: SidebarGroupId
  title: string
  icon: LucideIcon
}

export const SIDEBAR_GROUPS: SidebarGroup[] = [
  { id: 'main', title: 'Main Menu', icon: LayoutGrid },
  { id: 'sales', title: 'Sales & Orders', icon: Briefcase },
  { id: 'operations', title: 'Operations', icon: Factory },
  { id: 'masters', title: 'Masters', icon: Users },
  { id: 'insights', title: 'Reports & Ledger', icon: BarChart3 },
]

export const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, description: 'Business overview and pending work', group: 'main' },
  { to: '/leads', label: 'Lead', icon: Target, description: 'Pipeline of enquiries and follow-ups', group: 'sales' },
  { to: '/quotations', label: 'Quotation', icon: FileText, description: 'Quotations, revisions and approvals', group: 'sales' },
  { to: '/invoices', label: 'Invoice', icon: Receipt, description: 'Invoices, payments and balances', group: 'sales' },
  { to: '/inventory', label: 'Raw Inventory', icon: Boxes, description: 'Raw material stock and movements', group: 'operations' },
  { to: '/manufacturing', label: 'Manufacturing', icon: Factory, description: 'Production jobs and stages', group: 'operations' },
  { to: '/packaging', label: 'Packaging', icon: PackageOpen, description: 'Packing progress and readiness', group: 'operations' },
  { to: '/dispatch', label: 'Dispatch', icon: Truck, description: 'Shipments and delivery tracking', group: 'operations' },
  { to: '/customers', label: 'Customer', icon: Users, description: 'Customer master and ledger', group: 'masters' },
  { to: '/suppliers', label: 'Supplier', icon: Handshake, description: 'Supplier master and payables', group: 'masters' },
  { to: '/reports', label: 'Report and Ledger', icon: BarChart3, description: 'Reports, ledgers and exports', group: 'insights' },
]
