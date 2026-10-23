import type {
  Activity,
  Customer,
  Database,
  DispatchRecord,
  Invoice,
  JobStage,
  Lead,
  LineItem,
  ManufacturingJob,
  MfgStage,
  MfgStatus,
  PackagingJob,
  Payment,
  PaymentMode,
  Product,
  Quotation,
  RawMaterial,
  StockMovement,
  Supplier,
  SupplierTransaction,
} from '@/types'
import { buildLineItem, computeTotals } from '@/lib/calc'

export const DB_VERSION = 1

const YEAR = new Date().getFullYear()

function iso(offsetDays: number): string {
  const date = new Date()
  date.setDate(date.getDate() + offsetDays)
  return date.toISOString().slice(0, 10)
}

function ts(offsetDays: number, hour = 10): string {
  const date = new Date()
  date.setDate(date.getDate() + offsetDays)
  date.setHours(hour, 15, 0, 0)
  return date.toISOString()
}

let liSeq = 0
function li(
  description: string,
  quantity: number,
  rate: number,
  discount: number,
  taxRate: number,
  productId?: string,
): LineItem {
  liSeq += 1
  return buildLineItem({ id: `li-${liSeq}`, productId, description, quantity, rate, discount, taxRate })
}

let paySeq = 0
function pay(amount: number, mode: PaymentMode, daysAgo: number, reference: string, kind?: Payment['kind']): Payment {
  paySeq += 1
  return { id: `pay-${paySeq}`, amount, mode, date: iso(-daysAgo), reference, kind }
}

/* ------------------------------------------------------------------ */

const products: Product[] = [
  { id: 'prod-1', sku: 'VS-SL-001', name: 'Silver Pooja Thali Set', category: 'Pooja Items', type: 'Finished', unit: 'Set', rate: 4200, stock: 64, description: 'Pure silver plated pooja thali with 5 bowls and bell.' },
  { id: 'prod-2', sku: 'VS-SL-002', name: 'Silver Glass Pair (Kalash)', category: 'Pooja Items', type: 'Finished', unit: 'Pair', rate: 9500, stock: 22, description: 'Hand-engraved silver glass pair, 92.5 purity finish.' },
  { id: 'prod-3', sku: 'VS-GF-101', name: 'Silver Plated Photo Frame 8x10', category: 'Corporate Gifting', type: 'Finished', unit: 'Pc', rate: 780, stock: 210, description: 'Velvet-backed silver plated frame with custom engraving plate.' },
  { id: 'prod-4', sku: 'VS-GF-102', name: 'Executive Gift Box · Pen & Card Holder', category: 'Corporate Gifting', type: 'Made to Order', unit: 'Box', rate: 1250, stock: 0, description: 'Premium desk set in wooden presentation box with logo embossing.' },
  { id: 'prod-5', sku: 'VS-SL-003', name: 'Silver Idol · Lakshmi 4 inch', category: 'Pooja Items', type: 'Made to Order', unit: 'Pc', rate: 6800, stock: 0, description: 'Hand-crafted silver idol, 35 g average weight.' },
  { id: 'prod-6', sku: 'VS-GF-103', name: 'Premium Tea Light Holder Set', category: 'Corporate Gifting', type: 'Finished', unit: 'Set', rate: 620, stock: 320, description: 'Set of 4 silver finished tea light holders.' },
  { id: 'prod-7', sku: 'VS-SL-004', name: 'Silver Anklet Pair', category: 'Silver Articles', type: 'Finished', unit: 'Pair', rate: 1450, stock: 88, description: 'Traditional payal with 92.5 purity hallmark.' },
  { id: 'prod-8', sku: 'VS-SL-005', name: 'Silver Dinner Set (6 pc)', category: 'Silver Articles', type: 'Made to Order', unit: 'Set', rate: 28500, stock: 0, description: 'Complete dinner set in sterling silver finish.' },
  { id: 'prod-9', sku: 'VS-GF-104', name: 'Silver Plated Keychain (Bulk)', category: 'Corporate Gifting', type: 'Made to Order', unit: 'Pc', rate: 180, stock: 0, description: 'Bulk keychains with laser-etched company branding.' },
  { id: 'prod-10', sku: 'VS-GF-105', name: 'Corporate Diwali Hamper', category: 'Corporate Gifting', type: 'Made to Order', unit: 'Hamper', rate: 1650, stock: 0, description: 'Silver coin 5g with dry fruits in a premium gift box.' },
  { id: 'prod-11', sku: 'VS-GF-106', name: 'Silver Plated Business Card Holder', category: 'Corporate Gifting', type: 'Finished', unit: 'Pc', rate: 540, stock: 145, description: 'Sleek card holder with brushed silver top.' },
  { id: 'prod-12', sku: 'VS-SL-006', name: 'Silver Baby Set (Bangle + Chain)', category: 'Personal Gifting', type: 'Finished', unit: 'Set', rate: 5600, stock: 34, description: 'Baby gifting set in gift packaging.' },
  { id: 'prod-13', sku: 'VS-GF-107', name: 'Crystal & Silver Award Plaque', category: 'Awards & Trophies', type: 'Made to Order', unit: 'Pc', rate: 3100, stock: 0, description: 'Crystal body with silver engraved plate and base.' },
  { id: 'prod-14', sku: 'VS-SL-007', name: 'Silver Coin 10g (999)', category: 'Silver Articles', type: 'Finished', unit: 'Pc', rate: 950, stock: 480, description: '999 purity silver coin in tamper-proof packaging.' },
  { id: 'prod-15', sku: 'VS-GF-108', name: 'Silver Plated Desk Organiser', category: 'Corporate Gifting', type: 'Made to Order', unit: 'Pc', rate: 1450, stock: 0, description: 'Five-compartment desk organiser for corporate gifting.' },
  { id: 'prod-16', sku: 'VS-GF-109', name: 'Festival Gift Combo · Idol + Box', category: 'Personal Gifting', type: 'Finished', unit: 'Box', rate: 2400, stock: 76, description: 'Compact silver idol with dry fruits in handcrafted box.' },
  { id: 'prod-17', sku: 'VS-SL-008', name: 'Engraved Silver Water Bottle', category: 'Corporate Gifting', type: 'Made to Order', unit: 'Pc', rate: 2200, stock: 0, description: 'Stainless bottle with silver plated engraved sleeve.' },
  { id: 'prod-18', sku: 'VS-SL-009', name: 'Silver Rakhi & Coin Combo', category: 'Personal Gifting', type: 'Finished', unit: 'Set', rate: 1150, stock: 120, description: 'Rakhi with 5g silver coin in a festive pouch.' },
]

