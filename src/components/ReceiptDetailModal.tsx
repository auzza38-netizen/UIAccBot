import React, { useState, useEffect } from 'react';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';
import { Receipt, ReceiptItem } from '../types';
import { formatCurrency, formatThaiDate, formatThaiDateTime } from '../utils/formatters';
import {
  X,
  CheckCircle2,
  XCircle,
  Trash2,
  Edit3,
  FileText,
  AlertTriangle,
  ZoomIn,
  Lock,
  Printer,
  Plus,
  Loader2,
  Save,
  RotateCcw,
} from 'lucide-react';

interface ReceiptDetailModalProps {
  receipt: Receipt | null;
  onClose: () => void;
  onEdit?: (receipt: Receipt) => void;
  initialEditMode?: boolean;
}

export const ReceiptDetailModal: React.FC<ReceiptDetailModalProps> = ({
  receipt,
  onClose,
  initialEditMode = false,
}) => {
  const {
    projectsMap,
    categoriesMap,
    projects,
    categories,
    saveReceipt,
    updateReceiptStatus,
    softDeleteReceipt,
  } = useData();
  const { isAdmin, currentUser } = useAuth();

  // Local state for the displayed receipt so updates reflect immediately
  const [currentReceipt, setCurrentReceipt] = useState<Receipt | null>(receipt);

  // Edit Mode state
  const [isEditing, setIsEditing] = useState<boolean>(initialEditMode);
  const [approvalNote, setApprovalNote] = useState<string>('');
  const [showConfirmDelete, setShowConfirmDelete] = useState<boolean>(false);
  const [isUpdating, setIsUpdating] = useState<boolean>(false);
  const [zoomImage, setZoomImage] = useState<boolean>(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Edit form state
  const [editForm, setEditForm] = useState<{
    vendorName: string;
    receiptNumber: string;
    documentDate: string;
    vendorTaxId: string;
    vendorAddress: string;
    customerName: string;
    customerTaxId: string;
    customerAddress: string;
    projectId: string;
    categoryId: string;
    paymentMethod: string;
    subtotal: number | '';
    vatAmount: number | '';
    withholdingTax: number | '';
    discount: number | '';
    grandTotal: number | '';
    notes: string;
    isConfidential: boolean;
    items: ReceiptItem[];
  }>({
    vendorName: '',
    receiptNumber: '',
    documentDate: '',
    vendorTaxId: '',
    vendorAddress: '',
    customerName: '',
    customerTaxId: '',
    customerAddress: '',
    projectId: '',
    categoryId: '',
    paymentMethod: 'เงินสด',
    subtotal: '',
    vatAmount: '',
    withholdingTax: '',
    discount: '',
    grandTotal: '',
    notes: '',
    isConfidential: false,
    items: [],
  });

  // Sync state whenever the receipt prop changes
  useEffect(() => {
    setCurrentReceipt(receipt);
    if (receipt) {
      setEditForm({
        vendorName: receipt.vendorName || '',
        receiptNumber: receipt.receiptNumber || '',
        documentDate: receipt.documentDate || '',
        vendorTaxId: receipt.vendorTaxId || '',
        vendorAddress: receipt.vendorAddress || '',
        customerName: receipt.customerName || '',
        customerTaxId: receipt.customerTaxId || '',
        customerAddress: receipt.customerAddress || '',
        projectId: receipt.projectId || '',
        categoryId: receipt.categoryId || 'cat-other',
        paymentMethod: receipt.paymentMethod || 'เงินสด',
        subtotal: receipt.subtotal ?? '',
        vatAmount: receipt.vatAmount ?? '',
        withholdingTax: receipt.withholdingTax ?? '',
        discount: receipt.discount ?? '',
        grandTotal: receipt.grandTotal ?? '',
        notes: receipt.notes || '',
        isConfidential: Boolean(receipt.isConfidential),
        items: receipt.items ? receipt.items.map((it) => ({ ...it })) : [],
      });
      setIsEditing(initialEditMode);
      setEditError(null);
      setSuccessToast(null);
    }
  }, [receipt, initialEditMode]);

  if (!currentReceipt) return null;

  const project = projectsMap[currentReceipt.projectId];
  const category = categoriesMap[currentReceipt.categoryId];
  const isOwner =
    currentUser?.uid === currentReceipt.uploadedBy ||
    currentUser?.email === currentReceipt.uploadedByEmail;

  // Master Admin can always edit; uploader can edit as well
  const canEdit = isAdmin || isOwner;

  const handleStartEditing = () => {
    setEditForm({
      vendorName: currentReceipt.vendorName || '',
      receiptNumber: currentReceipt.receiptNumber || '',
      documentDate: currentReceipt.documentDate || '',
      vendorTaxId: currentReceipt.vendorTaxId || '',
      vendorAddress: currentReceipt.vendorAddress || '',
      customerName: currentReceipt.customerName || '',
      customerTaxId: currentReceipt.customerTaxId || '',
      customerAddress: currentReceipt.customerAddress || '',
      projectId: currentReceipt.projectId || '',
      categoryId: currentReceipt.categoryId || 'cat-other',
      paymentMethod: currentReceipt.paymentMethod || 'เงินสด',
      subtotal: currentReceipt.subtotal ?? '',
      vatAmount: currentReceipt.vatAmount ?? '',
      withholdingTax: currentReceipt.withholdingTax ?? '',
      discount: currentReceipt.discount ?? '',
      grandTotal: currentReceipt.grandTotal ?? '',
      notes: currentReceipt.notes || '',
      isConfidential: Boolean(currentReceipt.isConfidential),
      items: currentReceipt.items ? currentReceipt.items.map((it) => ({ ...it })) : [],
    });
    setEditError(null);
    setIsEditing(true);
  };

  const handleCancelEditing = () => {
    setIsEditing(false);
    setEditError(null);
  };

  // Helper for auto-calculating Grand Total
  const handleAutoCalcGrandTotal = () => {
    const s = Number(editForm.subtotal) || 0;
    const v = Number(editForm.vatAmount) || 0;
    const w = Number(editForm.withholdingTax) || 0;
    const d = Number(editForm.discount) || 0;
    const total = Math.max(0, +(s + v - w - d).toFixed(2));
    setEditForm((prev) => ({ ...prev, grandTotal: total }));
  };

  // Helper for auto-calculating 7% VAT based on subtotal
  const handleCalcVat7 = () => {
    const s = Number(editForm.subtotal) || 0;
    const v = +(s * 0.07).toFixed(2);
    setEditForm((prev) => {
      const w = Number(prev.withholdingTax) || 0;
      const d = Number(prev.discount) || 0;
      return {
        ...prev,
        vatAmount: v,
        grandTotal: Math.max(0, +(s + v - w - d).toFixed(2)),
      };
    });
  };

  // Line item manipulation
  const handleAddItem = () => {
    setEditForm((prev) => ({
      ...prev,
      items: [...prev.items, { itemName: '', quantity: 1, unitPrice: 0, amount: 0 }],
    }));
  };

  const handleUpdateItem = (index: number, field: keyof ReceiptItem, val: any) => {
    setEditForm((prev) => {
      const newItems = [...prev.items];
      const item = { ...newItems[index], [field]: val };

      if (field === 'quantity' || field === 'unitPrice') {
        const q = field === 'quantity' ? Number(val) || 0 : item.quantity;
        const p = field === 'unitPrice' ? Number(val) || 0 : item.unitPrice;
        item.amount = +(q * p).toFixed(2);
      }

      newItems[index] = item;
      return { ...prev, items: newItems };
    });
  };

  const handleRemoveItem = (index: number) => {
    setEditForm((prev) => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index),
    }));
  };

  // Save the updated receipt data
  const handleSaveEdit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!currentReceipt) return;

    setIsUpdating(true);
    setEditError(null);

    const sub = Number(editForm.subtotal) || 0;
    const vat = Number(editForm.vatAmount) || 0;
    const wht = Number(editForm.withholdingTax) || 0;
    const disc = Number(editForm.discount) || 0;
    const grand =
      editForm.grandTotal === ''
        ? +(sub + vat - wht - disc).toFixed(2)
        : Number(editForm.grandTotal) || 0;

    const updatedData: Partial<Receipt> = {
      receiptId: currentReceipt.receiptId,
      vendorName: editForm.vendorName.trim(),
      receiptNumber: editForm.receiptNumber.trim(),
      documentDate: editForm.documentDate,
      vendorTaxId: editForm.vendorTaxId.trim(),
      vendorAddress: editForm.vendorAddress.trim(),
      customerName: editForm.customerName.trim(),
      customerTaxId: editForm.customerTaxId.trim(),
      customerAddress: editForm.customerAddress.trim(),
      projectId: editForm.projectId,
      categoryId: editForm.categoryId,
      paymentMethod: editForm.paymentMethod,
      subtotal: sub,
      vatAmount: vat,
      withholdingTax: wht,
      discount: disc,
      grandTotal: grand,
      notes: editForm.notes.trim(),
      isConfidential: editForm.isConfidential,
      items: editForm.items.filter((it) => it.itemName.trim() !== ''),
      updatedAt: new Date().toISOString(),
    };

    try {
      await saveReceipt(updatedData);

      // Update local state with the newly saved values
      const merged: Receipt = {
        ...currentReceipt,
        ...(updatedData as Receipt),
      };
      setCurrentReceipt(merged);
      setIsEditing(false);
      setSuccessToast('บันทึกการแก้ไขข้อมูลเรียบร้อยแล้ว');
      setTimeout(() => setSuccessToast(null), 3500);
    } catch (err: any) {
      setEditError(err.message || 'บันทึกการแก้ไขไม่สำเร็จ โปรดลองอีกครั้ง');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleApprove = async () => {
    if (!currentReceipt) return;
    setIsUpdating(true);
    try {
      await updateReceiptStatus(currentReceipt.receiptId, 'approved', approvalNote);
      setCurrentReceipt((prev) => (prev ? { ...prev, approvalStatus: 'approved' } : prev));
      onClose();
    } catch (e: any) {
      alert('เกิดข้อผิดพลาด: ' + e.message);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleReject = async () => {
    if (!currentReceipt) return;
    if (!approvalNote.trim()) {
      alert('กรุณากรอกเหตุผลในการไม่อนุมัติ');
      return;
    }
    setIsUpdating(true);
    try {
      await updateReceiptStatus(currentReceipt.receiptId, 'rejected', approvalNote);
      setCurrentReceipt((prev) => (prev ? { ...prev, approvalStatus: 'rejected' } : prev));
      onClose();
    } catch (e: any) {
      alert('เกิดข้อผิดพลาด: ' + e.message);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDelete = async () => {
    if (!currentReceipt) return;
    setIsUpdating(true);
    try {
      await softDeleteReceipt(currentReceipt.receiptId);
      onClose();
    } catch (e: any) {
      alert('เกิดข้อผิดพลาด: ' + e.message);
    } finally {
      setIsUpdating(false);
    }
  };

  const getStatusBadge = () => {
    switch (currentReceipt.approvalStatus) {
      case 'approved':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-800 text-xs font-semibold">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> อนุมัติแล้ว (Approved)
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-red-50 text-red-800 text-xs font-semibold">
            <XCircle className="w-3.5 h-3.5 text-red-600" /> ไม่อนุมัติ (Rejected)
          </span>
        );
      case 'draft':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-100 text-slate-700 text-xs font-semibold">
            ฉบับร่าง (Draft)
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-amber-50 text-amber-800 text-xs font-semibold">
            รออนุมัติ (Pending Review)
          </span>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl my-auto border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-5 py-3.5 bg-[#12304A] text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className={`p-1.5 rounded-lg ${isEditing ? 'bg-amber-500' : 'bg-[#0D9488]'} text-white`}>
              {isEditing ? <Edit3 className="w-5 h-5" /> : <FileText className="w-5 h-5" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold">
                  {isEditing
                    ? `แก้ไขข้อมูลใบเสร็จ: ${currentReceipt.vendorName || 'ไม่มีชื่อร้าน'}`
                    : currentReceipt.vendorName || 'ใบเสร็จรับเงิน'}
                </h2>
                {currentReceipt.isConfidential && (
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-400 text-slate-900 flex items-center gap-1">
                    <Lock className="w-2.5 h-2.5" /> ลับ
                  </span>
                )}
                {isEditing && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-400 text-slate-900">
                    โหมดแก้ไขข้อมูล
                  </span>
                )}
              </div>
              <p className="text-[11px] text-teal-200/90 font-mono">
                เลขที่: {currentReceipt.receiptNumber || 'ไม่มีเลขที่'} · วันที่:{' '}
                {formatThaiDate(currentReceipt.documentDate)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!isEditing && (
              <button
                onClick={() => window.print()}
                className="p-1.5 rounded-md text-slate-300 hover:text-white hover:bg-white/10"
                title="พิมพ์เอกสาร"
              >
                <Printer className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1 rounded-md text-slate-300 hover:text-white hover:bg-white/10 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Success Feedback Toast */}
        {successToast && (
          <div className="px-5 py-2.5 bg-emerald-50 border-b border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2 animate-in fade-in duration-150">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successToast}</span>
          </div>
        )}

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
            {/* Left: Image / PDF Viewer (5 cols) */}
            <div className="md:col-span-5 flex flex-col">
              <div
                className={`bg-slate-900 rounded-xl overflow-hidden flex items-center justify-center relative ${
                  zoomImage ? 'fixed inset-4 z-50 bg-black/90 cursor-zoom-out' : 'h-[360px] cursor-zoom-in'
                }`}
                onClick={() => setZoomImage(!zoomImage)}
                title="คลิกเพื่อขยายดูภาพขนาดใหญ่"
              >
                {currentReceipt.receiptImageUrl ? (
                  currentReceipt.receiptImageUrl.includes('application/pdf') ? (
                    <iframe
                      src={currentReceipt.receiptImageUrl}
                      title="PDF Document"
                      className="w-full h-full rounded-lg bg-white"
                    />
                  ) : (
                    <img
                      src={currentReceipt.receiptImageUrl}
                      alt="Receipt"
                      referrerPolicy="no-referrer"
                      className="max-h-full max-w-full object-contain p-2"
                    />
                  )
                ) : (
                  <div className="text-slate-400 text-xs flex flex-col items-center gap-2">
                    <FileText className="w-8 h-8" />
                    <span>ไม่มีรูปภาพแนบ</span>
                  </div>
                )}
                {!currentReceipt.receiptImageUrl?.includes('application/pdf') && (
                  <div className="absolute bottom-2 right-2 p-1.5 rounded-md bg-black/50 text-white text-xs flex items-center gap-1">
                    <ZoomIn className="w-3.5 h-3.5" />
                    <span>{zoomImage ? 'ย่อรูป' : 'ขยายรูป'}</span>
                  </div>
                )}
              </div>

              {currentReceipt.totalPages && currentReceipt.totalPages > 1 && (
                <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-800 flex items-center justify-between">
                  <span className="font-semibold flex items-center gap-1">
                    <FileText className="w-3.5 h-3.5 text-blue-600" />
                    เอกสาร PDF รวมทุกหน้า ({currentReceipt.totalPages} หน้า)
                  </span>
                  <span className="text-[11px] text-blue-600">วิเคราะห์ข้อมูลครบทุกหน้า</span>
                </div>
              )}

              <p className="text-[11px] text-slate-400 mt-1.5 text-center">
                {currentReceipt.receiptImageUrl?.includes('application/pdf')
                  ? 'สามารถเลื่อนดูและซูมหน้าเอกสาร PDF ได้โดยตรง'
                  : 'คลิกที่รูปภาพเพื่อเปิดโหมดขยายดูรายละเอียดคมชัด'}
              </p>
            </div>

            {/* Right: Data View or Edit Form (7 cols) */}
            <div className="md:col-span-7 space-y-4">
              {isEditing ? (
                /* ==================== EDIT MODE FORM ==================== */
                <form onSubmit={handleSaveEdit} className="space-y-4 text-xs">
                  {editError && (
                    <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                      <span>{editError}</span>
                    </div>
                  )}

                  {/* Basic Information */}
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-3">
                    <h4 className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5 text-teal-600" />
                      ข้อมูลทั่วไปของใบเสร็จ
                    </h4>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                          ชื่อร้านค้า / ผู้ขาย <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          value={editForm.vendorName}
                          onChange={(e) => setEditForm({ ...editForm, vendorName: e.target.value })}
                          className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white text-slate-900 font-medium"
                          placeholder="เช่น 7-Eleven, บจก. ตัวอย่าง"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                          เลขที่ใบเสร็จ
                        </label>
                        <input
                          type="text"
                          value={editForm.receiptNumber}
                          onChange={(e) => setEditForm({ ...editForm, receiptNumber: e.target.value })}
                          className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white text-slate-900 font-mono"
                          placeholder="เช่น INV-2025-001"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                          วันที่ในใบเสร็จ <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="date"
                          required
                          value={editForm.documentDate}
                          onChange={(e) => setEditForm({ ...editForm, documentDate: e.target.value })}
                          className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white text-slate-900 font-mono"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                          เลขประจำตัวผู้เสียภาษีผู้ขาย (13 หลัก)
                        </label>
                        <input
                          type="text"
                          value={editForm.vendorTaxId}
                          onChange={(e) => setEditForm({ ...editForm, vendorTaxId: e.target.value })}
                          className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white text-slate-900 font-mono"
                          placeholder="01055xxxxxxxx"
                        />
                      </div>

                      <div className="sm:col-span-2">
                        <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                          ที่อยู่ร้านค้า / ผู้ขาย (ในบิล)
                        </label>
                        <input
                          type="text"
                          value={editForm.vendorAddress}
                          onChange={(e) => setEditForm({ ...editForm, vendorAddress: e.target.value })}
                          className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white text-slate-900"
                          placeholder="ที่อยู่ผู้ขายตามใบเสร็จ/ใบกำกับภาษี"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-teal-800 mb-1">
                          ชื่อลูกค้า / ผู้ซื้อ (ในบิล)
                        </label>
                        <input
                          type="text"
                          value={editForm.customerName}
                          onChange={(e) => setEditForm({ ...editForm, customerName: e.target.value })}
                          className="w-full px-2.5 py-1.5 border border-teal-300 rounded-lg bg-white text-slate-900 font-medium"
                          placeholder="ชื่อลูกค้าหรือผู้ซื้อที่ระบุในบิล"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-teal-800 mb-1">
                          เลขประจำตัวผู้เสียภาษีผู้ซื้อ (13 หลัก)
                        </label>
                        <input
                          type="text"
                          value={editForm.customerTaxId}
                          onChange={(e) => setEditForm({ ...editForm, customerTaxId: e.target.value })}
                          className="w-full px-2.5 py-1.5 border border-teal-300 rounded-lg bg-white text-slate-900 font-mono"
                          placeholder="เลขผู้เสียภาษีของผู้ซื้อ (ถ้ามี)"
                        />
                      </div>

                      <div className="sm:col-span-2">
                        <label className="block text-[11px] font-semibold text-teal-800 mb-1">
                          ที่อยู่ผู้ซื้อ / ลูกค้า (ในบิล)
                        </label>
                        <input
                          type="text"
                          value={editForm.customerAddress}
                          onChange={(e) => setEditForm({ ...editForm, customerAddress: e.target.value })}
                          className="w-full px-2.5 py-1.5 border border-teal-300 rounded-lg bg-white text-slate-900"
                          placeholder="ที่อยู่ผู้ซื้อ/ลูกค้าตามใบเสร็จหรือใบกำกับภาษี"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-200">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                          โครงการ (ลูกค้า / หน่วยงาน) <span className="text-rose-500">*</span>
                        </label>
                        <select
                          required
                          value={editForm.projectId}
                          onChange={(e) => setEditForm({ ...editForm, projectId: e.target.value })}
                          className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white text-slate-900"
                        >
                          <option value="">-- เลือกโครงการ --</option>
                          {projects.map((p) => (
                            <option key={p.projectId} value={p.projectId}>
                              {p.projectCode} - {p.clientName}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                          หมวดหมู่ค่าใช้จ่าย <span className="text-rose-500">*</span>
                        </label>
                        <select
                          required
                          value={editForm.categoryId}
                          onChange={(e) => setEditForm({ ...editForm, categoryId: e.target.value })}
                          className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white text-slate-900"
                        >
                          {categories.map((c) => (
                            <option key={c.categoryId} value={c.categoryId}>
                              {c.categoryName}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                          วิธีการชำระเงิน
                        </label>
                        <select
                          value={editForm.paymentMethod}
                          onChange={(e) => setEditForm({ ...editForm, paymentMethod: e.target.value })}
                          className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white text-slate-900"
                        >
                          <option value="เงินสด">เงินสด</option>
                          <option value="โอนเงินธนาคาร">โอนเงินธนาคาร</option>
                          <option value="พร้อมเพย์">พร้อมเพย์</option>
                          <option value="บัตรเครดิต">บัตรเครดิต</option>
                          <option value="บัตรเดบิต">บัตรเดบิต</option>
                          <option value="เช็ค">เช็ค</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Financial Fields */}
                  <div className="bg-teal-50/60 border border-teal-200 rounded-xl p-3.5 space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-teal-950 text-xs flex items-center gap-1.5">
                        ยอดเงินและภาษี (บาท)
                      </h4>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={handleCalcVat7}
                          className="px-2 py-0.5 bg-white border border-teal-300 hover:bg-teal-100 rounded text-[11px] font-semibold text-teal-800 cursor-pointer"
                          title="คำนวณ VAT 7% จากยอดก่อนภาษี"
                        >
                          คำนวณ VAT 7%
                        </button>
                        <button
                          type="button"
                          onClick={handleAutoCalcGrandTotal}
                          className="px-2 py-0.5 bg-teal-600 hover:bg-teal-700 text-white rounded text-[11px] font-semibold cursor-pointer"
                          title="คำนวณยอดสุทธิอัตโนมัติ (ก่อนภาษี + VAT - หัก ณ ที่จ่าย - ส่วนลด)"
                        >
                          คำนวณยอดสุทธิ
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                      <div>
                        <label className="block text-[11px] text-slate-600 mb-1">ยอดก่อนภาษี:</label>
                        <input
                          type="number"
                          step="0.01"
                          value={editForm.subtotal}
                          onChange={(e) =>
                            setEditForm({
                              ...editForm,
                              subtotal: e.target.value === '' ? '' : parseFloat(e.target.value),
                            })
                          }
                          className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white font-mono text-slate-900"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] text-slate-600 mb-1">ภาษี VAT:</label>
                        <input
                          type="number"
                          step="0.01"
                          value={editForm.vatAmount}
                          onChange={(e) =>
                            setEditForm({
                              ...editForm,
                              vatAmount: e.target.value === '' ? '' : parseFloat(e.target.value),
                            })
                          }
                          className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white font-mono text-slate-900"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] text-slate-600 mb-1">หัก ณ ที่จ่าย:</label>
                        <input
                          type="number"
                          step="0.01"
                          value={editForm.withholdingTax}
                          onChange={(e) =>
                            setEditForm({
                              ...editForm,
                              withholdingTax: e.target.value === '' ? '' : parseFloat(e.target.value),
                            })
                          }
                          className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white font-mono text-slate-900"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] text-slate-600 mb-1">ส่วนลด:</label>
                        <input
                          type="number"
                          step="0.01"
                          value={editForm.discount}
                          onChange={(e) =>
                            setEditForm({
                              ...editForm,
                              discount: e.target.value === '' ? '' : parseFloat(e.target.value),
                            })
                          }
                          className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white font-mono text-slate-900"
                        />
                      </div>
                    </div>

                    <div className="pt-2 border-t border-teal-200 flex items-center justify-between">
                      <span className="font-bold text-teal-950 text-xs">ยอดสุทธิที่ชำระ (Grand Total):</span>
                      <div className="w-48">
                        <input
                          type="number"
                          step="0.01"
                          required
                          value={editForm.grandTotal}
                          onChange={(e) =>
                            setEditForm({
                              ...editForm,
                              grandTotal: e.target.value === '' ? '' : parseFloat(e.target.value),
                            })
                          }
                          className="w-full px-3 py-1.5 border-2 border-teal-500 rounded-lg bg-white font-mono font-bold text-teal-900 text-sm text-right"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Line Items Table in Edit Mode */}
                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <div className="bg-slate-100 px-3 py-2 flex items-center justify-between">
                      <span className="font-bold text-slate-800 text-xs">
                        รายการสินค้า / บริการ ({editForm.items.length} รายการ)
                      </span>
                      <button
                        type="button"
                        onClick={handleAddItem}
                        className="flex items-center gap-1 px-2.5 py-1 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg text-[11px] font-semibold text-slate-700 cursor-pointer"
                      >
                        <Plus className="w-3 h-3 text-teal-600" />
                        เพิ่มรายการ
                      </button>
                    </div>

                    {editForm.items.length > 0 ? (
                      <div className="max-h-48 overflow-y-auto">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
                            <tr>
                              <th className="py-1.5 px-2.5">ชื่อสินค้า/บริการ</th>
                              <th className="py-1.5 px-2 w-16 text-right">จำนวน</th>
                              <th className="py-1.5 px-2 w-24 text-right">ราคา/หน่วย</th>
                              <th className="py-1.5 px-2.5 w-24 text-right">รวม</th>
                              <th className="py-1.5 px-2 w-8 text-center"></th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 font-mono">
                            {editForm.items.map((it, idx) => (
                              <tr key={idx} className="hover:bg-slate-50/50">
                                <td className="py-1 px-2.5">
                                  <input
                                    type="text"
                                    value={it.itemName}
                                    onChange={(e) => handleUpdateItem(idx, 'itemName', e.target.value)}
                                    placeholder="ชื่อสินค้า..."
                                    className="w-full px-2 py-1 border border-slate-200 rounded font-sans text-xs bg-white text-slate-800"
                                  />
                                </td>
                                <td className="py-1 px-2 text-right">
                                  <input
                                    type="number"
                                    min="0"
                                    step="1"
                                    value={it.quantity}
                                    onChange={(e) => handleUpdateItem(idx, 'quantity', e.target.value)}
                                    className="w-full px-1.5 py-1 border border-slate-200 rounded text-xs text-right bg-white text-slate-800 font-mono"
                                  />
                                </td>
                                <td className="py-1 px-2 text-right">
                                  <input
                                    type="number"
                                    step="0.01"
                                    value={it.unitPrice}
                                    onChange={(e) => handleUpdateItem(idx, 'unitPrice', e.target.value)}
                                    className="w-full px-1.5 py-1 border border-slate-200 rounded text-xs text-right bg-white text-slate-800 font-mono"
                                  />
                                </td>
                                <td className="py-1 px-2.5 text-right font-bold text-slate-800 font-mono">
                                  {formatCurrency(it.amount, false)}
                                </td>
                                <td className="py-1 px-2 text-center">
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveItem(idx)}
                                    className="p-1 text-slate-400 hover:text-rose-600 rounded transition"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="p-3 text-center text-slate-400 text-[11px]">
                        ยังไม่มีรายการสินค้าย่อย คลิก "+ เพิ่มรายการ" เพื่อเพิ่ม
                      </div>
                    )}
                  </div>

                  {/* Notes */}
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      หมายเหตุเพิ่มเติม
                    </label>
                    <textarea
                      rows={2}
                      value={editForm.notes}
                      onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                      placeholder="บันทึกข้อความหรือข้อตกลง..."
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white text-slate-900"
                    />
                  </div>
                </form>
              ) : (
                /* ==================== VIEW MODE ==================== */
                <>
                  {/* Status and Project strip */}
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                    {getStatusBadge()}
                    <span className="text-xs text-slate-500 font-mono">
                      บันทึกเมื่อ: {formatThaiDateTime(currentReceipt.createdAt)}
                    </span>
                  </div>

                  {/* Financial Box */}
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                    <div className="flex items-baseline justify-between mb-2">
                      <span className="text-xs text-slate-500 font-medium">ยอดสุทธิที่ชำระ (Grand Total)</span>
                      <span className="text-2xl font-bold text-teal-800 font-mono tabular-nums">
                        {formatCurrency(currentReceipt.grandTotal)}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200 text-xs font-mono tabular-nums">
                      <div>
                        <span className="text-slate-400 text-[11px] block">ยอดก่อนภาษี:</span>
                        <span className="text-slate-700 font-medium">{formatCurrency(currentReceipt.subtotal)}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 text-[11px] block">ภาษี VAT:</span>
                        <span className="text-slate-700 font-medium">{formatCurrency(currentReceipt.vatAmount)}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 text-[11px] block">หัก ณ ที่จ่าย:</span>
                        <span className="text-slate-700 font-medium">{formatCurrency(currentReceipt.withholdingTax)}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 text-[11px] block">ส่วนลด:</span>
                        <span className="text-slate-700 font-medium">{formatCurrency(currentReceipt.discount)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Project & Category Details */}
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-slate-400 block text-[11px]">โครงการ (ลูกค้า/หน่วยงาน)</span>
                      <span className="font-semibold text-slate-800">
                        {project ? `${project.projectCode} - ${project.clientName}` : 'ไม่ระบุ'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[11px]">หมวดหมู่ค่าใช้จ่าย</span>
                      <span className="font-semibold text-slate-800">
                        {category ? category.categoryName : 'ไม่ระบุ'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[11px]">ผู้ขาย / ร้านค้า</span>
                      <span className="font-semibold text-slate-800">{currentReceipt.vendorName || '-'}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[11px]">เลขประจำตัวผู้เสียภาษีผู้ขาย</span>
                      <span className="font-semibold text-slate-800 font-mono">
                        {currentReceipt.vendorTaxId || '-'}
                      </span>
                    </div>
                    <div className="col-span-2">
                      <span className="text-slate-400 block text-[11px]">ที่อยู่ร้านค้า / ผู้ขาย (ในบิล)</span>
                      <span className="font-medium text-slate-700">
                        {currentReceipt.vendorAddress || '-'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[11px]">ชื่อลูกค้า / ผู้ซื้อ (ในบิล)</span>
                      <span className="font-semibold text-teal-800">
                        {currentReceipt.customerName || (project ? project.clientName : '-')}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[11px]">เลขประจำตัวผู้เสียภาษีผู้ซื้อ</span>
                      <span className="font-semibold text-slate-800 font-mono">
                        {currentReceipt.customerTaxId || '-'}
                      </span>
                    </div>
                    <div className="col-span-2">
                      <span className="text-slate-400 block text-[11px]">ที่อยู่ผู้ซื้อ / ลูกค้า (ในบิล)</span>
                      <span className="font-medium text-slate-700">
                        {currentReceipt.customerAddress || '-'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[11px]">วิธีชำระเงิน</span>
                      <span className="font-semibold text-slate-800">{currentReceipt.paymentMethod || '-'}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[11px]">ผู้บันทึกรายการ</span>
                      <span className="font-semibold text-slate-800">{currentReceipt.uploadedByEmail || '-'}</span>
                    </div>
                  </div>

                  {/* Line Items if any */}
                  {currentReceipt.items && currentReceipt.items.length > 0 && (
                    <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
                      <div className="bg-slate-100 px-3 py-1.5 font-bold text-slate-700 flex items-center justify-between">
                        <span>รายการสินค้า / บริการ</span>
                        {currentReceipt.totalPages && currentReceipt.totalPages > 1 && (
                          <span className="text-[10px] text-blue-800 bg-blue-100 font-semibold px-2 py-0.5 rounded-full">
                            เอกสาร PDF {currentReceipt.totalPages} หน้า
                          </span>
                        )}
                      </div>
                      <table className="w-full text-left">
                        <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
                          <tr>
                            {currentReceipt.items.some((it) => it.pageNumber) && (
                              <th className="py-1 px-2 text-center w-14">หน้า</th>
                            )}
                            <th className="py-1 px-3">รายการ</th>
                            <th className="py-1 px-2 text-right">จำนวน</th>
                            <th className="py-1 px-2 text-right">ราคา/หน่วย</th>
                            <th className="py-1 px-3 text-right">รวม</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-mono tabular-nums">
                          {currentReceipt.items.map((it, idx) => (
                            <tr key={idx}>
                              {currentReceipt.items?.some((item) => item.pageNumber) && (
                                <td className="py-1.5 px-2 text-center font-mono text-[10px] font-bold text-blue-700">
                                  {it.pageNumber ? `P.${it.pageNumber}` : '-'}
                                </td>
                              )}
                              <td className="py-1.5 px-3 font-sans">{it.itemName}</td>
                              <td className="py-1.5 px-2 text-right">{it.quantity}</td>
                              <td className="py-1.5 px-2 text-right">{formatCurrency(it.unitPrice, false)}</td>
                              <td className="py-1.5 px-3 text-right font-bold text-slate-900">
                                {formatCurrency(it.amount, false)} ฿
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Notes */}
                  {currentReceipt.notes && (
                    <div className="p-3 bg-amber-50/50 rounded-lg border border-amber-200/60 text-xs">
                      <span className="font-bold text-amber-900 block mb-0.5">หมายเหตุ:</span>
                      <p className="text-slate-700">{currentReceipt.notes}</p>
                    </div>
                  )}

                  {/* Approval info */}
                  {currentReceipt.approvedBy && (
                    <div className="text-[11px] text-slate-400 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                      <span className="font-semibold text-slate-700">ผู้อนุมัติ/ตรวจ:</span>{' '}
                      {currentReceipt.approvedBy} เมื่อ {formatThaiDateTime(currentReceipt.approvedAt)}
                    </div>
                  )}

                  {/* Master Admin Approval Actions */}
                  {isAdmin && currentReceipt.approvalStatus !== 'approved' && (
                    <div className="pt-3 border-t border-slate-200 space-y-2">
                      <label className="block text-xs font-bold text-slate-800">
                        ความเห็นผู้ตรวจสอบ (Audit & Approval Note)
                      </label>
                      <input
                        type="text"
                        placeholder="กรอกความเห็นหรือเหตุผลการอนุมัติ/ปฏิเสธ..."
                        value={approvalNote}
                        onChange={(e) => setApprovalNote(e.target.value)}
                        className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
                      />

                      <div className="flex items-center gap-2 pt-1">
                        <button
                          onClick={handleApprove}
                          disabled={isUpdating}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-xs cursor-pointer"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          อนุมัติรายการ (Approve)
                        </button>

                        <button
                          onClick={handleReject}
                          disabled={isUpdating}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold shadow-xs cursor-pointer"
                        >
                          <XCircle className="w-4 h-4" />
                          ไม่อนุมัติ (Reject)
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <div>
            {!isEditing && isAdmin && (
              <>
                {showConfirmDelete ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-red-600 font-bold">ยืนยันลบรายการ (Soft Delete)?</span>
                    <button
                      onClick={handleDelete}
                      disabled={isUpdating}
                      className="px-2.5 py-1 bg-red-600 text-white rounded text-xs font-semibold cursor-pointer"
                    >
                      ลบถาวร
                    </button>
                    <button
                      onClick={() => setShowConfirmDelete(false)}
                      className="px-2 py-1 text-slate-600 text-xs cursor-pointer"
                    >
                      ยกเลิก
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowConfirmDelete(true)}
                    className="flex items-center gap-1 text-xs text-red-600 hover:text-red-700 font-medium cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    ลบรายการนี้
                  </button>
                )}
              </>
            )}
          </div>

          <div className="flex items-center gap-2">
            {isEditing ? (
              <>
                <button
                  type="button"
                  disabled={isUpdating}
                  onClick={handleCancelEditing}
                  className="px-4 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold cursor-pointer"
                >
                  ยกเลิกการแก้ไข
                </button>
                <button
                  type="button"
                  disabled={isUpdating}
                  onClick={() => handleSaveEdit()}
                  className="flex items-center gap-1.5 px-5 py-2 bg-[#0D9488] hover:bg-teal-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer transition active:scale-95"
                >
                  {isUpdating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      กำลังบันทึก...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      บันทึกการแก้ไข
                    </>
                  )}
                </button>
              </>
            ) : (
              <>
                {canEdit && (
                  <button
                    onClick={handleStartEditing}
                    className="flex items-center gap-1.5 px-4 py-2 bg-[#12304A] hover:bg-[#1b4366] text-white rounded-xl text-xs font-bold cursor-pointer transition shadow-2xs"
                  >
                    <Edit3 className="w-3.5 h-3.5 text-teal-300" />
                    แก้ไขข้อมูล
                  </button>
                )}

                <button
                  onClick={onClose}
                  className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl text-xs font-semibold cursor-pointer"
                >
                  ปิดหน้าต่าง
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
