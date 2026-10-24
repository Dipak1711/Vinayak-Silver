import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Field, Input, Select } from '@/components/ui/Form'
import { Modal } from '@/components/ui/Modal'
import { useData } from '@/store/DataContext'
import { useToast } from '@/store/ToastContext'
import { createManufacturingJob } from '@/lib/workflow'
import { DEFAULT_JOB_STAGES } from '@/lib/manufacturing'
import { addDaysISO, formatNumber, todayISO } from '@/lib/utils'

const emptyForm = () => ({
  orderRef: '',
  invoiceId: '',
  customerId: '',
  productName: '',
  orderQuantity: '1',
  stockFulfilled: '0',
  assignedTo: '',
  plannedStart: todayISO(),
  plannedEnd: addDaysISO(todayISO(), 14),
})

/**
 * Creates a production job. Every job runs through the same four stages
 * (Cutting, Laser Cutting, Assembly, Quality Check), so there is nothing to choose.
 * Used on the Manufacturing and Cutting pages so the form opens where you are.
 */
export function NewJobModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { db, mutate } = useData()
  const toast = useToast()
  const [createForm, setCreateForm] = useState(emptyForm)
  const [createErrors, setCreateErrors] = useState<Record<string, string>>({})

  // Start from a clean form each time it opens.
  useEffect(() => {
    if (open) {
      setCreateForm(emptyForm())
      setCreateErrors({})
    }
  }, [open])

  const manufactureQty = Math.max(Number(createForm.orderQuantity || 0) - Number(createForm.stockFulfilled || 0), 0)

  const orderRefList = useMemo(
    () => [...new Set([...db.invoices.map((invoice) => invoice.orderRef), ...db.quotations.map((quotation) => quotation.number)])],
    [db.invoices, db.quotations],
  )

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
        stages: DEFAULT_JOB_STAGES,
        assignedTo: createForm.assignedTo.trim(),
        plannedStart: createForm.plannedStart,
        plannedEnd: createForm.plannedEnd,
        outsourced: false,
        vendor: '',
        notes: '',
        quotationRef,
        orderNumber: invoice?.number,
        stockFulfilledQuantity: Number(createForm.stockFulfilled) || 0,
      })
    })
    toast.success('Production job created. It starts at Cutting.')
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="full"
      title="New production job"
      subtitle="Link the job to its order. It will run through Cutting, Laser Cutting, Assembly and Quality Check."
      footer={
        <>
          <div className="mr-auto text-xs text-silver-600">
            {manufactureQty > 0 ? `${formatNumber(manufactureQty)} units to manufacture` : 'No manufacturing required'}
          </div>
          <Button variant="outline" onClick={onClose}>
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

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label="Assigned to">
            <Input value={createForm.assignedTo} onChange={(event) => setCreateForm({ ...createForm, assignedTo: event.target.value })} placeholder="Artisan / supervisor" />
          </Field>
          <Field label="Planned start">
            <Input type="date" value={createForm.plannedStart} onChange={(event) => setCreateForm({ ...createForm, plannedStart: event.target.value })} />
          </Field>
          <Field label="Planned end" error={createErrors.plannedEnd}>
            <Input type="date" value={createForm.plannedEnd} onChange={(event) => setCreateForm({ ...createForm, plannedEnd: event.target.value })} invalid={Boolean(createErrors.plannedEnd)} />
          </Field>
        </div>
      </div>
    </Modal>
  )
}
