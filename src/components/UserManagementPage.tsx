import React, { useState } from 'react';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';
import { AppUser, UserRole, UserStatus } from '../types';
import { formatThaiDateTime } from '../utils/formatters';
import {
  Users,
  UserPlus,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  XCircle,
  FolderKanban,
  Edit2,
  X,
  Check,
  Trash2,
  AlertTriangle,
  Loader2,
} from 'lucide-react';
import { AddUserModal } from './AddUserModal';

export const UserManagementPage: React.FC = () => {
  const { users, projects, updateUserRoleAndStatus, deleteUser } = useData();
  const { isAdmin, currentUser } = useAuth();

  // Add user modal
  const [isAddUserOpen, setIsAddUserOpen] = useState<boolean>(false);
  const [initialAddRole, setInitialAddRole] = useState<UserRole>('user');

  // Edit user modal
  const [selectedUser, setSelectedUser] = useState<AppUser | null>(null);
  const [editRole, setEditRole] = useState<UserRole>('user');
  const [editStatus, setEditStatus] = useState<UserStatus>('active');
  const [editProjects, setEditProjects] = useState<string[]>([]);
  const [isUpdating, setIsUpdating] = useState<boolean>(false);

  // Delete user state & feedback
  const [userToDelete, setUserToDelete] = useState<AppUser | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

  const openEditModal = (u: AppUser) => {
    setSelectedUser(u);
    setEditRole(u.role);
    setEditStatus(u.status);
    setEditProjects(u.assignedProjectIds || []);
  };

  const handleToggleProject = (projectId: string) => {
    if (editProjects.includes(projectId)) {
      setEditProjects(editProjects.filter((p) => p !== projectId));
    } else {
      setEditProjects([...editProjects, projectId]);
    }
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;

    setIsUpdating(true);
    try {
      await updateUserRoleAndStatus(selectedUser.uid, editRole, editStatus, editProjects);
      setSelectedUser(null);
    } catch (err: any) {
      alert('บันทึกสิทธิ์ผู้ใช้งานไม่สำเร็จ: ' + err.message);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleQuickApprove = async (u: AppUser) => {
    try {
      await updateUserRoleAndStatus(
        u.uid,
        u.role,
        'active',
        u.assignedProjectIds && u.assignedProjectIds.length > 0
          ? u.assignedProjectIds
          : projects.slice(0, 3).map((p) => p.projectId)
      );
    } catch (err: any) {
      alert('อนุมัติไม่สำเร็จ: ' + err.message);
    }
  };

  const handleDeleteUser = async () => {
    if (!userToDelete) return;
    if (userToDelete.uid === currentUser?.uid) {
      alert('ไม่สามารถลบบัญชีของตนเองที่กำลังเข้าสู่ระบบอยู่ได้');
      return;
    }

    setIsDeleting(true);
    try {
      await deleteUser(userToDelete.uid);
      const deletedEmail = userToDelete.email;
      setUserToDelete(null);
      setActionFeedback(`ลบผู้ใช้งาน "${deletedEmail}" ออกจากระบบเรียบร้อยแล้ว`);
      setTimeout(() => setActionFeedback(null), 4000);
    } catch (err: any) {
      alert('ลบผู้ใช้งานไม่สำเร็จ: ' + (err?.message || 'เกิดข้อผิดพลาด'));
    } finally {
      setIsDeleting(false);
    }
  };

  if (!isAdmin) {
    return (
      <div className="p-8 text-center text-slate-500 text-sm">
        เฉพาะ Master Admin เท่านั้นที่สามารถเข้าถึงการจัดการผู้ใช้งาน
      </div>
    );
  }

  const adminUsers = users.filter((u) => u.role === 'admin');
  const regularUsers = users.filter((u) => u.role !== 'admin');
  const pendingUsers = users.filter((u) => u.status === 'pending');

  return (
    <div className="space-y-5">
      {/* Action Feedback Banner */}
      {actionFeedback && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl flex items-center justify-between text-xs animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-medium">{actionFeedback}</span>
          </div>
          <button
            onClick={() => setActionFeedback(null)}
            className="text-emerald-700 hover:text-emerald-950 p-1 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Users className="w-5 h-5 text-teal-600" />
            การจัดการผู้ใช้งาน & กำหนดสิทธิ์โครงการ (User Access Control)
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            เพิ่มพนักงานสำหรับล็อกอินเข้ามาคีย์ข้อมูล แต่งตั้ง Master Admin ร่วม และจัดการลบหรือระงับสิทธิ์ผู้ใช้งาน
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => {
              setInitialAddRole('admin');
              setIsAddUserOpen(true);
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-[#12304A] hover:bg-[#1a4468] text-white rounded-lg text-xs font-bold shadow-xs cursor-pointer shrink-0"
            title="แต่งตั้ง Master Admin ร่วม (สิทธิ์เทียบเท่า)"
          >
            <ShieldCheck className="w-4 h-4 text-teal-300" />
            + แต่งตั้ง Master Admin ร่วม
          </button>

          <button
            onClick={() => {
              setInitialAddRole('user');
              setIsAddUserOpen(true);
            }}
            className="flex items-center gap-1.5 px-4 py-2 bg-[#0D9488] hover:bg-teal-700 text-white rounded-lg text-xs font-bold shadow-xs cursor-pointer shrink-0"
          >
            <UserPlus className="w-4 h-4" />
            + เพิ่มพนักงานคีย์ข้อมูล (User)
          </button>
        </div>
      </div>

      {/* Role Summary Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500 font-medium">Master Admin</span>
            <span className="text-xs font-mono font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded">
              {adminUsers.length} คน
            </span>
          </div>
          <p className="text-lg font-bold text-slate-900 mt-1">
            {adminUsers.length} <span className="text-xs font-normal text-slate-500">คน</span>
          </p>
          <p className="text-[11px] text-slate-400 mt-0.5 truncate">
            {adminUsers.map((a) => a.email).join(', ') || 'ไม่มีข้อมูล'}
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500 font-medium">พนักงานคีย์ข้อมูล (User)</span>
            <span className="text-xs font-mono font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
              ใช้งานได้
            </span>
          </div>
          <p className="text-lg font-bold text-slate-900 mt-1">
            {regularUsers.filter((u) => u.status === 'active').length} <span className="text-xs font-normal text-slate-500">คน</span>
          </p>
          <p className="text-[11px] text-slate-400 mt-0.5">
            พนักงานที่ได้รับสิทธิ์คีย์ข้อมูลและดูโครงการ
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500 font-medium">รออนุมัติ (Pending)</span>
            <span className="text-xs font-mono font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded">
              {pendingUsers.length} คน
            </span>
          </div>
          <p className="text-lg font-bold text-slate-900 mt-1">
            {pendingUsers.length} <span className="text-xs font-normal text-slate-500">คน</span>
          </p>
          <p className="text-[11px] text-slate-400 mt-0.5">
            {pendingUsers.length > 0 ? 'คลิก "อนุมัติ" เพื่อเปิดการใช้งาน' : 'ไม่มีผู้ใช้รออนุมัติ'}
          </p>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 bg-slate-50/50 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900">
            รายชื่อผู้ใช้งานทั้งหมด ({users.length} คน)
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3 px-4">ผู้ใช้งาน</th>
                <th className="py-3 px-4">อีเมล</th>
                <th className="py-3 px-4 text-center">บทบาท (Role)</th>
                <th className="py-3 px-4 text-center">สถานะ</th>
                <th className="py-3 px-4">โครงการที่ได้รับสิทธิ์</th>
                <th className="py-3 px-4">เข้าสู่ระบบล่าสุด</th>
                <th className="py-3 px-4 text-center">การกระทำ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((u) => {
                const assignedCount = u.assignedProjectIds?.length || 0;
                return (
                  <tr key={u.uid} className="hover:bg-slate-50">
                    <td className="py-3 px-4 font-semibold text-slate-900">
                      {u.displayName || 'User'}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-600">{u.email}</td>
                    <td className="py-3 px-4 text-center">
                      <span
                        className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                          u.role === 'admin'
                            ? 'bg-teal-100 text-teal-800'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {u.role === 'admin' ? 'Master Admin' : 'User'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold ${
                          u.status === 'active'
                            ? 'bg-emerald-50 text-emerald-700'
                            : u.status === 'pending'
                            ? 'bg-amber-50 text-amber-700'
                            : 'bg-red-50 text-red-700'
                        }`}
                      >
                        {u.status === 'active'
                          ? 'Active (ใช้งานได้)'
                          : u.status === 'pending'
                          ? 'Pending (รออนุมัติ)'
                          : 'Suspended (ระงับ)'}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      {u.role === 'admin' ? (
                        <span className="text-teal-700 font-semibold">เข้าถึงได้ทุกโครงการ (Admin)</span>
                      ) : (
                        <span className="text-slate-700">
                          {assignedCount > 0 ? `${assignedCount} โครงการ` : 'ยังไม่มีโครงการ'}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-slate-500 font-mono text-[11px]">
                      {formatThaiDateTime(u.lastLoginAt)}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        {u.status === 'pending' && (
                          <button
                            onClick={() => handleQuickApprove(u)}
                            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[11px] font-bold cursor-pointer"
                            title="อนุมัติให้ใช้งานทันที"
                          >
                            อนุมัติ
                          </button>
                        )}
                        <button
                          onClick={() => openEditModal(u)}
                          className="px-2.5 py-1 text-slate-700 hover:bg-slate-100 border border-slate-200 rounded text-[11px] font-medium flex items-center gap-1 cursor-pointer transition"
                        >
                          <Edit2 className="w-3 h-3" />
                          แก้ไขสิทธิ์
                        </button>
                        <button
                          onClick={() => setUserToDelete(u)}
                          disabled={u.uid === currentUser?.uid}
                          className={`px-2 py-1 rounded text-[11px] font-medium flex items-center gap-1 transition ${
                            u.uid === currentUser?.uid
                              ? 'text-slate-300 cursor-not-allowed border border-slate-200 bg-slate-50'
                              : 'text-rose-600 hover:text-white hover:bg-rose-600 border border-rose-200 hover:border-rose-600 cursor-pointer'
                          }`}
                          title={u.uid === currentUser?.uid ? 'ไม่สามารถลบบัญชีของตนเองที่กำลังเข้าสู่ระบบอยู่ได้' : `ลบผู้ใช้งาน ${u.email}`}
                        >
                          <Trash2 className="w-3 h-3" />
                          ลบ
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit User Modal */}
      {selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-5 py-3.5 bg-[#12304A] text-white flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold">กำหนดสิทธิ์ผู้ใช้งาน</h3>
                <p className="text-[11px] text-teal-200 font-mono">{selectedUser.email}</p>
              </div>
              <button
                onClick={() => setSelectedUser(null)}
                className="p-1 rounded text-slate-300 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveUser} className="p-5 space-y-4 text-xs overflow-y-auto">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    บทบาท (Role)
                  </label>
                  <select
                    value={editRole}
                    onChange={(e) => setEditRole(e.target.value as any)}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="user">User (ผู้ใช้งานทั่วไป)</option>
                    <option value="admin">Master Admin (ผู้ดูแลระบบ)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    สถานะการใช้งาน
                  </label>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value as any)}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="active">Active (เปิดใช้งาน)</option>
                    <option value="pending">Pending (รออนุมัติ)</option>
                    <option value="suspended">Suspended (ระงับสิทธิ์)</option>
                  </select>
                </div>
              </div>

              {/* Project assignments */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  กำหนดโครงการที่ User เข้าถึงได้ ({editProjects.length} โครงการ)
                </label>
                <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-lg p-2 space-y-1.5 bg-slate-50">
                  {projects.map((p) => {
                    const isChecked = editProjects.includes(p.projectId);
                    return (
                      <label
                        key={p.projectId}
                        className="flex items-center gap-2 p-1.5 rounded hover:bg-slate-100 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggleProject(p.projectId)}
                          className="rounded text-teal-600 focus:ring-teal-500"
                        />
                        <span className="font-mono font-bold text-teal-800">{p.projectCode}</span>
                        <span className="text-slate-800 truncate">{p.clientName}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-between gap-2">
                {selectedUser.uid !== currentUser?.uid ? (
                  <button
                    type="button"
                    onClick={() => {
                      const target = selectedUser;
                      setSelectedUser(null);
                      setUserToDelete(target);
                    }}
                    className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold flex items-center gap-1 cursor-pointer transition border border-rose-200"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                    ลบผู้ใช้นี้
                  </button>
                ) : (
                  <div />
                )}

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedUser(null)}
                    className="px-4 py-1.5 rounded-lg text-slate-600 hover:bg-slate-100 font-medium cursor-pointer"
                  >
                    ยกเลิก
                  </button>
                  <button
                    type="submit"
                    disabled={isUpdating}
                    className="px-5 py-1.5 bg-[#0D9488] hover:bg-teal-700 text-white rounded-lg font-bold shadow-xs cursor-pointer"
                  >
                    บันทึกสิทธิ์
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete User Confirmation Modal */}
      {userToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md border border-slate-200 overflow-hidden">
            <div className="p-5 text-center">
              <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto mb-3">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-slate-900">
                ยืนยันการลบผู้ใช้งาน
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                คุณกำลังจะลบบัญชีผู้ใช้งานนี้ออกจากระบบอย่างถาวร
              </p>

              <div className="mt-4 p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-left space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500">ชื่อผู้ใช้งาน:</span>
                  <span className="font-bold text-slate-800">{userToDelete.displayName || 'User'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">อีเมล Google:</span>
                  <span className="font-mono font-bold text-slate-900">{userToDelete.email}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">บทบาท:</span>
                  <span className="font-semibold text-teal-800">
                    {userToDelete.role === 'admin' ? 'Master Admin' : 'User (พนักงานคีย์ข้อมูล)'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">สถานะ:</span>
                  <span className="font-semibold text-slate-700">{userToDelete.status}</span>
                </div>
              </div>

              <div className="mt-3 p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-left text-[11px] text-rose-800 leading-relaxed">
                ⚠️ <strong>คำเตือน:</strong> เมื่อลบแล้ว ผู้ใช้นี้จะไม่สามารถล็อกอินเข้าใช้งาน หรือเข้าถึงโครงการและใบเสร็จใดๆ ในระบบได้อีกต่อไป หากต้องการให้กลับมาใช้งาน จะต้องให้ Master Admin กดเพิ่มผู้ใช้งานใหม่อีกครั้ง
              </div>

              <div className="mt-5 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={() => setUserToDelete(null)}
                  className="px-4 py-2 rounded-lg text-slate-700 hover:bg-slate-100 font-medium text-xs cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={handleDeleteUser}
                  className="flex items-center gap-1.5 px-5 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-75 text-white rounded-lg font-bold text-xs shadow-sm cursor-pointer transition"
                >
                  {isDeleting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      กำลังลบ...
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-3.5 h-3.5" />
                      ยืนยันลบผู้ใช้งาน
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add User Modal */}
      <AddUserModal
        isOpen={isAddUserOpen}
        initialRole={initialAddRole}
        onClose={() => setIsAddUserOpen(false)}
      />
    </div>
  );
};
