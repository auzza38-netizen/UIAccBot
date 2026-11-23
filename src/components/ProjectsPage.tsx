import React, { useState } from 'react';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';
import { Project, AppUser } from '../types';
import { formatCurrency, formatThaiDate } from '../utils/formatters';
import {
  FolderKanban,
  Plus,
  Edit2,
  Trash2,
  AlertTriangle,
  Loader2,
  Users,
  Calendar,
  DollarSign,
  Briefcase,
  CheckCircle2,
  Archive,
  Search,
  X,
  Check,
} from 'lucide-react';

export const ProjectsPage: React.FC = () => {
  const { projects, receipts, users, saveProject, updateProjectStatus, deleteProject } = useData();
  const { isAdmin, currentUser } = useAuth();

  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);

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
    setIsModalOpen(true);
  };

  const openEditModal = (p: Project) => {
    setEditingProject(p);
    setProjectCode(p.projectCode);
    setClientName(p.clientName || '');
    setAssignedUsers(p.assignedUsers || []);
    setStatus(p.status || 'active');
    setNotes(p.notes || '');
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
      alert('กรุณากรอกชื่อลูกค้า หรือ หน่วยงาน');
      return;
    }

    try {
      await saveProject({
        projectId: editingProject ? editingProject.projectId : undefined,
        projectCode: projectCode.trim(),
        clientName: clientName.trim(),
        budget: 0,
        assignedUsers,
        status,
        notes: notes.trim(),
      });
      setIsModalOpen(false);
    } catch (e: any) {
      alert('บันทึกโครงการไม่สำเร็จ: ' + e.message);
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
          className={`p-3 rounded-xl border flex items-center justify-between gap-2 shadow-sm text-xs font-medium animate-in fade-in duration-200 ${
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
            className="p-1 rounded text-slate-400 hover:text-slate-600"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <FolderKanban className="w-5 h-5 text-teal-600" />
            การจัดการโครงการ (Project Management)
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            กำหนดสิทธิ์ผู้ใช้งาน และติดตามยอดสรุปงบที่ได้คีย์ข้อมูลเข้าไปแล้วทั้งหมดตามลูกค้าหรือหน่วยงาน
          </p>
        </div>

        {isAdmin && (
          <button
            onClick={openCreateModal}
            className="flex items-center gap-1.5 px-4 py-2 bg-[#12304A] hover:bg-[#1c486e] text-white rounded-lg text-xs font-semibold shadow-xs cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4" />
            สร้างโครงการใหม่
          </button>
        )}
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-3 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-2xs">
        <div className="relative flex-1 w-full sm:w-auto">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="ค้นหาชื่อลูกค้าหรือหน่วยงาน, รหัสโครงการ..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-teal-600"
          />
        </div>

        <div className="flex items-center gap-1 text-xs w-full sm:w-auto overflow-x-auto">
          {['all', 'active', 'completed', 'archived'].map((st) => (
            <button
              key={st}
              onClick={() => setSelectedStatus(st)}
              className={`px-3 py-1.5 rounded-md font-medium whitespace-nowrap cursor-pointer ${
                selectedStatus === st
                  ? 'bg-[#12304A] text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {st === 'all'
                ? 'ทั้งหมด'
                : st === 'active'
                ? 'เปิดใช้งาน (Active)'
                : st === 'completed'
                ? 'เสร็จสิ้น (Completed)'
                : 'จัดเก็บ (Archived)'}
            </button>
          ))}
        </div>
      </div>

      {/* Project Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredProjects.map((p) => {
          const pReceipts = receipts.filter((r) => r.projectId === p.projectId && !r.isDeleted);
          const totalSpent = pReceipts.reduce((sum, r) => sum + (r.grandTotal || 0), 0);

          return (
            <div
              key={p.projectId}
              className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs hover:shadow-xs transition flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div>
                    <span className="text-xs font-mono font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded">
                      {p.projectCode}
                    </span>
                    <h3 className="font-bold text-slate-900 text-sm mt-1">{p.clientName}</h3>
                  </div>

                  {isAdmin && (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openEditModal(p)}
                        className="p-1.5 text-slate-400 hover:text-slate-800 rounded hover:bg-slate-100 cursor-pointer transition"
                        title="แก้ไขโครงการ"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => {
                          setDeleteError(null);
                          setProjectToDelete(p);
                        }}
                        className="p-1.5 text-slate-400 hover:text-rose-600 rounded hover:bg-rose-50 cursor-pointer transition"
                        title="ลบโครงการ"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>

                {/* Total Summary Section */}
                <div className="bg-slate-50 rounded-lg p-3 border border-slate-100 space-y-1.5 mt-3">
                  <div className="text-[11px] font-medium text-slate-500">
                    ยอดสรุปงบ ที่ได้คีย์ข้อมูลเข้าไปแล้วทั้งหมด:
                  </div>
                  <div className="flex items-baseline justify-between">
                    <span className="text-base font-extrabold text-teal-800 font-mono tabular-nums">
                      {formatCurrency(totalSpent)}
                    </span>
                    <span className="text-[11px] text-slate-500 font-mono">
                      {pReceipts.length} ใบเสร็จ
                    </span>
                  </div>
                </div>

                {/* Assigned Users list */}
                <div className="mt-3 flex items-center gap-1.5 text-xs text-slate-500">
                  <Users className="w-3.5 h-3.5 text-slate-400" />
                  <span>ผู้ได้รับสิทธิ์:</span>
                  <span className="font-medium text-slate-700">
                    {p.assignedUsers?.length || 0} คน
                  </span>
                </div>
              </div>

              {/* Status and Action Footer */}
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                <span
                  className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                    p.status === 'active'
                      ? 'bg-emerald-50 text-emerald-700'
                      : p.status === 'completed'
                      ? 'bg-blue-50 text-blue-700'
                      : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {p.status === 'active' ? 'Active' : p.status === 'completed' ? 'Completed' : 'Archived'}
                </span>

                <span className="text-[11px] text-slate-400 font-mono">
                  {pReceipts.length} ใบเสร็จ
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Create / Edit Project Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-5 py-3.5 bg-[#12304A] text-white flex items-center justify-between">
              <h3 className="text-base font-bold">
                {editingProject ? 'แก้ไขข้อมูลโครงการ' : 'สร้างโครงการใหม่'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded text-slate-300 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-5 space-y-3.5 overflow-y-auto text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    รหัสโครงการ <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={projectCode}
                    onChange={(e) => setProjectCode(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-slate-900 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    สถานะโครงการ
                  </label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as any)}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-slate-900"
                  >
                    <option value="active">Active (เปิดใช้งาน)</option>
                    <option value="completed">Completed (เสร็จสิ้น)</option>
                    <option value="archived">Archived (จัดเก็บ)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  ชื่อลูกค้า หรือ หน่วยงาน <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="เช่น กรมสรรพากร, บริษัท ABC จำกัด, หรือ ฝ่ายเทคโนโลยีสารสนเทศ"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-slate-900"
                />
              </div>

              {/* Assigned Users list */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  กำหนดสิทธิ์ User ที่เข้าถึงโครงการได้
                </label>
                <div className="max-h-36 overflow-y-auto border border-slate-200 rounded-lg p-2 space-y-1.5 bg-slate-50">
                  {users.length > 0 ? (
                    users.map((u) => {
                      const isChecked = assignedUsers.includes(u.email);
                      return (
                        <label
                          key={u.uid}
                          className="flex items-center gap-2 p-1 rounded hover:bg-slate-100 cursor-pointer text-xs"
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
                      ยังไม่มี User อื่นในระบบ (คุณจะได้รับสิทธิ์อัตโนมัติ)
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
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-slate-900"
                  placeholder="บันทึกข้อความหรือข้อตกลง..."
                />
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-between gap-2">
                {isAdmin && editingProject ? (
                  <button
                    type="button"
                    onClick={() => {
                      setIsModalOpen(false);
                      setDeleteError(null);
                      setProjectToDelete(editingProject);
                    }}
                    className="flex items-center gap-1.5 px-3 py-2 text-rose-600 hover:bg-rose-50 border border-rose-200 rounded-lg text-xs font-semibold cursor-pointer transition"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    ลบโครงการนี้
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
                    className="px-5 py-2 bg-[#0D9488] hover:bg-teal-700 text-white rounded-lg font-bold shadow-xs cursor-pointer"
                  >
                    บันทึกข้อมูล
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Project Confirmation Modal */}
      {projectToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md border border-slate-200 overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150">
            <div className="px-5 py-4 bg-rose-600 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Trash2 className="w-5 h-5 text-white" />
                <h3 className="text-base font-bold">ยืนยันการลบโครงการ</h3>
              </div>
              <button
                onClick={() => {
                  if (!isDeleting) setProjectToDelete(null);
                }}
                disabled={isDeleting}
                className="p-1 rounded text-white/80 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-3.5 text-xs text-slate-700">
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-teal-800 bg-teal-50 px-2 py-0.5 rounded text-xs border border-teal-200">
                    {projectToDelete.projectCode}
                  </span>
                  <span className="font-bold text-slate-900 text-sm">{projectToDelete.clientName}</span>
                </div>
                {projectToDelete.notes && (
                  <p className="text-[11px] text-slate-500 mt-1 italic">"{projectToDelete.notes}"</p>
                )}
              </div>

              {(() => {
                const linkedReceipts = receipts.filter(
                  (r) => r.projectId === projectToDelete.projectId && !r.isDeleted
                );
                return (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs space-y-1">
                    <div className="font-semibold flex items-center gap-1.5 text-amber-800">
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                      มีใบเสร็จในโครงการนี้ {linkedReceipts.length} รายการ
                    </div>
                    <p className="text-[11px] text-amber-700 leading-relaxed">
                      การลบโครงการจะนำข้อมูลโครงการนี้ออกจากระบบ ใบเสร็จเดิมที่เคยคีย์ไว้จะไม่สูญหาย แต่จะถูกปรับสถานะเป็นไม่มีโครงการผูกไว้
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

              <p className="text-slate-600 text-xs">
                คุณแน่ใจหรือไม่ว่าต้องการลบโครงการนี้? การดำเนินการนี้ไม่สามารถย้อนกลับได้
              </p>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={() => setProjectToDelete(null)}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50 font-medium cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={handleConfirmDelete}
                  className="flex items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-75 text-white rounded-xl font-bold shadow-xs cursor-pointer transition"
                >
                  {isDeleting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      กำลังลบโครงการ...
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4" />
                      ยืนยันลบโครงการ
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
