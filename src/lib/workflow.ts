import type {
  ActivityModule,
  AdvancePayment,
  Customer,
  Database,
  DispatchRecord,
  ID,
  Invoice,
  LineItem,
  ManufacturingJob,
  MfgStage,
  MfgStatus,
  PackagingJob,
  Payment,
  PaymentKind,
  PaymentMode,
  Quotation,
  RawMaterial,
  SupplierTransaction,
} from '@/types'
import {
  DEFAULT_JOB_STAGES,
  deriveJobStatus,
  jobCompletedQuantity,
  jobProgress,
  jobStages,
  makeJobStage,
} from '@/lib/manufacturing'
import {
  buildLineItem,
  codeNumber,
  computeTotals,
  customerName,
  documentNumber,
  findProduct,
  invoiceBalance,
  nextSeq,
  paymentStatusFor,
  type LineItemInput,
} from '@/lib/calc'
import { dealIdForCustomer, supersedeSiblingQuotations } from '@/lib/deals'
import { fetchMockTracking, type MockTrackingStep } from '@/lib/mockCourier'
import { uid } from '@/lib/utils'

/* ------------------------------------------------------------------ */
/* Activity log                                                        */
/* ------------------------------------------------------------------ */

export function pushActivity(db: Database, module: ActivityModule, message: string): void {
  db.activities.unshift({ id: uid('act'), at: new Date().toISOString(), module, message })
  if (db.activities.length > 250) db.activities.length = 250
}

/* ------------------------------------------------------------------ */
/* Leads → Customers                                                   */
/* ------------------------------------------------------------------ */

export interface LeadConversionInput {
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
}

export function convertLeadToCustomer(db: Database, leadId: ID, input: LeadConversionInput): Customer {
  const lead = db.leads.find((item) => item.id === leadId)
  const code = codeNumber('CUST', nextSeq(db, 'customer'))
  const customer: Customer = {
    id: uid('cust'),
    code,
    companyName: input.companyName,
    contactPerson: input.contactPerson,
    email: input.email,
    phone: input.phone,
    address: input.address,
    city: input.city,
    state: input.state,
    gstin: input.gstin,
    paymentTerms: input.paymentTerms,
    creditLimit: input.creditLimit,
    notes: lead ? `Converted from lead · source ${lead.source}` : 'Converted from lead',
    createdAt: new Date().toISOString(),
    leadId,
  }
  db.customers.push(customer)
  if (lead) {
    lead.stage = 'Won'
    lead.convertedCustomerId = customer.id
    pushActivity(db, 'Customer', `${customer.companyName} added as a customer from lead`)
  }
  return customer
}

export function createCustomer(db: Database, input: Omit<Customer, 'id' | 'code' | 'createdAt'>): Customer {
  const customer: Customer = {
    ...input,
    id: uid('cust'),
    code: codeNumber('CUST', nextSeq(db, 'customer')),
    createdAt: new Date().toISOString(),
  }
  db.customers.push(customer)
  pushActivity(db, 'Customer', `Customer ${customer.companyName} created`)
  return customer
}

/* ------------------------------------------------------------------ */
/* Products & raw materials                                            */
/* ------------------------------------------------------------------ */

export function createMaterial(db: Database, input: Omit<RawMaterial, 'id'>): RawMaterial {
  const material: RawMaterial = { ...input, id: uid('mat') }
  if (!material.sku) material.sku = codeNumber('RM', nextSeq(db, 'material'))
  db.rawMaterials.push(material)
  pushActivity(db, 'Inventory', `Raw material ${material.name} added`)
  return material
}

export type StockResult = { ok: true; balance: number } | { ok: false; error: string }

