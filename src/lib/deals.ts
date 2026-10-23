import type { Database, ID, Quotation, QuotationStatus } from '@/types'

/**
 * A "deal" (opportunity) groups the several quotations issued for one
 * opportunity. It is identified by the originating lead when the customer
 * came from one, otherwise by the customer id — so a lead's quotations and
 * those of any customer it becomes share one deal. No new entity is stored;
 * the id is derived, which keeps every existing record valid.
 */

/** Statuses that count as "still open" for the purpose of superseding. */
const OPEN_STATUSES: QuotationStatus[] = ['Draft', 'Sent', 'Approved']

/** The deal id a customer's quotations belong to. */
export function dealIdForCustomer(db: Database, customerId: ID): ID {
  const customer = db.customers.find((item) => item.id === customerId)
  return customer?.leadId ?? customerId
}

/** The deal id for a quotation, tolerating records that predate the field. */
export function dealIdOf(db: Database, quotation: Quotation): ID {
  return quotation.dealId ?? dealIdForCustomer(db, quotation.customerId)
}

export function quotationsForDeal(db: Database, dealId: ID): Quotation[] {
  return db.quotations
    .filter((quotation) => dealIdOf(db, quotation) === dealId)
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
}

export interface DealSummary {
  id: ID
  title: string
  subtitle: string
  quotations: Quotation[]
}

/** A human label for a deal — the lead's company when there is one. */
export function dealSummary(db: Database, dealId: ID): DealSummary {
  const quotations = quotationsForDeal(db, dealId)
  const lead = db.leads.find((item) => item.id === dealId)
  const customer = db.customers.find((item) => item.id === dealId)
  const fromCustomer = customer
    ? db.leads.find((item) => item.id === customer.leadId)
    : undefined
  const party = lead ?? fromCustomer
  return {
    id: dealId,
    title: party?.company ?? customer?.companyName ?? 'Deal',
    subtitle: party ? `Lead · ${party.stage}` : customer ? `Customer · ${customer.code}` : 'Deal',
    quotations,
  }
}

/** True once any quotation of the deal has been converted into an invoice. */
export function isDealConfirmed(db: Database, dealId: ID): boolean {
  return quotationsForDeal(db, dealId).some((quotation) => Boolean(quotation.convertedInvoiceId))
}

/** The quotation of a deal that was confirmed (converted), if any. */
export function confirmedQuotationOf(db: Database, dealId: ID): Quotation | undefined {
  return quotationsForDeal(db, dealId).find((quotation) => Boolean(quotation.convertedInvoiceId))
}

/**
 * When one quotation of a deal is confirmed, every other still-open quotation
 * of the *same* deal is marked `Superseded` — never deleted, and never
 * touching quotations belonging to another deal or customer.
 */
export function supersedeSiblingQuotations(db: Database, confirmed: Quotation): Quotation[] {
  const dealId = dealIdOf(db, confirmed)
  const changed: Quotation[] = []
  db.quotations.forEach((quotation) => {
    if (quotation.id === confirmed.id) return
    if (dealIdOf(db, quotation) !== dealId) return
    if (!OPEN_STATUSES.includes(quotation.status)) return
    quotation.status = 'Superseded'
    changed.push(quotation)
  })
  return changed
}
