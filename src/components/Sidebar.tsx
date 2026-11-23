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
  ShieldAlert,
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

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'upload', label: 'บันทึกใบเสร็จ', icon: Camera },
    {
      id: 'receipts',
      label: 'รายการใบเสร็จ',
      icon: Receipt,
      badge: pendingReviewCount > 0 ? pendingReviewCount : undefined,
    },
    { id: 'assets', label: 'บันทึกสินทรัพย์หมุนเวียน', icon: Landmark },
    { id: 'projects', label: 'โครงการ', icon: FolderKanban },
    { id: 'reports', label: 'รายงาน', icon: FileSpreadsheet },
  ];

  const adminNavItems = [
    { id: 'users', label: 'จัดการผู้ใช้งาน', icon: Users },
    { id: 'categories', label: 'หมวดหมู่ค่าใช้จ่าย', icon: Tags },
    { id: 'settings', label: 'ตั้งค่าระบบ & Audit', icon: Settings },
  ];

  const content = (
    <div className="flex flex-col h-full bg-white border-r border-slate-200 w-64 select-none">
      {/* Mobile Close Button */}
      <div className="md:hidden flex items-center justify-between p-4 border-b border-slate-200">
        <span className="font-semibold text-slate-800 text-sm">เมนูระบบ</span>
        <button
          onClick={() => setMobileOpen(false)}
          className="p-1 rounded-md text-slate-500 hover:bg-slate-100"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="p-3 space-y-1 flex-1 overflow-y-auto">
        <div className="px-3 py-2 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
          การทำงานหลัก
        </div>

        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => handleNavClick(item.id)}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                isActive
                  ? 'bg-slate-100 text-[#12304A] font-semibold border-l-2 border-[#12304A]'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon className={`w-4 h-4 ${isActive ? 'text-[#12304A]' : 'text-slate-500'}`} />
                <span>{item.label}</span>
              </div>
              {item.badge !== undefined && (
                <span className="text-xs px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 font-semibold font-mono tabular-nums">
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}

        {/* Master Admin Section */}
        {isAdmin && (
          <div className="pt-4 mt-4 border-t border-slate-100 space-y-1">
            <div className="px-3 py-2 text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <ShieldAlert className="w-3.5 h-3.5 text-teal-600" />
              <span>ผู้ดูแลระบบ (Admin)</span>
            </div>

            {adminNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleNavClick(item.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                    isActive
                      ? 'bg-slate-100 text-[#12304A] font-semibold border-l-2 border-[#12304A]'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-[#12304A]' : 'text-slate-500'}`} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* User Status Footer in Sidebar */}
      <div className="p-3 border-t border-slate-200 bg-slate-50 text-xs text-slate-500">
        <div className="flex items-center justify-between text-[11px]">
          <span>สิทธิ์การใช้งาน:</span>
          <span className="font-semibold text-slate-700">
            {isAdmin ? 'Master Admin' : currentUser?.status === 'active' ? 'User' : 'รออนุมัติ'}
          </span>
        </div>
        <div className="mt-1 text-[11px] text-slate-400 truncate">
          เขตเวลา: Asia/Bangkok (UTC+7)
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop fixed sidebar */}
      <aside className="hidden md:block shrink-0">{content}</aside>

      {/* Mobile drawer overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          <div
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs transition-opacity"
            onClick={() => setMobileOpen(false)}
          />
          <div className="relative z-10 w-64 max-w-xs">{content}</div>
        </div>
      )}
    </>
  );
};