const materials: RawMaterial[] = [
  { id: 'mat-1', sku: 'RM-SIL-001', name: 'Silver Grain 999', category: 'Silver', unit: 'Kg', quantity: 12.5, cost: 78500, minStock: 5, location: 'Strong Room A', supplierId: 'sup-1' },
  { id: 'mat-2', sku: 'RM-SIL-002', name: 'Silver Sheet 1mm', category: 'Silver', unit: 'Kg', quantity: 6.4, cost: 82000, minStock: 3, location: 'Strong Room A', supplierId: 'sup-1' },
  { id: 'mat-3', sku: 'RM-SIL-003', name: 'Silver Wire 0.8mm', category: 'Silver', unit: 'Kg', quantity: 4.2, cost: 84000, minStock: 2, location: 'Strong Room A', supplierId: 'sup-1' },
  { id: 'mat-4', sku: 'RM-SIL-004', name: 'Silver Alloy Mix', category: 'Silver', unit: 'Kg', quantity: 1.8, cost: 65000, minStock: 2, location: 'Strong Room B', supplierId: 'sup-6' },
  { id: 'mat-5', sku: 'RM-BAS-001', name: 'Brass Sheet', category: 'Base Metal', unit: 'Kg', quantity: 26, cost: 720, minStock: 10, location: 'Metal Store', supplierId: 'sup-6' },
  { id: 'mat-6', sku: 'RM-BAS-002', name: 'Copper Strip', category: 'Base Metal', unit: 'Kg', quantity: 17.5, cost: 860, minStock: 8, location: 'Metal Store', supplierId: 'sup-6' },
  { id: 'mat-7', sku: 'RM-PKG-001', name: 'Velvet Gift Box · Large', category: 'Packaging', unit: 'Pcs', quantity: 180, cost: 165, minStock: 60, location: 'Packaging Store', supplierId: 'sup-3' },
  { id: 'mat-8', sku: 'RM-PKG-002', name: 'Premium Wooden Box', category: 'Packaging', unit: 'Pcs', quantity: 95, cost: 240, minStock: 40, location: 'Packaging Store', supplierId: 'sup-3' },
  { id: 'mat-9', sku: 'RM-PKG-003', name: 'Bubble Wrap Roll', category: 'Packaging', unit: 'Roll', quantity: 14, cost: 450, minStock: 6, location: 'Packaging Store', supplierId: 'sup-3' },
  { id: 'mat-10', sku: 'RM-PKG-004', name: 'Tamper Proof Pouch', category: 'Packaging', unit: 'Pcs', quantity: 620, cost: 12, minStock: 250, location: 'Packaging Store', supplierId: 'sup-3' },
  { id: 'mat-11', sku: 'RM-CHM-001', name: 'Silver Polish Solution', category: 'Chemicals', unit: 'Ltr', quantity: 8, cost: 680, minStock: 3, location: 'Chemical Store', supplierId: 'sup-4' },
  { id: 'mat-12', sku: 'RM-CHM-002', name: 'Rhodium Plating Solution', category: 'Chemicals', unit: 'Ltr', quantity: 2, cost: 4200, minStock: 3, location: 'Chemical Store', supplierId: 'sup-4' },
  { id: 'mat-13', sku: 'RM-CON-001', name: 'Laser Consumable Kit', category: 'Consumables', unit: 'Kit', quantity: 3, cost: 1500, minStock: 4, location: 'Machine Shop', supplierId: 'sup-5' },
  { id: 'mat-14', sku: 'RM-CON-002', name: 'Emery Paper Set', category: 'Consumables', unit: 'Pkt', quantity: 22, cost: 90, minStock: 10, location: 'Machine Shop', supplierId: 'sup-2' },
]

const suppliers: Supplier[] = [
  { id: 'sup-1', code: 'SUP-001', name: 'Rajhans Bullion & Metals', contactPerson: 'Mahesh Shah', email: 'sales@rajhansbullion.example', phone: '+91 98200 11223', address: '12 Zaveri Bazaar, Kalbadevi', city: 'Mumbai', gstin: '27AACCR1234K1Z9', materialsSupplied: ['Silver Grain 999', 'Silver Sheet 1mm', 'Silver Wire 0.8mm'], paymentTerms: 15, notes: 'Primary bullion supplier. Rates linked to daily silver index.', createdAt: ts(-420) },
  { id: 'sup-2', code: 'SUP-002', name: 'Deccan Craft Supplies', contactPerson: 'Prakash Jadhav', email: 'orders@deccancraft.example', phone: '+91 98220 44556', address: 'Unit 7, Bhosari MIDC', city: 'Pune', gstin: '27AAECD5678L1Z3', materialsSupplied: ['Emery Paper Set', 'Hand Tools', 'Polishing Wheels'], paymentTerms: 30, notes: 'Local tooling and consumable supplier.', createdAt: ts(-380) },
  { id: 'sup-3', code: 'SUP-003', name: 'Shree Packaging House', contactPerson: 'Nilesh Kulkarni', email: 'info@shreepackaging.example', phone: '+91 90280 77889', address: 'Plot 22, Satpur MIDC', city: 'Nashik', gstin: '27AAJCS9012M1Z7', materialsSupplied: ['Velvet Gift Box · Large', 'Premium Wooden Box', 'Bubble Wrap Roll', 'Tamper Proof Pouch'], paymentTerms: 30, notes: 'Custom printed boxes with 10 working day lead time.', createdAt: ts(-350) },
  { id: 'sup-4', code: 'SUP-004', name: 'ChemTech Surface Solutions', contactPerson: 'Dr. Anjali Mehta', email: 'contact@chemtechsurface.example', phone: '+91 99045 33447', address: 'GIDC Phase II, Vatva', city: 'Ahmedabad', gstin: '24AABCC3456N1Z1', materialsSupplied: ['Silver Polish Solution', 'Rhodium Plating Solution'], paymentTerms: 21, notes: 'Surface finishing chemicals. MSDS on file.', createdAt: ts(-300) },
  { id: 'sup-5', code: 'SUP-005', name: 'Laser Tools India', contactPerson: 'Vikram Rao', email: 'service@lasertoolsindia.example', phone: '+91 80470 22115', address: 'Peenya Industrial Area', city: 'Bengaluru', gstin: '29AAGCL7890P1Z5', materialsSupplied: ['Laser Consumable Kit', 'Laser Optics'], paymentTerms: 45, notes: 'Laser machine service partner and consumables.', createdAt: ts(-260) },
  { id: 'sup-6', code: 'SUP-006', name: 'Gujarat Alloys Traders', contactPerson: 'Hardik Patel', email: 'hardik@gujaratalloys.example', phone: '+91 90999 66554', address: 'Aji GIDC, Bhavnagar Road', city: 'Rajkot', gstin: '24AADCG2345Q1Z8', materialsSupplied: ['Brass Sheet', 'Copper Strip', 'Silver Alloy Mix'], paymentTerms: 20, notes: 'Base metal and alloy trader.', createdAt: ts(-240) },
]

