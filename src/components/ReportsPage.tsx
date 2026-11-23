import React, { useState, useMemo } from 'react';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';
import { filterReceipts } from '../utils/filterHelper';
import { formatCurrency, formatThaiDate } from '../utils/formatters';
import { exportReceiptsToExcel, exportReceiptsToCSV, exportReceiptsToPDF } from '../utils/exportUtils';
import {
  FileSpreadsheet,
  Download,
  FileText,
  Calendar,
  FolderKanban,
  Tags,
  Users,
  CheckCircle2,
  Table,
  UserCheck,
  TrendingUp,
  Search,
  Package,
} from 'lucide-react';

export const ReportsPage: React.FC = () => {
  const { receipts, projectsMap, categoriesMap, usersMap, users, filters, projects, categories } = useData();
  const { isAdmin } = useAuth();

  // Active report tab (1 to 7)
  const [reportType, setReportType] = useState<
    'daily' | 'monthly' | 'project' | 'category' | 'uploader' | 'budget' | 'items'
  >('daily');
  const [itemSearchTerm, setItemSearchTerm] = useState<string>('');

  // Filtered receipts based on current filter state
  const scopedReceipts = useMemo(() => {
    return filterReceipts(receipts, filters);
  }, [receipts, filters]);

  // สรุปยอดการคีย์ข้อมูลของแต่ละ User ทั้งหมด
  const userEntrySummaries = useMemo(() => {
    const summaryMap: Record<
      string,
      {
        email: string;
        displayName: string;
        role: 'admin' | 'user' | string;
        count: number;
        totalAmount: number;
        vatTotal: number;
        approvedCount: number;
        pendingCount: number;
        rejectedCount: number;
        draftCount: number;
        lastUploadDate: string;
      }
    > = {};

    // 1. นำรายชื่อ User ที่มีในระบบเข้ามาเป็นฐาน
    (users || []).forEach((u) => {
      const email = (u.email || '').trim();
      const emailKey = email.toLowerCase();
      if (!emailKey) return;
      summaryMap[emailKey] = {
        email,
        displayName: u.displayName || email.split('@')[0],
        role: u.role || 'user',
        count: 0,
        totalAmount: 0,
        vatTotal: 0,
        approvedCount: 0,
        pendingCount: 0,
        rejectedCount: 0,
        draftCount: 0,
        lastUploadDate: '',
      };
    });

    // 2. รวบรวมสถิติจากใบเสร็จที่ถูกกรองในหน้ารายงาน
    scopedReceipts.forEach((r) => {
      const email = (r.uploadedByEmail || 'unknown@system.local').trim();
      const emailKey = email.toLowerCase();
      if (!summaryMap[emailKey]) {
        const matched = (users || []).find((u) => u.email?.toLowerCase() === emailKey);
        summaryMap[emailKey] = {
          email,
          displayName: matched?.displayName || email.split('@')[0],
          role: matched?.role || 'user',
          count: 0,
          totalAmount: 0,
          vatTotal: 0,
          approvedCount: 0,
          pendingCount: 0,
          rejectedCount: 0,
          draftCount: 0,
          lastUploadDate: '',
        };
      }

      const item = summaryMap[emailKey];
      item.count += 1;
      item.totalAmount += r.grandTotal || 0;
      item.vatTotal += r.vatAmount || 0;
      if (r.approvalStatus === 'approved') item.approvedCount += 1;
      else if (r.approvalStatus === 'pending') item.pendingCount += 1;
      else if (r.approvalStatus === 'rejected') item.rejectedCount += 1;
      else item.draftCount += 1;

      const dateStr = r.documentDate || r.uploadDate || '';
      if (dateStr && (!item.lastUploadDate || dateStr > item.lastUploadDate)) {
        item.lastUploadDate = dateStr;
      }
    });

    const totalGrandAll = scopedReceipts.reduce((sum, r) => sum + (r.grandTotal || 0), 0);

    return Object.values(summaryMap)
      .map((item) => ({
        ...item,
        percentOfTotal: totalGrandAll > 0 ? (item.totalAmount / totalGrandAll) * 100 : 0,
        avgPerReceipt: item.count > 0 ? item.totalAmount / item.count : 0,
      }))
      .sort((a, b) => b.totalAmount - a.totalAmount || b.count - a.count);
  }, [scopedReceipts, users]);

  // Aggregate metrics
  const totalKeyedReceipts = useMemo(() => scopedReceipts.length, [scopedReceipts]);
  const totalKeyedAmount = useMemo(
    () => scopedReceipts.reduce((sum, r) => sum + (r.grandTotal || 0), 0),
    [scopedReceipts]
  );
  const totalKeyedVat = useMemo(
    () => scopedReceipts.reduce((sum, r) => sum + (r.vatAmount || 0), 0),
    [scopedReceipts]
  );
  const activeKeyersCount = useMemo(
    () => userEntrySummaries.filter((u) => u.count > 0).length,
    [userEntrySummaries]
  );

  // Aggregate by chosen report type
  const reportData = useMemo(() => {
    if (reportType === 'daily') {
      const map: Record<string, { date: string; count: number; total: number; vat: number }> = {};
      scopedReceipts.forEach((r) => {
        const d = r.documentDate || 'ไม่ระบุ';
        if (!map[d]) map[d] = { date: d, count: 0, total: 0, vat: 0 };
        map[d].count += 1;
        map[d].total += r.grandTotal || 0;
        map[d].vat += r.vatAmount || 0;
      });
      return Object.values(map).sort((a, b) => b.date.localeCompare(a.date));
    }

    if (reportType === 'monthly') {
      const map: Record<string, { month: string; count: number; total: number; vat: number }> = {};
      scopedReceipts.forEach((r) => {
        const m = (r.documentDate || '').slice(0, 7) || 'ไม่ระบุ';
        if (!map[m]) map[m] = { month: m, count: 0, total: 0, vat: 0 };
        map[m].count += 1;
        map[m].total += r.grandTotal || 0;
        map[m].vat += r.vatAmount || 0;
      });
      return Object.values(map).sort((a, b) => b.month.localeCompare(a.month));
    }

    if (reportType === 'project') {
      const map: Record<string, { projectId: string; code: string; name: string; count: number; total: number }> = {};
      scopedReceipts.forEach((r) => {
        const pId = r.projectId || 'unassigned';
        if (!map[pId]) {
          const p = projectsMap[pId];
          map[pId] = {
            projectId: pId,
            code: p?.projectCode || '-',
            name: p?.clientName || 'ไม่ระบุลูกค้า/หน่วยงาน',
            count: 0,
            total: 0,
          };
        }
        map[pId].count += 1;
        map[pId].total += r.grandTotal || 0;
      });
      return Object.values(map).sort((a, b) => b.total - a.total);
    }

    if (reportType === 'category') {
      const map: Record<string, { categoryId: string; name: string; count: number; total: number }> = {};
      scopedReceipts.forEach((r) => {
        const catId = r.categoryId || 'cat-other';
        if (!map[catId]) {
          const c = categoriesMap[catId];
          map[catId] = {
            categoryId: catId,
            name: c?.categoryName || 'ไม่ระบุหมวดหมู่',
            count: 0,
            total: 0,
          };
        }
        map[catId].count += 1;
        map[catId].total += r.grandTotal || 0;
      });
      return Object.values(map).sort((a, b) => b.total - a.total);
    }

    if (reportType === 'uploader') {
      return userEntrySummaries;
    }

    if (reportType === 'budget') {
      return projects.map((p) => {
        const pReceipts = receipts.filter((r) => r.projectId === p.projectId && !r.isDeleted);
        const spent = pReceipts.reduce((sum, r) => sum + (r.grandTotal || 0), 0);
        return {
          code: p.projectCode,
          name: p.clientName,
          spent,
          count: pReceipts.length,
        };
      });
    }

    return [];
  }, [reportType, scopedReceipts, receipts, projects, projectsMap, categoriesMap, userEntrySummaries]);

  // รวบรวมรายการสินค้าและบริการรายบรรทัด (Line Items) ทั้งหมดจากใบเสร็จ
  const allLineItems = useMemo(() => {
    const list: Array<{
      id: string;
      receiptId: string;
      receiptNumber: string;
      documentDate: string;
      vendorName: string;
      vendorAddress: string;
      customerName: string;
      customerAddress: string;
      projectCode: string;
      clientName: string;
      categoryName: string;
      itemName: string;
      quantity: number;
      unitPrice: number;
      amount: number;
      pageNumber?: number;
      uploadedByEmail: string;
      approvalStatus: string;
    }> = [];

    scopedReceipts.forEach((r) => {
      const proj = projectsMap[r.projectId];
      const cat = categoriesMap[r.categoryId];

      if (r.items && r.items.length > 0) {
        r.items.forEach((it, idx) => {
          list.push({
            id: `${r.receiptId}_${idx}`,
            receiptId: r.receiptId,
            receiptNumber: r.receiptNumber || 'ไม่มีเลขที่',
            documentDate: r.documentDate,
            vendorName: r.vendorName || '-',
            vendorAddress: r.vendorAddress || '-',
            customerName: r.customerName || proj?.clientName || '-',
            customerAddress: r.customerAddress || '-',
            projectCode: proj?.projectCode || '-',
            clientName: proj?.clientName || '-',
            categoryName: cat?.categoryName || 'ไม่ระบุ',
            itemName: it.itemName,
            quantity: it.quantity || 1,
            unitPrice: it.unitPrice || 0,
            amount: it.amount || (it.quantity && it.unitPrice ? it.quantity * it.unitPrice : 0),
            pageNumber: it.pageNumber,
            uploadedByEmail: r.uploadedByEmail || '-',
            approvalStatus: r.approvalStatus,
          });
        });
      } else {
        list.push({
          id: `${r.receiptId}_0`,
          receiptId: r.receiptId,
          receiptNumber: r.receiptNumber || 'ไม่มีเลขที่',
          documentDate: r.documentDate,
          vendorName: r.vendorName || '-',
          vendorAddress: r.vendorAddress || '-',
          customerName: r.customerName || proj?.clientName || '-',
          customerAddress: r.customerAddress || '-',
          projectCode: proj?.projectCode || '-',
          clientName: proj?.clientName || '-',
          categoryName: cat?.categoryName || 'ไม่ระบุ',
          itemName: r.vendorName ? `ค่าใช้จ่ายตามใบเสร็จ (${r.vendorName})` : 'ไม่ระบุรายการย่อย',
          quantity: 1,
          unitPrice: r.grandTotal || 0,
          amount: r.grandTotal || 0,
          pageNumber: 1,
          uploadedByEmail: r.uploadedByEmail || '-',
          approvalStatus: r.approvalStatus,
        });
      }
    });

    return list;
  }, [scopedReceipts, projectsMap, categoriesMap]);

  const filteredLineItems = useMemo(() => {
    if (!itemSearchTerm.trim()) return allLineItems;
    const term = itemSearchTerm.toLowerCase().trim();
    return allLineItems.filter(
      (item) =>
        item.itemName.toLowerCase().includes(term) ||
        item.vendorName.toLowerCase().includes(term) ||
        item.vendorAddress.toLowerCase().includes(term) ||
        item.customerName.toLowerCase().includes(term) ||
        item.customerAddress.toLowerCase().includes(term) ||
        item.receiptNumber.toLowerCase().includes(term) ||
        item.clientName.toLowerCase().includes(term) ||
        item.projectCode.toLowerCase().includes(term) ||
        item.categoryName.toLowerCase().includes(term)
    );
  }, [allLineItems, itemSearchTerm]);

  const reportTitle =
    reportType === 'daily'
      ? 'รายงานค่าใช้จ่ายประจำวัน'
      : reportType === 'monthly'
      ? 'รายงานค่าใช้จ่ายรายเดือน'
      : reportType === 'project'
      ? 'รายงานค่าใช้จ่ายแยกตามลูกค้าหรือหน่วยงาน'
      : reportType === 'category'
      ? 'รายงานค่าใช้จ่ายแยกตามหมวดหมู่'
      : reportType === 'uploader'
      ? 'รายงานสรุปยอดการคีย์ข้อมูลของแต่ละ User (Data Entry by User Report)'
      : reportType === 'budget'
      ? 'รายงานยอดสรุปงบที่ได้คีย์ข้อมูลเข้าไปแล้วทั้งหมดตามลูกค้าหรือหน่วยงาน'
      : 'รายงานรายละเอียดสินค้าและบริการรายบรรทัด (Line Items Report)';

  const handleExportExcel = () => {
    exportReceiptsToExcel({
      receipts: scopedReceipts,
      projectsMap,
      categoriesMap,
      title: reportTitle,
    });
  };

  const handleExportCSV = () => {
    exportReceiptsToCSV({
      receipts: scopedReceipts,
      projectsMap,
      categoriesMap,
      title: reportTitle,
    });
  };

  const handleExportPDF = () => {
    exportReceiptsToPDF({
      receipts: scopedReceipts,
      projectsMap,
      categoriesMap,
      title: reportTitle,
    });
  };

  return (
    <div className="space-y-5">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            รายงานสรุปและส่งออกบัญชี
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            สรุปข้อมูลค่าใช้จ่ายและส่งออกเป็นไฟล์ Excel (.xlsx), CSV หรือ PDF สำหรับงานบัญชี
          </p>
        </div>

        {/* Export Buttons */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            onClick={handleExportExcel}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#0F766E] hover:bg-[#0D645D] text-white rounded-lg text-xs font-semibold cursor-pointer transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Excel (.xlsx)</span>
          </button>
          <button
            onClick={handleExportCSV}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-lg text-xs font-semibold cursor-pointer transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>CSV</span>
          </button>
          <button
            onClick={handleExportPDF}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-[#0F172A] hover:bg-slate-800 text-white rounded-lg text-xs font-semibold cursor-pointer transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>PDF</span>
          </button>
        </div>
      </div>

      {/* User Data Entry Overview (Clean Divided Financial Grid) */}
      <div className="bg-white border border-slate-200/80 rounded-xl overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-sm font-bold text-slate-900">
              สรุปยอดการบันทึกข้อมูลรายบุคคล
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              ผู้คีย์ข้อมูล {activeKeyersCount} คน · รวม{' '}
              <span className="font-mono tabular-nums font-semibold text-slate-700">
                {totalKeyedReceipts} ใบ
              </span>{' '}
              · ยอดรวม{' '}
              <span className="font-mono tabular-nums font-semibold text-teal-700">
                {formatCurrency(totalKeyedAmount)}
              </span>
            </p>
          </div>
          <button
            onClick={() => setReportType('uploader')}
            className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
              reportType === 'uploader'
                ? 'bg-[#0F172A] text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            ดูตารางแจกแจงละเอียด
          </button>
        </div>

        {/* Flat Single-Elevation User Summary Grid */}
        <div className="p-4 sm:p-5 bg-slate-50/40 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
          {userEntrySummaries.map((u) => {
            const hasData = u.count > 0;
            return (
              <div
                key={u.email}
                onClick={() => setReportType('uploader')}
                className={`bg-white border border-slate-200/80 hover:border-slate-300 rounded-xl p-4 transition-colors flex flex-col justify-between cursor-pointer ${
                  !hasData ? 'opacity-65' : ''
                }`}
              >
                <div>
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center font-semibold text-xs shrink-0">
                      {u.displayName.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-slate-900 text-xs truncate">
                          {u.displayName}
                        </span>
                        <span className="text-[10px] text-slate-400 shrink-0">
                          · {u.role === 'admin' ? 'Admin' : 'พนักงาน'}
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-400 truncate block font-mono">
                        {u.email}
                      </span>
                    </div>
                  </div>

                  <div className="mt-3 pt-3 border-t border-slate-100">
                    <span className="text-[11px] text-slate-500 block">ยอดรวมที่บันทึก</span>
                    <div className="flex items-baseline justify-between mt-0.5">
                      <span className="text-base font-bold text-slate-900 font-mono tabular-nums">
                        {formatCurrency(u.totalAmount)}
                      </span>
                      <span className="text-xs font-semibold text-teal-700 font-mono tabular-nums">
                        {u.percentOfTotal.toFixed(1)}%
                      </span>
                    </div>
                  </div>

                  <div className="mt-2.5 flex items-center justify-between text-[11px] font-mono tabular-nums text-slate-600">
                    <span>คีย์ {u.count} ใบ</span>
                    <span className="text-emerald-700">อนุมัติ {u.approvedCount}</span>
                    {u.pendingCount > 0 && (
                      <span className="text-amber-700">รอ {u.pendingCount}</span>
                    )}
                  </div>
                </div>

                <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400 font-mono tabular-nums">
                  <span>
                    {u.avgPerReceipt > 0 ? `เฉลี่ย ${formatCurrency(u.avgPerReceipt)}/ใบ` : 'ยังไม่มีการคีย์'}
                  </span>
                  <span>{u.lastUploadDate ? formatThaiDate(u.lastUploadDate) : '-'}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Report Selection Segmented Tabs */}
      <div className="bg-slate-100/90 border border-slate-200/70 rounded-xl p-1 flex flex-wrap gap-1 text-xs">
        {[
          { id: 'daily', label: '1. รายวัน', icon: Calendar },
          { id: 'monthly', label: '2. รายเดือน', icon: Calendar },
          { id: 'project', label: '3. แยกตามโครงการ', icon: FolderKanban },
          { id: 'category', label: '4. แยกตามหมวดหมู่', icon: Tags },
          { id: 'uploader', label: '5. ยอดคีย์รายบุคคล', icon: Users },
          { id: 'budget', label: '6. สรุปงบลูกค้า/หน่วยงาน', icon: FileSpreadsheet },
          { id: 'items', label: '7. รายการสินค้า (Line Items)', icon: Package },
        ].map((tab) => {
          const Icon = tab.icon;
          const active = reportType === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setReportType(tab.id as any)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer whitespace-nowrap ${
                active
                  ? 'bg-white text-slate-900 font-semibold shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Report Display Table */}
      <div className="bg-white border border-slate-200/80 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200/80 flex items-center justify-between">
          <div>
            <h3 className="font-display text-sm font-bold text-slate-900">{reportTitle}</h3>
            <span className="text-[11px] text-slate-500">
              ข้อมูลอ้างอิงตามตัวกรอง: {scopedReceipts.length} รายการใบเสร็จ
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          {reportType === 'daily' && (
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-2.5 px-4">วันที่เอกสาร</th>
                  <th className="py-2.5 px-4 text-center">จำนวนใบเสร็จ</th>
                  <th className="py-2.5 px-4 text-right">ภาษี VAT รวม</th>
                  <th className="py-2.5 px-4 text-right">ยอดเงินรวมสุทธิ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono tabular-nums">
                {(reportData as any[]).map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-50">
                    <td className="py-2.5 px-4 font-sans font-medium text-slate-800">
                      {formatThaiDate(row.date)}
                    </td>
                    <td className="py-2.5 px-4 text-center">{row.count} ใบ</td>
                    <td className="py-2.5 px-4 text-right text-slate-600">{formatCurrency(row.vat)}</td>
                    <td className="py-2.5 px-4 text-right font-bold text-slate-900">{formatCurrency(row.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {reportType === 'monthly' && (
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-2.5 px-4">เดือน / ปี</th>
                  <th className="py-2.5 px-4 text-center">จำนวนใบเสร็จ</th>
                  <th className="py-2.5 px-4 text-right">ภาษี VAT รวม</th>
                  <th className="py-2.5 px-4 text-right">ยอดเงินรวมสุทธิ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono tabular-nums">
                {(reportData as any[]).map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-50">
                    <td className="py-2.5 px-4 font-sans font-medium text-slate-800">{row.month}</td>
                    <td className="py-2.5 px-4 text-center">{row.count} ใบ</td>
                    <td className="py-2.5 px-4 text-right text-slate-600">{formatCurrency(row.vat)}</td>
                    <td className="py-2.5 px-4 text-right font-bold text-slate-900">{formatCurrency(row.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {reportType === 'project' && (
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-2.5 px-4">รหัสโครงการ</th>
                  <th className="py-2.5 px-4">ชื่อลูกค้า / หน่วยงาน</th>
                  <th className="py-2.5 px-4 text-center">จำนวนใบเสร็จ</th>
                  <th className="py-2.5 px-4 text-right">ยอดค่าใช้จ่ายรวม</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(reportData as any[]).map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-50">
                    <td className="py-2.5 px-4 font-mono font-bold text-teal-800">{row.code}</td>
                    <td className="py-2.5 px-4 font-medium text-slate-800">{row.name}</td>
                    <td className="py-2.5 px-4 text-center font-mono tabular-nums">{row.count} ใบ</td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums font-bold text-slate-900">
                      {formatCurrency(row.total)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {reportType === 'category' && (
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-2.5 px-4">หมวดหมู่ค่าใช้จ่าย</th>
                  <th className="py-2.5 px-4 text-center">จำนวนใบเสร็จ</th>
                  <th className="py-2.5 px-4 text-right">ยอดเงินรวมสุทธิ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(reportData as any[]).map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-50">
                    <td className="py-2.5 px-4 font-medium text-slate-800">{row.name}</td>
                    <td className="py-2.5 px-4 text-center font-mono tabular-nums">{row.count} ใบ</td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums font-bold text-slate-900">
                      {formatCurrency(row.total)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {reportType === 'uploader' && (
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-2.5 px-4 text-center">#</th>
                  <th className="py-2.5 px-4">ผู้บันทึกข้อมูล (User)</th>
                  <th className="py-2.5 px-4 text-center">จำนวนที่คีย์</th>
                  <th className="py-2.5 px-4 text-center">สัดส่วน (%)</th>
                  <th className="py-2.5 px-4 text-right">ภาษี VAT รวม</th>
                  <th className="py-2.5 px-4 text-center">อนุมัติแล้ว</th>
                  <th className="py-2.5 px-4 text-center">รอตรวจสอบ</th>
                  <th className="py-2.5 px-4 text-right">เฉลี่ยต่อใบ</th>
                  <th className="py-2.5 px-4 text-right">ยอดสรุปการคีย์ข้อมูลทั้งหมด</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono tabular-nums">
                {(reportData as any[]).map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-50 transition">
                    <td className="py-2.5 px-4 text-center text-slate-400 font-mono">{idx + 1}</td>
                    <td className="py-2.5 px-4 font-sans font-medium text-slate-800">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-[#0F172A] text-white flex items-center justify-center text-[10px] font-bold shrink-0">
                          {row.displayName?.charAt(0).toUpperCase() || 'U'}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-slate-900">{row.displayName}</span>
                            <span
                              className={`text-[9px] px-1.5 py-0.2 rounded font-semibold ${
                                row.role === 'admin'
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-slate-100 text-slate-600'
                              }`}
                            >
                              {row.role === 'admin' ? 'Master Admin' : 'พนักงาน'}
                            </span>
                          </div>
                          <span className="text-[11px] text-slate-400 font-mono block">
                            {row.email}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="py-2.5 px-4 text-center font-bold text-slate-800">
                      {row.count} ใบ
                    </td>
                    <td className="py-2.5 px-4 text-center text-slate-600">
                      {Number(row.percentOfTotal || 0).toFixed(1)}%
                    </td>
                    <td className="py-2.5 px-4 text-right text-slate-600">
                      {formatCurrency(row.vatTotal || 0)}
                    </td>
                    <td className="py-2.5 px-4 text-center text-emerald-700 font-semibold">
                      {row.approvedCount || 0} ใบ
                    </td>
                    <td className="py-2.5 px-4 text-center text-amber-600 font-semibold">
                      {row.pendingCount || 0} ใบ
                    </td>
                    <td className="py-2.5 px-4 text-right text-slate-500">
                      {formatCurrency(row.avgPerReceipt || 0)}
                    </td>
                    <td className="py-2.5 px-4 text-right font-bold text-teal-800 text-sm">
                      {formatCurrency(row.totalAmount || 0)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-50/90 border-t-2 border-slate-200 font-mono tabular-nums text-xs">
                <tr>
                  <td colSpan={2} className="py-3 px-4 font-sans font-bold text-slate-900">
                    รวมทั้งสิ้น ({activeKeyersCount} ท่าน)
                  </td>
                  <td className="py-3 px-4 text-center font-bold text-slate-900">
                    {totalKeyedReceipts} ใบ
                  </td>
                  <td className="py-3 px-4 text-center font-bold text-slate-900">
                    100.0%
                  </td>
                  <td className="py-3 px-4 text-right font-bold text-slate-900">
                    {formatCurrency(totalKeyedVat)}
                  </td>
                  <td className="py-3 px-4 text-center font-bold text-emerald-700">
                    {userEntrySummaries.reduce((sum, u) => sum + u.approvedCount, 0)} ใบ
                  </td>
                  <td className="py-3 px-4 text-center font-bold text-amber-600">
                    {userEntrySummaries.reduce((sum, u) => sum + u.pendingCount, 0)} ใบ
                  </td>
                  <td className="py-3 px-4 text-right font-bold text-slate-500">
                    {totalKeyedReceipts > 0 ? formatCurrency(totalKeyedAmount / totalKeyedReceipts) : '-'}
                  </td>
                  <td className="py-3 px-4 text-right font-extrabold text-teal-800 text-sm">
                    {formatCurrency(totalKeyedAmount)}
                  </td>
                </tr>
              </tfoot>
            </table>
          )}

          {reportType === 'budget' && (
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-2.5 px-4">ลูกค้า / หน่วยงาน (รหัสโครงการ)</th>
                  <th className="py-2.5 px-4 text-center">จำนวนใบเสร็จ</th>
                  <th className="py-2.5 px-4 text-right">ยอดสรุปงบ ที่ได้คีย์ข้อมูลเข้าไปแล้วทั้งหมด</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono tabular-nums">
                {(reportData as any[]).map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-50">
                    <td className="py-2.5 px-4 font-sans font-medium text-slate-800">
                      {row.code} - {row.name}
                    </td>
                    <td className="py-2.5 px-4 text-center font-mono tabular-nums text-slate-600">
                      {row.count} ใบ
                    </td>
                    <td className="py-2.5 px-4 text-right font-bold text-teal-800 text-sm">
                      {formatCurrency(row.spent)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {reportType === 'items' && (
            <div className="space-y-3 p-4">
              {/* Filter / Search inside line items */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div className="relative flex-1 max-w-md">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={itemSearchTerm}
                    onChange={(e) => setItemSearchTerm(e.target.value)}
                    placeholder="ค้นหาชื่อสินค้า, ลูกค้า, ที่อยู่, ร้านค้า, เลขที่ใบเสร็จ หรือโครงการ..."
                    className="w-full pl-9 pr-8 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
                  />
                  {itemSearchTerm && (
                    <button
                      onClick={() => setItemSearchTerm('')}
                      className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 text-xs font-bold"
                    >
                      ✕
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="font-semibold text-slate-600">
                    พบ <strong className="text-teal-700 font-mono">{filteredLineItems.length}</strong> รายการ
                  </span>
                  <span className="text-slate-300">|</span>
                  <span className="font-semibold text-slate-600">
                    ยอดรวม:{' '}
                    <strong className="text-teal-800 font-mono">
                      {formatCurrency(filteredLineItems.reduce((s, it) => s + (it.amount || 0), 0))}
                    </strong>
                  </span>
                </div>
              </div>

              {filteredLineItems.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-xs">
                  <Package className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  {itemSearchTerm ? 'ไม่พบรายการสินค้าที่ตรงกับคำค้นหา' : 'ยังไม่มีข้อมูลรายการสินค้าหรือบริการ'}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 uppercase tracking-wider text-[11px]">
                      <tr>
                        <th className="py-2.5 px-3 text-center w-12">#</th>
                        <th className="py-2.5 px-3">วันที่</th>
                        <th className="py-2.5 px-3">เลขที่ใบเสร็จ</th>
                        <th className="py-2.5 px-3">ชื่อลูกค้า / ผู้ซื้อ (ในบิล)</th>
                        <th className="py-2.5 px-3">ที่อยู่ผู้ซื้อ</th>
                        <th className="py-2.5 px-3">ชื่อสินค้า / บริการ</th>
                        <th className="py-2.5 px-3 text-center">จำนวน</th>
                        <th className="py-2.5 px-3 text-right">ราคา/หน่วย</th>
                        <th className="py-2.5 px-3 text-right">รวมเป็นเงิน</th>
                        <th className="py-2.5 px-3">ร้านค้า / ผู้ขาย</th>
                        <th className="py-2.5 px-3">ที่อยู่ผู้ขาย</th>
                        <th className="py-2.5 px-3">โครงการ</th>
                        <th className="py-2.5 px-3">หมวดหมู่</th>
                        <th className="py-2.5 px-3">ผู้บันทึก</th>
                        <th className="py-2.5 px-3 text-center">สถานะ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredLineItems.map((item, idx) => (
                        <tr key={item.id} className="hover:bg-slate-50 transition">
                          <td className="py-2.5 px-3 text-center text-slate-400 font-mono text-[11px]">
                            {idx + 1}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-slate-600 whitespace-nowrap">
                            {formatThaiDate(item.documentDate)}
                          </td>
                          <td className="py-2.5 px-3 font-mono font-semibold text-slate-800 whitespace-nowrap">
                            {item.receiptNumber}
                          </td>
                          <td className="py-2.5 px-3 font-semibold text-teal-900 max-w-[160px] truncate" title={item.customerName}>
                            {item.customerName}
                          </td>
                          <td className="py-2.5 px-3 text-slate-500 max-w-[160px] truncate" title={item.customerAddress}>
                            {item.customerAddress}
                          </td>
                          <td className="py-2.5 px-3 font-medium text-slate-900">
                            <div className="flex items-center gap-1.5">
                              <span>{item.itemName}</span>
                              {item.pageNumber && (
                                <span className="text-[10px] text-blue-600 bg-blue-50 px-1 rounded font-mono">
                                  น.{item.pageNumber}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-2.5 px-3 text-center font-mono tabular-nums text-slate-700">
                            {item.quantity}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-600">
                            {formatCurrency(item.unitPrice, false)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono tabular-nums font-bold text-teal-800">
                            {formatCurrency(item.amount)}
                          </td>
                          <td className="py-2.5 px-3 text-slate-700 max-w-[140px] truncate" title={item.vendorName}>
                            {item.vendorName}
                          </td>
                          <td className="py-2.5 px-3 text-slate-500 max-w-[160px] truncate" title={item.vendorAddress}>
                            {item.vendorAddress}
                          </td>
                          <td className="py-2.5 px-3 text-slate-600 max-w-[120px] truncate" title={item.clientName}>
                            <span className="font-mono text-teal-700 font-semibold">{item.projectCode}</span>
                          </td>
                          <td className="py-2.5 px-3 text-slate-600 whitespace-nowrap">
                            {item.categoryName}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-[11px] text-slate-400 whitespace-nowrap">
                            {item.uploadedByEmail.split('@')[0]}
                          </td>
                          <td className="py-2.5 px-3 text-center whitespace-nowrap">
                            <span
                              className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                                item.approvalStatus === 'approved'
                                  ? 'bg-emerald-50 text-emerald-700'
                                  : item.approvalStatus === 'rejected'
                                  ? 'bg-rose-50 text-rose-700'
                                  : 'bg-amber-50 text-amber-700'
                              }`}
                            >
                              {item.approvalStatus === 'approved'
                                ? 'อนุมัติแล้ว'
                                : item.approvalStatus === 'rejected'
                                ? 'ไม่อนุมัติ'
                                : 'รออนุมัติ'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-slate-50/90 border-t-2 border-slate-200 font-mono tabular-nums text-xs">
                      <tr>
                        <td colSpan={6} className="py-2.5 px-3 font-sans font-bold text-slate-900">
                          รวมทั้งสิ้น ({filteredLineItems.length} รายการสินค้า)
                        </td>
                        <td className="py-2.5 px-3 text-center font-bold text-slate-900">
                          {filteredLineItems.reduce((s, it) => s + (it.quantity || 0), 0)}
                        </td>
                        <td className="py-2.5 px-3"></td>
                        <td className="py-2.5 px-3 text-right font-extrabold text-teal-800 text-sm">
                          {formatCurrency(filteredLineItems.reduce((s, it) => s + (it.amount || 0), 0))}
                        </td>
                        <td colSpan={6}></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
