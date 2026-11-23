import {
  AppUser,
  Project,
  Receipt,
  ExpenseCategory,
  BankAccount,
  StatementRecord,
  AuditLog,
} from '../types';
import { normalizeStatementTransactionsList } from '../utils/formatters';

export interface DefaultCategoryItem {
  id: string;
  name: string;
  level: 'main' | 'sub';
  parentId?: string | null;
  parentName?: string | null;
}

export const DEFAULT_CATEGORIES: DefaultCategoryItem[] = [
  // 1. ค่าเดินทางและยานพาหนะ (Main)
  { id: 'cat-main-transport', name: 'ค่าเดินทางและยานพาหนะ', level: 'main' },
  { id: 'cat-fuel', name: 'ค่าน้ำมันเชื้อเพลิง', level: 'sub', parentId: 'cat-main-transport', parentName: 'ค่าเดินทางและยานพาหนะ' },
  { id: 'cat-toll', name: 'ค่าทางด่วนและที่จอดรถ', level: 'sub', parentId: 'cat-main-transport', parentName: 'ค่าเดินทางและยานพาหนะ' },
  { id: 'cat-fare', name: 'ค่าตั๋วโดยสารและรถรับจ้าง', level: 'sub', parentId: 'cat-main-transport', parentName: 'ค่าเดินทางและยานพาหนะ' },

  // 2. ค่าที่พักและเบี้ยเลี้ยง (Main)
  { id: 'cat-main-stay', name: 'ค่าที่พักและเบี้ยเลี้ยง', level: 'main' },
  { id: 'cat-hotel', name: 'ค่าที่พักและโรงแรม', level: 'sub', parentId: 'cat-main-stay', parentName: 'ค่าที่พักและเบี้ยเลี้ยง' },
  { id: 'cat-food', name: 'ค่าอาหารและเครื่องดื่ม', level: 'sub', parentId: 'cat-main-stay', parentName: 'ค่าที่พักและเบี้ยเลี้ยง' },

  // 3. ค่าวัสดุ อุปกรณ์และสำนักงาน (Main)
  { id: 'cat-main-supplies', name: 'ค่าวัสดุและอุปกรณ์สำนักงาน', level: 'main' },
  { id: 'cat-supplies', name: 'ค่าวัสดุสิ้นเปลือง', level: 'sub', parentId: 'cat-main-supplies', parentName: 'ค่าวัสดุและอุปกรณ์สำนักงาน' },
  { id: 'cat-hardware', name: 'ค่าอุปกรณ์ไอทีและเครื่องมือ', level: 'sub', parentId: 'cat-main-supplies', parentName: 'ค่าวัสดุและอุปกรณ์สำนักงาน' },

  // 4. ค่าบริการและจ้างเหมา (Main)
  { id: 'cat-main-service', name: 'ค่าบริการและจ้างเหมา', level: 'main' },
  { id: 'cat-service', name: 'ค่าบริการและจ้างทำของ', level: 'sub', parentId: 'cat-main-service', parentName: 'ค่าบริการและจ้างเหมา' },
  { id: 'cat-consultant', name: 'ค่าที่ปรึกษาและวิชาชีพ', level: 'sub', parentId: 'cat-main-service', parentName: 'ค่าบริการและจ้างเหมา' },

  // 5. ค่าสาธารณูปโภคและการสื่อสาร (Main)
  { id: 'cat-main-utilities', name: 'ค่าสาธารณูปโภคและการสื่อสาร', level: 'main' },
  { id: 'cat-utilities', name: 'ค่าน้ำประปาและค่าไฟฟ้า', level: 'sub', parentId: 'cat-main-utilities', parentName: 'ค่าสาธารณูปโภคและการสื่อสาร' },
  { id: 'cat-telecom', name: 'ค่าโทรศัพท์และอินเทอร์เน็ต', level: 'sub', parentId: 'cat-main-utilities', parentName: 'ค่าสาธารณูปโภคและการสื่อสาร' },

  // 6. ค่าใช้จ่ายอื่น ๆ (Main)
  { id: 'cat-main-other', name: 'ค่าใช้จ่ายดำเนินงานอื่น ๆ', level: 'main' },
  { id: 'cat-other', name: 'ค่าใช้จ่ายเบ็ดเตล็ด', level: 'sub', parentId: 'cat-main-other', parentName: 'ค่าใช้จ่ายดำเนินงานอื่น ๆ' },
];