export function applyStockMovement(
  db: Database,
  materialId: ID,
  type: 'Inward' | 'Outward' | 'Adjustment',
  quantity: number,
  reference: string,
  note: string,
  createdBy: string,
  signedAdjustment?: number,
): StockResult {
  const material = db.rawMaterials.find((item) => item.id === materialId)
  if (!material) return { ok: false, error: 'Material not found.' }
  if (type !== 'Adjustment' && quantity <= 0) return { ok: false, error: 'Quantity must be greater than zero.' }
  if (type === 'Adjustment' && (signedAdjustment === undefined || signedAdjustment === 0)) {
    return { ok: false, error: 'Enter a non-zero adjustment quantity.' }
  }

  const delta = type === 'Inward' ? quantity : type === 'Outward' ? -quantity : signedAdjustment ?? 0
  const next = material.quantity + delta

  if (next < 0) {
    return {
      ok: false,
      error: `Insufficient stock. Available ${material.quantity} ${material.unit}, requested ${quantity} ${material.unit}.`,
    }
  }

  material.quantity = Math.round(next * 1000) / 1000
  db.stockMovements.unshift({
    id: uid('sm'),
    materialId: material.id,
    materialName: material.name,
    type,
    quantity: Math.abs(delta),
    balanceAfter: material.quantity,
    reference: reference || '—',
    note,
    date: new Date().toISOString().slice(0, 10),
    createdBy,
  })
  pushActivity(db, 'Inventory', `${type} of ${Math.abs(delta)} ${material.unit} recorded for ${material.name}`)
  return { ok: true, balance: material.quantity }
}

/* ------------------------------------------------------------------ */
/* Quotations                                                          */
/* ------------------------------------------------------------------ */

export function createQuotationNumber(db: Database): string {
  return documentNumber('QT', nextSeq(db, 'quotation'))
}

export function createQuotation(db: Database, input: {
  customerId: ID
  date: string
  validUntil: string
  items: LineItemInput[]
  notes: string
  createdBy: string
  revision?: number
  parentId?: ID
  dealId?: ID
}): Quotation {
  const items = input.items.map(buildLineItem)
  const totals = computeTotals(items)
  const quotation: Quotation = {
    id: uid('qt'),
    number: createQuotationNumber(db),
    customerId: input.customerId,
    // Belongs to the customer's deal (its originating lead, else the customer),
    // so several quotations for one opportunity stay grouped.
    dealId: input.dealId ?? dealIdForCustomer(db, input.customerId),
    date: input.date,
    validUntil: input.validUntil,
    items,
    ...totals,
    status: 'Draft',
    revision: input.revision ?? 1,
    parentId: input.parentId,
    notes: input.notes,
    createdBy: input.createdBy,
  }
  db.quotations.push(quotation)
  pushActivity(db, 'Quotation', `Quotation ${quotation.number} created`)
  return quotation
}

export function duplicateQuotation(db: Database, sourceId: ID, mode: 'revision' | 'alternative'): Quotation | undefined {
  const source = db.quotations.find((item) => item.id === sourceId)
  if (!source) return undefined
  const copy: Quotation = {
    ...source,
    id: uid('qt'),
    number: createQuotationNumber(db),
    status: 'Draft',
    date: new Date().toISOString().slice(0, 10),
    revision: mode === 'revision' ? source.revision + 1 : 1,
    parentId: source.parentId ?? source.id,
    convertedInvoiceId: undefined,
    notes:
      mode === 'revision'
        ? `${source.notes ? `${source.notes} ` : ''}(Revision ${source.revision + 1} of ${source.number})`
        : `${source.notes ? `${source.notes} ` : ''}(Alternative option to ${source.number})`,
    items: source.items.map((item) => ({ ...item, id: uid('li') })),
  }
  db.quotations.push(copy)
  pushActivity(
    db,
    'Quotation',
    mode === 'revision'
      ? `Revision ${copy.revision} of ${source.number} created (${copy.number})`
      : `Alternative quotation ${copy.number} created from ${source.number}`,
  )
  return copy
}

/* ------------------------------------------------------------------ */
/* Invoices                                                            */
/* ------------------------------------------------------------------ */

function buildInvoice(
  input: {
    number: string
    orderRef: string
    customerId: ID
    quotationId?: ID
    date: string
    dueDate: string
    items: LineItem[]
    notes: string
    createdBy: string
  },
): Invoice {
  const totals = computeTotals(input.items)
  return {
    id: uid('inv'),
    number: input.number,
    orderRef: input.orderRef,
    customerId: input.customerId,
    quotationId: input.quotationId,
    date: input.date,
    dueDate: input.dueDate,
    items: input.items,
    ...totals,
    amountPaid: 0,
    payments: [],
    status: 'Unpaid',
    notes: input.notes,
    createdBy: input.createdBy,
    orderConfirmed: false,
    needsManufacturing: false,
  }
}

