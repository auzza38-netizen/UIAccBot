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
  Edit2,
  X,
  Check,
  Trash2,
  AlertTriangle,
  Loader2,
  Mail,
  User,
  Briefcase,
  Phone,
} from 'lucide-react';
import { AddUserModal } from './AddUserModal';

export const UserManagementPage: React.FC = () => {
  const { users, projects, updateUser, updateUserRoleAndStatus, deleteUser } = useData();
  const { isAdmin, currentUser } = useAuth();

  // Add user modal
  const [isAddUserOpen, setIsAddUserOpen] = useState<boolean>(false);
  const [initialAddRole, setInitialAddRole] = useState<UserRole>('user');

  // Edit user modal
  const [selectedUser, setSelectedUser] = useState<AppUser | null>(null);
  const [editDisplayName, setEditDisplayName] = useState<string>('');
  const [editEmail, setEditEmail] = useState<string>('');
  const [editPosition, setEditPosition] = useState<string>('');
  const [editPhone, setEditPhone] = useState<string>('');
  const [editRole, setEditRole] = useState<UserRole>('user');
  const [editStatus, setEditStatus] = useState<UserStatus>('active');
  const [editProjects, setEditProjects] = useState<string[]>([]);
  const [editError, setEditError] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState<boolean>(false);

  // Delete user state & feedback
  const [userToDelete, setUserToDelete] = useState<AppUser | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [approvingUid, setApprovingUid] = useState<string | null>(null);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

  const openEditModal = (u: AppUser) => {
    setSelectedUser(u);
    setEditDisplayName(u.displayName || '');
    setEditEmail(u.email || '');
    setEditPosition(u.position || '');
    setEditPhone(u.phone || '');
    setEditRole(u.role);
    setEditStatus(u.status);
    setEditProjects(u.assignedProjectIds || []);
    setEditError(null);
  };

  const handleToggleProject = (projectId: string) => {
    if (editProjects.includes(projectId)) {
      setEditProjects(editProjects.filter((p) => p !== projectId));
    } else {
      setEditProjects([...editProjects, projectId]);
    }
  };

  const handleSelectAllProjects = () => {
    if (editProjects.length === projects.length) {
      setEditProjects([]);
    } else {
      setEditProjects(projects.map((p) => p.projectId));
    }
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;

    const cleanName = editDisplayName.trim();
    const cleanEmail = editEmail.trim().toLowerCase();

    if (!cleanName) {
      setEditError('กรุณากรอกชื่อ-นามสกุล หรือชื่อผู้ใช้งาน');
      return;
    }
    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setEditError('กรุณากรอกรูปแบบอีเมลให้ถูกต้อง (เช่น name@company.com)');
      return;
    }

    setEditError(null);
    setIsUpdating(true);
    try {
      await updateUser(selectedUser.uid, {
        displayName: cleanName,
        email: cleanEmail,
        position: editPosition.trim(),
        phone: editPhone.trim(),
        role: editRole,
        status: editStatus,
        assignedProjectIds:
          editRole === 'admin' ? projects.map((p) => p.projectId) : editProjects,
      });
      setSelectedUser(null);
      setActionFeedback(`บันทึกข้อมูลและสิทธิ์ของ "${cleanName}" (${cleanEmail}) เรียบร้อยแล้ว`);
      setTimeout(() => setActionFeedback(null), 4500);
    } catch (err: any) {
      setEditError(err?.message || 'บันทึกข้อมูลผู้ใช้งานไม่สำเร็จ');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleQuickApprove = async (u: AppUser) => {
    setApprovingUid(u.uid);
    try {
      await updateUserRoleAndStatus(
        u.uid,
        u.role,
        'active',
        u.assignedProjectIds && u.assignedProjectIds.length > 0
          ? u.assignedProjectIds
          : projects.slice(0, 3).map((p) => p.projectId)
      );
      setActionFeedback(`อนุมัติการใช้งานบัญชี "${u.displayName || u.email}" เรียบร้อยแล้ว`);
      setTimeout(() => setActionFeedback(null), 4000);
    } catch (err: any) {
      setActionFeedback(`อนุมัติไม่สำเร็จ: ${err?.message || 'เกิดข้อผิดพลาด'}`);
    } finally {
      setApprovingUid(null);
    }
  };

  const handleDeleteUser = async () => {
    if (!userToDelete) return;
    if (userToDelete.uid === currentUser?.uid) {
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
      setActionFeedback(`ลบผู้ใช้งานไม่สำเร็จ: ${err?.message || 'เกิดข้อผิดพลาด'}`);
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
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl flex items-center justify-between text-xs animate-in fade-in">
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
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            ผู้ใช้งานและกำหนดสิทธิ์โครงการ
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            เพิ่มพนักงาน แต่งตั้ง Master Admin ร่วม แก้ไขข้อมูลชื่อ-อีเมล และกำหนดสิทธิ์การเข้าถึงโครงการ
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => {
              setInitialAddRole('admin');
              setIsAddUserOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-800 rounded-lg text-xs font-semibold cursor-pointer shrink-0 transition-colors"
            title="แต่งตั้ง Master Admin ร่วม (สิทธิ์เทียบเท่า)"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-teal-700" />
            <span>+ แต่งตั้ง Master Admin</span>
          </button>

          <button
            onClick={() => {
              setInitialAddRole('user');
              setIsAddUserOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#0F766E] hover:bg-[#0D645D] text-white rounded-lg text-xs font-semibold cursor-pointer shrink-0 transition-colors"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>+ เพิ่มพนักงาน</span>
          </button>
        </div>
      </div>

      {/* Role Summary Strip */}
      <div className="bg-white border border-slate-200/80 rounded-xl grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-slate-200/80">
        <div className="p-4 sm:p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500 font-medium">Master Admin</span>
            <span className="text-[11px] font-medium text-teal-700">ผู้ดูแลระบบ</span>
          </div>
          <p className="text-xl font-bold text-slate-900 mt-1.5 font-mono tabular-nums">
            {adminUsers.length} <span className="text-xs font-sans font-normal text-slate-500">คน</span>
          </p>
          <p className="text-[11px] text-slate-400 mt-1 truncate font-mono">
            {adminUsers.map((a) => a.email).join(', ') || 'ไม่มีข้อมูล'}
          </p>
        </div>

        <div className="p-4 sm:p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500 font-medium">พนักงานคีย์ข้อมูล</span>
            <span className="text-[11px] font-medium text-emerald-700">ใช้งานได้</span>
          </div>
          <p className="text-xl font-bold text-slate-900 mt-1.5 font-mono tabular-nums">
            {regularUsers.filter((u) => u.status === 'active').length}{' '}
            <span className="text-xs font-sans font-normal text-slate-500">คน</span>
          </p>
          <p className="text-[11px] text-slate-400 mt-1">
            พนักงานที่ได้รับสิทธิ์คีย์ข้อมูลและดูโครงการ
          </p>
        </div>

        <div className="p-4 sm:p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500 font-medium">รออนุมัติสิทธิ์</span>
            <span className="text-[11px] font-mono font-semibold text-amber-700 tabular-nums">
              {pendingUsers.length} รายการ
            </span>
          </div>
          <p className="text-xl font-bold text-slate-900 mt-1.5 font-mono tabular-nums">
            {pendingUsers.length} <span className="text-xs font-sans font-normal text-slate-500">คน</span>
          </p>
          <p className="text-[11px] text-slate-400 mt-1">
            {pendingUsers.length > 0 ? 'คลิก "อนุมัติ" เพื่อเปิดการใช้งาน' : 'ไม่มีผู้ใช้รออนุมัติ'}
          </p>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white border border-slate-200/80 rounded-xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200/80 flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-display text-sm font-bold text-slate-900">
            รายชื่อผู้ใช้งานทั้งหมด ({users.length} คน)
          </h3>
          <span className="text-[11px] text-slate-500">
            คลิก "แก้ไขข้อมูล" เพื่อปรับชื่อ อีเมล บทบาท หรือสิทธิ์โครงการ
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/80 text-slate-500 font-semibold border-b border-slate-200 text-[11px]">
              <tr>
                <th className="py-3 px-4">ผู้ใช้งาน</th>
                <th className="py-3 px-4">อีเมล</th>
                <th className="py-3 px-4 text-center">บทบาท</th>
                <th className="py-3 px-4 text-center">สถานะ</th>
                <th className="py-3 px-4">โครงการที่ได้รับสิทธิ์</th>
                <th className="py-3 px-4">เข้าสู่ระบบล่าสุด</th>
                <th className="py-3 px-4 text-center">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((u) => {
                const assignedCount = u.assignedProjectIds?.length || 0;
                const isSelf = u.uid === currentUser?.uid;
                return (
                  <tr key={u.uid} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                        <span>{u.displayName || 'User'}</span>
                        {isSelf && (
                          <span className="text-[10px] font-medium text-teal-700">
                            (บัญชีปัจจุบัน)
                          </span>
                        )}
                      </div>
                      {(u.position || u.phone) && (
                        <div className="text-[11px] text-slate-500 mt-0.5 flex flex-wrap items-center gap-2">
                          {u.position && <span>{u.position}</span>}
                          {u.position && u.phone && <span className="text-slate-300">·</span>}
                          {u.phone && <span className="font-mono tabular-nums">{u.phone}</span>}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-600">{u.email}</td>
                    <td className="py-3 px-4 text-center">
                      <span
                        className={`text-[11px] font-semibold ${
                          u.role === 'admin' ? 'text-teal-700' : 'text-slate-600'
                        }`}
                      >
                        {u.role === 'admin' ? 'Master Admin' : 'User'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span
                        className={`text-[11px] font-semibold ${
                          u.status === 'active'
                            ? 'text-emerald-700'
                            : u.status === 'pending'
                            ? 'text-amber-700'
                            : 'text-rose-700'
                        }`}
                      >
                        {u.status === 'active'
                          ? 'ใช้งานได้'
                          : u.status === 'pending'
                          ? 'รออนุมัติ'
                          : 'ระงับสิทธิ์'}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      {u.role === 'admin' ? (
                        <span className="text-teal-700 font-medium">เข้าถึงได้ทุกโครงการ</span>
                      ) : (
                        <span className="text-slate-700 tabular-nums">
                          {assignedCount > 0 ? `${assignedCount} โครงการ` : 'ยังไม่มีโครงการ'}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-slate-500 font-mono text-[11px] tabular-nums">
                      {u.lastLoginAt ? formatThaiDateTime(u.lastLoginAt) : 'ยังไม่เคยเข้าใช้งาน'}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        {u.status === 'pending' && (
                          <button
                            onClick={() => handleQuickApprove(u)}
                            disabled={approvingUid === u.uid}
                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white rounded-md text-[11px] font-semibold cursor-pointer transition-colors"
                            title="อนุมัติให้ใช้งานทันที"
                          >
                            {approvingUid === u.uid && (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            )}
                            <span>{approvingUid === u.uid ? 'กำลังอนุมัติ...' : 'อนุมัติ'}</span>
                          </button>
                        )}
                        <button
                          onClick={() => openEditModal(u)}
                          className="px-2.5 py-1 text-slate-700 hover:bg-slate-100 border border-slate-200 rounded-md text-[11px] font-medium inline-flex items-center gap-1 cursor-pointer transition-colors"
                        >
                          <Edit2 className="w-3 h-3 text-teal-700" />
                          แก้ไขข้อมูล
                        </button>
                        <button
                          onClick={() => setUserToDelete(u)}
                          disabled={isSelf}
                          className={`px-2 py-1 rounded-md text-[11px] font-medium inline-flex items-center gap-1 transition-colors ${
                            isSelf
                              ? 'text-slate-300 cursor-not-allowed border border-slate-200 bg-slate-50'
                              : 'text-rose-600 hover:text-white hover:bg-rose-600 border border-rose-200 hover:border-rose-600 cursor-pointer'
                          }`}
                          title={
                            isSelf
                              ? 'ไม่สามารถลบบัญชีของตนเองที่กำลังเข้าสู่ระบบอยู่ได้'
                              : `ลบผู้ใช้งาน ${u.email}`
                          }
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

      {/* Edit User Modal (Profile Details + Role & Project Permissions) */}
      {selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between shrink-0">
              <div>
                <h3 className="font-display text-sm font-bold text-slate-900">
                  แก้ไขรายละเอียดและสิทธิ์ผู้ใช้งาน
                </h3>
                <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                  {selectedUser.displayName} · {selectedUser.email}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedUser(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveUser} className="p-5 space-y-4 text-xs overflow-y-auto">
              {/* Inline Validation Error */}
              {editError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl flex items-start gap-2 text-xs">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span className="font-medium">{editError}</span>
                </div>
              )}

              {/* Profile Details Section */}
              <div className="space-y-3 pb-3.5 border-b border-slate-200/80">
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  ข้อมูลบัญชีผู้ใช้งาน
                </p>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    ชื่อ-นามสกุล หรือชื่อที่แสดงผล <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <User className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      required
                      value={editDisplayName}
                      onChange={(e) => setEditDisplayName(e.target.value)}
                      placeholder="เช่น สมชาย ใจดี (ฝ่ายจัดซื้อ)"
                      className="w-full pl-8 pr-3 py-2 border border-slate-300 rounded-lg bg-white text-slate-900 focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    อีเมลผู้ใช้งาน (Email) <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <Mail className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="email"
                      required
                      value={editEmail}
                      onChange={(e) => setEditEmail(e.target.value)}
                      placeholder="name@company.com"
                      className="w-full pl-8 pr-3 py-2 border border-slate-300 rounded-lg bg-white text-slate-900 font-mono focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      ตำแหน่ง / แผนก
                    </label>
                    <div className="relative">
                      <Briefcase className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                      <input
                        type="text"
                        value={editPosition}
                        onChange={(e) => setEditPosition(e.target.value)}
                        placeholder="เช่น เจ้าหน้าที่บัญชี"
                        className="w-full pl-8 pr-3 py-2 border border-slate-300 rounded-lg bg-white text-slate-900 focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      เบอร์โทรศัพท์ติดต่อ
                    </label>
                    <div className="relative">
                      <Phone className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                      <input
                        type="tel"
                        value={editPhone}
                        onChange={(e) => setEditPhone(e.target.value)}
                        placeholder="เช่น 081-234-5678"
                        className="w-full pl-8 pr-3 py-2 border border-slate-300 rounded-lg bg-white text-slate-900 font-mono focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Role & Status Section */}
              <div className="space-y-3">
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  บทบาทและสิทธิ์การเข้าถึง
                </p>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      บทบาท (Role)
                    </label>
                    <select
                      value={editRole}
                      onChange={(e) => setEditRole(e.target.value as UserRole)}
                      className="w-full px-2.5 py-2 border border-slate-300 rounded-lg bg-white text-slate-900 focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 focus:outline-none"
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
                      onChange={(e) => setEditStatus(e.target.value as UserStatus)}
                      className="w-full px-2.5 py-2 border border-slate-300 rounded-lg bg-white text-slate-900 focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 focus:outline-none"
                    >
                      <option value="active">Active (เปิดใช้งาน)</option>
                      <option value="pending">Pending (รออนุมัติ)</option>
                      <option value="suspended">Suspended (ระงับสิทธิ์)</option>
                    </select>
                  </div>
                </div>

                {/* Project assignments */}
                {editRole === 'admin' ? (
                  <div className="p-3 bg-teal-50/70 border border-teal-200/80 rounded-xl text-[11px] text-teal-900 flex items-start gap-2">
                    <ShieldCheck className="w-4 h-4 text-teal-700 shrink-0 mt-0.5" />
                    <span>
                      บัญชีระดับ <strong>Master Admin</strong> สามารถเข้าถึงและจัดการข้อมูลได้ครบทุกโครงการในระบบโดยอัตโนมัติ
                    </span>
                  </div>
                ) : (
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-[11px] font-semibold text-slate-700">
                        กำหนดโครงการที่เข้าถึงได้ ({editProjects.length}/{projects.length} โครงการ)
                      </label>
                      {projects.length > 0 && (
                        <button
                          type="button"
                          onClick={handleSelectAllProjects}
                          className="text-[11px] text-teal-700 hover:underline font-semibold cursor-pointer"
                        >
                          {editProjects.length === projects.length
                            ? 'ยกเลิกทั้งหมด'
                            : 'เลือกทุกโครงการ'}
                        </button>
                      )}
                    </div>
                    <div className="max-h-40 overflow-y-auto border border-slate-200 rounded-lg p-2 space-y-1 bg-slate-50">
                      {projects.map((p) => {
                        const isChecked = editProjects.includes(p.projectId);
                        return (
                          <label
                            key={p.projectId}
                            className="flex items-center gap-2 p-1.5 rounded-md hover:bg-white cursor-pointer transition"
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
                )}
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
                    className="px-4 py-2 rounded-lg text-slate-600 hover:bg-slate-100 font-medium cursor-pointer"
                  >
                    ยกเลิก
                  </button>
                  <button
                    type="submit"
                    disabled={isUpdating}
                    className="inline-flex items-center gap-1.5 px-5 py-2 bg-[#0F766E] hover:bg-teal-800 disabled:opacity-60 text-white rounded-lg font-semibold shadow-xs cursor-pointer transition"
                  >
                    {isUpdating ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        กำลังบันทึก...
                      </>
                    ) : (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        บันทึกการเปลี่ยนแปลง
                      </>
                    )}
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
              <h3 className="text-base font-bold text-slate-900">ยืนยันการลบผู้ใช้งาน</h3>
              <p className="text-xs text-slate-500 mt-1">
                คุณกำลังจะลบบัญชีผู้ใช้งานนี้ออกจากระบบอย่างถาวร
              </p>

              <div className="mt-4 p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-left space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500">ชื่อผู้ใช้งาน:</span>
                  <span className="font-bold text-slate-800">
                    {userToDelete.displayName || 'User'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">อีเมล:</span>
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
                <strong>คำเตือน:</strong> เมื่อลบแล้ว ผู้ใช้นี้จะไม่สามารถเข้าใช้งาน
                หรือเข้าถึงโครงการและใบเสร็จใดๆ ในระบบได้อีกต่อไป หากต้องการให้กลับมาใช้งาน
                จะต้องให้ Master Admin กดเพิ่มผู้ใช้งานใหม่อีกครั้ง
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

