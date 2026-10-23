import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  Building2,
  CalendarDays,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Plus,
  Target,
  Trash2,
  UserPlus,
  Users,
} from 'lucide-react'
import type { Lead, LeadSource, LeadStage } from '@/types'
import { LEAD_SOURCES, LEAD_STAGES } from '@/types'
import { PageHeader, SearchInput, Toolbar, DataRow } from '@/components/ui/Layout'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Field, Input, Select, Textarea } from '@/components/ui/Form'
import { Modal, ConfirmDialog } from '@/components/ui/Modal'
import { StatCard } from '@/components/ui/StatCard'
import { useData } from '@/store/DataContext'
import { useToast } from '@/store/ToastContext'
import { convertLeadToCustomer, pushActivity } from '@/lib/workflow'
import { formatCurrency, formatDate, todayISO, uid } from '@/lib/utils'
import { cn } from '@/lib/utils'

interface LeadFormState {
  name: string
  company: string
  email: string
  phone: string
  city: string
  source: LeadSource
  assignedTo: string
  expectedValue: string
  stage: LeadStage
  followUpDate: string
  notes: string
}

const EMPTY_FORM: LeadFormState = {
  name: '',
  company: '',
  email: '',
  phone: '',
  city: '',
  source: 'Website',
  assignedTo: 'Priya Sharma',
  expectedValue: '',
  stage: 'New Lead',
  followUpDate: todayISO(),
  notes: '',
}

const SALES_TEAM = ['Priya Sharma', 'Amit Verma', 'Neha Gupta']

const STAGE_GRADIENT: Record<LeadStage, string> = {
  'New Lead': 'from-blue-400 to-blue-600',
  Contacted: 'from-violet-400 to-violet-600',
  'Follow-up': 'from-amber-400 to-amber-600',
  Negotiation: 'from-amber-500 to-rose-500',
  Won: 'from-emerald-400 to-emerald-600',
  Lost: 'from-rose-400 to-rose-600',
}

