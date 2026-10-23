import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Bell, Command, Menu, Moon, PanelLeftClose, PanelLeftOpen, Search, Sun } from 'lucide-react'
import { useData } from '@/store/DataContext'
import { useClickOutside, useTheme } from '@/hooks'
import { pendingTasks } from '@/lib/calc'
import { cn, formatCurrency, formatDate, todayISO } from '@/lib/utils'

interface SearchResult {
  id: string
  label: string
  sub: string
  to: string
  group: string
}

export function Topbar({
  onMenuClick,
  onToggleCollapse,
  mini,
}: {
  onMenuClick: () => void
  onToggleCollapse: () => void
  mini: boolean
}) {
  const { db } = useData()
  const { theme, toggle: toggleTheme } = useTheme()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const [bellOpen, setBellOpen] = useState(false)
  const searchInputRef = useRef<HTMLInputElement | null>(null)

  const searchRef = useClickOutside<HTMLDivElement>(() => setSearchOpen(false))
  const bellRef = useClickOutside<HTMLDivElement>(() => setBellOpen(false))

  const tasks = useMemo(() => pendingTasks(db), [db])
  const urgentCount = tasks.filter((task) => task.severity === 'high').length

  // ⌘K / Ctrl+K focuses search from anywhere. A real shortcut, not a hint.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        searchInputRef.current?.focus()
        setSearchOpen(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const index = useMemo<SearchResult[]>(
    () => [
      ...db.customers.map((customer) => ({
        id: customer.id,
        label: customer.companyName,
        sub: `${customer.code} · ${customer.city}`,
        to: '/customers',
        group: 'Customer',
      })),
      ...db.quotations.map((quotation) => ({
        id: quotation.id,
        label: quotation.number,
        sub: `${db.customers.find((c) => c.id === quotation.customerId)?.companyName ?? ''} · ${formatCurrency(quotation.total, true)}`,
        to: '/quotations',
        group: 'Quotation',
      })),
      ...db.invoices.map((invoice) => ({
        id: invoice.id,
        label: invoice.number,
        sub: `${db.customers.find((c) => c.id === invoice.customerId)?.companyName ?? ''} · ${invoice.status}`,
        to: '/invoices',
        group: 'Invoice',
      })),
      ...db.leads.map((lead) => ({
        id: lead.id,
        label: lead.company,
        sub: `${lead.stage} · ${lead.assignedTo}`,
        to: '/leads',
        group: 'Lead',
      })),
      ...db.products.map((product) => ({
        id: product.id,
        label: product.name,
        sub: `${product.sku} · ${formatCurrency(product.rate)}`,
        to: '/inventory',
        group: 'Product',
      })),
      ...db.suppliers.map((supplier) => ({
        id: supplier.id,
        label: supplier.name,
        sub: `${supplier.code} · ${supplier.city}`,
        to: '/suppliers',
        group: 'Supplier',
      })),
    ],
    [db],
  )

  const results = useMemo(() => {
    const term = query.trim().toLowerCase()
    if (!term) return []
    return index
      .filter((entry) => `${entry.label} ${entry.sub} ${entry.group}`.toLowerCase().includes(term))
      .slice(0, 8)
  }, [index, query])

  useEffect(() => {
    setActiveIndex(0)
  }, [query])

  const openResult = (result: SearchResult) => {
    navigate(result.to, { state: { focusId: result.id } })
    setQuery('')
    setSearchOpen(false)
  }

  const onSearchKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setSearchOpen(true)
      setActiveIndex((current) => Math.min(current + 1, Math.max(results.length - 1, 0)))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActiveIndex((current) => Math.max(current - 1, 0))
    } else if (event.key === 'Enter' && results[activeIndex]) {
      event.preventDefault()
      openResult(results[activeIndex])
    } else if (event.key === 'Escape') {
      setSearchOpen(false)
      event.currentTarget.blur()
    }
  }

  return (
    <header className="no-print sticky top-0 z-20 flex h-[68px] items-center gap-3 border-b border-silver-200 bg-surface/85 px-4 backdrop-blur-xl lg:px-9">
      <button
        type="button"
        onClick={onMenuClick}
        className="hit pressable grid h-10 w-10 shrink-0 place-items-center rounded-full border border-silver-200 bg-surface text-navy-700 shadow-flat transition-colors hover:bg-silver-50 lg:hidden"
        aria-label="Open navigation"
      >
        <Menu className="h-5 w-5" />
      </button>

      <button
        type="button"
        onClick={onToggleCollapse}
        className="hit pressable hidden h-10 w-10 shrink-0 place-items-center rounded-full border border-silver-200 bg-surface text-navy-700 shadow-flat transition-colors hover:bg-silver-50 lg:grid"
        aria-label={mini ? 'Expand sidebar' : 'Collapse sidebar'}
        title={mini ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {mini ? <PanelLeftOpen className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
      </button>

      <div ref={searchRef} className="relative w-full max-w-md">
        <Search
          className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-silver-500"
          aria-hidden="true"
        />
        <input
          ref={searchInputRef}
          value={query}
          role="combobox"
          aria-expanded={searchOpen && Boolean(query.trim())}
          aria-controls="topbar-search-results"
          aria-autocomplete="list"
          aria-label="Search customers, quotations, invoices and more"
          onChange={(event) => {
            setQuery(event.target.value)
            setSearchOpen(true)
          }}
          onFocus={() => setSearchOpen(true)}
          onKeyDown={onSearchKeyDown}
          placeholder="Search customers, quotations, invoices…"
          className="h-11 w-full rounded-[14px] border border-silver-200 bg-silver-50 pr-16 pl-10 text-[16px] text-navy-900 transition-[border-color,box-shadow,background-color] duration-150 placeholder:text-silver-600 hover:border-silver-300 focus:border-blue-500 focus:bg-surface focus:ring-2 focus:ring-blue-100 focus:outline-none sm:text-sm"
        />
        <kbd className="pointer-events-none absolute top-1/2 right-2.5 hidden -translate-y-1/2 items-center gap-0.5 rounded-md border border-silver-200 bg-surface px-1.5 py-0.5 text-[10px] font-semibold text-silver-600 sm:flex">
          <Command className="h-2.5 w-2.5" />K
        </kbd>

        {searchOpen && query.trim() ? (
          <div
            id="topbar-search-results"
            role="listbox"
            className="animate-pop-in absolute inset-x-0 top-12 z-30 origin-top overflow-hidden rounded-xl bg-surface shadow-panel"
          >
            {results.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-silver-600">No matching records found.</p>
            ) : (
              <ul className="max-h-80 divide-y divide-silver-200 overflow-y-auto">
                {results.map((result, i) => (
                  <li key={`${result.group}-${result.id}`} role="option" aria-selected={i === activeIndex}>
                    <button
                      type="button"
                      onMouseEnter={() => setActiveIndex(i)}
                      onClick={() => openResult(result)}
                      className={cn(
                        'flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors',
                        i === activeIndex ? 'bg-blue-50' : 'hover:bg-silver-50',
                      )}
                    >
                      <span className="rounded-md bg-silver-100 px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-silver-600 uppercase">
                        {result.group}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-medium text-navy-900">{result.label}</span>
                        <span className="block truncate text-xs text-silver-600">{result.sub}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : null}
      </div>

      <div className="ml-auto flex items-center gap-2 sm:gap-3">
        <button
          type="button"
          onClick={toggleTheme}
          className="hit pressable grid h-10 w-10 place-items-center rounded-full border border-silver-200 bg-surface text-navy-700 shadow-flat transition-colors hover:bg-silver-50"
          aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </button>

        <div ref={bellRef} className="relative">
          <button
            type="button"
            onClick={() => setBellOpen((value) => !value)}
            aria-expanded={bellOpen}
            aria-label={`Pending tasks: ${tasks.length}`}
            className={cn(
              'hit pressable relative grid h-10 w-10 place-items-center rounded-full border border-silver-200 bg-surface text-navy-700 shadow-flat transition-colors hover:bg-silver-50',
              urgentCount > 0 && !bellOpen && 'animate-pulse-ring',
            )}
          >
            <Bell className="h-5 w-5" />
            {tasks.length > 0 ? (
              <span className="tnum absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-linear-to-b from-rose-500 to-rose-600 px-1 text-[10px] font-bold text-white ring-2 ring-surface">
                {tasks.length > 9 ? '9+' : tasks.length}
              </span>
            ) : null}
          </button>
          {bellOpen ? (
            <div className="animate-pop-in absolute right-0 top-12 z-30 w-[min(360px,calc(100vw-2rem))] origin-top-right overflow-hidden rounded-xl bg-surface shadow-panel">
              <div className="flex items-center justify-between border-b border-silver-100 bg-silver-50/70 px-4 py-3">
                <p className="text-[13px] font-bold text-navy-900">Pending tasks</p>
                <span className="text-xs text-silver-600">{formatDate(todayISO())}</span>
              </div>
              {tasks.length === 0 ? (
                <p className="px-4 py-6 text-center text-sm text-silver-600">Nothing pending. All caught up.</p>
              ) : (
                <ul className="max-h-80 divide-y divide-silver-200 overflow-y-auto">
                  {tasks.slice(0, 6).map((task) => (
                    <li key={task.id}>
                      <Link
                        to={task.to}
                        onClick={() => setBellOpen(false)}
                        className="flex items-start gap-3 px-4 py-3 transition-colors hover:bg-silver-50"
                      >
                        <span
                          className={cn(
                            'mt-1.5 h-2 w-2 shrink-0 rounded-full',
                            task.severity === 'high'
                              ? 'bg-rose-500'
                              : task.severity === 'medium'
                                ? 'bg-amber-500'
                                : 'bg-blue-500',
                          )}
                          aria-hidden="true"
                        />
                        <span className="min-w-0">
                          <span className="block truncate text-[13px] font-medium text-navy-900">{task.label}</span>
                          <span className="block truncate text-xs text-silver-600">{task.detail}</span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
              {tasks.length > 6 ? (
                <Link
                  to="/reports"
                  onClick={() => setBellOpen(false)}
                  className="block border-t border-silver-100 px-4 py-2.5 text-center text-xs font-bold text-blue-700 transition-colors hover:bg-silver-50"
                >
                  View all {tasks.length} pending items
                </Link>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="flex items-center gap-2.5 rounded-full border border-silver-200 bg-surface py-1 pr-3.5 pl-1 shadow-flat">
          <span className="grid h-8 w-8 place-items-center rounded-full bg-linear-to-br from-blue-500 to-blue-700 text-[10.5px] font-bold text-white shadow-[inset_0_1px_0_0_rgba(255,255,255,0.25)]">
            PS
          </span>
          <span className="hidden leading-tight sm:block">
            <span className="block text-[11.5px] font-bold text-navy-900">Priya Sharma</span>
            <span className="block text-[10px] text-silver-600">Sales Manager</span>
          </span>
        </div>
      </div>
    </header>
  )
}
