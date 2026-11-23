import React from 'react';
import { useAuth } from '../context/AuthContext';
import {
  ReceiptText,
  LogOut,
  User as UserIcon,
  PlusCircle,
  Menu,
  UserPlus,
  Loader2,
} from 'lucide-react';

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onOpenUpload: () => void;
  onOpenAddUser?: () => void;
  onToggleMobileMenu: () => void;
}

const TAB_TITLES: Record<string, string> = {
  dashboard: 'ภาพรวมการเงิน',
  upload: 'บันทึกใบเสร็จใหม่',
  receipts: 'รายการใบเสร็จรับเงิน',
  assets: 'สินทรัพย์หมุนเวียนและ Statement',
  projects: 'โครงการและงบประมาณ',
  reports: 'รายงานสรุปและส่งออก',
  users: 'ผู้ใช้งานและสิทธิ์',
  categories: 'หมวดหมู่ค่าใช้จ่าย',
  settings: 'ตั้งค่าระบบและประวัติการใช้งาน',
};

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  onOpenUpload,
  onOpenAddUser,
  onToggleMobileMenu,
}) => {
  const { currentUser, isAdmin, signOut, signInWithGoogle, isSigningIn } = useAuth();
  const currentSectionLabel = TAB_TITLES[activeTab] || 'ภาพรวมการเงิน';

  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200/80 text-slate-900">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-15 gap-6">
          {/* Left Zone: Mobile Toggle + Wordmark + Breadcrumb */}
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={onToggleMobileMenu}
              className="md:hidden p-2 text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              aria-label="เปิดเมนูนำทาง"
            >
              <Menu className="w-5 h-5" />
            </button>

            <button
              onClick={() => setActiveTab('dashboard')}
              className="flex items-center gap-2.5 text-left group shrink-0 cursor-pointer"
            >
              <div className="w-8 h-8 rounded-lg bg-[#0F172A] flex items-center justify-center text-white transition-colors group-hover:bg-[#0F766E]">
                <ReceiptText className="w-4 h-4" />
              </div>
              <span className="font-display text-base font-bold tracking-tight text-slate-900 whitespace-nowrap">
                UiAccBot
              </span>
            </button>

            {currentUser && (
              <div className="hidden sm:flex items-center gap-2.5 text-[13px] text-slate-400 min-w-0">
                <span aria-hidden="true">/</span>
                <span className="text-slate-600 font-medium truncate">
                  {currentSectionLabel}
                </span>
              </div>
            )}
          </div>

          {/* Right Zone: Primary Actions & Profile */}
          <div className="flex items-center gap-2.5 shrink-0">
            {currentUser ? (
              <>
                {isAdmin && onOpenAddUser && (
                  <button
                    onClick={onOpenAddUser}
                    className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 hover:text-slate-900 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                    title="เพิ่มผู้ใช้งานหรือผู้ดูแลระบบ"
                  >
                    <UserPlus className="w-3.5 h-3.5 text-slate-500" />
                    <span>เพิ่มผู้ใช้งาน</span>
                  </button>
                )}

                <button
                  onClick={onOpenUpload}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#0F766E] hover:bg-[#0D645D] text-white rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  <span>บันทึกใบเสร็จ</span>
                </button>

                <div className="flex items-center gap-2.5 pl-3 ml-1 border-l border-slate-200/80">
                  <div className="w-8 h-8 rounded-full bg-slate-900 flex items-center justify-center text-xs font-semibold text-white shrink-0">
                    {currentUser.displayName ? currentUser.displayName[0].toUpperCase() : 'U'}
                  </div>
                  <div className="hidden lg:block text-left min-w-0">
                    <p className="text-xs font-semibold text-slate-900 truncate max-w-[140px] leading-tight">
                      {currentUser.displayName || currentUser.email}
                    </p>
                    <p className="text-[11px] text-slate-500 leading-tight mt-0.5">
                      {isAdmin
                        ? 'Master Admin'
                        : currentUser.status === 'active'
                        ? 'พนักงาน'
                        : 'รออนุมัติ'}
                    </p>
                  </div>

                  <button
                    onClick={signOut}
                    title="ออกจากระบบ"
                    aria-label="ออกจากระบบ"
                    className="p-2 text-slate-400 hover:text-slate-800 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              </>
            ) : (
              <button
                onClick={() => signInWithGoogle().catch(() => {})}
                disabled={isSigningIn}
                className="inline-flex items-center gap-2 px-4 py-2 bg-[#0F172A] text-white hover:bg-slate-800 disabled:opacity-75 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                {isSigningIn ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>กำลังเข้าสู่ระบบ...</span>
                  </>
                ) : (
                  <>
                    <UserIcon className="w-4 h-4" />
                    <span>เข้าสู่ระบบ</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
