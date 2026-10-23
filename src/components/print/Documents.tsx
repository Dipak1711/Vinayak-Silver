import type { CompanySettings, Customer, Invoice, Quotation } from '@/types'
import { formatCurrency, formatDate } from '@/lib/utils'

function PrintHeader({ settings, title, documentNumber, meta }: {
  settings: CompanySettings
  title: string
  documentNumber: string
  meta: Array<{ label: string; value: string }>
}) {
  return (
    <div className="mb-6 flex items-start justify-between gap-8 border-b-2 border-navy-900 pb-5">
      <div>
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-ink text-base font-black text-white">
            VS
          </span>
          <div>
            <p className="text-lg font-bold text-navy-950">{settings.name}</p>
            <p className="text-xs text-silver-600">{settings.tagline}</p>
          </div>
        </div>
        <div className="mt-3 text-xs leading-relaxed text-silver-600">
          <p>{settings.address}</p>
          <p>
            {settings.city}, {settings.state} {settings.pincode}
          </p>
          <p>
            GSTIN: {settings.gstin} · {settings.phone}
          </p>
          <p>
            {settings.email} · {settings.website}
          </p>
        </div>
      </div>
      <div className="text-right">
        <p className="text-xl font-bold uppercase tracking-wide text-navy-950">{title}</p>
        <p className="mt-1 text-sm font-semibold text-silver-600">{documentNumber}</p>
        <div className="mt-3 text-xs">
          {meta.map((row) => (
            <p key={row.label} className="text-silver-600">
              <span className="font-semibold text-navy-900">{row.label}: </span>
              {row.value}
            </p>
          ))}
        </div>
      </div>
    </div>
  )
}

function PartyBlock({ customer }: { customer?: Customer }) {
  return (
    <div className="mb-6 grid grid-cols-2 gap-6 text-xs">
      <div>
        <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-silver-600">Billed to</p>
        <p className="text-sm font-bold text-navy-950">{customer?.companyName ?? 'Customer'}</p>
        <p className="text-silver-600">{customer?.contactPerson}</p>
        <p className="text-silver-600">{customer?.address}</p>
        <p className="text-silver-600">
          {customer?.city}
          {customer?.state ? `, ${customer.state}` : ''}
        </p>
        {customer?.gstin ? <p className="text-silver-600">GSTIN: {customer.gstin}</p> : null}
        <p className="text-silver-600">
          {customer?.phone} · {customer?.email}
        </p>
      </div>
      <div className="text-right">
        <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-silver-600">Payment terms</p>
        <p className="text-silver-600">{customer?.paymentTerms ?? 30} days from invoice date</p>
      </div>
    </div>
  )
}

