import { useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { Sidebar } from '@/components/layout/Sidebar'
import { Topbar } from '@/components/layout/Topbar'

export function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  // Desktop icon-rail preference, remembered across visits.
  const [mini, setMini] = useState(() => {
    try {
      return localStorage.getItem('vinayak.sidebar') === 'mini'
    } catch {
      return false
    }
  })
  const location = useLocation()

  useEffect(() => {
    setSidebarOpen(false)
  }, [location.pathname])

  const toggleMini = () => {
    setMini((current) => {
      const next = !current
      try {
        localStorage.setItem('vinayak.sidebar', next ? 'mini' : 'full')
      } catch {
        /* private mode — the preference just isn't remembered */
      }
      return next
    })
  }

  return (
    <div className="app-canvas no-print relative flex min-h-screen">
      <Sidebar open={sidebarOpen} mini={mini} onClose={() => setSidebarOpen(false)} />

      <div className="relative flex min-w-0 flex-1 flex-col">
        <Topbar
          onMenuClick={() => setSidebarOpen(true)}
          onToggleCollapse={toggleMini}
          mini={mini}
        />

        <main className="flex-1 px-4 py-6 lg:px-9 lg:py-8">
          <div
            key={location.pathname}
            className="page-enter mx-auto flex w-full max-w-[1640px] flex-col gap-5"
          >
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