export function convertQuotationToInvoice(
  db: Database,
  quotationId: ID,
  dueDays = 30,
): { invoice?: Invoice; error?: string; superseded?: number } {
  const quotation = db.quotations.find((item) => item.id === quotationId)
  if (!quotation) return { error: 'Quotation not found.' }
  if (quotation.convertedInvoiceId) {
    const existing = db.invoices.find((invoice) => invoice.id === quotation.convertedInvoiceId)
    return { invoice: existing, error: 'This quotation has already been converted into an invoice.' }
  }
  if (quotation.status !== 'Approved') {
    return { error: 'Only approved quotations can be converted into an invoice.' }
  }
  const date = new Date().toISOString().slice(0, 10)
  const due = new Date()
  due.setDate(due.getDate() + dueDays)
  const invoice = buildInvoice({
    number: documentNumber('INV', nextSeq(db, 'invoice')),
    orderRef: quotation.number,
    customerId: quotation.customerId,
    quotationId: quotation.id,
    date,
    dueDate: due.toISOString().slice(0, 10),
    items: quotation.items.map((item) => ({ ...item, id: uid('li') })),
    notes: `Generated from quotation ${quotation.number}.`,
    createdBy: quotation.createdBy,
  })
  db.invoices.push(invoice)
  quotation.convertedInvoiceId = invoice.id
  // Apply any advance held for this customer/order, then close the other open
  // quotations of the same deal. Order matters: the confirmed quotation must
  // be flagged before siblings are superseded.
  applyAdvancesToInvoice(db, invoice)
  const superseded = supersedeSiblingQuotations(db, quotation)
  pushActivity(db, 'Invoice', `Invoice ${invoice.number} created from quotation ${quotation.number}`)
  if (superseded.length > 0) {
    pushActivity(
      db,
      'Quotation',
      `${superseded.length} other quotation(s) for this deal marked Superseded`,
    )
  }
  return { invoice, superseded: superseded.length }
}

export function createOrderInvoice(
  db: Database,
  input: { customerId: ID; items: LineItemInput[]; notes: string; createdBy: string; dueDays: number },
): Invoice {
  const date = new Date().toISOString().slice(0, 10)
  const due = new Date()
  due.setDate(due.getDate() + input.dueDays)
  const invoice = buildInvoice({
    number: documentNumber('INV', nextSeq(db, 'invoice')),
    orderRef: documentNumber('ORD', nextSeq(db, 'order')),
    customerId: input.customerId,
    date,
    dueDate: due.toISOString().slice(0, 10),
    items: input.items.map(buildLineItem),
    notes: input.notes,
    createdBy: input.createdBy,
  })
  db.invoices.push(invoice)
  applyAdvancesToInvoice(db, invoice)
  pushActivity(db, 'Invoice', `Direct order invoice ${invoice.number} created`)
  return invoice
}

export function recordPayment(
  db: Database,
  invoiceId: ID,
  payment: { amount: number; mode: PaymentMode; date: string; reference: string; kind?: PaymentKind },
): { ok: boolean; error?: string } {
  const invoice = db.invoices.find((item) => item.id === invoiceId)
  if (!invoice) return { ok: false, error: 'Invoice not found.' }
  if (!payment.amount || payment.amount <= 0) return { ok: false, error: 'Payment amount must be greater than zero.' }
  const balance = invoiceBalance(invoice)
  if (payment.amount > balance + 0.001) {
    return { ok: false, error: `Amount exceeds the outstanding balance of ${balance.toFixed(2)}.` }
  }
  const entry: Payment = {
    id: uid('pay'),
    amount: payment.amount,
    mode: payment.mode,
    date: payment.date,
    reference: payment.reference,
    kind: payment.kind ?? 'Partial',
  }
  invoice.payments.push(entry)
  invoice.amountPaid = Math.round((invoice.amountPaid + payment.amount) * 100) / 100
  invoice.status = paymentStatusFor(invoice.total, invoice.amountPaid, invoice.payments)
  pushActivity(db, 'Invoice', `Payment of ₹${payment.amount} recorded on ${invoice.number} (${invoice.status})`)
  return { ok: true }
}

/**
 * Record money received against a customer / deal / order before an invoice
 * exists. It is stored separately and applied automatically to the invoice
 * raised for that customer (and order reference, when given).
 */
