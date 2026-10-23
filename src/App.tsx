import { lazy } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { AppLayout } from '@/components/layout/AppLayout'
const DashboardPage = lazy(() => import('@/pages/DashboardPage').then((m) => ({ default: m.DashboardPage })))
const LeadsPage = lazy(() => import('@/pages/LeadsPage').then((m) => ({ default: m.LeadsPage })))
const QuotationsPage = lazy(() => import('@/pages/QuotationsPage').then((m) => ({ default: m.QuotationsPage })))
const InvoicesPage = lazy(() => import('@/pages/InvoicesPage').then((m) => ({ default: m.InvoicesPage })))
const InventoryPage = lazy(() => import('@/pages/InventoryPage').then((m) => ({ default: m.InventoryPage })))
const ManufacturingPage = lazy(() => import('@/pages/ManufacturingPage').then((m) => ({ default: m.ManufacturingPage })))
const PackagingPage = lazy(() => import('@/pages/PackagingPage').then((m) => ({ default: m.PackagingPage })))
const DispatchPage = lazy(() => import('@/pages/DispatchPage').then((m) => ({ default: m.DispatchPage })))
const CustomersPage = lazy(() => import('@/pages/CustomersPage').then((m) => ({ default: m.CustomersPage })))
const SuppliersPage = lazy(() => import('@/pages/SuppliersPage').then((m) => ({ default: m.SuppliersPage })))
const ReportsPage = lazy(() => import('@/pages/ReportsPage').then((m) => ({ default: m.ReportsPage })))

export default function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/leads" element={<LeadsPage />} />
        <Route path="/quotations" element={<QuotationsPage />} />
        <Route path="/invoices" element={<InvoicesPage />} />
        <Route path="/inventory" element={<InventoryPage />} />
        <Route path="/manufacturing" element={<ManufacturingPage />} />
        <Route path="/packaging" element={<PackagingPage />} />
        <Route path="/dispatch" element={<DispatchPage />} />
        <Route path="/customers" element={<CustomersPage />} />
        <Route path="/suppliers" element={<SuppliersPage />} />
        <Route path="/reports" element={<ReportsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
