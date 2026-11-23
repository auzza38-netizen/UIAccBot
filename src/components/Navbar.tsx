import React from 'react';
import { useAuth } from '../context/AuthContext';
import {
  ReceiptText,
  LogOut,
  ShieldCheck,
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

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  onOpenUpload,
  onOpenAddUser,
  onToggleMobileMenu,
}) => {
  const { currentUser, isAdmin, signOut, signInWithGoogle, isSigningIn } = useAuth();

  return (
    <header className="sticky top-0 z-30 bg-[#12304A] text-white border-b border-[#1b4366] shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          
          {/* Brand & Mobile Hamburger */}
          <div className="flex items-center gap-3">
            <button
              onClick={onToggleMobileMenu}
              className="md:hidden p-2 text-slate-300 hover:text-white rounded-lg hover:bg-white/10"
              aria-label="Toggle Navigation"
            >
              <Menu className="w-5 h-5" />
            </button>

            <button
              onClick={() => setActiveTab('dashboard')}
              className="flex items-center gap-2.5 text-left group"
            >
              <div className="w-9 h-9 rounded-lg bg-[#0D9488] flex items-center justify-center text-white shadow-sm font-bold">
                <ReceiptText className="w-5 h-5" />
              </div>
              <div>
                <span className="text-base font-bold tracking-tight text-white block leading-none">
                  Progressive Account Receipt Manager
                </span>
                <span className="text-[11px] text-teal-200/80 font-normal">
                  ระบบบริหารใบเสร็จและค่าใช้จ่ายโครงการ
                </span>
              </div>
            </button>
          </div>

          {/* Quick Action & User Profile */}
          <div className="flex items-center gap-3">
            {currentUser ? (
              <>
                {isAdmin && onOpenAddUser && (
                  <button
                    onClick={onOpenAddUser}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1b4366] hover:bg-[#235682] border border-teal-400/30 text-teal-200 hover:text-white rounded-lg text-xs sm:text-sm font-medium transition-all shadow-sm active:scale-95 cursor-pointer"
                    title="เพิ่มผู้ใช้งานพนักงานสำหรับคีย์ข้อมูล หรือเพิ่ม Master Admin คนที่ 2"
                  >
                    <UserPlus className="w-4 h-4 text-teal-300" />
                    <span className="hidden sm:inline">เพิ่มผู้ใช้งาน</span>
                    <span className="sm:hidden">+User</span>
                  </button>
                )}

                <button
                  onClick={onOpenUpload}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[#0D9488] hover:bg-teal-700 text-white rounded-lg text-sm font-medium transition-all shadow-sm active:scale-95 cursor-pointer"
                >
                  <PlusCircle className="w-4 h-4" />
                  <span className="hidden sm:inline">บันทึกใบเสร็จ</span>
                  <span className="sm:hidden">บันทึก</span>
                </button>

                {/* User Pill info */}
                <div className="flex items-center gap-2 pl-2 border-l border-white/15">
                  <div className="w-8 h-8 rounded-full bg-slate-700 border border-teal-400/40 flex items-center justify-center text-xs font-semibold text-white">
                    {currentUser.displayName ? currentUser.displayName[0].toUpperCase() : 'U'}
                  </div>
                  <div className="hidden lg:block text-left text-xs">
                    <p className="font-medium text-white truncate max-w-[140px] leading-tight">
                      {currentUser.displayName || currentUser.email}
                    </p>
                    <p className="text-[10px] text-teal-300 flex items-center gap-1">
                      {isAdmin ? (
                        <>
                          <ShieldCheck className="w-3 h-3 text-teal-300 inline" /> Master Admin
                        </>
                      ) : (
                        currentUser.status === 'active' ? 'User (Active)' : 'Pending Approval'
                      )}
                    </p>
                  </div>

                  <button
                    onClick={signOut}
                    title="ออกจากระบบ"
                    className="p-1.5 text-slate-300 hover:text-white rounded-md hover:bg-white/10 transition-colors cursor-pointer"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              </>
            ) : (
              <button
                onClick={() => signInWithGoogle().catch(() => {})}
                disabled={isSigningIn}
                className="flex items-center gap-2 px-4 py-2 bg-white text-[#12304A] hover:bg-slate-100 disabled:opacity-75 rounded-lg text-sm font-medium shadow-sm transition cursor-pointer"
              >
                {isSigningIn ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-[#12304A]" />
                    กำลังเชื่อมต่อ...
                  </>
                ) : (
                  <>
                    <UserIcon className="w-4 h-4 text-[#12304A]" />
                    เข้าสู่ระบบด้วย Google
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
