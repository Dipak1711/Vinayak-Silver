import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { ChevronDown, Settings, ShieldCheck, X } from 'lucide-react'
import { NAV_ITEMS, SIDEBAR_GROUPS } from '@/config/nav'
import { useData } from '@/store/DataContext'
import { cn } from '@/lib/utils'

export function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { db } = useData()
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})

  const counts: Record<string, number> = {
    '/leads': db.leads.filter((lead) => lead.stage !== 'Won' && lead.stage !== 'Lost').length,
    '/quotations': db.quotations.filter((q) => q.status === 'Draft' || q.status === 'Sent').length,
    '/invoices': db.invoices.filter((invoice) => invoice.status !== 'Paid').length,
    '/inventory': db.rawMaterials.filter((material) => material.quantity <= material.minStock).length,
    '/manufacturing': db.manufacturingJobs.filter((job) => job.status !== 'Completed').length,
    '/packaging': db.packagingJobs.filter((job) => job.status !== 'Packed').length,
    '/dispatch': db.dispatches.filter((dispatch) => dispatch.status !== 'Delivered').length,
  }

  return (
    <>
      {open ? (
        <div
          className="no-print fixed inset-0 z-30 bg-navy-950/45 backdrop-blur-sm lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      ) : null}

      <aside
        className={cn(
          'no-print fixed inset-y-0 left-0 z-40 flex w-[284px] flex-col border-r border-silver-200 bg-white',
          'shadow-[0_8px_32px_-18px_rgba(15,23,42,0.35)]',
          'transition-transform duration-250 ease-[cubic-bezier(0.16,1,0.3,1)] lg:static lg:z-auto lg:translate-x-0 lg:shadow-none',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
        aria-label="Main navigation"
      >
        <div className="flex items-center gap-3.5 px-5 py-5">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[14px] bg-linear-to-br from-blue-500 to-blue-800 text-[14px] font-black text-white shadow-[0_10px_24px_-8px_rgba(79,70,229,0.55)] ring-1 ring-inset ring-white/20">
            VS
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[17px] leading-tight font-extrabold tracking-[-0.02em] text-navy-900">
              Vinayak Silver
            </p>
            <p className="mt-0.5 truncate text-[10.5px] font-semibold tracking-[0.2em] text-silver-500 uppercase">
              ERP Suite
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="hit pressable rounded-lg p-1.5 text-silver-600 transition-colors hover:bg-silver-100 hover:text-navy-900 lg:hidden"
            aria-label="Close navigation"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 pb-4">
          {SIDEBAR_GROUPS.map((group) => {
            const items = NAV_ITEMS.filter((item) => item.group === group.id)
            if (items.length === 0) return null
            const isClosed = collapsed[group.id]
            const GroupIcon = group.icon
            return (
              <div key={group.id} className="mb-1.5">
                <button
                  type="button"
                  onClick={() => setCollapsed((current) => ({ ...current, [group.id]: !current[group.id] }))}
                  aria-expanded={!isClosed}
                  className="pressable flex w-full items-center gap-3 rounded-xl p-1.5 text-left transition-colors hover:bg-silver-100"
                >
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[11px] bg-blue-50 text-blue-600">
                    <GroupIcon className="h-4.5 w-4.5" />
                  </span>
                  <span className="flex-1 truncate text-[14.5px] font-semibold text-navy-900">{group.title}</span>
                  <ChevronDown
                    className={cn(
                      'h-4 w-4 shrink-0 text-silver-500 transition-transform duration-200',
                      isClosed && '-rotate-90',
                    )}
                  />
                </button>

                {!isClosed ? (
                  <ul className="mt-1 mb-2.5 ml-[19px] flex flex-col gap-0.5 border-l border-silver-200 pl-2.5">
                    {items.map((item) => {
                      const Icon = item.icon
                      const badge = counts[item.to]
                      return (
                        <li key={item.to}>
                          <NavLink
                            to={item.to}
                            end={item.to === '/'}
                            onClick={onClose}
                            title={item.description}
                            className={({ isActive }) =>
                              cn(
                                'group flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-[13.5px] font-medium transition-colors duration-150',
                                isActive
                                  ? 'bg-blue-600 font-semibold text-white shadow-[0_10px_24px_-8px_rgba(79,70,229,0.55)]'
                                  : 'text-silver-700 hover:bg-silver-100 hover:text-navy-900',
                              )
                            }
                          >
                            {({ isActive }) => (
                              <>
                                <Icon
                                  className={cn(
                                    'h-4.5 w-4.5 shrink-0 transition-transform duration-200 group-hover:scale-110',
                                    isActive ? 'text-white' : 'text-silver-500 group-hover:text-blue-600',
                                  )}
                                />
                                <span className="flex-1 truncate">{item.label}</span>
                                {badge ? (
                                  <span
                                    className={cn(
                                      'tnum rounded-full px-1.5 py-0.5 text-[10.5px] font-bold',
                                      isActive ? 'bg-white/25 text-white' : 'bg-amber-50 text-amber-700',
                                    )}
                                  >
                                    {badge}
                                  </span>
                                ) : null}
                              </>
                            )}
                          </NavLink>
                        </li>
                      )
                    })}
                  </ul>
                ) : null}
              </div>
            )
          })}
        </nav>

        <div className="border-t border-silver-200 p-3">
          <NavLink
            to="/settings"
            onClick={onClose}
            className={({ isActive }) =>
              cn(
                'group flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-[13.5px] font-medium transition-colors duration-150',
                isActive
                  ? 'bg-blue-600 font-semibold text-white shadow-[0_10px_24px_-8px_rgba(79,70,229,0.55)]'
                  : 'text-silver-700 hover:bg-silver-100 hover:text-navy-900',
              )
            }
          >
            {({ isActive }) => (
              <>
                <Settings
                  className={cn(
                    'h-4.5 w-4.5 shrink-0 transition-transform duration-300 group-hover:rotate-45',
                    isActive ? 'text-white' : 'text-silver-500',
                  )}
                />
                Settings
              </>
            )}
          </NavLink>

          <div className="mt-2 flex items-start gap-2 rounded-xl border border-silver-200 bg-silver-50 px-3 py-2.5">
            <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" aria-hidden="true" />
            <p className="text-[10.5px] leading-snug text-silver-600">
              Demo data stored in this browser only. No server or database connected.
            </p>
          </div>
        </div>
      </aside>
    </>
  )
}
