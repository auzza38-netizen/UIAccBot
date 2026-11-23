import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Receipt, Project, ExpenseCategory } from '../types';
import { formatThaiDate, formatCurrency } from './formatters';

interface ExportContext {
  receipts: Receipt[];
  projectsMap: Record<string, Project>;
  categoriesMap: Record<string, ExpenseCategory>;
  title?: string;
}

/**
 * Export Receipts to formatted Excel (.xlsx) with Thai headers and summary row
 */
export function exportReceiptsToExcel({
  receipts,
  projectsMap,
  categoriesMap,
  title = 'รายงานค่าใช้จ่ายใบเสร็จ',
}: ExportContext) {
  const rows = receipts.map((r, idx) => {
    const project = projectsMap[r.projectId];
    const category = categoriesMap[r.categoryId];

    const itemsSummary =
      r.items && r.items.length > 0
        ? r.items
            .map(
              (it) =>
                `${it.itemName}${it.quantity ? ` (${it.quantity} x ${formatCurrency(it.unitPrice || 0, false)})` : ''}`
            )
            .join('; ')
        : r.vendorName
        ? `ค่าใช้จ่ายตามใบเสร็จ (${r.vendorName})`
        : '-';

    return {
      'ลำดับ': idx + 1,
      'วันที่เอกสาร': r.documentDate,
      'วันที่บันทึก': r.uploadDate,
      'รหัสโครงการ': project ? project.projectCode : '-',
      'ชื่อโครงการ / หน่วยงาน': project ? project.clientName : '-',
      'ชื่อลูกค้า หรือ หน่วยงาน (ผู้ซื้อในบิล)': r.customerName || (project ? project.clientName : '-'),
      'เลขผู้เสียภาษีผู้ซื้อ': r.customerTaxId || '-',
      'ที่อยู่ผู้ซื้อ / ลูกค้า (ในบิล)': r.customerAddress || '-',
      'เลขที่ใบเสร็จ': r.receiptNumber || 'ไม่มีเลขที่',
      'ชื่อร้านค้า / ผู้ขาย': r.vendorName || '-',
      'เลขประจำตัวผู้เสียภาษีผู้ขาย': r.vendorTaxId || '-',
      'ที่อยู่ร้านค้า / ผู้ขาย (ในบิล)': r.vendorAddress || '-',
      'หมวดหมู่': category ? category.categoryName : 'ไม่ระบุ',
      'รายการสินค้า / บริการ': itemsSummary,
      'จำนวนรายการย่อย': r.items?.length || 1,
      'ยอดก่อนภาษี (บาท)': r.subtotal || 0,
      'ภาษีมูลค่าเพิ่ม VAT (บาท)': r.vatAmount || 0,
      'หัก ณ ที่จ่าย (บาท)': r.withholdingTax || 0,
      'ส่วนลด (บาท)': r.discount || 0,
      'ยอดสุทธิ (บาท)': r.grandTotal || 0,
      'วิธีชำระเงิน': r.paymentMethod || '-',
      'ผู้บันทึก': r.uploadedByEmail || '-',
      'สถานะการตรวจสอบ': r.verificationStatus === 'verified' ? 'ตรวจสอบแล้ว' : r.verificationStatus === 'needs_review' ? 'รอการตรวจสอบ' : 'ฉบับร่าง',
      'สถานะการอนุมัติ': r.approvalStatus === 'approved' ? 'อนุมัติแล้ว' : r.approvalStatus === 'pending' ? 'รออนุมัติ' : r.approvalStatus === 'rejected' ? 'ไม่อนุมัติ' : 'ฉบับร่าง',
      'เอกสารลับ': r.isConfidential ? 'ใช่' : 'ไม่ใช่',
      'หมายเหตุ': r.notes || '',
    };
  });

  // Calculate totals
  const totalSubtotal = receipts.reduce((sum, r) => sum + (r.subtotal || 0), 0);
  const totalVat = receipts.reduce((sum, r) => sum + (r.vatAmount || 0), 0);
  const totalWht = receipts.reduce((sum, r) => sum + (r.withholdingTax || 0), 0);
  const totalDiscount = receipts.reduce((sum, r) => sum + (r.discount || 0), 0);
  const totalGrand = receipts.reduce((sum, r) => sum + (r.grandTotal || 0), 0);
  const totalItemCount = receipts.reduce((sum, r) => sum + (r.items?.length || 1), 0);

  // Summary Row for Sheet 1
  const summaryRow = {
    'ลำดับ': 'รวมทั้งสิ้น',
    'วันที่เอกสาร': `${receipts.length} ใบ`,
    'วันที่บันทึก': '',
    'รหัสโครงการ': '',
    'ชื่อโครงการ / หน่วยงาน': '',
    'ชื่อลูกค้า หรือ หน่วยงาน (ผู้ซื้อในบิล)': '',
    'เลขผู้เสียภาษีผู้ซื้อ': '',
    'ที่อยู่ผู้ซื้อ / ลูกค้า (ในบิล)': '',
    'เลขที่ใบเสร็จ': '',
    'ชื่อร้านค้า / ผู้ขาย': '',
    'เลขประจำตัวผู้เสียภาษีผู้ขาย': '',
    'ที่อยู่ร้านค้า / ผู้ขาย (ในบิล)': '',
    'หมวดหมู่': '',
    'รายการสินค้า / บริการ': `รวมรายการย่อยทั้งหมด ${totalItemCount} รายการ`,
    'จำนวนรายการย่อย': totalItemCount,
    'ยอดก่อนภาษี (บาท)': totalSubtotal,
    'ภาษีมูลค่าเพิ่ม VAT (บาท)': totalVat,
    'หัก ณ ที่จ่าย (บาท)': totalWht,
    'ส่วนลด (บาท)': totalDiscount,
    'ยอดสุทธิ (บาท)': totalGrand,
    'วิธีชำระเงิน': '',
    'ผู้บันทึก': '',
    'สถานะการตรวจสอบ': '',
    'สถานะการอนุมัติ': '',
    'เอกสารลับ': '',
    'หมายเหตุ': '',
  };

  const worksheet = XLSX.utils.json_to_sheet([...rows, summaryRow]);

  // Adjust column widths
  const colWidths = [
    { wch: 8 },  // ลำดับ
    { wch: 14 }, // วันที่เอกสาร
    { wch: 14 }, // วันที่บันทึก
    { wch: 14 }, // รหัสโครงการ
    { wch: 24 }, // ชื่อโครงการ / หน่วยงาน
    { wch: 28 }, // ชื่อลูกค้า หรือ หน่วยงาน (ผู้ซื้อในบิล)
    { wch: 18 }, // เลขผู้เสียภาษีผู้ซื้อ
    { wch: 36 }, // ที่อยู่ผู้ซื้อ / ลูกค้า (ในบิล)
    { wch: 18 }, // เลขที่ใบเสร็จ
    { wch: 28 }, // ชื่อร้านค้า / ผู้ขาย
    { wch: 18 }, // เลขประจำตัวผู้เสียภาษีผู้ขาย
    { wch: 36 }, // ที่อยู่ร้านค้า / ผู้ขาย (ในบิล)
    { wch: 20 }, // หมวดหมู่
    { wch: 35 }, // รายการสินค้า/บริการ
    { wch: 14 }, // จำนวนรายการย่อย
    { wch: 18 }, // ยอดก่อนภาษี
    { wch: 18 }, // VAT
    { wch: 16 }, // WHT
    { wch: 14 }, // Discount
    { wch: 18 }, // Grand Total
    { wch: 16 }, // Payment Method
    { wch: 24 }, // Uploaded by
    { wch: 16 }, // Verification
    { wch: 16 }, // Approval
    { wch: 12 }, // Confidential
    { wch: 30 }, // Notes
  ];
  worksheet['!cols'] = colWidths;

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'ใบเสร็จรับเงิน');

  // Sheet 2: รายละเอียดสินค้าและบริการรายบรรทัด (Line Items Detail)
  const lineItemRows: any[] = [];
  receipts.forEach((r) => {
    const project = projectsMap[r.projectId];
    const category = categoriesMap[r.categoryId];

    if (r.items && r.items.length > 0) {
      r.items.forEach((item) => {
        lineItemRows.push({
          'ลำดับ': lineItemRows.length + 1,
          'เลขที่ใบเสร็จ': r.receiptNumber || 'ไม่มีเลขที่',
          'วันที่เอกสาร': r.documentDate,
          'รหัสโครงการ': project ? project.projectCode : '-',
          'ชื่อโครงการ / หน่วยงาน': project ? project.clientName : '-',
          'ชื่อลูกค้า หรือ หน่วยงาน (ผู้ซื้อในบิล)': r.customerName || (project ? project.clientName : '-'),
          'เลขผู้เสียภาษีผู้ซื้อ': r.customerTaxId || '-',
          'ที่อยู่ผู้ซื้อ / ลูกค้า (ในบิล)': r.customerAddress || '-',
          'ชื่อร้านค้า / ผู้ขาย': r.vendorName || '-',
          'เลขประจำตัวผู้เสียภาษีผู้ขาย': r.vendorTaxId || '-',
          'ที่อยู่ร้านค้า / ผู้ขาย (ในบิล)': r.vendorAddress || '-',
          'หมวดหมู่': category ? category.categoryName : 'ไม่ระบุ',
          'หน้าที่ตรวจพบ (PDF)': item.pageNumber || 1,
          'ชื่อสินค้า / บริการ': item.itemName,
          'จำนวน': item.quantity || 1,
          'ราคาต่อหน่วย (บาท)': item.unitPrice || 0,
          'รวมเป็นเงิน (บาท)': item.amount || (item.quantity && item.unitPrice ? item.quantity * item.unitPrice : 0),
          'ยอดสุทธิใบเสร็จ (บาท)': r.grandTotal || 0,
          'ผู้บันทึก': r.uploadedByEmail || '-',
          'สถานะการอนุมัติ': r.approvalStatus === 'approved' ? 'อนุมัติแล้ว' : r.approvalStatus === 'pending' ? 'รออนุมัติ' : 'ฉบับร่าง',
        });
      });
    } else {
      lineItemRows.push({
        'ลำดับ': lineItemRows.length + 1,
        'เลขที่ใบเสร็จ': r.receiptNumber || 'ไม่มีเลขที่',
        'วันที่เอกสาร': r.documentDate,
        'รหัสโครงการ': project ? project.projectCode : '-',
        'ชื่อโครงการ / หน่วยงาน': project ? project.clientName : '-',
        'ชื่อลูกค้า หรือ หน่วยงาน (ผู้ซื้อในบิล)': r.customerName || (project ? project.clientName : '-'),
        'เลขผู้เสียภาษีผู้ซื้อ': r.customerTaxId || '-',
        'ที่อยู่ผู้ซื้อ / ลูกค้า (ในบิล)': r.customerAddress || '-',
        'ชื่อร้านค้า / ผู้ขาย': r.vendorName || '-',
        'เลขประจำตัวผู้เสียภาษีผู้ขาย': r.vendorTaxId || '-',
        'ที่อยู่ร้านค้า / ผู้ขาย (ในบิล)': r.vendorAddress || '-',
        'หมวดหมู่': category ? category.categoryName : 'ไม่ระบุ',
        'หน้าที่ตรวจพบ (PDF)': 1,
        'ชื่อสินค้า / บริการ': r.vendorName ? `ค่าใช้จ่ายตามใบเสร็จ (${r.vendorName})` : 'ไม่ระบุรายการย่อย',
        'จำนวน': 1,
        'ราคาต่อหน่วย (บาท)': r.grandTotal || 0,
        'รวมเป็นเงิน (บาท)': r.grandTotal || 0,
        'ยอดสุทธิใบเสร็จ (บาท)': r.grandTotal || 0,
        'ผู้บันทึก': r.uploadedByEmail || '-',
        'สถานะการอนุมัติ': r.approvalStatus === 'approved' ? 'อนุมัติแล้ว' : r.approvalStatus === 'pending' ? 'รออนุมัติ' : 'ฉบับร่าง',
      });
    }
  });

  const totalLineItemAmount = lineItemRows.reduce((sum, item) => sum + (Number(item['รวมเป็นเงิน (บาท)']) || 0), 0);

  const lineItemSummaryRow = {
    'ลำดับ': 'รวมทั้งสิ้น',
    'เลขที่ใบเสร็จ': `${lineItemRows.length} รายการ`,
    'วันที่เอกสาร': '',
    'รหัสโครงการ': '',
    'ชื่อโครงการ / หน่วยงาน': '',
    'ชื่อลูกค้า หรือ หน่วยงาน (ผู้ซื้อในบิล)': '',
    'เลขผู้เสียภาษีผู้ซื้อ': '',
    'ที่อยู่ผู้ซื้อ / ลูกค้า (ในบิล)': '',
    'ชื่อร้านค้า / ผู้ขาย': '',
    'เลขประจำตัวผู้เสียภาษีผู้ขาย': '',
    'ที่อยู่ร้านค้า / ผู้ขาย (ในบิล)': '',
    'หมวดหมู่': '',
    'หน้าที่ตรวจพบ (PDF)': '',
    'ชื่อสินค้า / บริการ': '',
    'จำนวน': lineItemRows.reduce((sum, item) => sum + (Number(item['จำนวน']) || 0), 0),
    'ราคาต่อหน่วย (บาท)': '',
    'รวมเป็นเงิน (บาท)': totalLineItemAmount,
    'ยอดสุทธิใบเสร็จ (บาท)': totalGrand,
    'ผู้บันทึก': '',
    'สถานะการอนุมัติ': '',
  };

  const lineItemWorksheet = XLSX.utils.json_to_sheet([...lineItemRows, lineItemSummaryRow]);
  lineItemWorksheet['!cols'] = [
    { wch: 8 },  // ลำดับ
    { wch: 18 }, // เลขที่ใบเสร็จ
    { wch: 14 }, // วันที่เอกสาร
    { wch: 14 }, // รหัสโครงการ
    { wch: 24 }, // ชื่อโครงการ
    { wch: 28 }, // ชื่อลูกค้า (ผู้ซื้อในบิล)
    { wch: 18 }, // เลขผู้เสียภาษีผู้ซื้อ
    { wch: 36 }, // ที่อยู่ผู้ซื้อ
    { wch: 28 }, // ชื่อร้านค้า / ผู้ขาย
    { wch: 18 }, // เลขผู้เสียภาษีผู้ขาย
    { wch: 36 }, // ที่อยู่ผู้ขาย
    { wch: 20 }, // หมวดหมู่
    { wch: 18 }, // หน้าที่ตรวจพบ
    { wch: 35 }, // ชื่อสินค้า / บริการ
    { wch: 12 }, // จำนวน
    { wch: 18 }, // ราคาต่อหน่วย
    { wch: 18 }, // รวมเป็นเงิน
    { wch: 20 }, // ยอดสุทธิใบเสร็จ
    { wch: 24 }, // ผู้บันทึก
    { wch: 16 }, // สถานะการอนุมัติ
  ];
  XLSX.utils.book_append_sheet(workbook, lineItemWorksheet, 'รายละเอียดสินค้า_LineItems');

  // Sheet 3: สรุปยอดการคีย์ข้อมูลของแต่ละ User
  const userMap: Record<string, { count: number; total: number; vat: number; approved: number; pending: number }> = {};
  receipts.forEach((r) => {
    const u = r.uploadedByEmail || 'Unknown';
    if (!userMap[u]) userMap[u] = { count: 0, total: 0, vat: 0, approved: 0, pending: 0 };
    userMap[u].count += 1;
    userMap[u].total += r.grandTotal || 0;
    userMap[u].vat += r.vatAmount || 0;
    if (r.approvalStatus === 'approved') userMap[u].approved += 1;
    else if (r.approvalStatus === 'pending') userMap[u].pending += 1;
  });

  const userRows = Object.entries(userMap)
    .sort((a, b) => b[1].total - a[1].total)
    .map(([email, d], idx) => ({
      'ลำดับ': idx + 1,
      'ผู้บันทึกข้อมูล (Email)': email,
      'จำนวนใบเสร็จ (ใบ)': d.count,
      'ยอดเงินรวมที่คีย์ (บาท)': d.total,
      'ภาษี VAT รวม (บาท)': d.vat,
      'อนุมัติแล้ว (ใบ)': d.approved,
      'รออนุมัติ (ใบ)': d.pending,
      'สัดส่วนการคีย์ (%)': totalGrand > 0 ? ((d.total / totalGrand) * 100).toFixed(1) + '%' : '0%',
      'ยอดเฉลี่ยต่อใบ (บาท)': d.count > 0 ? Math.round(d.total / d.count) : 0,
    }));

  const userSummaryRow = {
    'ลำดับ': 'รวมทั้งสิ้น',
    'ผู้บันทึกข้อมูล (Email)': `${Object.keys(userMap).length} คน`,
    'จำนวนใบเสร็จ (ใบ)': receipts.length,
    'ยอดเงินรวมที่คีย์ (บาท)': totalGrand,
    'ภาษี VAT รวม (บาท)': totalVat,
    'อนุมัติแล้ว (ใบ)': Object.values(userMap).reduce((s, x) => s + x.approved, 0),
    'รออนุมัติ (ใบ)': Object.values(userMap).reduce((s, x) => s + x.pending, 0),
    'สัดส่วนการคีย์ (%)': '100.0%',
    'ยอดเฉลี่ยต่อใบ (บาท)': receipts.length > 0 ? Math.round(totalGrand / receipts.length) : 0,
  };

  const userWorksheet = XLSX.utils.json_to_sheet([...userRows, userSummaryRow]);
  userWorksheet['!cols'] = [
    { wch: 8 },  // ลำดับ
    { wch: 28 }, // ผู้บันทึก
    { wch: 18 }, // จำนวนใบเสร็จ
    { wch: 22 }, // ยอดเงินรวม
    { wch: 18 }, // VAT
    { wch: 16 }, // อนุมัติแล้ว
    { wch: 16 }, // รออนุมัติ
    { wch: 18 }, // สัดส่วน
    { wch: 20 }, // เฉลี่ยต่อใบ
  ];
  XLSX.utils.book_append_sheet(workbook, userWorksheet, 'สรุปยอดคีย์ตาม_User');

  const fileName = `${title}_${new Date().toISOString().slice(0, 10)}.xlsx`;
  XLSX.writeFile(workbook, fileName);
}

