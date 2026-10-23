import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Building2, Mail, MapPin, Pencil, Phone, Plus, Receipt, Trash2, Users, Wallet } from 'lucide-react'
import type { Customer } from '@/types'
import { PageHeader, EmptyState, SearchInput, Toolbar, DataRow } from '@/components/ui/Layout'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge, StatusBadge } from '@/components/ui/Badge'
import { Field, Input, Select, Textarea } from '@/components/ui/Form'
import { Modal, ConfirmDialog } from '@/components/ui/Modal'
import { StatCard } from '@/components/ui/StatCard'
import { TBody, THead, Td, Th, TR, Table, TableEmptyRow, TableShell } from '@/components/ui/Table'
import { useData } from '@/store/DataContext'
import { useToast } from '@/store/ToastContext'
import { createCustomer, pushActivity } from '@/lib/workflow'
import { buildCustomerLedger, customerBilled, customerOutstanding, invoiceBalance } from '@/lib/calc'
import { cn, downloadCSV, formatCurrency, formatDate, formatNumber } from '@/lib/utils'

type LedgerTab = 'quotations' | 'invoices' | 'payments' | 'ledger'

export function CustomersPage() {
  const { db, mutate } = useData()
  const toast = useToast()
  const location = useLocation()
  const navigate = useNavigate()

  const [search, setSearch] = useState('')
  const [cityFilter, setCityFilter] = useState('all')
  const [outstandingOnly, setOutstandingOnly] = useState(false)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Customer | null>(null)
  const [tab, setTab] = useState<LedgerTab>('invoices')

  const [form, setForm] = useState({
    companyName: '',
    contactPerson: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    gstin: '',
    paymentTerms: '30',
    creditLimit: '500000',
    notes: '',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    const focusId = (location.state as { focusId?: string } | null)?.focusId
    if (focusId) {
      setDetailId(focusId)
      setTab('invoices')
    }
  }, [location.state])

  const cities = useMemo(() => [...new Set(db.customers.map((customer) => customer.city).filter(Boolean))].sort(), [db.customers])

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    return db.customers.filter((customer) => {
      const matchesTerm =
        !term ||
        `${customer.companyName} ${customer.contactPerson} ${customer.code} ${customer.email} ${customer.gstin}`
          .toLowerCase()
          .includes(term)
      const matchesCity = cityFilter === 'all' || customer.city === cityFilter
      const matchesOutstanding = !outstandingOnly || customerOutstanding(db, customer.id) > 0
      return matchesTerm && matchesCity && matchesOutstanding
    })
  }, [db, search, cityFilter, outstandingOnly])

  const detail = db.customers.find((customer) => customer.id === detailId) ?? null

  const stats = useMemo(() => {
    const billed = db.customers.reduce((acc, customer) => acc + customerBilled(db, customer.id), 0)
    const outstanding = db.customers.reduce((acc, customer) => acc + customerOutstanding(db, customer.id), 0)
    return {
      count: db.customers.length,
      billed,
      outstanding,
      withDues: db.customers.filter((customer) => customerOutstanding(db, customer.id) > 0).length,
    }
  }, [db])

  const openCreate = () => {
    setEditing(null)
    setForm({
      companyName: '',
      contactPerson: '',
      email: '',
      phone: '',
      address: '',
      city: '',
      state: '',
      gstin: '',
      paymentTerms: '30',
      creditLimit: '500000',
      notes: '',
    })
    setErrors({})
    setFormOpen(true)
  }

  const openEdit = (customer: Customer) => {
    setEditing(customer)
    setForm({
      companyName: customer.companyName,
      contactPerson: customer.contactPerson,
      email: customer.email,
      phone: customer.phone,
      address: customer.address,
      city: customer.city,
      state: customer.state,
      gstin: customer.gstin,
      paymentTerms: String(customer.paymentTerms),
      creditLimit: String(customer.creditLimit),
      notes: customer.notes,
    })
    setErrors({})
    setFormOpen(true)
  }

  const submit = () => {
    const next: Record<string, string> = {}
    if (!form.companyName.trim()) next.companyName = 'Company name is required.'
    if (!form.contactPerson.trim()) next.contactPerson = 'Contact person is required.'
    if (!form.email.trim()) next.email = 'Email is required.'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) next.email = 'Enter a valid email address.'
    if (!form.phone.trim()) next.phone = 'Phone number is required.'
    if (form.gstin.trim() && !/^[0-9]{2}[A-Z0-9]{13}$/i.test(form.gstin.trim())) next.gstin = 'GSTIN must be 15 characters.'
    setErrors(next)
    if (Object.keys(next).length > 0) return

    if (editing) {
      mutate((draft) => {
        const target = draft.customers.find((customer) => customer.id === editing.id)
        if (!target) return
        Object.assign(target, {
          companyName: form.companyName.trim(),
          contactPerson: form.contactPerson.trim(),
          email: form.email.trim(),
          phone: form.phone.trim(),
          address: form.address.trim(),
          city: form.city.trim(),
          state: form.state.trim(),
          gstin: form.gstin.trim().toUpperCase(),
          paymentTerms: Number(form.paymentTerms) || 0,
          creditLimit: Number(form.creditLimit) || 0,
          notes: form.notes.trim(),
        })
        pushActivity(draft, 'Customer', `Customer ${target.companyName} updated`)
      })
      toast.success('Customer updated.')
    } else {
      mutate((draft) => {
        createCustomer(draft, {
          companyName: form.companyName.trim(),
          contactPerson: form.contactPerson.trim(),
          email: form.email.trim(),
          phone: form.phone.trim(),
          address: form.address.trim(),
          city: form.city.trim(),
          state: form.state.trim(),
          gstin: form.gstin.trim().toUpperCase(),
          paymentTerms: Number(form.paymentTerms) || 0,
          creditLimit: Number(form.creditLimit) || 0,
          notes: form.notes.trim(),
        })
      })
      toast.success('Customer added.')
    }
    setFormOpen(false)
  }

  const confirmDelete = () => {
    if (!deleteId) return
    const linkedInvoices = db.invoices.filter((invoice) => invoice.customerId === deleteId).length
    if (linkedInvoices > 0) {
      toast.error(`This customer has ${linkedInvoices} invoice(s). Delete those records first to keep the ledger consistent.`)
      setDeleteId(null)
      return
    }
    mutate((draft) => {
      const customer = draft.customers.find((item) => item.id === deleteId)
      draft.customers = draft.customers.filter((item) => item.id !== deleteId)
      draft.leads = draft.leads.map((lead) =>
        lead.convertedCustomerId === deleteId ? { ...lead, convertedCustomerId: undefined } : lead,
      )
      if (customer) pushActivity(draft, 'Customer', `Customer ${customer.companyName} deleted`)
    })
    toast.success('Customer deleted.')
    setDeleteId(null)
    setDetailId(null)
  }

  const exportCSV = () => {
    downloadCSV(
      'customers.csv',
      ['Code', 'Company', 'Contact', 'Email', 'Phone', 'City', 'State', 'GSTIN', 'Terms', 'Billed', 'Outstanding'],
      filtered.map((customer) => [
        customer.code,
        customer.companyName,
        customer.contactPerson,
        customer.email,
        customer.phone,
        customer.city,
        customer.state,
        customer.gstin,
        customer.paymentTerms,
        customerBilled(db, customer.id),
        customerOutstanding(db, customer.id),
      ]),
    )
    toast.success('Customer list exported as CSV.')
  }

  return (
    <>
      <PageHeader
        eyebrow="Master data"
        icon={<Users className="h-5 w-5" />}
        title="Customer"
        description="Customer master data with related quotations, invoices, payments and ledger."
        actions={
          <>
            <Button variant="outline" onClick={exportCSV}>
              Export CSV
            </Button>
            <Button icon={<Plus className="h-4 w-4" />} onClick={openCreate}>
              Add customer
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Customers" value={stats.count} hint={`${stats.withDues} with outstanding dues`} icon={<Users className="h-4.5 w-4.5" />} tone="blue" />
        <StatCard label="Total billed" value={formatCurrency(stats.billed, true)} hint="Across all invoices" icon={<Receipt className="h-4.5 w-4.5" />} tone="violet" />
        <StatCard label="Outstanding" value={formatCurrency(stats.outstanding, true)} hint="Balance receivable" icon={<Wallet className="h-4.5 w-4.5" />} tone="rose" />
        <StatCard
          label="Average credit terms"
          value={`${Math.round(db.customers.reduce((acc, customer) => acc + customer.paymentTerms, 0) / Math.max(db.customers.length, 1))} days`}
          hint="Across the customer base"
          icon={<Building2 className="h-4.5 w-4.5" />}
          tone="navy"
        />
      </div>

      <Card>
        <Toolbar className="justify-between">
          <div className="flex flex-1 flex-wrap items-center gap-2">
            <SearchInput value={search} onChange={setSearch} placeholder="Search company, contact, GSTIN…" className="w-full sm:w-72" />
            <Select value={cityFilter} onChange={(event) => setCityFilter(event.target.value)} className="w-full sm:w-44">
              <option value="all">All cities</option>
              {cities.map((city) => (
                <option key={city}>{city}</option>
              ))}
            </Select>
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-silver-300 bg-surface px-3 py-2 text-xs font-semibold text-navy-800">
              <input type="checkbox" className="h-4 w-4 rounded border-silver-300 text-blue-600" checked={outstandingOnly} onChange={(event) => setOutstandingOnly(event.target.checked)} />
              With outstanding only
            </label>
          </div>
          <p className="text-xs text-silver-600">
            {filtered.length} of {db.customers.length} customers
          </p>
        </Toolbar>
      </Card>

      <TableShell>
        <Table className="min-w-[1000px]">
          <THead>
            <TR>
              <Th>Code</Th>
              <Th>Company</Th>
              <Th>Contact</Th>
              <Th>City</Th>
              <Th>GSTIN</Th>
              <Th align="right">Terms</Th>
              <Th align="right">Billed</Th>
              <Th align="right">Outstanding</Th>
              <Th align="right">Actions</Th>
            </TR>
          </THead>
          <TBody>
            {filtered.length === 0 ? (
              <TableEmptyRow colSpan={9}>No customers match your filters.</TableEmptyRow>
            ) : (
              filtered.map((customer) => {
                const outstanding = customerOutstanding(db, customer.id)
                return (
                  <TR key={customer.id} onClick={() => { setDetailId(customer.id); setTab('invoices') }}>
                    <Td className="font-mono text-xs text-silver-600">{customer.code}</Td>
                    <Td>
                      <p className="font-medium text-navy-900">{customer.companyName}</p>
                      <p className="text-xs text-silver-600">{customer.email}</p>
                    </Td>
                    <Td>
                      <p className="text-navy-800">{customer.contactPerson}</p>
                      <p className="text-xs text-silver-600">{customer.phone}</p>
                    </Td>
                    <Td>{customer.city || '—'}</Td>
                    <Td className="font-mono text-xs text-silver-600">{customer.gstin || '—'}</Td>
                    <Td align="right">{customer.paymentTerms} d</Td>
                    <Td align="right">{formatCurrency(customerBilled(db, customer.id))}</Td>
                    <Td align="right" className={outstanding > 0 ? 'font-semibold text-rose-600' : 'text-silver-600'}>
                      {formatCurrency(outstanding)}
                    </Td>
                    <Td align="right">
                      <div className="flex items-center justify-end gap-1.5" onClick={(event) => event.stopPropagation()}>
                        <Button size="icon" variant="ghost" title="Edit" onClick={() => openEdit(customer)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" title="Delete" onClick={() => setDeleteId(customer.id)}>
                          <Trash2 className="h-4 w-4 text-rose-500" />
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
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? `Edit ${editing.companyName}` : 'Add customer'}
        subtitle="Customer master details used on quotations, invoices and ledgers."
        size="lg"
        footer={
          <>
            <Button variant="outline" onClick={() => setFormOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submit}>{editing ? 'Save customer' : 'Add customer'}</Button>
          </>
        }
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Company name" required error={errors.companyName}>
            <Input value={form.companyName} onChange={(event) => setForm({ ...form, companyName: event.target.value })} invalid={Boolean(errors.companyName)} />
          </Field>
          <Field label="Contact person" required error={errors.contactPerson}>
            <Input value={form.contactPerson} onChange={(event) => setForm({ ...form, contactPerson: event.target.value })} invalid={Boolean(errors.contactPerson)} />
          </Field>
          <Field label="Email" required error={errors.email}>
            <Input value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} invalid={Boolean(errors.email)} />
          </Field>
          <Field label="Phone" required error={errors.phone}>
            <Input value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} invalid={Boolean(errors.phone)} />
          </Field>
          <Field label="City">
            <Input value={form.city} onChange={(event) => setForm({ ...form, city: event.target.value })} />
          </Field>
          <Field label="State">
            <Input value={form.state} onChange={(event) => setForm({ ...form, state: event.target.value })} />
          </Field>
          <Field label="GSTIN" error={errors.gstin}>
            <Input value={form.gstin} onChange={(event) => setForm({ ...form, gstin: event.target.value.toUpperCase() })} invalid={Boolean(errors.gstin)} placeholder="27ABCDE1234F1Z5" />
          </Field>
          <Field label="Payment terms (days)">
            <Input type="number" min={0} value={form.paymentTerms} onChange={(event) => setForm({ ...form, paymentTerms: event.target.value })} />
          </Field>
          <Field label="Credit limit (₹)">
            <Input type="number" min={0} value={form.creditLimit} onChange={(event) => setForm({ ...form, creditLimit: event.target.value })} />
          </Field>
          <Field label="Address" className="sm:col-span-2">
            <Textarea value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} />
          </Field>
          <Field label="Notes" className="sm:col-span-2">
            <Textarea value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} placeholder="Preferences, special pricing, delivery instructions…" />
          </Field>
        </div>
      </Modal>

      <Modal
        open={Boolean(detail)}
        onClose={() => setDetailId(null)}
        size="xl"
        title={detail ? detail.companyName : ''}
        subtitle={detail ? `${detail.code} · ${detail.city || 'City not set'} · ${detail.paymentTerms} day terms` : ''}
        footer={
          detail ? (
            <>
              <Button variant="danger" size="sm" icon={<Trash2 className="h-4 w-4" />} onClick={() => setDeleteId(detail.id)}>
                Delete
              </Button>
              <div className="ml-auto flex gap-2">
                <Button size="sm" variant="outline" icon={<Pencil className="h-4 w-4" />} onClick={() => { setDetailId(null); openEdit(detail) }}>
                  Edit
                </Button>
                <Button size="sm" icon={<Receipt className="h-4 w-4" />} onClick={() => navigate('/invoices')}>
                  Go to invoices
                </Button>
              </div>
            </>
          ) : null
        }
      >
        {detail ? <CustomerDetail customer={detail} tab={tab} setTab={setTab} /> : null}
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteId)}
        title="Delete customer"
        message="This customer will be permanently removed. Customers with existing invoices cannot be deleted."
        confirmLabel="Delete customer"
        onCancel={() => setDeleteId(null)}
        onConfirm={confirmDelete}
      />

      {db.customers.length === 0 ? (
        <EmptyState icon={<Users className="h-5 w-5" />} title="No customers yet" description="Add a customer or convert a lead to get started." />
      ) : null}
    </>
  )
}

