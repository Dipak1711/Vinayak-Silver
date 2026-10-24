export type ID = string;

/* ------------------------------------------------------------------ */
/* Shared                                                              */
/* ------------------------------------------------------------------ */

export type ActivityModule =
  | 'Lead'
  | 'Customer'
  | 'Supplier'
  | 'Quotation'
  | 'Invoice'
  | 'Inventory'
  | 'Manufacturing'
  | 'Packaging'
  | 'Dispatch'
  | 'System';

export interface Activity {
  id: ID;
  at: string;
  module: ActivityModule;
  message: string;
}

export interface CompanySettings {
  name: string;
  tagline: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  gstin: string;
  email: string;
  phone: string;
  website: string;
  bankName: string;
  bankAccount: string;
  ifsc: string;
  defaultTaxRate: number;
  financialYear: string;
}

/* ------------------------------------------------------------------ */
/* Leads                                                               */
/* ------------------------------------------------------------------ */

export type LeadStage =
  | 'New Lead'
  | 'Contacted'
  | 'Follow-up'
  | 'Negotiation'
  | 'Won'
  | 'Lost';

export const LEAD_STAGES: LeadStage[] = [
  'New Lead',
  'Contacted',
  'Follow-up',
  'Negotiation',
  'Won',
  'Lost',
];

export type LeadSource =
  | 'Website'
  | 'Referral'
  | 'Exhibition'
  | 'Cold Call'
  | 'Email Campaign'
  | 'Walk-in'
  | 'Social Media';

export const LEAD_SOURCES: LeadSource[] = [
  'Website',
  'Referral',
  'Exhibition',
  'Cold Call',
  'Email Campaign',
  'Walk-in',
  'Social Media',
];

export interface Lead {
  id: ID;
  name: string;
  company: string;
  email: string;
  phone: string;
  city: string;
  source: LeadSource;
  assignedTo: string;
  expectedValue: number;
  stage: LeadStage;
  followUpDate: string;
  notes: string;
  createdAt: string;
  convertedCustomerId?: ID;
}

/* ------------------------------------------------------------------ */
/* Customers                                                           */
/* ------------------------------------------------------------------ */

export interface Customer {
  id: ID;
  code: string;
  companyName: string;
  contactPerson: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  gstin: string;
  paymentTerms: number;
  creditLimit: number;
  notes: string;
  createdAt: string;
  leadId?: ID;
}

/* ------------------------------------------------------------------ */
/* Suppliers                                                           */
/* ------------------------------------------------------------------ */

export interface Supplier {
  id: ID;
  code: string;
  name: string;
  contactPerson: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  gstin: string;
  materialsSupplied: string[];
  paymentTerms: number;
  notes: string;
  createdAt: string;
}

export type SupplierTxType = 'Purchase' | 'Payment';

export interface SupplierTransaction {
  id: ID;
  supplierId: ID;
  date: string;
  type: SupplierTxType;
  reference: string;
  description: string;
  /** Purchase = amount payable added, Payment = amount paid to supplier */
  amount: number;
  materialName?: string;
  quantity?: number;
}

/* ------------------------------------------------------------------ */
/* Products & raw inventory                                            */
/* ------------------------------------------------------------------ */

export type ProductType = 'Finished' | 'Made to Order';

export interface Product {
  id: ID;
  sku: string;
  name: string;
  category: string;
  type: ProductType;
  unit: string;
  rate: number;
  stock: number;
  description: string;
}

export type MaterialCategory =
  | 'Silver'
  | 'Base Metal'
  | 'Packaging'
  | 'Chemicals'
  | 'Consumables';

export const MATERIAL_CATEGORIES: MaterialCategory[] = [
  'Silver',
  'Base Metal',
  'Packaging',
  'Chemicals',
  'Consumables',
];

export interface RawMaterial {
  id: ID;
  sku: string;
  name: string;
  category: MaterialCategory;
  unit: string;
  quantity: number;
  cost: number;
  minStock: number;
  location: string;
  supplierId?: ID;
}

export type MovementType = 'Inward' | 'Outward' | 'Adjustment';

export interface StockMovement {
  id: ID;
  materialId: ID;
  materialName: string;
  type: MovementType;
  quantity: number;
  balanceAfter: number;
  reference: string;
  note: string;
  date: string;
  createdBy: string;
}

/* ------------------------------------------------------------------ */
/* Quotations                                                          */
/* ------------------------------------------------------------------ */

