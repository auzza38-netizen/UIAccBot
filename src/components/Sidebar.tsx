import React from 'react';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard,
  Camera,
  Receipt,
  FolderKanban,
  FileSpreadsheet,
  Users,
  Tags,
  Settings,
  X,
  Landmark,
} from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
  pendingReviewCount?: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  mobileOpen,
  setMobileOpen,
  pendingReviewCount = 0,
}) => {
  const { isAdmin, currentUser } = useAuth();

  const handleNavClick = (tabId: string) => {
    setActiveTab(tabId);
    setMobileOpen(false);
  };

  const operationItems = [
    { id: 'dashboard', label: 'ภาพรวมการเงิน', icon: LayoutDashboard },
    { id: 'upload', label: 'บันทึกใบเสร็จใหม่', icon: Camera },
    {
      id: 'receipts',
      label: 'รายการใบเสร็จรับเงิน',
      icon: Receipt,
      badge: pendingReviewCount > 0 ? pendingReviewCount : undefined,
    },
    { id: 'assets', label: 'สินทรัพย์หมุนเวียน', icon: Landmark },
  ];

  const analysisItems = [
    { id: 'projects', label: 'โครงการและงบประมาณ', icon: FolderKanban },
    { id: 'reports', label: 'รายงานสรุปและส่งออก', icon: FileSpreadsheet },
  ];

  const adminNavItems = [
    { id: 'users', label: 'ผู้ใช้งานและสิทธิ์', icon: Users },
    { id: 'categories', label: 'หมวดหมู่ค่าใช้จ่าย', icon: Tags },
    { id: 'settings', label: 'ตั้งค่าระบบและประวัติ', icon: Settings },
  ];

  const renderNavItem = (item: {
    id: string;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: number;
  }) => {
    const Icon = item.icon;
    const isActive = activeTab === item.id;
    return (
      <button
        key={item.id}
        onClick={() => handleNavClick(item.id)}
        className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-[13px] font-display transition-colors cursor-pointer ${
          isActive
            ? 'bg-[#0F766E] text-white font-semibold shadow-xs'
            : 'text-slate-300 font-medium hover:text-white hover:bg-slate-800/80'
        }`}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <Icon
            className={`w-4 h-4 shrink-0 ${
              isActive ? 'text-teal-100' : 'text-slate-400'
            }`}
          />
          <span className="truncate">{item.label}</span>
        </div>
        {item.badge !== undefined && (
          <span
            className={`text-xs font-mono tabular-nums font-semibold shrink-0 ${
              isActive ? 'text-teal-100' : 'text-amber-400'
            }`}
          >
            {item.badge}
          </span>
        )}
      </button>
    );
  };

  const content = (
    <div className="flex flex-col h-full font-display bg-[#0F172A] text-slate-200 border-r border-slate-800 w-60 select-none">
      {/* Mobile Header */}
      <div className="md:hidden flex items-center justify-between px-4 py-3.5 border-b border-slate-800">
        <span className="font-display font-bold text-white text-sm">เมนูระบบ</span>
        <button
          onClick={() => setMobileOpen(false)}
          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
          aria-label="ปิดเมนู"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Grouped Menu Navigation */}
      <nav className="p-3.5 flex-1 overflow-y-auto space-y-5 font-display" aria-label="เมนูหลัก">
        {/* Group 1: Core Operations */}
        <div className="space-y-0.5">
          <div className="px-3 pb-1.5 text-[11px] font-semibold text-slate-400 tracking-wide">
            การเงินและเอกสาร
          </div>
          {operationItems.map(renderNavItem)}
        </div>

        {/* Group 2: Planning & Reports */}
        <div className="space-y-0.5 pt-4 border-t border-slate-800/80">
          <div className="px-3 pb-1.5 text-[11px] font-semibold text-slate-400 tracking-wide">
            โครงการและรายงาน
          </div>
          {analysisItems.map(renderNavItem)}
        </div>

        {/* Group 3: Administration */}
        {isAdmin && (
          <div className="space-y-0.5 pt-4 border-t border-slate-800/80">
            <div className="px-3 pb-1.5 text-[11px] font-semibold text-slate-400 tracking-wide">
              ผู้ดูแลระบบ
            </div>
            {adminNavItems.map(renderNavItem)}
          </div>
        )}
      </nav>

      {/* Quiet Account Context Footer */}
      <div className="px-4 py-3.5 border-t border-slate-800 bg-[#0B1120] text-xs font-display">
        <div className="flex items-center justify-between">
          <span className="text-slate-400">ระดับสิทธิ์</span>
          <span className="font-semibold text-teal-300">
            {isAdmin ? 'Master Admin' : currentUser?.status === 'active' ? 'ผู้บันทึกข้อมูล' : 'รออนุมัติ'}
          </span>
        </div>
        <div className="mt-1 text-[11px] text-slate-500 font-mono">
          THB (฿) · Asia/Bangkok
        </div>
      </div>
    </div>
  );

  return (
    <>
      <aside className="hidden md:flex shrink-0">{content}</aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          <div
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs transition-opacity"
            onClick={() => setMobileOpen(false)}
          />
          <div className="relative z-10 w-60 max-w-xs h-full">{content}</div>
        </div>
      )}
    </>
  );
};