const customers: Customer[] = [
  { id: 'cust-1', code: 'CUST-001', companyName: 'Aurelia Retail Pvt Ltd', contactPerson: 'Rohan Malhotra', email: 'purchase@aureliaretail.example', phone: '+91 98670 11002', address: '14 Linking Road, Bandra West', city: 'Mumbai', state: 'Maharashtra', gstin: '27AAACA1111B1Z2', paymentTerms: 30, creditLimit: 1500000, notes: 'Retail chain. Prefers silver pooja range for festive season.', createdAt: ts(-320), leadId: 'lead-1' },
  { id: 'cust-2', code: 'CUST-002', companyName: 'Sahyadri Jewellers', contactPerson: 'Kavita Joshi', email: 'kavita@sahyadrijewellers.example', phone: '+91 98230 22003', address: 'Shop 4, Laxmi Road', city: 'Pune', state: 'Maharashtra', gstin: '27AAACS2222C1Z4', paymentTerms: 15, creditLimit: 900000, notes: 'Repeat customer for anklets and silver articles.', createdAt: ts(-290), leadId: 'lead-2' },
  { id: 'cust-3', code: 'CUST-003', companyName: 'Dwarka Gems & Jewels', contactPerson: 'Bhavesh Solanki', email: 'bhavesh@dwarkagems.example', phone: '+91 99250 33004', address: 'Ring Road, Mini Bazaar', city: 'Surat', state: 'Gujarat', gstin: '24AAACD3333D1Z6', paymentTerms: 30, creditLimit: 2500000, notes: 'High value orders, requires hallmarked silver.', createdAt: ts(-260), leadId: 'lead-3' },
  { id: 'cust-4', code: 'CUST-004', companyName: 'TechNova Solutions Pvt Ltd', contactPerson: 'Sneha Iyer', email: 'gifting@technova.example', phone: '+91 80450 44005', address: 'Tower B, Embassy Tech Village', city: 'Bengaluru', state: 'Karnataka', gstin: '29AAACT4444E1Z9', paymentTerms: 45, creditLimit: 3000000, notes: 'Corporate gifting for employee milestones and events.', createdAt: ts(-230), leadId: 'lead-4' },
  { id: 'cust-5', code: 'CUST-005', companyName: 'Grand Palace Hotels', contactPerson: 'Imran Qureshi', email: 'procurement@grandpalace.example', phone: '+91 98290 55006', address: 'Civil Lines, Ashok Marg', city: 'Jaipur', state: 'Rajasthan', gstin: '08AAACG5555F1Z3', paymentTerms: 30, creditLimit: 1200000, notes: 'Bulk tea light holders and gift combos for guest amenities.', createdAt: ts(-190), leadId: 'lead-5' },
  { id: 'cust-6', code: 'CUST-006', companyName: 'Meridian Bank Ltd', contactPerson: 'Farhan Sheikh', email: 'events@meridianbank.example', phone: '+91 98190 66007', address: 'Meridian House, BKC', city: 'Mumbai', state: 'Maharashtra', gstin: '27AAACM6666G1Z5', paymentTerms: 60, creditLimit: 4000000, notes: 'Festive hampers for branch network, PO based ordering.', createdAt: ts(-150), leadId: 'lead-6' },
  { id: 'cust-7', code: 'CUST-007', companyName: 'Kalinga Handicrafts', contactPerson: 'Sasmita Das', email: 'sasmita@kalingahandicrafts.example', phone: '+91 90780 77008', address: 'Unit 3, Rasulgarh Industrial Estate', city: 'Bhubaneswar', state: 'Odisha', gstin: '21AAACK7777H1Z7', paymentTerms: 30, creditLimit: 700000, notes: 'Seasonal buyer, negotiates on volume.', createdAt: ts(-120), leadId: 'lead-7' },
  { id: 'cust-8', code: 'CUST-008', companyName: 'BlueLotus Events & Weddings', contactPerson: 'Ananya Reddy', email: 'hello@bluelotusevents.example', phone: '+91 91000 88009', address: 'Jubilee Hills Road 36', city: 'Hyderabad', state: 'Telangana', gstin: '36AAACB8888J1Z8', paymentTerms: 15, creditLimit: 800000, notes: 'Event gifting — awards and plaques for corporate events.', createdAt: ts(-90) },
]

const leads: Lead[] = [
  { id: 'lead-1', name: 'Rohan Malhotra', company: 'Aurelia Retail Pvt Ltd', email: 'purchase@aureliaretail.example', phone: '+91 98670 11002', city: 'Mumbai', source: 'Exhibition', assignedTo: 'Priya Sharma', expectedValue: 850000, stage: 'Won', followUpDate: iso(-60), notes: 'Converted after India Gifting Expo enquiry.', createdAt: ts(-330), convertedCustomerId: 'cust-1' },
  { id: 'lead-2', name: 'Kavita Joshi', company: 'Sahyadri Jewellers', email: 'kavita@sahyadrijewellers.example', phone: '+91 98230 22003', city: 'Pune', source: 'Referral', assignedTo: 'Priya Sharma', expectedValue: 420000, stage: 'Won', followUpDate: iso(-55), notes: 'Referred by Deccan Craft Supplies.', createdAt: ts(-300), convertedCustomerId: 'cust-2' },
  { id: 'lead-3', name: 'Bhavesh Solanki', company: 'Dwarka Gems & Jewels', email: 'bhavesh@dwarkagems.example', phone: '+91 99250 33004', city: 'Surat', source: 'Cold Call', assignedTo: 'Amit Verma', expectedValue: 1800000, stage: 'Won', followUpDate: iso(-40), notes: 'High value buyer for dinner sets.', createdAt: ts(-270), convertedCustomerId: 'cust-3' },
  { id: 'lead-4', name: 'Sneha Iyer', company: 'TechNova Solutions Pvt Ltd', email: 'gifting@technova.example', phone: '+91 80450 44005', city: 'Bengaluru', source: 'Email Campaign', assignedTo: 'Neha Gupta', expectedValue: 1500000, stage: 'Won', followUpDate: iso(-30), notes: 'Annual employee gifting contract.', createdAt: ts(-240), convertedCustomerId: 'cust-4' },
  { id: 'lead-5', name: 'Imran Qureshi', company: 'Grand Palace Hotels', email: 'procurement@grandpalace.example', phone: '+91 98290 55006', city: 'Jaipur', source: 'Website', assignedTo: 'Amit Verma', expectedValue: 620000, stage: 'Won', followUpDate: iso(-18), notes: 'Guest amenity gifting.', createdAt: ts(-200), convertedCustomerId: 'cust-5' },
  { id: 'lead-6', name: 'Farhan Sheikh', company: 'Meridian Bank Ltd', email: 'events@meridianbank.example', phone: '+91 98190 66007', city: 'Mumbai', source: 'Referral', assignedTo: 'Neha Gupta', expectedValue: 2200000, stage: 'Won', followUpDate: iso(-12), notes: 'PO expected for Diwali hampers.', createdAt: ts(-160), convertedCustomerId: 'cust-6' },
  { id: 'lead-7', name: 'Sasmita Das', company: 'Kalinga Handicrafts', email: 'sasmita@kalingahandicrafts.example', phone: '+91 90780 77008', city: 'Bhubaneswar', source: 'Social Media', assignedTo: 'Priya Sharma', expectedValue: 350000, stage: 'Negotiation', followUpDate: iso(-2), notes: 'Negotiating rates for photo frames.', createdAt: ts(-100) },
  { id: 'lead-8', name: 'Ananya Reddy', company: 'BlueLotus Events & Weddings', email: 'hello@bluelotusevents.example', phone: '+91 91000 88009', city: 'Hyderabad', source: 'Website', assignedTo: 'Neha Gupta', expectedValue: 480000, stage: 'Follow-up', followUpDate: iso(-1), notes: 'Requested award plaque samples.', createdAt: ts(-45) },
  { id: 'lead-9', name: 'Rahul Nair', company: 'Sunrise Pharma Ltd', email: 'rahul.nair@sunrisepharma.example', phone: '+91 99460 99001', city: 'Chennai', source: 'Email Campaign', assignedTo: 'Amit Verma', expectedValue: 275000, stage: 'Contacted', followUpDate: iso(3), notes: 'Wants branded gift boxes for annual day.', createdAt: ts(-30) },
  { id: 'lead-10', name: 'Meera Kapoor', company: 'Kapoor & Sons Jewellers', email: 'meera@kapoorsons.example', phone: '+91 98730 11004', city: 'Delhi', source: 'Walk-in', assignedTo: 'Priya Sharma', expectedValue: 900000, stage: 'New Lead', followUpDate: iso(4), notes: 'Walked in for wholesale silver articles.', createdAt: ts(-12) },
  { id: 'lead-11', name: 'Sanjay Kulkarni', company: 'Omkar Realty Pvt Ltd', email: 'sanjay@omkarrealty.example', phone: '+91 98200 99002', city: 'Pune', source: 'Cold Call', assignedTo: 'Neha Gupta', expectedValue: 180000, stage: 'New Lead', followUpDate: iso(2), notes: 'Interested in silver plaques for investor gifting.', createdAt: ts(-8) },
  { id: 'lead-12', name: 'Deepa Menon', company: 'Coastal Traders', email: 'deepa@coastaltraders.example', phone: '+91 94470 77003', city: 'Kochi', source: 'Website', assignedTo: 'Amit Verma', expectedValue: 150000, stage: 'Lost', followUpDate: iso(-25), notes: 'Chose a local supplier on price.', createdAt: ts(-120) },
  { id: 'lead-13', name: 'Yash Agarwal', company: 'Nirvana Wellness Spa', email: 'yash@nirvanaspa.example', phone: '+91 98900 66004', city: 'Indore', source: 'Referral', assignedTo: 'Priya Sharma', expectedValue: 220000, stage: 'Follow-up', followUpDate: iso(1), notes: 'Comparing tea light holder options.', createdAt: ts(-20) },
]

