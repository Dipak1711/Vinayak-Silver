import type {
  AdvancePayment,
  Customer,
  Database,
  DispatchRecord,
  ID,
  Invoice,
  Lead,
  LineItem,
  ManufacturingJob,
  MaterialCategory,
  PackagingJob,
  Payment,
  Product,
  Quotation,
  RawMaterial,
  Supplier,
} from '@/types'
import { daysBetween, monthKey, todayISO } from '@/lib/utils'

/* ------------------------------------------------------------------ */
/* Line items & totals                                                 */
/* ------------------------------------------------------------------ */

export interface LineItemInput {
  id: string
  productId?: ID
  description: string
  quantity: number
  rate: number
  discount: number
  taxRate: number
}

export function buildLineItem(input: LineItemInput): LineItem {
  const gross = input.quantity * input.rate
  const discountAmount = (gross * input.discount) / 100
  const net = gross - discountAmount
  const tax = (net * input.taxRate) / 100
  return {
    id: input.id,
    productId: input.productId,
    description: input.description,
    quantity: input.quantity,
    rate: input.rate,
    discount: input.discount,
    taxRate: input.taxRate,
    gross,
    net,
    tax,
    total: net + tax,
  }
}

export interface Totals {
  subtotal: number
  discountAmount: number
  taxAmount: number
  total: number
}

export function computeTotals(items: LineItem[]): Totals {
  const subtotal = items.reduce((acc, item) => acc + item.gross, 0)
  const discountAmount = items.reduce((acc, item) => acc + (item.gross - item.net), 0)
  const taxAmount = items.reduce((acc, item) => acc + item.tax, 0)
  return {
    subtotal,
    discountAmount,
    taxAmount,
    total: subtotal - discountAmount + taxAmount,
  }
}

/* ------------------------------------------------------------------ */
/* Numbering                                                           */
/* ------------------------------------------------------------------ */

export const NUMBER_PREFIX = {
  quotation: 'QT',
  invoice: 'INV',
  order: 'ORD',
  manufacturing: 'MRJ',
  packaging: 'PKJ',
  dispatch: 'DSP',
  customer: 'CUST',
  supplier: 'SUP',
  product: 'VS',
  material: 'RM',
} as const

export function nextSeq(db: Database, key: string): number {
  const next = (db.counters[key] ?? 0) + 1
  db.counters[key] = next
  return next
}

export function documentNumber(prefix: string, seq: number, year = new Date().getFullYear()): string {
  return `${prefix}-${year}-${String(seq).padStart(4, '0')}`
}

export function codeNumber(prefix: string, seq: number): string {
  return `${prefix}-${String(seq).padStart(3, '0')}`
}

/* ------------------------------------------------------------------ */
/* Lookups                                                             */
/* ------------------------------------------------------------------ */

export function findCustomer(db: Database, id?: ID): Customer | undefined {
  return db.customers.find((customer) => customer.id === id)
}

export function findSupplier(db: Database, id?: ID): Supplier | undefined {
  return db.suppliers.find((supplier) => supplier.id === id)
}

export function findProduct(db: Database, id?: ID): Product | undefined {
  return db.products.find((product) => product.id === id)
}

export function findMaterial(db: Database, id?: ID): RawMaterial | undefined {
  return db.rawMaterials.find((material) => material.id === id)
}

export function findQuotation(db: Database, id?: ID): Quotation | undefined {
  return db.quotations.find((quotation) => quotation.id === id)
}

export function findInvoice(db: Database, id?: ID): Invoice | undefined {
  return db.invoices.find((invoice) => invoice.id === id)
}

export function customerName(db: Database, id?: ID): string {
  return findCustomer(db, id)?.companyName ?? 'Unknown customer'
}

export function customerLabel(db: Database, id: ID): { companyName: string; city: string } {
  const customer = findCustomer(db, id)
  return { companyName: customer?.companyName ?? 'Unknown customer', city: customer?.city ?? '' }
}

/* ------------------------------------------------------------------ */
/* Money                                                               */
/* ------------------------------------------------------------------ */