function ItemsTable({ items }: { items: Quotation['items'] }) {
  return (
    <table className="w-full border-collapse text-xs">
      <thead>
        <tr className="bg-silver-100 text-left">
          <th className="border border-silver-300 px-2.5 py-2 font-semibold">#</th>
          <th className="border border-silver-300 px-2.5 py-2 font-semibold">Description</th>
          <th className="border border-silver-300 px-2.5 py-2 text-right font-semibold">Qty</th>
          <th className="border border-silver-300 px-2.5 py-2 text-right font-semibold">Rate</th>
          <th className="border border-silver-300 px-2.5 py-2 text-right font-semibold">Disc %</th>
          <th className="border border-silver-300 px-2.5 py-2 text-right font-semibold">GST %</th>
          <th className="border border-silver-300 px-2.5 py-2 text-right font-semibold">Amount</th>
        </tr>
      </thead>
      <tbody>
        {items.map((item, index) => (
          <tr key={item.id}>
            <td className="border border-silver-300 px-2.5 py-2">{index + 1}</td>
            <td className="border border-silver-300 px-2.5 py-2">{item.description}</td>
            <td className="border border-silver-300 px-2.5 py-2 text-right">{item.quantity}</td>
            <td className="border border-silver-300 px-2.5 py-2 text-right">{formatCurrency(item.rate)}</td>
            <td className="border border-silver-300 px-2.5 py-2 text-right">{item.discount}%</td>
            <td className="border border-silver-300 px-2.5 py-2 text-right">{item.taxRate}%</td>
            <td className="border border-silver-300 px-2.5 py-2 text-right font-semibold">{formatCurrency(item.total)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function TotalsBlock({ subtotal, discountAmount, taxAmount, total, extra }: {
  subtotal: number
  discountAmount: number
  taxAmount: number
  total: number
  extra?: Array<{ label: string; value: string; emphasis?: boolean }>
}) {
  return (
    <div className="mt-5 flex justify-end">
      <div className="w-72 text-xs">
        <div className="flex justify-between py-1">
          <span className="text-silver-600">Subtotal</span>
          <span className="font-semibold text-navy-900">{formatCurrency(subtotal)}</span>
        </div>
        <div className="flex justify-between py-1">
          <span className="text-silver-600">Discount</span>
          <span className="font-semibold text-navy-900">- {formatCurrency(discountAmount)}</span>
        </div>
        <div className="flex justify-between py-1">
          <span className="text-silver-600">GST</span>
          <span className="font-semibold text-navy-900">{formatCurrency(taxAmount)}</span>
        </div>
        <div className="mt-1 flex justify-between border-t border-silver-300 py-2 text-sm">
          <span className="font-bold text-navy-950">Grand total</span>
          <span className="font-bold text-navy-950">{formatCurrency(total)}</span>
        </div>
        {extra?.map((row) => (
          <div key={row.label} className="flex justify-between py-1">
            <span className={row.emphasis ? 'font-semibold text-navy-900' : 'text-silver-600'}>{row.label}</span>
            <span className={row.emphasis ? 'font-bold text-navy-950' : 'font-semibold text-navy-900'}>{row.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function QuotationDocument({
  quotation,
  customer,
  settings,
}: {
  quotation: Quotation
  customer?: Customer
  settings: CompanySettings
}) {
  return (
    <div className="p-2">
      <PrintHeader
        settings={settings}
        title="Quotation"
        documentNumber={quotation.number}
        meta={[
          { label: 'Date', value: formatDate(quotation.date) },
          { label: 'Valid until', value: formatDate(quotation.validUntil) },
          { label: 'Revision', value: String(quotation.revision) },
          { label: 'Status', value: quotation.status },
          { label: 'Prepared by', value: quotation.createdBy },
        ]}
      />
      <PartyBlock customer={customer} />
      <ItemsTable items={quotation.items} />
      <TotalsBlock
        subtotal={quotation.subtotal}
        discountAmount={quotation.discountAmount}
        taxAmount={quotation.taxAmount}
        total={quotation.total}
      />
      {quotation.notes ? (
        <div className="mt-6 border-t border-silver-300 pt-3 text-xs">
          <p className="font-semibold text-navy-900">Notes</p>
          <p className="mt-1 leading-relaxed text-silver-600">{quotation.notes}</p>
        </div>
      ) : null}
      <div className="mt-6 border-t border-silver-300 pt-3 text-xs text-silver-600">
        <p className="font-semibold text-navy-900">Terms</p>
        <p className="mt-1">
          Prices are valid until the date mentioned above. Delivery within 2–3 weeks of order confirmation subject to
          stock availability. This is a system generated quotation.
        </p>
      </div>
      <div className="mt-10 flex justify-between text-xs">
        <div>
          <p className="border-t border-navy-900 pt-1 font-semibold text-navy-900">Customer acceptance</p>
        </div>
        <div className="text-right">
          <p className="border-t border-navy-900 pt-1 font-semibold text-navy-900">For {settings.name}</p>
          <p className="mt-8 text-silver-600">Authorised signatory</p>
        </div>
      </div>
    </div>
  )
}

export function InvoiceDocument({
  invoice,
  customer,
  settings,
}: {
  invoice: Invoice
  customer?: Customer
  settings: CompanySettings
}) {
  const balance = invoice.total - invoice.amountPaid
  return (
    <div className="p-2">
      <PrintHeader
        settings={settings}
        title="Tax Invoice"
        documentNumber={invoice.number}
        meta={[
          { label: 'Order ref', value: invoice.orderRef },
          { label: 'Invoice date', value: formatDate(invoice.date) },
          { label: 'Due date', value: formatDate(invoice.dueDate) },
          { label: 'Status', value: invoice.status },
        ]}
      />
      <PartyBlock customer={customer} />
      <ItemsTable items={invoice.items} />
      <TotalsBlock
        subtotal={invoice.subtotal}
        discountAmount={invoice.discountAmount}
        taxAmount={invoice.taxAmount}
        total={invoice.total}
        extra={[
          { label: 'Amount paid', value: formatCurrency(invoice.amountPaid) },
          { label: 'Balance due', value: formatCurrency(balance), emphasis: true },
        ]}
      />
      {invoice.payments.length > 0 ? (
        <div className="mt-6 text-xs">
          <p className="font-semibold text-navy-900">Payment history</p>
          <table className="mt-2 w-full border-collapse">
            <thead>
              <tr className="bg-silver-100 text-left">
                <th className="border border-silver-300 px-2.5 py-1.5 font-semibold">Date</th>
                <th className="border border-silver-300 px-2.5 py-1.5 font-semibold">Mode</th>
                <th className="border border-silver-300 px-2.5 py-1.5 font-semibold">Reference</th>
                <th className="border border-silver-300 px-2.5 py-1.5 text-right font-semibold">Amount</th>
              </tr>
            </thead>
            <tbody>
              {invoice.payments.map((payment) => (
                <tr key={payment.id}>
                  <td className="border border-silver-300 px-2.5 py-1.5">{formatDate(payment.date)}</td>
                  <td className="border border-silver-300 px-2.5 py-1.5">{payment.mode}</td>
                  <td className="border border-silver-300 px-2.5 py-1.5">{payment.reference || '—'}</td>
                  <td className="border border-silver-300 px-2.5 py-1.5 text-right">{formatCurrency(payment.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      <div className="mt-6 grid grid-cols-2 gap-6 border-t border-silver-300 pt-3 text-xs">
        <div>
          <p className="font-semibold text-navy-900">Bank details</p>
          <p className="mt-1 text-silver-600">Bank: {settings.bankName}</p>
          <p className="text-silver-600">A/c No: {settings.bankAccount}</p>
          <p className="text-silver-600">IFSC: {settings.ifsc}</p>
        </div>
        <div className="text-right">
          <p className="font-semibold text-navy-900">For {settings.name}</p>
          <p className="mt-8 text-silver-600">Authorised signatory</p>
        </div>
      </div>
      <p className="mt-6 text-center text-[10px] text-silver-600">
        This is a computer generated demo document. Declaration: goods once sold are not returnable.
      </p>
    </div>
  )
}
