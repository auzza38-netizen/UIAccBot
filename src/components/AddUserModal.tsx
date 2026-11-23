import React, { useState } from 'react';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';
import { UserRole, UserStatus } from '../types';
import {
  UserPlus,
  ShieldCheck,
  Briefcase,
  X,
  Check,
  Mail,
  User,
  CheckSquare,
  Square,
  Info,
  Phone,
  Loader2,
  AlertCircle,
} from 'lucide-react';

interface AddUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  initialRole?: UserRole;
}

export const AddUserModal: React.FC<AddUserModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  initialRole = 'user',
}) => {
  const { projects, users, addUser } = useData();
  const { currentUser } = useAuth();

  const [displayName, setDisplayName] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [position, setPosition] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  const [role, setRole] = useState<UserRole>(initialRole);
  const [status, setStatus] = useState<UserStatus>('active');
  const [assignedProjectIds, setAssignedProjectIds] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  React.useEffect(() => {
    if (isOpen) {
      setRole(initialRole);
      setStatus('active');
      setDisplayName('');
      setEmail('');
      setPosition('');
      setPhone('');
      setAssignedProjectIds([]);
      setFormError(null);
      setSuccessMessage(null);
    }
  }, [isOpen, initialRole]);

  const currentAdmins = users.filter((u) => u.role === 'admin');

  if (!isOpen) return null;

  const handleToggleProject = (projectId: string) => {
    if (assignedProjectIds.includes(projectId)) {
      setAssignedProjectIds(assignedProjectIds.filter((id) => id !== projectId));
    } else {
      setAssignedProjectIds([...assignedProjectIds, projectId]);
    }
  };

  const handleSelectAllProjects = () => {
    if (assignedProjectIds.length === projects.length) {
      setAssignedProjectIds([]);
    } else {
      setAssignedProjectIds(projects.map((p) => p.projectId));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    setFormError(null);

    if (!cleanEmail || !cleanEmail.includes('@')) {
      setFormError('กรุณากรอกอีเมลที่ถูกต้องสำหรับบัญชี Google');
      return;
    }

    if (!currentUser) {
      setFormError('ไม่พบเซสชันผู้ใช้งาน กรุณาเข้าสู่ระบบใหม่อีกครั้ง');
      return;
    }

    setIsSubmitting(true);
    try {
      await addUser({
        displayName: displayName.trim() || cleanEmail.split('@')[0],
        email: cleanEmail,
        position: position.trim(),
        phone: phone.trim(),
        role,
        status,
        assignedProjectIds: role === 'admin' ? projects.map((p) => p.projectId) : assignedProjectIds,
      });

      setSuccessMessage(
        role === 'admin'
          ? `เพิ่ม Master Admin (${cleanEmail}) เรียบร้อยแล้ว สามารถล็อกอินด้วย Google เพื่อร่วมบริหารระบบได้ทันที`
          : `เพิ่มพนักงาน (${cleanEmail}) เรียบร้อยแล้ว พนักงานสามารถล็อกอินด้วย Google เพื่อเริ่มคีย์ข้อมูลใบเสร็จได้ทันที`
      );

      setTimeout(() => {
        setSuccessMessage(null);
        setDisplayName('');
        setEmail('');
        setPosition('');
        setPhone('');
        setRole('user');
        setStatus('active');
        setAssignedProjectIds([]);
        if (onSuccess) onSuccess();
        onClose();
      }, 1500);
    } catch (err: any) {
      console.error('Error adding user:', err);
      setFormError('เกิดข้อผิดพลาดในการเพิ่มผู้ใช้งาน: ' + (err?.message || 'ไม่สามารถบันทึกได้'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/50 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-700 flex items-center justify-center shrink-0">
              <UserPlus className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-display text-sm font-bold text-slate-900 leading-tight">
                เพิ่มผู้ใช้งาน &amp; กำหนดสิทธิ์พนักงาน
              </h2>
              <p className="text-[11px] text-slate-500 mt-0.5">
                เพิ่มบัญชีสำหรับพนักงานคีย์ข้อมูล หรือแต่งตั้ง Master Admin ร่วม
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Success Alert */}
        {successMessage ? (
          <div className="p-8 text-center space-y-3">
            <div className="w-12 h-12 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center mx-auto">
              <Check className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-900">สำเร็จ!</h3>
            <p className="text-xs text-slate-600 max-w-sm mx-auto leading-relaxed">
              {successMessage}
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
            
            {formError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl flex items-start gap-2 text-xs">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span className="font-medium">{formError}</span>
              </div>
            )}

            {/* Guide Info Box */}
            <div className="p-3 bg-teal-50/70 border border-teal-200/80 rounded-xl text-teal-900 flex items-start gap-2.5 text-[11px] leading-relaxed">
              <Info className="w-4 h-4 text-teal-700 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">การล็อกอินของพนักงาน: </span>
                <span>
                  กรอกอีเมล Google ของพนักงานและเลือกสถานะ <strong>Active</strong> เมื่อพนักงานกด "เข้าสู่ระบบด้วย Google" ในหน้าแรก ระบบจะเชื่อมต่อสิทธิ์โครงการและเริ่มคีย์ข้อมูลได้ทันที
                </span>
              </div>
            </div>

            {/* Display Name */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                ชื่อ-นามสกุล หรือ ชื่อพนักงาน <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  required
                  placeholder="เช่น สมชาย ใจดี, เจ้าหน้าที่บัญชี 1"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-teal-600 focus:outline-none"
                />
              </div>
            </div>

            {/* Email */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                อีเมล Google สำหรับเข้าสู่ระบบ <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="email"
                  required
                  placeholder="เช่น employee@gmail.com หรือ staff@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-slate-900 font-mono focus:ring-2 focus:ring-teal-600 focus:outline-none"
                />
              </div>
              <p className="text-[10px] text-slate-400 mt-1">
                * ต้องเป็นอีเมลที่ใช้ล็อกอินกับ Google (Google Account / Workspace)
              </p>
            </div>

            {/* Position & Phone Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  ตำแหน่ง / แผนก
                </label>
                <div className="relative">
                  <Briefcase className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder="เช่น ฝ่ายบัญชี, จัดซื้อ"
                    value={position}
                    onChange={(e) => setPosition(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-teal-600 focus:outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  เบอร์โทรศัพท์ติดต่อ
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="tel"
                    placeholder="เช่น 081-234-5678"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-slate-900 font-mono focus:ring-2 focus:ring-teal-600 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Role & Status Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Role */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  บทบาท (Role)
                </label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as UserRole)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 bg-white focus:ring-2 focus:ring-teal-600 focus:outline-none"
                >
                  <option value="user">User (พนักงานคีย์ข้อมูลใบเสร็จ)</option>
                  <option value="admin">Master Admin (ผู้ดูแลระบบคนที่ 2 / ร่วมบริหาร)</option>
                </select>
              </div>

              {/* Status */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  สถานะการใช้งาน
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as UserStatus)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 bg-white focus:ring-2 focus:ring-teal-600 focus:outline-none"
                >
                  <option value="active">Active (เปิดใช้งานทันที - แนะนำ)</option>
                  <option value="pending">Pending (รออนุมัติภายหลัง)</option>
                  <option value="suspended">Suspended (ระงับสิทธิ์)</option>
                </select>
              </div>
            </div>

            {/* Role Explanation */}
            {role === 'admin' ? (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-[11px] text-blue-900 flex items-start gap-2">
                <ShieldCheck className="w-4 h-4 text-blue-700 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">สิทธิ์ Master Admin คนที่ 2: </span>
                  <span>
                    ผู้ใช้นี้จะสามารถดูทุกโครงการ, อนุมัติใบเสร็จ, จัดการงบประมาณ, จัดการผู้ใช้งาน และส่งออกรายงานได้เช่นเดียวกับคุณ
                  </span>
                </div>
              </div>
            ) : (
              /* Project Assignment (Only needed for normal User) */
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[11px] font-bold text-slate-700">
                    กำหนดโครงการที่ให้พนักงานเข้าถึง ({assignedProjectIds.length}/{projects.length} โครงการ)
                  </label>
                  {projects.length > 0 && (
                    <button
                      type="button"
                      onClick={handleSelectAllProjects}
                      className="text-[11px] text-teal-700 hover:underline font-semibold cursor-pointer"
                    >
                      {assignedProjectIds.length === projects.length ? 'ยกเลิกทั้งหมด' : 'เลือกทุกโครงการ'}
                    </button>
                  )}
                </div>

                <div className="max-h-40 overflow-y-auto border border-slate-200 rounded-xl p-2.5 space-y-1.5 bg-slate-50">
                  {projects.length > 0 ? (
                    projects.map((p) => {
                      const isChecked = assignedProjectIds.includes(p.projectId);
                      return (
                        <label
                          key={p.projectId}
                          className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-slate-100 cursor-pointer transition"
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => handleToggleProject(p.projectId)}
                            className="rounded text-teal-600 focus:ring-teal-500 w-3.5 h-3.5"
                          />
                          <span className="font-mono font-bold text-teal-800 text-[11px]">
                            {p.projectCode}
                          </span>
                          <span className="text-slate-800 truncate font-medium text-xs">
                            {p.clientName}
                          </span>
                        </label>
                      );
                    })
                  ) : (
                    <p className="text-slate-400 text-center py-3 text-xs">
                      ยังไม่มีโครงการในระบบ (สามารถมอบหมายภายหลังได้)
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Modal Footer */}
            <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-2 shrink-0">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-lg text-slate-600 hover:bg-slate-100 font-medium cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex items-center gap-1.5 px-5 py-2 bg-[#0D9488] hover:bg-teal-700 disabled:opacity-50 text-white rounded-lg font-bold shadow-xs cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>กำลังบันทึก...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>{role === 'admin' ? 'เพิ่ม Master Admin' : 'เพิ่มพนักงาน'}</span>
                  </>
                )}
              </button>
            </div>

          </form>
        )}

      </div>
    </div>
  );
};
