import type { CompanySettings, Customer, Invoice, Quotation } from '@/types'
import { formatCurrency, formatDate } from '@/lib/utils'

/**
 * Builds a self-contained HTML document and opens it in a new tab, where the
 * user can print it or download it. No server or external service is involved.
 */

const esc = (value: unknown): string =>
  String(value ?? '').replace(/[&<>"']/g, (character) => {
    switch (character) {
      case '&':
        return '&amp;'
      case '<':
        return '&lt;'
      case '>':
        return '&gt;'
      case '"':
        return '&quot;'
      default:
        return '&#39;'
    }
  })

const STYLES = `
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    background: #f1f3f8;
    color: #0f172a;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    font-size: 13px;
    line-height: 1.5;
  }
  .toolbar {
    position: sticky;
    top: 0;
    z-index: 10;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 18px;
    background: #0f172a;
    color: #fff;
  }
  .toolbar .name { font-weight: 700; font-size: 14px; }
  .toolbar .hint { margin-right: auto; color: #9aa6ba; font-size: 11.5px; }
  .toolbar button {
    height: 34px;
    padding: 0 14px;
    border-radius: 9px;
    border: 1px solid #33405c;
    background: #1c2537;
    color: #fff;
    font: inherit;
    font-size: 12.5px;
    font-weight: 600;
    cursor: pointer;
  }
  .toolbar button.primary { background: #4f46e5; border-color: #4f46e5; }
  .toolbar button:hover { filter: brightness(1.12); }
  .page {
    width: 210mm;
    max-width: calc(100% - 32px);
    margin: 22px auto;
    padding: 16mm;
    background: #fff;
    box-shadow: 0 10px 30px rgba(15, 23, 42, 0.14);
  }
  .head {
    display: flex;
    justify-content: space-between;
    gap: 24px;
    padding-bottom: 16px;
    border-bottom: 2px solid #0f172a;
  }
  .brand { display: flex; align-items: flex-start; gap: 12px; }
  .logo {
    display: grid;
    place-items: center;
    width: 42px;
    height: 42px;
    border-radius: 10px;
    background: #0f172a;
    color: #fff;
    font-weight: 800;
  }
  .company { font-size: 16px; font-weight: 800; }
  .tagline { font-size: 11.5px; color: #6b7488; }
  .meta { margin-top: 10px; font-size: 11.5px; color: #6b7488; line-height: 1.6; }
  .doc-title { text-align: right; }
  .doc-title h1 { margin: 0; font-size: 20px; letter-spacing: 0.04em; text-transform: uppercase; }
  .doc-no { margin-top: 4px; font-size: 13px; font-weight: 700; color: #4b5567; }
  .parties { display: flex; justify-content: space-between; gap: 24px; margin: 18px 0; font-size: 11.5px; }
  .label {
    margin: 0 0 4px;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: #8790a3;
  }
  .strong { font-size: 13px; font-weight: 700; color: #0f172a; }
  .muted { color: #6b7488; }
  table.items { width: 100%; margin-top: 6px; border-collapse: collapse; font-size: 11.5px; }
  table.items th,
  table.items td { padding: 7px 9px; border: 1px solid #d5d9e4; text-align: left; }
  table.items thead th { background: #f1f3f8; font-weight: 700; }
  table.items .r { text-align: right; }
  .totals { display: flex; justify-content: flex-end; margin-top: 16px; }
  .totals table { width: 280px; border-collapse: collapse; font-size: 11.5px; }
  .totals td { padding: 4px 0; }
  .totals td.r { text-align: right; font-weight: 600; }
  .totals tr.grand td { padding-top: 8px; border-top: 1px solid #d5d9e4; font-size: 13px; font-weight: 800; }
  .section { margin-top: 18px; padding-top: 10px; border-top: 1px solid #d5d9e4; font-size: 11.5px; }
  .section h3 { margin: 0 0 4px; font-size: 11.5px; font-weight: 700; color: #0f172a; }
  .two { display: flex; justify-content: space-between; gap: 24px; }
  .sign { display: flex; justify-content: space-between; gap: 24px; margin-top: 38px; font-size: 11.5px; }
  .sign div { min-width: 200px; padding-top: 5px; border-top: 1px solid #0f172a; font-weight: 600; }
  .foot { margin-top: 22px; text-align: center; font-size: 10px; color: #6b7488; }
  @page { size: A4; margin: 14mm; }
  @media print {
    body { background: #fff; }
    .toolbar { display: none !important; }
    .page { width: auto; max-width: none; margin: 0; padding: 0; box-shadow: none; }
    thead { display: table-header-group; }
    tr { break-inside: avoid; page-break-inside: avoid; }
    * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
`