export function LeadsPage() {
  const { db, mutate } = useData()
  const toast = useToast()
  const location = useLocation()
  const navigate = useNavigate()

  const [search, setSearch] = useState('')
  const [ownerFilter, setOwnerFilter] = useState('all')
  const [sourceFilter, setSourceFilter] = useState('all')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Lead | null>(null)
  const [form, setForm] = useState<LeadFormState>(EMPTY_FORM)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [detailId, setDetailId] = useState<string | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [convertId, setConvertId] = useState<string | null>(null)
  const [dragging, setDragging] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState<LeadStage | null>(null)

  useEffect(() => {
    const focusId = (location.state as { focusId?: string } | null)?.focusId
    if (focusId) setDetailId(focusId)
  }, [location.state])

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    return db.leads.filter((lead) => {
      const matchesTerm =
        !term ||
        `${lead.name} ${lead.company} ${lead.email} ${lead.city} ${lead.assignedTo}`.toLowerCase().includes(term)
      const matchesOwner = ownerFilter === 'all' || lead.assignedTo === ownerFilter
      const matchesSource = sourceFilter === 'all' || lead.source === sourceFilter
      return matchesTerm && matchesOwner && matchesSource
    })
  }, [db.leads, search, ownerFilter, sourceFilter])

  const detail = db.leads.find((lead) => lead.id === detailId) ?? null
  const convertLead = db.leads.find((lead) => lead.id === convertId) ?? null

  const openValue = db.leads
    .filter((lead) => lead.stage !== 'Won' && lead.stage !== 'Lost')
    .reduce((acc, lead) => acc + lead.expectedValue, 0)
  const wonValue = db.leads
    .filter((lead) => lead.stage === 'Won')
    .reduce((acc, lead) => acc + lead.expectedValue, 0)

  const openCreate = () => {
    setEditing(null)
    setForm(EMPTY_FORM)
    setErrors({})
    setFormOpen(true)
  }

  const openEdit = (lead: Lead) => {
    setEditing(lead)
    setForm({
      name: lead.name,
      company: lead.company,
      email: lead.email,
      phone: lead.phone,
      city: lead.city,
      source: lead.source,
      assignedTo: lead.assignedTo,
      expectedValue: String(lead.expectedValue),
      stage: lead.stage,
      followUpDate: lead.followUpDate,
      notes: lead.notes,
    })
    setErrors({})
    setFormOpen(true)
  }

  const validate = (): boolean => {
    const next: Record<string, string> = {}
    if (!form.name.trim()) next.name = 'Contact name is required.'
    if (!form.company.trim()) next.company = 'Company name is required.'
    if (!form.email.trim()) next.email = 'Email is required.'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) next.email = 'Enter a valid email address.'
    if (!form.phone.trim()) next.phone = 'Phone number is required.'
    if (form.expectedValue && Number(form.expectedValue) < 0) next.expectedValue = 'Value cannot be negative.'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const submit = () => {
    if (!validate()) return
    mutate((draft) => {
      if (editing) {
        const target = draft.leads.find((lead) => lead.id === editing.id)
        if (target) {
          Object.assign(target, {
            name: form.name.trim(),
            company: form.company.trim(),
            email: form.email.trim(),
            phone: form.phone.trim(),
            city: form.city.trim(),
            source: form.source,
            assignedTo: form.assignedTo,
            expectedValue: Number(form.expectedValue) || 0,
            stage: form.stage,
            followUpDate: form.followUpDate,
            notes: form.notes.trim(),
          })
        }
        pushActivity(draft, 'Lead', `Lead ${form.company} updated`)
      } else {
        draft.leads.unshift({
          id: uid('lead'),
          name: form.name.trim(),
          company: form.company.trim(),
          email: form.email.trim(),
          phone: form.phone.trim(),
          city: form.city.trim(),
          source: form.source,
          assignedTo: form.assignedTo,
          expectedValue: Number(form.expectedValue) || 0,
          stage: form.stage,
          followUpDate: form.followUpDate,
          notes: form.notes.trim(),
          createdAt: new Date().toISOString(),
        })
        pushActivity(draft, 'Lead', `New lead added: ${form.company}`)
      }
    })
    toast.success(editing ? 'Lead updated successfully.' : 'Lead added successfully.')
    setFormOpen(false)
  }

  const moveStage = (leadId: string, stage: LeadStage) => {
    const lead = db.leads.find((item) => item.id === leadId)
    if (!lead || lead.stage === stage) return
    mutate((draft) => {
      const target = draft.leads.find((item) => item.id === leadId)
      if (!target) return
      target.stage = stage
      pushActivity(draft, 'Lead', `${target.company} moved to ${stage}`)
    })
    toast.notify(`${lead.company} moved to ${stage}.`)
  }

  const confirmDelete = () => {
    if (!deleteId) return
    mutate((draft) => {
      const lead = draft.leads.find((item) => item.id === deleteId)
      draft.leads = draft.leads.filter((item) => item.id !== deleteId)
      if (lead) pushActivity(draft, 'Lead', `Lead ${lead.company} deleted`)
    })
    toast.success('Lead deleted.')
    setDeleteId(null)
    setDetailId(null)
  }

  const submitConversion = (input: {
    companyName: string
    contactPerson: string
    email: string
    phone: string
    city: string
    state: string
    address: string
    gstin: string
    paymentTerms: number
    creditLimit: number
  }) => {
    if (!convertId) return
    const customer = mutate((draft) => convertLeadToCustomer(draft, convertId, input))
    toast.success('Lead converted into a customer.')
    setConvertId(null)
    setDetailId(null)
    navigate('/customers', { state: { focusId: customer.id } })
  }

  return (
    <>
      <PageHeader
        eyebrow="Sales pipeline"
        icon={<Target className="h-5 w-5" />}
        title="Lead"
        description="Track enquiries through the sales pipeline and convert them into customers."
        actions={
          <Button icon={<Plus className="h-4 w-4" />} onClick={openCreate}>
            Add lead
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total leads" value={db.leads.length} icon={<Target className="h-4.5 w-4.5" />} tone="blue" />
        <StatCard
          label="Open pipeline value"
          value={formatCurrency(openValue, true)}
          hint={`${db.leads.filter((lead) => lead.stage !== 'Won' && lead.stage !== 'Lost').length} active leads`}
          icon={<CalendarDays className="h-4.5 w-4.5" />}
          tone="amber"
        />
        <StatCard
          label="Won value"
          value={formatCurrency(wonValue, true)}
          hint={`${db.leads.filter((lead) => lead.stage === 'Won').length} leads won`}
          icon={<UserPlus className="h-4.5 w-4.5" />}
          tone="emerald"
        />
        <StatCard
          label="Converted customers"
          value={db.leads.filter((lead) => lead.convertedCustomerId).length}
          hint="Leads already converted"
          icon={<Users className="h-4.5 w-4.5" />}
          tone="violet"
        />
      </div>

      <Card>
        <Toolbar className="justify-between">
          <div className="flex flex-1 flex-wrap items-center gap-2">
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Search leads or company…"
              className="w-full sm:w-72"
            />
            <Select value={ownerFilter} onChange={(event) => setOwnerFilter(event.target.value)} className="w-full sm:w-44">
              <option value="all">All salespeople</option>
              {SALES_TEAM.map((person) => (
                <option key={person} value={person}>
                  {person}
                </option>
              ))}
            </Select>
            <Select value={sourceFilter} onChange={(event) => setSourceFilter(event.target.value)} className="w-full sm:w-44">
              <option value="all">All sources</option>
              {LEAD_SOURCES.map((source) => (
                <option key={source} value={source}>
                  {source}
                </option>
              ))}
            </Select>
          </div>
          <p className="text-xs text-silver-600">
            {filtered.length} of {db.leads.length} leads
          </p>
        </Toolbar>
      </Card>

      <div className="relative">
        {/* Six lanes never fit one screen, so the right edge fades to make
            the horizontal scroll discoverable instead of looking clipped. */}
        <div className="flex gap-4 overflow-x-auto pb-3">
          {LEAD_STAGES.map((stage) => {
          const stageLeads = filtered.filter((lead) => lead.stage === stage)
          const stageValue = stageLeads.reduce((acc, lead) => acc + lead.expectedValue, 0)
          return (
            <div
              key={stage}
              onDragOver={(event) => {
                event.preventDefault()
                if (dragOver !== stage) setDragOver(stage)
              }}
              onDragLeave={() => setDragOver((current) => (current === stage ? null : current))}
              onDrop={() => {
                if (dragging) moveStage(dragging, stage)
                setDragging(null)
                setDragOver(null)
              }}
              className={cn(
                'flex w-[286px] shrink-0 flex-col overflow-hidden rounded-2xl bg-surface/70 shadow-flat transition-[background-color,box-shadow] duration-150',
                dragOver === stage && 'bg-blue-50/80 ring-2 ring-blue-400 ring-inset',
              )}
            >
              <div className={cn('h-1 bg-linear-to-r', STAGE_GRADIENT[stage])} aria-hidden="true" />
              <div className="flex items-center justify-between gap-2 px-3.5 py-3">
                <div>
                  <p className="text-[13px] font-bold tracking-[-0.01em] text-navy-900">{stage}</p>
                  <p className="tnum text-[11px] text-silver-600">{formatCurrency(stageValue, true)}</p>
                </div>
                <span className="tnum rounded-full bg-silver-100 px-2 py-0.5 text-xs font-bold text-silver-600 ring-1 ring-silver-200 ring-inset">
                  {stageLeads.length}
                </span>
              </div>

              <div className="flex flex-1 flex-col gap-2 px-2.5 pb-3">
                {stageLeads.map((lead) => (
                  <article
                    key={lead.id}
                    draggable
                    onDragStart={() => setDragging(lead.id)}
                    onDragEnd={() => {
                      setDragging(null)
                      setDragOver(null)
                    }}
                    onClick={() => setDetailId(lead.id)}
                    className={cn(
                      'group cursor-grab rounded-xl bg-surface p-3 shadow-card transition-[transform,box-shadow,opacity] duration-150 hover:shadow-lift active:cursor-grabbing',
                      dragging === lead.id && 'scale-[0.97] rotate-1 opacity-45 shadow-lift',
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-[13px] leading-snug font-bold text-navy-900">{lead.company}</p>
                      {lead.convertedCustomerId ? <Badge tone="success">Converted</Badge> : null}
                    </div>
                    <p className="mt-1 text-xs text-silver-600">{lead.name}</p>
                    <p className="tnum mt-2 text-sm font-bold text-navy-900">
                      {formatCurrency(lead.expectedValue, true)}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <Badge tone="silver">{lead.source}</Badge>
                      <Badge tone="neutral">{lead.assignedTo}</Badge>
                    </div>
                    <p className="mt-2 flex items-center gap-1.5 text-[11px] text-silver-600">
                      <CalendarDays className="h-3 w-3" aria-hidden="true" />
                      Follow-up {formatDate(lead.followUpDate)}
                    </p>
                  </article>
                ))}

                {/* The drop target stays visible even when a lane is full, so
                    the empty space reads as somewhere to move a lead. */}
                <p
                  className={cn(
                    'rounded-xl border border-dashed px-3 text-center text-[11px] transition-colors',
                    stageLeads.length === 0 ? 'py-6' : 'py-3',
                    dragOver === stage
                      ? 'border-blue-400 bg-blue-50 font-semibold text-blue-700'
                      : 'border-silver-200 text-silver-500',
                  )}
                >
                  {dragOver === stage
                    ? 'Release to move here'
                    : stageLeads.length === 0
                      ? 'No leads yet — drag one here'
                      : 'Drag a lead here'}
                </p>
              </div>
            </div>
          )
        })}
        </div>
        <div
          className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-linear-to-l from-silver-100 to-transparent"
          aria-hidden="true"
        />
      </div>

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? `Edit lead · ${editing.company}` : 'Add new lead'}
        subtitle="Capture enquiry details so the sales team can follow up."
        size="lg"
        footer={
          <>
            <Button variant="outline" onClick={() => setFormOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submit}>{editing ? 'Save changes' : 'Add lead'}</Button>
          </>
        }
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Contact name" required error={errors.name}>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Rohan Malhotra" invalid={Boolean(errors.name)} />
          </Field>
          <Field label="Company" required error={errors.company}>
            <Input value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} placeholder="e.g. Aurelia Retail Pvt Ltd" invalid={Boolean(errors.company)} />
          </Field>
          <Field label="Email" required error={errors.email}>
            <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="name@company.com" invalid={Boolean(errors.email)} />
          </Field>
          <Field label="Phone" required error={errors.phone}>
            <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+91 98200 00000" invalid={Boolean(errors.phone)} />
          </Field>
          <Field label="City">
            <Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} placeholder="e.g. Pune" />
          </Field>
          <Field label="Lead source">
            <Select value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value as LeadSource })}>
              {LEAD_SOURCES.map((source) => (
                <option key={source}>{source}</option>
              ))}
            </Select>
          </Field>
          <Field label="Assigned salesperson">
            <Select value={form.assignedTo} onChange={(e) => setForm({ ...form, assignedTo: e.target.value })}>
              {SALES_TEAM.map((person) => (
                <option key={person}>{person}</option>
              ))}
            </Select>
          </Field>
          <Field label="Expected value (₹)" error={errors.expectedValue}>
            <Input type="number" min={0} value={form.expectedValue} onChange={(e) => setForm({ ...form, expectedValue: e.target.value })} placeholder="e.g. 250000" invalid={Boolean(errors.expectedValue)} />
          </Field>
          <Field label="Stage">
            <Select value={form.stage} onChange={(e) => setForm({ ...form, stage: e.target.value as LeadStage })}>
              {LEAD_STAGES.map((stage) => (
                <option key={stage}>{stage}</option>
              ))}
            </Select>
          </Field>
          <Field label="Follow-up date">
            <Input type="date" value={form.followUpDate} onChange={(e) => setForm({ ...form, followUpDate: e.target.value })} />
          </Field>
          <Field label="Notes" className="sm:col-span-2">
            <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Requirement summary, products discussed, next step…" />
          </Field>
        </div>
      </Modal>

      <Modal
        open={Boolean(detail)}
        onClose={() => setDetailId(null)}
        title={detail?.company ?? ''}
        subtitle={`Lead · ${detail?.source ?? ''} · ${detail?.stage ?? ''}`}
        footer={
          detail ? (
            <>
              <Button variant="danger" size="sm" icon={<Trash2 className="h-4 w-4" />} onClick={() => setDeleteId(detail.id)}>
                Delete
              </Button>
              <div className="ml-auto flex gap-2">
                <Button variant="outline" size="sm" icon={<Pencil className="h-4 w-4" />} onClick={() => { setDetailId(null); openEdit(detail) }}>
                  Edit
                </Button>
                {detail.convertedCustomerId ? (
                  <Button size="sm" icon={<Users className="h-4 w-4" />} onClick={() => navigate('/customers', { state: { focusId: detail.convertedCustomerId } })}>
                    View customer
                  </Button>
                ) : (
                  <Button size="sm" icon={<UserPlus className="h-4 w-4" />} onClick={() => setConvertId(detail.id)}>
                    Convert to customer
                  </Button>
                )}
              </div>
            </>
          ) : null
        }
      >
        {detail ? (
          <div className="flex flex-col gap-5">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-silver-200 bg-silver-50 px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-silver-600">Expected value</p>
                <p className="text-xl font-bold text-navy-900">{formatCurrency(detail.expectedValue)}</p>
              </div>
              <div className="rounded-xl border border-silver-200 bg-silver-50 px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-silver-600">Follow-up</p>
                <p className="text-xl font-bold text-navy-900">{formatDate(detail.followUpDate)}</p>
              </div>
            </div>

            <div className="divide-y divide-silver-200">
              <DataRow label="Contact person" value={detail.name} />
              <DataRow label="Stage" value={<Badge tone="info" dot>{detail.stage}</Badge>} />
              <DataRow label="Assigned to" value={detail.assignedTo} />
              <DataRow label="Source" value={<Badge tone="silver">{detail.source}</Badge>} />
              <DataRow label="City" value={detail.city || '—'} />
              <DataRow
                label="Email"
                value={
                  <a href={`mailto:${detail.email}`} className="inline-flex items-center gap-1.5 text-blue-600 hover:underline">
                    <Mail className="h-3.5 w-3.5" />
                    {detail.email}
                  </a>
                }
              />
              <DataRow
                label="Phone"
                value={
                  <a href={`tel:${detail.phone}`} className="inline-flex items-center gap-1.5 text-blue-600 hover:underline">
                    <Phone className="h-3.5 w-3.5" />
                    {detail.phone}
                  </a>
                }
              />
              <DataRow label="Created" value={formatDate(detail.createdAt)} />
            </div>

            <Field label="Move stage">
              <Select value={detail.stage} onChange={(event) => moveStage(detail.id, event.target.value as LeadStage)}>
                {LEAD_STAGES.map((stage) => (
                  <option key={stage}>{stage}</option>
                ))}
              </Select>
            </Field>

            {detail.notes ? (
              <div className="rounded-xl border border-silver-200 bg-silver-50 px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-silver-600">Notes</p>
                <p className="mt-1 text-sm leading-relaxed text-navy-800">{detail.notes}</p>
              </div>
            ) : null}

            {detail.convertedCustomerId ? (
              <div className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                <Building2 className="mt-0.5 h-4 w-4" />
                This lead has already been converted into a customer record.
              </div>
            ) : null}
          </div>
        ) : null}
      </Modal>

      <ConvertLeadModal
        lead={convertLead}
        onClose={() => setConvertId(null)}
        onSubmit={submitConversion}
      />

      <ConfirmDialog
        open={Boolean(deleteId)}
        title="Delete lead"
        message="This lead will be permanently removed from the pipeline. This action cannot be undone."
        confirmLabel="Delete lead"
        onCancel={() => setDeleteId(null)}
        onConfirm={confirmDelete}
      />
    </>
  )
}