/* ---------------------------- Quotations --------------------------- */

function quotation(
  id: string,
  number: string,
  customerId: string,
  daysAgo: number,
  validDays: number,
  items: LineItem[],
  status: Quotation['status'],
  extra: Partial<Quotation> = {},
): Quotation {
  const totals = computeTotals(items)
  return {
    id,
    number,
    customerId,
    date: iso(-daysAgo),
    validUntil: iso(-daysAgo + validDays),
    items,
    ...totals,
    status,
    revision: 1,
    notes: '',
    createdBy: 'Priya Sharma',
    ...extra,
  }
}

const qt1Items = [
  li('Silver Pooja Thali Set', 25, 4200, 5, 3, 'prod-1'),
  li('Silver Idol · Lakshmi 4 inch', 20, 6800, 5, 3, 'prod-5'),
]
const qt2Items = [
  li('Executive Gift Box · Pen & Card Holder', 300, 1250, 10, 18, 'prod-4'),
  li('Silver Plated Keychain (Bulk)', 500, 180, 15, 18, 'prod-9'),
]
const qt3Items = [
  li('Silver Glass Pair (Kalash)', 12, 9500, 8, 3, 'prod-2'),
  li('Silver Anklet Pair', 40, 1450, 5, 3, 'prod-7'),
]
const qt4Items = [
  li('Premium Tea Light Holder Set', 150, 620, 10, 18, 'prod-6'),
  li('Festival Gift Combo · Idol + Box', 80, 2400, 5, 18, 'prod-16'),
]
const qt5Items = [
  li('Silver Dinner Set (6 pc)', 6, 28500, 10, 3, 'prod-8'),
  li('Silver Coin 10g (999)', 50, 950, 0, 3, 'prod-14'),
]
const qt6Items = [
  li('Crystal & Silver Award Plaque', 60, 3100, 8, 18, 'prod-13'),
  li('Silver Plated Business Card Holder', 100, 540, 10, 18, 'prod-11'),
]
const qt7Items = [li('Corporate Diwali Hamper', 400, 1650, 12, 18, 'prod-10')]
const qt8Items = [
  li('Silver Plated Photo Frame 8x10', 120, 780, 10, 18, 'prod-3'),
  li('Silver Plated Desk Organiser', 90, 1450, 5, 18, 'prod-15'),
]
const qt9Items = [
  li('Crystal & Silver Award Plaque', 45, 2980, 8, 18, 'prod-13'),
  li('Silver Plated Business Card Holder', 100, 520, 10, 18, 'prod-11'),
]

const quotations: Quotation[] = [
  quotation('qt-1', `QT-${YEAR}-0001`, 'cust-1', 75, 30, qt1Items, 'Approved', {
    convertedInvoiceId: 'inv-1',
    notes: 'Festive season order. 50% advance received.',
    createdBy: 'Priya Sharma',
  }),
  quotation('qt-2', `QT-${YEAR}-0002`, 'cust-4', 62, 45, qt2Items, 'Approved', {
    convertedInvoiceId: 'inv-2',
    notes: 'Annual employee gifting programme with logo branding.',
    createdBy: 'Neha Gupta',
  }),
  quotation('qt-3', `QT-${YEAR}-0003`, 'cust-2', 34, 30, qt3Items, 'Sent', {
    notes: 'Awaiting confirmation on anklet size mix.',
    createdBy: 'Priya Sharma',
  }),
  quotation('qt-4', `QT-${YEAR}-0004`, 'cust-5', 48, 30, qt4Items, 'Approved', {
    convertedInvoiceId: 'inv-3',
    notes: 'Hotel guest amenity order.',
    createdBy: 'Amit Verma',
  }),
  quotation('qt-5', `QT-${YEAR}-0005`, 'cust-3', 40, 30, qt5Items, 'Approved', {
    convertedInvoiceId: 'inv-4',
    notes: 'Requires hallmarked silver, certificate to be shared.',
    createdBy: 'Amit Verma',
  }),
  quotation('qt-6', `QT-${YEAR}-0006`, 'cust-8', 26, 21, qt6Items, 'Sent', {
    notes: 'Award plaques for annual leadership summit.',
    createdBy: 'Neha Gupta',
  }),
  quotation('qt-7', `QT-${YEAR}-0007`, 'cust-6', 18, 45, qt7Items, 'Sent', {
    notes: 'Diwali hamper programme for 400 branches.',
    createdBy: 'Neha Gupta',
  }),
  quotation('qt-8', `QT-${YEAR}-0008`, 'cust-7', 58, 30, qt8Items, 'Rejected', {
    notes: 'Lost on pricing to a local vendor.',
    createdBy: 'Priya Sharma',
  }),
  quotation('qt-9', `QT-${YEAR}-0009`, 'cust-8', 9, 21, qt9Items, 'Draft', {
    notes: 'Revised option with lower plaque rate and adjusted quantity.',
    createdBy: 'Neha Gupta',
    revision: 2,
    parentId: 'qt-6',
  }),
]

// Each quotation belongs to a deal: the originating lead when the customer
// came from one, otherwise the customer itself.
const customerById = new Map(customers.map((customer) => [customer.id, customer]))
quotations.forEach((quotationItem) => {
  quotationItem.dealId = customerById.get(quotationItem.customerId)?.leadId ?? quotationItem.customerId
})

/* ----------------------------- Invoices ---------------------------- */

function invoice(
  id: string,
  number: string,
  orderRef: string,
  customerId: string,
  daysAgo: number,
  dueDays: number,
  items: LineItem[],
  extra: Partial<Invoice> = {},
): Invoice {
  const totals = computeTotals(items)
  return {
    id,
    number,
    orderRef,
    customerId,
    date: iso(-daysAgo),
    dueDate: iso(-daysAgo + dueDays),
    items,
    ...totals,
    amountPaid: 0,
    payments: [],
    status: 'Unpaid',
    notes: '',
    createdBy: 'Priya Sharma',
    orderConfirmed: false,
    needsManufacturing: false,
    ...extra,
  }
}

const inv1 = invoice('inv-1', `INV-${YEAR}-0001`, `QT-${YEAR}-0001`, 'cust-1', 70, 30, qt1Items, {
  quotationId: 'qt-1',
  orderConfirmed: true,
  needsManufacturing: true,
  notes: '50% advance against order confirmation.',
})
const inv1Totals = computeTotals(qt1Items)
const inv1Advance = pay(Math.round(inv1Totals.total * 0.5), 'Bank Transfer', 68, 'NEFT/HSBC/88213', 'Advance')
inv1.payments = [inv1Advance]
inv1.amountPaid = inv1Advance.amount
inv1.status = 'Advance'