function shell(title: string, filename: string, body: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(title)}</title>
<style>${STYLES}</style>
</head>
<body>
<div class="toolbar">
  <span class="name">${esc(title)}</span>
  <span class="hint">Print → “Save as PDF” for a PDF copy</span>
  <button type="button" onclick="window.print()">Print</button>
  <button type="button" class="primary" onclick="downloadDocument()">Download</button>
</div>
<div class="page">${body}</div>
<script>
  function downloadDocument() {
    var clone = document.documentElement.cloneNode(true);
    var bar = clone.querySelector('.toolbar');
    if (bar) bar.remove();
    var html = '<!doctype html>' + clone.outerHTML;
    var blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    var link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = ${JSON.stringify(filename)};
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(function () { URL.revokeObjectURL(link.href); }, 1000);
  }
</script>
</body>
</html>`
}

function documentHead(
  settings: CompanySettings,
  title: string,
  documentNumber: string,
  meta: Array<[string, string]>,
): string {
  return `<div class="head">
  <div class="brand">
    <span class="logo">VS</span>
    <div>
      <div class="company">${esc(settings.name)}</div>
      <div class="tagline">${esc(settings.tagline)}</div>
      <div class="meta">
        ${esc(settings.address)}<br />
        ${esc(settings.city)}, ${esc(settings.state)} ${esc(settings.pincode)}<br />
        GSTIN: ${esc(settings.gstin)} · ${esc(settings.phone)}<br />
        ${esc(settings.email)} · ${esc(settings.website)}
      </div>
    </div>
  </div>
  <div class="doc-title">
    <h1>${esc(title)}</h1>
    <div class="doc-no">${esc(documentNumber)}</div>
    <div class="meta">
      ${meta.map(([label, value]) => `<div><strong>${esc(label)}:</strong> ${esc(value)}</div>`).join('')}
    </div>
  </div>
</div>`
}

function partyBlock(customer?: Customer): string {
  return `<div class="parties">
  <div>
    <p class="label">Billed to</p>
    <div class="strong">${esc(customer?.companyName ?? 'Customer')}</div>
    <div class="muted">${esc(customer?.contactPerson)}</div>
    <div class="muted">${esc(customer?.address)}</div>
    <div class="muted">${esc(customer?.city)}${customer?.state ? `, ${esc(customer.state)}` : ''}</div>
    ${customer?.gstin ? `<div class="muted">GSTIN: ${esc(customer.gstin)}</div>` : ''}
    <div class="muted">${esc(customer?.phone)} · ${esc(customer?.email)}</div>
  </div>
  <div style="text-align:right">
    <p class="label">Payment terms</p>
    <div class="muted">${esc(customer?.paymentTerms ?? 30)} days from invoice date</div>
  </div>
</div>`
}

function itemsTable(items: Quotation['items']): string {
  return `<table class="items">
  <thead>
    <tr>
      <th>#</th>
      <th>Description</th>
      <th class="r">Qty</th>
      <th class="r">Rate</th>
      <th class="r">Disc %</th>
      <th class="r">GST %</th>
      <th class="r">Amount</th>
    </tr>
  </thead>
  <tbody>
    ${items
      .map(
        (item, index) => `<tr>
      <td>${index + 1}</td>
      <td>${esc(item.description)}</td>
      <td class="r">${esc(item.quantity)}</td>
      <td class="r">${esc(formatCurrency(item.rate))}</td>
      <td class="r">${esc(item.discount)}%</td>
      <td class="r">${esc(item.taxRate)}%</td>
      <td class="r"><strong>${esc(formatCurrency(item.total))}</strong></td>
    </tr>`,
      )
      .join('')}
  </tbody>
</table>`
}

function totalsBlock(
  subtotal: number,
  discountAmount: number,
  taxAmount: number,
  total: number,
  extra: Array<[string, string, boolean?]> = [],
): string {
  return `<div class="totals">
  <table>
    <tr><td>Subtotal</td><td class="r">${esc(formatCurrency(subtotal))}</td></tr>
    <tr><td>Discount</td><td class="r">- ${esc(formatCurrency(discountAmount))}</td></tr>
    <tr><td>GST</td><td class="r">${esc(formatCurrency(taxAmount))}</td></tr>
    <tr class="grand"><td>Grand total</td><td class="r">${esc(formatCurrency(total))}</td></tr>
    ${extra
      .map(
        ([label, value, emphasis]) =>
          `<tr><td${emphasis ? ' style="font-weight:700"' : ''}>${esc(label)}</td><td class="r"${emphasis ? ' style="font-weight:800"' : ''}>${esc(value)}</td></tr>`,
      )
      .join('')}
  </table>
