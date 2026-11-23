import React, { useState, useMemo } from 'react';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';
import {
  Plus,
  Check,
  X,
  Edit2,
  Trash2,
  FolderTree,
  CornerDownRight,
  AlertCircle,
  AlertTriangle,
  Receipt as ReceiptIcon,
  Loader2,
  CheckCircle2,
} from 'lucide-react';
import { ExpenseCategory } from '../types';

export const CategoriesPage: React.FC = () => {
  const { categories, receipts, saveCategory, toggleCategoryStatus, deleteCategory } = useData();
  const { isAdmin } = useAuth();

  const [addMode, setAddMode] = useState<'main' | 'sub'>('main');
  const [newCatName, setNewCatName] = useState<string>('');
  const [selectedParentId, setSelectedParentId] = useState<string>('');

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState<string>('');
  const [editParentId, setEditParentId] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const [catToDelete, setCatToDelete] = useState<ExpenseCategory | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const mainCategories = categories.filter((c) => c.level === 'main' || !c.parentId);

  const getSubcategories = (parentId: string) => {
    return categories.filter((c) => c.parentId === parentId && c.level === 'sub');
  };

  const legacyOrUnassignedCategories = categories.filter(
    (c) => c.level === 'sub' && (!c.parentId || !mainCategories.some((m) => m.categoryId === c.parentId))
  );

  const deletingSubcategories = useMemo(() => {
    if (!catToDelete) return [];
    return getSubcategories(catToDelete.categoryId);
  }, [catToDelete, categories]);

  const linkedReceiptsCount = useMemo(() => {
    if (!catToDelete) return 0;
    const catIds = [catToDelete.categoryId, ...deletingSubcategories.map((s) => s.categoryId)];
    return (receipts || []).filter((r) => !r.isDeleted && catIds.includes(r.categoryId)).length;
  }, [catToDelete, deletingSubcategories, receipts]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) return;
    if (addMode === 'sub' && !selectedParentId) {
      setFeedbackMsg({
        type: 'error',
        text: 'กรุณาเลือกหมวดหมู่หลักที่ต้องการผูกหมวดหมู่ย่อยนี้',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      if (addMode === 'main') {
        await saveCategory(newCatName.trim(), undefined, null, 'main');
      } else {
        await saveCategory(newCatName.trim(), undefined, selectedParentId, 'sub');
      }
      setFeedbackMsg({
        type: 'success',
        text: addMode === 'main'
          ? `เพิ่มหมวดหมู่หลัก "${newCatName.trim()}" สำเร็จ`
          : `เพิ่มหมวดหมู่ย่อย "${newCatName.trim()}" สำเร็จ`,
      });
      setNewCatName('');
      setTimeout(() => setFeedbackMsg(null), 3500);
    } catch (err: any) {
      setFeedbackMsg({
        type: 'error',
        text: 'เพิ่มหมวดหมู่ไม่สำเร็จ: ' + (err.message || String(err)),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStartEdit = (cat: ExpenseCategory) => {
    setEditingId(cat.categoryId);
    setEditName(cat.categoryName);
    setEditParentId(cat.parentId || '');
  };

  const handleSaveEdit = async (cat: ExpenseCategory) => {
    if (!editName.trim()) return;
    setIsSubmitting(true);
    try {
      const level = editParentId ? 'sub' : cat.level || 'main';
      await saveCategory(editName.trim(), cat.categoryId, editParentId || null, level);
      setEditingId(null);
      setFeedbackMsg({
        type: 'success',
        text: `แก้ไขหมวดหมู่เป็น "${editName.trim()}" เรียบร้อยแล้ว`,
      });
      setTimeout(() => setFeedbackMsg(null), 3500);
    } catch (err: any) {
      setFeedbackMsg({
        type: 'error',
        text: 'แก้ไขหมวดหมู่ไม่สำเร็จ: ' + (err.message || String(err)),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!catToDelete) return;
    setIsDeleting(true);
    const deletedName = catToDelete.categoryName;
    const isMain = catToDelete.level === 'main' || !catToDelete.parentId;
    const subCount = deletingSubcategories.length;

    try {
      await deleteCategory(catToDelete.categoryId);
      setCatToDelete(null);
      setFeedbackMsg({
        type: 'success',
        text: isMain && subCount > 0
          ? `ลบหมวดหมู่หลัก "${deletedName}" พร้อมหมวดหมู่ย่อย ${subCount} รายการ สำเร็จเรียบร้อย`
          : `ลบหมวดหมู่ "${deletedName}" สำเร็จเรียบร้อยแล้ว`,
      });
      setTimeout(() => setFeedbackMsg(null), 4000);
    } catch (err: any) {
      console.error('Delete category error:', err);
      setFeedbackMsg({
        type: 'error',
        text: 'ลบหมวดหมู่ไม่สำเร็จ: ' + (err.message || 'โปรดตรวจสอบสิทธิ์'),
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleQuickAddSub = (parentCatId: string) => {
    setAddMode('sub');
    setSelectedParentId(parentCatId);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleToggleStatus = async (cat: ExpenseCategory) => {
    setTogglingId(cat.categoryId);
    try {
      await toggleCategoryStatus(cat.categoryId, !cat.isActive);
    } catch (err: any) {
      setFeedbackMsg({
        type: 'error',
        text: 'อัปเดตสถานะหมวดหมู่ไม่สำเร็จ: ' + (err?.message || 'เกิดข้อผิดพลาด'),
      });
    } finally {
      setTogglingId(null);
    }
  };

  if (!isAdmin) {
    return (
      <div className="p-8 text-center text-slate-500 text-sm">
        เฉพาะ Master Admin เท่านั้นที่สามารถจัดการหมวดหมู่ค่าใช้จ่าย
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-5xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            ผังหมวดหมู่ค่าใช้จ่าย
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            กำหนดโครงสร้างหมวดหมู่หลักและหมวดหมู่ย่อยสำหรับการลงบัญชีและการคัดแยกใบเสร็จอัตโนมัติ
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500 font-mono tabular-nums shrink-0">
          <span>หมวดหลัก {mainCategories.length}</span>
          <span aria-hidden="true" className="text-slate-300">·</span>
          <span>หมวดย่อย {categories.filter((c) => c.level === 'sub').length}</span>
        </div>
      </div>

      {/* Feedback Banner */}
      {feedbackMsg && (
        <div
          className={`p-3.5 rounded-xl border flex items-center justify-between text-xs ${
            feedbackMsg.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-rose-50 border-rose-200 text-rose-900'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedbackMsg.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span className="font-medium">{feedbackMsg.text}</span>
          </div>
          <button
            onClick={() => setFeedbackMsg(null)}
            className="text-slate-400 hover:text-slate-600 p-0.5 rounded cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Add Category Form Card */}
      <div className="bg-white border border-slate-200/80 rounded-xl p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <span className="text-sm font-semibold text-slate-900">
            เพิ่มหมวดหมู่บัญชีใหม่
          </span>

          <div className="inline-flex p-1 bg-slate-100/80 rounded-lg text-xs font-medium">
            <button
              type="button"
              onClick={() => {
                setAddMode('main');
                setSelectedParentId('');
              }}
              className={`px-3 py-1.5 rounded-md transition cursor-pointer flex items-center gap-1.5 ${
                addMode === 'main'
                  ? 'bg-white text-slate-900 font-semibold shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FolderTree className="w-3.5 h-3.5" />
              <span>หมวดหมู่หลัก</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setAddMode('sub');
                if (!selectedParentId && mainCategories.length > 0) {
                  setSelectedParentId(mainCategories[0].categoryId);
                }
              }}
              className={`px-3 py-1.5 rounded-md transition cursor-pointer flex items-center gap-1.5 ${
                addMode === 'sub'
                  ? 'bg-white text-slate-900 font-semibold shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <CornerDownRight className="w-3.5 h-3.5" />
              <span>หมวดหมู่ย่อย</span>
            </button>
          </div>
        </div>

        <form onSubmit={handleAdd} className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
          {addMode === 'sub' && (
            <div className="md:col-span-4">
              <label className="block text-[11px] font-medium text-slate-600 mb-1">
                สังกัดหมวดหมู่หลัก <span className="text-rose-500">*</span>
              </label>
              <select
                value={selectedParentId}
                onChange={(e) => setSelectedParentId(e.target.value)}
                className="w-full h-9 px-3 text-xs border border-slate-200 rounded-lg text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600"
                required
              >
                <option value="">-- เลือกหมวดหมู่หลัก --</option>
                {mainCategories.map((m) => (
                  <option key={m.categoryId} value={m.categoryId}>
                    {m.categoryName}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className={addMode === 'sub' ? 'md:col-span-6' : 'md:col-span-9'}>
            <label className="block text-[11px] font-medium text-slate-600 mb-1">
              {addMode === 'main' ? 'ชื่อหมวดหมู่หลัก' : 'ชื่อหมวดหมู่ย่อย'}{' '}
              <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              placeholder={
                addMode === 'main'
                  ? 'เช่น ค่าเดินทางและยานพาหนะ, ค่าวัสดุอุปกรณ์...'
                  : 'เช่น ค่าน้ำมันเชื้อเพลิง, ค่าทางด่วน, ค่าที่พัก...'
              }
              value={newCatName}
              onChange={(e) => setNewCatName(e.target.value)}
              className="w-full h-9 px-3 text-xs border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600"
              required
            />
          </div>

          <div className={addMode === 'sub' ? 'md:col-span-2' : 'md:col-span-3'}>
            <button
              type="submit"
              disabled={isSubmitting || !newCatName.trim()}
              className="w-full h-9 flex items-center justify-center gap-1.5 px-4 bg-[#0F766E] hover:bg-[#0D645D] disabled:opacity-50 text-white rounded-lg text-xs font-semibold cursor-pointer transition-colors"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>กำลังบันทึก...</span>
                </>
              ) : (
                <>
                  <Plus className="w-3.5 h-3.5" />
                  <span>{addMode === 'main' ? 'เพิ่มหมวดหลัก' : 'เพิ่มหมวดย่อย'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Categories Tree List */}
      <div className="bg-white border border-slate-200/80 rounded-xl divide-y divide-slate-200/80 overflow-hidden">
        {mainCategories.map((mainCat) => {
          const subs = getSubcategories(mainCat.categoryId);
          const isMainEditing = editingId === mainCat.categoryId;

          return (
            <div key={mainCat.categoryId}>
              {/* Main Category Header Row */}
              <div className="px-5 py-3.5 bg-slate-50/60 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 flex-1 min-w-[200px]">
                  <span className="w-1 h-4 rounded-full bg-teal-700 shrink-0" />

                  {isMainEditing ? (
                    <div className="flex items-center gap-2 flex-1">
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="px-2.5 py-1 border border-teal-500 rounded-md text-xs text-slate-900 flex-1 max-w-xs bg-white"
                        autoFocus
                      />
                      <button
                        onClick={() => handleSaveEdit(mainCat)}
                        disabled={isSubmitting}
                        className="p-1 text-emerald-600 hover:bg-emerald-50 rounded cursor-pointer disabled:opacity-50"
                        title="บันทึก"
                      >
                        {isSubmitting ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Check className="w-4 h-4" />
                        )}
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        disabled={isSubmitting}
                        className="p-1 text-slate-400 hover:bg-slate-100 rounded cursor-pointer"
                        title="ยกเลิก"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`text-sm font-semibold ${
                          mainCat.isActive ? 'text-slate-900' : 'text-slate-400 line-through'
                        }`}
                      >
                        {mainCat.categoryName}
                      </span>
                      <span className="text-xs text-slate-400 font-mono tabular-nums">
                        · {subs.length} หมวดย่อย
                      </span>
                    </div>
                  )}
                </div>

                {/* Main Category Actions */}
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleQuickAddSub(mainCat.categoryId)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-white hover:bg-teal-50 text-teal-700 border border-slate-200 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer"
                    title="เพิ่มหมวดหมู่ย่อยภายใต้หมวดนี้"
                  >
                    <Plus className="w-3 h-3" />
                    <span>เพิ่มหมวดย่อย</span>
                  </button>

                  <button
                    onClick={() => handleStartEdit(mainCat)}
                    className="p-1.5 text-slate-400 hover:text-slate-800 hover:bg-slate-200/60 rounded-lg transition-colors cursor-pointer"
                    title="แก้ไขชื่อหมวดหมู่หลัก"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={() => handleToggleStatus(mainCat)}
                    disabled={togglingId === mainCat.categoryId}
                    className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-md cursor-pointer transition-colors disabled:opacity-60 ${
                      mainCat.isActive
                        ? 'text-emerald-700 hover:bg-emerald-50'
                        : 'text-slate-500 hover:bg-slate-100'
                    }`}
                  >
                    {togglingId === mainCat.categoryId && (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    )}
                    <span>{mainCat.isActive ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}</span>
                  </button>

                  <button
                    onClick={() => setCatToDelete(mainCat)}
                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                    title="ลบหมวดหมู่หลักนี้"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Subcategories List */}
              {subs.length > 0 ? (
                <div className="divide-y divide-slate-100 text-xs">
                  {subs.map((sub) => {
                    const isSubEditing = editingId === sub.categoryId;
                    return (
                      <div
                        key={sub.categoryId}
                        className="pl-9 pr-5 py-2.5 flex items-center justify-between hover:bg-slate-50/70 transition-colors gap-3"
                      >
                        <div className="flex items-center gap-2.5 flex-1">
                          <CornerDownRight className="w-3.5 h-3.5 text-slate-300 shrink-0" />

                          {isSubEditing ? (
                            <div className="flex items-center gap-2 flex-1">
                              <input
                                type="text"
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                                className="px-2 py-1 border border-teal-500 rounded-md text-xs text-slate-900 flex-1 max-w-xs bg-white"
                                autoFocus
                              />
                              <select
                                value={editParentId}
                                onChange={(e) => setEditParentId(e.target.value)}
                                className="px-2 py-1 border border-slate-200 rounded-md text-xs text-slate-700 bg-white"
                              >
                                {mainCategories.map((m) => (
                                  <option key={m.categoryId} value={m.categoryId}>
                                    {m.categoryName}
                                  </option>
                                ))}
                              </select>
                              <button
                                onClick={() => handleSaveEdit(sub)}
                                disabled={isSubmitting}
                                className="p-1 text-emerald-600 hover:bg-emerald-50 rounded cursor-pointer disabled:opacity-50"
                                title="บันทึก"
                              >
                                {isSubmitting ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <Check className="w-4 h-4" />
                                )}
                              </button>
                              <button
                                onClick={() => setEditingId(null)}
                                disabled={isSubmitting}
                                className="p-1 text-slate-400 hover:bg-slate-100 rounded cursor-pointer"
                                title="ยกเลิก"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          ) : (
                            <span
                              className={`font-medium ${
                                sub.isActive ? 'text-slate-800' : 'text-slate-400 line-through'
                              }`}
                            >
                              {sub.categoryName}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            onClick={() => handleStartEdit(sub)}
                            className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded transition-colors cursor-pointer"
                            title="แก้ไขชื่อ"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleToggleStatus(sub)}
                            disabled={togglingId === sub.categoryId}
                            className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded cursor-pointer disabled:opacity-60 ${
                              sub.isActive
                                ? 'text-emerald-700 hover:bg-emerald-50'
                                : 'text-slate-500 hover:bg-slate-100'
                            }`}
                          >
                            {togglingId === sub.categoryId && (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            )}
                            <span>{sub.isActive ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}</span>
                          </button>
                          <button
                            onClick={() => setCatToDelete(sub)}
                            className="p-1 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors cursor-pointer"
                            title="ลบหมวดหมู่ย่อยนี้"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="px-9 py-3 text-slate-400 text-xs">
                  ยังไม่มีหมวดหมู่ย่อยในหมวดนี้
                </div>
              )}
            </div>
          );
        })}

        {/* Legacy / Unassigned categories */}
        {legacyOrUnassignedCategories.length > 0 && (
          <div className="bg-amber-50/50 p-4">
            <h4 className="text-xs font-semibold text-amber-900 mb-2 flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4 text-amber-600" />
              <span>
                หมวดหมู่อื่น ๆ ที่ยังไม่ได้จัดเข้าหมวดหมู่หลัก ({legacyOrUnassignedCategories.length} รายการ)
              </span>
            </h4>
            <div className="divide-y divide-amber-100">
              {legacyOrUnassignedCategories.map((c) => (
                <div key={c.categoryId} className="py-2 flex items-center justify-between text-xs">
                  <span className="text-slate-700 font-medium">{c.categoryName}</span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleStartEdit(c)}
                      className="text-amber-800 text-[11px] underline font-semibold cursor-pointer"
                    >
                      ย้ายเข้าหมวดหมู่หลัก
                    </button>
                    <button
                      onClick={() => setCatToDelete(c)}
                      className="p-1 text-slate-400 hover:text-rose-600 cursor-pointer"
                      title="ลบหมวดหมู่นี้"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {catToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-xl max-w-md w-full shadow-xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2.5 text-slate-900">
                <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-display text-sm font-bold">
                    {catToDelete.level === 'main' || !catToDelete.parentId
                      ? 'ยืนยันการลบหมวดหมู่หลัก'
                      : 'ยืนยันการลบหมวดหมู่ย่อย'}
                  </h3>
                  <p className="text-[11px] text-slate-500">โปรดตรวจสอบรายละเอียดก่อนยืนยัน</p>
                </div>
              </div>
              <button
                onClick={() => !isDeleting && setCatToDelete(null)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 cursor-pointer"
                disabled={isDeleting}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg space-y-1">
                <div className="text-[11px] text-slate-500">
                  {catToDelete.level === 'main' || !catToDelete.parentId ? 'หมวดหมู่หลัก' : 'หมวดหมู่ย่อย'}
                  {catToDelete.parentName ? ` · สังกัด ${catToDelete.parentName}` : ''}
                </div>
                <div className="text-sm font-semibold text-slate-900">
                  {catToDelete.categoryName}
                </div>
              </div>

              {deletingSubcategories.length > 0 && (
                <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-lg space-y-1.5">
                  <div className="font-semibold text-amber-900">
                    มีหมวดหมู่ย่อยที่สังกัดอยู่ {deletingSubcategories.length} รายการ
                  </div>
                  <p className="text-[11px] text-amber-800 leading-relaxed">
                    เมื่อลบหมวดหมู่หลักนี้ ระบบจะลบหมวดหมู่ย่อยทั้งหมดที่สังกัดอยู่ด้วย ({deletingSubcategories.map((s) => s.categoryName).join(', ')})
                  </p>
                </div>
              )}

              {linkedReceiptsCount > 0 && (
                <div className="p-3 bg-sky-50 border border-sky-200 rounded-lg text-sky-900 text-[11px] leading-relaxed flex items-start gap-2">
                  <ReceiptIcon className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
                  <div>
                    มีใบเสร็จจำนวน <span className="font-semibold font-mono">{linkedReceiptsCount}</span> รายการที่ใช้หมวดหมู่นี้ (ข้อมูลใบเสร็จจะยังคงอยู่)
                  </div>
                </div>
              )}

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setCatToDelete(null)}
                  disabled={isDeleting}
                  className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg font-medium text-xs transition cursor-pointer disabled:opacity-50"
                >
                  ยกเลิก
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  disabled={isDeleting}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-semibold text-xs transition cursor-pointer disabled:opacity-50"
                >
                  {isDeleting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>กำลังลบ...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>ยืนยันการลบ</span>
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
