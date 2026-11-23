import { Receipt } from '../types';
import { DEFAULT_CATEGORIES, DefaultCategoryItem } from '../data/mockData';

export type { DefaultCategoryItem };
export { DEFAULT_CATEGORIES };

export const MASTER_ADMIN_EMAILS = [
  'auzza38@gmail.com',
  'progressiveacc2564@gmail.com',
  'progressiveacc01@gmail.com',
  'progressiveacc02@gmail.com',
];

export const MASTER_ADMIN_EMAIL = MASTER_ADMIN_EMAILS[0];

export function isMasterAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  const clean = email.trim().toLowerCase();
  return MASTER_ADMIN_EMAILS.some((adminEmail) => adminEmail.toLowerCase() === clean);
}

/**
 * Check if receipt is duplicate against in-memory receipts list
 */
export async function checkDuplicateReceipt(
  currentReceiptId: string | null,
  vendorName: string,
  documentDate: string,
  receiptNumber: string,
  grandTotal: number,
  imageHash?: string,
  existingReceipts: Receipt[] = []
): Promise<{ isDuplicate: boolean; reason?: string; matchReceiptId?: string }> {
  for (const r of existingReceipts) {
    if (r.receiptId === currentReceiptId || r.isDeleted) continue;

    if (imageHash && r.imageHash && r.imageHash === imageHash) {
      return {
        isDuplicate: true,
        reason: `ตรวจพบรูปภาพใบเสร็จซ้ำกับรายการ "${r.vendorName}" (${r.receiptNumber || 'ไม่มีเลขที่'}) ยอด ${r.grandTotal} ฿`,
        matchReceiptId: r.receiptId,
      };
    }

    const sameVendor =
      r.vendorName &&
      vendorName &&
      r.vendorName.trim().toLowerCase() === vendorName.trim().toLowerCase();
    const sameDate = r.documentDate === documentDate;
    const sameNumber =
      r.receiptNumber &&
      receiptNumber &&
      r.receiptNumber.trim().toLowerCase() === receiptNumber.trim().toLowerCase();
    const sameTotal = Math.abs((r.grandTotal || 0) - grandTotal) < 0.01;

    if (sameVendor && sameDate && sameTotal && (sameNumber || (!r.receiptNumber && !receiptNumber))) {
      return {
        isDuplicate: true,
        reason: `ตรวจพบข้อมูลตรงกับรายการเดิม: ร้าน "${r.vendorName}" วันที่ ${r.documentDate} ยอด ${r.grandTotal} ฿`,
        matchReceiptId: r.receiptId,
      };
    }
  }

  return { isDuplicate: false };
}
