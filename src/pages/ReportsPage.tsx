import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import {
  BarChart3,
  Boxes,
  Factory,
  FileSpreadsheet,
  FileText,
  PackageOpen,
  Receipt,
  Truck,
  Users,
} from 'lucide-react'
import { PageHeader, EmptyState, SearchInput, Toolbar } from '@/components/ui/Layout'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge, StatusBadge } from '@/components/ui/Badge'
import { Field, Input, Select } from '@/components/ui/Form'
import { StatCard } from '@/components/ui/StatCard'
import { SegmentedTabs } from '@/components/ui/SegmentedTabs'
import { TBody, THead, Td, Th, TR, Table, TableEmptyRow, TableShell } from '@/components/ui/Table'
import { useData } from '@/store/DataContext'
import { useToast } from '@/store/ToastContext'
import {
  buildCustomerLedger,
  buildSupplierLedger,
  customerName,
  invoiceBalance,
  ledgerSummary,
  supplierOutstanding,
} from '@/lib/calc'
import { MFG_STAGES } from '@/types'
import { downloadCSV, formatCurrency, formatDate, formatNumber, todayISO } from '@/lib/utils'

type ReportKey =
  | 'sales'
  | 'quotation'
  | 'invoice'
  | 'inventory'
  | 'manufacturing'
  | 'packaging'
  | 'dispatch'
  | 'customerLedger'
  | 'supplierLedger'

interface ReportRow {
  id: string
  date: string
  [key: string]: unknown
}

interface Column {
  key: string
  label: string
  align?: 'left' | 'right' | 'center'
  render?: (row: ReportRow) => ReactNode
  csv?: (row: ReportRow) => string | number
}

interface ReportDefinition {
  key: ReportKey
  label: string
  icon: ReactNode
  description: string
}

const REPORTS: ReportDefinition[] = [
  { key: 'sales', label: 'Sales report', icon: <BarChart3 className="h-4 w-4" />, description: 'Customer wise sales, collection and outstanding' },
  { key: 'quotation', label: 'Quotation report', icon: <FileText className="h-4 w-4" />, description: 'Quotation register with status and value' },
  { key: 'invoice', label: 'Invoice report', icon: <Receipt className="h-4 w-4" />, description: 'Invoice register with balances due' },
  { key: 'inventory', label: 'Inventory report', icon: <Boxes className="h-4 w-4" />, description: 'Raw material stock position and value' },
  { key: 'manufacturing', label: 'Manufacturing report', icon: <Factory className="h-4 w-4" />, description: 'Production jobs, stages and progress' },
  { key: 'packaging', label: 'Packaging report', icon: <PackageOpen className="h-4 w-4" />, description: 'Packing progress and dispatch readiness' },
  { key: 'dispatch', label: 'Dispatch report', icon: <Truck className="h-4 w-4" />, description: 'Shipment register with courier status' },
  { key: 'customerLedger', label: 'Customer ledger', icon: <Users className="h-4 w-4" />, description: 'Debit, credit and running balance by customer' },
  { key: 'supplierLedger', label: 'Supplier ledger', icon: <FileSpreadsheet className="h-4 w-4" />, description: 'Purchases, payments and payable balance' },
]