export function getRelativeISODate(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getLastMonthISODate(dayOfMonth: number): string {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - 1);
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  const safeDay = Math.min(Math.max(1, dayOfMonth), lastDay);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(safeDay).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getRelativeTimestamp(daysAgo: number, hour = 10, minute = 30): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

function escapeXml(str: string): string {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function createMockReceiptSvgDataUrl(params: {
  vendorName: string;
  vendorTaxId?: string;
  receiptNumber: string;
  date: string;
  items: { itemName: string; quantity: number; amount: number }[];
  subtotal: number;
  vatAmount: number;
  grandTotal: number;
  docTitle?: string;
}): string {
  const title = escapeXml(params.docTitle || 'ใบกำกับภาษีอย่างย่อ / ใบเสร็จรับเงิน');
  const vendor = escapeXml(params.vendorName);
  const taxId = escapeXml(params.vendorTaxId || '0107544000011');
  const rcptNo = escapeXml(params.receiptNumber);
  const dateStr = escapeXml(params.date);
  const rows = params.items.slice(0, 4);

  const itemRowsSvg = rows
    .map((it, idx) => {
      const y = 215 + idx * 32;
      const name = escapeXml(it.itemName.length > 28 ? it.itemName.slice(0, 27) + '…' : it.itemName);
      const amt = it.amount.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      return `
        <text x="36" y="${y}" font-size="13" fill="#1e293b">${idx + 1}. ${name} (x${it.quantity})</text>
        <text x="384" y="${y}" font-size="13" fill="#0f172a" text-anchor="end" font-family="monospace">${amt}</text>
      `;
    })
    .join('');

  const footerBaseY = 230 + Math.max(rows.length, 1) * 32;
  const subStr = params.subtotal.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const vatStr = params.vatAmount.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const totalStr = params.grandTotal.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="420" height="520" viewBox="0 0 420 520">
  <rect width="420" height="520" fill="#f8fafc"/>
  <rect x="20" y="18" width="380" height="484" rx="10" fill="#ffffff" stroke="#cbd5e1" stroke-width="1.5"/>
  <rect x="20" y="18" width="380" height="58" rx="10" fill="#12304A"/>
  <rect x="20" y="64" width="380" height="12" fill="#12304A"/>
  <text x="210" y="46" font-size="14" font-weight="bold" fill="#ffffff" text-anchor="middle">${title}</text>
  <text x="210" y="65" font-size="11" fill="#99f6e4" text-anchor="middle">TAX INVOICE / RECEIPT</text>
  <text x="210" y="106" font-size="15" font-weight="bold" fill="#0f172a" text-anchor="middle">${vendor}</text>
  <text x="210" y="126" font-size="11" fill="#64748b" text-anchor="middle">เลขประจำตัวผู้เสียภาษี: ${taxId}</text>
  <line x1="36" y1="142" x2="384" y2="142" stroke="#e2e8f0" stroke-dasharray="4 3"/>
  <text x="36" y="164" font-size="12" fill="#475569">เลขที่เอกสาร: <tspan font-weight="bold" fill="#0f172a">${rcptNo}</tspan></text>
  <text x="384" y="164" font-size="12" fill="#475569" text-anchor="end">วันที่: <tspan font-weight="bold" fill="#0f172a">${dateStr}</tspan></text>
  <line x1="36" y1="180" x2="384" y2="180" stroke="#cbd5e1" stroke-width="1"/>
  <text x="36" y="197" font-size="11" font-weight="bold" fill="#64748b">รายการสินค้า / บริการ</text>
  <text x="384" y="197" font-size="11" font-weight="bold" fill="#64748b" text-anchor="end">จำนวนเงิน (฿)</text>
  ${itemRowsSvg}
  <line x1="36" y1="${footerBaseY}" x2="384" y2="${footerBaseY}" stroke="#cbd5e1" stroke-dasharray="4 3"/>
  <text x="36" y="${footerBaseY + 26}" font-size="12" fill="#475569">ยอดก่อนภาษีมูลค่าเพิ่ม (Subtotal)</text>
  <text x="384" y="${footerBaseY + 26}" font-size="12" fill="#0f172a" text-anchor="end" font-family="monospace">${subStr}</text>
  <text x="36" y="${footerBaseY + 48}" font-size="12" fill="#475569">ภาษีมูลค่าเพิ่ม 7% (VAT)</text>
  <text x="384" y="${footerBaseY + 48}" font-size="12" fill="#0f172a" text-anchor="end" font-family="monospace">${vatStr}</text>
  <rect x="36" y="${footerBaseY + 62}" width="348" height="36" rx="6" fill="#f0fdfa" stroke="#99f6e4"/>
  <text x="48" y="${footerBaseY + 85}" font-size="14" font-weight="bold" fill="#115e59">ยอดเงินสุทธิ (Grand Total)</text>
  <text x="372" y="${footerBaseY + 85}" font-size="15" font-weight="bold" fill="#0f766e" text-anchor="end" font-family="monospace">${totalStr} ฿</text>
  <text x="210" y="486" font-size="10" fill="#94a3b8" text-anchor="middle">เอกสารจำลองสำหรับโหมด Frontend UI Template</text>
</svg>`;

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export const MOCK_MASTER_ADMIN: AppUser = {
  uid: 'usr_master_auzza38',
  displayName: 'วรพล บริหารบัญชี (Master Admin)',
  email: 'auzza38@gmail.com',
  role: 'admin',
  status: 'active',
  assignedProjectIds: ['proj-101', 'proj-102', 'proj-103', 'proj-104'],
  createdAt: getRelativeTimestamp(90, 9, 0),
  lastLoginAt: getRelativeTimestamp(0, 8, 45),
};

export const INITIAL_MOCK_USERS: AppUser[] = [
  MOCK_MASTER_ADMIN,
  {
    uid: 'usr_admin_progressive',
    displayName: 'สุภาพร ตรวจสอบบัญชี (Co-Admin)',
    email: 'progressiveacc2564@gmail.com',
    role: 'admin',
    status: 'active',
    assignedProjectIds: ['proj-101', 'proj-102', 'proj-103', 'proj-104'],
    createdAt: getRelativeTimestamp(75, 9, 30),
    lastLoginAt: getRelativeTimestamp(1, 14, 20),
  },
  {
    uid: 'usr_staff_somchai',
    displayName: 'สมชาย ใจดี (ฝ่ายจัดซื้อโครงการ)',
    email: 'somchai@progressiveacc.co.th',
    role: 'user',
    status: 'active',
    assignedProjectIds: ['proj-101', 'proj-102', 'proj-103'],
    createdAt: getRelativeTimestamp(60, 10, 0),
    lastLoginAt: getRelativeTimestamp(0, 9, 15),
  },
  {
    uid: 'usr_staff_kanokwan',
    displayName: 'กนกวรรณ ศรีสุข (ฝ่ายบัญชี & การเงิน)',
    email: 'kanokwan@progressiveacc.co.th',
    role: 'user',
    status: 'active',
    assignedProjectIds: ['proj-101', 'proj-104'],
    createdAt: getRelativeTimestamp(45, 11, 15),
    lastLoginAt: getRelativeTimestamp(1, 16, 40),
  },
  {
    uid: 'usr_staff_nattapong',
    displayName: 'ณัฐพงษ์ รัตนวงศ์ (รออนุมัติสิทธิ์)',
    email: 'nattapong@progressiveacc.co.th',
    role: 'user',
    status: 'pending',
    assignedProjectIds: ['proj-102'],
    createdAt: getRelativeTimestamp(2, 13, 0),
    lastLoginAt: getRelativeTimestamp(2, 13, 5),
  },
];

export const INITIAL_MOCK_PROJECTS: Project[] = [
  {
    projectId: 'proj-101',
    projectCode: 'PRJ-101',
    clientName: 'โครงการพัฒนาระบบ ERP สำนักงานใหญ่',
    budget: 850000,
    assignedUsers: ['auzza38@gmail.com', 'somchai@progressiveacc.co.th', 'kanokwan@progressiveacc.co.th'],
    status: 'active',
    notes: 'โครงการหลักด้านเทคโนโลยีสารสนเทศ ฮาร์ดแวร์ คลาวด์ และค่าที่ปรึกษาระบบบัญชี',
    createdBy: 'usr_master_auzza38',
    createdAt: getRelativeTimestamp(60, 9, 0),
    updatedAt: getRelativeTimestamp(0, 9, 30),
  },
  {
    projectId: 'proj-102',
    projectCode: 'PRJ-102',
    clientName: 'โครงการปรับปรุงโครงสร้างเครือข่ายสาขา',
    budget: 420000,
    assignedUsers: ['auzza38@gmail.com', 'somchai@progressiveacc.co.th'],
    status: 'active',
    notes: 'ติดตั้งระบบอินเทอร์เน็ต อุปกรณ์เครือข่าย และค่าเดินทางสำรวจสาขาต่างจังหวัด',
    createdBy: 'usr_master_auzza38',
    createdAt: getRelativeTimestamp(45, 10, 0),
    updatedAt: getRelativeTimestamp(1, 15, 0),
  },
  {
    projectId: 'proj-103',
    projectCode: 'PRJ-103',
    clientName: 'โครงการซ่อมบำรุงอาคารและยานพาหนะ',
    budget: 280000,
    assignedUsers: ['auzza38@gmail.com', 'somchai@progressiveacc.co.th'],
    status: 'active',
    notes: 'ค่าน้ำมันเชื้อเพลิง ค่าทางด่วน ค่าบำรุงรักษาอาคาร และอุปกรณ์สำนักงาน',
    createdBy: 'usr_master_auzza38',
    createdAt: getRelativeTimestamp(35, 11, 0),
    updatedAt: getRelativeTimestamp(2, 11, 45),
  },
  {
    projectId: 'proj-104',
    projectCode: 'PRJ-104',
    clientName: 'งานที่ปรึกษาและตรวจสอบบัญชีประจำปี',
    budget: 350000,
    assignedUsers: ['auzza38@gmail.com', 'kanokwan@progressiveacc.co.th'],
    status: 'completed',
    notes: 'ค่าบริการสอบบัญชี ค่าที่ปรึกษาภาษี และค่าสาธารณูปโภคประจำสำนักงาน',
    createdBy: 'usr_master_auzza38',
    createdAt: getRelativeTimestamp(80, 9, 0),
    updatedAt: getRelativeTimestamp(10, 17, 0),
  },
];

export const INITIAL_MOCK_CATEGORIES: ExpenseCategory[] = DEFAULT_CATEGORIES.map((c) => ({
  categoryId: c.id,
  categoryName: c.name,
  level: c.level,
  parentId: c.parentId || null,
  parentName: c.parentName || null,
  isActive: true,
  createdAt: getRelativeTimestamp(90, 8, 0),
}));

function buildMockReceipt(
  partial: Omit<Receipt, 'receiptImageUrl' | 'createdAt' | 'updatedAt' | 'isDeleted'> & {
    daysAgoForCreated?: number;
  }
): Receipt {
  const createdTs = getRelativeTimestamp(partial.daysAgoForCreated ?? 0, 11, 20);
  const svgUrl = createMockReceiptSvgDataUrl({
    vendorName: partial.vendorName,
    vendorTaxId: partial.vendorTaxId,
    receiptNumber: partial.receiptNumber,
    date: partial.documentDate,
    items: partial.items,
    subtotal: partial.subtotal,
    vatAmount: partial.vatAmount,
    grandTotal: partial.grandTotal,
    docTitle: partial.documentType === 'tax_invoice' ? 'ใบกำกับภาษี / ใบเสร็จรับเงิน' : 'ใบเสร็จรับเงิน / บิลเงินสด',
  });

  const { daysAgoForCreated: _ignore, ...rest } = partial;
  return {
    ...rest,
    receiptImageUrl: svgUrl,
    createdAt: createdTs,
    updatedAt: createdTs,
    isDeleted: false,
  };
}

export const INITIAL_MOCK_RECEIPTS: Receipt[] = [
  buildMockReceipt({
    receiptId: 'rcpt_mock_01',
    projectId: 'proj-101',
    uploadedBy: 'usr_staff_somchai',
    uploadedByEmail: 'somchai@progressiveacc.co.th',
    documentType: 'tax_invoice',
    documentDate: getRelativeISODate(0),
    uploadDate: getRelativeISODate(0),
    receiptNumber: 'INV-69041201',
    vendorName: 'บริษัท แอดไวซ์ ไอที อินฟินิท จำกัด (มหาชน)',
    vendorTaxId: '0107566000018',
    vendorAddress: '74/1 หมู่ 1 ถ.ราชพฤกษ์ ต.ท่าอิฐ อ.ปากเกร็ด จ.นนทบุรี 11120',
    customerName: 'บริษัท โปรเกรสซีฟ แอคเคาท์ติ้ง จำกัด',
    customerTaxId: '0105564012345',
    customerAddress: '128 อาคารพญาไทพลาซ่า แขวงทุ่งพญาไท เขตราชเทวี กทม. 10400',
    categoryId: 'cat-hardware',
    subtotal: 32500,
    vatAmount: 2275,
    withholdingTax: 0,
    discount: 0,
    grandTotal: 34775,
    currency: 'THB',
    paymentMethod: 'โอนเงิน',
    ocrStatus: 'completed',
    verificationStatus: 'verified',
    approvalStatus: 'pending',
    isConfidential: false,
    notes: 'จัดซื้อจอ Monitor และอุปกรณ์สำรองไฟสำหรับทีมพัฒนา ERP',
    items: [
      { itemName: 'Dell UltraSharp 27" 4K Monitor', quantity: 2, unitPrice: 14500, amount: 29000, pageNumber: 1 },
      { itemName: 'APC Back-UPS 1100VA', quantity: 1, unitPrice: 3500, amount: 3500, pageNumber: 1 },
    ],
    totalPages: 1,
    daysAgoForCreated: 0,
  }),
  buildMockReceipt({
    receiptId: 'rcpt_mock_02',
    projectId: 'proj-103',
    uploadedBy: 'usr_staff_somchai',
    uploadedByEmail: 'somchai@progressiveacc.co.th',
    documentType: 'tax_invoice',
    documentDate: getRelativeISODate(0),
    uploadDate: getRelativeISODate(0),
    receiptNumber: 'PTT-2026-88412',
    vendorName: 'สถานีบริการน้ำมัน ปตท. (สาขาวิภาวดีรังสิต)',
    vendorTaxId: '0107561000013',
    vendorAddress: '555 ถ.วิภาวดีรังสิต แขวงจตุจักร เขตจตุจักร กทม. 10900',
    customerName: 'บริษัท โปรเกรสซีฟ แอคเคาท์ติ้ง จำกัด',
    customerTaxId: '0105564012345',
    categoryId: 'cat-fuel',
    subtotal: 1682.24,
    vatAmount: 117.76,
    withholdingTax: 0,
    discount: 0,
    grandTotal: 1800,
    currency: 'THB',
    paymentMethod: 'บัตรเครดิตบริษัท',
    ocrStatus: 'completed',
    verificationStatus: 'verified',
    approvalStatus: 'approved',
    approvedBy: 'auzza38@gmail.com',
    approvedAt: getRelativeTimestamp(0, 10, 5),
    isConfidential: false,
    notes: 'เติมน้ำมันรถตู้บริษัทเดินทางตรวจงานโครงการ',
    items: [
      { itemName: 'น้ำมันดีเซล B7 พรีเมียม (52.40 ลิตร)', quantity: 1, unitPrice: 1682.24, amount: 1682.24, pageNumber: 1 },
    ],
    totalPages: 1,
    daysAgoForCreated: 0,
  }),
  buildMockReceipt({
    receiptId: 'rcpt_mock_03',
    projectId: 'proj-102',
    uploadedBy: 'usr_staff_somchai',
    uploadedByEmail: 'somchai@progressiveacc.co.th',
    documentType: 'tax_invoice',
    documentDate: getRelativeISODate(1),
    uploadDate: getRelativeISODate(1),
    receiptNumber: 'CNT-69031109',
    vendorName: 'โรงแรมเซ็นทารา แกรนด์ แอท เซ็นทรัลพลาซา',
    vendorTaxId: '0107536001397',
    vendorAddress: '1695 ถ.พหลโยธิน แขวงจตุจักร เขตจตุจักร กทม. 10900',
    customerName: 'บริษัท โปรเกรสซีฟ แอคเคาท์ติ้ง จำกัด',
    customerTaxId: '0105564012345',
    categoryId: 'cat-hotel',
    subtotal: 6800,
    vatAmount: 476,
    withholdingTax: 0,
    discount: 0,
    grandTotal: 7276,
    currency: 'THB',
    paymentMethod: 'โอนเงิน',
    ocrStatus: 'completed',
    verificationStatus: 'verified',
    approvalStatus: 'approved',
    approvedBy: 'auzza38@gmail.com',
    approvedAt: getRelativeTimestamp(1, 16, 10),
    isConfidential: false,
    notes: 'ค่าที่พักทีมวิศวกรเครือข่าย 2 คืน',
    items: [
      { itemName: 'Deluxe Twin Room (2 คืน x 2 ห้อง)', quantity: 2, unitPrice: 3400, amount: 6800, pageNumber: 1 },
    ],
    totalPages: 1,
    daysAgoForCreated: 1,
  }),
  buildMockReceipt({
    receiptId: 'rcpt_mock_04',
    projectId: 'proj-101',
    uploadedBy: 'usr_staff_kanokwan',
    uploadedByEmail: 'kanokwan@progressiveacc.co.th',
    documentType: 'receipt',
    documentDate: getRelativeISODate(1),
    uploadDate: getRelativeISODate(1),
    receiptNumber: 'EXAT-049912',
    vendorName: 'การทางพิเศษแห่งประเทศไทย (Easy Pass)',
    vendorTaxId: '0994000160117',
    vendorAddress: '111 ถ.ริมคลองบางกะปิ แขวงบางกะปิ เขตห้วยขวาง กทม. 10310',
    categoryId: 'cat-toll',
    subtotal: 1000,
    vatAmount: 0,
    withholdingTax: 0,
    discount: 0,
    grandTotal: 1000,
    currency: 'THB',
    paymentMethod: 'โอนเงิน',
    ocrStatus: 'completed',
    verificationStatus: 'verified',
    approvalStatus: 'approved',
    approvedBy: 'auzza38@gmail.com',
    approvedAt: getRelativeTimestamp(1, 14, 0),
    isConfidential: false,
    notes: 'เติมเงินบัตร Easy Pass ประจำเดือน',
    items: [
      { itemName: 'เติมเงินบัตรผ่านทางอัตโนมัติ Easy Pass', quantity: 1, unitPrice: 1000, amount: 1000, pageNumber: 1 },
    ],
    totalPages: 1,
    daysAgoForCreated: 1,
  }),
  buildMockReceipt({
    receiptId: 'rcpt_mock_05',
    projectId: 'proj-103',
    uploadedBy: 'usr_staff_somchai',
    uploadedByEmail: 'somchai@progressiveacc.co.th',
    documentType: 'tax_invoice',
    documentDate: getRelativeISODate(2),
    uploadDate: getRelativeISODate(2),
    receiptNumber: 'HP-BKK-77401',
    vendorName: 'บริษัท โฮม โปรดักส์ เซ็นเตอร์ จำกัด (มหาชน)',
    vendorTaxId: '0107544000108',
    vendorAddress: '31 ถ.ประชาชื่น ต.บางเขน อ.เมืองนนทบุรี จ.นนทบุรี 11000',
    customerName: 'บริษัท โปรเกรสซีฟ แอคเคาท์ติ้ง จำกัด',
    customerTaxId: '0105564012345',
    categoryId: 'cat-supplies',
    subtotal: 4280,
    vatAmount: 299.6,
    withholdingTax: 0,
    discount: 0,
    grandTotal: 4579.6,
    currency: 'THB',
    paymentMethod: 'เงินสดย่อย',
    ocrStatus: 'completed',
    verificationStatus: 'needs_review',
    approvalStatus: 'pending',
    isConfidential: false,
    notes: 'กรุณาตรวจสอบรายละเอียดหลอดไฟ LED และปลั๊กพ่วงเพิ่มเติม',
    items: [
      { itemName: 'ชุดรางปลั๊กไฟอุตสาหกรรม 6 ช่อง', quantity: 4, unitPrice: 590, amount: 2360, pageNumber: 1 },
      { itemName: 'หลอดไฟ LED T8 Philips 18W', quantity: 12, unitPrice: 160, amount: 1920, pageNumber: 1 },
    ],
    totalPages: 1,
    daysAgoForCreated: 2,
  }),
  buildMockReceipt({
    receiptId: 'rcpt_mock_06',
    projectId: 'proj-102',
    uploadedBy: 'usr_staff_somchai',
    uploadedByEmail: 'somchai@progressiveacc.co.th',
    documentType: 'tax_invoice',
    documentDate: getRelativeISODate(3),
    uploadDate: getRelativeISODate(3),
    receiptNumber: 'AIS-CORP-90211',
    vendorName: 'บริษัท แอดวานซ์ ไวร์เลส เน็ทเวอร์ค จำกัด (AIS)',
    vendorTaxId: '0105548115897',
    vendorAddress: '414 ถ.พหลโยธิน แขวงสามเสนใน เขตพญาไท กทม. 10400',
    customerName: 'บริษัท โปรเกรสซีฟ แอคเคาท์ติ้ง จำกัด',
    customerTaxId: '0105564012345',
    categoryId: 'cat-telecom',
    subtotal: 8900,
    vatAmount: 623,
    withholdingTax: 0,
    discount: 0,
    grandTotal: 9523,
    currency: 'THB',
    paymentMethod: 'หักบัญชีอัตโนมัติ',
    ocrStatus: 'completed',
    verificationStatus: 'verified',
    approvalStatus: 'approved',
    approvedBy: 'auzza38@gmail.com',
    approvedAt: getRelativeTimestamp(3, 15, 45),
    isConfidential: false,
    notes: 'ค่าอินเทอร์เน็ต Leased Line & 5G Corporate สาขา',
    items: [
      { itemName: 'AIS Fibre Corporate 1Gbps/1Gbps', quantity: 1, unitPrice: 5900, amount: 5900, pageNumber: 1 },
      { itemName: 'แพ็กเกจ 5G ทีมภาคสนาม (6 เบอร์)', quantity: 6, unitPrice: 500, amount: 3000, pageNumber: 1 },
    ],
    totalPages: 1,
    daysAgoForCreated: 3,
  }),
  buildMockReceipt({
    receiptId: 'rcpt_mock_07',
    projectId: 'proj-101',
    uploadedBy: 'usr_staff_kanokwan',
    uploadedByEmail: 'kanokwan@progressiveacc.co.th',
    documentType: 'tax_invoice',
    documentDate: getRelativeISODate(4),
    uploadDate: getRelativeISODate(4),
    receiptNumber: 'KPMG-ADV-2604',
    vendorName: 'สำนักงานที่ปรึกษากฎหมายและบัญชี ธรรมนิติ',
    vendorTaxId: '0105535123456',
    vendorAddress: '178 ถ.วิภาวดีรังสิต แขวงจตุจักร เขตจตุจักร กทม. 10900',
    customerName: 'บริษัท โปรเกรสซีฟ แอคเคาท์ติ้ง จำกัด',
    customerTaxId: '0105564012345',
    categoryId: 'cat-consultant',
    subtotal: 25000,
    vatAmount: 1750,
    withholdingTax: 750,
    discount: 0,
    grandTotal: 26000,
    currency: 'THB',
    paymentMethod: 'โอนเงิน',
    ocrStatus: 'completed',
    verificationStatus: 'verified',
    approvalStatus: 'pending',
    isConfidential: false,
    notes: 'ค่าที่ปรึกษาวางระบบผังบัญชีและภาษีหัก ณ ที่จ่าย 3% (WHT 750 ฿)',
    items: [
      { itemName: 'ค่าบริการที่ปรึกษาออกแบบโครงสร้างบัญชี ERP งวดที่ 1', quantity: 1, unitPrice: 25000, amount: 25000, pageNumber: 1 },
    ],
    totalPages: 1,
    daysAgoForCreated: 4,
  }),
  buildMockReceipt({
    receiptId: 'rcpt_mock_08',
    projectId: 'proj-101',
    uploadedBy: 'usr_staff_somchai',
    uploadedByEmail: 'somchai@progressiveacc.co.th',
    documentType: 'receipt',
    documentDate: getRelativeISODate(5),
    uploadDate: getRelativeISODate(5),
    receiptNumber: 'CPALL-771029',
    vendorName: 'ร้าน เซเว่น อีเลฟเว่น (สาขาอาคารพญาไท)',
    vendorTaxId: '0107542000011',
    vendorAddress: '128 อาคารพญาไทพลาซ่า เขตราชเทวี กทม. 10400',
    categoryId: 'cat-food',
    subtotal: 644.86,
    vatAmount: 45.14,
    withholdingTax: 0,
    discount: 0,
    grandTotal: 690,
    currency: 'THB',
    paymentMethod: 'เงินสดย่อย',
    ocrStatus: 'completed',
    verificationStatus: 'verified',
    approvalStatus: 'approved',
    approvedBy: 'progressiveacc2564@gmail.com',
    approvedAt: getRelativeTimestamp(5, 17, 15),
    isConfidential: false,
    notes: 'เครื่องดื่มและของว่างประชุมทีมประจำสัปดาห์',
    items: [
      { itemName: 'กาแฟสด All Cafe (10 แก้ว)', quantity: 10, unitPrice: 45, amount: 450, pageNumber: 1 },
      { itemName: 'เบเกอรี่และน้ำดื่มแพ็ก', quantity: 1, unitPrice: 194.86, amount: 194.86, pageNumber: 1 },
    ],
    totalPages: 1,
    daysAgoForCreated: 5,
  }),
  buildMockReceipt({
    receiptId: 'rcpt_mock_09',
    projectId: 'proj-103',
    uploadedBy: 'usr_staff_kanokwan',
    uploadedByEmail: 'kanokwan@progressiveacc.co.th',
    documentType: 'tax_invoice',
    documentDate: getRelativeISODate(7),
    uploadDate: getRelativeISODate(7),
    receiptNumber: 'MEA-6904-8821',
    vendorName: 'การไฟฟ้านครหลวง (MEA)',
    vendorTaxId: '0994000165526',
    vendorAddress: '30 ซ.ชิดลม ถ.เพลินจิต แขวงลุมพินี เขตปทุมวัน กทม. 10330',
    customerName: 'บริษัท โปรเกรสซีฟ แอคเคาท์ติ้ง จำกัด',
    customerTaxId: '0105564012345',
    categoryId: 'cat-utilities',
    subtotal: 11200,
    vatAmount: 784,
    withholdingTax: 0,
    discount: 0,
    grandTotal: 11984,
    currency: 'THB',
    paymentMethod: 'หักบัญชีอัตโนมัติ',
    ocrStatus: 'completed',
    verificationStatus: 'verified',
    approvalStatus: 'approved',
    approvedBy: 'auzza38@gmail.com',
    approvedAt: getRelativeTimestamp(6, 9, 20),
    isConfidential: false,
    notes: 'ค่าไฟฟ้าประจำเดือนอาคารสำนักงาน',
    items: [
      { itemName: 'ค่าพลังงานไฟฟ้า + ค่า Ft ประจำงวด', quantity: 1, unitPrice: 11200, amount: 11200, pageNumber: 1 },
    ],
    totalPages: 1,
    daysAgoForCreated: 7,
  }),
  buildMockReceipt({
    receiptId: 'rcpt_mock_10',
    projectId: 'proj-102',
    uploadedBy: 'usr_staff_somchai',
    uploadedByEmail: 'somchai@progressiveacc.co.th',
    documentType: 'tax_invoice',
    documentDate: getRelativeISODate(9),
    uploadDate: getRelativeISODate(9),
    receiptNumber: 'JIB-2026-4120',
    vendorName: 'บริษัท เจ.ไอ.บี. คอมพิวเตอร์ กรุ๊ป จำกัด',
    vendorTaxId: '0105544098765',
    vendorAddress: '21 ถ.พหลโยธิน แขวงสนามบิน เขตดอนเมือง กทม. 10210',
    customerName: 'บริษัท โปรเกรสซีฟ แอคเคาท์ติ้ง จำกัด',
    customerTaxId: '0105564012345',
    categoryId: 'cat-hardware',
    subtotal: 18500,
    vatAmount: 1295,
    withholdingTax: 0,
    discount: 500,
    grandTotal: 19295,
    currency: 'THB',
    paymentMethod: 'โอนเงิน',
    ocrStatus: 'completed',
    verificationStatus: 'verified',
    approvalStatus: 'rejected',
    approvedBy: 'auzza38@gmail.com',
    approvedAt: getRelativeTimestamp(8, 11, 30),
    isConfidential: false,
    notes: 'ไม่อนุมัติ: รอแนบใบสั่งซื้อ (PO) ประกอบการเบิกจ่าย',
    items: [
      { itemName: 'MikroTik Cloud Core Router CCR2004', quantity: 1, unitPrice: 18500, amount: 18500, pageNumber: 1 },
    ],
    totalPages: 1,
    daysAgoForCreated: 9,
  }),
  buildMockReceipt({
    receiptId: 'rcpt_mock_11',
    projectId: 'proj-104',
    uploadedBy: 'usr_staff_kanokwan',
    uploadedByEmail: 'kanokwan@progressiveacc.co.th',
    documentType: 'tax_invoice',
    documentDate: getLastMonthISODate(18),
    uploadDate: getLastMonthISODate(18),
    receiptNumber: 'OFM-2603-5520',
    vendorName: 'บริษัท ซีโอแอล จำกัด (มหาชน) - OfficeMate',
    vendorTaxId: '0107556000442',
    vendorAddress: '24 ถ.พระราม 9 แขวงห้วยขวาง เขตห้วยขวาง กทม. 10310',
    customerName: 'บริษัท โปรเกรสซีฟ แอคเคาท์ติ้ง จำกัด',
    customerTaxId: '0105564012345',
    categoryId: 'cat-supplies',
    subtotal: 5400,
    vatAmount: 378,
    withholdingTax: 0,
    discount: 0,
    grandTotal: 5778,
    currency: 'THB',
    paymentMethod: 'โอนเงิน',
    ocrStatus: 'completed',
    verificationStatus: 'verified',
    approvalStatus: 'approved',
    approvedBy: 'auzza38@gmail.com',
    approvedAt: getRelativeTimestamp(25, 10, 0),
    isConfidential: false,
    notes: 'กระดาษถ่ายเอกสาร A4 แฟ้มเอกสาร และหมึกพิมพ์สำหรับฝ่ายสอบบัญชี',
    items: [
      { itemName: 'กระดาษ Double A 80 แกรม (10 กล่อง)', quantity: 10, unitPrice: 480, amount: 4800, pageNumber: 1 },
      { itemName: 'แฟ้มสันกว้างตราช้าง (12 เล่ม)', quantity: 12, unitPrice: 50, amount: 600, pageNumber: 1 },
    ],
    totalPages: 1,
    daysAgoForCreated: 25,
  }),
  buildMockReceipt({
    receiptId: 'rcpt_mock_12',
    projectId: 'proj-104',
    uploadedBy: 'usr_staff_kanokwan',
    uploadedByEmail: 'kanokwan@progressiveacc.co.th',
    documentType: 'other',
    documentDate: getLastMonthISODate(24),
    uploadDate: getLastMonthISODate(24),
    receiptNumber: 'GRAB-TH-3391',
    vendorName: 'Grab Thailand (ค่าเดินทางส่งเอกสาร)',
    vendorTaxId: '0105556087855',
    categoryId: 'cat-fare',
    subtotal: 420,
    vatAmount: 0,
    withholdingTax: 0,
    discount: 0,
    grandTotal: 420,
    currency: 'THB',
    paymentMethod: 'เงินสดย่อย',
    ocrStatus: 'completed',
    verificationStatus: 'draft',
    approvalStatus: 'draft',
    isConfidential: false,
    notes: 'ฉบับร่าง: รอแนบรายละเอียดผู้รับเอกสารเพิ่มเติม',
    items: [
      { itemName: 'บริการ GrabExpress ส่งเอกสารปิดงบการเงิน', quantity: 1, unitPrice: 420, amount: 420, pageNumber: 1 },
    ],
    totalPages: 1,
    daysAgoForCreated: 20,
  }),
];

export const INITIAL_MOCK_BANK_ACCOUNTS: BankAccount[] = [
  {
    id: 'acc_kbank_01',
    accountNumber: '048-2-91847-3',
    bankName: 'ธนาคารกสิกรไทย',
    bankCode: 'KBANK',
    accountName: 'บจก. โปรเกรสซีฟ แอคเคาท์ติ้ง (กระแสรายวัน)',
    branchName: 'พญาไท',
    assetType: 'current',
    currentBalance: 1485200.5,
    availableBalance: 1485200.5,
    currency: 'THB',
    projectId: 'proj-101',
    projectName: 'PRJ-101 - โครงการพัฒนาระบบ ERP สำนักงานใหญ่',
    lastUpdatedDate: getRelativeISODate(0),
    notes: 'บัญชีหลักสำหรับรับชำระงวดงานและจ่ายค่าใช้จ่ายโครงการ ERP',
    statementCount: 1,
    createdAt: getRelativeTimestamp(60, 9, 0),
    updatedAt: getRelativeTimestamp(0, 9, 0),
    createdBy: 'usr_master_auzza38',
  },
  {
    id: 'acc_scb_02',
    accountNumber: '111-4-50291-8',
    bankName: 'ธนาคารไทยพาณิชย์',
    bankCode: 'SCB',
    accountName: 'บจก. โปรเกรสซีฟ แอคเคาท์ติ้ง (ออมทรัพย์โครงการเครือข่าย)',
    branchName: 'จตุจักร',
    assetType: 'savings',
    currentBalance: 642850.0,
    availableBalance: 642850.0,
    currency: 'THB',
    projectId: 'proj-102',
    projectName: 'PRJ-102 - โครงการปรับปรุงโครงสร้างเครือข่ายสาขา',
    lastUpdatedDate: getRelativeISODate(1),
    notes: 'บัญชีรองรับงานวางระบบเครือข่ายและค่าใช้จ่ายภาคสนาม',
    statementCount: 1,
    createdAt: getRelativeTimestamp(45, 10, 0),
    updatedAt: getRelativeTimestamp(1, 16, 0),
    createdBy: 'usr_master_auzza38',
  },
  {
    id: 'acc_bbl_03',
    accountNumber: '201-0-88312-5',
    bankName: 'ธนาคารกรุงเทพ',
    bankCode: 'BBL',
    accountName: 'บจก. โปรเกรสซีฟ แอคเคาท์ติ้ง (บัญชีกลางบริษัท)',
    branchName: 'สีลม',
    assetType: 'savings',
    currentBalance: 920400.0,
    availableBalance: 920400.0,
    currency: 'THB',
    projectId: '',
    projectName: '',
    lastUpdatedDate: getRelativeISODate(2),
    notes: 'บัญชีเงินทุนหมุนเวียนส่วนกลางของกิจการ',
    statementCount: 1,
    createdAt: getRelativeTimestamp(90, 9, 0),
    updatedAt: getRelativeTimestamp(2, 12, 0),
    createdBy: 'usr_master_auzza38',
  },
  {
    id: 'acc_cash_04',
    accountNumber: 'PETTY-001',
    bankName: 'เงินสดในมือ / เงินสดย่อย',
    bankCode: 'CASH',
    accountName: 'วงเงินสดย่อยสำนักงานใหญ่ (Petty Cash)',
    branchName: 'สำนักงานใหญ่',
    assetType: 'petty_cash',
    currentBalance: 38500.0,
    availableBalance: 38500.0,
    currency: 'THB',
    projectId: 'proj-103',
    projectName: 'PRJ-103 - โครงการซ่อมบำรุงอาคารและยานพาหนะ',
    lastUpdatedDate: getRelativeISODate(0),
    notes: 'สำหรับเบิกจ่ายค่าทางด่วน ค่าน้ำมัน และวัสดุเร่งด่วน',
    statementCount: 0,
    createdAt: getRelativeTimestamp(60, 9, 0),
    updatedAt: getRelativeTimestamp(0, 8, 30),
    createdBy: 'usr_master_auzza38',
  },
];

function createPreNormalizedStatement(params: {
  id: string;
  accountId: string;
  accountNumber: string;
  bankName: string;
  accountName: string;
  projectId: string;
  projectName: string;
  statementPeriodStart: string;
  statementPeriodEnd: string;
  openingBalance: number;
  closingBalance: number;
  fileName: string;
  daysAgoUploaded: number;
  rawOcrSummary: string;
  transactions: any[];
}): StatementRecord {
  const normalizedTxs = normalizeStatementTransactionsList(params.transactions, params.openingBalance).map((tx) => ({
    ...tx,
    projectId: params.projectId || '',
    projectName: params.projectName || '',
  }));

  const totalDebit = Math.round(normalizedTxs.reduce((s, t) => s + (t.debitAmount || 0), 0) * 100) / 100;
  const totalCredit = Math.round(normalizedTxs.reduce((s, t) => s + (t.creditAmount || 0), 0) * 100) / 100;

  return {
    id: params.id,
    accountId: params.accountId,
    accountNumber: params.accountNumber,
    bankName: params.bankName,
    accountName: params.accountName,
    projectId: params.projectId,
    projectName: params.projectName,
    statementPeriodStart: params.statementPeriodStart,
    statementPeriodEnd: params.statementPeriodEnd,
    openingBalance: params.openingBalance,
    closingBalance: params.closingBalance,
    totalDebit,
    totalCredit,
    transactions: normalizedTxs,
    fileName: params.fileName,
    uploadedAt: getRelativeTimestamp(params.daysAgoUploaded, 14, 15),
    uploadedBy: 'usr_master_auzza38',
    uploadedByEmail: 'auzza38@gmail.com',
    rawOcrSummary: params.rawOcrSummary,
  };
}

export const INITIAL_MOCK_STATEMENT_RECORDS: StatementRecord[] = [
  createPreNormalizedStatement({
    id: 'stmt_kbank_01',
    accountId: 'acc_kbank_01',
    accountNumber: '048-2-91847-3',
    bankName: 'ธนาคารกสิกรไทย',
    accountName: 'บจก. โปรเกรสซีฟ แอคเคาท์ติ้ง (กระแสรายวัน)',
    projectId: 'proj-101',
    projectName: 'PRJ-101 - โครงการพัฒนาระบบ ERP สำนักงานใหญ่',
    statementPeriodStart: getRelativeISODate(15),
    statementPeriodEnd: getRelativeISODate(0),
    openingBalance: 1265975.5,
    closingBalance: 1485200.5,
    fileName: 'KBANK_Statement_ERP_Current.pdf',
    daysAgoUploaded: 0,
    rawOcrSummary: 'นำเข้ารายการเดินบัญชีธนาคารกสิกรไทยครบถ้วน 5 รายการ',
    transactions: [
      {
        id: 'tx_kb_1',
        date: getRelativeISODate(12),
        time: '09:15:22',
        description: 'รับโอนเงินค่าจ้างงวดที่ 2 โครงการ ERP',
        channel: 'K PLUS SME',
        creditAmount: 280000,
        debitAmount: 0,
        balance: 1545975.5,
        referenceNo: 'KB260412019',
      },
      {
        id: 'tx_kb_2',
        date: getRelativeISODate(4),
        time: '13:42:10',
        description: 'โอนเงินชำระค่าที่ปรึกษา ธรรมนิติ',
        channel: 'K-Cash Connect',
        creditAmount: 0,
        debitAmount: 26000,
        balance: 1519975.5,
        referenceNo: 'KB260418442',
      },
      {
        id: 'tx_kb_3',
        date: getRelativeISODate(0),
        time: '10:08:45',
        description: 'โอนเงินชำระค่าอุปกรณ์ไอที แอดไวซ์ ไอที',
        channel: 'K PLUS SME',
        creditAmount: 0,
        debitAmount: 34775,
        balance: 1485200.5,
        referenceNo: 'KB260422091',
      },
    ],
  }),
  createPreNormalizedStatement({
    id: 'stmt_scb_02',
    accountId: 'acc_scb_02',
    accountNumber: '111-4-50291-8',
    bankName: 'ธนาคารไทยพาณิชย์',
    accountName: 'บจก. โปรเกรสซีฟ แอคเคาท์ติ้ง (ออมทรัพย์โครงการเครือข่าย)',
    projectId: 'proj-102',
    projectName: 'PRJ-102 - โครงการปรับปรุงโครงสร้างเครือข่ายสาขา',
    statementPeriodStart: getRelativeISODate(14),
    statementPeriodEnd: getRelativeISODate(1),
    openingBalance: 514649.0,
    closingBalance: 642850.0,
    fileName: 'SCB_Statement_Network_Project.pdf',
    daysAgoUploaded: 1,
    rawOcrSummary: 'นำเข้ารายการเดินบัญชีธนาคารไทยพาณิชย์ครบถ้วน 3 รายการ',
    transactions: [
      {
        id: 'tx_scb_1',
        date: getRelativeISODate(6),
        time: '11:20:05',
        description: 'รับโอนเงินมัดจำงานวางระบบเครือข่ายสาขา',
        channel: 'SCB Business Net',
        creditAmount: 145000,
        debitAmount: 0,
        balance: 659649.0,
        referenceNo: 'SCB26041188',
      },
      {
        id: 'tx_scb_2',
        date: getRelativeISODate(3),
        time: '14:05:30',
        description: 'หักบัญชีอัตโนมัติ ค่าอินเทอร์เน็ต AIS Business',
        channel: 'Direct Debit',
        creditAmount: 0,
        debitAmount: 9523,
        balance: 650126.0,
        referenceNo: 'SCB26041522',
      },
      {
        id: 'tx_scb_3',
        date: getRelativeISODate(1),
        time: '16:50:12',
        description: 'โอนเงินชำระค่าที่พักโรงแรมเซ็นทารา',
        channel: 'SCB Easy',
        creditAmount: 0,
        debitAmount: 7276,
        balance: 642850.0,
        referenceNo: 'SCB26042009',
      },
    ],
  }),
  createPreNormalizedStatement({
    id: 'stmt_bbl_03',
    accountId: 'acc_bbl_03',
    accountNumber: '201-0-88312-5',
    bankName: 'ธนาคารกรุงเทพ',
    accountName: 'บจก. โปรเกรสซีฟ แอคเคาท์ติ้ง (บัญชีกลางบริษัท)',
    projectId: '',
    projectName: '',
    statementPeriodStart: getRelativeISODate(20),
    statementPeriodEnd: getRelativeISODate(2),
    openingBalance: 842384.0,
    closingBalance: 920400.0,
    fileName: 'BBL_Corporate_Statement.pdf',
    daysAgoUploaded: 2,
    rawOcrSummary: 'นำเข้ารายการเดินบัญชีธนาคารกรุงเทพ (บัญชีกลาง)',
    transactions: [
      {
        id: 'tx_bbl_1',
        date: getRelativeISODate(10),
        time: '10:30:00',
        description: 'รับชำระค่าบริการที่ปรึกษาบัญชีรายปี',
        channel: 'Bualuang iBanking',
        creditAmount: 90000,
        debitAmount: 0,
        balance: 932384.0,
        referenceNo: 'BBL9901234',
      },
      {
        id: 'tx_bbl_2',
        date: getRelativeISODate(7),
        time: '09:00:15',
        description: 'หักบัญชีอัตโนมัติ ค่าไฟฟ้าการไฟฟ้านครหลวง (MEA)',
        channel: 'ATS Direct Debit',
        creditAmount: 0,
        debitAmount: 11984,
        balance: 920400.0,
        referenceNo: 'BBL9901891',
      },
    ],
  }),
];

export const INITIAL_MOCK_AUDIT_LOGS: AuditLog[] = [
  {
    logId: 'log_mock_01',
    userId: 'usr_master_auzza38',
    userEmail: 'auzza38@gmail.com',
    action: 'Receipt APPROVED',
    entityType: 'receipt',
    entityId: 'rcpt_mock_02',
    changes: 'Master Admin auzza38@gmail.com อนุมัติใบเสร็จ PTT-2026-88412 ยอด 1,800.00 THB',
    timestamp: getRelativeTimestamp(0, 10, 5),
  },
  {
    logId: 'log_mock_02',
    userId: 'usr_staff_somchai',
    userEmail: 'somchai@progressiveacc.co.th',
    action: 'Create Receipt',
    entityType: 'receipt',
    entityId: 'rcpt_mock_01',
    changes: 'Receipt INV-69041201 ร้าน แอดไวซ์ ไอที อินฟินิท ยอด 34,775.00 THB',
    timestamp: getRelativeTimestamp(0, 9, 45),
  },
  {
    logId: 'log_mock_03',
    userId: 'usr_master_auzza38',
    userEmail: 'auzza38@gmail.com',
    action: 'Upload Bank Statement',
    entityType: 'auth',
    entityId: 'stmt_kbank_01',
    changes: 'นำเข้า Statement ธนาคารกสิกรไทย (048-2-91847-3) 3 รายการ ยอดคงเหลือ 1,485,200.50 THB',
    timestamp: getRelativeTimestamp(0, 9, 15),
  },
  {
    logId: 'log_mock_04',
    userId: 'usr_master_auzza38',
    userEmail: 'auzza38@gmail.com',
    action: 'Receipt APPROVED',
    entityType: 'receipt',
    entityId: 'rcpt_mock_03',
    changes: 'Master Admin อนุมัติใบเสร็จ CNT-69031109 (โรงแรมเซ็นทารา) ยอด 7,276.00 THB',
    timestamp: getRelativeTimestamp(1, 16, 10),
  },
  {
    logId: 'log_mock_05',
    userId: 'usr_master_auzza38',
    userEmail: 'auzza38@gmail.com',
    action: 'Receipt REJECTED',
    entityType: 'receipt',
    entityId: 'rcpt_mock_10',
    changes: 'ไม่อนุมัติใบเสร็จ JIB-2026-4120 (Note: รอแนบใบสั่งซื้อ PO ประกอบการเบิกจ่าย)',
    timestamp: getRelativeTimestamp(8, 11, 30),
  },
  {
    logId: 'log_mock_06',
    userId: 'usr_master_auzza38',
    userEmail: 'auzza38@gmail.com',
    action: 'Create Project',
    entityType: 'project',
    entityId: 'proj-101',
    changes: 'สร้างโครงการ PRJ-101: โครงการพัฒนาระบบ ERP สำนักงานใหญ่ งบประมาณ 850,000 THB',
    timestamp: getRelativeTimestamp(60, 9, 0),
  },
];