const inv2 = invoice('inv-2', `INV-${YEAR}-0002`, `QT-${YEAR}-0002`, 'cust-4', 55, 45, qt2Items, {
  quotationId: 'qt-2',
  orderConfirmed: true,
  needsManufacturing: true,
  notes: 'Logo artwork approved on 2nd proof.',
})
const inv2Totals = computeTotals(qt2Items)
const inv2Pay1 = pay(Math.round(inv2Totals.total * 0.4), 'Bank Transfer', 52, 'RTGS/HDFC/55120')
const inv2Pay2 = pay(Math.round(inv2Totals.total * 0.6), 'UPI', 30, 'UPI/TXN/993211')
inv2.payments = [inv2Pay1, inv2Pay2]
inv2.amountPaid = inv2Pay1.amount + inv2Pay2.amount
inv2.status = 'Paid'

const inv3 = invoice('inv-3', `INV-${YEAR}-0003`, `QT-${YEAR}-0004`, 'cust-5', 40, 30, qt4Items, {
  quotationId: 'qt-4',
  orderConfirmed: true,
  needsManufacturing: false,
  notes: 'Dispatch in two lots as per hotel requirement.',
})
inv3.dueDate = iso(-10)
inv3.status = 'Unpaid'

const inv4 = invoice('inv-4', `INV-${YEAR}-0004`, `QT-${YEAR}-0005`, 'cust-3', 32, 30, qt5Items, {
  quotationId: 'qt-5',
  orderConfirmed: true,
  needsManufacturing: true,
  notes: 'Hallmark certificate enclosed with dispatch.',
})
const inv4Totals = computeTotals(qt5Items)
const inv4Advance = pay(Math.round(inv4Totals.total * 0.3), 'Cheque', 30, 'CHQ/441209', 'Advance')
inv4.payments = [inv4Advance]
inv4.amountPaid = inv4Advance.amount
inv4.status = 'Advance'

const inv5Items = [
  li('Corporate Diwali Hamper', 400, 1620, 10, 18, 'prod-10'),
  li('Silver Coin 10g (999)', 200, 950, 0, 3, 'prod-14'),
]
const inv5 = invoice('inv-5', `INV-${YEAR}-0005`, `ORD-${YEAR}-0001`, 'cust-6', 20, 60, inv5Items, {
  orderConfirmed: true,
  needsManufacturing: true,
  notes: 'Direct PO order — no quotation raised.',
})
const inv5Totals = computeTotals(inv5Items)
const inv5Pay = pay(inv5Totals.total, 'Bank Transfer', 15, 'RTGS/ICICI/71009')
inv5.payments = [inv5Pay]
inv5.amountPaid = inv5Pay.amount
inv5.status = 'Paid'

const inv6Items = [
  li('Silver Anklet Pair', 60, 1420, 5, 3, 'prod-7'),
  li('Silver Rakhi & Coin Combo', 80, 1120, 5, 3, 'prod-18'),
]
const inv6 = invoice('inv-6', `INV-${YEAR}-0006`, `ORD-${YEAR}-0002`, 'cust-2', 6, 15, inv6Items, {
  notes: 'Repeat order. Awaiting stock confirmation before confirmation.',
})

const inv7Items = [
  li('Silver Plated Business Card Holder', 90, 520, 10, 18, 'prod-11'),
  li('Silver Rakhi & Coin Combo', 40, 1120, 5, 3, 'prod-18'),
]
const inv7 = invoice('inv-7', `INV-${YEAR}-0007`, `ORD-${YEAR}-0003`, 'cust-8', 11, 15, inv7Items, {
  orderConfirmed: true,
  needsManufacturing: false,
  notes: 'Event gifting order fulfilled completely from finished stock.',
})
const inv7Totals = computeTotals(inv7Items)
const inv7Pay = pay(inv7Totals.total, 'UPI', 8, 'UPI/TXN/778812')
inv7.payments = [inv7Pay]
inv7.amountPaid = inv7Pay.amount
inv7.status = 'Paid'

const invoices: Invoice[] = [inv1, inv2, inv3, inv4, inv5, inv6, inv7]

/* -------------------------- Manufacturing -------------------------- */

function mfgJob(
  id: string,
  seq: number,
  orderRef: string,
  invoiceId: string | undefined,
  customerId: string,
  productName: string,
  quantity: number,
  stage: ManufacturingJob['stage'],
  status: ManufacturingJob['status'],
  progress: number,
  assignedTo: string,
  plannedStart: number,
  plannedEnd: number,
  extra: Partial<ManufacturingJob> = {},
): ManufacturingJob {
  return {
    id,
    jobNumber: `MRJ-${YEAR}-${String(seq).padStart(4, '0')}`,
    orderRef,
    invoiceId,
    customerId,
    productName,
    quantity,
    stage,
    status,
    progress,
    assignedTo,
    plannedStart: iso(plannedStart),
    plannedEnd: iso(plannedEnd),
    outsourced: false,
    vendor: '',
    notes: '',
    history: [{ id: `${id}-h1`, stage: 'Material Procurement', at: ts(plannedStart), note: 'Job created' }],
    createdAt: ts(plannedStart),
    ...extra,
  }
}

/** Build a per-job stage plan from [stage, status] pairs. */
function stagePlan(jobId: string, quantity: number, steps: Array<[MfgStage, MfgStatus]>): JobStage[] {
  return steps.map(([stage, status], index) => {
    const done = status === 'Completed'
    return {
      id: `${jobId}-stg-${index}`,
      stage,
      status,
      assignedTo: '',
      completedQuantity: done ? quantity : 0,
      completedAt: done ? ts(-1) : undefined,
    }
  })
}

