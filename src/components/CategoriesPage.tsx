import React, { useState, useMemo } from 'react';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';
import {
  Tags,
  Plus,
  Check,
  X,
  Edit2,
  Trash2,
  FolderTree,
  FolderPlus,
  CornerDownRight,
  Layers,
  ChevronDown,
  ChevronRight,
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

  // Mode: 'main' (หมวดหมู่หลัก) vs 'sub' (หมวดหมู่ย่อย)
  const [addMode, setAddMode] = useState<'main' | 'sub'>('main');
  const [newCatName, setNewCatName] = useState<string>('');
  const [selectedParentId, setSelectedParentId] = useState<string>('');

  // Editing state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState<string>('');
  const [editParentId, setEditParentId] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Deletion Modal state (replaces window.confirm & alert)
  const [catToDelete, setCatToDelete] = useState<ExpenseCategory | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Group categories into Main Categories and Subcategories
  const mainCategories = categories.filter((c) => c.level === 'main' || !c.parentId);
  
  const getSubcategories = (parentId: string) => {
    return categories.filter((c) => c.parentId === parentId && c.level === 'sub');
  };

  // Categories without valid parent or legacy categories
  const legacyOrUnassignedCategories = categories.filter(
    (c) => c.level === 'sub' && (!c.parentId || !mainCategories.some((m) => m.categoryId === c.parentId))
  );

  // Subcategories of the category currently selected for deletion
  const deletingSubcategories = useMemo(() => {
    if (!catToDelete) return [];
    return getSubcategories(catToDelete.categoryId);
  }, [catToDelete, categories]);

  // Receipts referencing the category or its subcategories
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
        text: 'ลบหมวดหมู่ไม่สำเร็จ: ' + (err.message || 'โปรดตรวจสอบสิทธิ์หรือการเชื่อมต่อ'),
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

  if (!isAdmin) {
    return (
      <div className="p-8 text-center text-slate-500 text-sm">
        เฉพาะ Master Admin เท่านั้นที่สามารถจัดการหมวดหมู่ค่าใช้จ่าย
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Tags className="w-5 h-5 text-teal-600" />
            การจัดการหมวดหมู่ค่าใช้จ่าย (Expense Categories)
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            กำหนดโครงสร้างหมวดหมู่หลักและหมวดหมู่ย่อยสำหรับการลงบัญชีและการคัดแยกใบเสร็จอัตโนมัติด้วย AI
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-600 bg-slate-100 px-3 py-1.5 rounded-lg">
          <span>หมวดหมู่หลัก: {mainCategories.length}</span>
          <span>•</span>
          <span>หมวดหมู่ย่อย: {categories.filter(c => c.level === 'sub').length}</span>
        </div>
      </div>

      {/* Feedback Toast / Banner */}
      {feedbackMsg && (
        <div
          className={`p-3.5 rounded-2xl border flex items-center justify-between text-xs animate-in fade-in duration-200 shadow-2xs ${
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
            <span className="font-semibold">{feedbackMsg.text}</span>
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
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <FolderPlus className="w-4 h-4 text-teal-600" />
            <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              เพิ่มหมวดหมู่ใหม่
            </span>
          </div>

          {/* Toggle Main vs Sub */}
          <div className="inline-flex p-1 bg-slate-100 rounded-xl text-xs font-semibold">
            <button
              type="button"
              onClick={() => {
                setAddMode('main');
                setSelectedParentId('');
              }}
              className={`px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
                addMode === 'main'
                  ? 'bg-white text-[#12304A] font-bold shadow-2xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <FolderTree className="w-3.5 h-3.5" />
              หมวดหมู่หลัก (Main)
            </button>
            <button
              type="button"
              onClick={() => {
                setAddMode('sub');
                if (!selectedParentId && mainCategories.length > 0) {
                  setSelectedParentId(mainCategories[0].categoryId);
                }
              }}
              className={`px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
                addMode === 'sub'
                  ? 'bg-white text-[#12304A] font-bold shadow-2xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <CornerDownRight className="w-3.5 h-3.5" />
              หมวดหมู่ย่อย (Sub-Category)
            </button>
          </div>
        </div>

        <form onSubmit={handleAdd} className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
            {addMode === 'sub' && (
              <div className="md:col-span-4">
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  สังกัดหมวดหมู่หลัก: <span className="text-rose-500">*</span>
                </label>
                <select
                  value={selectedParentId}
                  onChange={(e) => setSelectedParentId(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg text-slate-900 bg-white focus:outline-none focus:ring-1 focus:ring-teal-600"
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
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                {addMode === 'main' ? 'ชื่อหมวดหมู่หลัก:' : 'ชื่อหมวดหมู่ย่อย:'} <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                placeholder={
                  addMode === 'main'
                    ? 'เช่น ค่าเดินทางและยานพาหนะ, ค่าวัสดุอุปกรณ์, ค่าบริการวิชาชีพ...'
                    : 'เช่น ค่าน้ำมันเชื้อเพลิง, ค่าทางด่วน, ค่าที่พัก, ค่าอาหาร...'
                }
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-1 focus:ring-teal-600"
                required
              />
            </div>

            <div className={addMode === 'sub' ? 'md:col-span-2' : 'md:col-span-3'}>
              <label className="block text-[11px] font-semibold text-transparent mb-1 select-none">Action</label>
              <button
                type="submit"
                disabled={isSubmitting || !newCatName.trim()}
                className="w-full flex items-center justify-center gap-1.5 px-4 py-2 bg-[#0D9488] hover:bg-teal-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold cursor-pointer transition shadow-2xs"
              >
                <Plus className="w-4 h-4" />
                {addMode === 'main' ? 'เพิ่มหมวดหลัก' : 'เพิ่มหมวดหมู่ย่อย'}
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Categories Tree List */}
      <div className="space-y-4">
        {mainCategories.map((mainCat) => {
          const subs = getSubcategories(mainCat.categoryId);
          const isMainEditing = editingId === mainCat.categoryId;

          return (
            <div
              key={mainCat.categoryId}
              className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden transition-all hover:border-slate-300"
            >
              {/* Main Category Header Row */}
              <div className="p-4 bg-slate-50/80 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 flex-1 min-w-[200px]">
                  <span className="w-3 h-3 rounded-full bg-teal-600 shrink-0" />
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-teal-100 text-teal-800 shrink-0">
                    หมวดหมู่หลัก
                  </span>

                  {isMainEditing ? (
                    <div className="flex items-center gap-2 flex-1">
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="px-2.5 py-1 border border-teal-500 rounded text-xs text-slate-900 flex-1 max-w-xs bg-white"
                        autoFocus
                      />
                      <button
                        onClick={() => handleSaveEdit(mainCat)}
                        className="p-1 text-emerald-600 hover:bg-emerald-50 rounded"
                        title="บันทึก"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="p-1 text-slate-400 hover:bg-slate-100 rounded"
                        title="ยกเลิก"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-sm font-bold ${
                          mainCat.isActive ? 'text-slate-900' : 'text-slate-400 line-through'
                        }`}
                      >
                        {mainCat.categoryName}
                      </span>
                      <span className="text-[11px] font-normal text-slate-400">
                        ({subs.length} หมวดหมู่ย่อย)
                      </span>
                    </div>
                  )}
                </div>

                {/* Main Category Actions */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => handleQuickAddSub(mainCat.categoryId)}
                    className="flex items-center gap-1 px-2.5 py-1 bg-white hover:bg-teal-50 text-teal-700 border border-teal-200 rounded-lg text-[11px] font-semibold transition cursor-pointer"
                    title="เพิ่มหมวดหมู่ย่อยภายใต้หมวดนี้"
                  >
                    <Plus className="w-3 h-3" />
                    เพิ่มหมวดหมู่ย่อย
                  </button>

                  <button
                    onClick={() => handleStartEdit(mainCat)}
                    className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-200/60 rounded-md transition"
                    title="แก้ไขชื่อหมวดหมู่หลัก"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={() => toggleCategoryStatus(mainCat.categoryId, !mainCat.isActive)}
                    className={`px-2 py-0.5 rounded text-[11px] font-semibold cursor-pointer ${
                      mainCat.isActive
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-slate-200 text-slate-600'
                    }`}
                  >
                    {mainCat.isActive ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}
                  </button>

                  <button
                    onClick={() => setCatToDelete(mainCat)}
                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition cursor-pointer"
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
                        className="px-6 py-3 flex items-center justify-between hover:bg-slate-50/70 transition gap-3"
                      >
                        <div className="flex items-center gap-3 flex-1">
                          <CornerDownRight className="w-3.5 h-3.5 text-slate-400 shrink-0 ml-1" />
                          <span className="w-2 h-2 rounded-full bg-slate-400 shrink-0" />

                          {isSubEditing ? (
                            <div className="flex items-center gap-2 flex-1">
                              <input
                                type="text"
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                                className="px-2 py-1 border border-teal-500 rounded text-xs text-slate-900 flex-1 max-w-xs bg-white"
                                autoFocus
                              />
                              <select
                                value={editParentId}
                                onChange={(e) => setEditParentId(e.target.value)}
                                className="px-2 py-1 border border-slate-300 rounded text-xs text-slate-700 bg-white"
                              >
                                {mainCategories.map((m) => (
                                  <option key={m.categoryId} value={m.categoryId}>
                                    {m.categoryName}
                                  </option>
                                ))}
                              </select>
                              <button
                                onClick={() => handleSaveEdit(sub)}
                                className="p-1 text-emerald-600 hover:bg-emerald-50 rounded cursor-pointer"
                                title="บันทึก"
                              >
                                <Check className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => setEditingId(null)}
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

                        {/* Subcategory Actions */}
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            onClick={() => handleStartEdit(sub)}
                            className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded transition cursor-pointer"
                            title="แก้ไขชื่อ"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => toggleCategoryStatus(sub.categoryId, !sub.isActive)}
                            className={`px-2 py-0.5 rounded text-[10px] font-semibold cursor-pointer ${
                              sub.isActive
                                ? 'bg-emerald-50 text-emerald-700'
                                : 'bg-slate-100 text-slate-500'
                            }`}
                          >
                            {sub.isActive ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}
                          </button>
                          <button
                            onClick={() => setCatToDelete(sub)}
                            className="p-1 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded transition cursor-pointer"
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
                <div className="px-6 py-4 text-center text-slate-400 text-xs italic bg-slate-50/30">
                  ยังไม่มีหมวดหมู่ย่อยในหมวดนี้ คลิก "+ เพิ่มหมวดหมู่ย่อย" ด้านบนเพื่อเพิ่มรายการ
                </div>
              )}
            </div>
          );
        })}

        {/* Legacy / Unassigned categories (if any) */}
        {legacyOrUnassignedCategories.length > 0 && (
          <div className="bg-amber-50/60 border border-amber-200 rounded-2xl p-4">
            <h4 className="text-xs font-bold text-amber-900 mb-2 flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4 text-amber-600" />
              หมวดหมู่อื่น ๆ ที่ยังไม่ได้จัดเข้าหมวดหมู่หลัก ({legacyOrUnassignedCategories.length} รายการ)
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

      {/* Delete Confirmation Modal (In-Page, no window.confirm) */}
      {catToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden transform transition-all">
            {/* Header */}
            <div className="bg-rose-50 border-b border-rose-100 p-5 flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <h3 className="text-base font-bold text-rose-950">
                  {catToDelete.level === 'main' || !catToDelete.parentId
                    ? 'ยืนยันการลบหมวดหมู่หลัก'
                    : 'ยืนยันการลบหมวดหมู่ย่อย'}
                </h3>
                <p className="text-xs text-rose-700 mt-0.5">
                  โปรดตรวจสอบรายละเอียดก่อนยืนยันการลบ
                </p>
              </div>
              <button
                onClick={() => !isDeleting && setCatToDelete(null)}
                className="text-rose-400 hover:text-rose-700 p-1 rounded-lg hover:bg-rose-100/50 transition cursor-pointer"
                disabled={isDeleting}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="p-5 space-y-4 text-xs">
              {/* Category Info Box */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      catToDelete.level === 'main' || !catToDelete.parentId
                        ? 'bg-teal-100 text-teal-800'
                        : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {catToDelete.level === 'main' || !catToDelete.parentId ? 'หมวดหมู่หลัก (Main)' : 'หมวดหมู่ย่อย (Sub)'}
                  </span>
                  {catToDelete.parentName && (
                    <span className="text-[11px] text-slate-500">
                      สังกัด: <span className="font-semibold text-slate-700">{catToDelete.parentName}</span>
                    </span>
                  )}
                </div>
                <div className="text-sm font-bold text-slate-900">
                  {catToDelete.categoryName}
                </div>
              </div>

              {/* Subcategories Warning if Main Category with Subs */}
              {deletingSubcategories.length > 0 && (
                <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl space-y-2">
                  <div className="flex items-center gap-2 font-bold text-amber-900 text-xs">
                    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>มีหมวดหมู่ย่อยที่สังกัดอยู่ {deletingSubcategories.length} รายการ</span>
                  </div>
                  <p className="text-[11px] text-amber-800 leading-relaxed">
                    เมื่อลบหมวดหมู่หลักนี้ ระบบจะทำการลบหมวดหมู่ย่อยทั้งหมดที่สังกัดอยู่ด้วยโดยอัตโนมัติ เพื่อรักษาความถูกต้องของผังบัญชี:
                  </p>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {deletingSubcategories.map((sub) => (
                      <span
                        key={sub.categoryId}
                        className="px-2 py-0.5 bg-white border border-amber-300 text-amber-900 rounded-md text-[11px] font-medium shadow-2xs"
                      >
                        {sub.categoryName}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Linked Receipts Info */}
              {linkedReceiptsCount > 0 && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-blue-900 text-[11px] leading-relaxed flex items-start gap-2">
                  <ReceiptIcon className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                  <div>
                    มีใบเสร็จในระบบจำนวน <span className="font-bold">{linkedReceiptsCount} รายการ</span> ที่เคยบันทึกด้วยหมวดหมู่นี้ 
                    (ข้อมูลใบเสร็จจะยังคงอยู่ ไม่สูญหาย)
                  </div>
                </div>
              )}

              <p className="text-slate-500 text-[11px]">
                การลบรายการนี้จะมีผลกับระบบทันที คุณต้องการดำเนินการต่อหรือไม่?
              </p>
            </div>

            {/* Actions */}
            <div className="bg-slate-50 border-t border-slate-100 px-5 py-3.5 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setCatToDelete(null)}
                disabled={isDeleting}
                className="px-4 py-2 border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-xl font-medium text-xs transition cursor-pointer disabled:opacity-50"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="flex items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold text-xs shadow-sm transition cursor-pointer disabled:opacity-50"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    กำลังลบ...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    ยืนยันการลบ{deletingSubcategories.length > 0 ? ` (${deletingSubcategories.length + 1} รายการ)` : ''}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