export interface LineItem {
  id: ID;
  productId?: ID;
  description: string;
  quantity: number;
  rate: number;
  /** discount percentage */
  discount: number;
  /** tax percentage (GST) */
  taxRate: number;
  /** quantity * rate, before discount */
  gross: number;
  /** gross - discount amount */
  net: number;
  /** tax amount for the line */
  tax: number;
  /** net + tax */
  total: number;
}

export type QuotationStatus = 'Draft' | 'Sent' | 'Approved' | 'Rejected' | 'Superseded';

export const QUOTATION_STATUSES: QuotationStatus[] = [
  'Draft',
  'Sent',
  'Approved',
  'Rejected',
  'Superseded',
];

export interface Quotation {
  id: ID;
  number: string;
  customerId: ID;
  /**
   * Deal / opportunity this quotation belongs to. Groups the several
   * quotations issued for one deal. Optional so existing records (which
   * predate it) keep working — the deal is derived when it is missing.
   */
  dealId?: ID;
  date: string;
  validUntil: string;
  items: LineItem[];
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  total: number;
  status: QuotationStatus;
  revision: number;
  parentId?: ID;
  notes: string;
  createdBy: string;
  convertedInvoiceId?: ID;
}

/* ------------------------------------------------------------------ */
/* Invoices                                                            */
/* ------------------------------------------------------------------ */

export type PaymentStatus = 'Unpaid' | 'Advance' | 'Partial' | 'Paid';

export type PaymentMode = 'Cash' | 'Bank Transfer' | 'UPI' | 'Cheque' | 'Card';

export const PAYMENT_MODES: PaymentMode[] = [
  'Cash',
  'Bank Transfer',
  'UPI',
  'Cheque',
  'Card',
];

/** Nature of a money receipt against an order/invoice. */
export type PaymentKind = 'Advance' | 'Partial' | 'Final';

export interface Payment {
  id: ID;
  date: string;
  amount: number;
  mode: PaymentMode;
  reference: string;
  /** Optional so payments recorded before this field existed stay valid. */
  kind?: PaymentKind;
}

/**
 * Money received against a customer / deal / order *before* an invoice
 * exists. It is applied to the invoice automatically when one is raised for
 * the same customer (and order reference, when given), so it is never
 * counted twice.
 */
export interface AdvancePayment {
  id: ID;
  customerId: ID;
  /** Deal / opportunity the advance belongs to, when known. */
  dealId?: ID;
  /** Order reference (quotation number or ORD-…) when the advance is order-specific. */
  orderRef?: string;
  date: string;
  amount: number;
  mode: PaymentMode;
  reference: string;
}

export interface Invoice {
  id: ID;
  number: string;
  /** workflow reference carried across modules (quotation number) */
  orderRef: string;
  customerId: ID;
  quotationId?: ID;
  date: string;
  dueDate: string;
  items: LineItem[];
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  total: number;
  amountPaid: number;
  payments: Payment[];
  status: PaymentStatus;
  notes: string;
  createdBy: string;
  /** true once stock + manufacturing jobs have been generated for this order */
  orderConfirmed: boolean;
  /** true when at least one line item must be manufactured */
  needsManufacturing: boolean;
}

/* ------------------------------------------------------------------ */
/* Manufacturing                                                       */
/* ------------------------------------------------------------------ */

export type MfgStage =
  | 'Material Procurement'
  | 'Cutting'
  | 'Assembly'
  | 'Laser Cutting'
  | 'Cleaning'
  | 'Quality Check';

export const MFG_STAGES: MfgStage[] = [
  'Material Procurement',
  'Cutting',
  'Laser Cutting',
  'Assembly',
  'Cleaning',
  'Quality Check',
];

export type MfgStatus = 'Pending' | 'In Progress' | 'Completed' | 'Delayed';

export interface StageLog {
  id: ID;
  stage: MfgStage;
  at: string;
  note: string;
  /** Status recorded with this entry, when it came from a stage update. */
  status?: MfgStatus;
  /** Completed quantity recorded against the stage. */
  completedQuantity?: number;
  /** Reason, when the entry records a delay. */
  delayReason?: string;
}

/**
 * One required process on a job. A job carries its own ordered list of these,
 * so different orders run different routes (not every order through every
 * stage). `stage` is the process name; the order comes from the list.
 */
