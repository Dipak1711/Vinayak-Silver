import { Navigate, Route, Routes } from 'react-router-dom'
import { AppLayout } from '@/components/layout/AppLayout'
import { DashboardPage } from '@/pages/DashboardPage'
import { LeadsPage } from '@/pages/LeadsPage'
import { QuotationsPage } from '@/pages/QuotationsPage'
import { InvoicesPage } from '@/pages/InvoicesPage'
import { InventoryPage } from '@/pages/InventoryPage'
import { ManufacturingPage } from '@/pages/ManufacturingPage'
import { PackagingPage } from '@/pages/PackagingPage'
import { DispatchPage } from '@/pages/DispatchPage'
import { CustomersPage } from '@/pages/CustomersPage'
import { SuppliersPage } from '@/pages/SuppliersPage'
import { ReportsPage } from '@/pages/ReportsPage'

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
