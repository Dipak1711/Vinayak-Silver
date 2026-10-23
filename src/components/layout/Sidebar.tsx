import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { ChevronDown, X } from 'lucide-react'
import { NAV_ITEMS, SIDEBAR_GROUPS } from '@/config/nav'
import { useData } from '@/store/DataContext'
import { AnimatedNumber } from '@/components/ui/AnimatedNumber'
import { cn } from '@/lib/utils'

/* Each module keeps its own icon colour, so the menu is scannable by colour
   as well as by label. The active item always turns white-on-orange. */
const ICON_TONE: Record<string, string> = {
  '/': 'bg-blue-100 text-blue-700',
  '/leads': 'bg-cyan-100 text-cyan-700',
  '/quotations': 'bg-violet-100 text-violet-700',
  '/invoices': 'bg-emerald-100 text-emerald-700',
  '/inventory': 'bg-amber-100 text-amber-700',
  '/manufacturing': 'bg-[#fde3d3] text-[#b4501d] dark:bg-[#ed7333]/20 dark:text-[#f8aa77]',
  '/packaging': 'bg-rose-100 text-rose-700',
  '/dispatch': 'bg-cyan-100 text-cyan-700',
  '/customers': 'bg-blue-100 text-blue-700',
  '/suppliers': 'bg-violet-100 text-violet-700',
  '/reports': 'bg-gold-100 text-gold-700',
}

export function Sidebar({ open, mini, onClose }: { open: boolean; mini: boolean; onClose: () => void }) {
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
          className="no-print animate-fade-in fixed inset-0 z-30 bg-black/50 backdrop-blur-sm lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      ) : null}

      <aside
        className={cn(
          'sidebar-chrome no-print fixed inset-y-0 left-0 z-40 flex w-[284px] flex-col border-r border-silver-200',
          'shadow-[0_8px_32px_-18px_rgba(223,101,39,0.35)] dark:shadow-none',
          'transition-[transform,width] duration-250 ease-[cubic-bezier(0.16,1,0.3,1)] lg:sticky lg:top-0 lg:z-auto lg:h-screen lg:translate-x-0 lg:self-start lg:shadow-none',
          open ? 'translate-x-0' : '-translate-x-full',
          mini && 'lg:w-[84px]',
        )}
        aria-label="Main navigation"
      >
        <div className={cn('flex items-center gap-3.5 px-5 py-5', mini && 'lg:justify-center lg:px-0')}>
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[14px] bg-linear-to-br from-[#f58a4e] via-[#ed7333] to-[#d9622a] text-[14px] font-black text-white shadow-[0_10px_24px_-8px_rgba(237,115,51,0.65)] ring-1 ring-inset ring-white/40">
            VS
          </span>
          <div className={cn('min-w-0 flex-1', mini && 'lg:hidden')}>
            <p className="truncate text-[17px] leading-tight font-extrabold tracking-[-0.02em] text-navy-900">
              Vinayak Silver
            </p>
            <p className="mt-0.5 truncate text-[10.5px] font-semibold tracking-[0.2em] text-gold-600 uppercase">
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

        <nav className={cn('flex-1 overflow-y-auto px-3 pb-4', mini && 'lg:px-2.5')}>
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
                  className={cn(
                    'pressable flex w-full items-center gap-3 rounded-xl p-1.5 text-left transition-colors hover:bg-[#fff4ec] dark:hover:bg-white/[0.06]',
                    mini && 'lg:hidden',
                  )}
                >
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[11px] bg-linear-to-br from-[#fff1e8] to-[#fdd9c4] text-[#ed7333] ring-1 ring-inset ring-[#f9c9ad] dark:from-[#3b2417] dark:to-[#2a1a12] dark:text-[#f8aa77] dark:ring-[#5d3822]">
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

                <div
                  className={cn(
                    'grid transition-[grid-template-rows,opacity] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]',
                    !isClosed || mini ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
                  )}
                  aria-hidden={isClosed && !mini ? true : undefined}
                >
                  <div className="min-h-0 overflow-hidden">
                  <ul
                    className={cn(
                      'mt-1 mb-2.5 ml-[19px] flex flex-col gap-0.5 border-l border-blue-100 pl-2.5',
                      mini && 'lg:mt-1 lg:mb-1.5 lg:ml-0 lg:items-center lg:gap-1 lg:border-l-0 lg:pl-0',
                    )}
                  >
                    {items.map((item) => {
                      const Icon = item.icon
                      const badge = counts[item.to]
                      return (
                        <li key={item.to} className={cn(mini && 'lg:w-full')}>
                          <NavLink
                            to={item.to}
                            end={item.to === '/'}
                            onClick={onClose}
                            title={item.label}
                            className={({ isActive }) =>
                              cn(
                                'group relative flex items-center gap-2.5 rounded-xl px-1.5 py-1.5 text-[13.5px] font-medium transition-[background-color,color,translate,box-shadow] duration-200 ease-out',
                                isActive
                                  ? 'bg-linear-to-r from-[#f58a4e] via-[#ed7333] to-[#d9622a] font-semibold text-white shadow-[0_10px_22px_-8px_rgba(237,115,51,0.7)]'
                                  : 'text-silver-700 hover:translate-x-0.5 hover:bg-[#fff4ec] dark:hover:bg-white/[0.06] hover:text-navy-900',
                                mini && 'lg:h-11 lg:justify-center lg:px-0',
                              )
                            }
                          >
                            {({ isActive }) => (
                              <>
                                <span
                                  className={cn(
                                    'grid h-8 w-8 shrink-0 place-items-center rounded-[10px] transition-[transform,background-color] duration-200 group-hover:scale-105',
                                    isActive ? 'bg-white/25 text-white' : ICON_TONE[item.to] ?? 'bg-silver-100 text-silver-700',
                                  )}
                                >
                                  <Icon className="h-[17px] w-[17px]" />
                                </span>
                                <span className={cn('flex-1 truncate', mini && 'lg:hidden')}>{item.label}</span>
                                {badge ? (
                                  <span
                                    className={cn(
                                      'tnum rounded-full px-1.5 py-0.5 text-[10.5px] font-bold',
                                      isActive ? 'bg-white/30 text-white' : 'bg-[#fde3d3] text-[#b4501d] dark:bg-[#ed7333]/20 dark:text-[#f8aa77]',
                                      mini && 'lg:absolute lg:-top-1 lg:-right-1 lg:min-w-4 lg:px-1 lg:text-center',
                                    )}
                                  >
                                    <AnimatedNumber value={badge} />
                                  </span>
                                ) : null}
                              </>
                            )}
                          </NavLink>
                        </li>
                      )
                    })}
                  </ul>
                  </div>
                </div>
              </div>
            )
          })}
        </nav>
      </aside>
    </>
  )
}