const manufacturingJobs: ManufacturingJob[] = [
  mfgJob('mrj-1', 1, `QT-${YEAR}-0001`, 'inv-1', 'cust-1', 'Silver Idol · Lakshmi 4 inch', 20, 'Laser Cutting', 'In Progress', 55, 'Ramesh Patil', -40, 6, {
    history: [
      { id: 'mrj-1-h1', stage: 'Material Procurement', at: ts(-40), note: 'Silver grain issued from store' },
      { id: 'mrj-1-h2', stage: 'Cutting', at: ts(-32), note: 'Sheet cutting completed' },
      { id: 'mrj-1-h3', stage: 'Assembly', at: ts(-24), note: 'Body assembled' },
      { id: 'mrj-1-h4', stage: 'Laser Cutting', at: ts(-10), note: 'Fine detailing in progress' },
    ],
    notes: 'Detailing as per approved design sheet DS-114.',
    stages: stagePlan('mrj-1', 20, [
      ['Material Procurement', 'Completed'],
      ['Cutting', 'Completed'],
      ['Assembly', 'Completed'],
      ['Laser Cutting', 'In Progress'],
      ['Cleaning', 'Pending'],
      ['Quality Check', 'Pending'],
    ]),
  }),
  mfgJob('mrj-2', 2, `QT-${YEAR}-0002`, 'inv-2', 'cust-4', 'Executive Gift Box · Pen & Card Holder', 300, 'Assembly', 'In Progress', 40, 'Sunita Deshmukh', -30, 12, {
    outsourced: true,
    vendor: 'Deccan Craft Works',
    history: [
      { id: 'mrj-2-h1', stage: 'Material Procurement', at: ts(-30), note: 'Wooden boxes received from vendor' },
      { id: 'mrj-2-h2', stage: 'Assembly', at: ts(-14), note: 'Logo embossing started' },
    ],
    notes: 'Outsourced finishing; in-house QC before packing.',
    stages: stagePlan('mrj-2', 300, [
      ['Material Procurement', 'Completed'],
      ['Cutting', 'Completed'],
      ['Assembly', 'In Progress'],
      ['Cleaning', 'Pending'],
      ['Quality Check', 'Pending'],
    ]),
  }),
  mfgJob('mrj-3', 3, `QT-${YEAR}-0005`, 'inv-4', 'cust-3', 'Silver Dinner Set (6 pc)', 6, 'Cutting', 'In Progress', 30, 'Ganesh Shinde', -18, 14, {
    history: [
      { id: 'mrj-3-h1', stage: 'Material Procurement', at: ts(-18), note: 'Silver sheet 1mm issued' },
      { id: 'mrj-3-h2', stage: 'Cutting', at: ts(-6), note: 'Plate blanks cut' },
    ],
    stages: stagePlan('mrj-3', 6, [
      ['Material Procurement', 'Completed'],
      ['Cutting', 'In Progress'],
      ['Assembly', 'Pending'],
      ['Cleaning', 'Pending'],
      ['Quality Check', 'Pending'],
    ]),
  }),
  mfgJob('mrj-4', 4, `QT-${YEAR}-0005`, 'inv-4', 'cust-3', 'Silver Coin 10g (999)', 50, 'Quality Check', 'Completed', 100, 'Ganesh Shinde', -26, -4, {
    completedAt: ts(-4),
    history: [
      { id: 'mrj-4-h1', stage: 'Material Procurement', at: ts(-26), note: 'Silver grain 500g issued' },
      { id: 'mrj-4-h2', stage: 'Cutting', at: ts(-20), note: 'Blanks punched' },
      { id: 'mrj-4-h3', stage: 'Cleaning', at: ts(-8), note: 'Polish completed' },
      { id: 'mrj-4-h4', stage: 'Quality Check', at: ts(-4), note: 'Passed — 999 hallmark verified' },
    ],
    stages: stagePlan('mrj-4', 50, [
      ['Material Procurement', 'Completed'],
      ['Cutting', 'Completed'],
      ['Cleaning', 'Completed'],
      ['Quality Check', 'Completed'],
    ]),
  }),
  mfgJob('mrj-5', 5, `ORD-${YEAR}-0001`, 'inv-5', 'cust-6', 'Corporate Diwali Hamper', 400, 'Cleaning', 'Delayed', 70, 'Ramesh Patil', -24, -2, {
    history: [
      { id: 'mrj-5-h1', stage: 'Material Procurement', at: ts(-24), note: 'Boxes and coins received' },
      { id: 'mrj-5-h2', stage: 'Assembly', at: ts(-14), note: 'Hamper assembly started' },
      { id: 'mrj-5-h3', stage: 'Cleaning', at: ts(-6), note: 'Delayed due to packaging material shortage' },
    ],
    notes: 'Blocked on velvet box replenishment from supplier.',
    delayReason: 'Material shortage',
    delayedAtStage: 'Cleaning',
    stages: stagePlan('mrj-5', 400, [
      ['Material Procurement', 'Completed'],
      ['Assembly', 'Completed'],
      ['Cleaning', 'Delayed'],
      ['Quality Check', 'Pending'],
    ]),
  }),
  mfgJob('mrj-6', 6, `QT-${YEAR}-0001`, 'inv-1', 'cust-1', 'Silver Pooja Thali Set', 25, 'Quality Check', 'Completed', 100, 'Suresh Kamble', -55, -30, {
    completedAt: ts(-30),
    history: [
      { id: 'mrj-6-h1', stage: 'Material Procurement', at: ts(-55), note: 'Silver sheet issued' },
      { id: 'mrj-6-h2', stage: 'Assembly', at: ts(-45), note: 'Bowl sets assembled' },
      { id: 'mrj-6-h3', stage: 'Quality Check', at: ts(-30), note: 'Passed' },
    ],
    stages: stagePlan('mrj-6', 25, [
      ['Material Procurement', 'Completed'],
      ['Assembly', 'Completed'],
      ['Quality Check', 'Completed'],
    ]),
  }),
]

// Link each seeded job to its order/quotation and tidy its stage plan.
manufacturingJobs.forEach((job) => {
  const invoiceRecord = invoices.find(
    (item) => item.orderRef === job.orderRef && (!job.invoiceId || item.id === job.invoiceId),
  )
  if (invoiceRecord) {
    job.orderNumber = invoiceRecord.number
    const quotationRecord = invoiceRecord.quotationId
      ? quotations.find((item) => item.id === invoiceRecord.quotationId)
      : undefined
    job.quotationRef = quotationRecord?.number
    const line = invoiceRecord.items.find((item) => item.description === job.productName)
    job.orderQuantity = line?.quantity ?? job.quantity
  } else {
    job.orderQuantity = job.quantity
  }
  job.completedQuantity = job.status === 'Completed' ? job.quantity : 0

  const plan = job.stages ?? []
  plan.forEach((stage) => {
    if (!stage.assignedTo) stage.assignedTo = job.assignedTo
  })
  const current = plan.find((stage) => stage.status !== 'Completed') ?? plan[plan.length - 1]
  if (job.outsourced && job.vendor && current) current.vendor = job.vendor
  if (job.delayReason) {
    const delayed = plan.find((stage) => stage.status === 'Delayed')
    if (delayed) delayed.delayReason = job.delayReason
  }
})

/* ---------------------------- Packaging ---------------------------- */

const packagingJobs: PackagingJob[] = [
  {
    id: 'pkg-1', jobNumber: `PKJ-${YEAR}-0001`, orderRef: `QT-${YEAR}-0005`, productionJobId: 'mrj-4', invoiceId: 'inv-4', customerId: 'cust-3',
    productName: 'Silver Coin 10g (999)', quantityToPack: 50, packedQuantity: 50, status: 'Packed', assignedTo: 'Lata More',
    packingDate: iso(-3), readyForDispatch: true, notes: 'Tamper-proof pouches used, hallmark cards enclosed.', createdAt: ts(-4),
  },
  {
    id: 'pkg-2', jobNumber: `PKJ-${YEAR}-0002`, orderRef: `QT-${YEAR}-0001`, productionJobId: 'mrj-6', invoiceId: 'inv-1', customerId: 'cust-1',
    productName: 'Silver Pooja Thali Set', quantityToPack: 25, packedQuantity: 25, status: 'Packed', assignedTo: 'Lata More',
    packingDate: iso(-12), readyForDispatch: true, notes: 'Velvet box with brand sleeve.', createdAt: ts(-14),
  },
  {
    id: 'pkg-3', jobNumber: `PKJ-${YEAR}-0003`, orderRef: `QT-${YEAR}-0004`, invoiceId: 'inv-3', customerId: 'cust-5',
    productName: 'Premium Tea Light Holder Set', quantityToPack: 150, packedQuantity: 95, status: 'In Progress', assignedTo: 'Ravi Chavan',
    packingDate: '', readyForDispatch: false, notes: 'Ready stock item — packing in progress.', createdAt: ts(-8),
  },
  {
    id: 'pkg-4', jobNumber: `PKJ-${YEAR}-0004`, orderRef: `QT-${YEAR}-0002`, invoiceId: 'inv-2', customerId: 'cust-4',
    productName: 'Silver Plated Keychain (Bulk)', quantityToPack: 500, packedQuantity: 0, status: 'Pending', assignedTo: 'Ravi Chavan',
    packingDate: '', readyForDispatch: false, notes: 'Awaiting production completion.', createdAt: ts(-5),
  },
  {
    id: 'pkg-5', jobNumber: `PKJ-${YEAR}-0005`, orderRef: `ORD-${YEAR}-0003`, invoiceId: 'inv-7', customerId: 'cust-8',
    productName: 'Silver Plated Business Card Holder', quantityToPack: 90, packedQuantity: 90, status: 'Packed', assignedTo: 'Lata More',
    packingDate: iso(-6), readyForDispatch: true, notes: 'Ready stock item, packed in printed sleeves.', createdAt: ts(-7),
  },
  {
    id: 'pkg-6', jobNumber: `PKJ-${YEAR}-0006`, orderRef: `ORD-${YEAR}-0003`, invoiceId: 'inv-7', customerId: 'cust-8',
    productName: 'Silver Rakhi & Coin Combo', quantityToPack: 40, packedQuantity: 40, status: 'Packed', assignedTo: 'Lata More',
    packingDate: iso(-6), readyForDispatch: true, notes: 'Festive pouch packing with coin certificate.', createdAt: ts(-7),
  },
]