export function recordAdvance(
  db: Database,
  input: {
    customerId: ID
    dealId?: ID
    orderRef?: string
    amount: number
    mode: PaymentMode
    date: string
    reference: string
  },
): { ok: boolean; error?: string; advance?: AdvancePayment } {
  if (!input.customerId) return { ok: false, error: 'Select a customer.' }
  if (!input.amount || input.amount <= 0) return { ok: false, error: 'Advance amount must be greater than zero.' }
  if (!Array.isArray(db.advances)) db.advances = []
  const advance: AdvancePayment = {
    id: uid('adv'),
    customerId: input.customerId,
    dealId: input.dealId ?? dealIdForCustomer(db, input.customerId),
    orderRef: input.orderRef?.trim() || undefined,
    date: input.date,
    amount: Math.round(input.amount * 100) / 100,
    mode: input.mode,
    reference: input.reference.trim(),
  }
  db.advances.push(advance)
  pushActivity(db, 'Invoice', `Advance of ₹${advance.amount} recorded for ${customerName(db, input.customerId)}`)
  return { ok: true, advance }
}

/**
 * Move any held advances onto an invoice, oldest first, up to the balance
 * still due. A part-used advance keeps its remainder on account. Because the
 * advance is *moved* (not copied) it can never be counted twice in the ledger.
 */
export function applyAdvancesToInvoice(db: Database, invoice: Invoice): number {
  if (!Array.isArray(db.advances) || db.advances.length === 0) return 0
  let remaining = invoiceBalance(invoice)
  if (remaining <= 0.001) return 0

  const candidates = db.advances
    .filter((advance) => advance.customerId === invoice.customerId)
    .filter((advance) => !advance.orderRef || advance.orderRef === invoice.orderRef)
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))

  let applied = 0
  candidates.forEach((advance) => {
    if (remaining <= 0.001) return
    const amount = Math.min(advance.amount, remaining)
    invoice.payments.push({
      id: uid('pay'),
      date: advance.date,
      amount: Math.round(amount * 100) / 100,
      mode: advance.mode,
      reference: advance.reference,
      kind: 'Advance',
    })
    invoice.amountPaid = Math.round((invoice.amountPaid + amount) * 100) / 100
    remaining = Math.round((remaining - amount) * 100) / 100
    applied += amount

    const rest = Math.round((advance.amount - amount) * 100) / 100
    if (rest <= 0.001) {
      db.advances = db.advances.filter((item) => item.id !== advance.id)
    } else {
      const target = db.advances.find((item) => item.id === advance.id)
      if (target) target.amount = rest
    }
  })

  if (applied > 0) {
    invoice.status = paymentStatusFor(invoice.total, invoice.amountPaid, invoice.payments)
    pushActivity(db, 'Invoice', `Advance of ₹${applied} applied to ${invoice.number}`)
  }
  return applied
}

/* ------------------------------------------------------------------ */
/* Order confirmation → stock / manufacturing / packaging              */
/* ------------------------------------------------------------------ */

export function ensurePackagingJob(
  db: Database,
  input: {
    orderRef: string
    invoiceId?: ID
    customerId?: ID
    productName: string
    quantity: number
    productionJobId?: ID
  },
): PackagingJob | undefined {
  const exists = db.packagingJobs.find(
    (job) => job.orderRef === input.orderRef && job.productName === input.productName,
  )
  if (exists) return exists
  const job: PackagingJob = {
    id: uid('pkg'),
    jobNumber: documentNumber('PKJ', nextSeq(db, 'packaging')),
    orderRef: input.orderRef,
    productionJobId: input.productionJobId,
    invoiceId: input.invoiceId,
    customerId: input.customerId,
    productName: input.productName,
    quantityToPack: input.quantity,
    packedQuantity: 0,
    status: 'Pending',
    assignedTo: '',
    packingDate: '',
    readyForDispatch: false,
    notes: input.productionJobId ? 'Created on production completion.' : 'Ready stock item — no manufacturing required.',
    createdAt: new Date().toISOString(),
  }
  db.packagingJobs.push(job)
  pushActivity(db, 'Packaging', `Packaging job ${job.jobNumber} created for ${job.productName}`)
  return job
}

