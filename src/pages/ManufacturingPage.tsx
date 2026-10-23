import { useMemo, useState } from 'react'
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  Clock,
  Factory,
  History,
  Plus,
  RefreshCw,
  Trash2,
  Truck,
  X,
} from 'lucide-react'
import type { JobStage, ManufacturingJob, MfgStage, MfgStatus } from '@/types'
import { MFG_STAGES } from '@/types'
import { PageHeader, EmptyState, SearchInput, Toolbar, ProgressBar, DataRow } from '@/components/ui/Layout'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge, StatusBadge } from '@/components/ui/Badge'
import { Field, Input, Select, Textarea, Checkbox } from '@/components/ui/Form'
import { Modal, ConfirmDialog } from '@/components/ui/Modal'
import { StatCard } from '@/components/ui/StatCard'
import { TBody, THead, Td, Th, TR, Table, TableEmptyRow, TableShell } from '@/components/ui/Table'
import { useData } from '@/store/DataContext'
import { useToast } from '@/store/ToastContext'
import { addJobStage, createManufacturingJob, pushActivity, updateJobStage } from '@/lib/workflow'
import {
  DEFAULT_JOB_STAGES,
  deriveJobStatus,
  jobCompletedQuantity,
  jobDelayReason,
  jobDelayedAt,
  jobProgress,
  jobStages,
} from '@/lib/manufacturing'
import { customerName, orderRefs } from '@/lib/calc'
import { addDaysISO, cn, downloadCSV, formatDate, formatDateTime, formatNumber, todayISO } from '@/lib/utils'

const STATUSES: MfgStatus[] = ['Pending', 'In Progress', 'Completed', 'Delayed']

/** Structured reasons offered when a stage is marked Delayed. */
const DELAY_REASONS = [
  'Material shortage',
  'Machine breakdown',
  'Outsourced job delay',
  'Labour shortage',
  'Quality hold',
  'Customer approval pending',
  'Other',
]

function reasonFromValue(value?: string): { reason: string; other: string } {
  if (!value) return { reason: '', other: '' }
  if (DELAY_REASONS.includes(value)) return { reason: value, other: '' }
  return { reason: 'Other', other: value }
}

const emptyCreateForm = () => ({
  orderRef: '',
  invoiceId: '',
  customerId: '',
  productName: '',
  orderQuantity: '1',
  stockFulfilled: '0',
  assignedTo: '',
  plannedStart: todayISO(),
  plannedEnd: addDaysISO(todayISO(), 14),
  outsourced: false,
  vendor: '',
  notes: '',
  stages: [...DEFAULT_JOB_STAGES] as MfgStage[],
})

