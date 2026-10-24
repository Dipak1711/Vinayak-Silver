import { Fragment } from 'react'
import { NavLink } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { useData } from '@/store/DataContext'
import { flowCounts, flowStepsFor } from '@/lib/flow'
import { cn } from '@/lib/utils'

/**
 * The order-to-delivery chain on one line: Raw Inventory, every production
 * stage, Packaging, Dispatch. Each step links to its page and shows how many
 * jobs are waiting there, so the whole flow is readable from any page in it.
 */
export function FlowStrip({ current }: { current: string }) {
  const { db } = useData()
  const counts = flowCounts(db)
  const steps = flowStepsFor(db)

  return (
    <nav
      aria-label="Production flow"
      className="overflow-x-auto rounded-2xl bg-surface/70 p-2 shadow-card ring-1 ring-white/60 backdrop-blur-xl dark:ring-white/10"
    >
      <ol className="flex min-w-max items-center gap-1">
        {steps.map((step, index) => {
          const Icon = step.icon
          const active = step.to === current
          const count = counts[step.to] ?? 0
          return (
            <Fragment key={step.to}>
              {index > 0 ? <ChevronRight className="h-4 w-4 shrink-0 text-silver-400" aria-hidden="true" /> : null}
              <li>
                <NavLink
                  to={step.to}
                  aria-current={active ? 'step' : undefined}
                  className={cn(
                    'group flex items-center gap-2 rounded-xl px-2.5 py-1.5 text-[12.5px] font-semibold transition-[background-color,color,translate,box-shadow] duration-200 ease-out',
                    active
                      ? 'bg-linear-to-r from-[#f58a4e] via-[#ed7333] to-[#d9622a] text-white shadow-[0_8px_18px_-8px_rgba(237,115,51,0.7)]'
                      : 'text-silver-700 hover:-translate-y-px hover:bg-[#fff4ec] hover:text-navy-900 dark:hover:bg-white/[0.06]',
                  )}
                >
                  <Icon className={cn('h-4 w-4 shrink-0', active ? 'text-white' : 'text-[#ed7333]')} />
                  <span className="whitespace-nowrap">{step.label}</span>
                  {count > 0 ? (
                    <span
                      className={cn(
                        'tnum rounded-full px-1.5 py-px text-[10.5px] font-bold',
                        active ? 'bg-white/30 text-white' : 'bg-[#fde3d3] text-[#b4501d] dark:bg-[#ed7333]/20 dark:text-[#f8aa77]',
                      )}
                    >
                      {count}
                    </span>
                  ) : null}
                </NavLink>
              </li>
            </Fragment>
          )
        })}
      </ol>
    </nav>
  )
}
