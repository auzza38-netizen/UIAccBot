import { Receipt, DashboardFilters } from '../types';

export function filterReceipts(receipts: Receipt[], filters: DashboardFilters): Receipt[] {
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);

  // Compute yesterday
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().slice(0, 10);

  // Compute this week (starting Monday)
  const dayOfWeek = now.getDay() || 7; // 1 (Mon) to 7 (Sun)
  const monday = new Date(now);
  monday.setDate(monday.getDate() - dayOfWeek + 1);
  const mondayStr = monday.toISOString().slice(0, 10);

  // Compute this month
  const thisMonthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  // Compute last month
  const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthPrefix = `${lastMonthDate.getFullYear()}-${String(lastMonthDate.getMonth() + 1).padStart(2, '0')}`;

  return receipts.filter((r) => {
    if (r.isDeleted) return false;

    const targetDate = filters.groupByDate === 'uploadDate' ? r.uploadDate : r.documentDate;

    // 1. Date Preset Filter
    if (filters.datePreset === 'today') {
      if (targetDate !== todayStr) return false;
    } else if (filters.datePreset === 'yesterday') {
      if (targetDate !== yesterdayStr) return false;
    } else if (filters.datePreset === 'this_week') {
      if (!targetDate || targetDate < mondayStr || targetDate > todayStr) return false;
    } else if (filters.datePreset === 'this_month') {
      if (!targetDate || !targetDate.startsWith(thisMonthPrefix)) return false;
    } else if (filters.datePreset === 'last_month') {
      if (!targetDate || !targetDate.startsWith(lastMonthPrefix)) return false;
    } else if (filters.datePreset === 'custom') {
      if (filters.startDate && targetDate < filters.startDate) return false;
      if (filters.endDate && targetDate > filters.endDate) return false;
    }

    // 2. Project Filter
    if (filters.projectId !== 'all' && r.projectId !== filters.projectId) {
      return false;
    }

    // 3. Category Filter
    if (filters.categoryId !== 'all' && r.categoryId !== filters.categoryId) {
      return false;
    }

    // 4. Approval Status Filter
    if (filters.approvalStatus !== 'all' && r.approvalStatus !== filters.approvalStatus) {
      return false;
    }

    // 5. Verification Status Filter
    if (filters.verificationStatus !== 'all' && r.verificationStatus !== filters.verificationStatus) {
      return false;
    }

    // 6. Vendor / Receipt number search
    if (filters.vendor) {
      const q = filters.vendor.toLowerCase().trim();
      const matchVendor = r.vendorName && r.vendorName.toLowerCase().includes(q);
      const matchNumber = r.receiptNumber && r.receiptNumber.toLowerCase().includes(q);
      if (!matchVendor && !matchNumber) return false;
    }

    // 7. Uploaded By
    if (filters.uploadedBy && filters.uploadedBy !== 'all' && r.uploadedBy !== filters.uploadedBy) {
      return false;
    }

    return true;
  });
}
