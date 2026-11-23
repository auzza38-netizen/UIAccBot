import React, { useState, useMemo, useEffect } from 'react';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';
import { Receipt } from '../types';
import { formatCurrency, formatThaiDate } from '../utils/formatters';
import {
  FileText,
  Search,
  CheckCircle2,
  CheckCheck,
  XCircle,
  Clock,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Eye,
  CheckSquare,
  Square,
  MinusSquare,
  Trash2,
  AlertTriangle,
  Loader2,
  X,
  Edit3,
} from 'lucide-react';

interface ReceiptsTableProps {
  receipts: Receipt[];
  onSelectReceipt: (receipt: Receipt) => void;
  onEditReceipt?: (receipt: Receipt) => void;
  onOpenUpload: () => void;
}

export const ReceiptsTable: React.FC<ReceiptsTableProps> = ({
  receipts,
  onSelectReceipt,
  onEditReceipt,
  onOpenUpload,
}) => {
  const {
    projectsMap,
    categoriesMap,
    batchDeleteReceipts,
    batchApproveReceipts,
    receipts: allDbReceipts,
    filters,
    setFilters,
  } = useData();
  const { currentUser } = useAuth();

  // Search & Sorting
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [sortField, setSortField] = useState<'documentDate' | 'grandTotal' | 'vendorName'>('documentDate');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Pagination
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 15;

  // Selection & Batch Action State
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [deleteConfirmMode, setDeleteConfirmMode] = useState<'selected' | 'all' | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Approval Batch Action State
  const [approveConfirmMode, setApproveConfirmMode] = useState<'selected' | 'all' | null>(null);
  const [isApproving, setIsApproving] = useState<boolean>(false);
  const [approveError, setApproveError] = useState<string | null>(null);
  const [approveNote, setApproveNote] = useState<string>('');

  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => setToastMessage(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  const handleSort = (field: 'documentDate' | 'grandTotal' | 'vendorName') => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  // Filtered and sorted receipts
  const processedReceipts = useMemo(() => {
    let result = [...receipts];

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase().trim();
      result = result.filter(
        (r) =>
          (r.vendorName && r.vendorName.toLowerCase().includes(q)) ||
          (r.receiptNumber && r.receiptNumber.toLowerCase().includes(q)) ||
          (projectsMap[r.projectId]?.clientName &&
            projectsMap[r.projectId].clientName.toLowerCase().includes(q)) ||
          (r.uploadedByEmail && r.uploadedByEmail.toLowerCase().includes(q))
      );
    }

    result.sort((a, b) => {
      let cmp = 0;
      if (sortField === 'documentDate') {
        cmp = (a.documentDate || '').localeCompare(b.documentDate || '');
      } else if (sortField === 'grandTotal') {
        cmp = (a.grandTotal || 0) - (b.grandTotal || 0);
      } else if (sortField === 'vendorName') {
        cmp = (a.vendorName || '').localeCompare(b.vendorName || '');
      }
      return sortDirection === 'asc' ? cmp : -cmp;
    });

    return result;
  }, [receipts, searchTerm, sortField, sortDirection, projectsMap]);

  const validSelectedIds = useMemo(() => {
    const validSet = new Set(processedReceipts.map((r) => r.receiptId));
    return selectedIds.filter((id) => validSet.has(id));
  }, [selectedIds, processedReceipts]);

  const isAllSelected =
    processedReceipts.length > 0 && validSelectedIds.length === processedReceipts.length;
  const isSomeSelected =
    validSelectedIds.length > 0 && validSelectedIds.length < processedReceipts.length;

  const handleToggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds([]);
    } else {
      setSelectedIds(processedReceipts.map((r) => r.receiptId));
    }
  };

  const handleToggleSelect = (receiptId: string) => {
    setSelectedIds((prev) =>
      prev.includes(receiptId) ? prev.filter((id) => id !== receiptId) : [...prev, receiptId]
    );
  };

  const handleClearSelection = () => {
    setSelectedIds([]);
  };

  const handleExecuteDelete = async () => {
    if (!deleteConfirmMode) return;
    setIsDeleting(true);
    setDeleteError(null);

    const targetIds =
      deleteConfirmMode === 'selected'
        ? validSelectedIds
        : processedReceipts.map((r) => r.receiptId);

    if (targetIds.length === 0) {
      setDeleteConfirmMode(null);
      setIsDeleting(false);
      return;
    }

    try {
      await batchDeleteReceipts(targetIds);
      setToastMessage({
        type: 'success',
        text: `ลบรายการใบเสร็จเรียบร้อยแล้ว (${targetIds.length} รายการ)`,
      });
      setSelectedIds([]);
      setDeleteConfirmMode(null);
    } catch (err: any) {
      setDeleteError(err.message || 'เกิดข้อผิดพลาดในการลบใบเสร็จ');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleExecuteApprove = async () => {
    if (!approveConfirmMode) return;
    setIsApproving(true);
    setApproveError(null);

    const targetIds =
      approveConfirmMode === 'selected'
        ? validSelectedIds
        : processedReceipts.map((r) => r.receiptId);

    if (targetIds.length === 0) {
      setApproveConfirmMode(null);
      setIsApproving(false);
      return;
    }

    try {
      await batchApproveReceipts(targetIds, approveNote);
      setToastMessage({
        type: 'success',
        text: `อนุมัติรายการใบเสร็จเรียบร้อยแล้ว (${targetIds.length} รายการ)`,
      });
      setSelectedIds([]);
      setApproveConfirmMode(null);
      setApproveNote('');
    } catch (err: any) {
      setApproveError(err.message || 'เกิดข้อผิดพลาดในการอนุมัติใบเสร็จ');
    } finally {
      setIsApproving(false);
    }
  };

  const totalPages = Math.ceil(processedReceipts.length / pageSize) || 1;
  const paginatedReceipts = processedReceipts.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  const getStatusBadge = (r: Receipt) => {
    switch (r.approvalStatus) {
      case 'approved':
        return (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span>อนุมัติแล้ว</span>
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-rose-700">
            <XCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
            <span>ไม่อนุมัติ</span>
          </span>
        );
      case 'draft':
        return (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-500">
            <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span>ฉบับร่าง</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700">
            <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
            <span>รออนุมัติ</span>
          </span>
        );
    }
  };

  return (
    <div className="bg-white border border-slate-200/90 rounded-xl overflow-hidden">
      {/* Toast Feedback */}
      {toastMessage && (
        <div
          className={`px-4 py-3 border-b flex items-center justify-between gap-2 text-xs font-medium ${
            toastMessage.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {toastMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{toastMessage.text}</span>
          </div>
          <button
            onClick={() => setToastMessage(null)}
            className="p-1 rounded text-slate-400 hover:text-slate-600 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Table Header Controls */}
      <div className="p-4 border-b border-slate-200/80 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <h3 className="font-display text-sm font-bold text-slate-900">
            รายการใบเสร็จรับเงิน
          </h3>
          <span className="text-xs text-slate-500 font-mono tabular-nums">
            {processedReceipts.length}
            {allDbReceipts.length > processedReceipts.length
              ? ` / ${allDbReceipts.length} รายการ`
              : ' รายการ'}
          </span>
          {filters.datePreset !== 'all' && allDbReceipts.length > processedReceipts.length && (
            <button
              onClick={() =>
                setFilters((prev) => ({ ...prev, datePreset: 'all', projectId: 'all' }))
              }
              className="text-xs font-semibold text-teal-700 hover:underline cursor-pointer"
            >
              แสดงทั้งหมด
            </button>
          )}
        </div>

        <div className="flex items-center gap-2.5">
          <div className="relative flex-1 sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
            <input
              type="text"
              placeholder="ค้นหาชื่อร้าน, เลขที่, โครงการ..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full h-9 pl-8.5 pr-3 border border-slate-200 rounded-lg bg-white text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600"
            />
          </div>

          <button
            onClick={onOpenUpload}
            className="h-9 px-3.5 bg-[#0F766E] hover:bg-[#115E59] text-white rounded-lg text-xs font-semibold shrink-0 cursor-pointer transition-colors whitespace-nowrap"
          >
            + บันทึกใบเสร็จ
          </button>
        </div>
      </div>

      {/* Selection and Batch Operations Bar */}
      <div className="px-4 py-2.5 bg-slate-50/80 border-b border-slate-200/80 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={handleToggleSelectAll}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold border transition-colors cursor-pointer ${
              isAllSelected
                ? 'bg-slate-900 text-white border-slate-900'
                : isSomeSelected
                ? 'bg-teal-50 text-teal-900 border-teal-300'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100/70'
            }`}
          >
            {isAllSelected ? (
              <CheckSquare className="w-3.5 h-3.5" />
            ) : isSomeSelected ? (
              <MinusSquare className="w-3.5 h-3.5 text-teal-700" />
            ) : (
              <Square className="w-3.5 h-3.5 text-slate-400" />
            )}
            <span>เลือกทั้งหมด</span>
            <span className="font-mono tabular-nums opacity-75">({processedReceipts.length})</span>
          </button>

          {validSelectedIds.length > 0 ? (
            <div className="flex items-center gap-2 text-xs">
              <span className="font-semibold text-teal-800 font-mono tabular-nums">
                เลือก {validSelectedIds.length} รายการ
              </span>
              <span aria-hidden="true" className="text-slate-300">·</span>
              <button
                type="button"
                onClick={handleClearSelection}
                className="text-slate-500 hover:text-slate-800 hover:underline cursor-pointer"
              >
                ยกเลิกการเลือก
              </button>
            </div>
          ) : (
            <span className="text-slate-400 hidden sm:inline">
              เลือกรายการที่ต้องการอนุมัติหรือลบพร้อมกัน
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={validSelectedIds.length === 0}
            onClick={() => {
              setApproveError(null);
              setApproveNote('');
              setApproveConfirmMode('selected');
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#0F766E] hover:bg-[#115E59] disabled:opacity-40 text-white rounded-lg font-semibold text-xs transition-colors cursor-pointer whitespace-nowrap"
          >
            <CheckCheck className="w-3.5 h-3.5" />
            <span>อนุมัติที่เลือก</span>
            {validSelectedIds.length > 0 && (
              <span className="font-mono tabular-nums">({validSelectedIds.length})</span>
            )}
          </button>

          <button
            type="button"
            disabled={processedReceipts.length === 0}
            onClick={() => {
              setApproveError(null);
              setApproveNote('');
              setApproveConfirmMode('all');
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-emerald-50 text-emerald-800 border border-slate-200 disabled:opacity-40 rounded-lg font-semibold text-xs transition-colors cursor-pointer whitespace-nowrap"
          >
            <CheckCheck className="w-3.5 h-3.5 text-emerald-700" />
            <span>อนุมัติทั้งหมด</span>
          </button>

          <span className="h-4 w-px bg-slate-200 mx-0.5 hidden sm:inline-block" />

          <button
            type="button"
            disabled={validSelectedIds.length === 0}
            onClick={() => {
              setDeleteError(null);
              setDeleteConfirmMode('selected');
            }}
            className="inline-flex items-center gap-1 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-40 text-white rounded-lg font-semibold text-xs transition-colors cursor-pointer whitespace-nowrap"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>ลบที่เลือก</span>
            {validSelectedIds.length > 0 && (
              <span className="font-mono tabular-nums">({validSelectedIds.length})</span>
            )}
          </button>

          <button
            type="button"
            disabled={processedReceipts.length === 0}
            onClick={() => {
              setDeleteError(null);
              setDeleteConfirmMode('all');
            }}
            className="inline-flex items-center gap-1 px-3 py-1.5 bg-white hover:bg-rose-50 text-rose-700 border border-slate-200 disabled:opacity-40 rounded-lg font-semibold text-xs transition-colors cursor-pointer whitespace-nowrap"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>ลบทั้งหมด</span>
          </button>
        </div>
      </div>

      {/* Data Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50/70 text-slate-500 font-semibold border-b border-slate-200 text-[11px]">
            <tr>
              <th className="py-3 px-3 w-10 text-center">
                <input
                  type="checkbox"
                  checked={isAllSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = isSomeSelected;
                  }}
                  onChange={handleToggleSelectAll}
                  className="w-4 h-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500 cursor-pointer"
                  title="เลือกทั้งหมด"
                />
              </th>
              <th className="py-3 px-3 w-12 text-center">เอกสาร</th>
              <th
                onClick={() => handleSort('documentDate')}
                className="py-3 px-3 cursor-pointer hover:text-slate-900 whitespace-nowrap"
              >
                <div className="flex items-center gap-1">
                  <span>วันที่ใบเสร็จ</span>
                  <ArrowUpDown className="w-3 h-3" />
                </div>
              </th>
              <th className="py-3 px-3 whitespace-nowrap">วันที่บันทึก</th>
              <th className="py-3 px-3">โครงการ / หน่วยงาน</th>
              <th
                onClick={() => handleSort('vendorName')}
                className="py-3 px-3 cursor-pointer hover:text-slate-900"
              >
                <div className="flex items-center gap-1">
                  <span>ร้านค้า / เลขที่</span>
                  <ArrowUpDown className="w-3 h-3" />
                </div>
              </th>
              <th className="py-3 px-3">หมวดหมู่</th>
              <th
                onClick={() => handleSort('grandTotal')}
                className="py-3 px-3 text-right cursor-pointer hover:text-slate-900 whitespace-nowrap"
              >
                <div className="flex items-center justify-end gap-1">
                  <span>ยอดเงิน (บาท)</span>
                  <ArrowUpDown className="w-3 h-3" />
                </div>
              </th>
              <th className="py-3 px-3">ผู้บันทึก</th>
              <th className="py-3 px-3 text-center">สถานะ</th>
              <th className="py-3 px-3 text-center">จัดการ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {paginatedReceipts.length > 0 ? (
              paginatedReceipts.map((r) => {
                const project = projectsMap[r.projectId];
                const category = categoriesMap[r.categoryId];
                const isSelected = validSelectedIds.includes(r.receiptId);

                return (
                  <tr
                    key={r.receiptId}
                    onClick={() => onSelectReceipt(r)}
                    className={`cursor-pointer transition-colors ${
                      isSelected ? 'bg-teal-50/60 hover:bg-teal-50' : 'hover:bg-slate-50/90'
                    }`}
                  >
                    <td className="py-2.5 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleToggleSelect(r.receiptId)}
                        className="w-4 h-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500 cursor-pointer"
                        title="เลือกรายการ"
                      />
                    </td>

                    <td className="py-2.5 px-3 text-center">
                      <div className="w-9 h-9 rounded-lg bg-slate-100 border border-slate-200/80 overflow-hidden flex items-center justify-center mx-auto">
                        {r.receiptImageUrl ? (
                          <img
                            src={r.receiptImageUrl}
                            alt={r.vendorName || 'ภาพใบเสร็จ'}
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <FileText className="w-4 h-4 text-slate-400" />
                        )}
                      </div>
                    </td>

                    <td className="py-2.5 px-3 font-medium text-slate-900 whitespace-nowrap">
                      {formatThaiDate(r.documentDate)}
                    </td>

                    <td className="py-2.5 px-3 text-slate-500 whitespace-nowrap">
                      {formatThaiDate(r.uploadDate)}
                    </td>

                    <td className="py-2.5 px-3">
                      <span className="font-mono font-semibold text-slate-800 block truncate max-w-[150px]">
                        {project ? project.projectCode : '-'}
                      </span>
                      <span className="text-[11px] text-slate-500 block truncate max-w-[150px]">
                        {project ? project.clientName : '-'}
                      </span>
                    </td>

                    <td className="py-2.5 px-3">
                      <span className="font-semibold text-slate-900 block truncate max-w-[170px]">
                        {r.vendorName || 'ไม่ระบุชื่อร้าน'}
                      </span>
                      <span className="text-[11px] text-slate-400 font-mono block">
                        {r.receiptNumber ? `#${r.receiptNumber}` : 'ไม่มีเลขที่'}
                      </span>
                    </td>

                    <td className="py-2.5 px-3 text-slate-700 whitespace-nowrap">
                      {category ? category.categoryName : 'ไม่ระบุ'}
                    </td>

                    <td className="py-2.5 px-3 text-right font-mono tabular-nums font-semibold text-slate-900 whitespace-nowrap">
                      {formatCurrency(r.grandTotal, false)}
                    </td>

                    <td className="py-2.5 px-3 text-slate-500 truncate max-w-[120px]">
                      {r.uploadedByEmail?.split('@')[0] || '-'}
                    </td>

                    <td className="py-2.5 px-3 text-center whitespace-nowrap">
                      {getStatusBadge(r)}
                    </td>

                    <td
                      className="py-2.5 px-3 text-center whitespace-nowrap"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => onSelectReceipt(r)}
                          className="px-2.5 py-1 text-xs text-teal-700 hover:bg-teal-50 rounded-md font-medium inline-flex items-center gap-1 cursor-pointer transition-colors"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>ตรวจดู</span>
                        </button>
                        {onEditReceipt && (
                          <button
                            onClick={() => onEditReceipt(r)}
                            className="px-2.5 py-1 text-xs text-slate-700 hover:bg-slate-100 rounded-md font-medium inline-flex items-center gap-1 cursor-pointer transition-colors"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            <span>แก้ไข</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={11} className="py-14 text-center text-slate-400">
                  <FileText className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                  <p className="font-medium text-slate-600">ไม่พบรายการใบเสร็จตามเงื่อนไขที่เลือก</p>
                  <p className="text-xs text-slate-400 mt-1">
                    ลองปรับตัวกรอง หรือคลิก "+ บันทึกใบเสร็จ" เพื่อเพิ่มรายการใหม่
                  </p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      <div className="px-4 py-3 border-t border-slate-200/80 flex items-center justify-between text-xs text-slate-500 bg-slate-50/50">
        <span className="font-mono tabular-nums">
          แสดง {processedReceipts.length === 0 ? 0 : (currentPage - 1) * pageSize + 1} ถึง{' '}
          {Math.min(currentPage * pageSize, processedReceipts.length)} จากทั้งหมด{' '}
          {processedReceipts.length} รายการ
        </span>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="p-1.5 rounded-lg border border-slate-200 bg-white disabled:opacity-40 hover:bg-slate-100 cursor-pointer transition-colors"
            aria-label="หน้าก่อนหน้า"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="px-2 font-mono tabular-nums font-medium text-slate-700">
            {currentPage} / {totalPages}
          </span>
          <button
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="p-1.5 rounded-lg border border-slate-200 bg-white disabled:opacity-40 hover:bg-slate-100 cursor-pointer transition-colors"
            aria-label="หน้าถัดไป"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Batch Delete Confirmation Modal */}
      {deleteConfirmMode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md border border-slate-200 overflow-hidden flex flex-col">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2.5 text-slate-900">
                <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                  <Trash2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-display text-sm font-bold leading-tight">
                    {deleteConfirmMode === 'selected' ? 'ยืนยันลบรายการที่เลือก' : 'ยืนยันลบใบเสร็จทั้งหมด'}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    ตรวจสอบจำนวนและยอดรวมก่อนยืนยัน
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  if (!isDeleting) setDeleteConfirmMode(null);
                }}
                disabled={isDeleting}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs text-slate-700">
              {(() => {
                const targets =
                  deleteConfirmMode === 'selected'
                    ? processedReceipts.filter((r) => validSelectedIds.includes(r.receiptId))
                    : processedReceipts;
                const totalAmount = targets.reduce((sum, r) => sum + (r.grandTotal || 0), 0);

                return (
                  <div className="bg-rose-50/60 border border-rose-200 rounded-lg p-4 space-y-2 text-rose-950">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-600">จำนวนใบเสร็จที่จะลบ</span>
                      <strong className="font-mono tabular-nums text-sm text-rose-700">
                        {targets.length} รายการ
                      </strong>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-600">ยอดเงินรวมทั้งหมด</span>
                      <strong className="font-mono tabular-nums text-sm text-rose-700">
                        {formatCurrency(totalAmount)}
                      </strong>
                    </div>
                  </div>
                );
              })()}

              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <p className="leading-relaxed">
                  เมื่อยืนยัน รายการเหล่านี้จะถูกนำออกจากตารางและรายงาน (บันทึกประวัติไว้ใน Audit Log)
                </p>
              </div>

              {deleteError && (
                <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{deleteError}</span>
                </div>
              )}

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={() => setDeleteConfirmMode(null)}
                  className="px-4 py-2 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 font-medium cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={handleExecuteDelete}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-75 text-white rounded-lg font-semibold cursor-pointer transition-colors"
                >
                  {isDeleting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>กำลังลบ...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4" />
                      <span>{deleteConfirmMode === 'selected' ? 'ยืนยันลบที่เลือก' : 'ยืนยันลบทั้งหมด'}</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Batch Approval Confirmation Modal */}
      {approveConfirmMode && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full shadow-xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2.5 text-slate-900">
                <div className="w-8 h-8 rounded-lg bg-teal-50 flex items-center justify-center text-teal-700 shrink-0">
                  <CheckCheck className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm leading-tight">ยืนยันการอนุมัติใบเสร็จรับเงิน</h3>
                  <p className="text-[11px] text-slate-500">
                    {approveConfirmMode === 'selected' ? 'อนุมัติเฉพาะรายการที่เลือก' : 'อนุมัติทุกรายการตามตัวกรอง'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                disabled={isApproving}
                onClick={() => setApproveConfirmMode(null)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              {(() => {
                const targets =
                  approveConfirmMode === 'selected'
                    ? processedReceipts.filter((r) => validSelectedIds.includes(r.receiptId))
                    : processedReceipts;
                const totalAmount = targets.reduce((sum, r) => sum + (r.grandTotal || 0), 0);
                const pendingCount = targets.filter((r) => r.approvalStatus !== 'approved').length;

                return (
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-600">จำนวนใบเสร็จที่จะอนุมัติ</span>
                      <strong className="font-mono tabular-nums text-sm text-teal-700">
                        {targets.length} รายการ
                      </strong>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-600">ยอดเงินรวมทั้งหมด</span>
                      <strong className="font-mono tabular-nums text-sm text-slate-900">
                        {formatCurrency(totalAmount)}
                      </strong>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-200">
                      <span>รอการอนุมัติ</span>
                      <span className="font-mono tabular-nums font-semibold text-slate-700">
                        {pendingCount} รายการ
                      </span>
                    </div>
                  </div>
                );
              })()}

              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-slate-700">
                  หมายเหตุการอนุมัติ (ไม่บังคับ)
                </label>
                <input
                  type="text"
                  value={approveNote}
                  onChange={(e) => setApproveNote(e.target.value)}
                  placeholder="เช่น ตรวจสอบเอกสารเรียบร้อยแล้ว"
                  className="w-full h-9 px-3 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 outline-none"
                  disabled={isApproving}
                />
              </div>

              <p className="text-[11px] text-slate-500 leading-relaxed">
                อนุมัติโดย {currentUser?.email || 'Master Admin'} และบันทึกประวัติลงใน Audit Log
              </p>

              {approveError && (
                <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{approveError}</span>
                </div>
              )}

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  disabled={isApproving}
                  onClick={() => setApproveConfirmMode(null)}
                  className="px-4 py-2 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 font-medium cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="button"
                  disabled={isApproving}
                  onClick={handleExecuteApprove}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#0F766E] hover:bg-[#115E59] disabled:opacity-75 text-white rounded-lg font-semibold cursor-pointer transition-colors"
                >
                  {isApproving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>กำลังอนุมัติ...</span>
                    </>
                  ) : (
                    <>
                      <CheckCheck className="w-4 h-4" />
                      <span>{approveConfirmMode === 'selected' ? 'ยืนยันอนุมัติที่เลือก' : 'ยืนยันอนุมัติทั้งหมด'}</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