export function confirmOrder(db: Database, invoiceId: ID): { ok: boolean; error?: string; manufacturing: number } {
  const invoice = db.invoices.find((item) => item.id === invoiceId)
  if (!invoice) return { ok: false, error: 'Invoice not found.', manufacturing: 0 }
  if (invoice.orderConfirmed) {
    return { ok: false, error: 'This order has already been confirmed.', manufacturing: 0 }
  }

  let manufacturing = 0
  invoice.items.forEach((item) => {
    const product = findProduct(db, item.productId)
    const label = product?.name ?? item.description

    if (product && product.type === 'Finished' && product.stock >= item.quantity) {
      product.stock = Math.round((product.stock - item.quantity) * 1000) / 1000
      ensurePackagingJob(db, {
        orderRef: invoice.orderRef,
        invoiceId: invoice.id,
        customerId: invoice.customerId,
        productName: label,
        quantity: item.quantity,
      })
      return
    }

    const shortfall = product && product.type === 'Finished' ? Math.max(item.quantity - product.stock, 0) : item.quantity
    if (product && product.type === 'Finished' && product.stock > 0) {
      product.stock = 0
    }

    const today = new Date()
    const start = today.toISOString().slice(0, 10)
    const end = new Date(today)
    end.setDate(end.getDate() + 14)
    const endDate = end.toISOString().slice(0, 10)
    const quotationRef = invoice.quotationId
      ? db.quotations.find((quotation) => quotation.id === invoice.quotationId)?.number
      : undefined
    const stages = DEFAULT_JOB_STAGES.map((stage) => makeJobStage(stage, endDate))
    const stockFulfilled = product && product.type === 'Finished' ? Math.max(item.quantity - shortfall, 0) : 0
    const job: ManufacturingJob = {
      id: uid('mrj'),
      jobNumber: documentNumber('MRJ', nextSeq(db, 'manufacturing')),
      orderRef: invoice.orderRef,
      invoiceId: invoice.id,
      customerId: invoice.customerId,
      productName: label,
      quantity: shortfall,
      stage: stages[0].stage,
      status: 'Pending',
      plannedStart: start,
      plannedEnd: endDate,
      assignedTo: '',
      progress: 0,
      outsourced: false,
      vendor: '',
      notes: product
        ? `Auto-generated while confirming order ${invoice.number}.`
        : `Custom item on order ${invoice.number}.`,
      history: [
        {
          id: uid('sh'),
          stage: stages[0].stage,
          at: new Date().toISOString(),
          note: `Job created from order confirmation${stockFulfilled > 0 ? ` · ${stockFulfilled} of ${item.quantity} taken from finished stock` : ''}`,
          status: 'Pending',
        },
      ],
      createdAt: new Date().toISOString(),
      stages,
      quotationRef,
      orderNumber: invoice.number,
      orderQuantity: item.quantity,
      stockFulfilledQuantity: stockFulfilled,
      completedQuantity: 0,
    }
    db.manufacturingJobs.push(job)
    manufacturing += 1
    pushActivity(db, 'Manufacturing', `Production job ${job.jobNumber} created for ${label}`)
  })

  invoice.orderConfirmed = true
  invoice.needsManufacturing = manufacturing > 0
  pushActivity(
    db,
    'Invoice',
    `Order ${invoice.orderRef} confirmed · ${manufacturing > 0 ? `${manufacturing} production job(s) created` : 'fulfilled from finished stock'}`,
  )
  return { ok: true, manufacturing }
}

/* ------------------------------------------------------------------ */
/* Manufacturing                                                       */
/* ------------------------------------------------------------------ */

/** Recompute the job's headline fields (current stage, status, progress) from its plan. */
function syncJobFromStages(db: Database, job: ManufacturingJob): void {
  const stages = jobStages(job)
  const current = stages.find((stage) => stage.status !== 'Completed') ?? stages[stages.length - 1]
  job.stage = current?.stage ?? job.stage
  job.status = deriveJobStatus(job)
  job.progress = jobProgress(job)
  job.completedQuantity = jobCompletedQuantity(job)
  job.assignedTo = current?.assignedTo || job.assignedTo
  const delayed = stages.find((stage) => stage.status === 'Delayed')
  job.delayReason = delayed?.delayReason
  job.delayedAtStage = delayed?.stage
  const stageVendor = stages.find((stage) => stage.vendor)?.vendor
  if (stageVendor) {
    job.outsourced = true
    job.vendor = stageVendor
  }

  if (job.status === 'Completed') {
    if (!job.completedAt) job.completedAt = new Date().toISOString()
    ensurePackagingJob(db, {
      orderRef: job.orderRef,
      invoiceId: job.invoiceId,
      customerId: job.customerId,
      productName: job.productName,
      quantity: jobCompletedQuantity(job) || job.quantity,
      productionJobId: job.id,
    })
  } else {
    job.completedAt = undefined
  }
}

