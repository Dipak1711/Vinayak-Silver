import type {
  ActivityModule,
  Customer,
  Database,
  DispatchRecord,
  ID,
  Invoice,
  LineItem,
  ManufacturingJob,
  MfgStage,
  PackagingJob,
  Payment,
  PaymentMode,
  Product,
  Quotation,
  RawMaterial,
  SupplierTransaction,
} from '@/types'
import { MFG_STAGES } from '@/types'
import {
  buildLineItem,
  codeNumber,
  computeTotals,
  documentNumber,
  findProduct,
  invoiceBalance,
  nextSeq,
  paymentStatusFor,
  type LineItemInput,
} from '@/lib/calc'
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

export function createProduct(db: Database, input: Omit<Product, 'id'>): Product {
  const product: Product = { ...input, id: uid('prod') }
  if (!product.sku) product.sku = codeNumber('VS', nextSeq(db, 'product'))
  db.products.push(product)
  pushActivity(db, 'Inventory', `Product ${product.name} added to catalogue`)
  return product
}

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
}): Quotation {
  const items = input.items.map(buildLineItem)
  const totals = computeTotals(items)
  const quotation: Quotation = {
    id: uid('qt'),
    number: createQuotationNumber(db),
    customerId: input.customerId,
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

export function convertQuotationToInvoice(db: Database, quotationId: ID, dueDays = 30): { invoice?: Invoice; error?: string } {
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
  pushActivity(db, 'Invoice', `Invoice ${invoice.number} created from quotation ${quotation.number}`)
  return { invoice }
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
  pushActivity(db, 'Invoice', `Direct order invoice ${invoice.number} created`)
  return invoice
}

export function recordPayment(
  db: Database,
  invoiceId: ID,
  payment: { amount: number; mode: PaymentMode; date: string; reference: string },
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
  }
  invoice.payments.push(entry)
  invoice.amountPaid = Math.round((invoice.amountPaid + payment.amount) * 100) / 100
  invoice.status = paymentStatusFor(invoice.total, invoice.amountPaid)
  pushActivity(db, 'Invoice', `Payment of ₹${payment.amount} recorded on ${invoice.number} (${invoice.status})`)
  return { ok: true }
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
    const job: ManufacturingJob = {
      id: uid('mrj'),
      jobNumber: documentNumber('MRJ', nextSeq(db, 'manufacturing')),
      orderRef: invoice.orderRef,
      invoiceId: invoice.id,
      customerId: invoice.customerId,
      productName: label,
      quantity: shortfall,
      stage: MFG_STAGES[0],
      status: 'Pending',
      plannedStart: start,
      plannedEnd: end.toISOString().slice(0, 10),
      assignedTo: '',
      progress: 0,
      outsourced: false,
      vendor: '',
      notes: product
        ? `Auto-generated while confirming order ${invoice.number}.`
        : `Custom item on order ${invoice.number}.`,
      history: [
        { id: uid('sh'), stage: MFG_STAGES[0], at: new Date().toISOString(), note: 'Job created from order confirmation' },
      ],
      createdAt: new Date().toISOString(),
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

export function advanceManufacturing(
  db: Database,
  jobId: ID,
  input: { stage: MfgStage; progress: number; status: ManufacturingJob['status']; note: string; assignedTo: string },
): { ok: boolean; error?: string } {
  const job = db.manufacturingJobs.find((item) => item.id === jobId)
  if (!job) return { ok: false, error: 'Production job not found.' }
  const progress = Math.max(0, Math.min(100, input.progress))

  if (input.stage !== job.stage || progress !== job.progress || input.note) {
    job.history.push({
      id: uid('sh'),
      stage: input.stage,
      at: new Date().toISOString(),
      note: input.note || `Stage updated to ${input.stage} (${progress}%)`,
    })
  }

  job.stage = input.stage
  job.progress = progress
  job.status = input.status
  job.assignedTo = input.assignedTo || job.assignedTo

  if (input.status === 'Completed') {
    job.progress = 100
    job.stage = MFG_STAGES[MFG_STAGES.length - 1]
    job.completedAt = new Date().toISOString()
    const jobRecord = job
    ensurePackagingJob(db, {
      orderRef: jobRecord.orderRef,
      invoiceId: jobRecord.invoiceId,
      customerId: jobRecord.customerId,
      productName: jobRecord.productName,
      quantity: jobRecord.quantity,
      productionJobId: jobRecord.id,
    })
  }

  pushActivity(db, 'Manufacturing', `${job.jobNumber} updated · ${job.stage} (${job.progress}%) · ${job.status}`)
  return { ok: true }
}

export function createManufacturingJob(
  db: Database,
  input: {
    orderRef: string
    invoiceId?: ID
    customerId?: ID
    productName: string
    quantity: number
    assignedTo: string
    plannedStart: string
    plannedEnd: string
    outsourced: boolean
    vendor: string
    notes: string
  },
): ManufacturingJob {
  const job: ManufacturingJob = {
    id: uid('mrj'),
    jobNumber: documentNumber('MRJ', nextSeq(db, 'manufacturing')),
    orderRef: input.orderRef,
    invoiceId: input.invoiceId,
    customerId: input.customerId,
    productName: input.productName,
    quantity: input.quantity,
    stage: MFG_STAGES[0],
    status: 'Pending',
    plannedStart: input.plannedStart,
    plannedEnd: input.plannedEnd,
    assignedTo: input.assignedTo,
    progress: 0,
    outsourced: input.outsourced,
    vendor: input.vendor,
    notes: input.notes,
    history: [{ id: uid('sh'), stage: MFG_STAGES[0], at: new Date().toISOString(), note: 'Job created' }],
    createdAt: new Date().toISOString(),
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
