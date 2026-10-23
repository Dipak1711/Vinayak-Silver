import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AlertTriangle,
  Boxes,
  ClipboardList,
  Factory,
  FileText,
  IndianRupee,
  LayoutDashboard,
  Receipt,
  Target,
  Truck,
  Users,
} from 'lucide-react'
import { PageHeader, EmptyState, ProgressBar } from '@/components/ui/Layout'
import { Card, CardHeader } from '@/components/ui/Card'
import { StatCard } from '@/components/ui/StatCard'
import { Badge, StatusBadge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { AnimatedNumber } from '@/components/ui/AnimatedNumber'
import { Sparkline } from '@/components/ui/Sparkline'
import { CategoryBarChart, DonutChart, SalesTrendChart } from '@/components/charts/Charts'
import { useData } from '@/store/DataContext'
import {
  countBy,
  dashboardMetrics,
  lowStockMaterials,
  monthlySalesSeries,
  pendingTasks,
  topCustomers,
} from '@/lib/calc'
import { LEAD_STAGES, MFG_STAGES } from '@/types'
import { cn, formatCurrency, formatDateTime, formatNumber, percentage, todayISO } from '@/lib/utils'

function pctChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0
  return ((current - previous) / previous) * 100
}

export function DashboardPage() {
  const { db } = useData()
  const navigate = useNavigate()

  const metrics = useMemo(() => dashboardMetrics(db), [db])
  const sales = useMemo(() => monthlySalesSeries(db, 6), [db])
  const leadStages = useMemo(
    () => LEAD_STAGES.map((stage) => ({ name: stage, value: db.leads.filter((lead) => lead.stage === stage).length })),
    [db.leads],
  )
  const productionStages = useMemo(
    () =>
      MFG_STAGES.map((stage) => ({
        name: stage,
        value: db.manufacturingJobs.filter((job) => job.stage === stage).length,
      })),
    [db.manufacturingJobs],
  )
  const dispatchStatus = useMemo(() => countBy(db.dispatches, (dispatch) => dispatch.status), [db.dispatches])
  const tasks = useMemo(() => pendingTasks(db), [db])
  const lowStock = useMemo(() => lowStockMaterials(db), [db])
  const customers = useMemo(() => topCustomers(db, 5), [db])
  const recent = useMemo(
    () => [...db.activities].sort((a, b) => (a.at < b.at ? 1 : -1)).slice(0, 7),
    [db.activities],
  )

  const invoicedSpark = useMemo(() => sales.map((point) => point.invoiced), [sales])
  const overdueInvoices = useMemo(
    () => db.invoices.filter((invoice) => invoice.status !== 'Paid' && invoice.dueDate < todayISO()).length,
    [db.invoices],
  )

  const invoicedTrend = pctChange(sales.at(-1)?.invoiced ?? 0, sales.at(-2)?.invoiced ?? 0)
  const collectedTrend = pctChange(sales.at(-1)?.collected ?? 0, sales.at(-2)?.collected ?? 0)

  const collectedRate = percentage(metrics.amountCollected, metrics.invoiceValue)
  const highSeverity = tasks.filter((task) => task.severity === 'high').length

  return (
    <>
      <PageHeader
        eyebrow="Operations overview"
        icon={<LayoutDashboard className="h-5 w-5" />}
        title="Dashboard"
        actions={
          <>
            <div className="mr-1 hidden items-center gap-2 rounded-xl border border-silver-200 bg-surface px-3 py-1.5 shadow-flat lg:flex">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              <span className="text-[11px] font-semibold text-silver-600">
                {metrics.activeProduction} jobs in production
              </span>
            </div>
            <Button variant="outline" icon={<FileText className="h-4 w-4" />} onClick={() => navigate('/quotations')}>
              New quotation
            </Button>
            <Button icon={<Receipt className="h-4 w-4" />} onClick={() => navigate('/invoices')}>
              New invoice
            </Button>
          </>
        }
      />

      {/* ---------------- Hero band ---------------- */}
      <Card variant="dark" padded={false} className="overflow-hidden">
        <div className="relative p-4 lg:p-5">
          {/* Decorative trend wash, pinned to the bottom edge so it never
              crosses the figures it sits behind. */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-14 opacity-35" aria-hidden="true">
            <Sparkline data={invoicedSpark} tone="gold" height={56} />
          </div>

          <div className="relative flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-[20px] font-bold tracking-[-0.02em] text-white lg:text-[25px]">
                Revenue and fulfilment at a glance
              </h2>
            </div>
            <div className="flex items-center gap-2 rounded-xl border border-white/15 bg-white/10 px-3 py-2 backdrop-blur">
              <IndianRupee className="h-4 w-4 text-gold-300" aria-hidden="true" />
              <span className="text-xs font-semibold text-white/90">
                {metrics.totalInvoices} invoices · {metrics.pendingOrders} orders open
              </span>
            </div>
          </div>

          <div className="relative mt-5">
            <div className="flex items-center justify-between gap-3">
              <span className="text-[11px] font-bold tracking-[0.08em] text-white/70 uppercase">Collection rate</span>
              <span className="tnum text-[11px] font-bold text-emerald-300">{collectedRate}% realised</span>
            </div>
            <ProgressBar value={collectedRate} tone="emerald" track="bg-white/25" className="mt-2" />
          </div>

          <div className="relative mt-5 grid gap-x-6 gap-y-5 sm:grid-cols-3">
            <div className="min-w-0">
              <p className="text-[11px] font-bold tracking-[0.08em] text-white/70 uppercase">Invoiced value</p>
              <div className="mt-1.5 flex flex-wrap items-baseline gap-2">
                <span className="tnum text-[26px] leading-none font-bold tracking-[-0.03em] text-white">
                  <AnimatedNumber value={metrics.invoiceValue} format={(value) => formatCurrency(value, true)} />
                </span>
                <span
                  className={cn(
                    'tnum rounded-full px-1.5 py-0.5 text-[10.5px] font-bold',
                    invoicedTrend >= 0 ? 'bg-emerald-400/20 text-emerald-300' : 'bg-rose-400/20 text-rose-300',
                  )}
                >
                  {invoicedTrend >= 0 ? '+' : ''}
                  {invoicedTrend.toFixed(1)}%
                </span>
              </div>
            </div>

            <div className="min-w-0">
              <p className="text-[11px] font-bold tracking-[0.08em] text-white/70 uppercase">Collected</p>
              <div className="mt-1.5 flex flex-wrap items-baseline gap-2">
                <span className="tnum text-[26px] leading-none font-bold tracking-[-0.03em] text-emerald-300">
                  <AnimatedNumber value={metrics.amountCollected} format={(value) => formatCurrency(value, true)} />
                </span>
                <span
                  className={cn(
                    'tnum rounded-full px-1.5 py-0.5 text-[10.5px] font-bold',
                    collectedTrend >= 0 ? 'bg-emerald-400/20 text-emerald-300' : 'bg-rose-400/20 text-rose-300',
                  )}
                >
                  {collectedTrend >= 0 ? '+' : ''}
                  {collectedTrend.toFixed(1)}%
                </span>
              </div>
            </div>

            <div className="min-w-0">
              <p className="text-[11px] font-bold tracking-[0.08em] text-white/70 uppercase">Outstanding</p>
              <div className="mt-1.5 flex flex-wrap items-baseline gap-2">
                <span className="tnum text-[26px] leading-none font-bold tracking-[-0.03em] text-gold-300">
                  <AnimatedNumber value={metrics.outstanding} format={(value) => formatCurrency(value, true)} />
                </span>
                <span
                  className={cn(
                    'tnum rounded-full px-1.5 py-0.5 text-[10.5px] font-bold',
                    overdueInvoices > 0 ? 'bg-rose-400/20 text-rose-300' : 'bg-emerald-400/20 text-emerald-300',
                  )}
                >
                  {overdueInvoices > 0 ? `${overdueInvoices} overdue` : 'current'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* ---------------- Primary KPIs ---------------- */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total leads"
          value={metrics.totalLeads}
          hint={`${metrics.openLeads} open · ${metrics.wonLeads} won`}
          icon={<Target className="h-4.5 w-4.5" />}
          tone="blue"
          onClick={() => navigate('/leads')}
        />
        <StatCard
          label="Customers"
          value={metrics.totalCustomers}
          hint={`${metrics.convertedLeads} converted from leads`}
          icon={<Users className="h-4.5 w-4.5" />}
          tone="violet"
          onClick={() => navigate('/customers')}
        />
        <StatCard
          label="Quotations"
          value={metrics.totalQuotations}
          hint={`${metrics.quotationsApproved} approved · ${metrics.quotationsPending} open`}
          icon={<FileText className="h-4.5 w-4.5" />}
          tone="cyan"
          onClick={() => navigate('/quotations')}
        />
        <StatCard
          label="Invoices raised"
          value={metrics.totalInvoices}
          hint={`${formatCurrency(metrics.invoiceValue, true)} invoiced`}
          icon={<Receipt className="h-4.5 w-4.5" />}
          tone="emerald"
          spark={invoicedSpark}
          trend={{ value: invoicedTrend }}
          onClick={() => navigate('/invoices')}
        />
      </div>

      {/* ---------------- Operational KPIs ---------------- */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Pending orders"
          value={metrics.pendingOrders}
          hint={`${metrics.deliveredDispatches} delivered so far`}
          icon={<ClipboardList className="h-4.5 w-4.5" />}
          tone="amber"
          onClick={() => navigate('/invoices')}
        />
        <StatCard
          label="Raw material stock"
          value={metrics.rawMaterialValue}
          format={(value) => formatCurrency(value, true)}
          hint={`${formatNumber(metrics.rawMaterialCount)} materials · ${metrics.lowStockCount} low`}
          icon={<Boxes className="h-4.5 w-4.5" />}
          tone={metrics.lowStockCount > 0 ? 'amber' : 'navy'}
          onClick={() => navigate('/inventory')}
        />
        <StatCard
          label="Production jobs"
          value={metrics.productionJobs}
          hint={`${metrics.activeProduction} active · ${metrics.delayedProduction} delayed`}
          icon={<Factory className="h-4.5 w-4.5" />}
          tone="blue"
          onClick={() => navigate('/manufacturing')}
        />
        <StatCard
          label="Pending dispatches"
          value={metrics.pendingDispatches}
          hint={`${metrics.packagingPending} packaging jobs open`}
          icon={<Truck className="h-4.5 w-4.5" />}
          tone="rose"
          onClick={() => navigate('/dispatch')}
        />
      </div>

      {/* ---------------- Charts ---------------- */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader
            accent="sapphire"
            title="Sales performance"
            subtitle="Invoiced value against amount collected, last six months"
            action={<Badge tone={collectedRate >= 70 ? 'success' : 'warning'}>{collectedRate}% collected</Badge>}
          />
          <div className="mt-4">
            <SalesTrendChart data={sales} />
          </div>
        </Card>

        <Card>
          <CardHeader accent="gold" title="Leads by stage" subtitle="Pipeline distribution" />
          <div className="mt-2">
            <DonutChart data={leadStages} centerLabel="Leads" />
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader accent="sapphire" title="Production jobs by stage" subtitle="Where work is sitting on the shop floor" />
          <div className="mt-4">
            <CategoryBarChart data={productionStages} color="#247f75" />
          </div>
        </Card>

        <Card>
          <CardHeader accent="emerald" title="Dispatch status" subtitle="Shipment progress" />
          <div className="mt-2">
            <DonutChart data={dispatchStatus} centerLabel="Shipments" />
          </div>
        </Card>
      </div>

      {/* ---------------- Attention row ---------------- */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card padded={false} className="flex flex-col">
          <div className="flex items-center justify-between gap-2 border-b border-silver-200 px-5 py-4">
            <div>
              <h3 className="flex items-center gap-2 text-[13px] font-bold text-navy-900">
                <span className="h-3.5 w-1 rounded-full bg-linear-to-b from-rose-500 to-rose-700" aria-hidden="true" />
                Pending tasks
              </h3>
              <p className="mt-0.5 text-xs text-silver-600">
                {tasks.length} items need attention · {highSeverity} urgent
              </p>
            </div>
            <Button size="sm" variant="ghost" onClick={() => navigate('/reports')}>
              Reports
            </Button>
          </div>
          <div className="max-h-[380px] flex-1 overflow-y-auto px-5">
            {tasks.length === 0 ? (
              <EmptyState
                icon={<ClipboardList className="h-5 w-5" />}
                title="Nothing pending"
                description="All follow-ups, stock levels and shipments are on track."
              />
            ) : (
              <ul className="divide-y divide-silver-200">
                {tasks.slice(0, 8).map((task) => (
                  <li key={task.id} className="flex items-start gap-3 py-2.5">
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
                    <button type="button" onClick={() => navigate(task.to)} className="min-w-0 flex-1 text-left">
                      <span className="block truncate text-[13px] font-medium text-navy-900 transition-colors hover:text-blue-700">
                        {task.label}
                      </span>
                      <span className="block truncate text-xs text-silver-600">{task.detail}</span>
                    </button>
                    <Badge tone="silver">{task.module}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>

        <Card padded={false} className="flex flex-col">
          <div className="border-b border-silver-200 px-5 py-4">
            <h3 className="flex items-center gap-2 text-[13px] font-bold text-navy-900">
              <span className="h-3.5 w-1 rounded-full bg-linear-to-b from-amber-400 to-amber-600" aria-hidden="true" />
              Low stock alerts
            </h3>
            <p className="mt-0.5 text-xs text-silver-600">Materials at or below their minimum level</p>
          </div>
          <div className="px-5">
            {lowStock.length === 0 ? (
              <EmptyState
                icon={<Boxes className="h-5 w-5" />}
                title="Stock levels healthy"
                description="No material has dropped below its minimum level."
              />
            ) : (
              <ul className="divide-y divide-silver-200">
                {lowStock.map((material) => {
                  const fill = material.minStock > 0 ? Math.min((material.quantity / material.minStock) * 100, 100) : 0
                  return (
                    <li key={material.id} className="py-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="truncate text-[13px] font-medium text-navy-900">{material.name}</p>
                        <Badge tone="danger">Reorder</Badge>
                      </div>
                      <p className="mt-0.5 text-xs text-silver-600">
                        {material.quantity} {material.unit} on hand · minimum {material.minStock} {material.unit}
                      </p>
                      <ProgressBar value={fill} tone="rose" className="mt-2" />
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </Card>

        <Card padded={false} className="flex flex-col">
          <div className="border-b border-silver-200 px-5 py-4">
            <h3 className="flex items-center gap-2 text-[13px] font-bold text-navy-900">
              <span className="h-3.5 w-1 rounded-full bg-linear-to-b from-blue-500 to-blue-700" aria-hidden="true" />
              Recent activity
            </h3>
            <p className="mt-0.5 text-xs text-silver-600">Latest changes across every module</p>
          </div>
          <ol className="relative flex flex-col gap-4 px-5 py-4">
            <span className="absolute top-6 bottom-6 left-[26px] w-px bg-silver-200" aria-hidden="true" />
            {recent.map((activity, index) => (
              <li key={activity.id} className="relative flex gap-3">
                <span
                  className={cn(
                    'relative z-10 mt-1 h-2.5 w-2.5 shrink-0 rounded-full ring-4 ring-surface',
                    index === 0 ? 'bg-blue-600' : 'bg-silver-300',
                  )}
                  aria-hidden="true"
                />
                <div className="min-w-0">
                  <p className="text-[13px] leading-snug text-navy-800">{activity.message}</p>
                  <p className="mt-0.5 text-[11px] text-silver-600">
                    <span className="font-semibold text-silver-600">{activity.module}</span> ·{' '}
                    {formatDateTime(activity.at)}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </Card>
      </div>

      {/* ---------------- Bottom row ---------------- */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader
            accent="gold"
            title="Top customers by invoiced value"
            subtitle="Calculated from every invoice stored in this browser"
            action={
              <Button size="sm" variant="outline" icon={<IndianRupee className="h-3.5 w-3.5" />} onClick={() => navigate('/reports')}>
                Open ledger
              </Button>
            }
          />
          <div className="mt-4">
            {customers.length === 0 ? (
              <EmptyState title="No invoices yet" description="Once invoices are raised, top customers appear here." />
            ) : (
              <CategoryBarChart
                data={customers}
                color="#d97706"
                horizontal
                currency
                height={Math.max(200, customers.length * 46)}
              />
            )}
          </div>
        </Card>

        <Card>
          <CardHeader accent="sapphire" title="Status vocabulary" subtitle="Every state uses one consistent treatment" />
          <div className="mt-4 grid grid-cols-2 gap-2">
            {[
              { label: 'Leads', value: db.leads.length },
              { label: 'Customers', value: db.customers.length },
              { label: 'Suppliers', value: db.suppliers.length },
              { label: 'Products', value: db.products.length },
              { label: 'Materials', value: db.rawMaterials.length },
              { label: 'Movements', value: db.stockMovements.length },
              { label: 'Quotations', value: db.quotations.length },
              { label: 'Invoices', value: db.invoices.length },
              { label: 'Jobs', value: db.manufacturingJobs.length },
              { label: 'Dispatches', value: db.dispatches.length },
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-xl border border-silver-200 bg-linear-to-b from-silver-50 to-surface px-3 py-2 shadow-flat"
              >
                <p className="text-[10px] font-bold tracking-[0.06em] text-silver-600 uppercase">{item.label}</p>
                <p className="tnum text-lg leading-tight font-bold text-navy-900">{item.value}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-1.5">
            {['Won', 'Approved', 'Partial', 'In Progress', 'Packed', 'In Transit'].map((status) => (
              <StatusBadge key={status} status={status} />
            ))}
          </div>
        </Card>
      </div>

      {metrics.lowStockCount > 0 ? (
        <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-linear-to-r from-amber-50 to-surface px-4 py-3 text-xs text-amber-900 shadow-flat">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden="true" />
          <p>
            <span className="font-semibold">Stock attention needed.</span> {metrics.lowStockCount} material(s) are at or
            below their minimum level and may block upcoming production jobs.
          </p>
        </div>
      ) : null}
    </>
  )
}