export interface JobStageUpdate {
  status: MfgStatus
  completedQuantity?: number
  assignedTo: string
  vendor?: string
  plannedDate?: string
  remarks?: string
  delayReason?: string
}

/** Update one stage of a job's plan. */
export function updateJobStage(
  db: Database,
  jobId: ID,
  stageId: ID,
  input: JobStageUpdate,
): { ok: boolean; error?: string } {
  const job = db.manufacturingJobs.find((item) => item.id === jobId)
  if (!job) return { ok: false, error: 'Production job not found.' }
  if (!Array.isArray(job.stages) || job.stages.length === 0) job.stages = jobStages(job)
  const stage = job.stages.find((item) => item.id === stageId)
  if (!stage) return { ok: false, error: 'Stage not found on this job.' }

  const delayReason = input.delayReason?.trim() ?? ''
  if (input.status === 'Delayed' && !delayReason) {
    return { ok: false, error: 'A delay reason is required when a stage is marked Delayed.' }
  }

  const now = new Date().toISOString()
  const qty = Math.max(0, Math.min(job.quantity, Math.round(input.completedQuantity ?? stage.completedQuantity ?? 0)))

  stage.status = input.status
  stage.assignedTo = input.assignedTo.trim() || stage.assignedTo
  stage.vendor = input.vendor?.trim() || undefined
  stage.plannedDate = input.plannedDate || stage.plannedDate
  stage.remarks = input.remarks?.trim() || undefined
  stage.completedQuantity = input.status === 'Completed' ? qty || job.quantity : qty || stage.completedQuantity
  if (input.status === 'Completed') {
    stage.completedAt = now
    stage.delayReason = undefined
  } else {
    stage.completedAt = undefined
    stage.delayReason = input.status === 'Delayed' ? delayReason : undefined
  }

  const noteParts = [`${stage.stage} · ${input.status}`]
  if (stage.completedQuantity) noteParts.push(`${stage.completedQuantity}/${job.quantity} pcs`)
  if (stage.remarks) noteParts.push(stage.remarks)
  if (input.status === 'Delayed') noteParts.push(`Delayed — ${delayReason}`)
  job.history.push({
    id: uid('sh'),
    stage: stage.stage,
    at: now,
    note: noteParts.join(' · '),
    status: input.status,
    completedQuantity: stage.completedQuantity,
    delayReason: input.status === 'Delayed' ? delayReason : undefined,
  })

  syncJobFromStages(db, job)
  pushActivity(
    db,
    'Manufacturing',
    `${job.jobNumber} · ${stage.stage} ${input.status}${input.status === 'Delayed' ? ` (${delayReason})` : ''}`,
  )
  return { ok: true }
}

/** Append a stage to a job's plan (e.g. an extra finishing step). */
export function addJobStage(db: Database, jobId: ID, stageName: MfgStage): { ok: boolean; error?: string } {
  const job = db.manufacturingJobs.find((item) => item.id === jobId)
  if (!job) return { ok: false, error: 'Production job not found.' }
  if (!Array.isArray(job.stages) || job.stages.length === 0) job.stages = jobStages(job)
  if (job.stages.some((stage) => stage.stage === stageName)) {
    return { ok: false, error: 'That stage is already part of this job.' }
  }
  job.stages.push(makeJobStage(stageName, job.plannedEnd))
  syncJobFromStages(db, job)
  pushActivity(db, 'Manufacturing', `${job.jobNumber} · ${stageName} stage added`)
  return { ok: true }
}