export interface JobStage {
  id: ID;
  stage: MfgStage;
  status: MfgStatus;
  /** Person or vendor responsible for this stage. */
  assignedTo: string;
  /** Vendor name when this stage is outsourced (job work). */
  vendor?: string;
  /** Planned completion for the stage. */
  plannedDate?: string;
  completedAt?: string;
  /** How many good pieces came off this stage (received minus rejected). */
  completedQuantity?: number;
  /** Pieces lost or rejected at this stage. */
  rejectedQuantity?: number;
  /** Why pieces were rejected; required when rejectedQuantity is above zero. */
  lossReason?: string;
  remarks?: string;
  /** Required when status is Delayed. */
  delayReason?: string;
}

export interface ManufacturingJob {
  id: ID;
  jobNumber: string;
  orderRef: string;
  invoiceId?: ID;
  customerId?: ID;
  productName: string;
  quantity: number;
  stage: MfgStage;
  status: MfgStatus;
  plannedStart: string;
  plannedEnd: string;
  completedAt?: string;
  assignedTo: string;
  progress: number;
  outsourced: boolean;
  vendor: string;
  notes: string;
  history: StageLog[];
  /** Structured reason captured when the job is marked Delayed. */
  delayReason?: string;
  /** Stage the job was on when it was marked Delayed. */
  delayedAtStage?: MfgStage;
  /* ------- Order-based planning (all optional for older records) ------- */
  /** The job's own ordered list of required stages. A single-stage plan is
   *  derived for records created before per-job stage plans existed. */
  stages?: JobStage[];
  /** Quotation number this job fulfils, when the order came from one. */
  quotationRef?: string;
  /** Invoice / order number this job fulfils. */
  orderNumber?: string;
  /** Quantity on the order for this product (stock + manufactured). */
  orderQuantity?: number;
  /** How much of the order was met from finished stock (no manufacturing). */
  stockFulfilledQuantity?: number;
  /** Quantity reported complete across the stages. */
  completedQuantity?: number;
  createdAt: string;
}

/* ------------------------------------------------------------------ */
/* Packaging                                                           */
/* ------------------------------------------------------------------ */

export type PackagingStatus = 'Pending' | 'In Progress' | 'Packed';

export interface PackagingJob {
  id: ID;
  jobNumber: string;
  orderRef: string;
  productionJobId?: ID;
  invoiceId?: ID;
  customerId?: ID;
  productName: string;
  quantityToPack: number;
  packedQuantity: number;
  status: PackagingStatus;
  assignedTo: string;
  packingDate: string;
  readyForDispatch: boolean;
  notes: string;
  createdAt: string;
}

/* ------------------------------------------------------------------ */
/* Dispatch                                                            */
/* ------------------------------------------------------------------ */

export type DispatchStatus =
  | 'Ready to Dispatch'
  | 'Dispatched'
  | 'In Transit'
  | 'Delivered'
  | 'Delayed';

export const DISPATCH_STATUSES: DispatchStatus[] = [
  'Ready to Dispatch',
  'Dispatched',
  'In Transit',
  'Delivered',
  'Delayed',
];

export interface DispatchEvent {
  id: ID;
  at: string;
  status: DispatchStatus;
  note: string;
}

export interface DispatchRecord {
  id: ID;
  number: string;
  orderRef: string;
  invoiceId?: ID;
  customerId: ID;
  courierName: string;
  trackingNumber: string;
  dispatchDate: string;
  expectedDelivery: string;
  quantity: number;
  deliveryAddress: string;
  status: DispatchStatus;
  notes: string;
  events: DispatchEvent[];
  createdAt: string;
}

/* ------------------------------------------------------------------ */
/* Database                                                            */
/* ------------------------------------------------------------------ */

export interface Database {
  version: number;
  seededAt: string;
  leads: Lead[];
  customers: Customer[];
  suppliers: Supplier[];
  products: Product[];
  rawMaterials: RawMaterial[];
  stockMovements: StockMovement[];
  quotations: Quotation[];
  invoices: Invoice[];
  manufacturingJobs: ManufacturingJob[];
  packagingJobs: PackagingJob[];
  dispatches: DispatchRecord[];
  supplierTransactions: SupplierTransaction[];
  /** Advances received before an invoice exists; applied to invoices on creation. */
  advances: AdvancePayment[];
  activities: Activity[];
  settings: CompanySettings;
  counters: Record<string, number>;
}