export function invoiceBalance(invoice: Invoice): number {
  return Math.max(invoice.total - invoice.amountPaid, 0)
}

/**
 * An invoice is 'Advance' while money has been received but the balance is
 * still open and every receipt so far was an advance; 'Partial' once a
 * non-advance part payment is recorded; 'Paid' when settled. `payments` is
 * optional so callers that only have the totals keep working.
 */
export function paymentStatusFor(total: number, paid: number, payments: Payment[] = []): Invoice['status'] {
  if (paid <= 0) return 'Unpaid'
  if (paid + 0.001 >= total) return 'Paid'
  return payments.some((payment) => payment.kind === 'Advance') ? 'Advance' : 'Partial'
}

/** Advances received for a customer that have not yet been applied to an invoice. */
export function unappliedAdvancesFor(db: Database, customerId: ID): AdvancePayment[] {
  return (db.advances ?? []).filter((advance) => advance.customerId === customerId)
}

export function customerOutstanding(db: Database, customerId: ID): number {
  const billed = db.invoices
    .filter((invoice) => invoice.customerId === customerId)
    .reduce((acc, invoice) => acc + invoiceBalance(invoice), 0)
  // Money already received on account reduces what the customer still owes, so
  // the outstanding figure always agrees with the ledger's closing balance.
  const advances = unappliedAdvancesFor(db, customerId).reduce((acc, advance) => acc + advance.amount, 0)
  return billed - advances
}

export function customerBilled(db: Database, customerId: ID): number {
  return db.invoices
    .filter((invoice) => invoice.customerId === customerId)
    .reduce((acc, invoice) => acc + invoice.total, 0)
}

export function supplierOutstanding(db: Database, supplierId: ID): number {
  return db.supplierTransactions
    .filter((tx) => tx.supplierId === supplierId)
    .reduce((acc, tx) => acc + (tx.type === 'Purchase' ? tx.amount : -tx.amount), 0)
}

export function supplierPurchased(db: Database, supplierId: ID): number {
  return db.supplierTransactions
    .filter((tx) => tx.supplierId === supplierId && tx.type === 'Purchase')
    .reduce((acc, tx) => acc + tx.amount, 0)
}

/* ------------------------------------------------------------------ */
/* Ledgers                                                             */
/* ------------------------------------------------------------------ */

export interface LedgerEntry {
  id: string
  date: string
  reference: string
  description: string
  debit: number
  credit: number
  balance: number
}

export function buildCustomerLedger(db: Database, customerId: ID): LedgerEntry[] {
  const invoiceIds = new Set(
    db.invoices.filter((invoice) => invoice.customerId === customerId).map((invoice) => invoice.id),
  )
  const rows: Array<Omit<LedgerEntry, 'balance'>> = []

  db.invoices
    .filter((invoice) => invoiceIds.has(invoice.id))
    .forEach((invoice) => {
      rows.push({
        id: `${invoice.id}_inv`,
        date: invoice.date,
        reference: invoice.number,
        description: `Sales invoice · order ${invoice.orderRef}`,
        debit: invoice.total,
        credit: 0,
      })
      invoice.payments.forEach((payment) => {
        rows.push({
          id: payment.id,
          date: payment.date,
          reference: `${invoice.number} / ${payment.mode}`,
          description: `${payment.kind === 'Advance' ? 'Advance received' : 'Payment received'}${payment.reference ? ` · ${payment.reference}` : ''}`,
          debit: 0,
          credit: payment.amount,
        })
      })
    })

  // Advances received before an invoice exists appear as credits here; once an
  // invoice is raised they move into invoice.payments, so they are never
  // counted twice.
  unappliedAdvancesFor(db, customerId).forEach((advance) => {
    rows.push({
      id: `adv_${advance.id}`,
      date: advance.date,
      reference: advance.reference || 'Advance',
      description: `Advance received${advance.orderRef ? ` · order ${advance.orderRef}` : ''}`,
      debit: 0,
      credit: advance.amount,
    })
  })

  rows.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))

  let balance = 0
  return rows.map((row) => {
    balance += row.debit - row.credit
    return { ...row, balance }
  })
}

