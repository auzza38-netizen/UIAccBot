export type UserRole = 'admin' | 'user';
export type UserStatus = 'pending' | 'active' | 'suspended';

export interface AppUser {
  uid: string;
  displayName: string;
  email: string;
  position?: string;
  department?: string;
  phone?: string;
  role: UserRole;
  status: UserStatus;
  assignedProjectIds: string[];
  createdAt: string;
  lastLoginAt: string;
}

export type ProjectStatus = 'active' | 'completed' | 'archived';

export interface Project {
  projectId: string;
  projectCode: string;
  clientName: string; // ชื่อลูกค้า หรือ หน่วยงาน
  budget?: number;
  assignedUsers: string[]; // user emails or uids
  status: ProjectStatus;
  notes?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface ReceiptItem {
  itemName: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  pageNumber?: number; // หน้าที่ตรวจพบรายการในเอกสาร PDF
}

export interface PDFPageBreakdown {
  pageNumber: number;
  pageTitle?: string;
  receiptNumber?: string;
  vendorName?: string;
  vendorTaxId?: string;
  vendorAddress?: string;
  customerName?: string;
  customerTaxId?: string;
  customerAddress?: string;
  documentDate?: string;
  subtotal?: number;
  vatAmount?: number;
  grandTotal?: number;
  items: ReceiptItem[];
}

export type DocumentType = 'receipt' | 'tax_invoice' | 'other';
export type OCRStatus = 'completed' | 'skipped' | 'failed' | 'pending';
export type VerificationStatus = 'draft' | 'needs_review' | 'verified';
export type ApprovalStatus = 'draft' | 'pending' | 'approved' | 'rejected';

export interface Receipt {
  receiptId: string;
  projectId: string;
  uploadedBy: string;
  uploadedByEmail: string;
  documentType: DocumentType;
  documentDate: string; // ISO YYYY-MM-DD
  uploadDate: string; // ISO YYYY-MM-DD
  receiptNumber: string;
  vendorName: string;
  vendorTaxId?: string;
  vendorAddress?: string; // ที่อยู่ผู้ขาย / ร้านค้า
  customerName?: string; // ชื่อลูกค้า / ผู้ซื้อ (ตามบิล)
  customerTaxId?: string; // เลขประจำตัวผู้เสียภาษีผู้ซื้อ (ตามบิล)
  customerAddress?: string; // ที่อยู่ลูกค้า / ผู้ซื้อ (ตามบิล)
  categoryId: string;
  subtotal: number;
  vatAmount: number;
  withholdingTax: number;
  discount: number;
  grandTotal: number;
  currency: string;
  paymentMethod?: string;
  receiptImagePath?: string;
  receiptImageUrl?: string;
  imageHash?: string;
  ocrStatus: OCRStatus;
  verificationStatus: VerificationStatus;
  approvalStatus: ApprovalStatus;
  isConfidential: boolean;
  notes?: string;
  items: ReceiptItem[];
  totalPages?: number;
  pdfPages?: PDFPageBreakdown[]; // แยกรายการและสรุปยอดตามแต่ละหน้า
  createdAt: string;
  updatedAt: string;
  approvedBy?: string;
  approvedAt?: string;
  isDeleted?: boolean;
}

export interface ExpenseCategory {
  categoryId: string;
  categoryName: string;
  parentId?: string | null; // ID ของหมวดหมู่หลัก (กรณีเป็นหมวดหมู่ย่อย)
  parentName?: string | null; // ชื่อหมวดหมู่หลัก
  level?: 'main' | 'sub'; // 'main' = หมวดหมู่หลัก, 'sub' = หมวดหมู่ย่อย
  isActive: boolean;
  createdAt: string;
}

// สินทรัพย์หมุนเวียน (Current Assets / Bank Accounts)
export type AssetType =
  | 'savings' // บัญชีเงินฝากออมทรัพย์
  | 'current' // บัญชีเงินฝากกระแสรายวัน
  | 'fixed' // บัญชีเงินฝากประจำ
  | 'petty_cash' // เงินสดย่อย / เงินสดในมือ
  | 'other'; // สินทรัพย์หมุนเวียนอื่น ๆ

export interface BankAccount {
  id: string; // Document ID
  accountNumber: string; // เลขที่บัญชี เช่น 123-4-56789-0
  bankName: string; // ชื่อธนาคาร เช่น กสิกรไทย, ไทยพาณิชย์, กรุงเทพ
  bankCode?: string; // KBANK, SCB, BBL, KTB, BAY, TTB, GSB, etc.
  accountName: string; // ชื่อบัญชี เช่น บจก. โปรเกรสซีฟ แอคเคาท์ติ้ง
  branchName?: string; // สาขา
  assetType: AssetType; // ประเภทสินทรัพย์หมุนเวียน
  currentBalance: number; // ยอดคงเหลือปัจจุบัน
  availableBalance?: number; // ยอดคงเหลือที่ใช้ได้
  currency: string; // THB
  projectId?: string; // โครงการที่ผูกกับสินทรัพย์/บัญชีนี้ (ถ้ามี หรือ undefined สำหรับส่วนกลาง)
  projectName?: string; // ชื่อโครงการ (แคชไว้แสดงผล)
  lastUpdatedDate: string; // วันที่อัปเดตล่าสุด
  notes?: string;
  statementCount?: number; // จำนวนไฟล์ Statement ที่นำเข้า
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

export interface StatementTransaction {
  id: string;
  date: string; // ISO YYYY-MM-DD
  time?: string; // HH:mm:ss
  description: string; // รายละเอียด / ช่องทาง / บันทึก
  channel?: string; // ช่องทาง เช่น PromptPay, Mobile App, ATM, Counter
  debitAmount?: number; // เงินออก / ถอนเงิน (Debit)
  creditAmount?: number; // เงินเข้า / ฝากเงิน (Credit)
  balance: number; // ยอดเงินคงเหลือ
  referenceNo?: string; // เลขที่อ้างอิง
  category?: string; // หมวดหมู่เชื่อมโยง (ถ้ามี)
  projectId?: string; // โครงการสำหรับรายการนี้ (แยกตามรายการได้)
  projectName?: string;
  notes?: string;
  sourcePage?: number; // หน้าที่พบในเอกสาร Statement
}

export interface StatementRecord {
  id: string;
  accountId: string; // บัญชีธนาคารที่ผูก
  accountNumber: string;
  bankName: string;
  accountName?: string;
  projectId?: string; // โครงการที่ผูกกับ Statement ฉบับนี้
  projectName?: string;
  statementPeriodStart?: string;
  statementPeriodEnd?: string;
  openingBalance: number; // ยอดยกมา
  closingBalance: number; // ยอดคงเหลือยกไป
  totalDebit: number; // รวมเงินออก (ถอน)
  totalCredit: number; // รวมเงินเข้า (ฝาก)
  transactions: StatementTransaction[];
  fileName?: string;
  uploadedAt: string;
  uploadedBy: string;
  uploadedByEmail: string;
  rawOcrSummary?: string;
  notes?: string;
}

export interface AuditLog {
  logId: string;
  userId: string;
  userEmail: string;
  action: string;
  entityType: 'receipt' | 'project' | 'user' | 'category' | 'bankAccount' | 'statement' | 'auth';
  entityId: string;
  changes: string;
  timestamp: string;
}

export type DateFilterPreset = 'today' | 'yesterday' | 'this_week' | 'this_month' | 'last_month' | 'all' | 'custom';

export interface DashboardFilters {
  datePreset: DateFilterPreset;
  startDate: string;
  endDate: string;
  projectId: string;
  categoryId: string;
  uploadedBy: string;
  vendor: string;
  verificationStatus: string;
  approvalStatus: string;
  groupByDate: 'documentDate' | 'uploadDate';
}
