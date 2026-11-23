import React from 'react';
import { Receipt, Project } from '../types';
import { useData } from '../context/DataContext';
import { formatCurrency } from '../utils/formatters';
import { ArrowUpRight, ArrowDownLeft } from 'lucide-react';

interface KPIStatsProps {
  receipts: Receipt[];
  allReceipts: Receipt[];
  projects: Project[];
}

export const KPIStats: React.FC<KPIStatsProps> = ({ receipts, allReceipts, projects }) => {
  const { bankAccounts, statementRecords } = useData();
  const todayStr = new Date().toISOString().slice(0, 10);

  // 1. Total expenses in current scope
  const totalAmount = receipts.reduce((sum, r) => sum + (r.grandTotal || 0), 0);
  const totalCount = receipts.length;

  // 2. Approved vs Pending
  const approvedReceipts = receipts.filter((r) => r.approvalStatus === 'approved');
  const approvedAmount = approvedReceipts.reduce((sum, r) => sum + (r.grandTotal || 0), 0);
  const approvedCount = approvedReceipts.length;

  const pendingReceipts = receipts.filter((r) => r.approvalStatus === 'pending');
  const pendingAmount = pendingReceipts.reduce((sum, r) => sum + (r.grandTotal || 0), 0);
  const pendingCount = pendingReceipts.length;

  const needsReviewCount = receipts.filter(
    (r) => r.verificationStatus === 'needs_review'
  ).length;

  const approvalRate = totalCount > 0 ? Math.round((approvedCount / totalCount) * 100) : 100;

  // 3. Liquid Assets from Bank Accounts & Statements
  const totalBankBalance = bankAccounts.reduce(
    (sum, acc) => sum + (Number(acc.currentBalance) || 0),
    0
  );
  const totalCreditInflow = statementRecords.reduce(
    (sum, s) => sum + (Number(s.totalCredit) || 0),
    0
  );
  const totalDebitOutflow = statementRecords.reduce(
    (sum, s) => sum + (Number(s.totalDebit) || 0),
    0
  );

  // 4. Today Activity
  const todayReceipts = allReceipts.filter(
    (r) => (r.uploadDate === todayStr || r.documentDate === todayStr) && !r.isDeleted
  );
  const todayTotal = todayReceipts.reduce((sum, r) => sum + (r.grandTotal || 0), 0);
  const todayCount = todayReceipts.length;

  // 5. Active Projects Count
  const activeProjectIds = new Set(receipts.map((r) => r.projectId).filter(Boolean));
  const activeProjectsCount = activeProjectIds.size;

  // 6. Duplicate Detection
  let potentialDuplicateCount = 0;
  const seenMap: Record<string, boolean> = {};
  for (const r of receipts) {
    if (!r.vendorName) continue;
    const key = `${r.vendorName.trim().toLowerCase()}_${r.documentDate}_${Math.round((r.grandTotal || 0) * 100)}`;
    if (seenMap[key]) {
      potentialDuplicateCount++;
    } else {
      seenMap[key] = true;
    }
  }

  const avgAmount = totalCount > 0 ? totalAmount / totalCount : 0;
  const totalActionNeeded = pendingCount + needsReviewCount;

  return (
    <div className="space-y-2.5">
      {/* Unified 4-Column Divided Financial Ledger Strip */}
      <div className="bg-white border border-slate-200/80 rounded-xl grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 lg:divide-x divide-slate-200/80">
        {/* KPI 1: Total Expenses */}
        <div className="p-5 sm:p-6 flex flex-col justify-between">
          <div>
            <span className="text-xs font-medium text-slate-500 block">
              ยอดค่าใช้จ่ายรวม
            </span>

            <div className="flex items-baseline gap-1.5 mt-2">
              <span className="text-2xl sm:text-[28px] font-bold tracking-tight text-slate-900 font-mono tabular-nums">
                {formatCurrency(totalAmount, false)}
              </span>
              <span className="text-xs font-semibold text-slate-400">฿</span>
            </div>

            <p className="text-xs text-slate-500 mt-1.5">
              อนุมัติแล้ว{' '}
              <span className="font-mono font-semibold text-teal-700 tabular-nums">
                {formatCurrency(approvedAmount, false)} ฿
              </span>
            </p>
          </div>

          <div className="mt-5 space-y-1.5">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-500">ความคืบหน้าการอนุมัติ</span>
              <span className="font-mono font-semibold text-slate-900 tabular-nums">
                {approvalRate}%
              </span>
            </div>
            <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
              <div
                className="h-full bg-[#0F766E] rounded-full transition-all duration-300"
                style={{ width: `${Math.min(100, Math.max(approvalRate, 2))}%` }}
              />
            </div>
          </div>
        </div>

        {/* KPI 2: Liquid Assets */}
        <div className="p-5 sm:p-6 flex flex-col justify-between sm:border-r lg:border-r-0 border-slate-200/80">
          <div>
            <span className="text-xs font-medium text-slate-500 block">
              สินทรัพย์หมุนเวียนคงเหลือ
            </span>

            <div className="flex items-baseline gap-1.5 mt-2">
              <span className="text-2xl sm:text-[28px] font-bold tracking-tight text-slate-900 font-mono tabular-nums">
                {formatCurrency(totalBankBalance, false)}
              </span>
              <span className="text-xs font-semibold text-slate-400">฿</span>
            </div>

            <p className="text-xs text-slate-500 mt-1.5 flex items-center gap-1.5">
              <span>{bankAccounts.length} บัญชี</span>
              <span aria-hidden="true" className="text-slate-300">·</span>
              <span>{statementRecords.length} Statement</span>
            </p>
          </div>

          <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between gap-2 text-[11px]">
            <span className="inline-flex items-center gap-1 text-emerald-700 font-mono font-semibold tabular-nums truncate">
              <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              +{formatCurrency(totalCreditInflow, false)}
            </span>
            <span className="inline-flex items-center gap-1 text-rose-700 font-mono font-semibold tabular-nums truncate">
              <ArrowUpRight className="w-3.5 h-3.5 text-rose-600 shrink-0" />
              -{formatCurrency(totalDebitOutflow, false)}
            </span>
          </div>
        </div>

        {/* KPI 3: Receipt Volume */}
        <div className="p-5 sm:p-6 flex flex-col justify-between sm:border-t lg:border-t-0 border-slate-200/80">
          <div>
            <span className="text-xs font-medium text-slate-500 block">
              ปริมาณเอกสารใบเสร็จ
            </span>

            <div className="flex items-baseline gap-1.5 mt-2">
              <span className="text-2xl sm:text-[28px] font-bold tracking-tight text-slate-900 font-mono tabular-nums">
                {totalCount.toLocaleString()}
              </span>
              <span className="text-xs font-semibold text-slate-400">ใบ</span>
            </div>

            <p className="text-xs text-slate-500 mt-1.5">
              เฉลี่ย{' '}
              <span className="font-mono font-semibold text-slate-800 tabular-nums">
                {formatCurrency(avgAmount, false)} ฿ / ใบ
              </span>
            </p>
          </div>

          <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px]">
            <span className="text-slate-500">บันทึกวันนี้</span>
            <span className="font-mono font-semibold text-slate-800 tabular-nums">
              +{todayCount} ใบ · {formatCurrency(todayTotal, false)} ฿
            </span>
          </div>
        </div>

        {/* KPI 4: Pending & Compliance */}
        <div className="p-5 sm:p-6 flex flex-col justify-between sm:border-t lg:border-t-0 border-slate-200/80">
          <div>
            <span className="text-xs font-medium text-slate-500 block">
              รายการรอตรวจสอบ
            </span>

            <div className="flex items-baseline gap-1.5 mt-2">
              <span
                className={`text-2xl sm:text-[28px] font-bold tracking-tight font-mono tabular-nums ${
                  totalActionNeeded > 0 ? 'text-amber-700' : 'text-slate-900'
                }`}
              >
                {totalActionNeeded.toLocaleString()}
              </span>
              <span className="text-xs font-semibold text-slate-400">รายการ</span>
            </div>

            <p className="text-xs text-slate-500 mt-1.5 flex items-center gap-1.5 truncate">
              <span>รออนุมัติ {pendingCount}</span>
              <span aria-hidden="true" className="text-slate-300">·</span>
              <span>ตรวจ OCR {needsReviewCount}</span>
            </p>
          </div>

          <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px]">
            <span className="text-slate-500">ตรวจเอกสารซ้ำ</span>
            {potentialDuplicateCount > 0 ? (
              <span className="font-mono font-semibold text-rose-700 tabular-nums">
                อาจซ้ำ {potentialDuplicateCount} รายการ
              </span>
            ) : (
              <span className="font-semibold text-emerald-700">
                ไม่พบรายการซ้ำ
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Quiet Unboxed Ledger Summary Line */}
      <div className="px-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
        <span>
          โครงการที่มีความเคลื่อนไหว{' '}
          <strong className="font-mono font-semibold text-slate-800 tabular-nums">
            {activeProjectsCount} / {projects.length}
          </strong>
        </span>
        <span aria-hidden="true" className="text-slate-300 hidden sm:inline">·</span>
        <span>
          อนุมัติสมบูรณ์{' '}
          <strong className="font-mono font-semibold text-slate-800 tabular-nums">
            {approvedCount} ใบ ({formatCurrency(approvedAmount, false)} ฿)
          </strong>
        </span>
        <span aria-hidden="true" className="text-slate-300 hidden sm:inline">·</span>
        <span>
          ค้างตรวจสอบ{' '}
          <strong className="font-mono font-semibold text-amber-700 tabular-nums">
            {pendingCount} ใบ ({formatCurrency(pendingAmount, false)} ฿)
          </strong>
        </span>
      </div>
    </div>
  );
};