export function buildSupplierLedger(db: Database, supplierId: ID): LedgerEntry[] {
  const rows: Array<Omit<LedgerEntry, 'balance'>> = db.supplierTransactions
    .filter((tx) => tx.supplierId === supplierId)
    .map((tx) => ({
      id: tx.id,
      date: tx.date,
      reference: tx.reference,
      description: tx.description,
      debit: tx.type === 'Payment' ? tx.amount : 0,
      credit: tx.type === 'Purchase' ? tx.amount : 0,
    }))

  rows.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))

  let balance = 0
  return rows.map((row) => {
    balance += row.credit - row.debit
    return { ...row, balance }
  })
}

export interface LedgerSummary {
  totalDebit: number
  totalCredit: number
  closing: number
}

export function ledgerSummary(entries: LedgerEntry[], useCreditMinusDebit = true): LedgerSummary {
  const totalDebit = entries.reduce((acc, entry) => acc + entry.debit, 0)
  const totalCredit = entries.reduce((acc, entry) => acc + entry.credit, 0)
  return {
    totalDebit,
    totalCredit,
    closing: useCreditMinusDebit ? totalCredit - totalDebit : totalDebit - totalCredit,
  }
}

/* ------------------------------------------------------------------ */
/* Inventory                                                           */
/* ------------------------------------------------------------------ */

export function isLowStock(material: RawMaterial): boolean {
  return material.quantity <= material.minStock
}

export function lowStockMaterials(db: Database): RawMaterial[] {
  return db.rawMaterials.filter(isLowStock)
}

export function stockValue(db: Database): number {
  return db.rawMaterials.reduce((acc, material) => acc + material.quantity * material.cost, 0)
}

export function categoryCounts(db: Database): Array<{ category: MaterialCategory; count: number }> {
  const map = new Map<MaterialCategory, number>()
  db.rawMaterials.forEach((material) => {
    map.set(material.category, (map.get(material.category) ?? 0) + 1)
  })
  return [...map.entries()].map(([category, count]) => ({ category, count }))
}

/* ------------------------------------------------------------------ */
/* Dashboard metrics                                                   */
/* ------------------------------------------------------------------ */

export interface DashboardMetrics {
  totalLeads: number
  openLeads: number
  wonLeads: number
  convertedLeads: number
  totalCustomers: number
  totalQuotations: number
  quotationsApproved: number
  quotationsPending: number
  totalInvoices: number
  invoiceValue: number
  amountCollected: number
  outstanding: number
  pendingOrders: number
  rawMaterialCount: number
  rawMaterialValue: number
  lowStockCount: number
  productionJobs: number
  activeProduction: number
  delayedProduction: number
  completedProduction: number
  pendingDispatches: number
  deliveredDispatches: number
  packagingPending: number
}

export function isOrderDelivered(db: Database, invoice: Invoice): boolean {
  const related = db.dispatches.filter((dispatch) => dispatch.invoiceId === invoice.id)
  if (related.length === 0) return false
  return related.every((dispatch) => dispatch.status === 'Delivered')
}

export function dashboardMetrics(db: Database): DashboardMetrics {
  const invoices = db.invoices
  const invoiceValue = invoices.reduce((acc, invoice) => acc + invoice.total, 0)
  const amountCollected = invoices.reduce((acc, invoice) => acc + invoice.amountPaid, 0)

  return {
    totalLeads: db.leads.length,
    openLeads: db.leads.filter((lead) => lead.stage !== 'Won' && lead.stage !== 'Lost').length,
    wonLeads: db.leads.filter((lead) => lead.stage === 'Won').length,
    convertedLeads: db.leads.filter((lead) => Boolean(lead.convertedCustomerId)).length,
    totalCustomers: db.customers.length,
    totalQuotations: db.quotations.length,
    quotationsApproved: db.quotations.filter((quotation) => quotation.status === 'Approved').length,
    quotationsPending: db.quotations.filter(
      (quotation) => quotation.status === 'Draft' || quotation.status === 'Sent',
    ).length,
    totalInvoices: invoices.length,
    invoiceValue,
    amountCollected,
    outstanding: Math.max(invoiceValue - amountCollected, 0),
    pendingOrders: invoices.filter((invoice) => !isOrderDelivered(db, invoice)).length,
    rawMaterialCount: db.rawMaterials.length,
    rawMaterialValue: stockValue(db),
    lowStockCount: lowStockMaterials(db).length,
    productionJobs: db.manufacturingJobs.length,
    activeProduction: db.manufacturingJobs.filter((job) => job.status === 'In Progress' || job.status === 'Pending')
      .length,
    delayedProduction: db.manufacturingJobs.filter((job) => job.status === 'Delayed').length,
    completedProduction: db.manufacturingJobs.filter((job) => job.status === 'Completed').length,
    pendingDispatches: db.dispatches.filter((dispatch) => dispatch.status !== 'Delivered').length,
    deliveredDispatches: db.dispatches.filter((dispatch) => dispatch.status === 'Delivered').length,
    packagingPending: db.packagingJobs.filter((job) => job.status !== 'Packed').length,
  }
}