/**
 * Export Receipts to CSV
 */
export function exportReceiptsToCSV({
  receipts,
  projectsMap,
  categoriesMap,
  title = 'receipt_report',
}: ExportContext) {
  const headers = [
    'ลำดับ',
    'วันที่เอกสาร',
    'รหัสโครงการ',
    'ชื่อโครงการ / หน่วยงาน',
    'ชื่อลูกค้า หรือ หน่วยงาน (ผู้ซื้อในบิล)',
    'เลขผู้เสียภาษีผู้ซื้อ',
    'ที่อยู่ผู้ซื้อ / ลูกค้า (ในบิล)',
    'เลขที่ใบเสร็จ',
    'ชื่อร้านค้า / ผู้ขาย',
    'เลขประจำตัวผู้เสียภาษีผู้ขาย',
    'ที่อยู่ร้านค้า / ผู้ขาย (ในบิล)',
    'หมวดหมู่',
    'รายการสินค้า/บริการ',
    'จำนวนรายการย่อย',
    'ยอดก่อนภาษี',
    'ภาษี VAT',
    'ยอดสุทธิ',
    'ผู้บันทึก',
    'สถานะการอนุมัติ',
  ];

  const lines = receipts.map((r, idx) => {
    const project = projectsMap[r.projectId];
    const category = categoriesMap[r.categoryId];

    const itemsSummary =
      r.items && r.items.length > 0
        ? r.items.map((it) => `${it.itemName}${it.quantity ? ` (${it.quantity} x ${it.unitPrice || 0})` : ''}`).join('; ')
        : r.vendorName
        ? `ค่าใช้จ่ายตามใบเสร็จ (${r.vendorName})`
        : '-';

    const customerDisplay = r.customerName || project?.clientName || '';

    const values = [
      idx + 1,
      r.documentDate,
      `"${project?.projectCode || ''}"`,
      `"${(project?.clientName || '').replace(/"/g, '""')}"`,
      `"${customerDisplay.replace(/"/g, '""')}"`,
      `"${(r.customerTaxId || '').replace(/"/g, '""')}"`,
      `"${(r.customerAddress || '').replace(/"/g, '""')}"`,
      `"${(r.receiptNumber || '').replace(/"/g, '""')}"`,
      `"${(r.vendorName || '').replace(/"/g, '""')}"`,
      `"${(r.vendorTaxId || '').replace(/"/g, '""')}"`,
      `"${(r.vendorAddress || '').replace(/"/g, '""')}"`,
      `"${category?.categoryName || ''}"`,
      `"${itemsSummary.replace(/"/g, '""')}"`,
      r.items?.length || 1,
      r.subtotal || 0,
      r.vatAmount || 0,
      r.grandTotal || 0,
      `"${r.uploadedByEmail || ''}"`,
      r.approvalStatus === 'approved' ? 'อนุมัติแล้ว' : 'รออนุมัติ',
    ];

    return values.join(',');
  });

  // UTF-8 BOM for Thai Excel compatibility
  const csvContent = '\uFEFF' + [headers.join(','), ...lines].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `${title}_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Export Summary or Receipts Report to PDF
 */
export function exportReceiptsToPDF({
  receipts,
  projectsMap,
  categoriesMap,
  title = 'Progressive Account Receipt Manager Report',
}: ExportContext) {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  // Title & Header
  doc.setFontSize(16);
  doc.text(title, 14, 15);

  doc.setFontSize(10);
  doc.text(`Generated: ${new Date().toLocaleString('th-TH')} | Total Items: ${receipts.length}`, 14, 22);

  const totalAmount = receipts.reduce((sum, r) => sum + (r.grandTotal || 0), 0);
  doc.text(`Total Expenditure: ${formatCurrency(totalAmount)}`, 200, 22);

  const tableData = receipts.map((r, i) => {
    const proj = projectsMap[r.projectId];
    const cat = categoriesMap[r.categoryId];
    return [
      String(i + 1),
      r.documentDate,
      proj?.projectCode || '-',
      r.customerName || proj?.clientName || '-',
      r.customerAddress || '-',
      r.receiptNumber || '-',
      r.vendorName || '-',
      r.vendorAddress || '-',
      cat?.categoryName || '-',
      formatCurrency(r.grandTotal, false),
      r.approvalStatus === 'approved' ? 'Approved' : 'Pending',
    ];
  });

  autoTable(doc, {
    startY: 28,
    head: [['#', 'Date', 'Project', 'Customer/Buyer', 'Buyer Address', 'Receipt #', 'Vendor/Seller', 'Seller Address', 'Category', 'Grand Total', 'Status']],
    body: tableData,
    theme: 'grid',
    headStyles: {
      fillColor: [18, 48, 74], // #12304A Navy Blue
      textColor: [255, 255, 255],
      fontStyle: 'bold',
    },
    styles: {
      fontSize: 7,
      cellPadding: 1.5,
    },
    foot: [
      ['', 'Total', '', '', '', '', '', '', '', formatCurrency(totalAmount, false), '']
    ],
    footStyles: {
      fillColor: [240, 245, 250],
      textColor: [18, 48, 74],
      fontStyle: 'bold',
    }
  });

  doc.save(`${title.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.pdf`);
}
