import React, { useState } from 'react';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';
import { Project } from '../types';
import { formatCurrency } from '../utils/formatters';
import {
  Plus,
  Edit2,
  Trash2,
  AlertTriangle,
  Loader2,
  Users,
  CheckCircle2,
  Search,
  X,
} from 'lucide-react';

export const ProjectsPage: React.FC = () => {
  const { projects, receipts, users, saveProject, deleteProject } = useData();
  const { isAdmin, currentUser } = useAuth();

  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Form fields
  const [projectCode, setProjectCode] = useState<string>('');
  const [clientName, setClientName] = useState<string>('');
  const [assignedUsers, setAssignedUsers] = useState<string[]>([]);
  const [status, setStatus] = useState<Project['status']>('active');
  const [notes, setNotes] = useState<string>('');

  // Delete State & Notifications
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  React.useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => setToastMessage(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  const handleConfirmDelete = async () => {
    if (!projectToDelete) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      await deleteProject(projectToDelete.projectId);
      setToastMessage({
        type: 'success',
        text: `ลบโครงการ ${projectToDelete.projectCode} (${projectToDelete.clientName}) เรียบร้อยแล้ว`,
      });
      setProjectToDelete(null);
      if (isModalOpen && editingProject?.projectId === projectToDelete.projectId) {
        setIsModalOpen(false);
      }
    } catch (err: any) {
      setDeleteError(err.message || 'เกิดข้อผิดพลาดในการลบโครงการ');
    } finally {
      setIsDeleting(false);
    }
  };

  const openCreateModal = () => {
    setEditingProject(null);
    setProjectCode('PRJ-' + Math.floor(100 + Math.random() * 900));
    setClientName('');
    setAssignedUsers(currentUser?.email ? [currentUser.email] : []);
    setStatus('active');
    setNotes('');
    setFormError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (p: Project) => {
    setEditingProject(p);
    setProjectCode(p.projectCode);
    setClientName(p.clientName || '');
    setAssignedUsers(p.assignedUsers || []);
    setStatus(p.status || 'active');
    setNotes(p.notes || '');
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleToggleUser = (userEmail: string) => {
    if (assignedUsers.includes(userEmail)) {
      setAssignedUsers(assignedUsers.filter((u) => u !== userEmail));
    } else {
      setAssignedUsers([...assignedUsers, userEmail]);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientName.trim()) {
      setFormError('กรุณากรอกชื่อลูกค้า หรือ หน่วยงาน');
      return;
    }

    setIsSaving(true);
    setFormError(null);
    try {
      await saveProject({
        projectId: editingProject ? editingProject.projectId : undefined,
        projectCode: projectCode.trim(),
        clientName: clientName.trim(),
        budget: editingProject?.budget || 0,
        assignedUsers,
        status,
        notes: notes.trim(),
      });
      setToastMessage({
        type: 'success',
        text: editingProject
          ? `บันทึกการแก้ไขโครงการ ${projectCode.trim()} เรียบร้อยแล้ว`
          : `สร้างโครงการ ${projectCode.trim()} เรียบร้อยแล้ว`,
      });
      setIsModalOpen(false);
    } catch (e: any) {
      setFormError('บันทึกโครงการไม่สำเร็จ: ' + (e?.message || 'เกิดข้อผิดพลาด'));
    } finally {
      setIsSaving(false);
    }
  };

  // Filter projects
  const filteredProjects = projects.filter((p) => {
    const matchSearch =
      (p.clientName && p.clientName.toLowerCase().includes(searchTerm.toLowerCase())) ||
      p.projectCode.toLowerCase().includes(searchTerm.toLowerCase());
    const matchStatus = selectedStatus === 'all' || p.status === selectedStatus;
    return matchSearch && matchStatus;
  });

  return (
    <div className="space-y-5">
      {/* Toast Feedback */}
      {toastMessage && (
        <div
          className={`p-3.5 rounded-xl border flex items-center justify-between gap-2 text-xs font-medium ${
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

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            โครงการและงบประมาณ
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            กำหนดสิทธิ์ผู้ใช้งานและติดตามยอดสรุปค่าใช้จ่ายทั้งหมดตามลูกค้าหรือหน่วยงาน
          </p>
        </div>

        {isAdmin && (
          <button
            onClick={openCreateModal}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#0F766E] hover:bg-[#0D645D] text-white rounded-lg text-xs font-semibold cursor-pointer shrink-0 transition-colors whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            <span>สร้างโครงการใหม่</span>
          </button>
        )}
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-white border border-slate-200/80 rounded-xl p-3 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1 sm:max-w-sm">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
          <input
            type="text"
            placeholder="ค้นหาชื่อลูกค้า/หน่วยงาน หรือรหัสโครงการ..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full h-8.5 pl-8 pr-3 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600"
          />
        </div>

        <div className="flex items-center gap-1 p-1 bg-slate-100/80 rounded-lg text-xs overflow-x-auto scrollbar-none">
          {[
            { id: 'all', label: 'ทั้งหมด' },
            { id: 'active', label: 'เปิดใช้งาน' },
            { id: 'completed', label: 'เสร็จสิ้น' },
            { id: 'archived', label: 'จัดเก็บ' },
          ].map((st) => (
            <button
              key={st.id}
              onClick={() => setSelectedStatus(st.id)}
              className={`px-3 py-1.5 rounded-md font-medium whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                selectedStatus === st.id
                  ? 'bg-white text-slate-900 font-semibold shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {st.label}
            </button>
          ))}
        </div>
      </div>

      {/* Project Cards Grid (Flat Single-Elevation, Zero Pill Enclosures, Hairline Dividers) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredProjects.map((p) => {
          const pReceipts = receipts.filter((r) => r.projectId === p.projectId && !r.isDeleted);
          const totalSpent = pReceipts.reduce((sum, r) => sum + (r.grandTotal || 0), 0);

          return (
            <div
              key={p.projectId}
              className="bg-white border border-slate-200/80 hover:border-slate-300 rounded-xl p-5 transition-colors flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="font-mono font-semibold text-teal-800">{p.projectCode}</span>
                      <span aria-hidden="true" className="text-slate-300">·</span>
                      <span
                        className={`font-medium ${
                          p.status === 'active'
                            ? 'text-emerald-700'
                            : p.status === 'completed'
                            ? 'text-sky-700'
                            : 'text-slate-500'
                        }`}
                      >
                        {p.status === 'active'
                          ? 'เปิดใช้งาน'
                          : p.status === 'completed'
                          ? 'เสร็จสิ้น'
                          : 'จัดเก็บ'}
                      </span>
                    </div>
                    <h3 className="font-display font-semibold text-slate-900 text-sm mt-1 truncate">
                      {p.clientName}
                    </h3>
                  </div>

                  {isAdmin && (
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => openEditModal(p)}
                        className="p-1.5 text-slate-400 hover:text-slate-800 rounded-lg hover:bg-slate-100 cursor-pointer transition-colors"
                        title="แก้ไขโครงการ"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => {
                          setDeleteError(null);
                          setProjectToDelete(p);
                        }}
                        className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 cursor-pointer transition-colors"
                        title="ลบโครงการ"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>

                {/* Financial Total Row */}
                <div className="py-3.5 border-y border-slate-100">
                  <span className="text-[11px] text-slate-500 block">
                    ยอดค่าใช้จ่ายที่บันทึกแล้ว
                  </span>
                  <div className="flex items-baseline justify-between mt-1">
                    <span className="text-xl font-bold text-slate-900 font-mono tabular-nums">
                      {formatCurrency(totalSpent)}
                    </span>
                    <span className="text-xs text-slate-500 font-mono tabular-nums">
                      {pReceipts.length} ใบเสร็จ
                    </span>
                  </div>
                </div>
              </div>

              {/* Quiet Metadata Footer */}
              <div className="pt-3 flex items-center justify-between text-xs text-slate-500">
                <span className="inline-flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-slate-400" />
                  <span>ผู้มีสิทธิ์ {p.assignedUsers?.length || 0} คน</span>
                </span>
                {p.notes && (
                  <span className="text-[11px] text-slate-400 truncate max-w-[160px]" title={p.notes}>
                    {p.notes}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Create / Edit Project Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="font-display text-base font-bold text-slate-900">
                  {editingProject ? 'แก้ไขข้อมูลโครงการ' : 'สร้างโครงการใหม่'}
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  กำหนดรหัสโครงการ หน่วยงาน และสิทธิ์การเข้าถึงสำหรับพนักงาน
                </p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-5 space-y-4 overflow-y-auto text-xs">
              {formError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    รหัสโครงการ <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={projectCode}
                    onChange={(e) => setProjectCode(e.target.value)}
                    className="w-full h-9 px-3 border border-slate-200 rounded-lg text-slate-900 font-mono focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    สถานะโครงการ
                  </label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as any)}
                    className="w-full h-9 px-2.5 border border-slate-200 rounded-lg text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600"
                  >
                    <option value="active">เปิดใช้งาน (Active)</option>
                    <option value="completed">เสร็จสิ้น (Completed)</option>
                    <option value="archived">จัดเก็บ (Archived)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  ชื่อลูกค้า หรือ หน่วยงาน <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="เช่น บริษัท เอบีซี จำกัด หรือ ฝ่ายเทคโนโลยีสารสนเทศ"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  className="w-full h-9 px-3 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600"
                />
              </div>

              {/* Assigned Users list */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1.5">
                  กำหนดสิทธิ์ผู้ใช้งานที่เข้าถึงโครงการได้
                </label>
                <div className="max-h-36 overflow-y-auto border border-slate-200 rounded-lg p-2 space-y-1 bg-slate-50/70">
                  {users.length > 0 ? (
                    users.map((u) => {
                      const isChecked = assignedUsers.includes(u.email);
                      return (
                        <label
                          key={u.uid}
                          className="flex items-center gap-2 p-1.5 rounded-md hover:bg-white cursor-pointer text-xs"
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => handleToggleUser(u.email)}
                            className="rounded text-teal-600 focus:ring-teal-500"
                          />
                          <span className="font-medium text-slate-800">{u.displayName || u.email}</span>
                          <span className="text-[11px] text-slate-400 font-mono">({u.email})</span>
                        </label>
                      );
                    })
                  ) : (
                    <p className="text-slate-400 text-center py-2">
                      ยังไม่มีผู้ใช้งานอื่นในระบบ
                    </p>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  หมายเหตุโครงการ
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600"
                  placeholder="บันทึกข้อความหรือรายละเอียดเพิ่มเติม..."
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                {isAdmin && editingProject ? (
                  <button
                    type="button"
                    onClick={() => {
                      setIsModalOpen(false);
                      setDeleteError(null);
                      setProjectToDelete(editingProject);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-rose-600 hover:bg-rose-50 border border-rose-200 rounded-lg text-xs font-semibold cursor-pointer transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>ลบโครงการ</span>
                  </button>
                ) : (
                  <div />
                )}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 rounded-lg text-slate-600 hover:bg-slate-100 font-medium cursor-pointer"
                  >
                    ยกเลิก
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="inline-flex items-center gap-1.5 px-5 py-2 bg-[#0F766E] hover:bg-[#0D645D] disabled:opacity-60 text-white rounded-lg font-semibold cursor-pointer transition-colors"
                  >
                    {isSaving ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>กำลังบันทึก...</span>
                      </>
                    ) : (
                      <span>บันทึกข้อมูล</span>
                    )}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Project Confirmation Modal */}
      {projectToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md border border-slate-200 overflow-hidden flex flex-col">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2.5 text-slate-900">
                <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                  <Trash2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-display text-sm font-bold">ยืนยันการลบโครงการ</h3>
                  <p className="text-[11px] text-slate-500">ตรวจสอบข้อมูลก่อนยืนยัน</p>
                </div>
              </div>
              <button
                onClick={() => {
                  if (!isDeleting) setProjectToDelete(null);
                }}
                disabled={isDeleting}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-3.5 text-xs text-slate-700">
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-semibold text-teal-800">{projectToDelete.projectCode}</span>
                  <span aria-hidden="true" className="text-slate-300">·</span>
                  <span className="font-semibold text-slate-900 text-sm">{projectToDelete.clientName}</span>
                </div>
                {projectToDelete.notes && (
                  <p className="text-[11px] text-slate-500">{projectToDelete.notes}</p>
                )}
              </div>

              {(() => {
                const linkedReceipts = receipts.filter(
                  (r) => r.projectId === projectToDelete.projectId && !r.isDeleted
                );
                return (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 text-xs space-y-1">
                    <div className="font-semibold flex items-center gap-1.5 text-amber-800">
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                      <span>มีใบเสร็จในโครงการนี้ {linkedReceipts.length} รายการ</span>
                    </div>
                    <p className="text-[11px] text-amber-700 leading-relaxed">
                      ใบเสร็จเดิมที่เคยบันทึกไว้จะไม่สูญหาย แต่จะถูกปรับสถานะเป็นไม่มีโครงการผูกไว้
                    </p>
                  </div>
                );
              })()}

              {deleteError && (
                <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{deleteError}</span>
                </div>
              )}

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={() => setProjectToDelete(null)}
                  className="px-4 py-2 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 font-medium cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={handleConfirmDelete}
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
                      <span>ยืนยันลบโครงการ</span>
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
