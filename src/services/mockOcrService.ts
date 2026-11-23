import { getRelativeISODate } from '../data/mockData';

let mockReceiptScanCounter = 0;

interface MockOcrTemplate {
  documentType: 'receipt' | 'tax_invoice' | 'other';
  vendorName: string;
  vendorTaxId: string;
  vendorAddress: string;
  customerName: string;
  customerTaxId: string;
  customerAddress: string;
  paymentMethod: string;
  suggestedCategory: string;
  subtotal: number;
  vatAmount: number;
  withholdingTax: number;
  discount: number;
  grandTotal: number;
  items: { itemName: string; quantity: number; unitPrice: number; amount: number; pageNumber: number }[];
  ocrNotes: string;
}

const RECEIPT_TEMPLATES: MockOcrTemplate[] = [
  {
    documentType: 'tax_invoice',
    vendorName: 'บริษัท ออฟฟิศเมท (ไทย) จำกัด',
    vendorTaxId: '0105558012349',
    vendorAddress: '24 ถ.พระราม 9 แขวงห้วยขวาง เขตห้วยขวาง กรุงเทพฯ 10310',
    customerName: 'บริษัท โปรเกรสซีฟ แอคเคาท์ติ้ง จำกัด',
    customerTaxId: '0105564012345',
    customerAddress: '128 อาคารพญาไทพลาซ่า เขตราชเทวี กรุงเทพฯ 10400',
    paymentMethod: 'โอนเงิน',
    suggestedCategory: 'ค่าวัสดุสิ้นเปลือง',
    subtotal: 2400,
    vatAmount: 168,
    withholdingTax: 0,
    discount: 0,
    grandTotal: 2568,
    items: [
      { itemName: 'กระดาษถ่ายเอกสาร A4 Double A (5 รีม)', quantity: 5, unitPrice: 130, amount: 650, pageNumber: 1 },
      { itemName: 'ตลับหมึกเลเซอร์ปริ้นเตอร์ HP 150A', quantity: 1, unitPrice: 1750, amount: 1750, pageNumber: 1 },
    ],
    ocrNotes: 'จำลองผลอ่านเอกสารอัตโนมัติ (Frontend UI Template) — แยกยอดก่อน VAT 7% เรียบร้อย',
  },
  {
    documentType: 'tax_invoice',
    vendorName: 'สถานีบริการน้ำมัน บางจาก (สาขาพระราม 4)',
    vendorTaxId: '0107557000039',
    vendorAddress: '2098 ถ.สุขุมวิท แขวงพระโขนงใต้ เขตพระโขนง กรุงเทพฯ 10260',
    customerName: 'บริษัท โปรเกรสซีฟ แอคเคาท์ติ้ง จำกัด',
    customerTaxId: '0105564012345',
    customerAddress: '128 อาคารพญาไทพลาซ่า เขตราชเทวี กรุงเทพฯ 10400',
    paymentMethod: 'บัตรเครดิตบริษัท',
    suggestedCategory: 'ค่าน้ำมันเชื้อเพลิง',
    subtotal: 1401.87,
    vatAmount: 98.13,
    withholdingTax: 0,
    discount: 0,
    grandTotal: 1500,
    items: [
      { itemName: 'แก๊สโซฮอล์ 95 S EVO (39.15 ลิตร)', quantity: 1, unitPrice: 1401.87, amount: 1401.87, pageNumber: 1 },
    ],
    ocrNotes: 'จำลองผลอ่านบิลค่าน้ำมันเชื้อเพลิงอัตโนมัติ (Frontend UI Template)',
  },
  {
    documentType: 'receipt',
    vendorName: 'ร้านอาหาร ครัวบ้านสวน สาขาราชเทวี',
    vendorTaxId: '0105560098112',
    vendorAddress: '45/8 ถ.พญาไท เขตราชเทวี กรุงเทพฯ 10400',
    customerName: '',
    customerTaxId: '',
    customerAddress: '',
    paymentMethod: 'เงินสด',
    suggestedCategory: 'ค่าอาหารและเครื่องดื่ม',
    subtotal: 1350,
    vatAmount: 0,
    withholdingTax: 0,
    discount: 0,
    grandTotal: 1350,
    items: [
      { itemName: 'ชุดอาหารกลางวันรับรองลูกค้าโครงการ (5 ท่าน)', quantity: 5, unitPrice: 220, amount: 1100, pageNumber: 1 },
      { itemName: 'เครื่องดื่มและน้ำผลไม้รวม', quantity: 5, unitPrice: 50, amount: 250, pageNumber: 1 },
    ],
    ocrNotes: 'จำลองผลอ่านใบเสร็จค่าอาหารอัตโนมัติ (ไม่มี VAT 7%)',
  },
];

