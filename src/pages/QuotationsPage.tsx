import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  Check,
  Copy,
  FileText,
  GitBranch,
  Pencil,
  Plus,
  Printer,
  Receipt,
  Search,
  Trash2,
} from 'lucide-react'
import type { Quotation, QuotationStatus } from '@/types'
import { QUOTATION_STATUSES } from '@/types'
import { PageHeader, EmptyState, SearchInput, Toolbar, DataRow } from '@/components/ui/Layout'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { StatusBadge, Badge } from '@/components/ui/Badge'
import { Field, Input, Select, Textarea } from '@/components/ui/Form'
import { Modal, ConfirmDialog } from '@/components/ui/Modal'
import { StatCard } from '@/components/ui/StatCard'
import { TBody, THead, Td, Th, TR, Table, TableEmptyRow, TableShell } from '@/components/ui/Table'
import { LineItemEditor, newLineItem } from '@/components/LineItemEditor'
import { openQuotationDocument } from '@/lib/printDocument'
import { useData } from '@/store/DataContext'
import { useToast } from '@/store/ToastContext'
import { buildLineItem, computeTotals, customerName, type LineItemInput } from '@/lib/calc'
import { convertQuotationToInvoice, createQuotation, duplicateQuotation, pushActivity } from '@/lib/workflow'
import { dealIdOf, dealSummary } from '@/lib/deals'
import { addDaysISO, cn, downloadCSV, formatCurrency, formatDate, todayISO } from '@/lib/utils'

