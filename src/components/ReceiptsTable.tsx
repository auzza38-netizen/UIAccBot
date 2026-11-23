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
  Filter,
  Lock,
  CheckSquare,
  Square,
  MinusSquare,
  Trash2,
  AlertTriangle,
  Loader2,
  X,
  ListChecks,
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
  const { projectsMap, categoriesMap, batchDeleteReceipts, batchApproveReceipts, receipts: allDbReceipts, filters, setFilters } = useData();
  const { isAdmin, currentUser } = useAuth();

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
          (projectsMap[r.projectId]?.clientName && projectsMap[r.projectId].clientName.toLowerCase().includes(q)) ||
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

  // Valid selected IDs that exist in current processed receipts
  const validSelectedIds = useMemo(() => {
    const validSet = new Set(processedReceipts.map((r) => r.receiptId));
    return selectedIds.filter((id) => validSet.has(id));
  }, [selectedIds, processedReceipts]);

  const isAllSelected = processedReceipts.length > 0 && validSelectedIds.length === processedReceipts.length;
  const isSomeSelected = validSelectedIds.length > 0 && validSelectedIds.length < processedReceipts.length;

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

  // Pagination slicing
  const totalPages = Math.ceil(processedReceipts.length / pageSize) || 1;
  const paginatedReceipts = processedReceipts.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const getStatusBadge = (r: Receipt) => {
    switch (r.approvalStatus) {
      case 'approved':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 inline" /> อนุมัติแล้ว
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-red-700">
            <XCircle className="w-3.5 h-3.5 text-red-600 inline" /> ไม่อนุมัติ
          </span>
        );
      case 'draft':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500">
            <Clock className="w-3.5 h-3.5 text-slate-400 inline" /> ฉบับร่าง
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700">
            <Clock className="w-3.5 h-3.5 text-amber-600 inline" /> รออนุมัติ
          </span>
        );
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
      {/* Toast Feedback */}
      {toastMessage && (
        <div
          className={`p-3 border-b flex items-center justify-between gap-2 text-xs font-medium ${
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
      <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-50/50">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-bold text-slate-900">
            รายการใบเสร็จรับเงิน ({processedReceipts.length}{allDbReceipts.length > processedReceipts.length ? ` จากทั้งหมด ${allDbReceipts.length}` : ''} รายการ)
          </h3>
          {filters.datePreset !== 'all' && allDbReceipts.length > processedReceipts.length && (
            <button
              onClick={() => setFilters((prev) => ({ ...prev, datePreset: 'all', projectId: 'all' }))}
              className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-900 hover:bg-amber-200 border border-amber-300 transition cursor-pointer"
              title="กำลังเปิดตัวกรองช่วงเวลาอยู่ คลิกเพื่อแสดงใบเสร็จทุกช่วงเวลา"
            >
              แสดงทั้งหมด ({allDbReceipts.length} ใบ)
            </button>
          )}
        </div>

        <div className="flex items-center gap-3">
          <div className="relative flex-1 sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="ค้นหาชื่อร้าน, เลขที่, โครงการ..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-9 pr-3 py-1.5 border border-slate-200 rounded-lg bg-white text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-teal-600"
            />
          </div>

          <button
            onClick={onOpenUpload}
            className="px-3 py-1.5 bg-[#0D9488] hover:bg-teal-700 text-white rounded-lg text-xs font-semibold shrink-0 cursor-pointer"
          >
            + บันทึกใบเสร็จ
          </button>
        </div>
      </div>

      {/* Selection and Batch Operations Bar */}
      <div className="px-4 py-2.5 bg-slate-100/90 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
        {/* Left: Select All button and selection info */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={handleToggleSelectAll}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold border transition cursor-pointer shadow-2xs ${
              isAllSelected
                ? 'bg-teal-700 text-white border-teal-800'
                : isSomeSelected
                ? 'bg-teal-50 text-teal-800 border-teal-300'
                : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
            }`}
            title={isAllSelected ? 'ยกเลิกการเลือกทั้งหมด' : 'เลือกทุกรายการที่แสดงในตาราง'}
          >
            {isAllSelected ? (
              <CheckSquare className="w-4 h-4 text-white" />
            ) : isSomeSelected ? (
              <MinusSquare className="w-4 h-4 text-teal-700" />
            ) : (
              <Square className="w-4 h-4 text-slate-400" />
            )}
            <span>เลือกทั้งหมด</span>
            <span className="font-mono text-[11px] opacity-80">({processedReceipts.length})</span>
          </button>

          {validSelectedIds.length > 0 ? (
            <div className="flex items-center gap-2">
              <span className="font-semibold text-teal-900 bg-teal-100 px-2.5 py-1 rounded-md text-xs border border-teal-200">
                เลือกอยู่ <strong>{validSelectedIds.length}</strong> รายการ
              </span>
              <button
                type="button"
                onClick={handleClearSelection}
                className="text-slate-500 hover:text-slate-800 underline text-xs cursor-pointer ml-1"
              >
                ยกเลิกการเลือก
              </button>
            </div>
          ) : (
            <span className="text-slate-500 text-xs hidden sm:inline">
              (ติ๊กเลือกช่องหน้ารายการที่ต้องการ หรือคลิกปุ่มเลือกทั้งหมด)
            </span>
          )}
        </div>

        {/* Right: Batch Action Dropdown / Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-slate-600 font-semibold text-xs hidden sm:inline">
            เลือกดำเนินการ:
          </span>

          {/* Action 1: Approve Selected */}
          <button
            type="button"
            disabled={validSelectedIds.length === 0}
            onClick={() => {
              setApproveError(null);
              setApproveNote('');
              setApproveConfirmMode('selected');
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:hover:bg-emerald-600 text-white rounded-lg font-bold text-xs shadow-2xs transition cursor-pointer"
            title="อนุมัติเฉพาะรายการใบเสร็จที่ได้ติ๊กเลือกไว้"
          >
            <CheckCheck className="w-3.5 h-3.5" />
            <span>อนุมัติ</span>
            {validSelectedIds.length > 0 && <span className="font-mono">({validSelectedIds.length})</span>}
          </button>

          {/* Action 2: Approve All (matching filter) */}
          <button
            type="button"
            disabled={processedReceipts.length === 0}
            onClick={() => {
              setApproveError(null);
              setApproveNote('');
              setApproveConfirmMode('all');
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 hover:text-emerald-900 border border-emerald-300 disabled:opacity-40 disabled:hover:bg-emerald-50 rounded-lg font-bold text-xs shadow-2xs transition cursor-pointer"
            title="อนุมัติรายการใบเสร็จทั้งหมดตามเงื่อนไขตัวกรองปัจจุบัน"
          >
            <CheckCheck className="w-3.5 h-3.5 text-emerald-700" />
            <span>อนุมัติทั้งหมด</span>
            <span className="font-mono text-[11px]">({processedReceipts.length})</span>
          </button>

          <span className="h-4 w-px bg-slate-300 mx-0.5 hidden sm:inline-block" />

          {/* Action 3: Delete Selected */}
          <button
            type="button"
            disabled={validSelectedIds.length === 0}
            onClick={() => {
              setDeleteError(null);
              setDeleteConfirmMode('selected');
            }}
            className="flex items-center gap-1 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-40 disabled:hover:bg-rose-600 text-white rounded-lg font-bold text-xs shadow-2xs transition cursor-pointer"
            title="ลบเฉพาะรายการใบเสร็จที่ได้ติ๊กเลือกไว้"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>ลบรายการที่เลือก</span>
            {validSelectedIds.length > 0 && <span className="font-mono">({validSelectedIds.length})</span>}
          </button>

          {/* Action 4: Delete All (matching filter) */}
          <button
            type="button"
            disabled={processedReceipts.length === 0}
            onClick={() => {
              setDeleteError(null);
              setDeleteConfirmMode('all');
            }}
            className="flex items-center gap-1 px-3 py-1.5 bg-white hover:bg-rose-50 text-rose-700 hover:text-rose-800 border border-rose-300 disabled:opacity-40 disabled:hover:bg-white rounded-lg font-bold text-xs shadow-2xs transition cursor-pointer"
            title="ลบรายการใบเสร็จทั้งหมดตามเงื่อนไขตัวกรองปัจจุบัน"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>ลบทั้งหมด</span>
            <span className="font-mono text-[11px]">({processedReceipts.length})</span>
          </button>
        </div>
      </div>

      {/* Data Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 uppercase tracking-wider text-[11px]">
            <tr>
              {/* Checkbox Master Column */}
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
              <th className="py-3 px-3 w-12 text-center">ภาพ</th>
              <th
                onClick={() => handleSort('documentDate')}
                className="py-3 px-3 cursor-pointer hover:text-slate-900"
              >
                <div className="flex items-center gap-1">
                  <span>วันที่ใบเสร็จ</span>
                  <ArrowUpDown className="w-3 h-3" />
                </div>
              </th>
              <th className="py-3 px-3">วันที่บันทึก</th>
              <th className="py-3 px-3">ลูกค้า / หน่วยงาน</th>
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
                className="py-3 px-3 text-right cursor-pointer hover:text-slate-900"
              >
                <div className="flex items-center justify-end gap-1">
                  <span>ยอดเงิน (บาท)</span>
                  <ArrowUpDown className="w-3 h-3" />
                </div>
              </th>
              <th className="py-3 px-3">ผู้บันทึก</th>
              <th className="py-3 px-3 text-center">สถานะ</th>
              <th className="py-3 px-3 text-center">การกระทำ</th>
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
                      isSelected ? 'bg-teal-50/70 hover:bg-teal-50' : 'hover:bg-slate-50/80'
                    }`}
                  >
                    {/* Row Checkbox */}
                    <td className="py-2.5 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleToggleSelect(r.receiptId)}
                        className="w-4 h-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500 cursor-pointer"
                        title="ติ๊กเลือกใบเสร็จนี้"
                      />
                    </td>

                    {/* Thumbnail */}
                    <td className="py-2.5 px-3 text-center">
                      <div className="w-9 h-9 rounded-md bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center mx-auto">
                        {r.receiptImageUrl ? (
                          <img
                            src={r.receiptImageUrl}
                            alt=""
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <FileText className="w-4 h-4 text-slate-400" />
                        )}
                      </div>
                    </td>

                    {/* Document Date */}
                    <td className="py-2.5 px-3 font-medium text-slate-900 whitespace-nowrap">
                      {formatThaiDate(r.documentDate)}
                    </td>

                    {/* Upload Date */}
                    <td className="py-2.5 px-3 text-slate-500 whitespace-nowrap">
                      {formatThaiDate(r.uploadDate)}
                    </td>

                    {/* Project */}
                    <td className="py-2.5 px-3">
                      <span className="font-semibold text-slate-800 block truncate max-w-[150px]">
                        {project ? project.projectCode : '-'}
                      </span>
                      <span className="text-[11px] text-slate-400 block truncate max-w-[150px]">
                        {project ? project.clientName : '-'}
                      </span>
                    </td>

                    {/* Vendor & Receipt # */}
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-1">
                        <span className="font-bold text-slate-900 truncate max-w-[160px]">
                          {r.vendorName || 'ไม่ระบุชื่อร้าน'}
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-400 font-mono block">
                        {r.receiptNumber ? `#${r.receiptNumber}` : 'ไม่มีเลขที่'}
                      </span>
                    </td>

                    {/* Category */}
                    <td className="py-2.5 px-3 text-slate-700 whitespace-nowrap">
                      {category ? category.categoryName : 'ไม่ระบุ'}
                    </td>

                    {/* Grand Total */}
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums font-bold text-slate-900 whitespace-nowrap">
                      {formatCurrency(r.grandTotal, false)}
                    </td>

                    {/* Uploaded By */}
                    <td className="py-2.5 px-3 text-slate-500 truncate max-w-[130px]">
                      {r.uploadedByEmail?.split('@')[0] || '-'}
                    </td>

                    {/* Status */}
                    <td className="py-2.5 px-3 text-center whitespace-nowrap">
                      {getStatusBadge(r)}
                    </td>

                    {/* Actions */}
                    <td className="py-2.5 px-3 text-center whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => onSelectReceipt(r)}
                          className="px-2 py-1 text-xs text-teal-700 hover:text-teal-900 hover:bg-teal-50 rounded font-medium inline-flex items-center gap-1 cursor-pointer transition"
                          title="ดูรายละเอียดใบเสร็จ"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          ตรวจดู
                        </button>
                        {onEditReceipt && (
                          <button
                            onClick={() => onEditReceipt(r)}
                            className="px-2 py-1 text-xs text-blue-700 hover:text-blue-900 hover:bg-blue-50 rounded font-medium inline-flex items-center gap-1 cursor-pointer transition"
                            title="แก้ไขข้อมูลใบเสร็จ"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            แก้ไข
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={11} className="py-12 text-center text-slate-400">
                  <FileText className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                  <p className="font-medium">ไม่พบรายการใบเสร็จตามเงื่อนไขที่เลือก</p>
                  <p className="text-[11px] text-slate-400 mt-1">
                    ลองปรับเปลี่ยนตัวกรอง หรือคลิก "+ บันทึกใบเสร็จ" เพื่อเพิ่มรายการใหม่
                  </p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      <div className="p-3 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500 bg-slate-50/50">
        <span>
          แสดง {(currentPage - 1) * pageSize + 1} ถึง{' '}
          {Math.min(currentPage * pageSize, processedReceipts.length)} จากทั้งหมด{' '}
          {processedReceipts.length} รายการ
        </span>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="p-1 rounded border border-slate-200 bg-white disabled:opacity-40 hover:bg-slate-100 cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="px-2 font-medium text-slate-700">
            {currentPage} / {totalPages}
          </span>
          <button
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="p-1 rounded border border-slate-200 bg-white disabled:opacity-40 hover:bg-slate-100 cursor-pointer"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Batch Delete Confirmation Modal */}
      {deleteConfirmMode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md border border-slate-200 overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150">
            <div className="px-5 py-4 bg-rose-600 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Trash2 className="w-5 h-5 text-white" />
                <h3 className="text-base font-bold">
                  {deleteConfirmMode === 'selected' ? 'ยืนยันลบรายการที่เลือก' : 'ยืนยันลบใบเสร็จทั้งหมด'}
                </h3>
              </div>
              <button
                onClick={() => {
                  if (!isDeleting) setDeleteConfirmMode(null);
                }}
                disabled={isDeleting}
                className="p-1 rounded text-white/80 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
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
                  <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 space-y-2 text-rose-950">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-slate-600">จำนวนใบเสร็จที่จะลบ:</span>
                      <strong className="font-mono text-sm text-rose-700">{targets.length} รายการ</strong>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-slate-600">ยอดเงินรวมทั้งหมด:</span>
                      <strong className="font-mono text-sm text-rose-700">{formatCurrency(totalAmount)}</strong>
                    </div>
                    {deleteConfirmMode === 'all' && searchTerm.trim() && (
                      <p className="text-[11px] text-slate-500 pt-1 border-t border-rose-200">
                        * ลบเฉพาะรายการที่ตรงกับการค้นหา "{searchTerm}" ({targets.length} รายการ)
                      </p>
                    )}
                  </div>
                );
              })()}

              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <p className="leading-relaxed">
                  เมื่อยืนยัน รายการใบเสร็จเหล่านี้จะถูกนำออกจากตารางและรายงานทันที (บันทึกประวัติการลบไว้ใน Audit Log)
                </p>
              </div>

              {deleteError && (
                <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{deleteError}</span>
                </div>
              )}

              <p className="text-slate-600">
                คุณแน่ใจหรือไม่ว่าต้องการดำเนินการลบ? การกระทำนี้จะมีผลต่อยอดสรุปและรายงานทั้งหมด
              </p>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={() => setDeleteConfirmMode(null)}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50 font-medium cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={handleExecuteDelete}
                  className="flex items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-75 text-white rounded-xl font-bold shadow-xs cursor-pointer transition"
                >
                  {isDeleting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      กำลังลบข้อมูล...
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4" />
                      {deleteConfirmMode === 'selected' ? 'ยืนยันลบที่เลือก' : 'ยืนยันลบทั้งหมด'}
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
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-emerald-50/60">
              <div className="flex items-center gap-2.5 text-emerald-800">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-700 shrink-0">
                  <CheckCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base leading-tight">ยืนยันการอนุมัติใบเสร็จรับเงิน</h3>
                  <p className="text-xs text-emerald-600">
                    {approveConfirmMode === 'selected' ? 'อนุมัติเฉพาะรายการที่เลือก' : 'อนุมัติทุกรายการตามตัวกรอง'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                disabled={isApproving}
                onClick={() => setApproveConfirmMode(null)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-white transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-4 text-xs">
              {(() => {
                const targets =
                  approveConfirmMode === 'selected'
                    ? processedReceipts.filter((r) => validSelectedIds.includes(r.receiptId))
                    : processedReceipts;
                const totalAmount = targets.reduce((sum, r) => sum + (r.grandTotal || 0), 0);
                const pendingCount = targets.filter((r) => r.approvalStatus !== 'approved').length;
                const alreadyApprovedCount = targets.filter((r) => r.approvalStatus === 'approved').length;

                return (
                  <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-4 space-y-2 text-emerald-950">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-slate-600">จำนวนใบเสร็จที่จะอนุมัติ:</span>
                      <strong className="font-mono text-sm text-emerald-700">{targets.length} รายการ</strong>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-slate-600">ยอดเงินรวมทั้งหมด:</span>
                      <strong className="font-mono text-sm text-emerald-700">{formatCurrency(totalAmount)}</strong>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-slate-600 pt-1 border-t border-emerald-200/60">
                      <span>สถานะเดิม:</span>
                      <span>
                        รออนุมัติ/ฉบับร่าง <strong>{pendingCount}</strong> รายการ
                        {alreadyApprovedCount > 0 && ` (อนุมัติแล้วอยู่แล้ว ${alreadyApprovedCount} รายการ)`}
                      </span>
                    </div>
                    {approveConfirmMode === 'all' && searchTerm.trim() && (
                      <p className="text-[11px] text-slate-500 pt-1 border-t border-emerald-200/60">
                        * อนุมัติเฉพาะรายการที่ตรงกับการค้นหา "{searchTerm}" ({targets.length} รายการ)
                      </p>
                    )}
                  </div>
                );
              })()}

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-700">
                  หมายเหตุ / บันทึกการอนุมัติ (ไม่บังคับ):
                </label>
                <input
                  type="text"
                  value={approveNote}
                  onChange={(e) => setApproveNote(e.target.value)}
                  placeholder="เช่น ตรวจสอบเอกสารเรียบร้อยแล้ว"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                  disabled={isApproving}
                />
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-600 text-xs flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <p className="leading-relaxed">
                  เมื่อกดยืนยัน รายการใบเสร็จทั้งหมดนี้จะถูกเปลี่ยนสถานะเป็น <strong className="text-emerald-700 font-semibold">"อนุมัติแล้ว"</strong> โดย {currentUser?.email || 'Master Admin'} และบันทึกประวัติการอนุมัติลงใน Audit Log
                </p>
              </div>

              {approveError && (
                <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{approveError}</span>
                </div>
              )}

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  disabled={isApproving}
                  onClick={() => setApproveConfirmMode(null)}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50 font-medium cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="button"
                  disabled={isApproving}
                  onClick={handleExecuteApprove}
                  className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-75 text-white rounded-xl font-bold shadow-xs cursor-pointer transition"
                >
                  {isApproving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      กำลังอนุมัติข้อมูล...
                    </>
                  ) : (
                    <>
                      <CheckCheck className="w-4 h-4" />
                      {approveConfirmMode === 'selected' ? 'ยืนยันอนุมัติที่เลือก' : 'ยืนยันอนุมัติทั้งหมด'}
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
