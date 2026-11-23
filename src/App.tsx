import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { DataProvider, useData } from './context/DataContext';
import { Navbar } from './components/Navbar';
import { Sidebar } from './components/Sidebar';
import { FilterBar } from './components/FilterBar';
import { KPIStats } from './components/KPIStats';
import { ChartsSection } from './components/ChartsSection';
import { ReceiptsTable } from './components/ReceiptsTable';
import { ProjectsPage } from './components/ProjectsPage';
import { ReportsPage } from './components/ReportsPage';
import { UserManagementPage } from './components/UserManagementPage';
import { CategoriesPage } from './components/CategoriesPage';
import { SettingsPage } from './components/SettingsPage';
import { CurrentAssetsPage } from './components/CurrentAssetsPage';
import { CurrentAssetsSummaryWidget } from './components/CurrentAssetsSummaryWidget';
import { ReceiptUploadModal } from './components/ReceiptUploadModal';
import { ReceiptDetailModal } from './components/ReceiptDetailModal';
import { AddUserModal } from './components/AddUserModal';
import { filterReceipts } from './utils/filterHelper';
import { Receipt } from './types';
import {
  ShieldAlert,
  ShieldCheck,
  Users,
  LogIn,
  ReceiptText,
  Sparkles,
  FolderKanban,
  CheckCircle2,
  Clock,
  PlusCircle,
  HelpCircle,
  UserPlus,
  X,
  Info,
  AlertTriangle,
  Copy,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import {
  MASTER_ADMIN_EMAIL,
  MASTER_ADMIN_EMAILS,
} from './services/dbService';

function MainLayout() {
  const {
    currentUser,
    isAdmin,
    isApproved,
    signInWithGoogle,
    signInWithGoogleRedirect,
    loading,
    isSigningIn,
    authError,
    clearAuthError,
  } = useAuth();
  const {
    projects,
    receipts,
    categories,
    users,
    filters,
    setFilters,
    saveProject,
  } = useData();

  // Navigation & Modals
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);
  const [isUploadOpen, setIsUploadOpen] = useState<boolean>(false);
  const [isAddUserOpen, setIsAddUserOpen] = useState<boolean>(false);
  const [addUserRole, setAddUserRole] = useState<'user' | 'admin'>('user');
  const [isAuthHelpOpen, setIsAuthHelpOpen] = useState<boolean>(false);
  const [copiedDomain, setCopiedDomain] = useState<boolean>(false);
  const [selectedReceipt, setSelectedReceipt] = useState<Receipt | null>(null);
  const [isReceiptModalInEditMode, setIsReceiptModalInEditMode] = useState<boolean>(false);
  const [targetAssetAccountId, setTargetAssetAccountId] = useState<string | undefined>(undefined);

  const handleNavigateToAssets = (accountId?: string) => {
    setTargetAssetAccountId(accountId);
    setActiveTab('assets');
  };

  const handleCopyDomain = () => {
    const host = typeof window !== 'undefined' ? window.location.hostname : '';
    if (host) {
      navigator.clipboard.writeText(host);
      setCopiedDomain(true);
      setTimeout(() => setCopiedDomain(false), 2500);
    }
  };

  // Filtered receipts according to active filters
  const scopedReceipts = filterReceipts(receipts, filters);

  const pendingReviewCount = receipts.filter(
    (r) => r.approvalStatus === 'pending' || r.verificationStatus === 'needs_review'
  ).length;

  const adminUsersCount = users.filter((u) => u.role === 'admin').length;
  const staffUsersCount = users.filter((u) => u.role !== 'admin' && u.status === 'active').length;

  // Initialize sample projects if empty and user is Master Admin
  const handleSeedSampleProjects = async () => {
    if (!isAdmin) return;
    try {
      await saveProject({
        projectCode: 'PRJ-101',
        clientName: 'ฝ่ายเทคโนโลยีสารสนเทศ สำนักงานใหญ่',
        budget: 500000,
        assignedUsers: [MASTER_ADMIN_EMAIL],
        status: 'active',
        notes: 'โครงการทดสอบระบบเริ่มต้นสำหรับทดสอบการบันทึกใบเสร็จ',
      });
      await saveProject({
        projectCode: 'PRJ-102',
        clientName: 'ฝ่ายบริหารทั่วไปและยานพาหนะ',
        budget: 250000,
        assignedUsers: [MASTER_ADMIN_EMAIL],
        status: 'active',
        notes: 'โครงการรองรับการเบิกจ่ายค่าน้ำมัน ค่าวัสดุ และค่าที่พัก',
      });
      alert('สร้างโครงการตัวอย่างเรียบร้อยแล้ว');
    } catch (e: any) {
      alert('เกิดข้อผิดพลาด: ' + e.message);
    }
  };

  // Loading skeleton
  if (loading) {
    return (
      <div className="min-h-screen bg-[#F6F8FB] flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-3 border-teal-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-xs font-semibold text-slate-600">กำลังตรวจสอบระบบความปลอดภัย...</p>
        </div>
      </div>
    );
  }

  // Not logged in: Clean Corporate Landing
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-[#F6F8FB] flex flex-col justify-between">
        <header className="bg-[#12304A] text-white py-4 px-6 border-b border-[#1b4366]">
          <div className="max-w-6xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#0D9488] flex items-center justify-center text-white font-bold">
                <ReceiptText className="w-4 h-4" />
              </div>
              <span className="font-bold text-sm tracking-tight">Progressive Account Receipt Manager</span>
            </div>
            <div className="flex items-center gap-2.5">
              <button
                onClick={() => signInWithGoogle().catch(() => {})}
                disabled={isSigningIn}
                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-white text-[#12304A] hover:bg-slate-100 disabled:opacity-75 rounded-lg text-xs font-semibold transition cursor-pointer"
              >
                {isSigningIn ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-[#12304A]" />
                ) : (
                  <LogIn className="w-3.5 h-3.5" />
                )}
                {isSigningIn ? 'กำลังเชื่อมต่อ...' : 'เข้าสู่ระบบ'}
              </button>
            </div>
          </div>
        </header>

        <main className="max-w-4xl mx-auto px-4 py-16 text-center">
          {/* Auth Error Banner if login failed */}
          {authError && (
            <div className="mb-8 p-4 sm:p-5 bg-amber-50 border-2 border-amber-300 rounded-2xl text-left shadow-md text-slate-800 animate-fadeIn">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-amber-100 rounded-xl text-amber-700 shrink-0 mt-0.5">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                    <h3 className="font-bold text-sm text-amber-900 flex items-center gap-2">
                      {authError.title}
                      <span className="font-mono text-[10px] px-2 py-0.5 bg-amber-200/70 text-amber-900 rounded-full font-semibold">
                        {authError.code}
                      </span>
                    </h3>
                    <button
                      onClick={clearAuthError}
                      className="text-slate-400 hover:text-slate-600 p-1"
                      title="ปิดการแจ้งเตือน"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <p className="text-xs text-slate-700 mb-2 leading-relaxed">
                    {authError.detail}
                  </p>
                  <div className="p-2.5 bg-white/80 rounded-lg border border-amber-200 text-xs text-slate-700 mb-3 space-y-1">
                    <div className="font-semibold text-amber-900 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                      วิธีแก้ไข:
                    </div>
                    <p className="leading-relaxed text-[11px] text-slate-600">
                      {authError.solution}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <button
                      onClick={handleCopyDomain}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-semibold shadow-2xs transition cursor-pointer"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      {copiedDomain ? 'คัดลอกชื่อโดเมนแล้ว!' : `คัดลอกโดเมน (${typeof window !== 'undefined' ? window.location.hostname : ''})`}
                    </button>
                    <button
                      onClick={() => signInWithGoogleRedirect().catch(() => {})}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold transition cursor-pointer"
                    >
                      <RefreshCw className="w-3.5 h-3.5 text-teal-600" />
                      ลองเข้าสู่ระบบแบบ Redirect
                    </button>
                    <button
                      onClick={() => setIsAuthHelpOpen(true)}
                      className="text-xs text-amber-800 underline hover:text-amber-950 font-medium px-2 py-1"
                    >
                      ดูวิธีแก้แบบละเอียด
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-50 border border-teal-200 text-teal-800 text-xs font-semibold mb-6">
            <Sparkles className="w-3.5 h-3.5 text-teal-600" />
            AI OCR & Cloud Financial Document Management
          </div>

          <h1 className="text-3xl sm:text-4xl font-extrabold text-[#12304A] tracking-tight leading-tight mb-4">
            ระบบบริหารจัดการใบเสร็จรับเงิน <br className="hidden sm:inline" />
            และค่าใช้จ่ายโครงการด้วย AI อัจฉริยะ
          </h1>

          <p className="text-slate-600 text-sm sm:text-base max-w-2xl mx-auto mb-8 leading-relaxed">
            Progressive Account Receipt Manager ช่วยลดเวลาบันทึกเอกสารด้วย Gemini AI อ่านใบเสร็จภาษาไทย จัดหมวดหมู่อัตโนมัติ ตรวจสอบความถูกต้องทางคณิตศาสตร์ และติดตามงบประมาณโครงการแบบเรียลไทม์
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-4">
            <button
              onClick={() => signInWithGoogle().catch(() => {})}
              disabled={isSigningIn}
              className="w-full sm:w-auto min-w-[260px] flex items-center justify-center gap-2.5 px-7 py-3.5 bg-[#12304A] hover:bg-[#1b466c] active:scale-[0.98] disabled:opacity-75 text-white rounded-xl text-sm font-bold shadow-md transition cursor-pointer"
            >
              {isSigningIn ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-teal-300" />
                  กำลังเชื่อมต่อ Google...
                </>
              ) : (
                <>
                  <LogIn className="w-4 h-4 text-teal-300" />
                  เข้าสู่ระบบด้วยบัญชี Google
                </>
              )}
            </button>
          </div>

          <div className="mb-10">
            <button
              onClick={() => setIsAuthHelpOpen(true)}
              className="text-xs text-slate-500 hover:text-teal-700 inline-flex items-center gap-1.5 transition underline cursor-pointer"
            >
              <HelpCircle className="w-3.5 h-3.5 text-slate-400" />
              เข้าสู่ระบบด้วย Google ไม่ได้? ตรวจสอบสาเหตุและวิธีแก้ไข
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-left">
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
              <h3 className="font-bold text-slate-900 text-sm mb-1">AI Receipt Scanning</h3>
              <p className="text-xs text-slate-500">
                รองรับการแปลง พ.ศ./ค.ศ. แยกยอดก่อนภาษี VAT และแตกรายการสินค้าอัตโนมัติ
              </p>
            </div>
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
              <h3 className="font-bold text-slate-900 text-sm mb-1">Project & Multi-User</h3>
              <p className="text-xs text-slate-500">
                ควบคุมสิทธิ์ตามโครงการ พร้อมระบบอนุมัติโดย Master Admin
              </p>
            </div>
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
              <h3 className="font-bold text-slate-900 text-sm mb-1">Confidential & Audit</h3>
              <p className="text-xs text-slate-500">
                โหมดรักษาความลับเอกสาร และบันทึกประวัติ Audit Log สำหรับงานบัญชี
              </p>
            </div>
          </div>
        </main>

        <footer className="py-6 border-t border-slate-200 text-center text-xs text-slate-400">
          Progressive Account Receipt Manager © 2025 · ระบบบริหารการเงินและเอกสารสำหรับองค์กร
        </footer>

        {/* Auth Help & Troubleshooting Modal */}
        {isAuthHelpOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs text-left">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
              <div className="px-5 py-4 bg-[#12304A] text-white flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-teal-600/30 border border-teal-400/40 flex items-center justify-center text-teal-300">
                    <HelpCircle className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold leading-tight">ศูนย์ตรวจสอบปัญหาการเข้าสู่ระบบ Google</h3>
                    <p className="text-[11px] text-teal-200/90">สาเหตุที่อาจทำให้ Login ไม่ได้ในวันนี้ และวิธีแก้ไขแบบตรงจุด</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsAuthHelpOpen(false)}
                  className="p-1 rounded-lg text-slate-300 hover:text-white hover:bg-white/10"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-5 sm:p-6 space-y-4 overflow-y-auto text-xs text-slate-700">
                <div className="p-4 bg-teal-50/80 border border-teal-200 rounded-xl space-y-2">
                  <div className="flex items-center gap-2 font-bold text-teal-900 text-sm">
                    <Sparkles className="w-4 h-4 text-teal-600" />
                    โหมด Frontend UI Template (Demo Access)
                  </div>
                  <p className="text-xs leading-relaxed text-slate-700">
                    ระบบนี้ทำงานแบบ <strong>Frontend Template 100%</strong> โดยใช้ข้อมูลจำลองภายในแอปพลิเคชัน ไม่มีการเชื่อมต่อฐานข้อมูลภายนอก สามารถกดปุ่ม <strong>"เข้าสู่ระบบ"</strong> เพื่อเข้าใช้งานหน้าแดชบอร์ดทดสอบได้ทันที
                  </p>
                </div>

                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                  <div className="flex items-center gap-2 font-bold text-slate-900 text-sm">
                    <ShieldCheck className="w-4 h-4 text-teal-600" />
                    บัญชีผู้ดูแลระบบเริ่มต้น
                  </div>
                  <p className="text-xs leading-relaxed text-slate-600">
                    เมื่อเข้าสู่ระบบ ระบบจะใช้งานโปรไฟล์ Master Admin ({MASTER_ADMIN_EMAILS[0]}) พร้อมข้อมูลตัวอย่างของโครงการ ใบเสร็จรับเงิน รายการเดินบัญชี และหมวดหมู่ค่าใช้จ่ายครบถ้วน
                  </p>
                </div>
              </div>

              {/* Modal Actions */}
              <div className="px-5 py-3.5 bg-slate-100 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => {
                      setIsAuthHelpOpen(false);
                      signInWithGoogle().catch(() => {});
                    }}
                    disabled={isSigningIn}
                    className="flex items-center gap-1.5 px-4 py-2 bg-[#12304A] hover:bg-[#1b466c] disabled:opacity-75 text-white rounded-lg text-xs font-bold cursor-pointer transition shadow-2xs"
                  >
                    {isSigningIn ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-teal-300" />
                    ) : (
                      <LogIn className="w-3.5 h-3.5 text-teal-300" />
                    )}
                    เข้าสู่ระบบ Google (Pop-up)
                  </button>
                  <button
                    onClick={() => {
                      setIsAuthHelpOpen(false);
                      signInWithGoogleRedirect().catch(() => {});
                    }}
                    disabled={isSigningIn}
                    className="flex items-center gap-1.5 px-4 py-2 bg-teal-700 hover:bg-teal-800 disabled:opacity-75 text-white rounded-lg text-xs font-bold cursor-pointer transition shadow-2xs"
                  >
                    <RefreshCw className="w-3.5 h-3.5 text-teal-200" />
                    เข้าสู่ระบบ Google (Redirect เต็มจอ)
                  </button>
                </div>
                <button
                  onClick={() => setIsAuthHelpOpen(false)}
                  className="px-4 py-2 rounded-lg text-slate-600 hover:bg-slate-200 text-xs font-semibold transition cursor-pointer"
                >
                  ปิดหน้าต่าง
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Pending approval view for non-admin new users
  if (!isApproved) {
    return (
      <div className="min-h-screen bg-[#F6F8FB] flex flex-col justify-between">
        <Navbar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          onOpenUpload={() => setIsUploadOpen(true)}
          onOpenAddUser={() => {
            setAddUserRole('user');
            setIsAddUserOpen(true);
          }}
          onToggleMobileMenu={() => setMobileMenuOpen(!mobileMenuOpen)}
        />
        <main className="max-w-md mx-auto px-4 py-20 text-center">
          <div className="w-16 h-16 bg-amber-100 text-amber-700 rounded-full flex items-center justify-center mx-auto mb-4">
            <Clock className="w-8 h-8" />
          </div>
          <h2 className="text-lg font-bold text-slate-900 mb-2">
            รอการอนุมัติสิทธิ์การใช้งาน (Pending Approval)
          </h2>
          <p className="text-xs text-slate-600 mb-6 leading-relaxed">
            บัญชีของคุณ ({currentUser.email}) ได้รับการลงทะเบียนในระบบเรียบร้อยแล้ว กรุณาแจ้ง Master Admin ({MASTER_ADMIN_EMAIL}) เพื่อเปิดใช้งานและมอบหมายโครงการที่เกี่ยวข้อง
          </p>
          <div className="bg-slate-100 p-3 rounded-lg text-slate-500 text-xs font-mono">
            สถานะบัญชีปัจจุบัน: Pending
          </div>
        </main>
        <footer className="py-4 text-center text-xs text-slate-400 border-t border-slate-200">
          Progressive Account Receipt Manager
        </footer>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F6F8FB] flex flex-col">
      {/* Top Navbar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenUpload={() => setIsUploadOpen(true)}
        onOpenAddUser={() => {
          setAddUserRole('user');
          setIsAddUserOpen(true);
        }}
        onToggleMobileMenu={() => setMobileMenuOpen(!mobileMenuOpen)}
      />

      <div className="flex-1 flex max-w-7xl w-full mx-auto">
        {/* Sidebar */}
        <Sidebar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          mobileOpen={mobileMenuOpen}
          setMobileOpen={setMobileMenuOpen}
          pendingReviewCount={pendingReviewCount}
        />

        {/* Main Content Area */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto">

          {isAdmin && projects.length === 0 && (
            <div className="mb-6 p-4 bg-teal-50 border border-teal-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-teal-900 shadow-2xs">
              <div className="flex items-center gap-2.5">
                <FolderKanban className="w-5 h-5 text-teal-700 shrink-0" />
                <div>
                  <span className="font-bold block">สร้างโครงการเริ่มต้นใหม่</span>
                  <span className="text-teal-700">
                    หากต้องการเริ่มต้นสร้างโครงการใหม่บนฐานข้อมูลนี้ สามารถคลิกสร้างโครงการตัวอย่างได้ทันที
                  </span>
                </div>
              </div>
              <button
                onClick={handleSeedSampleProjects}
                className="px-3.5 py-2 bg-[#0D9488] hover:bg-teal-700 text-white font-bold rounded-lg shrink-0 cursor-pointer shadow-xs"
              >
                + สร้างโครงการตัวอย่าง
              </button>
            </div>
          )}

          {/* Render Active View */}
          {activeTab === 'dashboard' && (
            <div className="space-y-6">
              {/* Master Admin / Staff Quick Action Banner on Dashboard (หน้าแรก) */}
              {isAdmin && (
                <div className="bg-gradient-to-r from-[#12304A] via-[#163b5c] to-[#12304A] text-white p-4 sm:p-5 rounded-2xl shadow-sm border border-slate-700/30 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#0D9488] text-white flex items-center gap-1">
                        <Users className="w-3.5 h-3.5" /> ระบบจัดการผู้ใช้งาน
                      </span>
                      <span className="text-xs text-teal-200 font-mono">
                        Master Admin {adminUsersCount}/2 คน · พนักงาน {staffUsersCount} คน
                      </span>
                    </div>
                    <h3 className="text-base font-bold text-white">
                      พนักงานคีย์ข้อมูลใบเสร็จ & Master Admin (คนที่ 2)
                    </h3>
                    <p className="text-xs text-slate-300 mt-0.5 max-w-xl leading-relaxed">
                      เพิ่มพนักงานให้ล็อกอินด้วย Google เข้ามาคีย์ข้อมูลและดูโครงการ หรือแต่งตั้ง Master Admin คนที่ 2 เพื่อร่วมบริหารและตรวจอนุมัติ
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                    <button
                      onClick={() => {
                        setAddUserRole('user');
                        setIsAddUserOpen(true);
                      }}
                      className="flex items-center gap-1.5 px-3.5 py-2 bg-[#0D9488] hover:bg-teal-700 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
                    >
                      <UserPlus className="w-4 h-4" />
                      + เพิ่มพนักงานคีย์ข้อมูล (User)
                    </button>
                    {adminUsersCount < 2 && (
                      <button
                        onClick={() => {
                          setAddUserRole('admin');
                          setIsAddUserOpen(true);
                        }}
                        className="flex items-center gap-1.5 px-3.5 py-2 bg-white/10 hover:bg-white/20 border border-white/20 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
                        title="แต่งตั้ง Master Admin คนที่ 2 (สิทธิ์เทียบเท่า)"
                      >
                        <ShieldCheck className="w-4 h-4 text-teal-300" />
                        + แต่งตั้ง Master Admin คนที่ 2
                      </button>
                    )}
                    <button
                      onClick={() => setActiveTab('users')}
                      className="px-3 py-2 text-xs text-teal-200 hover:text-white hover:underline font-medium cursor-pointer"
                    >
                      จัดการสิทธิ์ทั้งหมด →
                    </button>
                  </div>
                </div>
              )}

              {/* Global Filter Bar */}
              <FilterBar />

              {/* 8 KPI Cards */}
              <KPIStats
                receipts={scopedReceipts}
                allReceipts={receipts}
                projects={projects}
              />

              {/* Charts & Analytical Visualizations */}
              <ChartsSection
                receipts={scopedReceipts}
                projects={projects}
                categories={categories}
                users={users}
                isAdmin={isAdmin}
                groupByDateKey={filters.groupByDate}
              />

              {/* สรุปภาพรวมสินทรัพย์หมุนเวียน (Current Assets & Bank Statement Summary) */}
              <CurrentAssetsSummaryWidget
                onNavigateToAssets={handleNavigateToAssets}
              />
            </div>
          )}

          {activeTab === 'receipts' && (
            <div className="space-y-4">
              <FilterBar />
              <ReceiptsTable
                receipts={scopedReceipts}
                onSelectReceipt={(r) => {
                  setSelectedReceipt(r);
                  setIsReceiptModalInEditMode(false);
                }}
                onEditReceipt={(r) => {
                  setSelectedReceipt(r);
                  setIsReceiptModalInEditMode(true);
                }}
                onOpenUpload={() => setIsUploadOpen(true)}
              />
            </div>
          )}

          {activeTab === 'upload' && (
            <div className="max-w-4xl mx-auto py-6">
              <div className="text-center mb-6">
                <h2 className="text-xl font-bold text-slate-900">บันทึกใบเสร็จรับเงินใหม่</h2>
                <p className="text-xs text-slate-500 mt-1">
                  เลือกโครงการและถ่ายภาพหรืออัปโหลดไฟล์เพื่อเริ่มต้นอ่านข้อมูลด้วยระบบ AI Assisted OCR ทันที
                </p>
              </div>
              <div className="flex justify-center">
                <button
                  onClick={() => setIsUploadOpen(true)}
                  className="px-6 py-3 bg-[#0D9488] hover:bg-teal-700 text-white font-bold rounded-xl shadow-md cursor-pointer flex items-center gap-2"
                >
                  <PlusCircle className="w-5 h-5" />
                  เปิดหน้าต่างบันทึกใบเสร็จ
                </button>
              </div>
            </div>
          )}

          {activeTab === 'assets' && (
            <CurrentAssetsPage initialAccountId={targetAssetAccountId} />
          )}

          {activeTab === 'projects' && <ProjectsPage />}

          {activeTab === 'reports' && (
            <div className="space-y-4">
              <FilterBar />
              <ReportsPage />
            </div>
          )}

          {activeTab === 'users' && isAdmin && <UserManagementPage />}

          {activeTab === 'categories' && isAdmin && <CategoriesPage />}

          {activeTab === 'settings' && <SettingsPage />}

        </main>
      </div>

      {/* Upload Receipt Modal */}
      <ReceiptUploadModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        onSuccess={(id) => {
          setFilters((prev) => ({ ...prev, datePreset: 'all', projectId: 'all' }));
          setActiveTab('receipts');
        }}
      />

      {/* Receipt Detail Inspector Modal */}
      <ReceiptDetailModal
        receipt={selectedReceipt}
        initialEditMode={isReceiptModalInEditMode}
        onClose={() => {
          setSelectedReceipt(null);
          setIsReceiptModalInEditMode(false);
        }}
      />

      {/* Add User Modal */}
      <AddUserModal
        isOpen={isAddUserOpen}
        initialRole={addUserRole}
        onClose={() => setIsAddUserOpen(false)}
      />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <DataProvider>
        <MainLayout />
      </DataProvider>
    </AuthProvider>
  );
}