/* ----------------------------- Dispatch ---------------------------- */

const dispatches: DispatchRecord[] = [
  {
    id: 'dsp-1', number: `DSP-${YEAR}-0001`, orderRef: `QT-${YEAR}-0005`, invoiceId: 'inv-4', customerId: 'cust-3',
    courierName: 'BlueDart', trackingNumber: 'BD88231904', dispatchDate: iso(-3), expectedDelivery: iso(-1), quantity: 50,
    deliveryAddress: 'Dwarka Gems & Jewels, Ring Road, Mini Bazaar, Surat 395002',
    status: 'Delivered', notes: 'Delivered and POD received.', createdAt: ts(-3),
    events: [
      { id: 'dsp-1-e1', at: ts(-3), status: 'Dispatched', note: 'Picked up from warehouse' },
      { id: 'dsp-1-e2', at: ts(-2), status: 'In Transit', note: 'Arrived at Surat hub' },
      { id: 'dsp-1-e3', at: ts(-1), status: 'Delivered', note: 'Signed by Bhavesh Solanki' },
    ],
  },
  {
    id: 'dsp-2', number: `DSP-${YEAR}-0002`, orderRef: `QT-${YEAR}-0001`, invoiceId: 'inv-1', customerId: 'cust-1',
    courierName: 'Delhivery', trackingNumber: 'DL2200198873', dispatchDate: iso(-10), expectedDelivery: iso(-6), quantity: 25,
    deliveryAddress: 'Aurelia Retail Pvt Ltd, 14 Linking Road, Bandra West, Mumbai 400050',
    status: 'In Transit', notes: 'Consignment of pooja thali sets.', createdAt: ts(-10),
    events: [
      { id: 'dsp-2-e1', at: ts(-10), status: 'Dispatched', note: 'Dispatched from Pune warehouse' },
      { id: 'dsp-2-e2', at: ts(-8), status: 'In Transit', note: 'In transit to Mumbai hub' },
    ],
  },
  {
    id: 'dsp-3', number: `DSP-${YEAR}-0003`, orderRef: `QT-${YEAR}-0004`, invoiceId: 'inv-3', customerId: 'cust-5',
    courierName: 'VRL Logistics', trackingNumber: '', dispatchDate: '', expectedDelivery: iso(4), quantity: 150,
    deliveryAddress: 'Grand Palace Hotels, Civil Lines, Ashok Marg, Jaipur 302001',
    status: 'Ready to Dispatch', notes: 'Awaiting packing completion before pickup.', createdAt: ts(-4),
    events: [{ id: 'dsp-3-e1', at: ts(-4), status: 'Ready to Dispatch', note: 'Marked ready by packaging team' }],
  },
  {
    id: 'dsp-4', number: `DSP-${YEAR}-0004`, orderRef: `QT-${YEAR}-0002`, invoiceId: 'inv-2', customerId: 'cust-4',
    courierName: 'Gati KWE', trackingNumber: 'GK55671002', dispatchDate: iso(-18), expectedDelivery: iso(-14), quantity: 300,
    deliveryAddress: 'TechNova Solutions Pvt Ltd, Tower B, Embassy Tech Village, Bengaluru 560103',
    status: 'Delayed', notes: 'Delayed at hub due to weather disruption.', createdAt: ts(-18),
    events: [
      { id: 'dsp-4-e1', at: ts(-18), status: 'Dispatched', note: 'Dispatched in 6 cartons' },
      { id: 'dsp-4-e2', at: ts(-16), status: 'In Transit', note: 'Reached Solapur hub' },
      { id: 'dsp-4-e3', at: ts(-13), status: 'Delayed', note: 'Hub congestion — revised ETA shared' },
    ],
  },
]

/* ---------------------- Supplier transactions ---------------------- */

const supplierTransactions: SupplierTransaction[] = [
  { id: 'stx-1', supplierId: 'sup-1', date: iso(-40), type: 'Purchase', reference: 'PB-2026-014', description: 'Silver grain 999 purchase (3 Kg)', amount: 235500, materialName: 'Silver Grain 999', quantity: 3 },
  { id: 'stx-2', supplierId: 'sup-1', date: iso(-38), type: 'Payment', reference: 'NEFT/77120', description: 'Part payment against PB-2026-014', amount: 150000 },
  { id: 'stx-3', supplierId: 'sup-1', date: iso(-16), type: 'Purchase', reference: 'PB-2026-021', description: 'Silver sheet 1mm purchase (2 Kg)', amount: 164000, materialName: 'Silver Sheet 1mm', quantity: 2 },
  { id: 'stx-4', supplierId: 'sup-2', date: iso(-52), type: 'Purchase', reference: 'PB-2026-009', description: 'Emery paper sets and polishing wheels', amount: 18400, materialName: 'Emery Paper Set', quantity: 40 },
  { id: 'stx-5', supplierId: 'sup-2', date: iso(-48), type: 'Payment', reference: 'UPI/TXN/441002', description: 'Full settlement of PB-2026-009', amount: 18400 },
  { id: 'stx-6', supplierId: 'sup-3', date: iso(-34), type: 'Purchase', reference: 'PB-2026-017', description: 'Velvet gift boxes (300 pcs)', amount: 49500, materialName: 'Velvet Gift Box · Large', quantity: 300 },
  { id: 'stx-7', supplierId: 'sup-3', date: iso(-22), type: 'Purchase', reference: 'PB-2026-024', description: 'Wooden boxes and tamper proof pouches', amount: 31200, materialName: 'Premium Wooden Box', quantity: 130 },
  { id: 'stx-8', supplierId: 'sup-3', date: iso(-18), type: 'Payment', reference: 'RTGS/HDFC/90233', description: 'Part payment against PB-2026-017', amount: 30000 },
  { id: 'stx-9', supplierId: 'sup-4', date: iso(-44), type: 'Purchase', reference: 'PB-2026-011', description: 'Rhodium plating solution (3 Ltr)', amount: 12600, materialName: 'Rhodium Plating Solution', quantity: 3 },
  { id: 'stx-10', supplierId: 'sup-4', date: iso(-12), type: 'Purchase', reference: 'PB-2026-028', description: 'Silver polish solution (5 Ltr)', amount: 3400, materialName: 'Silver Polish Solution', quantity: 5 },
  { id: 'stx-11', supplierId: 'sup-5', date: iso(-29), type: 'Purchase', reference: 'PB-2026-019', description: 'Laser consumable kits (4)' , amount: 6000, materialName: 'Laser Consumable Kit', quantity: 4 },
  { id: 'stx-12', supplierId: 'sup-5', date: iso(-25), type: 'Payment', reference: 'NEFT/33218', description: 'Full settlement of PB-2026-019', amount: 6000 },
  { id: 'stx-13', supplierId: 'sup-6', date: iso(-36), type: 'Purchase', reference: 'PB-2026-015', description: 'Brass and copper sheets', amount: 42600, materialName: 'Brass Sheet', quantity: 30 },
  { id: 'stx-14', supplierId: 'sup-6', date: iso(-20), type: 'Purchase', reference: 'PB-2026-026', description: 'Silver alloy mix (2 Kg)', amount: 130000, materialName: 'Silver Alloy Mix', quantity: 2 },
  { id: 'stx-15', supplierId: 'sup-6', date: iso(-15), type: 'Payment', reference: 'RTGS/AXIS/11840', description: 'Part payment against PB-2026-015', amount: 25000 },
]

