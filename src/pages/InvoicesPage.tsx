import { useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import {
  AlertTriangle,
  BadgeCheck,
  CircleDollarSign,
  IndianRupee,
  Plus,
  Printer,
  Receipt,
  Trash2,
  Wallet,
} from 'lucide-react'
import type { Invoice, PaymentKind, PaymentMode } from '@/types'
import { PAYMENT_MODES } from '@/types'
import { PageHeader, EmptyState, SearchInput, Toolbar, DataRow } from '@/components/ui/Layout'
import { Card, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { StatusBadge, Badge } from '@/components/ui/Badge'
import { Field, Input, Select, Textarea } from '@/components/ui/Form'
import { Modal, ConfirmDialog } from '@/components/ui/Modal'
import { StatCard } from '@/components/ui/StatCard'
import { TBody, THead, Td, Th, TR, Table, TableEmptyRow, TableShell } from '@/components/ui/Table'
import { LineItemEditor, newLineItem } from '@/components/LineItemEditor'
import { PrintPortal } from '@/components/print/PrintPortal'
import { InvoiceDocument } from '@/components/print/Documents'
import { useData } from '@/store/DataContext'
import { useToast } from '@/store/ToastContext'
import {
  buildLineItem,
  computeTotals,
  customerName,
  invoiceBalance,
  isOrderDelivered,
  unappliedAdvancesFor,
  type LineItemInput,
} from '@/lib/calc'
import {
  applyAdvancesToInvoice,
  confirmOrder,
  convertQuotationToInvoice,
  createOrderInvoice,
  pushActivity,
  recordAdvance,
  recordPayment,
} from '@/lib/workflow'
import { downloadCSV, formatCurrency, formatDate, todayISO } from '@/lib/utils'

type CreateMode = 'quotation' | 'direct'

export function InvoicesPage() {
  const { db, mutate } = useData()
  const toast = useToast()
  const location = useLocation()

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [customerFilter, setCustomerFilter] = useState('all')
  const [detailId, setDetailId] = useState<string | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [printId, setPrintId] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [createMode, setCreateMode] = useState<CreateMode>('quotation')

  // create – from quotation
  const [quotationId, setQuotationId] = useState('')
  // create – direct
  const [customerId, setCustomerId] = useState('')
  const [dueDays, setDueDays] = useState('30')
  const [items, setItems] = useState<LineItemInput[]>(() => [newLineItem(db.settings.defaultTaxRate)])
  const [notes, setNotes] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})

  // payment
  const [paymentInvoiceId, setPaymentInvoiceId] = useState<string | null>(null)
  const [paymentForm, setPaymentForm] = useState(() => ({
    amount: '',
    mode: 'Bank Transfer' as PaymentMode,
    date: todayISO(),
    reference: '',
    kind: 'Advance' as PaymentKind,
  }))
  const [paymentError, setPaymentError] = useState('')

  // advance received before an invoice exists
  const [advanceOpen, setAdvanceOpen] = useState(false)
  const [advanceForm, setAdvanceForm] = useState(() => ({
    customerId: '',
    orderRef: '',
    amount: '',
    mode: 'Bank Transfer' as PaymentMode,
    date: todayISO(),
    reference: '',
    notes: '',
  }))
  const [advanceError, setAdvanceError] = useState('')

  useEffect(() => {
    const focusId = (location.state as { focusId?: string } | null)?.focusId
    if (focusId) setDetailId(focusId)
  }, [location.state])

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    return db.invoices
      .filter((invoice) => {
        const name = customerName(db, invoice.customerId)
        const matchesTerm = !term || `${invoice.number} ${invoice.orderRef} ${name} ${invoice.notes}`.toLowerCase().includes(term)
        const matchesStatus = statusFilter === 'all' || invoice.status === statusFilter
        const matchesCustomer = customerFilter === 'all' || invoice.customerId === customerFilter
        return matchesTerm && matchesStatus && matchesCustomer
      })
      .sort((a, b) => (a.date < b.date ? 1 : -1))
  }, [db, search, statusFilter, customerFilter])

  const detail = db.invoices.find((invoice) => invoice.id === detailId) ?? null
  const printInvoice = db.invoices.find((invoice) => invoice.id === printId) ?? null
  const paymentInvoice = db.invoices.find((invoice) => invoice.id === paymentInvoiceId) ?? null

  const eligibleQuotations = useMemo(
    () => db.quotations.filter((quotation) => quotation.status === 'Approved' && !quotation.convertedInvoiceId),
    [db.quotations],
  )

  const stats = useMemo(() => {
    const total = db.invoices.reduce((acc, invoice) => acc + invoice.total, 0)
    const collected = db.invoices.reduce((acc, invoice) => acc + invoice.amountPaid, 0)
    const overdue = db.invoices.filter((invoice) => invoice.status !== 'Paid' && invoice.dueDate < todayISO())
    return {
      count: db.invoices.length,
      total,
      collected,
      outstanding: Math.max(total - collected, 0),
      overdueCount: overdue.length,
      overdueValue: overdue.reduce((acc, invoice) => acc + invoiceBalance(invoice), 0),
      unconfirmed: db.invoices.filter((invoice) => !invoice.orderConfirmed).length,
    }
  }, [db.invoices])

  const directTotals = useMemo(() => computeTotals(items.map(buildLineItem)), [items])

  /** Unapplied advances that could be applied to a given invoice. */
  const advancesFor = (invoice: Invoice) =>
    unappliedAdvancesFor(db, invoice.customerId).filter(
      (advance) => !advance.orderRef || advance.orderRef === invoice.orderRef,
    )

  const resetCreate = () => {
    setCreateMode('quotation')
    setQuotationId('')
    setCustomerId('')
    setDueDays('30')
    setItems([newLineItem(db.settings.defaultTaxRate)])
    setNotes('')
    setErrors({})
  }

  const submitCreate = () => {
    if (createMode === 'quotation') {
      if (!quotationId) {
        setErrors({ quotation: 'Select an approved quotation to convert.' })
        return
      }
      const quotation = db.quotations.find((item) => item.id === quotationId)
      const paymentTerms = db.customers.find((customer) => customer.id === quotation?.customerId)?.paymentTerms ?? 30
      const result = mutate((draft) => convertQuotationToInvoice(draft, quotationId, paymentTerms))
      if (result.error && !result.invoice) {
        toast.error(result.error)
        return
      }
      toast.success('Invoice created from the approved quotation.')
      setCreateOpen(false)
      return
    }

    const next: Record<string, string> = {}
    if (!customerId) next.customer = 'Select a customer.'
    if (items.some((item) => !item.description.trim())) next.items = 'Every line item needs a description.'
    if (items.some((item) => item.quantity <= 0)) next.items = 'Quantities must be greater than zero.'
    setErrors(next)
    if (Object.keys(next).length > 0) return

    mutate((draft) => {
      createOrderInvoice(draft, {
        customerId,
        items: items.map((item) => ({ ...item, description: item.description.trim() })),
        notes: notes.trim(),
        createdBy: 'Priya Sharma',
        dueDays: Number(dueDays) || 30,
      })
    })
    toast.success('Direct order invoice created. Confirm the order to generate production jobs.')
    setCreateOpen(false)
  }

  const handleConfirmOrder = (invoice: Invoice) => {
    const result = mutate((draft) => confirmOrder(draft, invoice.id))
    if (!result.ok) {
      toast.error(result.error ?? 'Could not confirm the order.')
      return
    }
    toast.success(
      result.manufacturing > 0
        ? `Order confirmed. ${result.manufacturing} production job(s) created and packaging jobs queued.`
        : 'Order confirmed from finished stock. Packaging jobs created.',
    )
  }

  const openPayment = (invoice: Invoice) => {
    setPaymentInvoiceId(invoice.id)
    setPaymentForm({
      amount: String(invoiceBalance(invoice)),
      mode: 'Bank Transfer',
      date: todayISO(),
      reference: '',
      // First receipt against an unpaid invoice is treated as an advance.
      kind: invoice.amountPaid <= 0 ? 'Advance' : 'Partial',
    })
    setPaymentError('')
  }

  const submitPayment = () => {
    if (!paymentInvoiceId || !paymentInvoice) return
    const amount = Number(paymentForm.amount)
    if (!amount || amount <= 0) {
      setPaymentError('Enter a payment amount greater than zero.')
      return
    }
    if (amount > invoiceBalance(paymentInvoice) + 0.001) {
      setPaymentError(`Amount cannot exceed the balance due of ${formatCurrency(invoiceBalance(paymentInvoice))}.`)
      return
    }
    const result = mutate((draft) =>
      recordPayment(draft, paymentInvoiceId, {
        amount,
        mode: paymentForm.mode,
        date: paymentForm.date,
        reference: paymentForm.reference.trim(),
        kind: paymentForm.kind,
      }),
    )
    if (!result.ok) {
      setPaymentError(result.error ?? 'Could not record the payment.')
      return
    }
    toast.success('Payment recorded successfully.')
    setPaymentInvoiceId(null)
  }

  const openAdvance = () => {
    setAdvanceForm({
      customerId: '',
      orderRef: '',
      amount: '',
      mode: 'Bank Transfer',
      date: todayISO(),
      reference: '',
      notes: '',
    })
    setAdvanceError('')
    setAdvanceOpen(true)
  }

  const submitAdvance = () => {
    const amount = Number(advanceForm.amount)
    if (!advanceForm.customerId) {
      setAdvanceError('Select the customer this advance belongs to.')
      return
    }
    if (!amount || amount <= 0) {
      setAdvanceError('Enter an advance amount greater than zero.')
      return
    }
    const result = mutate((draft) =>
      recordAdvance(draft, {
        customerId: advanceForm.customerId,
        orderRef: advanceForm.orderRef.trim() || undefined,
        amount,
        mode: advanceForm.mode,
        date: advanceForm.date,
        reference: advanceForm.reference.trim(),
        notes: advanceForm.notes.trim(),
      }),
    )
    if (!result.ok) {
      setAdvanceError(result.error ?? 'Could not record the advance.')
      return
    }
    toast.success('Advance recorded. It will be applied automatically to the invoice for this customer.')
    setAdvanceOpen(false)
  }

  /** Apply any held advances to an existing invoice (for advances received after it was raised). */
  const applyAdvances = (invoice: Invoice) => {
    const applied = mutate((draft) => {
      const target = draft.invoices.find((item) => item.id === invoice.id)
      if (!target) return 0
      return applyAdvancesToInvoice(draft, target)
    })
    if (applied > 0) {
      toast.success(`${formatCurrency(applied)} of advances applied to ${invoice.number}.`)
    } else {
      toast.notify('No advances available to apply to this invoice.')
    }
  }

  const confirmDelete = () => {
    if (!deleteId) return
    mutate((draft) => {
      const invoice = draft.invoices.find((item) => item.id === deleteId)
      draft.invoices = draft.invoices.filter((item) => item.id !== deleteId)
      draft.manufacturingJobs = draft.manufacturingJobs.filter((job) => job.invoiceId !== deleteId)
      draft.packagingJobs = draft.packagingJobs.filter((job) => job.invoiceId !== deleteId)
      draft.dispatches = draft.dispatches.filter((dispatch) => dispatch.invoiceId !== deleteId)
      draft.quotations = draft.quotations.map((quotation) =>
        quotation.convertedInvoiceId === deleteId ? { ...quotation, convertedInvoiceId: undefined } : quotation,
      )
      if (invoice) pushActivity(draft, 'Invoice', `Invoice ${invoice.number} deleted`)
    })
    toast.success('Invoice deleted along with its linked jobs.')
    setDeleteId(null)
    setDetailId(null)
  }

  const exportCSV = () => {
    downloadCSV(
      'invoices.csv',
      ['Number', 'Order ref', 'Customer', 'Date', 'Due date', 'Total', 'Paid', 'Balance', 'Status'],
      filtered.map((invoice) => [
        invoice.number,
        invoice.orderRef,
        customerName(db, invoice.customerId),
        invoice.date,
        invoice.dueDate,
        invoice.total,
        invoice.amountPaid,
        invoiceBalance(invoice),
        invoice.status,
      ]),
    )
    toast.success('Invoice list exported as CSV.')
  }

  return (
    <>
      <PageHeader
        eyebrow="Billing & payments"
        icon={<Receipt className="h-5 w-5" />}
        title="Invoice"
        description="Raise invoices from approved quotations or direct orders, record payments and confirm orders for production."
        actions={
          <>
            <Button variant="outline" icon={<IndianRupee className="h-4 w-4" />} onClick={exportCSV}>
              Export CSV
            </Button>
            <Button variant="outline" icon={<Wallet className="h-4 w-4" />} onClick={openAdvance}>
              Record advance
            </Button>
            <Button
              icon={<Plus className="h-4 w-4" />}
              onClick={() => {
                resetCreate()
                setCreateOpen(true)
              }}
            >
              New invoice
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total invoiced" value={formatCurrency(stats.total, true)} hint={`${stats.count} invoices raised`} icon={<Receipt className="h-4.5 w-4.5" />} tone="blue" />
        <StatCard label="Amount collected" value={formatCurrency(stats.collected, true)} hint="Payments recorded" icon={<Wallet className="h-4.5 w-4.5" />} tone="emerald" />
        <StatCard label="Outstanding" value={formatCurrency(stats.outstanding, true)} hint={`${stats.overdueCount} invoices overdue`} icon={<CircleDollarSign className="h-4.5 w-4.5" />} tone="amber" />
        <StatCard label="Awaiting confirmation" value={stats.unconfirmed} hint="Confirm to start production" icon={<BadgeCheck className="h-4.5 w-4.5" />} tone="violet" />
      </div>

      {(db.advances ?? []).length > 0 ? (
        <Card padded={false}>
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-silver-200 px-5 py-3.5">
            <div>
              <h3 className="text-[13px] font-bold text-navy-900">Advances on account</h3>
              <p className="mt-0.5 text-xs text-silver-600">
                Money received before an invoice exists. Applied automatically when the invoice is raised.
              </p>
            </div>
            <Badge tone="info">{(db.advances ?? []).length} held</Badge>
          </div>
          <ul className="divide-y divide-silver-200">
            {(db.advances ?? []).map((advance) => (
              <li key={advance.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-sm">
                <div>
                  <p className="font-medium text-navy-900">{customerName(db, advance.customerId)}</p>
                  <p className="text-xs text-silver-600">
                    {formatDate(advance.date)} · {advance.mode}
                    {advance.reference ? ` · ${advance.reference}` : ''}
                    {advance.orderRef ? ` · order ${advance.orderRef}` : ''}
                  </p>
                </div>
                <span className="font-semibold text-navy-900">{formatCurrency(advance.amount)}</span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <Card>
        <Toolbar className="justify-between">
          <div className="flex flex-1 flex-wrap items-center gap-2">
            <SearchInput value={search} onChange={setSearch} placeholder="Search invoice or customer…" className="w-full sm:w-72" />
            <Select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="w-full sm:w-40">
              <option value="all">All statuses</option>
              {['Unpaid', 'Advance', 'Partial', 'Paid'].map((status) => (
                <option key={status}>{status}</option>
              ))}
            </Select>
            <Select value={customerFilter} onChange={(event) => setCustomerFilter(event.target.value)} className="w-full sm:w-56">
              <option value="all">All customers</option>
              {db.customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.companyName}
                </option>
              ))}
            </Select>
          </div>
          <p className="text-xs text-silver-600">
            {filtered.length} of {db.invoices.length} invoices
          </p>
        </Toolbar>
      </Card>

      <TableShell>
        <Table>
          <THead>
            <TR>
              <Th>Invoice</Th>
              <Th>Customer</Th>
              <Th>Order ref</Th>
              <Th>Due</Th>
              <Th align="right">Total</Th>
              <Th align="right">Paid</Th>
              <Th align="right">Balance</Th>
              <Th>Status</Th>
              <Th align="right">Actions</Th>
            </TR>
          </THead>
          <TBody>
            {filtered.length === 0 ? (
              <TableEmptyRow colSpan={9}>No invoices match your filters.</TableEmptyRow>
            ) : (
              filtered.map((invoice) => {
                const balance = invoiceBalance(invoice)
                const overdue = invoice.status !== 'Paid' && invoice.dueDate < todayISO()
                return (
                  <TR key={invoice.id} onClick={() => setDetailId(invoice.id)}>
                    <Td>
                      {/* One exception per row: the actionable one. The
                          manufacturing flag lives in the detail view. */}
                      <div className="flex items-center gap-2">
                        <span className="font-semibold whitespace-nowrap text-navy-900">{invoice.number}</span>
                        {!invoice.orderConfirmed ? <Badge tone="warning">Unconfirmed</Badge> : null}
                      </div>
                    </Td>
                    <Td className="min-w-[168px]">{customerName(db, invoice.customerId)}</Td>
                    <Td className="text-xs whitespace-nowrap text-silver-600">{invoice.orderRef}</Td>
                    <Td className="whitespace-nowrap">
                      <span className={overdue ? 'font-semibold text-rose-700' : ''}>{formatDate(invoice.dueDate)}</span>
                      {overdue ? (
                        <span className="ml-1.5 text-[10px] font-bold tracking-wide text-rose-700 uppercase">
                          Overdue
                        </span>
                      ) : null}
                    </Td>
                    <Td align="right" className="font-semibold">{formatCurrency(invoice.total)}</Td>
                    <Td align="right">{formatCurrency(invoice.amountPaid)}</Td>
                    <Td align="right" className={balance > 0 ? 'font-semibold text-rose-700' : ''}>{formatCurrency(balance)}</Td>
                    <Td>
                      <StatusBadge status={invoice.status} />
                    </Td>
                    <Td align="right">
                      <div className="flex items-center justify-end gap-1.5" onClick={(event) => event.stopPropagation()}>
                        <Button size="icon" variant="ghost" title="Record payment" onClick={() => openPayment(invoice)} disabled={balance <= 0}>
                          <Wallet className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" title="Print" onClick={() => setPrintId(invoice.id)}>
                          <Printer className="h-4 w-4" />
                        </Button>
                      </div>
                    </Td>
                  </TR>
                )
              })
            )}
          </TBody>
        </Table>
      </TableShell>

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        size="full"
        title="Create invoice"
        subtitle="Convert an approved quotation, or raise a direct order invoice."
        footer={
          <>
            {createMode === 'direct' ? (
              <div className="mr-auto text-xs text-silver-600">Grand total {formatCurrency(directTotals.total)}</div>
            ) : null}
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submitCreate}>{createMode === 'quotation' ? 'Convert to invoice' : 'Create invoice'}</Button>
          </>
        }
      >
        <div className="flex flex-col gap-5">
          <div className="flex gap-2 rounded-xl border border-silver-200 bg-silver-50 p-1.5">
            {([
              { key: 'quotation', label: 'From approved quotation' },
              { key: 'direct', label: 'Direct order / PO' },
            ] as Array<{ key: CreateMode; label: string }>).map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setCreateMode(tab.key)}
                className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition ${
                  createMode === tab.key ? 'bg-surface text-navy-900 shadow-sm' : 'text-silver-600 hover:text-navy-800'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {createMode === 'quotation' ? (
            <div className="flex flex-col gap-4">
              <Field label="Approved quotation" required error={errors.quotation}>
                <Select value={quotationId} onChange={(event) => setQuotationId(event.target.value)} invalid={Boolean(errors.quotation)}>
                  <option value="">Select an approved quotation…</option>
                  {eligibleQuotations.map((quotation) => (
                    <option key={quotation.id} value={quotation.id}>
                      {quotation.number} · {customerName(db, quotation.customerId)} · {formatCurrency(quotation.total)}
                    </option>
                  ))}
                </Select>
              </Field>
              {eligibleQuotations.length === 0 ? (
                <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5" />
                  There are no approved, unconverted quotations. Mark a quotation as approved first, or use a direct order.
                </div>
              ) : null}
              {quotationId ? (
                <QuotationPreview quotationId={quotationId} />
              ) : null}
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Customer" required error={errors.customer}>
                  <Select value={customerId} onChange={(event) => setCustomerId(event.target.value)} invalid={Boolean(errors.customer)}>
                    <option value="">Select customer…</option>
                    {db.customers.map((customer) => (
                      <option key={customer.id} value={customer.id}>
                        {customer.code} · {customer.companyName}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Payment due in (days)">
                  <Input type="number" min={0} value={dueDays} onChange={(event) => setDueDays(event.target.value)} />
                </Field>
              </div>
              <div>
                <p className="mb-2 text-xs font-semibold text-navy-800">Line items</p>
                <LineItemEditor items={items} onChange={setItems} products={db.products} defaultTaxRate={db.settings.defaultTaxRate} />
                {errors.items ? <p className="mt-2 text-xs font-medium text-rose-600">{errors.items}</p> : null}
              </div>
              <Field label="Notes">
                <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="PO reference, delivery instructions…" />
              </Field>
            </div>
          )}
        </div>
      </Modal>

      <Modal
        open={Boolean(detail)}
        onClose={() => setDetailId(null)}
        size="lg"
        title={detail ? `Invoice ${detail.number}` : ''}
        subtitle={detail ? `${customerName(db, detail.customerId)} · order ${detail.orderRef}` : ''}
        footer={
          detail ? (
            <>
              <Button variant="danger" size="sm" icon={<Trash2 className="h-4 w-4" />} onClick={() => setDeleteId(detail.id)}>
                Delete
              </Button>
              <div className="ml-auto flex flex-wrap gap-2">
                <Button variant="outline" size="sm" icon={<Printer className="h-4 w-4" />} onClick={() => setPrintId(detail.id)}>
                  Print
                </Button>
                {!detail.orderConfirmed ? (
                  <Button size="sm" variant="secondary" icon={<BadgeCheck className="h-4 w-4" />} onClick={() => handleConfirmOrder(detail)}>
                    Confirm order
                  </Button>
                ) : null}
                {advancesFor(detail).length > 0 && invoiceBalance(detail) > 0 ? (
                  <Button size="sm" variant="outline" icon={<IndianRupee className="h-4 w-4" />} onClick={() => applyAdvances(detail)}>
                    Apply advances
                  </Button>
                ) : null}
                <Button size="sm" icon={<Wallet className="h-4 w-4" />} onClick={() => openPayment(detail)} disabled={invoiceBalance(detail) <= 0}>
                  Record payment
                </Button>
              </div>
            </>
          ) : null
        }
      >
        {detail ? (
          <div className="flex flex-col gap-5">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={detail.status} />
              {detail.orderConfirmed ? <Badge tone="success">Order confirmed</Badge> : <Badge tone="warning">Order not confirmed</Badge>}
              {detail.needsManufacturing ? <Badge tone="purple">Requires manufacturing</Badge> : <Badge tone="silver">From finished stock</Badge>}
              {isOrderDelivered(db, detail) ? <Badge tone="success">Delivered</Badge> : null}
            </div>

            <div className="overflow-x-auto rounded-lg border border-silver-200">
              <table className="w-full min-w-[560px] text-sm">
                <thead className="bg-silver-50 text-left">
                  <tr>
                    <th className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-silver-600">Description</th>
                    <th className="px-3 py-2 text-right text-[11px] font-semibold uppercase tracking-wide text-silver-600">Qty</th>
                    <th className="px-3 py-2 text-right text-[11px] font-semibold uppercase tracking-wide text-silver-600">Rate</th>
                    <th className="px-3 py-2 text-right text-[11px] font-semibold uppercase tracking-wide text-silver-600">GST</th>
                    <th className="px-3 py-2 text-right text-[11px] font-semibold uppercase tracking-wide text-silver-600">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-silver-200">
                  {detail.items.map((item) => (
                    <tr key={item.id}>
                      <td className="px-3 py-2.5">{item.description}</td>
                      <td className="px-3 py-2.5 text-right">{item.quantity}</td>
                      <td className="px-3 py-2.5 text-right">{formatCurrency(item.rate)}</td>
                      <td className="px-3 py-2.5 text-right">{item.taxRate}%</td>
                      <td className="px-3 py-2.5 text-right font-semibold">{formatCurrency(item.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="divide-y divide-silver-200">
                <DataRow label="Invoice date" value={formatDate(detail.date)} />
                <DataRow label="Due date" value={formatDate(detail.dueDate)} />
                <DataRow label="Order reference" value={detail.orderRef} />
                {detail.quotationId ? (
                  <DataRow label="Source quotation" value={db.quotations.find((q) => q.id === detail.quotationId)?.number ?? '—'} />
                ) : (
                  <DataRow label="Source" value="Direct order" />
                )}
              </div>
              <div className="rounded-xl border border-silver-200 bg-silver-50 p-4">
                <div className="flex justify-between py-1 text-sm">
                  <span className="text-silver-600">Subtotal</span>
                  <span className="font-medium text-navy-900">{formatCurrency(detail.subtotal)}</span>
                </div>
                <div className="flex justify-between py-1 text-sm">
                  <span className="text-silver-600">Discount</span>
                  <span className="font-medium text-navy-900">- {formatCurrency(detail.discountAmount)}</span>
                </div>
                <div className="flex justify-between py-1 text-sm">
                  <span className="text-silver-600">GST</span>
                  <span className="font-medium text-navy-900">{formatCurrency(detail.taxAmount)}</span>
                </div>
                <div className="mt-1 flex justify-between border-t border-silver-200 pt-2">
                  <span className="font-semibold text-navy-900">Grand total</span>
                  <span className="text-lg font-bold text-navy-900">{formatCurrency(detail.total)}</span>
                </div>
                <div className="mt-2 flex justify-between text-sm">
                  <span className="text-silver-600">Amount paid</span>
                  <span className="font-medium text-emerald-600">{formatCurrency(detail.amountPaid)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-silver-600">Balance due</span>
                  <span className="font-bold text-rose-600">{formatCurrency(invoiceBalance(detail))}</span>
                </div>
              </div>
            </div>

            <div>
              <p className="mb-2 text-xs font-semibold text-navy-800">Payments</p>
              {detail.payments.length === 0 ? (
                <p className="rounded-lg border border-dashed border-silver-300 px-4 py-4 text-center text-xs text-silver-600">
                  No payments recorded yet. Use “Record payment” to capture an advance or settlement.
                </p>
              ) : (
                <ul className="divide-y divide-silver-200 rounded-lg border border-silver-200">
                  {detail.payments.map((payment) => (
                    <li key={payment.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                      <div>
                        <p className="font-medium text-navy-900">
                          {formatCurrency(payment.amount)} · {payment.mode}
                        </p>
                        <p className="text-xs text-silver-600">
                          {formatDate(payment.date)} {payment.reference ? `· ${payment.reference}` : ''}
                        </p>
                      </div>
                      <Badge tone={payment.kind === 'Advance' ? 'info' : 'success'}>{payment.kind ?? 'Received'}</Badge>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {detail.notes ? (
              <div className="rounded-xl border border-silver-200 bg-silver-50 px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-silver-600">Notes</p>
                <p className="mt-1 text-sm leading-relaxed text-navy-800">{detail.notes}</p>
              </div>
            ) : null}
          </div>
        ) : null}
      </Modal>

      <Modal
        open={Boolean(paymentInvoice)}
        onClose={() => setPaymentInvoiceId(null)}
        size="sm"
        title="Record payment"
        subtitle={paymentInvoice ? `${paymentInvoice.number} · balance ${formatCurrency(invoiceBalance(paymentInvoice))}` : ''}
        footer={
          <>
            <Button variant="outline" onClick={() => setPaymentInvoiceId(null)}>
              Cancel
            </Button>
            <Button onClick={submitPayment}>Save payment</Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Field label="Amount (₹)" required error={paymentError}>
            <Input
              type="number"
              min={0}
              value={paymentForm.amount}
              onChange={(event) => {
                setPaymentForm({ ...paymentForm, amount: event.target.value })
                setPaymentError('')
              }}
              invalid={Boolean(paymentError)}
            />
          </Field>
          <Field label="Payment type" hint="Advance is received before fulfilment; Settlement clears the balance">
            <Select
              value={paymentForm.kind}
              onChange={(event) => setPaymentForm({ ...paymentForm, kind: event.target.value as PaymentKind })}
            >
              {(['Advance', 'Partial', 'Final'] as PaymentKind[]).map((kind) => (
                <option key={kind}>{kind}</option>
              ))}
            </Select>
          </Field>
          <Field label="Payment mode">
            <Select
              value={paymentForm.mode}
              onChange={(event) => setPaymentForm({ ...paymentForm, mode: event.target.value as PaymentMode })}
            >
              {PAYMENT_MODES.map((mode) => (
                <option key={mode}>{mode}</option>
              ))}
            </Select>
          </Field>
          <Field label="Payment date">
            <Input type="date" value={paymentForm.date} onChange={(event) => setPaymentForm({ ...paymentForm, date: event.target.value })} />
          </Field>
          <Field label="Reference" hint="Cheque number, UPI transaction id, NEFT reference…">
            <Input value={paymentForm.reference} onChange={(event) => setPaymentForm({ ...paymentForm, reference: event.target.value })} />
          </Field>
        </div>
      </Modal>

      <Modal
        open={advanceOpen}
        onClose={() => setAdvanceOpen(false)}
        size="sm"
        title="Record advance"
        subtitle="Money received before an invoice exists. It is applied when the invoice is raised."
        footer={
          <>
            <Button variant="outline" onClick={() => setAdvanceOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submitAdvance}>Save advance</Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Field label="Customer" required error={advanceError}>
            <Select
              value={advanceForm.customerId}
              onChange={(event) => {
                setAdvanceForm({ ...advanceForm, customerId: event.target.value })
                setAdvanceError('')
              }}
              invalid={Boolean(advanceError)}
            >
              <option value="">Select customer…</option>
              {db.customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.code} · {customer.companyName}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Amount (₹)" required error={advanceError}>
            <Input
              type="number"
              min={0}
              value={advanceForm.amount}
              onChange={(event) => {
                setAdvanceForm({ ...advanceForm, amount: event.target.value })
                setAdvanceError('')
              }}
              invalid={Boolean(advanceError)}
            />
          </Field>
          <Field label="Order reference (optional)" hint="Leave blank for a general advance on the customer's account">
            <Input
              list="advance-order-refs"
              value={advanceForm.orderRef}
              onChange={(event) => setAdvanceForm({ ...advanceForm, orderRef: event.target.value })}
              placeholder="QT-… or ORD-…"
            />
            <datalist id="advance-order-refs">
              {[...new Set([...db.quotations.map((quotation) => quotation.number), ...db.invoices.map((invoice) => invoice.orderRef)])].map((ref) => (
                <option key={ref} value={ref} />
              ))}
            </datalist>
          </Field>
          <Field label="Payment mode">
            <Select value={advanceForm.mode} onChange={(event) => setAdvanceForm({ ...advanceForm, mode: event.target.value as PaymentMode })}>
              {PAYMENT_MODES.map((mode) => (
                <option key={mode}>{mode}</option>
              ))}
            </Select>
          </Field>
          <Field label="Received on">
            <Input type="date" value={advanceForm.date} onChange={(event) => setAdvanceForm({ ...advanceForm, date: event.target.value })} />
          </Field>
          <Field label="Reference" hint="Cheque number, UPI transaction id, NEFT reference…">
            <Input value={advanceForm.reference} onChange={(event) => setAdvanceForm({ ...advanceForm, reference: event.target.value })} />
          </Field>
          <Field label="Notes">
            <Textarea value={advanceForm.notes} onChange={(event) => setAdvanceForm({ ...advanceForm, notes: event.target.value })} placeholder="Order value, balance terms…" />
          </Field>
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteId)}
        title="Delete invoice"
        message="The invoice and its linked production, packaging and dispatch records will be removed. This cannot be undone."
        confirmLabel="Delete invoice"
        onCancel={() => setDeleteId(null)}
        onConfirm={confirmDelete}
      />

      <PrintPortal open={Boolean(printInvoice)} onDone={() => setPrintId(null)}>
        {printInvoice ? (
          <InvoiceDocument
            invoice={printInvoice}
            customer={db.customers.find((customer) => customer.id === printInvoice.customerId)}
            settings={db.settings}
          />
        ) : null}
      </PrintPortal>

      {db.invoices.length === 0 ? (
        <EmptyState icon={<Receipt className="h-5 w-5" />} title="No invoices yet" description="Convert an approved quotation or raise a direct order invoice." />
      ) : null}
    </>
  )
}

function QuotationPreview({ quotationId }: { quotationId: string }) {
  const { db } = useData()
  const quotation = db.quotations.find((item) => item.id === quotationId)
  if (!quotation) return null
  return (
    <Card className="bg-silver-50">
      <CardHeader
        title={`${quotation.number} · ${customerName(db, quotation.customerId)}`}
        subtitle={`${quotation.items.length} line items · valid until ${formatDate(quotation.validUntil)}`}
        action={<Badge tone="success">{quotation.status}</Badge>}
      />
      <ul className="mt-3 divide-y divide-silver-200">
        {quotation.items.map((item) => (
          <li key={item.id} className="flex items-center justify-between gap-4 py-2 text-sm">
            <span className="text-navy-800">
              {item.description} <span className="text-silver-600">× {item.quantity}</span>
            </span>
            <span className="font-medium text-navy-900">{formatCurrency(item.total)}</span>
          </li>
        ))}
      </ul>
      <div className="mt-3 flex justify-between border-t border-silver-200 pt-3">
        <span className="font-semibold text-navy-900">Quotation total</span>
        <span className="text-lg font-bold text-navy-900">{formatCurrency(quotation.total)}</span>
      </div>
    </Card>
  )
}