</div>`
}

function signatureBlock(settings: CompanySettings, leftLabel: string): string {
  return `<div class="sign">
  <div>${esc(leftLabel)}</div>
  <div style="text-align:right">For ${esc(settings.name)}
    <div class="muted" style="margin-top:26px;font-weight:400">Authorised signatory</div>
  </div>
</div>`
}

function openDocumentTab(filename: string, html: string): void {
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const opened = window.open(url, '_blank')

  if (!opened) {
    // Popup blocked — download the document instead of losing the action.
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
    return
  }

  // The tab owns the blob URL; release it once the document has loaded.
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

export function openQuotationDocument(quotation: Quotation, customer: Customer | undefined, settings: CompanySettings): void {
  const body = `${documentHead(settings, 'Quotation', quotation.number, [
    ['Date', formatDate(quotation.date)],
    ['Valid until', formatDate(quotation.validUntil)],
    ['Revision', String(quotation.revision)],
    ['Status', quotation.status],
    ['Prepared by', quotation.createdBy],
  ])}
  ${partyBlock(customer)}
  ${itemsTable(quotation.items)}
  ${totalsBlock(quotation.subtotal, quotation.discountAmount, quotation.taxAmount, quotation.total)}
  ${quotation.notes ? `<div class="section"><h3>Notes</h3><div class="muted">${esc(quotation.notes)}</div></div>` : ''}
  <div class="section">
    <h3>Terms</h3>
    <div class="muted">Prices are valid until the date mentioned above. Delivery within 2–3 weeks of order confirmation subject to stock availability.</div>
  </div>
  ${signatureBlock(settings, 'Customer acceptance')}`

  openDocumentTab(`${quotation.number}.html`, shell(`Quotation ${quotation.number}`, `${quotation.number}.html`, body))
}

export function openInvoiceDocument(
  invoice: Invoice,
  customer: Customer | undefined,
  settings: CompanySettings,
  quotationNumber?: string,
): void {
  const meta: Array<[string, string]> = [['Order ref', invoice.orderRef]]
  if (quotationNumber) meta.push(['Quotation', quotationNumber])
  meta.push(['Invoice date', formatDate(invoice.date)])
  meta.push(['Due date', formatDate(invoice.dueDate)])
  meta.push(['Status', invoice.status])

  const payments = invoice.payments.length
    ? `<div class="section">
        <h3>Payment history</h3>
        <table class="items">
          <thead><tr><th>Date</th><th>Mode</th><th>Reference</th><th class="r">Amount</th></tr></thead>
          <tbody>
            ${invoice.payments
              .map(
                (payment) => `<tr>
                  <td>${esc(formatDate(payment.date))}</td>
                  <td>${esc(payment.mode)}${payment.kind ? ` · ${esc(payment.kind)}` : ''}</td>
                  <td>${esc(payment.reference || '—')}</td>
                  <td class="r">${esc(formatCurrency(payment.amount))}</td>
                </tr>`,
              )
              .join('')}
          </tbody>
        </table>
      </div>`
    : ''

  const body = `${documentHead(settings, 'Tax Invoice', invoice.number, meta)}
  ${partyBlock(customer)}
  ${itemsTable(invoice.items)}
  ${totalsBlock(invoice.subtotal, invoice.discountAmount, invoice.taxAmount, invoice.total, [
    ['Amount paid', formatCurrency(invoice.amountPaid)],
    ['Balance due', formatCurrency(invoice.total - invoice.amountPaid), true],
  ])}
  ${payments}
  <div class="section two">
    <div>
      <h3>Bank details</h3>
      <div class="muted">Bank: ${esc(settings.bankName)}</div>
      <div class="muted">A/c No: ${esc(settings.bankAccount)}</div>
      <div class="muted">IFSC: ${esc(settings.ifsc)}</div>
    </div>
    <div style="text-align:right;min-width:200px;padding-top:5px;border-top:1px solid #0f172a;font-weight:600">
      For ${esc(settings.name)}
      <div class="muted" style="margin-top:26px;font-weight:400">Authorised signatory</div>
    </div>
  </div>
  <div class="foot">This is a computer generated document. Declaration: goods once sold are not returnable.</div>`

  openDocumentTab(`${invoice.number}.html`, shell(`Tax invoice ${invoice.number}`, `${invoice.number}.html`, body))
}
