import { useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { Sidebar } from '@/components/layout/Sidebar'
import { Topbar } from '@/components/layout/Topbar'

export function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const location = useLocation()

  useEffect(() => {
    setSidebarOpen(false)
  }, [location.pathname])

  return (
    <div className="app-canvas no-print relative flex min-h-screen">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="relative flex min-w-0 flex-1 flex-col">
        <Topbar onMenuClick={() => setSidebarOpen(true)} />

        <main className="flex-1 px-4 py-6 lg:px-9 lg:py-8">
          <div
            key={location.pathname}
            className="page-enter mx-auto flex w-full max-w-[1640px] flex-col gap-5"
          >
            <Outlet />
          </div>
        </main>

        <footer className="border-t border-silver-200 bg-white/60 px-4 py-4 text-center text-xs text-silver-600 no-print lg:px-9">
          Vinayak Silver ERP demo · All data is fictional and stored only in this browser's localStorage.
        </footer>
      </div>
    </div>
  )
}