function ConvertLeadModal({
  lead,
  onClose,
  onSubmit,
}: {
  lead: Lead | null
  onClose: () => void
  onSubmit: (input: {
    companyName: string
    contactPerson: string
    email: string
    phone: string
    city: string
    state: string
    address: string
    gstin: string
    paymentTerms: number
    creditLimit: number
  }) => void
}) {
  const [form, setForm] = useState({
    companyName: '',
    contactPerson: '',
    email: '',
    phone: '',
    city: '',
    state: '',
    address: '',
    gstin: '',
    paymentTerms: '30',
    creditLimit: '500000',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!lead) return
    setForm({
      companyName: lead.company,
      contactPerson: lead.name,
      email: lead.email,
      phone: lead.phone,
      city: lead.city,
      state: '',
      address: '',
      gstin: '',
      paymentTerms: '30',
      creditLimit: '500000',
    })
    setErrors({})
  }, [lead])

  const submit = () => {
    const next: Record<string, string> = {}
    if (!form.companyName.trim()) next.companyName = 'Company name is required.'
    if (!form.contactPerson.trim()) next.contactPerson = 'Contact person is required.'
    if (!form.email.trim()) next.email = 'Email is required.'
    if (!/^\d{2}[A-Z0-9]{13}$/i.test(form.gstin) && form.gstin.trim()) next.gstin = 'GSTIN must be 15 characters.'
    setErrors(next)
    if (Object.keys(next).length > 0) return
    onSubmit({
      companyName: form.companyName.trim(),
      contactPerson: form.contactPerson.trim(),
      email: form.email.trim(),
      phone: form.phone.trim(),
      city: form.city.trim(),
      state: form.state.trim(),
      address: form.address.trim(),
      gstin: form.gstin.trim().toUpperCase(),
      paymentTerms: Number(form.paymentTerms) || 30,
      creditLimit: Number(form.creditLimit) || 0,
    })
  }

  return (
    <Modal
      open={Boolean(lead)}
      onClose={onClose}
      title="Convert lead to customer"
      subtitle={lead ? `Creating a customer master record for ${lead.company}` : ''}
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button icon={<UserPlus className="h-4 w-4" />} onClick={submit}>
            Convert to customer
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Company name" required error={errors.companyName}>
          <Input value={form.companyName} onChange={(e) => setForm({ ...form, companyName: e.target.value })} invalid={Boolean(errors.companyName)} />
        </Field>
        <Field label="Contact person" required error={errors.contactPerson}>
          <Input value={form.contactPerson} onChange={(e) => setForm({ ...form, contactPerson: e.target.value })} invalid={Boolean(errors.contactPerson)} />
        </Field>
        <Field label="Email" required error={errors.email}>
          <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} invalid={Boolean(errors.email)} />
        </Field>
        <Field label="Phone">
          <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        </Field>
        <Field label="City">
          <Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
        </Field>
        <Field label="State">
          <Input value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} />
        </Field>
        <Field label="GSTIN" error={errors.gstin} hint="15-character GST number">
          <Input value={form.gstin} onChange={(e) => setForm({ ...form, gstin: e.target.value.toUpperCase() })} placeholder="27ABCDE1234F1Z5" invalid={Boolean(errors.gstin)} />
        </Field>
        <Field label="Payment terms (days)">
          <Input type="number" min={0} value={form.paymentTerms} onChange={(e) => setForm({ ...form, paymentTerms: e.target.value })} />
        </Field>
        <Field label="Credit limit (₹)">
          <Input type="number" min={0} value={form.creditLimit} onChange={(e) => setForm({ ...form, creditLimit: e.target.value })} />
        </Field>
        <Field label="Address" className="sm:col-span-2">
          <Textarea value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Street, area, landmark" />
        </Field>
      </div>
      <div className="mt-4 flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-xs text-blue-800">
        <MapPin className="mt-0.5 h-3.5 w-3.5" />
        Converting marks this lead as Won and creates a linked customer record you can invoice immediately.
      </div>
    </Modal>
  )
}
