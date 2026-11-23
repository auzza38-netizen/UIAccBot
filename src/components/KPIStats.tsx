import React from 'react';
import { Receipt, Project } from '../types';
import { useData } from '../context/DataContext';
import { formatCurrency } from '../utils/formatters';
import {
  ReceiptText,
  Wallet,
  Landmark,
  ShieldCheck,
  TrendingUp,
  ArrowUpRight,
  ArrowDownLeft,
  AlertCircle,
  CheckCircle2,
  Calendar,
  Layers,
  Sparkles,
  CopyCheck,
} from 'lucide-react';

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

  // Average per receipt
  const avgAmount = totalCount > 0 ? totalAmount / totalCount : 0;

  return (
    <div className="space-y-3.5 mb-6">
      {/* 4 Main Minimalist Executive Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        
        {/* CARD 1: ยอดค่าใช้จ่ายรวม (Total Expenses) */}
        <div className="group relative bg-white border border-slate-200/90 hover:border-teal-500/60 rounded-2xl p-4 sm:p-5 shadow-xs hover:shadow-md transition-all duration-200 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                ยอดค่าใช้จ่ายรวม
              </span>
              <div className="w-8 h-8 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center shrink-0 border border-teal-100/80">
                <Wallet className="w-4 h-4" />
              </div>
            </div>

            <div className="flex items-baseline gap-1.5 mt-1">
              <span className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 font-mono tabular-nums">
                {formatCurrency(totalAmount, false)}
              </span>
              <span className="text-xs font-bold text-slate-500">฿</span>
            </div>

            <p className="text-[11px] text-slate-500 mt-1 flex items-center gap-1.5">
              <span>อนุมัติแล้ว:</span>
              <span className="font-mono font-semibold text-teal-700">
                {formatCurrency(approvedAmount, false)} ฿
              </span>
            </p>
          </div>

          {/* Micro Progress Bar */}
          <div className="mt-4 pt-3 border-t border-slate-100 space-y-1.5">
            <div className="flex items-center justify-between text-[10px] text-slate-500 font-medium">
              <span>สัดส่วนการอนุมัติ</span>
              <span className="font-mono font-bold text-teal-800">{approvalRate}%</span>
            </div>
            <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-teal-500 to-teal-600 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, Math.max(approvalRate, 2))}%` }}
              />
            </div>
          </div>
        </div>

        {/* CARD 2: สินทรัพย์หมุนเวียนคงเหลือ (Liquid Assets & Cash Balance) */}
        <div className="group relative bg-white border border-slate-200/90 hover:border-blue-500/60 rounded-2xl p-4 sm:p-5 shadow-xs hover:shadow-md transition-all duration-200 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                สินทรัพย์หมุนเวียนคงเหลือ
              </span>
              <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center shrink-0 border border-blue-100/80">
                <Landmark className="w-4 h-4" />
              </div>
            </div>

            <div className="flex items-baseline gap-1.5 mt-1">
              <span className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 font-mono tabular-nums">
                {formatCurrency(totalBankBalance, false)}
              </span>
              <span className="text-xs font-bold text-slate-500">฿</span>
            </div>

            <p className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
              <span>จาก {bankAccounts.length} บัญชี</span>
              <span className="text-slate-300">·</span>
              <span>{statementRecords.length} ไฟล์ Statement</span>
            </p>
          </div>

          {/* Statement Cash Flow Micro Strip */}
          <div className="mt-4 pt-3 border-t border-slate-100 grid grid-cols-2 gap-2 text-[10px]">
            <div className="flex items-center gap-1 text-emerald-700 font-mono font-semibold truncate">
              <ArrowDownLeft className="w-3 h-3 text-emerald-600 shrink-0" />
              <span className="truncate">+{formatCurrency(totalCreditInflow, false)} ฿</span>
            </div>
            <div className="flex items-center justify-end gap-1 text-rose-700 font-mono font-semibold truncate">
              <ArrowUpRight className="w-3 h-3 text-rose-600 shrink-0" />
              <span className="truncate">-{formatCurrency(totalDebitOutflow, false)} ฿</span>
            </div>
          </div>
        </div>

        {/* CARD 3: เอกสารใบเสร็จในระบบ (Receipt Volume) */}
        <div className="group relative bg-white border border-slate-200/90 hover:border-indigo-500/60 rounded-2xl p-4 sm:p-5 shadow-xs hover:shadow-md transition-all duration-200 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                จำนวนใบเสร็จในระบบ
              </span>
              <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center shrink-0 border border-indigo-100/80">
                <ReceiptText className="w-4 h-4" />
              </div>
            </div>

            <div className="flex items-baseline gap-1.5 mt-1">
              <span className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 font-mono tabular-nums">
                {totalCount.toLocaleString()}
              </span>
              <span className="text-xs font-bold text-slate-500">ใบ</span>
            </div>

            <p className="text-[11px] text-slate-500 mt-1 flex items-center gap-1.5">
              <span>เฉลี่ย:</span>
              <span className="font-mono font-semibold text-slate-800">
                {formatCurrency(avgAmount, false)} ฿ / ใบ
              </span>
            </p>
          </div>

          {/* Today Activity Micro Tag */}
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[10px]">
            <span className="text-slate-500 flex items-center gap-1">
              <Calendar className="w-3 h-3 text-indigo-500" /> บันทึกวันนี้:
            </span>
            <span className="font-mono font-bold text-indigo-900 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100">
              +{todayCount} ใบ ({formatCurrency(todayTotal, false)} ฿)
            </span>
          </div>
        </div>

        {/* CARD 4: สถานะการตรวจสอบ & คุณภาพ (Audit & Compliance) */}
        <div className="group relative bg-white border border-slate-200/90 hover:border-amber-500/60 rounded-2xl p-4 sm:p-5 shadow-xs hover:shadow-md transition-all duration-200 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                รายการรอตรวจสอบ
              </span>
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border ${
                needsReviewCount > 0 || pendingCount > 0
                  ? 'bg-amber-50 text-amber-700 border-amber-200/80'
                  : 'bg-emerald-50 text-emerald-700 border-emerald-200/80'
              }`}>
                {needsReviewCount > 0 || pendingCount > 0 ? (
                  <AlertCircle className="w-4 h-4" />
                ) : (
                  <CheckCircle2 className="w-4 h-4" />
                )}
              </div>
            </div>

            <div className="flex items-baseline gap-1.5 mt-1">
              <span className={`text-2xl sm:text-3xl font-extrabold tracking-tight font-mono tabular-nums ${
                needsReviewCount > 0 ? 'text-amber-700' : 'text-slate-900'
              }`}>
                {(pendingCount + needsReviewCount).toLocaleString()}
              </span>
              <span className="text-xs font-bold text-slate-500">รายการ</span>
            </div>

            <p className="text-[11px] text-slate-500 mt-1 flex items-center gap-1.5 truncate">
              <span>รออนุมัติ: {pendingCount}</span>
              <span className="text-slate-300">·</span>
              <span>ต้องตรวจ OCR: {needsReviewCount}</span>
            </p>
          </div>

          {/* Duplicate check warning or safe status */}
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[10px]">
            <span className="text-slate-500 flex items-center gap-1">
              <CopyCheck className="w-3 h-3 text-slate-400" /> ตรวจสอบเอกสารซ้ำ:
            </span>
            {potentialDuplicateCount > 0 ? (
              <span className="font-mono font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200">
                อาจซ้ำ {potentialDuplicateCount} รายการ
              </span>
            ) : (
              <span className="font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                ไม่พบเอกสารซ้ำ
              </span>
            )}
          </div>
        </div>

      </div>

      {/* Secondary Quick Pulse Strip: Quick contextual stats */}
      <div className="bg-slate-50/80 border border-slate-200/80 rounded-xl px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600">
        <div className="flex flex-wrap items-center gap-4 sm:gap-6">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-teal-500" />
            <span className="text-slate-500">โครงการที่มีรายการ:</span>
            <span className="font-bold font-mono text-slate-900">
              {activeProjectsCount} / {projects.length} โครงการ
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="text-slate-500">ตรวจแล้วสมบูรณ์:</span>
            <span className="font-bold font-mono text-slate-900">
              {approvedCount} รายการ ({formatCurrency(approvedAmount, false)} ฿)
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            <span className="text-slate-500">รอการตรวจสอบ:</span>
            <span className="font-bold font-mono text-amber-800">
              {pendingCount} รายการ ({formatCurrency(pendingAmount, false)} ฿)
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1 text-[11px] text-slate-400 font-medium">
          <Sparkles className="w-3 h-3 text-teal-600" />
          <span>โหมด Frontend UI Template (ข้อมูลจำลองแบบ Interactive)</span>
        </div>
      </div>
    </div>
  );
};