export function ManufacturingPage() {
  const { db, mutate } = useData()
  const toast = useToast()

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [stageFilter, setStageFilter] = useState('all')
  const [detailId, setDetailId] = useState<string | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)

  const [createForm, setCreateForm] = useState(emptyCreateForm)
  const [createErrors, setCreateErrors] = useState<Record<string, string>>({})

  const [stageEdit, setStageEdit] = useState<{ jobId: string; stageId: string } | null>(null)
  const [stageForm, setStageForm] = useState({
    status: 'In Progress' as MfgStatus,
    completedQuantity: '0',
    assignedTo: '',
    vendor: '',
    plannedDate: '',
    remarks: '',
    delayReason: '',
    delayReasonOther: '',
  })
  const [stageError, setStageError] = useState('')
  const [newStage, setNewStage] = useState<MfgStage | ''>('')

  const detail = db.manufacturingJobs.find((job) => job.id === detailId) ?? null
  const stageTarget = stageEdit ? db.manufacturingJobs.find((job) => job.id === stageEdit.jobId) ?? null : null
  const stageTargetStage =
    stageTarget && stageEdit ? jobStages(stageTarget).find((stage) => stage.id === stageEdit.stageId) ?? null : null

  /** Derived planning view — safe for older records that have no stage plan. */
  const rows = useMemo(
    () =>
      db.manufacturingJobs.map((job) => {
        const stages = jobStages(job)
        return {
          job,
          stages,
          status: deriveJobStatus(job),
          progress: jobProgress(job),
          current: stages.find((stage) => stage.status !== 'Completed') ?? stages[stages.length - 1],
          delayReason: jobDelayReason(job),
          delayedAt: jobDelayedAt(job),
          refs: orderRefs(db, job.invoiceId, job.orderRef),
        }
      }),
    [db],
  )

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    return rows
      .filter(({ job, status, current, refs }) => {
        const matchesTerm =
          !term ||
          `${job.jobNumber} ${job.orderRef} ${job.productName} ${job.assignedTo} ${job.vendor} ${refs.orderNumber} ${refs.quotationNumber}`
            .toLowerCase()
            .includes(term)
        const matchesStatus = statusFilter === 'all' || status === statusFilter
        const matchesStage = stageFilter === 'all' || current?.stage === stageFilter
        return matchesTerm && matchesStatus && matchesStage
      })
      .sort((a, b) => (a.job.plannedEnd < b.job.plannedEnd ? -1 : 1))
  }, [rows, search, statusFilter, stageFilter])

  const stats = useMemo(() => {
    const overdue = db.manufacturingJobs.filter(
      (job) => deriveJobStatus(job) !== 'Completed' && job.plannedEnd < todayISO(),
    )
    return {
      total: db.manufacturingJobs.length,
      active: db.manufacturingJobs.filter((job) => deriveJobStatus(job) === 'In Progress').length,
      pending: db.manufacturingJobs.filter((job) => deriveJobStatus(job) === 'Pending').length,
      delayed: db.manufacturingJobs.filter((job) => deriveJobStatus(job) === 'Delayed').length,
      completed: db.manufacturingJobs.filter((job) => deriveJobStatus(job) === 'Completed').length,
      outsourced: db.manufacturingJobs.filter((job) => job.outsourced).length,
      overdue: overdue.length,
    }
  }, [db.manufacturingJobs])

  const manufactureQty = Math.max(Number(createForm.orderQuantity || 0) - Number(createForm.stockFulfilled || 0), 0)

  const orderRefList = useMemo(
    () => [...new Set([...db.invoices.map((invoice) => invoice.orderRef), ...db.quotations.map((quotation) => quotation.number)])],
    [db.invoices, db.quotations],
  )

  const openCreate = () => {
    setCreateForm(emptyCreateForm())
    setCreateErrors({})
    setCreateOpen(true)
  }

  const onOrderRefChange = (value: string) => {
    const invoice = db.invoices.find((item) => item.orderRef === value)
    setCreateForm((form) => ({
      ...form,
      orderRef: value,
      invoiceId: invoice?.id ?? '',
      customerId: invoice?.customerId ?? form.customerId,
    }))
  }

  const submitCreate = () => {
    const next: Record<string, string> = {}
    if (!createForm.orderRef.trim()) next.orderRef = 'Enter or select an order reference.'
    if (!createForm.customerId) next.customerId = 'Select the customer this order belongs to.'
    if (!createForm.productName.trim()) next.productName = 'Product name is required.'
    if (Number(createForm.orderQuantity) <= 0) next.orderQuantity = 'Order quantity must be greater than zero.'
    if (manufactureQty <= 0) next.stockFulfilled = 'Nothing to manufacture — the order is covered by finished stock.'
    if (createForm.plannedEnd < createForm.plannedStart) next.plannedEnd = 'Planned end cannot be before the start date.'
    if (createForm.outsourced && !createForm.vendor.trim()) next.vendor = 'Enter the job-work vendor name.'
    if (createForm.stages.length === 0) next.stages = 'Select at least one manufacturing stage.'
    setCreateErrors(next)
    if (Object.keys(next).length > 0) return

    const invoice = db.invoices.find((item) => item.id === createForm.invoiceId)
    const quotationRef = invoice?.quotationId
      ? db.quotations.find((quotation) => quotation.id === invoice.quotationId)?.number
      : undefined

    mutate((draft) => {
      createManufacturingJob(draft, {
        orderRef: createForm.orderRef.trim(),
        invoiceId: createForm.invoiceId || undefined,
        customerId: createForm.customerId,
        productName: createForm.productName.trim(),
        orderQuantity: Number(createForm.orderQuantity),
        quantity: manufactureQty,
        stages: createForm.stages,
        assignedTo: createForm.assignedTo.trim(),
        plannedStart: createForm.plannedStart,
        plannedEnd: createForm.plannedEnd,
        outsourced: createForm.outsourced,
        vendor: createForm.vendor.trim(),
        notes: createForm.notes.trim(),
        quotationRef,
        orderNumber: invoice?.number,
        stockFulfilledQuantity: Number(createForm.stockFulfilled) || 0,
      })
    })
    toast.success('Production job created with its own stage plan.')
    setCreateOpen(false)
  }

  const moveCreateStage = (index: number, direction: -1 | 1) => {
    setCreateForm((form) => {
      const target = index + direction
      if (target < 0 || target >= form.stages.length) return form
      const stages = [...form.stages]
      ;[stages[index], stages[target]] = [stages[target], stages[index]]
      return { ...form, stages }
    })
  }

  const openStageUpdate = (job: ManufacturingJob, stage: JobStage) => {
    const { reason, other } = reasonFromValue(stage.delayReason)
    setStageEdit({ jobId: job.id, stageId: stage.id })
    setStageForm({
      status: stage.status === 'Pending' ? 'In Progress' : stage.status,
      completedQuantity: String(stage.completedQuantity ?? 0),
      assignedTo: stage.assignedTo || job.assignedTo,
      vendor: stage.vendor ?? '',
      plannedDate: stage.plannedDate ?? job.plannedEnd,
      remarks: stage.remarks ?? '',
      delayReason: reason,
      delayReasonOther: other,
    })
    setStageError('')
  }

  const submitStageUpdate = () => {
    if (!stageEdit) return
    const delayReason =
      stageForm.delayReason === 'Other' ? stageForm.delayReasonOther.trim() : stageForm.delayReason.trim()
    if (stageForm.status === 'Delayed' && !delayReason) {
      setStageError('Select a delay reason (or enter one) before saving.')
      return
    }
    const result = mutate((draft) =>
      updateJobStage(draft, stageEdit.jobId, stageEdit.stageId, {
        status: stageForm.status,
        completedQuantity: Number(stageForm.completedQuantity) || 0,
        assignedTo: stageForm.assignedTo,
        vendor: stageForm.vendor,
        plannedDate: stageForm.plannedDate,
        remarks: stageForm.remarks,
        delayReason,
      }),
    )
    if (!result.ok) {
      setStageError(result.error ?? 'Could not update the stage.')
      return
    }
    toast.success(
      stageForm.status === 'Completed'
        ? 'Stage completed. When every stage is done the job completes and a packaging job is created.'
        : 'Stage updated.',
    )
    setStageEdit(null)
  }

  const handleAddStage = (job: ManufacturingJob, stage: MfgStage) => {
    const result = mutate((draft) => addJobStage(draft, job.id, stage))
    if (!result.ok) {
      toast.error(result.error ?? 'Could not add the stage.')
      return
    }
    setNewStage('')
    toast.success(`${stage} added to ${job.jobNumber}.`)
  }

  const confirmDelete = () => {
    if (!deleteId) return
    mutate((draft) => {
      const job = draft.manufacturingJobs.find((item) => item.id === deleteId)
      draft.manufacturingJobs = draft.manufacturingJobs.filter((item) => item.id !== deleteId)
      draft.packagingJobs = draft.packagingJobs.filter((item) => item.productionJobId !== deleteId)
      if (job) pushActivity(draft, 'Manufacturing', `Production job ${job.jobNumber} deleted`)
    })
    toast.success('Production job deleted.')
    setDeleteId(null)
    setDetailId(null)
  }

  return (
    <>
      <PageHeader
        eyebrow="Production floor"
        icon={<Factory className="h-5 w-5" />}
        title="Manufacturing"
        actions={
          <>
            <Button
              variant="outline"
              onClick={() => {
                downloadCSV(
                  'production-jobs.csv',
                  ['Job', 'Order no', 'Quotation', 'Customer', 'Product', 'Order qty', 'Mfg qty', 'Completed qty', 'Current stage', 'Stages', 'Status', 'Delay reason', 'Assigned', 'Planned start', 'Planned end', 'Actual completion', 'Outsourced'],
                  filtered.map(({ job, refs, status, current, delayReason }) => [
                    job.jobNumber,
                    refs.orderNumber,
                    refs.quotationNumber,
                    job.customerId ? customerName(db, job.customerId) : '—',
                    job.productName,
                    job.orderQuantity ?? job.quantity,
                    job.quantity,
                    jobCompletedQuantity(job),
                    current?.stage ?? job.stage,
                    jobStages(job).map((stage) => stage.stage).join(' → '),
                    status,
                    delayReason ?? '',
                    job.assignedTo,
                    job.plannedStart,
                    job.plannedEnd,
                    job.completedAt ?? '',
                    job.outsourced ? job.vendor || 'Yes' : 'No',
                  ]),
                )
                toast.success('Production jobs exported as CSV.')
              }}
            >
              Export CSV
            </Button>
            <Button icon={<Plus className="h-4 w-4" />} onClick={openCreate}>
              New production job
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total jobs" value={stats.total} hint={`${stats.outsourced} with outsourced stages`} icon={<Factory className="h-4.5 w-4.5" />} tone="blue" />
        <StatCard label="In progress" value={stats.active} hint={`${stats.pending} pending`} icon={<RefreshCw className="h-4.5 w-4.5" />} tone="violet" />
        <StatCard label="Delayed / overdue" value={stats.delayed + stats.overdue} hint={`${stats.overdue} past planned end date`} icon={<AlertTriangle className="h-4.5 w-4.5" />} tone={stats.delayed + stats.overdue > 0 ? 'rose' : 'emerald'} />
        <StatCard label="Completed" value={stats.completed} icon={<CheckCircle2 className="h-4.5 w-4.5" />} tone="emerald" />
      </div>

      <Card>
        <Toolbar className="justify-between">
          <div className="flex flex-1 flex-wrap items-center gap-2">
            <SearchInput value={search} onChange={setSearch} placeholder="Search job, order, quotation or product…" className="w-full sm:w-72" />
            <Select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="w-full sm:w-40">
              <option value="all">All statuses</option>
              {STATUSES.map((status) => (
                <option key={status}>{status}</option>
              ))}
            </Select>
            <Select value={stageFilter} onChange={(event) => setStageFilter(event.target.value)} className="w-full sm:w-48">
              <option value="all">All stages</option>
              {MFG_STAGES.map((stage) => (
                <option key={stage}>{stage}</option>
              ))}
            </Select>
          </div>
          <p className="text-xs text-silver-600">
            {filtered.length} of {db.manufacturingJobs.length} jobs
          </p>
        </Toolbar>
      </Card>

      <TableShell>
        <Table className="min-w-[1180px]">
          <THead>
            <TR>
              <Th>Job / order</Th>
              <Th>Customer</Th>
              <Th>Product</Th>
              <Th align="right">Order qty</Th>
              <Th>Current stage</Th>
              <Th>Stage plan</Th>
              <Th>Planned / actual</Th>
              <Th>Status</Th>
              <Th align="right">Actions</Th>
            </TR>
          </THead>
          <TBody>
            {filtered.length === 0 ? (
              <TableEmptyRow colSpan={9}>No production jobs match your filters.</TableEmptyRow>
            ) : (
              filtered.map(({ job, stages, status, current, delayReason, delayedAt, refs }) => {
                const overdue = status !== 'Completed' && job.plannedEnd < todayISO()
                const done = stages.filter((stage) => stage.status === 'Completed').length
                return (
                  <TR key={job.id} onClick={() => setDetailId(job.id)}>
                    <Td>
                      <p className="font-semibold text-navy-900">{job.jobNumber}</p>
                      <p className="text-xs text-silver-600">
                        {refs.orderNumber === job.orderRef ? job.orderRef : `${refs.orderNumber} · ${job.orderRef}`}
                      </p>
                    </Td>
                    <Td className="text-navy-800">{job.customerId ? customerName(db, job.customerId) : '—'}</Td>
                    <Td>
                      <p className="font-medium text-navy-900">{job.productName}</p>
                      {job.outsourced ? <Badge tone="purple">Outsourced · {job.vendor || 'vendor'}</Badge> : null}
                    </Td>
                    <Td align="right">
                      <span className="tnum">{formatNumber(job.orderQuantity ?? job.quantity)}</span>
                      {job.stockFulfilledQuantity ? (
                        <p className="text-[11px] text-silver-600">{formatNumber(job.stockFulfilledQuantity)} from stock</p>
                      ) : null}
                    </Td>
                    <Td>
                      <Badge tone="silver">{current?.stage ?? job.stage}</Badge>
                    </Td>
                    <Td>
                      <p className="text-xs font-medium text-navy-800">
                        {done}/{stages.length} stages
                      </p>
                      <ProgressBar
                        value={stages.length ? (done / stages.length) * 100 : 0}
                        tone={status === 'Completed' ? 'emerald' : status === 'Delayed' ? 'rose' : 'blue'}
                        className="mt-1"
                      />
                    </Td>
                    <Td className="whitespace-nowrap">
                      <span className={cn(overdue && 'font-semibold text-rose-600')}>{formatDate(job.plannedEnd)}</span>
                      <p className="text-[11px] text-silver-600">
                        {job.completedAt ? `Done ${formatDate(job.completedAt)}` : 'In progress'}
                      </p>
                    </Td>
                    <Td>
                      <StatusBadge status={status} />
                      {delayReason ? (
                        <p className="mt-1 max-w-[180px] text-[11px] leading-snug text-rose-600">
                          {delayReason}
                          {delayedAt ? ` · ${delayedAt}` : ''}
                        </p>
                      ) : null}
                    </Td>
                    <Td align="right">
                      <div className="flex items-center justify-end gap-1.5" onClick={(event) => event.stopPropagation()}>
                        <Button size="sm" variant="outline" onClick={() => setDetailId(job.id)}>
                          Open
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

      {/* ---------------------- Create job ---------------------- */}
      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        size="full"
        title="New production job"
        subtitle="Link the job to its order, then choose the stages this order actually needs."
        footer={
          <>
            <div className="mr-auto text-xs text-silver-600">
              {manufactureQty > 0 ? `${formatNumber(manufactureQty)} units to manufacture` : 'No manufacturing required'}
            </div>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submitCreate}>Create job</Button>
          </>
        }
      >
        <div className="flex flex-col gap-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field label="Order reference" required error={createErrors.orderRef} hint="Pick an order to auto-link its customer">
              <Input
                list="job-order-refs"
                value={createForm.orderRef}
                onChange={(event) => onOrderRefChange(event.target.value)}
                invalid={Boolean(createErrors.orderRef)}
                placeholder="QT-2026-0003 or ORD-2026-0001"
              />
              <datalist id="job-order-refs">
                {orderRefList.map((ref) => (
                  <option key={ref} value={ref} />
                ))}
              </datalist>
            </Field>
            <Field label="Customer" required error={createErrors.customerId}>
              <Select
                value={createForm.customerId}
                onChange={(event) => setCreateForm({ ...createForm, customerId: event.target.value })}
                invalid={Boolean(createErrors.customerId)}
              >
                <option value="">Select customer…</option>
                {db.customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.code} · {customer.companyName}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Product" required error={createErrors.productName}>
              <Input
                list="job-products"
                value={createForm.productName}
                onChange={(event) => setCreateForm({ ...createForm, productName: event.target.value })}
                invalid={Boolean(createErrors.productName)}
                placeholder="Product being made"
              />
              <datalist id="job-products">
                {db.products.map((product) => (
                  <option key={product.id} value={product.name} />
                ))}
              </datalist>
            </Field>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field label="Order quantity" required error={createErrors.orderQuantity}>
              <Input
                type="number"
                min={1}
                value={createForm.orderQuantity}
                onChange={(event) => setCreateForm({ ...createForm, orderQuantity: event.target.value })}
                invalid={Boolean(createErrors.orderQuantity)}
              />
            </Field>
            <Field label="From finished stock" error={createErrors.stockFulfilled} hint="Met from stock — no manufacturing">
              <Input
                type="number"
                min={0}
                value={createForm.stockFulfilled}
                onChange={(event) => setCreateForm({ ...createForm, stockFulfilled: event.target.value })}
                invalid={Boolean(createErrors.stockFulfilled)}
              />
            </Field>
            <div className="flex flex-col justify-end rounded-[11px] border border-silver-200 bg-silver-50 px-3 py-2">
              <p className="text-[11px] font-semibold tracking-wide text-silver-600 uppercase">Quantity to manufacture</p>
              <p className="tnum text-xl font-bold text-navy-900">{formatNumber(manufactureQty)}</p>
            </div>
          </div>

          <div>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-semibold text-navy-800">Required stages (in order)</p>
              <p className="text-[11px] text-silver-600">Cutting and Laser Cutting are separate stages — include either, both or neither.</p>
            </div>
            <ul className="flex flex-col gap-1.5">
              {createForm.stages.map((stage, index) => (
                <li key={`${stage}-${index}`} className="flex items-center gap-2 rounded-lg border border-silver-200 bg-silver-50 px-3 py-2">
                  <span className="tnum text-[11px] font-bold text-silver-500">{index + 1}</span>
                  <span className="flex-1 text-sm font-medium text-navy-900">{stage}</span>
                  <button type="button" onClick={() => moveCreateStage(index, -1)} disabled={index === 0} className="rounded-md p-1 text-silver-500 hover:bg-silver-200 disabled:opacity-30" aria-label="Move up">
                    <ArrowUp className="h-3.5 w-3.5" />
                  </button>
                  <button type="button" onClick={() => moveCreateStage(index, 1)} disabled={index === createForm.stages.length - 1} className="rounded-md p-1 text-silver-500 hover:bg-silver-200 disabled:opacity-30" aria-label="Move down">
                    <ArrowDown className="h-3.5 w-3.5" />
                  </button>
                  <button type="button" onClick={() => setCreateForm({ ...createForm, stages: createForm.stages.filter((_, i) => i !== index) })} className="rounded-md p-1 text-silver-500 hover:bg-rose-50 hover:text-rose-600" aria-label="Remove stage">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
            {createErrors.stages ? <p className="mt-1 text-xs font-medium text-rose-600">{createErrors.stages}</p> : null}
            <div className="mt-2 max-w-xs">
              <Select
                value=""
                onChange={(event) => {
                  const value = event.target.value as MfgStage
                  if (value && !createForm.stages.includes(value)) {
                    setCreateForm({ ...createForm, stages: [...createForm.stages, value] })
                  }
                }}
              >
                <option value="">Add a stage…</option>
                {MFG_STAGES.filter((stage) => !createForm.stages.includes(stage)).map((stage) => (
                  <option key={stage} value={stage}>
                    {stage}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Assigned to">
              <Input value={createForm.assignedTo} onChange={(event) => setCreateForm({ ...createForm, assignedTo: event.target.value })} placeholder="Artisan / supervisor" />
            </Field>
            <Field label="Planned start">
              <Input type="date" value={createForm.plannedStart} onChange={(event) => setCreateForm({ ...createForm, plannedStart: event.target.value })} />
            </Field>
            <Field label="Planned end" error={createErrors.plannedEnd}>
              <Input type="date" value={createForm.plannedEnd} onChange={(event) => setCreateForm({ ...createForm, plannedEnd: event.target.value })} invalid={Boolean(createErrors.plannedEnd)} />
            </Field>
            <div className="flex flex-col gap-3">
              <Checkbox
                label="At least one stage is outsourced (job work)"
                checked={createForm.outsourced}
                onChange={(event) => setCreateForm({ ...createForm, outsourced: event.target.checked })}
              />
              {createForm.outsourced ? (
                <Field label="Job work vendor" error={createErrors.vendor}>
                  <Input value={createForm.vendor} onChange={(event) => setCreateForm({ ...createForm, vendor: event.target.value })} invalid={Boolean(createErrors.vendor)} placeholder="e.g. Deccan Craft Works" />
                </Field>
              ) : null}
            </div>
          </div>

          <Field label="Notes">
            <Textarea value={createForm.notes} onChange={(event) => setCreateForm({ ...createForm, notes: event.target.value })} placeholder="Design reference, finishing instructions…" />
          </Field>
        </div>
      </Modal>

      {/* ---------------------- Job detail ---------------------- */}
      <Modal
        open={Boolean(detail)}
        onClose={() => setDetailId(null)}
        size="lg"
        title={detail ? `${detail.jobNumber} · ${detail.productName}` : ''}
        subtitle={detail ? `${detail.orderRef} · ${formatNumber(detail.quantity)} to manufacture` : ''}
        footer={
          detail ? (
            <Button variant="danger" size="sm" icon={<Trash2 className="h-4 w-4" />} onClick={() => setDeleteId(detail.id)}>
              Delete
            </Button>
          ) : null
        }
      >
        {detail ? (
          <JobDetail
            job={detail}
            onUpdateStage={openStageUpdate}
            onAddStage={handleAddStage}
            newStage={newStage}
            setNewStage={setNewStage}
          />
        ) : null}
      </Modal>

      {/* ---------------------- Stage update ---------------------- */}
      <Modal
        open={Boolean(stageTargetStage)}
        onClose={() => setStageEdit(null)}
        title={stageTargetStage ? `Update ${stageTargetStage.stage}` : ''}
        subtitle={stageTarget ? `${stageTarget.jobNumber} · ${formatNumber(stageTarget.quantity)} units` : ''}
        footer={
          <>
            <Button variant="outline" onClick={() => setStageEdit(null)}>
              Cancel
            </Button>
            <Button onClick={submitStageUpdate} icon={<RefreshCw className="h-4 w-4" />}>
              Save stage update
            </Button>
          </>
        }
      >
        {stageTarget && stageTargetStage ? (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Stage status" error={stageError}>
                <Select
                  value={stageForm.status}
                  onChange={(event) => {
                    setStageForm({ ...stageForm, status: event.target.value as MfgStatus })
                    setStageError('')
                  }}
                >
                  {STATUSES.map((status) => (
                    <option key={status}>{status}</option>
                  ))}
                </Select>
              </Field>
              <Field label={`Completed quantity (of ${stageTarget.quantity})`}>
                <Input
                  type="number"
                  min={0}
                  max={stageTarget.quantity}
                  value={stageForm.completedQuantity}
                  onChange={(event) => setStageForm({ ...stageForm, completedQuantity: event.target.value })}
                />
              </Field>
              <Field label="Assigned to">
                <Input value={stageForm.assignedTo} onChange={(event) => setStageForm({ ...stageForm, assignedTo: event.target.value })} placeholder="Person responsible" />
              </Field>
              <Field label="Vendor (if outsourced)">
                <Input value={stageForm.vendor} onChange={(event) => setStageForm({ ...stageForm, vendor: event.target.value })} placeholder="Leave blank if in-house" />
              </Field>
              <Field label="Planned date">
                <Input type="date" value={stageForm.plannedDate} onChange={(event) => setStageForm({ ...stageForm, plannedDate: event.target.value })} />
              </Field>
              <Field label="Remarks">
                <Input value={stageForm.remarks} onChange={(event) => setStageForm({ ...stageForm, remarks: event.target.value })} placeholder="Optional note for this stage" />
              </Field>
            </div>

            {stageForm.status === 'Delayed' ? (
              <div className="flex flex-col gap-3 rounded-xl border border-rose-200 bg-rose-50 p-3.5">
                <Field label="Delay reason" required hint="Recorded in the stage history and shown on the job">
                  <Select
                    value={stageForm.delayReason}
                    onChange={(event) => {
                      setStageForm({ ...stageForm, delayReason: event.target.value })
                      setStageError('')
                    }}
                  >
                    <option value="">Select a reason…</option>
                    {DELAY_REASONS.map((reason) => (
                      <option key={reason}>{reason}</option>
                    ))}
                  </Select>
                </Field>
                {stageForm.delayReason === 'Other' ? (
                  <Field label="Specify reason">
                    <Input value={stageForm.delayReasonOther} onChange={(event) => setStageForm({ ...stageForm, delayReasonOther: event.target.value })} placeholder="e.g. Power outage at the vendor" />
                  </Field>
                ) : null}
              </div>
            ) : null}

            <div className="flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-xs text-blue-800">
              <Truck className="mt-0.5 h-3.5 w-3.5" />
              When every stage is completed, the job is marked Completed and a packaging job is created for the same order.
            </div>
          </div>
        ) : null}
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteId)}
        title="Delete production job"
        message="The production job and any packaging job created from it will be removed."
        confirmLabel="Delete job"
        onCancel={() => setDeleteId(null)}
        onConfirm={confirmDelete}
      />

      {db.manufacturingJobs.length === 0 ? (
        <EmptyState
          icon={<Clock className="h-5 w-5" />}
          title="No production jobs"
          description="Confirm an order from the Invoice module to auto-generate production jobs, or create one manually."
        />
      ) : null}
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Job detail                                                          */
/* ------------------------------------------------------------------ */

function JobDetail({
  job,
  onUpdateStage,
  onAddStage,
  newStage,
  setNewStage,
}: {
  job: ManufacturingJob
  onUpdateStage: (job: ManufacturingJob, stage: JobStage) => void
  onAddStage: (job: ManufacturingJob, stage: MfgStage) => void
  newStage: MfgStage | ''
  setNewStage: (stage: MfgStage | '') => void
}) {
  const { db } = useData()
  const stages = jobStages(job)
  const status = deriveJobStatus(job)
  const progress = jobProgress(job)
  const delayReason = jobDelayReason(job)
  const delayedAt = jobDelayedAt(job)
  const refs = orderRefs(db, job.invoiceId, job.orderRef)
  const completedQty = jobCompletedQuantity(job)
  const remaining = Math.max(job.quantity - completedQty, 0)

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge status={status} />
        <Badge tone="silver">{stages.length} stages</Badge>
        {job.quotationRef ? <Badge tone="info">Quotation {job.quotationRef}</Badge> : null}
        {job.orderNumber ? <Badge tone="neutral">Order {job.orderNumber}</Badge> : null}
        {job.stockFulfilledQuantity ? (
          <Badge tone="success">{formatNumber(job.stockFulfilledQuantity)} from finished stock</Badge>
        ) : null}
        {job.outsourced ? <Badge tone="purple">Outsourced · {job.vendor || 'vendor'}</Badge> : <Badge tone="info">In-house</Badge>}
      </div>

      {delayReason ? (
        <div className="flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-rose-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="text-[13px] font-semibold">Delayed{delayedAt ? ` at ${delayedAt}` : ''}</p>
            <p className="mt-0.5 text-[13px]">Reason: {delayReason}</p>
          </div>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="divide-y divide-silver-200">
          <DataRow label="Customer" value={job.customerId ? customerName(db, job.customerId) : '—'} />
          <DataRow label="Quotation" value={job.quotationRef ?? refs.quotationNumber} />
          <DataRow label="Order number" value={job.orderNumber ?? refs.orderNumber} />
          <DataRow label="Order quantity" value={formatNumber(job.orderQuantity ?? job.quantity)} />
        </div>
        <div className="divide-y divide-silver-200">
          <DataRow label="To manufacture" value={formatNumber(job.quantity)} />
          <DataRow label="Completed quantity" value={`${formatNumber(completedQty)} · ${formatNumber(remaining)} remaining`} />
          <DataRow label="Planned start / end" value={`${formatDate(job.plannedStart)} → ${formatDate(job.plannedEnd)}`} />
          <DataRow label="Actual completion" value={job.completedAt ? formatDate(job.completedAt) : '—'} />
        </div>
      </div>

      <div>
        <div className="mb-1.5 flex items-center justify-between text-xs">
          <span className="font-semibold text-navy-800">Stage progress</span>
          <span className="text-silver-600">
            {stages.filter((stage) => stage.status === 'Completed').length} of {stages.length} · {progress}%
          </span>
        </div>
        <ProgressBar value={progress} tone={status === 'Completed' ? 'emerald' : status === 'Delayed' ? 'rose' : 'blue'} />
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold text-navy-800">Stages for this order</p>
        <ul className="flex flex-col gap-2">
          {stages.map((stage, index) => (
            <li key={stage.id} className="rounded-xl border border-silver-200 bg-surface p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="tnum text-[11px] font-bold text-silver-500">{index + 1}</span>
                <span className="text-[13px] font-semibold text-navy-900">{stage.stage}</span>
                <StatusBadge status={stage.status} />
                {stage.vendor ? <Badge tone="purple">Outsourced · {stage.vendor}</Badge> : null}
                <div className="ml-auto">
                  <Button size="sm" variant="outline" onClick={() => onUpdateStage(job, stage)}>
                    Update stage
                  </Button>
                </div>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] text-silver-600 sm:grid-cols-4">
                <span>Planned: <b className="font-semibold text-navy-800">{stage.plannedDate ? formatDate(stage.plannedDate) : '—'}</b></span>
                <span>Completed: <b className="font-semibold text-navy-800">{stage.completedAt ? formatDate(stage.completedAt) : '—'}</b></span>
                <span>Qty: <b className="font-semibold text-navy-800">{formatNumber(stage.completedQuantity ?? 0)}</b></span>
                <span>Assigned: <b className="font-semibold text-navy-800">{stage.assignedTo || '—'}</b></span>
              </div>
              {stage.remarks ? <p className="mt-1 text-[11px] text-silver-600">Remarks: {stage.remarks}</p> : null}
              {stage.delayReason ? <p className="mt-1 text-[11px] font-medium text-rose-600">Delayed — {stage.delayReason}</p> : null}
            </li>
          ))}
        </ul>

        <div className="mt-2 flex flex-wrap items-center gap-2">
          <div className="max-w-xs flex-1">
            <Select value={newStage} onChange={(event) => setNewStage(event.target.value as MfgStage | '')}>
              <option value="">Add a stage…</option>
              {MFG_STAGES.filter((stage) => !stages.some((item) => item.stage === stage)).map((stage) => (
                <option key={stage} value={stage}>
                  {stage}
                </option>
              ))}
            </Select>
          </div>
          <Button
            size="sm"
            variant="outline"
            icon={<Plus className="h-3.5 w-3.5" />}
            disabled={!newStage}
            onClick={() => newStage && onAddStage(job, newStage)}
          >
            Add stage
          </Button>
        </div>
      </div>

      {job.notes ? (
        <div className="rounded-xl border border-silver-200 bg-silver-50 px-4 py-3">
          <p className="text-[11px] font-semibold tracking-wide text-silver-600 uppercase">Notes</p>
          <p className="mt-1 text-sm leading-relaxed text-navy-800">{job.notes}</p>
        </div>
      ) : null}

      <div>
        <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-navy-800">
          <History className="h-3.5 w-3.5" /> Stage history
        </p>
        <ol className="relative flex flex-col gap-3 border-l border-silver-200 pl-5">
          {[...job.history].reverse().map((entry) => (
            <li key={entry.id} className="relative">
              <span
                className={cn(
                  'absolute -left-[26px] top-1 h-3 w-3 rounded-full border-2 border-surface',
                  entry.status === 'Delayed'
                    ? 'bg-rose-500'
                    : entry.status === 'Completed'
                      ? 'bg-emerald-500'
                      : 'bg-blue-500',
                )}
              />
              <p className="text-sm font-medium text-navy-900">
                {entry.stage}
                {entry.status ? ` · ${entry.status}` : ''}
              </p>
              <p className="text-xs text-silver-600">{entry.note}</p>
              <p className="text-[11px] text-silver-500">
                {formatDateTime(entry.at)}
                {entry.completedQuantity ? ` · ${formatNumber(entry.completedQuantity)} pcs` : ''}
                {entry.delayReason ? ` · ${entry.delayReason}` : ''}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </div>
  )
}