export async function runMockReceiptOcr(params: {
  fileName?: string;
  mimeType?: string;
  categoryNames?: string[];
}): Promise<{
  success: boolean;
  modelUsed: string;
  fallbackTriggered: boolean;
  executionTimeMs: number;
  data: any;
}> {
  await new Promise((resolve) => setTimeout(resolve, 450));

  mockReceiptScanCounter += 1;
  const isPdf =
    Boolean(params.mimeType?.toLowerCase().includes('pdf')) ||
    Boolean(params.fileName?.toLowerCase().endsWith('.pdf'));

  const todayISO = getRelativeISODate(0);
  const seq = String(100 + mockReceiptScanCounter).padStart(4, '0');

  if (isPdf) {
    const p1Total = 4280;
    const p2Total = 1926;
    const p1Sub = 4000;
    const p1Vat = 280;
    const p2Sub = 1800;
    const p2Vat = 126;

    return {
      success: true,
      modelUsed: 'ui-template-mock-ocr',
      fallbackTriggered: false,
      executionTimeMs: 450,
      data: {
        documentType: 'tax_invoice',
        documentDate: todayISO,
        receiptNumber: `PDF-${seq}`,
        vendorName: 'บริษัท คอมเซเว่น จำกัด (มหาชน)',
        vendorTaxId: '0107558000377',
        vendorAddress: '549/1 ถ.สรรพาวุธ แขวงบางนาใต้ เขตบางนา กรุงเทพฯ 10260',
        customerName: 'บริษัท โปรเกรสซีฟ แอคเคาท์ติ้ง จำกัด',
        customerTaxId: '0105564012345',
        customerAddress: '128 อาคารพญาไทพลาซ่า เขตราชเทวี กรุงเทพฯ 10400',
        subtotal: p1Sub + p2Sub,
        vatAmount: p1Vat + p2Vat,
        withholdingTax: 0,
        discount: 0,
        grandTotal: p1Total + p2Total,
        currency: 'THB',
        paymentMethod: 'โอนเงิน',
        suggestedCategory: 'ค่าอุปกรณ์ไอทีและเครื่องมือ',
        totalPagesRead: 2,
        pages: [
          {
            pageNumber: 1,
            pageTitle: 'ใบกำกับภาษีหน้า 1 - อุปกรณ์ต่อพ่วง',
            receiptNumber: `PDF-${seq}-P1`,
            vendorName: 'บริษัท คอมเซเว่น จำกัด (มหาชน)',
            vendorTaxId: '0107558000377',
            documentDate: todayISO,
            subtotal: p1Sub,
            vatAmount: p1Vat,
            grandTotal: p1Total,
            items: [
              { itemName: 'Logitech MX Master 3S Wireless Mouse', quantity: 1, unitPrice: 4000, amount: 4000, pageNumber: 1 },
            ],
          },
          {
            pageNumber: 2,
            pageTitle: 'ใบกำกับภาษีหน้า 2 - สายสัญญาณและฮับ',
            receiptNumber: `PDF-${seq}-P2`,
            vendorName: 'บริษัท คอมเซเว่น จำกัด (มหาชน)',
            vendorTaxId: '0107558000377',
            documentDate: todayISO,
            subtotal: p2Sub,
            vatAmount: p2Vat,
            grandTotal: p2Total,
            items: [
              { itemName: 'USB-C Multiport Hub 7-in-1', quantity: 2, unitPrice: 900, amount: 1800, pageNumber: 2 },
            ],
          },
        ],
        items: [
          { itemName: 'Logitech MX Master 3S Wireless Mouse', quantity: 1, unitPrice: 4000, amount: 4000, pageNumber: 1 },
          { itemName: 'USB-C Multiport Hub 7-in-1', quantity: 2, unitPrice: 900, amount: 1800, pageNumber: 2 },
        ],
        ocrNotes: `จำลองผลอ่านเอกสาร PDF 2 หน้า (${params.fileName || 'document.pdf'}) สำหรับทดสอบระบบแยกหน้าอัตโนมัติ`,
        needsReview: false,
        reviewReasons: [],
      },
    };
  }

  const tpl = RECEIPT_TEMPLATES[(mockReceiptScanCounter - 1) % RECEIPT_TEMPLATES.length];
  let matchedCategory = tpl.suggestedCategory;
  if (params.categoryNames && params.categoryNames.length > 0) {
    const exactOrPartial = params.categoryNames.find((c) => c.includes(tpl.suggestedCategory));
    if (exactOrPartial) matchedCategory = exactOrPartial;
  }

  return {
    success: true,
    modelUsed: 'ui-template-mock-ocr',
    fallbackTriggered: false,
    executionTimeMs: 420,
    data: {
      documentType: tpl.documentType,
      documentDate: todayISO,
      receiptNumber: `DEMO-${seq}`,
      vendorName: tpl.vendorName,
      vendorTaxId: tpl.vendorTaxId,
      vendorAddress: tpl.vendorAddress,
      customerName: tpl.customerName,
      customerTaxId: tpl.customerTaxId,
      customerAddress: tpl.customerAddress,
      subtotal: tpl.subtotal,
      vatAmount: tpl.vatAmount,
      withholdingTax: tpl.withholdingTax,
      discount: tpl.discount,
      grandTotal: tpl.grandTotal,
      currency: 'THB',
      paymentMethod: tpl.paymentMethod,
      suggestedCategory: matchedCategory,
      totalPagesRead: 1,
      pages: [],
      items: tpl.items,
      ocrNotes: `${tpl.ocrNotes}${params.fileName ? ` (${params.fileName})` : ''}`,
      needsReview: false,
      reviewReasons: [],
    },
  };
}