export function createManufacturingJob(
  db: Database,
  input: {
    orderRef: string
    invoiceId?: ID
    customerId?: ID
    productName: string
    /** Quantity on the order for this product. */
    orderQuantity: number
    /** Quantity this job must manufacture. */
    quantity: number
    /** Ordered list of required stages (selectable per job). */
    stages: MfgStage[]
    assignedTo: string
    plannedStart: string
    plannedEnd: string
    outsourced: boolean
    vendor: string
    notes: string
    quotationRef?: string
    orderNumber?: string
    stockFulfilledQuantity?: number
  },
): ManufacturingJob {
  const requested = input.stages.length > 0 ? input.stages : DEFAULT_JOB_STAGES
  const stages = requested.map((stage) => makeJobStage(stage, input.plannedEnd))
  stages[0].assignedTo = input.assignedTo
  if (input.outsourced && input.vendor) stages[0].vendor = input.vendor

  const job: ManufacturingJob = {
    id: uid('mrj'),
    jobNumber: documentNumber('MRJ', nextSeq(db, 'manufacturing')),
    orderRef: input.orderRef,
    invoiceId: input.invoiceId,
    customerId: input.customerId,
    productName: input.productName,
    quantity: input.quantity,
    stage: stages[0].stage,
    status: 'Pending',
    plannedStart: input.plannedStart,
    plannedEnd: input.plannedEnd,
    assignedTo: input.assignedTo,
    progress: 0,
    outsourced: input.outsourced,
    vendor: input.vendor,
    notes: input.notes,
    history: [
      { id: uid('sh'), stage: stages[0].stage, at: new Date().toISOString(), note: 'Job created', status: 'Pending' },
    ],
    createdAt: new Date().toISOString(),
    stages,
    quotationRef: input.quotationRef,
    orderNumber: input.orderNumber,
    orderQuantity: input.orderQuantity,
    stockFulfilledQuantity: input.stockFulfilledQuantity,
    completedQuantity: 0,
  }
  db.manufacturingJobs.push(job)
  pushActivity(db, 'Manufacturing', `Production job ${job.jobNumber} created for ${job.productName}`)
  return job
}

/* ------------------------------------------------------------------ */
/* Packaging                                                           */
/* ------------------------------------------------------------------ */

export function updatePackaging(
  db: Database,
  jobId: ID,
  input: { packedQuantity: number; assignedTo: string; packingDate: string; notes: string; status: PackagingJob['status'] },
): { ok: boolean; error?: string } {
  const job = db.packagingJobs.find((item) => item.id === jobId)
  if (!job) return { ok: false, error: 'Packaging job not found.' }
  const packed = Math.max(0, Math.min(job.quantityToPack, Math.round(input.packedQuantity)))
  if (job.productionJobId) {
    const production = db.manufacturingJobs.find((item) => item.id === job.productionJobId)
    if (production && production.status !== 'Completed') {
      return { ok: false, error: 'Related production job is not complete yet.' }
    }
  }
  job.packedQuantity = packed
  job.assignedTo = input.assignedTo
  job.packingDate = input.packingDate
  job.notes = input.notes
  job.status = packed >= job.quantityToPack ? 'Packed' : packed > 0 ? 'In Progress' : input.status
  if (job.status !== 'Packed') job.readyForDispatch = false
  pushActivity(db, 'Packaging', `${job.jobNumber} packing updated · ${job.packedQuantity}/${job.quantityToPack}`)
  return { ok: true }
}

export function markReadyForDispatch(db: Database, jobId: ID): { ok: boolean; error?: string } {
  const job = db.packagingJobs.find((item) => item.id === jobId)
  if (!job) return { ok: false, error: 'Packaging job not found.' }
  if (job.packedQuantity < job.quantityToPack) {
    return { ok: false, error: 'Only fully packed jobs can be marked ready for dispatch.' }
  }
  job.status = 'Packed'
  job.readyForDispatch = true
  if (!job.packingDate) job.packingDate = new Date().toISOString().slice(0, 10)
  pushActivity(db, 'Packaging', `${job.jobNumber} marked ready for dispatch`)
  return { ok: true }
}

/* ------------------------------------------------------------------ */
/* Dispatch                                                            */
/* ------------------------------------------------------------------ */

