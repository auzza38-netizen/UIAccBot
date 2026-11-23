import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { DataProvider, useData } from './context/DataContext';
import { ErrorBoundary } from './components/ErrorBoundary';
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
import { activeFirebaseProjectId } from './firebase';
import {
  ShieldCheck,
  LogIn,
  ReceiptText,
  Sparkles,
  FolderKanban,
  Clock,
  PlusCircle,
  HelpCircle,
  X,
  AlertTriangle,
  Copy,
  Loader2,
  RefreshCw,
  FileStack,
  ScanText,
  ArrowUpRight,
  ArrowDownLeft,
  CheckCircle2,
  Database,
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
    loadingData,
    isSavingData,
    savingLabel,
    isOfflineQuotaMode,
    filters,
    setFilters,
    seedSampleDataToFirebase,
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
  const [seedMessage, setSeedMessage] = useState<string | null>(null);
  const [isSeedingSamples, setIsSeedingSamples] = useState<boolean>(false);

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

  // Initialize sample data into Firebase if empty and user is Master Admin
  const handleSeedSampleProjects = async () => {
    if (!isAdmin) return;
    setIsSeedingSamples(true);
    try {
      await seedSampleDataToFirebase();
      setSeedMessage('เพิ่มข้อมูลโครงการ ใบเสร็จ และบัญชีตัวอย่างเข้าสู่ Firebase เรียบร้อยแล้ว');
      setTimeout(() => setSeedMessage(null), 4000);
    } catch (e: any) {
      setSeedMessage('เกิดข้อผิดพลาด: ' + (e?.message || 'ไม่สามารถสร้างข้อมูลตัวอย่างได้'));
    } finally {
      setIsSeedingSamples(false);
    }
  };

  // Initial auth or data loading skeleton
  if (
    loading ||
    (currentUser && isApproved && loadingData && projects.length === 0 && receipts.length === 0)
  ) {
    return (
      <div className="min-h-screen bg-[#F6F8FB] flex items-center justify-center">
        <div className="text-center space-y-2.5">
          <div className="w-9 h-9 border-2 border-[#0F766E] border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs font-semibold text-slate-700">
            {loading ? 'กำลังตรวจสอบสิทธิ์ผู้ใช้งาน Firebase...' : 'กำลังซิงค์ข้อมูลจากฐานข้อมูล Firebase...'}
          </p>
          {activeFirebaseProjectId && (
            <p className="text-[11px] font-mono text-slate-400">
              Project: {activeFirebaseProjectId}
            </p>
          )}
        </div>
      </div>
    );
  }

  // Not logged in: Clean Modern Financial Landing
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-[#F6F8FB] flex flex-col justify-between text-slate-900">
        <header className="bg-white/95 backdrop-blur-md border-b border-slate-200/80 sticky top-0 z-20">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-8">
            <div className="flex items-center gap-2.5 whitespace-nowrap shrink-0">
              <div className="w-8 h-8 rounded-lg bg-[#0F172A] flex items-center justify-center text-white">
                <ReceiptText className="w-4 h-4" />
              </div>
              <span className="font-display font-bold text-base tracking-tight text-slate-900">
                Progressive Account Receipt Manager
              </span>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <button
                onClick={() => signInWithGoogle().catch(() => {})}
                disabled={isSigningIn}
                className="inline-flex items-center gap-2 px-4 py-2 bg-[#0F766E] hover:bg-[#0D645D] disabled:opacity-75 text-white rounded-lg text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                {isSigningIn ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <LogIn className="w-4 h-4" />
                )}
                <span>{isSigningIn ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบด้วย Google'}</span>
              </button>
            </div>
          </div>
        </header>

        <main className="max-w-6xl mx-auto px-4 sm:px-6 py-12 sm:py-16 w-full">
          {authError && (
            <div className="mb-8 p-4 sm:p-5 bg-amber-50 border border-amber-200 rounded-xl text-left text-slate-800">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                    <h3 className="font-semibold text-sm text-amber-950">
                      {authError.title} · <span className="font-mono text-xs">{authError.code}</span>
                    </h3>
                    <button
                      onClick={clearAuthError}
                      className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                      aria-label="ปิดการแจ้งเตือน"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <p className="text-xs text-slate-700 mb-3 leading-relaxed">
                    {authError.detail} {authError.solution}
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={handleCopyDomain}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-semibold transition cursor-pointer"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      {copiedDomain ? 'คัดลอกโดเมนแล้ว' : 'คัดลอกโดเมน'}
                    </button>
                    <button
                      onClick={() => signInWithGoogleRedirect().catch(() => {})}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold transition cursor-pointer"
                    >
                      <RefreshCw className="w-3.5 h-3.5 text-teal-700" />
                      เข้าสู่ระบบแบบ Redirect
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Split Financial Hero */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
            <div className="lg:col-span-6 space-y-5">
              <p className="text-xs font-semibold text-teal-700 tracking-wide">
                ระบบบริหารการเงินและเอกสารบัญชีองค์กร · Firebase Cloud Sync
              </p>

              <h1 className="font-display text-3xl sm:text-4xl lg:text-[42px] font-bold text-slate-900 tracking-tight leading-[1.16]">
                ควบคุมค่าใช้จ่ายและงบประมาณโครงการในมุมมองเดียว
              </h1>

              <p className="text-slate-600 text-sm sm:text-base leading-relaxed max-w-xl">
                บันทึกใบเสร็จและใบกำกับภาษีด้วย OCR ภาษาไทย แยกยอดภาษีมูลค่าเพิ่ม จัดหมวดหมู่ผังบัญชี
                กระทบยอด Statement ธนาคาร และจัดเก็บข้อมูลแบบเรียลไทม์บน Firebase Firestore
              </p>

              <div className="flex flex-wrap items-center gap-3 pt-1">
                <button
                  onClick={() => signInWithGoogle().catch(() => {})}
                  disabled={isSigningIn}
                  className="inline-flex items-center justify-center gap-2.5 px-6 py-3 bg-[#0F172A] hover:bg-slate-800 disabled:opacity-75 text-white rounded-xl text-sm font-semibold transition-colors cursor-pointer"
                >
                  {isSigningIn ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-teal-400" />
                      <span>กำลังยืนยันตัวตน Google...</span>
                    </>
                  ) : (
                    <>
                      <LogIn className="w-4 h-4 text-teal-400" />
                      <span>เข้าสู่ระบบด้วย Google Account</span>
                    </>
                  )}
                </button>
                <button
                  onClick={() => setIsAuthHelpOpen(true)}
                  className="inline-flex items-center gap-1.5 px-4 py-3 text-xs font-medium text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
                >
                  <HelpCircle className="w-4 h-4 text-slate-400" />
                  <span>ข้อมูลสิทธิ์การเข้าใช้งาน</span>
                </button>
              </div>
            </div>

            {/* Clean Financial Ledger Preview Card */}
            <div className="lg:col-span-6">
              <div className="bg-white border border-slate-200/90 rounded-2xl overflow-hidden">
                <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
                  <div>
                    <span className="text-xs text-slate-500 block">สภาพคล่องรวมทุกบัญชี</span>
                    <span className="text-2xl sm:text-3xl font-bold font-mono tabular-nums text-slate-900 mt-0.5 block">
                      ฿ 1,205,000.00
                    </span>
                  </div>
                  <div className="text-right text-xs font-mono tabular-nums space-y-1">
                    <div className="flex items-center justify-end gap-1 text-emerald-700 font-semibold">
                      <ArrowDownLeft className="w-3.5 h-3.5" />
                      <span>+850,000.00</span>
                    </div>
                    <div className="flex items-center justify-end gap-1 text-rose-700 font-semibold">
                      <ArrowUpRight className="w-3.5 h-3.5" />
                      <span>-142,350.00</span>
                    </div>
                  </div>
                </div>

                <div className="divide-y divide-slate-100 text-xs">
                  <div className="px-6 py-3.5 flex items-center justify-between">
                    <div>
                      <span className="font-semibold text-slate-900 block">บจก. สยามแม็คโคร · #MK-2026-089</span>
                      <span className="text-[11px] text-slate-500">PRJ-101 · วัสดุสำนักงาน · VAT 7%</span>
                    </div>
                    <div className="text-right font-mono tabular-nums">
                      <span className="font-semibold text-slate-900 block">-12,450.00 ฿</span>
                      <span className="text-[11px] text-emerald-700 font-sans">อนุมัติแล้ว</span>
                    </div>
                  </div>
                  <div className="px-6 py-3.5 flex items-center justify-between">
                    <div>
                      <span className="font-semibold text-slate-900 block">ปตท. สถานีบริการน้ำมัน · #PTT-4412</span>
                      <span className="text-[11px] text-slate-500">PRJ-102 · ค่าน้ำมันเดินทาง · VAT 7%</span>
                    </div>
                    <div className="text-right font-mono tabular-nums">
                      <span className="font-semibold text-slate-900 block">-2,180.00 ฿</span>
                      <span className="text-[11px] text-emerald-700 font-sans">อนุมัติแล้ว</span>
                    </div>
                  </div>
                  <div className="px-6 py-3.5 flex items-center justify-between">
                    <div>
                      <span className="font-semibold text-slate-900 block">บจก. แอดไวซ์ ไอที · #ADV-99104</span>
                      <span className="text-[11px] text-slate-500">PRJ-101 · อุปกรณ์คอมพิวเตอร์</span>
                    </div>
                    <div className="text-right font-mono tabular-nums">
                      <span className="font-semibold text-slate-900 block">-28,900.00 ฿</span>
                      <span className="text-[11px] text-amber-700 font-sans">รออนุมัติ</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 3 Clean Feature Columns */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-14 pt-10 border-t border-slate-200/80 text-left">
            <div>
              <h3 className="font-display font-semibold text-slate-900 text-sm mb-1.5">
                01. อ่านเอกสารและแยกภาษีอัตโนมัติ
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                แปลงวันที่ พ.ศ./ค.ศ. แยกยอดก่อนภาษี VAT หัก ณ ที่จ่าย และแยกรายการสินค้าในไฟล์ PDF หลายหน้าได้ทันที
              </p>
            </div>

            <div>
              <h3 className="font-display font-semibold text-slate-900 text-sm mb-1.5">
                02. ควบคุมงบประมาณและสิทธิ์รายโครงการ
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                เปรียบเทียบงบประมาณกับยอดเบิกจ่ายจริง กำหนดผู้รับผิดชอบแต่ละโครงการ พร้อมขั้นตอนตรวจสอบอนุมัติที่โปร่งใส
              </p>
            </div>

            <div>
              <h3 className="font-display font-semibold text-slate-900 text-sm mb-1.5">
                03. ซิงค์ Firebase และส่งออกรายงานบัญชี
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                จัดเก็บข้อมูลบนฐานข้อมูลคลาวด์ Firebase Firestore พร้อม Audit Log และส่งออก Excel, CSV, PDF สำหรับฝ่ายบัญชี
              </p>
            </div>
          </div>
        </main>

        <footer className="py-5 border-t border-slate-200/80 text-center text-xs text-slate-400">
          Progressive Account Receipt Manager · Firebase Cloud Database ({activeFirebaseProjectId || 'UiAccBot'})
        </footer>

        {/* Auth Help Modal */}
        {isAuthHelpOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs text-left">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-lg border border-slate-200 overflow-hidden flex flex-col">
              <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
                <div>
                  <h3 className="font-display text-base font-bold text-slate-900">
                    สิทธิ์การเข้าใช้งานระบบ Firebase Auth
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    ยืนยันตัวตนผ่านบัญชี Google และจัดการสิทธิ์แบบ RBAC บนคลาวด์
                  </p>
                </div>
                <button
                  onClick={() => setIsAuthHelpOpen(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-5 space-y-4 text-xs text-slate-700">
                <div className="p-4 bg-teal-50/70 border border-teal-200/80 rounded-lg space-y-1.5">
                  <div className="flex items-center gap-2 font-semibold text-teal-950 text-sm">
                    <Sparkles className="w-4 h-4 text-teal-700" />
                    การเชื่อมต่อฐานข้อมูลคลาวด์จริง (Firestore)
                  </div>
                  <p className="leading-relaxed text-slate-700">
                    เมื่อเข้าสู่ระบบด้วย Google ข้อมูลโครงการ ใบเสร็จ หมวดหมู่ บัญชีธนาคาร และ Statement ทั้งหมดจะถูกบันทึกและซิงค์แบบ Real-Time บนฐานข้อมูล Firebase
                  </p>
                </div>

                <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-1">
                  <div className="flex items-center gap-2 font-semibold text-slate-900 text-sm">
                    <ShieldCheck className="w-4 h-4 text-teal-700" />
                    บัญชี Master Admin ที่ได้รับสิทธิ์อัตโนมัติ
                  </div>
                  <p className="text-slate-600 leading-relaxed">
                    ผู้ดูแลหลัก: <span className="font-mono font-semibold text-slate-900">{MASTER_ADMIN_EMAILS[0]}</span>
                  </p>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    สำหรับพนักงานใหม่ สามารถให้ Master Admin เพิ่มอีเมลล่วงหน้าในเมนู "ผู้ใช้งานและสิทธิ์" หรือเข้าสู่ระบบเพื่อรออนุมัติสิทธิ์ได้
                  </p>
                </div>
              </div>

              <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  onClick={() => setIsAuthHelpOpen(false)}
                  className="px-4 py-2 rounded-lg text-slate-600 hover:bg-slate-200/70 text-xs font-semibold transition cursor-pointer"
                >
                  ปิดหน้าต่าง
                </button>
                <button
                  onClick={() => {
                    setIsAuthHelpOpen(false);
                    signInWithGoogle().catch(() => {});
                  }}
                  disabled={isSigningIn}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#0F766E] hover:bg-[#0D645D] text-white rounded-lg text-xs font-semibold cursor-pointer transition"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  เข้าสู่ระบบด้วย Google
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
          <div className="w-14 h-14 bg-amber-50 border border-amber-200 text-amber-700 rounded-xl flex items-center justify-center mx-auto mb-4">
            <Clock className="w-7 h-7" />
          </div>
          <h2 className="font-display text-lg font-bold text-slate-900 mb-2">
            รอการอนุมัติสิทธิ์การใช้งาน
          </h2>
          <p className="text-xs text-slate-600 mb-6 leading-relaxed">
            บัญชีของคุณ ({currentUser.email}) ลงทะเบียนเข้าสู่ระบบ Firebase เรียบร้อยแล้ว กรุณาแจ้ง Master Admin ({MASTER_ADMIN_EMAIL}) เพื่อเปิดใช้งานและกำหนดโครงการ
          </p>
          <div className="bg-white border border-slate-200 px-4 py-2.5 rounded-lg text-slate-600 text-xs font-mono">
            สถานะบัญชีปัจจุบัน: {currentUser.status === 'suspended' ? 'Suspended' : 'Pending Approval'}
          </div>
        </main>
        <footer className="py-4 text-center text-xs text-slate-400 border-t border-slate-200">
          Progressive Account Receipt Manager
        </footer>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F6F8FB] flex flex-col text-slate-900">
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

      {/* Global Non-Blocking Firebase Saving Indicator */}
      {isSavingData && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-5 right-5 z-50 flex items-center gap-2.5 px-4 py-2.5 bg-slate-900/95 text-white rounded-xl shadow-lg border border-slate-700/70 text-xs font-medium backdrop-blur-sm"
        >
          <Loader2 className="w-4 h-4 animate-spin text-teal-400 shrink-0" />
          <span>{savingLabel || 'กำลังบันทึกข้อมูลไปยัง Firebase...'}</span>
        </div>
      )}

      <div className="flex-1 flex max-w-[1440px] w-full mx-auto">
        {/* Sidebar */}
        <Sidebar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          mobileOpen={mobileMenuOpen}
          setMobileOpen={setMobileMenuOpen}
          pendingReviewCount={pendingReviewCount}
        />

        {/* Main Content Area */}
        <main className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8 overflow-y-auto">
          {isOfflineQuotaMode && (
            <div className="mb-5 p-3.5 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl text-xs font-medium flex items-center gap-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>
                โควตาการอ่านข้อมูล Firestore ฟรีรายวันเต็มชั่วคราว กรุณารอรีเซ็ตในวันถัดไปหรืออัปเกรดแพ็กเกจใน Firebase Console
              </span>
            </div>
          )}

          {seedMessage && (
            <div className="mb-5 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-medium flex items-center justify-between">
              <span className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                {seedMessage}
              </span>
              <button onClick={() => setSeedMessage(null)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {isAdmin && projects.length === 0 && (
            <div className="mb-6 p-4 bg-white border border-teal-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-teal-50 text-teal-700 flex items-center justify-center shrink-0">
                  <FolderKanban className="w-5 h-5" />
                </div>
                <div>
                  <span className="font-semibold text-slate-900 block">
                    เชื่อมต่อฐานข้อมูล Firebase สำเร็จ — ยังไม่มีโครงการในฐานข้อมูล
                  </span>
                  <span className="text-slate-500">
                    คุณสามารถสร้างโครงการใหม่เอง หรือคลิกเพิ่มข้อมูลตัวอย่างเริ่มต้น (โครงการ ใบเสร็จ และบัญชี) เข้าสู่ Firestore ได้ทันที
                  </span>
                </div>
              </div>
              <button
                onClick={handleSeedSampleProjects}
                disabled={isSeedingSamples}
                className="inline-flex items-center gap-2 px-4 py-2 bg-[#0F766E] hover:bg-[#0D645D] disabled:opacity-60 text-white font-semibold rounded-lg shrink-0 cursor-pointer transition-colors"
              >
                {isSeedingSamples ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>กำลังบันทึกเข้า Firebase...</span>
                  </>
                ) : (
                  <>
                    <Database className="w-3.5 h-3.5" />
                    <span>+ เพิ่มข้อมูลตัวอย่างเข้า Firebase</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* Render Active View */}
          {activeTab === 'dashboard' && (
            <div className="space-y-5">
              {/* Clean Executive Page Header */}
              <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-3">
                <div>
                  <h1 className="font-display text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                    ภาพรวมการเงินและใบเสร็จโครงการ
                  </h1>
                  <p className="text-xs sm:text-sm text-slate-500 mt-1">
                    ติดตามยอดค่าใช้จ่าย สถานะการอนุมัติ งบประมาณโครงการ และสภาพคล่องบัญชีธนาคารแบบเรียลไทม์
                  </p>
                </div>

                {isAdmin && (
                  <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 shrink-0">
                    <span className="font-mono tabular-nums">
                      ผู้ดูแล {adminUsersCount} · พนักงาน {staffUsersCount} คน
                    </span>
                    <span aria-hidden="true" className="text-slate-300">|</span>
                    <button
                      onClick={() => setActiveTab('users')}
                      className="text-teal-700 hover:text-teal-900 font-semibold hover:underline cursor-pointer"
                    >
                      จัดการผู้ใช้งานและสิทธิ์
                    </button>
                  </div>
                )}
              </div>

              {/* Compact Financial Filter Bar */}
              <FilterBar />

              {/* Unified Financial KPI Strip */}
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

              {/* Current Assets & Bank Statement Summary */}
              <CurrentAssetsSummaryWidget
                onNavigateToAssets={handleNavigateToAssets}
              />
            </div>
          )}

          {activeTab === 'receipts' && (
            <div className="space-y-5">
              <div>
                <h1 className="font-display text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                  รายการใบเสร็จรับเงินและเอกสารจ่าย
                </h1>
                <p className="text-xs sm:text-sm text-slate-500 mt-1">
                  ค้นหา ตรวจสอบรายละเอียด อนุมัติ หรือจัดการเอกสารใบเสร็จทั้งหมดตามตัวกรอง
                </p>
              </div>
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
            <div className="max-w-3xl mx-auto py-8">
              <div className="bg-white border border-slate-200/80 rounded-xl p-6 sm:p-8 text-center">
                <div className="w-12 h-12 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center mx-auto mb-4">
                  <ScanText className="w-6 h-6" />
                </div>
                <h1 className="font-display text-xl font-bold text-slate-900">
                  บันทึกใบเสร็จรับเงินใหม่
                </h1>
                <p className="text-xs sm:text-sm text-slate-500 mt-1.5 max-w-lg mx-auto leading-relaxed">
                  เลือกโครงการและอัปโหลดภาพถ่ายใบเสร็จหรือไฟล์ PDF เพื่ออ่านข้อมูลสำคัญ ภาษีมูลค่าเพิ่ม และบันทึกลงฐานข้อมูล Firebase
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-slate-200/80 border border-slate-200/80 rounded-xl my-6 text-left">
                  <div className="p-4">
                    <p className="text-xs font-semibold text-slate-900">อัปโหลดไฟล์เดี่ยว</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">รองรับ JPG, PNG, WebP และ PDF</p>
                  </div>
                  <div className="p-4">
                    <p className="text-xs font-semibold text-slate-900">นำเข้าเป็นชุด / โฟลเดอร์</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">ลากวางหลายไฟล์พร้อมตรวจเอกสารซ้ำ</p>
                  </div>
                  <div className="p-4">
                    <p className="text-xs font-semibold text-slate-900">แยก PDF หลายหน้า</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">แยกบันทึก 1 หน้าต่อ 1 ใบเสร็จได้ทันที</p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-center gap-3">
                  <button
                    onClick={() => setIsUploadOpen(true)}
                    className="inline-flex items-center gap-2 px-6 py-2.5 bg-[#0F766E] hover:bg-[#0D645D] text-white font-semibold text-sm rounded-lg transition-colors cursor-pointer"
                  >
                    <PlusCircle className="w-4 h-4" />
                    <span>เปิดหน้าต่างบันทึกใบเสร็จ</span>
                  </button>
                  <button
                    onClick={() => setActiveTab('receipts')}
                    className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-semibold text-sm rounded-lg transition-colors cursor-pointer"
                  >
                    <FileStack className="w-4 h-4 text-slate-500" />
                    <span>ดูรายการที่บันทึกแล้ว</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'assets' && (
            <CurrentAssetsPage initialAccountId={targetAssetAccountId} />
          )}

          {activeTab === 'projects' && <ProjectsPage />}

          {activeTab === 'reports' && (
            <div className="space-y-5">
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
        onSuccess={() => {
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
    <ErrorBoundary>
      <AuthProvider>
        <DataProvider>
          <MainLayout />
        </DataProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}
