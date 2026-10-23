# Vinayak Silver — ERP Demo

A front-end demo ERP for **Vinayak Silver**, a fictional B2B wholesale and corporate
gifting business dealing in premium gifts and silver articles.

Built with **React + Vite + TypeScript**, styled with **Tailwind CSS v4**, icons from
**Lucide React** and charts from **Recharts**.

> **Demo only.** There is no database, backend, API or authentication service. All data is
> fictional and lives entirely in the browser's `localStorage`.

---

## Running the project locally

```bash
npm install       # install dependencies
npm run dev       # start the dev server (http://localhost:5180)
```

Other scripts:

```bash
npm run build     # type-check (tsc -b) + production build into dist/
npm run preview   # serve the production build locally (also on 5180)
npm run lint      # oxlint
```

### Port

The dev server is pinned to **5180** in `vite.config.ts`, away from Vite's default
5173 so it does not collide with other projects running on this machine.
`strictPort` is on, which means if 5180 is busy Vite **stops with
`Port 5180 is already in use`** rather than silently moving to another port.

If that happens, either free the port or pick another one:

```bash
lsof -nP -iTCP:5180 -sTCP:LISTEN   # see what is holding it
npm run dev -- --port 5200         # ad-hoc override
PORT=5200 npm run dev              # same, via the config
```

On first launch the app writes a full set of fictional sample data into `localStorage`.
Every change you make is persisted, so the demo survives page refreshes.

---

## Modules

The sidebar contains the following modules, in order:

| # | Module | What it does |
|---|--------|--------------|
| 1 | **Dashboard** | KPI cards, sales trend, lead-stage mix, production and dispatch charts, pending tasks, low-stock alerts and recent activity — all calculated from stored data |
| 2 | **Lead** | Drag-and-drop Kanban across New Lead → Contacted → Follow-up → Negotiation → Won/Lost, with search, filters, CRUD and one-click conversion into a customer |
| 3 | **Quotation** | Line-item builder with automatic subtotal / discount / GST / grand total, unique `QT-YYYY-NNNN` numbers, Draft→Sent→Approved→Rejected statuses, revisions, alternative quotations, printable document and conversion into an invoice |
| 4 | **Invoice** | Invoices raised from approved quotations *or* as direct orders, payments (advance / partial / full), printable tax invoice, balance validation, and **Confirm order** which starts the fulfilment chain |
| 5 | **Raw Inventory** | Material master (SKU, unit, cost, minimum level), stock inward / outward / adjustment with full movement history. Stock-out that would drive a balance negative is rejected |
| 6 | **Manufacturing** | Production jobs linked to an order reference, six-stage pipeline (Material Procurement → Cutting → Assembly → Laser Cutting → Cleaning → Quality Check), progress tracking, outsourced job-work flag, delay detection and a stage-history timeline |
| 7 | **Packaging** | Packaging jobs created from completed production *or* from finished stock, packed-quantity tracking, and release to dispatch only once the full quantity is packed |
| 8 | **Dispatch** | Ready-to-dispatch queue, courier / tracking / address capture, manual status updates with a tracking timeline. No live courier integration is claimed |
| 9 | **Customer** | Customer master (GSTIN, payment terms, credit limit) with related quotations, invoices, payments and a running ledger |
| 10 | **Supplier** | Supplier master, purchase / payment records and payable balances |
| 11 | **Report and Ledger** | Sales, quotation, invoice, inventory, manufacturing, packaging and dispatch reports plus customer and supplier ledgers, with date filters, search, summary totals and CSV export |

Plus **Settings** at the bottom of the sidebar: company profile used on printed documents,
demo-data reset (with confirmation), JSON backup export / import, and storage information.

---

## The connected workflow

```
Lead → Customer → Quotation → Invoice/Order → Raw Inventory → Manufacturing → Packaging → Dispatch
```

The same order reference is carried across every related record so a transaction can be
followed end to end:

1. A lead is converted into a customer (the lead is marked **Won** and linked).
2. A quotation is built and approved, then converted into an invoice — the quotation is
   marked as invoiced and cannot be converted twice.
3. **Confirm order** on the invoice decides fulfilment per line item:
   - **Finished stock available** → stock is decremented and a packaging job is created
     straight away. Manufacturing is not forced.
   - **Made-to-order, or short on stock** → a production job is created with the same order
     reference.
4. Completing a production job automatically creates its packaging job.
5. A packaging job released to dispatch appears in the Dispatch queue, where a dispatch
   record is created and tracked.

So some orders flow straight to packaging while others go through manufacturing.

---

## Project structure

```
src/
  components/
    charts/       Recharts wrappers (area, bar, donut)
    layout/       AppLayout, Sidebar, Topbar
    print/        PrintPortal + printable quotation / invoice documents
    ui/           Button, Card, Badge, Form controls, Modal, Table, StatCard, …
    LineItemEditor.tsx
  config/nav.ts   Sidebar module definitions
  hooks/          useClickOutside, useDebounced
  lib/
    calc.ts       Pure selectors, totals, ledgers, dashboard metrics, pending tasks
    seed.ts       Fictional sample dataset
    storage.ts    localStorage load / save / reset with safe parsing
    utils.ts      Formatting, currency, dates, CSV export
    workflow.ts   Mutating business operations that keep records in sync
  pages/          One file per module
  store/          DataContext (data + mutate) and ToastContext (feedback)
  types/          All domain types
```

### LocalStorage notes

- Single key: `vinayak_silver_erp_db`.
- Seeded on first launch only; afterwards your changes persist.
- Missing, partial or corrupt data is repaired against defaults; schema-version mismatches
  rebuild the sample dataset instead of crashing.
- IDs are stable and unique; quotation / invoice / job numbers come from a counter table.
- **Settings → Reset demo data** restores the original sample dataset after confirmation.

---

## Known limitations

- Front-end only: no server, database or multi-user concurrency. Two browser profiles have
  two independent datasets.
- Not a substitute for a production ERP — no authentication, authorisation, audit trail or
  real fiscal documents.
- GST is calculated per line item; there is no HSN summary, e-way bill or e-invoice IRN.
- Courier tracking is manual; no carrier API is connected.
- Reports and CSV exports run in the browser over the whole dataset — fine at demo volumes,
  but not designed for very large data sets.
- The production bundle is a single chunk (~957 kB, ~262 kB gzipped); the charting library
  dominates it, so route-level code splitting would be the first optimisation step.