export function createDispatch(
  db: Database,
  input: {
    orderRef: string
    invoiceId?: ID
    customerId: ID
    courierName: string
    trackingNumber: string
    dispatchDate: string
    expectedDelivery: string
    quantity: number
    deliveryAddress: string
    notes: string
  },
): DispatchRecord {
  const record: DispatchRecord = {
    id: uid('dsp'),
    number: documentNumber('DSP', nextSeq(db, 'dispatch')),
    orderRef: input.orderRef,
    invoiceId: input.invoiceId,
    customerId: input.customerId,
    courierName: input.courierName,
    trackingNumber: input.trackingNumber,
    dispatchDate: input.dispatchDate,
    expectedDelivery: input.expectedDelivery,
    quantity: input.quantity,
    deliveryAddress: input.deliveryAddress,
    status: 'Ready to Dispatch',
    notes: input.notes,
    events: [
      { id: uid('de'), at: new Date().toISOString(), status: 'Ready to Dispatch', note: 'Dispatch record created' },
    ],
    createdAt: new Date().toISOString(),
  }
  db.dispatches.push(record)
  pushActivity(db, 'Dispatch', `Dispatch ${record.number} created for order ${record.orderRef}`)
  return record
}

export function updateDispatchStatus(
  db: Database,
  dispatchId: ID,
  status: DispatchStatusValue,
  note: string,
): { ok: boolean; error?: string } {
  const record = db.dispatches.find((item) => item.id === dispatchId)
  if (!record) return { ok: false, error: 'Dispatch record not found.' }
  if (record.status === status && !note) return { ok: false, error: 'Select a different status or add a note.' }
  record.status = status
  record.events.push({ id: uid('de'), at: new Date().toISOString(), status, note: note || `Status changed to ${status}` })
  if (status === 'Dispatched' && !record.dispatchDate) {
    record.dispatchDate = new Date().toISOString().slice(0, 10)
  }
  pushActivity(db, 'Dispatch', `${record.number} marked ${status}`)
  return { ok: true }
}

type DispatchStatusValue = DispatchRecord['status']

/**
 * Simulated courier tracking. Pulls the next realistic milestone from the
 * mock tracker and records it. It never calls a real courier API and never
 * alters the courier, tracking number or delivery ETA.
 */
export function fetchDispatchTracking(
  db: Database,
  dispatchId: ID,
): { ok: boolean; error?: string; step?: MockTrackingStep } {
  const record = db.dispatches.find((item) => item.id === dispatchId)
  if (!record) return { ok: false, error: 'Dispatch record not found.' }
  const step = fetchMockTracking(record)
  if (!step) return { ok: false, error: 'This shipment is already delivered.' }
  record.events.push({ id: uid('de'), at: step.at, status: step.status, note: step.note })
  record.status = step.status
  if (step.status === 'Dispatched' && !record.dispatchDate) {
    record.dispatchDate = new Date().toISOString().slice(0, 10)
  }
  pushActivity(db, 'Dispatch', `${record.number} tracking refreshed (simulated) · ${step.status}`)
  return { ok: true, step }
}

/* ------------------------------------------------------------------ */
/* Suppliers                                                           */
/* ------------------------------------------------------------------ */

export function createSupplierTransaction(
  db: Database,
  input: Omit<SupplierTransaction, 'id'>,
): { ok: boolean; error?: string; transaction?: SupplierTransaction } {
  const supplier = db.suppliers.find((item) => item.id === input.supplierId)
  if (!supplier) return { ok: false, error: 'Supplier not found.' }
  if (!input.amount || input.amount <= 0) return { ok: false, error: 'Amount must be greater than zero.' }
  const transaction: SupplierTransaction = { ...input, id: uid('stx') }
  db.supplierTransactions.push(transaction)
  pushActivity(
    db,
    'Supplier',
    input.type === 'Purchase'
      ? `Purchase ${input.reference} recorded for ${supplier.name}`
      : `Payment of ₹${input.amount} recorded to ${supplier.name}`,
  )
  return { ok: true, transaction }
}

export function createSupplier(db: Database, input: Omit<SupplierEntity, 'id' | 'code'>): SupplierEntity {
  const supplier: SupplierEntity = {
    ...input,
    id: uid('sup'),
    code: codeNumber('SUP', nextSeq(db, 'supplier')),
  }
  db.suppliers.push(supplier)
  pushActivity(db, 'Supplier', `Supplier ${supplier.name} added`)
  return supplier
}

type SupplierEntity = Database['suppliers'][number]