export function QuotationsPage() {
  const { db, mutate } = useData()
  const toast = useToast()
  const navigate = useNavigate()
  const location = useLocation()

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [customerFilter, setCustomerFilter] = useState('all')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Quotation | null>(null)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const [customerId, setCustomerId] = useState('')
  const [date, setDate] = useState(() => todayISO())
  const [validUntil, setValidUntil] = useState(() => addDaysISO(todayISO(), 30))
  const [notes, setNotes] = useState('')
  const [formStatus, setFormStatus] = useState<QuotationStatus>('Draft')
  const [items, setItems] = useState<LineItemInput[]>(() => [newLineItem(db.settings.defaultTaxRate)])
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    const focusId = (location.state as { focusId?: string } | null)?.focusId
    if (focusId) setDetailId(focusId)
  }, [location.state])

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    return db.quotations
      .filter((quotation) => {
        const name = customerName(db, quotation.customerId)
        const matchesTerm = !term || `${quotation.number} ${name} ${quotation.notes}`.toLowerCase().includes(term)
        const matchesStatus = statusFilter === 'all' || quotation.status === statusFilter
        const matchesCustomer = customerFilter === 'all' || quotation.customerId === customerFilter
        return matchesTerm && matchesStatus && matchesCustomer
      })
      .sort((a, b) => (a.date < b.date ? 1 : -1))
  }, [db, search, statusFilter, customerFilter])

  const detail = db.quotations.find((quotation) => quotation.id === detailId) ?? null

  const openDocument = (quotation: Quotation) =>
    openQuotationDocument(
      quotation,
      db.customers.find((customer) => customer.id === quotation.customerId),
      db.settings,
    )

  const totals = useMemo(() => computeTotals(items.map(buildLineItem)), [items])

  // Group quotations into their deal so the several quotations raised for one
  // opportunity are visible together. Derived, so records without a stored
  // dealId still group by the customer's originating lead.
  const dealQuotations = useMemo(() => {
    const map = new Map<string, Quotation[]>()
    db.quotations.forEach((quotation) => {
      const key = dealIdOf(db, quotation)
      const list = map.get(key) ?? []
      list.push(quotation)
      map.set(key, list)
    })
    return map
  }, [db])

  const siblingsOf = (quotation: Quotation) =>
    (dealQuotations.get(dealIdOf(db, quotation)) ?? []).filter((item) => item.id !== quotation.id)

  const openCreateForDeal = (quotation: Quotation) => {
    setEditing(null)
    resetForm()
    setCustomerId(quotation.customerId)
    setFormOpen(true)
  }

  const stats = useMemo(() => {
    const approved = db.quotations.filter((quotation) => quotation.status === 'Approved')
    const pending = db.quotations.filter((quotation) => quotation.status === 'Draft' || quotation.status === 'Sent')
    const converted = db.quotations.filter((quotation) => quotation.convertedInvoiceId)
    return {
      count: db.quotations.length,
      approvedValue: approved.reduce((acc, quotation) => acc + quotation.total, 0),
      pendingCount: pending.length,
      pendingValue: pending.reduce((acc, quotation) => acc + quotation.total, 0),
      conversionRate: db.quotations.length ? Math.round((converted.length / db.quotations.length) * 100) : 0,
      converted: converted.length,
    }
  }, [db.quotations])

  const resetForm = () => {
    setCustomerId('')
    setDate(todayISO())
    setValidUntil(addDaysISO(todayISO(), 30))
    setNotes('')
    setFormStatus('Draft')
    setItems([newLineItem(db.settings.defaultTaxRate)])
    setErrors({})
  }

  const openCreate = () => {
    setEditing(null)
    resetForm()
    setFormOpen(true)
  }

  const openEdit = (quotation: Quotation) => {
    setEditing(quotation)
    setCustomerId(quotation.customerId)
    setDate(quotation.date)
    setValidUntil(quotation.validUntil)
    setNotes(quotation.notes)
    setFormStatus(quotation.status)
    setItems(quotation.items.map((item) => ({ ...item })))
    setErrors({})
    setFormOpen(true)
  }

  const validate = () => {
    const next: Record<string, string> = {}
    if (!customerId) next.customer = 'Select a customer.'
    if (items.length === 0) next.items = 'Add at least one line item.'
    if (items.some((item) => !item.description.trim())) next.items = 'Every line item needs a description.'
    if (items.some((item) => item.quantity <= 0)) next.items = 'Quantities must be greater than zero.'
    if (validUntil < date) next.validUntil = 'Valid until cannot be before the quotation date.'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const submit = () => {
    if (!validate()) return
    const cleaned = items.map((item) => ({
      ...item,
      description: item.description.trim(),
      quantity: Number(item.quantity) || 0,
      rate: Number(item.rate) || 0,
      discount: Number(item.discount) || 0,
      taxRate: Number(item.taxRate) || 0,
    }))

    if (editing) {
      mutate((draft) => {
        const target = draft.quotations.find((quotation) => quotation.id === editing.id)
        if (!target) return
        const computed = computeTotals(cleaned.map(buildLineItem))
        Object.assign(target, {
          customerId,
          date,
          validUntil,
          notes: notes.trim(),
          items: cleaned.map(buildLineItem),
          ...computed,
        })
        pushActivity(draft, 'Quotation', `Quotation ${target.number} updated`)
        if (target.status !== formStatus) {
          target.status = formStatus
          pushActivity(draft, 'Quotation', `${target.number} marked ${formStatus}`)
        }
      })
      toast.success('Quotation updated.')
    } else {
      mutate((draft) => {
        createQuotation(draft, {
          customerId,
          date,
          validUntil,
          items: cleaned,
          notes: notes.trim(),
          createdBy: 'Priya Sharma',
        })
      })
      toast.success('Quotation created.')
    }
    setFormOpen(false)
  }

  const changeStatus = (quotationId: string, status: QuotationStatus) => {
    mutate((draft) => {
      const target = draft.quotations.find((quotation) => quotation.id === quotationId)
      if (!target) return
      target.status = status
      pushActivity(draft, 'Quotation', `${target.number} marked ${status}`)
    })
    toast.success(`Quotation marked ${status}.`)
  }

  const makeCopy = (quotationId: string, mode: 'revision' | 'alternative') => {
    const created = mutate((draft) => duplicateQuotation(draft, quotationId, mode))
    toast.success(
      mode === 'revision'
        ? `Revision created as ${created?.number ?? 'new quotation'}.`
        : `Alternative quotation ${created?.number ?? ''} created.`,
    )
  }

  const convert = (quotation: Quotation) => {
    const customer = db.customers.find((item) => item.id === quotation.customerId)
    const result = mutate((draft) =>
      convertQuotationToInvoice(draft, quotation.id, customer?.paymentTerms ?? 30),
    )
    if (result.error && !result.invoice) {
      toast.error(result.error)
      return
    }
    toast.success(
      result.superseded
        ? `Quotation converted. ${result.superseded} other quotation(s) for this deal marked Superseded.`
        : 'Quotation converted into an invoice. Confirm the order to start production.',
    )
    setDetailId(null)
    if (result.invoice) navigate('/invoices', { state: { focusId: result.invoice.id } })
  }

  const confirmDelete = () => {
    if (!deleteId) return
    mutate((draft) => {
      const quotation = draft.quotations.find((item) => item.id === deleteId)
      draft.quotations = draft.quotations.filter((item) => item.id !== deleteId)
      if (quotation) pushActivity(draft, 'Quotation', `Quotation ${quotation.number} deleted`)
      draft.invoices = draft.invoices.map((invoice) =>
        invoice.quotationId === deleteId ? { ...invoice, quotationId: undefined } : invoice,
      )
    })
    toast.success('Quotation deleted.')
    setDeleteId(null)
    setDetailId(null)
  }

  const exportCSV = () => {
    downloadCSV(
      'quotations.csv',
      ['Number', 'Customer', 'Date', 'Valid Until', 'Items', 'Subtotal', 'Discount', 'GST', 'Total', 'Status', 'Revision'],
      filtered.map((quotation) => [
        quotation.number,
        customerName(db, quotation.customerId),
        quotation.date,
        quotation.validUntil,
        quotation.items.length,
        quotation.subtotal,
        quotation.discountAmount,
        quotation.taxAmount,
        quotation.total,
        quotation.status,
        quotation.revision,
      ]),
    )
    toast.success('Quotation list exported as CSV.')
  }

  return (
    <>
      <PageHeader
        eyebrow="Sales documents"
        icon={<FileText className="h-5 w-5" />}
        title="Quotation"
        actions={
          <>
            <Button variant="outline" icon={<Search className="h-4 w-4" />} onClick={exportCSV}>
              Export CSV
            </Button>
            <Button icon={<Plus className="h-4 w-4" />} onClick={openCreate}>
              New quotation
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total quotations" value={stats.count} icon={<FileText className="h-4.5 w-4.5" />} tone="blue" />
        <StatCard label="Approved value" value={formatCurrency(stats.approvedValue, true)} icon={<Check className="h-4.5 w-4.5" />} tone="emerald" />
        <StatCard label="Awaiting decision" value={stats.pendingCount} hint={`${formatCurrency(stats.pendingValue, true)} in draft / sent`} icon={<GitBranch className="h-4.5 w-4.5" />} tone="amber" />
        <StatCard label="Converted to invoices" value={`${stats.conversionRate}%`} hint={`${stats.converted} quotations converted`} icon={<Receipt className="h-4.5 w-4.5" />} tone="violet" />
      </div>

      <Card>
        <Toolbar className="justify-between">
          <div className="flex flex-1 flex-wrap items-center gap-2">
            <SearchInput value={search} onChange={setSearch} placeholder="Search quotation number or customer…" className="w-full sm:w-72" />
            <Select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="w-full sm:w-40">
              <option value="all">All statuses</option>
              {QUOTATION_STATUSES.map((status) => (
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
            {filtered.length} of {db.quotations.length} quotations
          </p>
        </Toolbar>
      </Card>

      <TableShell>
        <Table>
          <THead>
            <TR>
              <Th>Quotation</Th>
              <Th>Customer</Th>
              <Th>Date</Th>
              <Th>Valid until</Th>
              <Th align="right">Items</Th>
              <Th align="right">Total</Th>
              <Th>Status</Th>
              <Th align="right">Actions</Th>
            </TR>
          </THead>
          <TBody>
            {filtered.length === 0 ? (
              <TableEmptyRow colSpan={8}>
                No quotations match your filters. Create one to get started.
              </TableEmptyRow>
            ) : (
              filtered.map((quotation) => (
                <TR key={quotation.id} onClick={() => setDetailId(quotation.id)}>
                  <Td>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-navy-900">{quotation.number}</span>
                      {quotation.revision > 1 ? <Badge tone="purple">Rev {quotation.revision}</Badge> : null}
                      {quotation.convertedInvoiceId ? <Badge tone="success">Invoiced</Badge> : null}
                    </div>
                    <p className="text-xs text-silver-600">{quotation.createdBy}</p>
                  </Td>
                  <Td>
                    <p className="text-navy-800">{customerName(db, quotation.customerId)}</p>
                    {siblingsOf(quotation).length > 0 ? (
                      <p className="text-xs text-silver-600">
                        Deal · {(dealQuotations.get(dealIdOf(db, quotation)) ?? []).length} quotations
                      </p>
                    ) : null}
                  </Td>
                  <Td className="whitespace-nowrap">{formatDate(quotation.date)}</Td>
                  <Td className="whitespace-nowrap">{formatDate(quotation.validUntil)}</Td>
                  <Td align="right">{quotation.items.length}</Td>
                  <Td align="right" className="font-semibold">{formatCurrency(quotation.total)}</Td>
                  <Td>
                    <StatusBadge status={quotation.status} />
                  </Td>
                  <Td align="right">
                    <div className="flex items-center justify-end gap-1.5" onClick={(event) => event.stopPropagation()}>
                      <Button size="icon" variant="ghost" title="Open / print" onClick={() => openDocument(quotation)}>
                        <Printer className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" title="Edit" onClick={() => openEdit(quotation)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        title="Convert to invoice"
                        onClick={() => convert(quotation)}
                        disabled={Boolean(quotation.convertedInvoiceId)}
                      >
                        <Receipt className="h-4 w-4" />
                      </Button>
                    </div>
                  </Td>
                </TR>
              ))
            )}
          </TBody>
        </Table>
      </TableShell>

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        size="full"
        title={editing ? `Edit quotation ${editing.number}` : 'Create quotation'}
        subtitle="Totals, discounts and GST are calculated automatically."
        footer={
          <>
            <div className="mr-auto text-xs text-silver-600">
              Subtotal {formatCurrency(totals.subtotal)} · Discount {formatCurrency(totals.discountAmount)} · GST{' '}
              {formatCurrency(totals.taxAmount)}
            </div>
            <Button variant="outline" onClick={() => setFormOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submit}>{editing ? 'Save quotation' : 'Create quotation'}</Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <div className={cn('grid grid-cols-1 gap-4', editing ? 'sm:grid-cols-4' : 'sm:grid-cols-3')}>
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
            <Field label="Quotation date">
              <Input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
            </Field>
            <Field label="Valid until" error={errors.validUntil}>
              <Input type="date" value={validUntil} onChange={(event) => setValidUntil(event.target.value)} invalid={Boolean(errors.validUntil)} />
            </Field>
            {editing ? (
              <Field label="Status">
                <Select value={formStatus} onChange={(event) => setFormStatus(event.target.value as QuotationStatus)}>
                  {QUOTATION_STATUSES.map((status) => (
                    <option key={status}>{status}</option>
                  ))}
                </Select>
              </Field>
            ) : null}
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold text-navy-800">Line items</p>
            <LineItemEditor items={items} onChange={setItems} products={db.products} defaultTaxRate={db.settings.defaultTaxRate} />
            {errors.items ? <p className="mt-2 text-xs font-medium text-rose-600">{errors.items}</p> : null}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field label="Notes / terms" className="sm:col-span-2">
              <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Delivery timeline, packaging instructions, terms…" />
            </Field>
            <div className="rounded-xl border border-silver-200 bg-silver-50 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-silver-600">Summary</p>
              <div className="mt-2 flex flex-col gap-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-silver-600">Subtotal</span>
                  <span className="font-medium text-navy-900">{formatCurrency(totals.subtotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-silver-600">Discount</span>
                  <span className="font-medium text-navy-900">- {formatCurrency(totals.discountAmount)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-silver-600">GST</span>
                  <span className="font-medium text-navy-900">{formatCurrency(totals.taxAmount)}</span>
                </div>
                <div className="mt-1 flex justify-between border-t border-silver-200 pt-2">
                  <span className="font-semibold text-navy-900">Grand total</span>
                  <span className="text-base font-bold text-navy-900">{formatCurrency(totals.total)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Modal>

      <Modal
        open={Boolean(detail)}
        onClose={() => setDetailId(null)}
        size="lg"
        title={detail ? `Quotation ${detail.number}` : ''}
        subtitle={detail ? `${customerName(db, detail.customerId)} · ${formatDate(detail.date)}` : ''}
        footer={
          detail ? (
            <>
              <Button variant="danger" size="sm" icon={<Trash2 className="h-4 w-4" />} onClick={() => setDeleteId(detail.id)}>
                Delete
              </Button>
              <div className="ml-auto flex flex-wrap gap-2">
                <Button variant="outline" size="sm" icon={<Printer className="h-4 w-4" />} onClick={() => openDocument(detail)}>
                  Print
                </Button>
                <Button variant="outline" size="sm" icon={<Pencil className="h-4 w-4" />} onClick={() => { setDetailId(null); openEdit(detail) }}>
                  Edit
                </Button>
                <Button variant="outline" size="sm" icon={<GitBranch className="h-4 w-4" />} onClick={() => makeCopy(detail.id, 'revision')}>
                  New revision
                </Button>
                <Button variant="outline" size="sm" icon={<Copy className="h-4 w-4" />} onClick={() => makeCopy(detail.id, 'alternative')}>
                  Alternative
                </Button>
                <Button
                  size="sm"
                  icon={<Receipt className="h-4 w-4" />}
                  onClick={() => convert(detail)}
                  disabled={Boolean(detail.convertedInvoiceId)}
                >
                  {detail.convertedInvoiceId ? 'Already invoiced' : 'Convert to invoice'}
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
              {detail.revision > 1 ? <Badge tone="purple">Revision {detail.revision}</Badge> : null}
              {detail.convertedInvoiceId ? <Badge tone="success">Converted to invoice</Badge> : null}
              {detail.parentId ? <Badge tone="silver">Derived from earlier version</Badge> : null}
            </div>

            <div className="overflow-x-auto rounded-lg border border-silver-200">
              <table className="w-full min-w-[560px] text-sm">
                <thead className="bg-silver-50 text-left">
                  <tr>
                    <th className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-silver-600">Description</th>
                    <th className="px-3 py-2 text-right text-[11px] font-semibold uppercase tracking-wide text-silver-600">Qty</th>
                    <th className="px-3 py-2 text-right text-[11px] font-semibold uppercase tracking-wide text-silver-600">Rate</th>
                    <th className="px-3 py-2 text-right text-[11px] font-semibold uppercase tracking-wide text-silver-600">Disc</th>
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
                      <td className="px-3 py-2.5 text-right">{item.discount}%</td>
                      <td className="px-3 py-2.5 text-right">{item.taxRate}%</td>
                      <td className="px-3 py-2.5 text-right font-semibold">{formatCurrency(item.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="divide-y divide-silver-200">
                <DataRow label="Customer" value={customerName(db, detail.customerId)} />
                <DataRow label="Quotation date" value={formatDate(detail.date)} />
                <DataRow label="Valid until" value={formatDate(detail.validUntil)} />
                <DataRow label="Prepared by" value={detail.createdBy} />
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
              </div>
            </div>

            <div className="rounded-xl border border-silver-200 bg-silver-50 p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-[11px] font-semibold tracking-wide text-silver-600 uppercase">Deal</p>
                  <p className="mt-0.5 text-sm font-semibold text-navy-900">{dealSummary(db, dealIdOf(db, detail)).title}</p>
                  <p className="text-xs text-silver-600">{dealSummary(db, dealIdOf(db, detail)).subtitle}</p>
                </div>
                <Badge tone="neutral">{(dealQuotations.get(dealIdOf(db, detail)) ?? []).length} quotations</Badge>
              </div>

              {siblingsOf(detail).length > 0 ? (
                <>
                  <p className="mt-3 text-[11px] font-semibold tracking-wide text-silver-600 uppercase">
                    Other quotations in this deal
                  </p>
                  <ul className="mt-2 flex flex-col gap-1.5">
                    {siblingsOf(detail).map((sibling) => (
                      <li
                        key={sibling.id}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-silver-200 bg-surface px-3 py-2"
                      >
                        <button type="button" className="text-left" onClick={() => setDetailId(sibling.id)}>
                          <span className="text-[13px] font-semibold text-navy-900">{sibling.number}</span>
                          <span className="ml-2 text-xs text-silver-600">
                            {sibling.revision > 1 ? `Rev ${sibling.revision} · ` : ''}
                            {formatDate(sibling.date)}
                          </span>
                        </button>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-navy-800">{formatCurrency(sibling.total)}</span>
                          <StatusBadge status={sibling.status} />
                        </div>
                      </li>
                    ))}
                  </ul>
                </>
              ) : null}

              <div className="mt-3">
                <Button size="sm" variant="outline" icon={<Plus className="h-4 w-4" />} onClick={() => openCreateForDeal(detail)}>
                  New quotation for this deal
                </Button>
              </div>
            </div>

            <Field label="Update status">
              <Select value={detail.status} onChange={(event) => changeStatus(detail.id, event.target.value as QuotationStatus)}>
                {QUOTATION_STATUSES.map((status) => (
                  <option key={status}>{status}</option>
                ))}
              </Select>
            </Field>

            {detail.notes ? (
              <div className="rounded-xl border border-silver-200 bg-silver-50 px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-silver-600">Notes</p>
                <p className="mt-1 text-sm leading-relaxed text-navy-800">{detail.notes}</p>
              </div>
            ) : null}
          </div>
        ) : null}
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteId)}
        title="Delete quotation"
        message="This quotation will be removed. Any invoice already created from it will keep its own record."
        confirmLabel="Delete quotation"
        onCancel={() => setDeleteId(null)}
        onConfirm={confirmDelete}
      />

      {db.quotations.length === 0 ? (
        <EmptyState
          icon={<FileText className="h-5 w-5" />}
          title="No quotations yet"
          description="Create your first quotation to send pricing to a customer."
        />
      ) : null}
    </>
  )
}