export async function runMockStatementOcr(params: {
  fileName?: string;
}): Promise<{
  success: boolean;
  modelUsed: string;
  data: any;
}> {
  await new Promise((resolve) => setTimeout(resolve, 500));

  const startISO = getRelativeISODate(7);
  const midISO = getRelativeISODate(3);
  const endISO = getRelativeISODate(0);

  return {
    success: true,
    modelUsed: 'ui-template-mock-ocr',
    data: {
      bankName: 'ธนาคารกสิกรไทย',
      bankCode: 'KBANK',
      accountNumber: '048-2-91847-3',
      accountName: 'บจก. โปรเกรสซีฟ แอคเคาท์ติ้ง (กระแสรายวัน)',
      branchName: 'พญาไท',
      statementPeriodStart: startISO,
      statementPeriodEnd: endISO,
      openingBalance: 1450000.5,
      closingBalance: 1485200.5,
      totalDebit: 14800,
      totalCredit: 50000,
      totalPagesRead: 1,
      ocrNotes: `จำลองการสแกนไฟล์ Statement อัตโนมัติ (${params.fileName || 'statement.pdf'}) — พร้อมจัดรูปแบบยอดเดินบัญชีเรียบร้อย`,
      transactions: [
        {
          id: 'tx_mock_s1',
          date: startISO,
          time: '09:30:12',
          description: 'รับโอนเงินค่าบริการระบบบัญชีรายเดือน',
          channel: 'K PLUS SME',
          creditAmount: 50000,
          debitAmount: 0,
          balance: 1500000.5,
          referenceNo: 'MOCK-KB-001',
        },
        {
          id: 'tx_mock_s2',
          date: midISO,
          time: '14:18:40',
          description: 'โอนเงินชำระค่าอุปกรณ์สำนักงาน',
          channel: 'K-Cash Connect',
          creditAmount: 0,
          debitAmount: 9800,
          balance: 1490200.5,
          referenceNo: 'MOCK-KB-002',
        },
        {
          id: 'tx_mock_s3',
          date: endISO,
          time: '11:05:25',
          description: 'ชำระค่าบริการคลาวด์และระบบเครือข่าย',
          channel: 'Direct Debit',
          creditAmount: 0,
          debitAmount: 5000,
          balance: 1485200.5,
          referenceNo: 'MOCK-KB-003',
        },
      ],
    },
  };
}
