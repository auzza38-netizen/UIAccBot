import React from 'react';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';
import {
  Calendar,
  Filter,
  RotateCcw,
  Search,
  Building,
  Tag,
  CheckCircle2,
  Clock,
} from 'lucide-react';
import { DateFilterPreset } from '../types';

export const FilterBar: React.FC = () => {
  const { filters, setFilters, resetFilters, projects, categories, users } = useData();
  const { isAdmin } = useAuth();

  const mainCategories = categories.filter((c) => c.level === 'main' || !c.parentId);
  const getSubcategories = (parentId: string) =>
    categories.filter((c) => c.parentId === parentId && c.level === 'sub');

  const handlePresetChange = (preset: DateFilterPreset) => {
    setFilters((prev) => ({
      ...prev,
      datePreset: preset,
      // If choosing preset, clear custom dates unless 'custom'
      ...(preset !== 'custom' ? { startDate: '', endDate: '' } : {}),
    }));
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-3.5 mb-5 shadow-xs">
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
        {/* Preset Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 lg:pb-0 scrollbar-none text-xs">
          <span className="text-slate-400 font-medium mr-1.5 flex items-center gap-1 shrink-0">
            <Calendar className="w-3.5 h-3.5" /> ช่วงเวลา:
          </span>
          {(
            [
              { id: 'today', label: 'วันนี้' },
              { id: 'yesterday', label: 'เมื่อวาน' },
              { id: 'this_week', label: 'สัปดาห์นี้' },
              { id: 'this_month', label: 'เดือนนี้' },
              { id: 'last_month', label: 'เดือนที่แล้ว' },
              { id: 'all', label: 'ทั้งหมด' },
              { id: 'custom', label: 'กำหนดเอง' },
            ] as const
          ).map((item) => {
            const active = filters.datePreset === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handlePresetChange(item.id)}
                className={`px-2.5 py-1.5 rounded-md font-medium whitespace-nowrap transition-colors cursor-pointer ${
                  active
                    ? 'bg-[#12304A] text-white shadow-xs'
                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>

        {/* Date basis & Reset button */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center bg-slate-100 rounded-lg p-0.5 text-xs text-slate-600">
            <button
              onClick={() => setFilters((prev) => ({ ...prev, groupByDate: 'documentDate' }))}
              className={`px-2 py-1 rounded-md font-medium transition cursor-pointer ${
                filters.groupByDate === 'documentDate' ? 'bg-white text-[#12304A] shadow-xs' : 'text-slate-500'
              }`}
            >
              วันที่ในใบเสร็จ
            </button>
            <button
              onClick={() => setFilters((prev) => ({ ...prev, groupByDate: 'uploadDate' }))}
              className={`px-2 py-1 rounded-md font-medium transition cursor-pointer ${
                filters.groupByDate === 'uploadDate' ? 'bg-white text-[#12304A] shadow-xs' : 'text-slate-500'
              }`}
            >
              วันที่บันทึก
            </button>
          </div>

          <button
            onClick={resetFilters}
            className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-md transition cursor-pointer"
            title="ล้างตัวกรอง"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">รีเซ็ต</span>
          </button>
        </div>
      </div>

      {/* Custom Date Pickers if 'custom' is active */}
      {filters.datePreset === 'custom' && (
        <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap items-center gap-3 text-xs">
          <span className="text-slate-500">จากวันที่:</span>
          <input
            type="date"
            value={filters.startDate}
            onChange={(e) => setFilters((prev) => ({ ...prev, startDate: e.target.value }))}
            className="px-2.5 py-1.5 border border-slate-200 rounded-md bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-teal-600 font-mono"
          />
          <span className="text-slate-500">ถึงวันที่:</span>
          <input
            type="date"
            value={filters.endDate}
            onChange={(e) => setFilters((prev) => ({ ...prev, endDate: e.target.value }))}
            className="px-2.5 py-1.5 border border-slate-200 rounded-md bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-teal-600 font-mono"
          />
        </div>
      )}

      {/* Secondary Dropdown Filters */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 mt-3 pt-3 border-t border-slate-100 text-xs">
        {/* Project Filter */}
        <div>
          <label className="block text-[11px] font-medium text-slate-500 mb-1">ลูกค้า / หน่วยงาน</label>
          <select
            value={filters.projectId}
            onChange={(e) => setFilters((prev) => ({ ...prev, projectId: e.target.value }))}
            className="w-full px-2.5 py-1.5 border border-slate-200 rounded-md bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-teal-600"
          >
            <option value="all">ทุกลูกค้า/หน่วยงาน</option>
            {projects.map((p) => (
              <option key={p.projectId} value={p.projectId}>
                {p.projectCode} - {p.clientName}
              </option>
            ))}
          </select>
        </div>

        {/* Category Filter */}
        <div>
          <label className="block text-[11px] font-medium text-slate-500 mb-1">หมวดหมู่ค่าใช้จ่าย</label>
          <select
            value={filters.categoryId}
            onChange={(e) => setFilters((prev) => ({ ...prev, categoryId: e.target.value }))}
            className="w-full px-2.5 py-1.5 border border-slate-200 rounded-md bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-teal-600"
          >
            <option value="all">ทุกหมวดหมู่</option>
            {mainCategories.map((main) => {
              const subs = getSubcategories(main.categoryId);
              return (
                <optgroup key={main.categoryId} label={`📁 ${main.categoryName}`}>
                  <option value={main.categoryId}>📁 {main.categoryName} (หมวดหมู่หลัก)</option>
                  {subs.map((sub) => (
                    <option key={sub.categoryId} value={sub.categoryId}>
                      &nbsp;&nbsp;↳ {sub.categoryName}
                    </option>
                  ))}
                </optgroup>
              );
            })}
            {categories
              .filter((c) => !mainCategories.some((m) => m.categoryId === c.categoryId) && !c.parentId)
              .map((c) => (
                <option key={c.categoryId} value={c.categoryId}>
                  {c.categoryName}
                </option>
              ))}
          </select>
        </div>

        {/* Approval Status */}
        <div>
          <label className="block text-[11px] font-medium text-slate-500 mb-1">สถานะอนุมัติ</label>
          <select
            value={filters.approvalStatus}
            onChange={(e) => setFilters((prev) => ({ ...prev, approvalStatus: e.target.value }))}
            className="w-full px-2.5 py-1.5 border border-slate-200 rounded-md bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-teal-600"
          >
            <option value="all">ทุกสถานะอนุมัติ</option>
            <option value="pending">รอตรวจสอบ / รออนุมัติ</option>
            <option value="approved">อนุมัติแล้ว</option>
            <option value="rejected">ปฏิเสธ / ไม่อนุมัติ</option>
            <option value="draft">ฉบับร่าง</option>
          </select>
        </div>

        {/* Verification Status */}
        <div>
          <label className="block text-[11px] font-medium text-slate-500 mb-1">สถานะการตรวจ</label>
          <select
            value={filters.verificationStatus}
            onChange={(e) => setFilters((prev) => ({ ...prev, verificationStatus: e.target.value }))}
            className="w-full px-2.5 py-1.5 border border-slate-200 rounded-md bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-teal-600"
          >
            <option value="all">ทั้งหมด</option>
            <option value="verified">ตรวจแล้ว (สมบูรณ์)</option>
            <option value="needs_review">ต้องตรวจพิเศษ (Needs Review)</option>
            <option value="draft">ฉบับร่าง</option>
          </select>
        </div>

        {/* Search Vendor */}
        <div>
          <label className="block text-[11px] font-medium text-slate-500 mb-1">ค้นหาร้านค้า / เลขที่</label>
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
            <input
              type="text"
              placeholder="ชื่อร้าน หรือ เลขที่"
              value={filters.vendor}
              onChange={(e) => setFilters((prev) => ({ ...prev, vendor: e.target.value }))}
              className="w-full pl-8 pr-2.5 py-1.5 border border-slate-200 rounded-md bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-teal-600 text-xs"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