function CustomerDetail({ customer, tab, setTab }: { customer: Customer; tab: LedgerTab; setTab: (tab: LedgerTab) => void }) {
  const { db } = useData()

  const quotations = db.quotations.filter((quotation) => quotation.customerId === customer.id)
  const invoices = db.invoices.filter((invoice) => invoice.customerId === customer.id)
  const payments = invoices.flatMap((invoice) =>
    invoice.payments.map((payment) => ({ ...payment, invoiceNumber: invoice.number })),
  )
  const ledger = buildCustomerLedger(db, customer.id)
  const outstanding = customerOutstanding(db, customer.id)

  const tabs: Array<{ key: LedgerTab; label: string; count: number }> = [
    { key: 'quotations', label: 'Quotations', count: quotations.length },
    { key: 'invoices', label: 'Invoices', count: invoices.length },
    { key: 'payments', label: 'Payments', count: payments.length },
    { key: 'ledger', label: 'Ledger', count: ledger.length },
  ]

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-silver-200 bg-silver-50 px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-silver-600">Total billed</p>
          <p className="text-lg font-bold text-navy-900">{formatCurrency(customerBilled(db, customer.id))}</p>
        </div>
        <div className="rounded-xl border border-silver-200 bg-silver-50 px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-silver-600">Outstanding</p>
          <p className={cn('text-lg font-bold', outstanding > 0 ? 'text-rose-600' : 'text-emerald-600')}>
            {formatCurrency(outstanding)}
          </p>
        </div>
        <div className="rounded-xl border border-silver-200 bg-silver-50 px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-silver-600">Credit limit</p>
          <p className="text-lg font-bold text-navy-900">{formatCurrency(customer.creditLimit, true)}</p>
        </div>
        <div className="rounded-xl border border-silver-200 bg-silver-50 px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-silver-600">Payment terms</p>
          <p className="text-lg font-bold text-navy-900">{customer.paymentTerms} days</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="divide-y divide-silver-200">
          <DataRow label="Contact person" value={customer.contactPerson} />
          <DataRow
            label="Email"
            value={
              <a href={`mailto:${customer.email}`} className="inline-flex items-center gap-1.5 text-blue-600 hover:underline">
                <Mail className="h-3.5 w-3.5" />
                {customer.email}
              </a>
            }
          />
          <DataRow
            label="Phone"
            value={
              <a href={`tel:${customer.phone}`} className="inline-flex items-center gap-1.5 text-blue-600 hover:underline">
                <Phone className="h-3.5 w-3.5" />
                {customer.phone}
              </a>
            }
          />
          <DataRow label="GSTIN" value={customer.gstin || '—'} />
        </div>
        <div className="rounded-xl border border-silver-200 bg-silver-50 p-4">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-silver-600">
            <MapPin className="h-3.5 w-3.5" /> Billing address
          </p>
          <p className="mt-1.5 text-sm leading-relaxed text-navy-800">
            {customer.address || '—'}
            <br />
            {customer.city}
            {customer.state ? `, ${customer.state}` : ''}
          </p>
          {customer.notes ? <p className="mt-3 text-xs italic text-silver-600">{customer.notes}</p> : null}
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5 rounded-xl border border-silver-200 bg-silver-50 p-1.5">
        {tabs.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setTab(item.key)}
            className={cn(
              'rounded-lg px-3 py-2 text-xs font-semibold transition',
              tab === item.key ? 'bg-surface text-navy-900 shadow-sm' : 'text-silver-600 hover:text-navy-800',
            )}
          >
            {item.label} ({item.count})
          </button>
        ))}
      </div>

      {tab === 'quotations' ? (
        quotations.length === 0 ? (
          <EmptyState title="No quotations" description="This customer has no quotations on record." />
        ) : (
          <TableShell>
            <Table className="min-w-[600px]">
              <THead>
                <TR>
                  <Th>Number</Th>
                  <Th>Date</Th>
                  <Th align="right">Total</Th>
                  <Th>Status</Th>
                </TR>
              </THead>
              <TBody>
                {quotations.map((quotation) => (
                  <TR key={quotation.id}>
                    <Td className="font-medium text-navy-900">{quotation.number}</Td>
                    <Td>{formatDate(quotation.date)}</Td>
                    <Td align="right">{formatCurrency(quotation.total)}</Td>
                    <Td><StatusBadge status={quotation.status} /></Td>
                  </TR>
                ))}
              </TBody>
            </Table>
          </TableShell>
        )
      ) : null}

      {tab === 'invoices' ? (
        invoices.length === 0 ? (
          <EmptyState title="No invoices" description="No invoices have been raised for this customer yet." />
        ) : (
          <TableShell>
            <Table className="min-w-[640px]">
              <THead>
                <TR>
                  <Th>Number</Th>
                  <Th>Order ref</Th>
                  <Th>Due</Th>
                  <Th align="right">Total</Th>
                  <Th align="right">Balance</Th>
                  <Th>Status</Th>
                </TR>
              </THead>
              <TBody>
                {invoices.map((invoice) => (
                  <TR key={invoice.id}>
                    <Td className="font-medium text-navy-900">{invoice.number}</Td>
                    <Td className="text-xs text-silver-600">{invoice.orderRef}</Td>
                    <Td>{formatDate(invoice.dueDate)}</Td>
                    <Td align="right">{formatCurrency(invoice.total)}</Td>
                    <Td align="right" className={invoiceBalance(invoice) > 0 ? 'text-rose-600' : 'text-silver-600'}>
                      {formatCurrency(invoiceBalance(invoice))}
                    </Td>
                    <Td><StatusBadge status={invoice.status} /></Td>
                  </TR>
                ))}
              </TBody>
            </Table>
          </TableShell>
        )
      ) : null}

      {tab === 'payments' ? (
        payments.length === 0 ? (
          <EmptyState title="No payments" description="No payments recorded against this customer." />
        ) : (
          <TableShell>
            <Table className="min-w-[560px]">
              <THead>
                <TR>
                  <Th>Date</Th>
                  <Th>Invoice</Th>
                  <Th>Mode</Th>
                  <Th>Reference</Th>
                  <Th align="right">Amount</Th>
                </TR>
              </THead>
              <TBody>
                {payments.map((payment) => (
                  <TR key={payment.id}>
                    <Td>{formatDate(payment.date)}</Td>
                    <Td className="font-medium text-navy-900">{payment.invoiceNumber}</Td>
                    <Td><Badge tone="silver">{payment.mode}</Badge></Td>
                    <Td className="text-xs text-silver-600">{payment.reference || '—'}</Td>
                    <Td align="right" className="font-semibold text-emerald-600">{formatCurrency(payment.amount)}</Td>
                  </TR>
                ))}
              </TBody>
            </Table>
          </TableShell>
        )
      ) : null}

      {tab === 'ledger' ? (
        ledger.length === 0 ? (
          <EmptyState title="Ledger is empty" description="Ledger entries appear once invoices and payments exist." />
        ) : (
          <>
            <TableShell>
              <Table className="min-w-[720px]">
                <THead>
                  <TR>
                    <Th>Date</Th>
                    <Th>Reference</Th>
                    <Th>Description</Th>
                    <Th align="right">Debit</Th>
                    <Th align="right">Credit</Th>
                    <Th align="right">Balance</Th>
                  </TR>
                </THead>
                <TBody>
                  {ledger.map((entry) => (
                    <TR key={entry.id}>
                      <Td className="whitespace-nowrap">{formatDate(entry.date)}</Td>
                      <Td className="font-mono text-xs text-silver-600">{entry.reference}</Td>
                      <Td className="text-silver-600">{entry.description}</Td>
                      <Td align="right">{entry.debit ? formatCurrency(entry.debit) : '—'}</Td>
                      <Td align="right" className="text-emerald-600">{entry.credit ? formatCurrency(entry.credit) : '—'}</Td>
                      <Td align="right" className="font-semibold text-navy-900">{formatCurrency(entry.balance)}</Td>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </TableShell>
            <div className="flex flex-wrap justify-end gap-4 rounded-xl border border-silver-200 bg-silver-50 px-5 py-3 text-sm">
              <span className="text-silver-600">
                Total debit <span className="font-semibold text-navy-900">{formatCurrency(ledger.reduce((acc, e) => acc + e.debit, 0))}</span>
              </span>
              <span className="text-silver-600">
                Total credit <span className="font-semibold text-emerald-600">{formatCurrency(ledger.reduce((acc, e) => acc + e.credit, 0))}</span>
              </span>
              <span className="text-silver-600">
                Closing balance <span className="font-bold text-rose-600">{formatCurrency(outstanding)}</span>
              </span>
            </div>
          </>
        )
      ) : null}

      <p className="text-xs text-silver-500">
        {formatNumber(quotations.length)} quotations · {formatNumber(invoices.length)} invoices ·{' '}
        {formatNumber(payments.length)} payments linked to this customer.
      </p>
    </div>
  )
}