/* --------------------------- Stock ledger -------------------------- */

function movement(
  id: string,
  materialId: string,
  materialName: string,
  type: StockMovement['type'],
  quantity: number,
  balanceAfter: number,
  reference: string,
  note: string,
  daysAgo: number,
  createdBy: string,
): StockMovement {
  return { id, materialId, materialName, type, quantity, balanceAfter, reference, note, date: iso(-daysAgo), createdBy }
}

const stockMovements: StockMovement[] = [
  movement('sm-1', 'mat-1', 'Silver Grain 999', 'Inward', 3, 15.5, 'PB-2026-014', 'Purchase from Rajhans Bullion', 40, 'Store Keeper'),
  movement('sm-2', 'mat-1', 'Silver Grain 999', 'Outward', 0.5, 15, `MRJ-${YEAR}-0004`, 'Issued for silver coin production', 26, 'Store Keeper'),
  movement('sm-3', 'mat-1', 'Silver Grain 999', 'Outward', 2.5, 12.5, `MRJ-${YEAR}-0005`, 'Issued for Diwali hamper coins', 24, 'Store Keeper'),
  movement('sm-4', 'mat-2', 'Silver Sheet 1mm', 'Inward', 2, 6.4, 'PB-2026-021', 'Purchase from Rajhans Bullion', 16, 'Store Keeper'),
  movement('sm-5', 'mat-2', 'Silver Sheet 1mm', 'Outward', 1.2, 5.2, `MRJ-${YEAR}-0006`, 'Issued for pooja thali production', 55, 'Store Keeper'),
  movement('sm-6', 'mat-12', 'Rhodium Plating Solution', 'Inward', 3, 3, 'PB-2026-011', 'Purchase from ChemTech', 44, 'Store Keeper'),
  movement('sm-7', 'mat-12', 'Rhodium Plating Solution', 'Outward', 1, 2, `MRJ-${YEAR}-0001`, 'Issued for plating job', 12, 'Store Keeper'),
  movement('sm-8', 'mat-7', 'Velvet Gift Box · Large', 'Inward', 300, 300, 'PB-2026-017', 'Purchase from Shree Packaging', 34, 'Store Keeper'),
  movement('sm-9', 'mat-7', 'Velvet Gift Box · Large', 'Outward', 120, 180, `PKJ-${YEAR}-0002`, 'Issued for packaging', 12, 'Store Keeper'),
  movement('sm-10', 'mat-9', 'Bubble Wrap Roll', 'Adjustment', -1, 14, 'ADJ-2026-003', 'Damaged roll written off after stock count', 9, 'Store Manager'),
  movement('sm-11', 'mat-13', 'Laser Consumable Kit', 'Inward', 4, 4, 'PB-2026-019', 'Purchase from Laser Tools India', 29, 'Store Keeper'),
  movement('sm-12', 'mat-13', 'Laser Consumable Kit', 'Outward', 1, 3, `MRJ-${YEAR}-0001`, 'Consumed on laser machine', 10, 'Store Keeper'),
]

/* --------------------------- Activities ---------------------------- */

const activities: Activity[] = [
  { id: 'act-1', at: ts(-1, 16), module: 'Dispatch', message: `Dispatch DSP-${YEAR}-0001 delivered to Dwarka Gems & Jewels` },
  { id: 'act-2', at: ts(-2, 11), module: 'Manufacturing', message: `Production job MRJ-${YEAR}-0005 marked delayed (hamper assembly)` },
  { id: 'act-3', at: ts(-3, 15), module: 'Packaging', message: `Packaging PKJ-${YEAR}-0001 completed and marked ready for dispatch` },
  { id: 'act-4', at: ts(-4, 10), module: 'Manufacturing', message: `Production job MRJ-${YEAR}-0004 completed at Quality Check` },
  { id: 'act-5', at: ts(-6, 12), module: 'Invoice', message: `Invoice INV-${YEAR}-0006 created for Sahyadri Jewellers` },
  { id: 'act-6', at: ts(-8, 14), module: 'Customer', message: 'BlueLotus Events & Weddings added as a new customer' },
  { id: 'act-7', at: ts(-10, 9), module: 'Inventory', message: 'Stock adjustment recorded for Bubble Wrap Roll' },
  { id: 'act-8', at: ts(-12, 17), module: 'Quotation', message: `Quotation QT-${YEAR}-0009 raised as revision 2 for BlueLotus` },
  { id: 'act-9', at: ts(-15, 11), module: 'Supplier', message: 'Payment recorded to Gujarat Alloys Traders' },
  { id: 'act-10', at: ts(-18, 13), module: 'Lead', message: 'New lead added: Sunrise Pharma Ltd' },
  { id: 'act-11', at: ts(-11, 10), module: 'Invoice', message: `Invoice INV-${YEAR}-0007 raised for BlueLotus Events & Weddings` },
  { id: 'act-12', at: ts(-6, 16), module: 'Packaging', message: `Packaging PKJ-${YEAR}-0005 completed and marked ready for dispatch` },
]

/* ------------------------------------------------------------------ */

export function createSeedDatabase(): Database {
  return {
    version: DB_VERSION,
    seededAt: new Date().toISOString(),
    leads,
    customers,
    suppliers,
    products,
    rawMaterials: materials,
    stockMovements,
    quotations,
    invoices,
    manufacturingJobs,
    packagingJobs,
    dispatches,
    supplierTransactions,
    advances: [],
    activities,
    settings: {
      name: 'Vinayak Silver',
      tagline: 'Premium Silver Articles & Corporate Gifting',
      address: 'Plot 42, Silver Industrial Estate, SEEPZ Road',
      city: 'Pune',
      state: 'Maharashtra',
      pincode: '411026',
      gstin: '27ABCDE1234F1Z5',
      email: 'sales@vinayaksilver.example',
      phone: '+91 98220 45123',
      website: 'www.vinayaksilver.example',
      bankName: 'HDFC Bank',
      bankAccount: '50200 4471 88910',
      ifsc: 'HDFC0001284',
      defaultTaxRate: 18,
      financialYear: `${YEAR}-${String((YEAR + 1) % 100).padStart(2, '0')}`,
    },
    counters: {
      quotation: 9,
      invoice: 7,
      order: 3,
      manufacturing: 6,
      packaging: 6,
      dispatch: 4,
      customer: 8,
      supplier: 6,
      product: 18,
      material: 14,
    },
  }
}