export interface ChartPoint {
  name: string
  value: number
}

export function monthlySalesSeries(db: Database, months = 6): Array<{ name: string; invoiced: number; collected: number }> {
  const keys: string[] = []
  const cursor = new Date()
  cursor.setDate(1)
  for (let i = months - 1; i >= 0; i -= 1) {
    const date = new Date(cursor.getFullYear(), cursor.getMonth() - i, 1)
    keys.push(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`)
  }

  return keys.map((key) => {
    const invoices = db.invoices.filter((invoice) => monthKey(invoice.date) === key)
    return {
      name: shortMonth(key),
      invoiced: invoices.reduce((acc, invoice) => acc + invoice.total, 0),
      collected: invoices.reduce((acc, invoice) => acc + invoice.amountPaid, 0),
    }
  })
}

function shortMonth(key: string): string {
  const [year, month] = key.split('-')
  const date = new Date(Number(year), Number(month) - 1, 1)
  return date.toLocaleDateString('en-IN', { month: 'short' })
}

export function countBy<T, K extends string>(items: T[], selector: (item: T) => K): Array<{ name: K; value: number }> {
  const map = new Map<K, number>()
  items.forEach((item) => {
    const key = selector(item)
    map.set(key, (map.get(key) ?? 0) + 1)
  })
  return [...map.entries()].map(([name, value]) => ({ name, value }))
}

export function topCustomers(db: Database, limit = 5): Array<{ name: string; value: number }> {
  const map = new Map<ID, number>()
  db.invoices.forEach((invoice) => {
    map.set(invoice.customerId, (map.get(invoice.customerId) ?? 0) + invoice.total)
  })
  return [...map.entries()]
    .map(([id, value]) => ({ name: customerName(db, id), value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, limit)
}

/* ------------------------------------------------------------------ */
/* Pending tasks                                                       */
/* ------------------------------------------------------------------ */

export type TaskSeverity = 'high' | 'medium' | 'low'

export interface PendingTask {
  id: string
  label: string
  detail: string
  module: string
  to: string
  severity: TaskSeverity
}

export function pendingTasks(db: Database): PendingTask[] {
  const tasks: PendingTask[] = []
  const today = todayISO()

  db.leads
    .filter((lead) => lead.stage !== 'Won' && lead.stage !== 'Lost' && lead.followUpDate && lead.followUpDate <= today)
    .forEach((lead: Lead) => {
      tasks.push({
        id: `task_lead_${lead.id}`,
        label: `Follow up with ${lead.company}`,
        detail: `Follow-up was due on ${lead.followUpDate} · ${lead.assignedTo}`,
        module: 'Lead',
        to: '/leads',
        severity: 'high',
      })
    })

  lowStockMaterials(db).forEach((material) => {
    tasks.push({
      id: `task_stock_${material.id}`,
      label: `Reorder ${material.name}`,
      detail: `Only ${material.quantity} ${material.unit} left (min ${material.minStock})`,
      module: 'Raw Inventory',
      to: '/inventory',
      severity: 'high',
    })
  })

  db.manufacturingJobs
    .filter((job) => job.status === 'Delayed')
    .forEach((job: ManufacturingJob) => {
      tasks.push({
        id: `task_mfg_${job.id}`,
        label: `Production delayed · ${job.jobNumber}`,
        detail: `${job.productName} planned to finish by ${job.plannedEnd}${job.delayReason ? ` · ${job.delayReason}` : ''}`,
        module: 'Manufacturing',
        to: '/manufacturing',
        severity: 'high',
      })
    })

  db.invoices
    .filter((invoice) => invoice.status !== 'Paid' && invoice.dueDate < today)
    .forEach((invoice) => {
      tasks.push({
        id: `task_inv_${invoice.id}`,
        label: `Payment overdue · ${invoice.number}`,
        detail: `${customerName(db, invoice.customerId)} · due ${invoice.dueDate}`,
        module: 'Invoice',
        to: '/invoices',
        severity: 'medium',
      })
    })

  db.packagingJobs
    .filter((job) => job.status !== 'Packed')
    .forEach((job: PackagingJob) => {
      tasks.push({
        id: `task_pkg_${job.id}`,
        label: `Packaging pending · ${job.jobNumber}`,
        detail: `${job.productName} · ${job.packedQuantity}/${job.quantityToPack} packed`,
        module: 'Packaging',
        to: '/packaging',
        severity: 'medium',
      })
    })

  db.dispatches
    .filter((dispatch) => dispatch.status === 'Ready to Dispatch')
    .forEach((dispatch: DispatchRecord) => {
      tasks.push({
        id: `task_dsp_${dispatch.id}`,
        label: `Ready to dispatch · ${dispatch.number}`,
        detail: `${customerName(db, dispatch.customerId)} · ${dispatch.quantity} pcs`,
        module: 'Dispatch',
        to: '/dispatch',
        severity: 'low',
      })
    })

  const rank: Record<TaskSeverity, number> = { high: 0, medium: 1, low: 2 }
  return tasks.sort((a, b) => rank[a.severity] - rank[b.severity])
}

/* ------------------------------------------------------------------ */
/* Workflow helpers                                                    */
/* ------------------------------------------------------------------ */

export function orderProgress(db: Database, orderRef: string): {
  stages: Array<{ label: string; state: 'done' | 'active' | 'pending' }>
} {
  const invoice = db.invoices.find((item) => item.orderRef === orderRef)
  const jobs = db.manufacturingJobs.filter((job) => job.orderRef === orderRef)
  const packagingJobs = db.packagingJobs.filter((job) => job.orderRef === orderRef)
  const dispatches = db.dispatches.filter((dispatch) => dispatch.orderRef === orderRef)

  const manufacturingDone = jobs.length > 0 && jobs.every((job) => job.status === 'Completed')
  const packagingStarted = packagingJobs.length > 0
  const packagingDone = packagingJobs.length > 0 && packagingJobs.every((job) => job.readyForDispatch)
  const dispatchStarted = dispatches.some((dispatch) => dispatch.status !== 'Ready to Dispatch')
  const delivered = dispatches.length > 0 && dispatches.every((dispatch) => dispatch.status === 'Delivered')

  const done = {
    order: Boolean(invoice),
    manufacturing: jobs.length === 0 ? true : manufacturingDone,
    packaging: packagingDone,
    dispatch: delivered,
  }

  const order: Array<{ label: string; state: 'done' | 'active' | 'pending' }> = [
    { label: 'Order confirmed', state: done.order ? 'done' : 'pending' },
    {
      label: jobs.length === 0 ? 'Manufacturing (not required)' : 'Manufacturing',
      state: done.manufacturing ? 'done' : 'active',
    },
    {
      label: 'Packaging',
      state: packagingDone ? 'done' : packagingStarted ? 'active' : 'pending',
    },
    {
      label: 'Dispatch',
      state: delivered ? 'done' : dispatchStarted ? 'active' : 'pending',
    },
  ]
  return { stages: order }
}

export function overdueDays(dueDate: string): number {
  const today = todayISO()
  if (dueDate >= today) return 0
  return Math.abs(daysBetween(dueDate, today))
}