export function ReportsPage() {
  const { db } = useData()
  const toast = useToast()

  const [report, setReport] = useState<ReportKey>('sales')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [search, setSearch] = useState('')
  const [customerId, setCustomerId] = useState(db.customers[0]?.id ?? '')
  const [supplierId, setSupplierId] = useState(db.suppliers[0]?.id ?? '')

  const active = REPORTS.find((item) => item.key === report) ?? REPORTS[0]

  const inRange = (date: string) => {
    if (fromDate && date < fromDate) return false
    if (toDate && date > toDate) return false
    return true
  }

  const { columns, rows, summary } = useMemo(() => {
    const build = (): { columns: Column[]; rows: ReportRow[]; summary: Array<{ label: string; value: string }> } => {
      switch (report) {
        case 'sales': {
          const data: ReportRow[] = db.customers.map((customer) => {
            const invoices = db.invoices.filter((invoice) => invoice.customerId === customer.id)
            const invoiced = invoices.reduce((acc, invoice) => acc + invoice.total, 0)
            const collected = invoices.reduce((acc, invoice) => acc + invoice.amountPaid, 0)
            return {
              id: customer.id,
              date: invoices[0]?.date ?? customer.createdAt.slice(0, 10),
              customer: customer.companyName,
              city: customer.city,
              invoices: invoices.length,
              invoiced,
              collected,
              outstanding: invoiced - collected,
            }
          })
          return {
            columns: [
              { key: 'customer', label: 'Customer' },
              { key: 'city', label: 'City' },
              { key: 'invoices', label: 'Invoices', align: 'right' },
              { key: 'invoiced', label: 'Invoiced', align: 'right', render: (row) => formatCurrency(Number(row.invoiced)) },
              { key: 'collected', label: 'Collected', align: 'right', render: (row) => formatCurrency(Number(row.collected)) },
              {
                key: 'outstanding',
                label: 'Outstanding',
                align: 'right',
                render: (row) => (
                  <span className={Number(row.outstanding) > 0 ? 'font-semibold text-rose-600' : 'text-silver-600'}>
                    {formatCurrency(Number(row.outstanding))}
                  </span>
                ),
              },
            ],
            rows: data,
            summary: [
              { label: 'Total invoiced', value: formatCurrency(data.reduce((a, r) => a + Number(r.invoiced), 0), true) },
              { label: 'Total collected', value: formatCurrency(data.reduce((a, r) => a + Number(r.collected), 0), true) },
              { label: 'Outstanding', value: formatCurrency(data.reduce((a, r) => a + Number(r.outstanding), 0), true) },
              { label: 'Customers billed', value: String(data.filter((r) => Number(r.invoices) > 0).length) },
            ],
          }
        }

        case 'quotation': {
          const data: ReportRow[] = db.quotations.filter((q) => inRange(q.date)).map((q) => ({
            id: q.id,
            date: q.date,
            number: q.number,
            customer: customerName(db, q.customerId),
            revision: q.revision,
            value: q.total,
            status: q.status,
            converted: q.convertedInvoiceId ? 'Yes' : 'No',
          }))
          return {
            columns: [
              { key: 'number', label: 'Quotation' },
              { key: 'date', label: 'Date', render: (row) => formatDate(String(row.date)) },
              { key: 'customer', label: 'Customer' },
              { key: 'revision', label: 'Rev', align: 'right' },
              { key: 'value', label: 'Value', align: 'right', render: (row) => formatCurrency(Number(row.value)) },
              { key: 'status', label: 'Status', render: (row) => <StatusBadge status={String(row.status)} /> },
              { key: 'converted', label: 'Invoiced' },
            ],
            rows: data,
            summary: [
              { label: 'Quotations', value: String(data.length) },
              { label: 'Total value', value: formatCurrency(data.reduce((a, r) => a + Number(r.value), 0), true) },
              { label: 'Approved', value: String(data.filter((r) => r.status === 'Approved').length) },
              { label: 'Rejected', value: String(data.filter((r) => r.status === 'Rejected').length) },
            ],
          }
        }

        case 'invoice': {
          const data: ReportRow[] = db.invoices.filter((i) => inRange(i.date)).map((i) => ({
            id: i.id,
            date: i.date,
            number: i.number,
            orderRef: i.orderRef,
            customer: customerName(db, i.customerId),
            total: i.total,
            paid: i.amountPaid,
            balance: invoiceBalance(i),
            status: i.status,
          }))
          return {
            columns: [
              { key: 'number', label: 'Invoice' },
              { key: 'date', label: 'Date', render: (row) => formatDate(String(row.date)) },
              { key: 'orderRef', label: 'Order ref' },
              { key: 'customer', label: 'Customer' },
              { key: 'total', label: 'Total', align: 'right', render: (row) => formatCurrency(Number(row.total)) },
              { key: 'paid', label: 'Paid', align: 'right', render: (row) => formatCurrency(Number(row.paid)) },
              {
                key: 'balance',
                label: 'Balance',
                align: 'right',
                render: (row) => (
                  <span className={Number(row.balance) > 0 ? 'font-semibold text-rose-600' : 'text-silver-600'}>
                    {formatCurrency(Number(row.balance))}
                  </span>
                ),
              },
              { key: 'status', label: 'Status', render: (row) => <StatusBadge status={String(row.status)} /> },
            ],
            rows: data,
            summary: [
              { label: 'Invoices', value: String(data.length) },
              { label: 'Invoiced', value: formatCurrency(data.reduce((a, r) => a + Number(r.total), 0), true) },
              { label: 'Collected', value: formatCurrency(data.reduce((a, r) => a + Number(r.paid), 0), true) },
              { label: 'Balance due', value: formatCurrency(data.reduce((a, r) => a + Number(r.balance), 0), true) },
            ],
          }
        }

        case 'inventory': {
          const data: ReportRow[] = db.rawMaterials.map((m) => ({
            id: m.id,
            date: todayISO(),
            sku: m.sku,
            material: m.name,
            category: m.category,
            quantity: m.quantity,
            unit: m.unit,
            cost: m.cost,
            value: m.quantity * m.cost,
            minStock: m.minStock,
            status: m.quantity <= m.minStock ? 'Low stock' : 'In stock',
          }))
          return {
            columns: [
              { key: 'sku', label: 'SKU' },
              { key: 'material', label: 'Material' },
              { key: 'category', label: 'Category', render: (row) => <Badge tone="silver">{String(row.category)}</Badge> },
              { key: 'quantity', label: 'On hand', align: 'right', render: (row) => `${formatNumber(Number(row.quantity))} ${row.unit}` },
              { key: 'cost', label: 'Unit cost', align: 'right', render: (row) => formatCurrency(Number(row.cost)) },
              { key: 'value', label: 'Value', align: 'right', render: (row) => formatCurrency(Number(row.value)) },
              { key: 'minStock', label: 'Min level', align: 'right' },
              {
                key: 'status',
                label: 'Status',
                render: (row) => (
                  <Badge tone={row.status === 'Low stock' ? 'danger' : 'success'} dot>
                    {String(row.status)}
                  </Badge>
                ),
              },
            ],
            rows: data,
            summary: [
              { label: 'Materials', value: String(data.length) },
              { label: 'Stock value', value: formatCurrency(data.reduce((a, r) => a + Number(r.value), 0), true) },
              { label: 'Low stock', value: String(data.filter((r) => r.status === 'Low stock').length) },
              { label: 'Categories', value: String(new Set(db.rawMaterials.map((m) => m.category)).size) },
            ],
          }
        }

        case 'manufacturing': {
          const data: ReportRow[] = db.manufacturingJobs.filter((j) => inRange(j.plannedStart)).map((j) => ({
            id: j.id,
            date: j.plannedStart,
            jobNumber: j.jobNumber,
            orderRef: j.orderRef,
            product: j.productName,
            quantity: j.quantity,
            stage: j.stage,
            stageIndex: MFG_STAGES.indexOf(j.stage) + 1,
            progress: j.progress,
            assignedTo: j.assignedTo,
            plannedEnd: j.plannedEnd,
            status: j.status,
            outsourced: j.outsourced ? j.vendor || 'Yes' : 'No',
          }))
          return {
            columns: [
              { key: 'jobNumber', label: 'Job' },
              { key: 'orderRef', label: 'Order ref' },
              { key: 'product', label: 'Product' },
              { key: 'quantity', label: 'Qty', align: 'right' },
              { key: 'stage', label: 'Stage', render: (row) => <Badge tone="silver">{String(row.stage)}</Badge> },
              { key: 'progress', label: 'Progress', align: 'right', render: (row) => `${row.progress}%` },
              { key: 'plannedEnd', label: 'Planned end', render: (row) => formatDate(String(row.plannedEnd)) },
              { key: 'status', label: 'Status', render: (row) => <StatusBadge status={String(row.status)} /> },
            ],
            rows: data,
            summary: [
              { label: 'Jobs', value: String(data.length) },
              { label: 'Completed', value: String(data.filter((r) => r.status === 'Completed').length) },
              { label: 'In progress', value: String(data.filter((r) => r.status === 'In Progress').length) },
              { label: 'Delayed', value: String(data.filter((r) => r.status === 'Delayed').length) },
            ],
          }
        }

        case 'packaging': {
          const data: ReportRow[] = db.packagingJobs.filter((j) => inRange(j.createdAt.slice(0, 10))).map((j) => ({
            id: j.id,
            date: j.createdAt.slice(0, 10),
            jobNumber: j.jobNumber,
            orderRef: j.orderRef,
            product: j.productName,
            quantityToPack: j.quantityToPack,
            packedQuantity: j.packedQuantity,
            completion: j.quantityToPack ? Math.round((j.packedQuantity / j.quantityToPack) * 100) : 0,
            assignedTo: j.assignedTo,
            packingDate: j.packingDate,
            status: j.status,
            ready: j.readyForDispatch ? 'Ready' : 'Not ready',
          }))
          return {
            columns: [
              { key: 'jobNumber', label: 'Job' },
              { key: 'orderRef', label: 'Order ref' },
              { key: 'product', label: 'Product' },
              { key: 'quantityToPack', label: 'To pack', align: 'right' },
              { key: 'packedQuantity', label: 'Packed', align: 'right' },
              { key: 'completion', label: 'Completion', align: 'right', render: (row) => `${row.completion}%` },
              { key: 'assignedTo', label: 'Assigned' },
              {
                key: 'ready',
                label: 'Dispatch',
                render: (row) => (
                  <Badge tone={row.ready === 'Ready' ? 'success' : 'neutral'}>{String(row.ready)}</Badge>
                ),
              },
            ],
            rows: data,
            summary: [
              { label: 'Packaging jobs', value: String(data.length) },
              { label: 'Units to pack', value: formatNumber(data.reduce((a, r) => a + Number(r.quantityToPack), 0)) },
              { label: 'Units packed', value: formatNumber(data.reduce((a, r) => a + Number(r.packedQuantity), 0)) },
              { label: 'Ready for dispatch', value: String(data.filter((r) => r.ready === 'Ready').length) },
            ],
          }
        }

        case 'dispatch': {
          const data: ReportRow[] = db.dispatches.filter((d) => inRange(d.dispatchDate || d.createdAt.slice(0, 10))).map((d) => ({
            id: d.id,
            date: d.dispatchDate || d.createdAt.slice(0, 10),
            number: d.number,
            orderRef: d.orderRef,
            customer: customerName(db, d.customerId),
            courier: d.courierName,
            tracking: d.trackingNumber || '—',
            quantity: d.quantity,
            expected: d.expectedDelivery,
            status: d.status,
          }))
          return {
            columns: [
              { key: 'number', label: 'Dispatch' },
              { key: 'orderRef', label: 'Order ref' },
              { key: 'customer', label: 'Customer' },
              { key: 'courier', label: 'Courier' },
              { key: 'tracking', label: 'Tracking' },
              { key: 'quantity', label: 'Qty', align: 'right' },
              { key: 'expected', label: 'Expected', render: (row) => formatDate(String(row.expected)) },
              { key: 'status', label: 'Status', render: (row) => <StatusBadge status={String(row.status)} /> },
            ],
            rows: data,
            summary: [
              { label: 'Shipments', value: String(data.length) },
              { label: 'Delivered', value: String(data.filter((r) => r.status === 'Delivered').length) },
              { label: 'In transit', value: String(data.filter((r) => r.status === 'In Transit' || r.status === 'Dispatched').length) },
              { label: 'Delayed', value: String(data.filter((r) => r.status === 'Delayed').length) },
            ],
          }
        }

        case 'customerLedger': {
          const customer = db.customers.find((item) => item.id === customerId)
          const ledger = customerId ? buildCustomerLedger(db, customerId) : []
          const data: ReportRow[] = ledger
            .filter((entry) => inRange(entry.date))
            .map((entry) => ({
              id: entry.id,
              date: entry.date,
              reference: entry.reference,
              description: entry.description,
              debit: entry.debit,
              credit: entry.credit,
              balance: entry.balance,
            }))
          const filteredSummary = ledgerSummary(
            data.map((row) => ({
              id: row.id,
              date: String(row.date),
              reference: String(row.reference),
              description: '',
              debit: Number(row.debit),
              credit: Number(row.credit),
              balance: Number(row.balance),
            })),
            false,
          )
          return {
            columns: [
              { key: 'date', label: 'Date', render: (row) => formatDate(String(row.date)) },
              { key: 'reference', label: 'Reference' },
              { key: 'description', label: 'Description' },
              { key: 'debit', label: 'Debit', align: 'right', render: (row) => (Number(row.debit) ? formatCurrency(Number(row.debit)) : '—') },
              {
                key: 'credit',
                label: 'Credit',
                align: 'right',
                render: (row) => (
                  <span className="text-emerald-600">{Number(row.credit) ? formatCurrency(Number(row.credit)) : '—'}</span>
                ),
              },
              { key: 'balance', label: 'Balance', align: 'right', render: (row) => formatCurrency(Number(row.balance)) },
            ],
            rows: data,
            summary: [
              { label: 'Customer', value: customer?.companyName ?? 'Not selected' },
              { label: 'Total debit', value: formatCurrency(filteredSummary.totalDebit) },
              { label: 'Total credit', value: formatCurrency(filteredSummary.totalCredit) },
              { label: 'Closing balance', value: formatCurrency(customerId ? Number(data.at(-1)?.balance ?? 0) : 0) },
            ],
          }
        }

        case 'supplierLedger': {
          const supplier = db.suppliers.find((item) => item.id === supplierId)
          const ledger = supplierId ? buildSupplierLedger(db, supplierId) : []
          const data: ReportRow[] = ledger
            .filter((entry) => inRange(entry.date))
            .map((entry) => ({
              id: entry.id,
              date: entry.date,
              reference: entry.reference,
              description: entry.description,
              debit: entry.debit,
              credit: entry.credit,
              balance: entry.balance,
            }))
          return {
            columns: [
              { key: 'date', label: 'Date', render: (row) => formatDate(String(row.date)) },
              { key: 'reference', label: 'Reference' },
              { key: 'description', label: 'Description' },
              {
                key: 'debit',
                label: 'Debit (paid)',
                align: 'right',
                render: (row) => (
                  <span className="text-emerald-600">{Number(row.debit) ? formatCurrency(Number(row.debit)) : '—'}</span>
                ),
              },
              { key: 'credit', label: 'Credit (purchase)', align: 'right', render: (row) => (Number(row.credit) ? formatCurrency(Number(row.credit)) : '—') },
              { key: 'balance', label: 'Balance', align: 'right', render: (row) => formatCurrency(Number(row.balance)) },
            ],
            rows: data,
            summary: [
              { label: 'Supplier', value: supplier?.name ?? 'Not selected' },
              { label: 'Total purchases', value: formatCurrency(data.reduce((a, r) => a + Number(r.credit), 0)) },
              { label: 'Total paid', value: formatCurrency(data.reduce((a, r) => a + Number(r.debit), 0)) },
              { label: 'Outstanding payable', value: formatCurrency(supplierId ? supplierOutstanding(db, supplierId) : 0) },
            ],
          }
        }

        default:
          return { columns: [], rows: [], summary: [] }
      }
    }

    const built = build()
    const term = search.trim().toLowerCase()
    const filteredRows = term
      ? built.rows.filter((row) =>
          Object.entries(row)
            .filter(([key]) => key !== 'id')
            .some(([, value]) => String(value ?? '').toLowerCase().includes(term)),
        )
      : built.rows

    return { columns: built.columns, rows: filteredRows, summary: built.summary }
  }, [report, db, fromDate, toDate, search, customerId, supplierId])

  const exportCSV = () => {
    downloadCSV(
      `${report}-report.csv`,
      columns.map((column) => column.label),
      rows.map((row) => columns.map((column) => (column.csv ? column.csv(row) : String(row[column.key] ?? '')))),
    )
    toast.success(`${active.label} exported as CSV.`)
  }

  return (
    <>
      <PageHeader
        eyebrow="Analytics & finance"
        icon={<BarChart3 className="h-5 w-5" />}
        title="Report and Ledger"
        actions={
          <Button variant="outline" icon={<FileSpreadsheet className="h-4 w-4" />} onClick={exportCSV} disabled={rows.length === 0}>
            Export CSV
          </Button>
        }
      />

      <SegmentedTabs
        size="sm"
        className="max-w-full"
        value={report}
        onChange={setReport}
        items={REPORTS.map((item) => ({
          value: item.key,
          label: item.label.replace(' report', ''),
          icon: item.icon,
        }))}
      />

      {summary.length > 0 ? (
        <div key={`${report}-summary`} className="tab-swap grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {summary.map((item) => (
            <StatCard key={item.label} label={item.label} value={item.value} tone="blue" />
          ))}
        </div>
      ) : null}

      <Card>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-1 flex-wrap items-end gap-2">
            <SearchInput value={search} onChange={setSearch} placeholder="Search within report…" className="w-full sm:w-64" />
            <Field label="From date" className="w-full sm:w-40">
              <Input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} />
            </Field>
            <Field label="To date" className="w-full sm:w-40">
              <Input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} />
            </Field>
            {report === 'customerLedger' ? (
              <Field label="Customer" className="w-full sm:w-64">
                <Select value={customerId} onChange={(event) => setCustomerId(event.target.value)}>
                  {db.customers.map((customer) => (
                    <option key={customer.id} value={customer.id}>
                      {customer.code} · {customer.companyName}
                    </option>
                  ))}
                </Select>
              </Field>
            ) : null}
            {report === 'supplierLedger' ? (
              <Field label="Supplier" className="w-full sm:w-64">
                <Select value={supplierId} onChange={(event) => setSupplierId(event.target.value)}>
                  {db.suppliers.map((supplier) => (
                    <option key={supplier.id} value={supplier.id}>
                      {supplier.code} · {supplier.name}
                    </option>
                  ))}
                </Select>
              </Field>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            {(fromDate || toDate || search) ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setFromDate('')
                  setToDate('')
                  setSearch('')
                }}
              >
                Clear filters
              </Button>
            ) : null}
            <Badge tone="silver">{rows.length} rows</Badge>
          </div>
        </div>
      </Card>

      <TableShell key={`${report}-table`} className="tab-swap">
        <Table className="min-w-[880px]">
          <THead>
            <TR>
              {columns.map((column) => (
                <Th key={column.key} align={column.align}>
                  {column.label}
                </Th>
              ))}
            </TR>
          </THead>
          <TBody>
            {rows.length === 0 ? (
              <TableEmptyRow colSpan={columns.length || 1}>
                No records found for the selected filters.
              </TableEmptyRow>
            ) : (
              rows.map((row) => (
                <TR key={row.id}>
                  {columns.map((column) => (
                    <Td key={column.key} align={column.align}>
                      {column.render ? column.render(row) : String(row[column.key] ?? '—')}
                    </Td>
                  ))}
                </TR>
              ))
            )}
          </TBody>
        </Table>
      </TableShell>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-navy-900">{active.label}</h3>
            <p className="text-xs text-silver-600">{active.description}</p>
          </div>
          <Toolbar>
            <Badge tone="info">
              {fromDate || toDate
                ? `Filtered ${fromDate ? formatDate(fromDate) : 'start'} → ${toDate ? formatDate(toDate) : 'today'}`
                : 'All dates'}
            </Badge>
          </Toolbar>
        </div>
      </Card>

      {rows.length === 0 ? (
        <EmptyState
          icon={<BarChart3 className="h-5 w-5" />}
          title="Nothing to report"
          description="No records match the current report and filters. Adjust the date range or search term."
        />
      ) : null}
    </>
  )
}
