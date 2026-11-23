import React, { useState } from 'react';
import { useData } from '../context/DataContext';
import {
  SlidersHorizontal,
  RotateCcw,
  Search,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { DateFilterPreset } from '../types';

export const FilterBar: React.FC = () => {
  const { filters, setFilters, resetFilters, projects, categories } = useData();
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);

  const mainCategories = categories.filter((c) => c.level === 'main' || !c.parentId);
  const getSubcategories = (parentId: string) =>
    categories.filter((c) => c.parentId === parentId && c.level === 'sub');

  const activeAdvancedCount = [
    filters.projectId !== 'all',
    filters.categoryId !== 'all',
    filters.approvalStatus !== 'all',
    filters.verificationStatus !== 'all',
    filters.groupByDate !== 'documentDate',
  ].filter(Boolean).length;

  const hasAnyFilter =
    activeAdvancedCount > 0 || filters.datePreset !== 'all' || filters.vendor.trim() !== '';

  const handlePresetChange = (preset: DateFilterPreset) => {
    setFilters((prev) => ({
      ...prev,
      datePreset: preset,
      ...(preset !== 'custom' ? { startDate: '', endDate: '' } : {}),
    }));
  };

  return (
    <div className="bg-white border border-slate-200/80 rounded-xl p-3 sm:p-3.5">
      {/* Primary Single-Row Financial Toolbar */}
      <div className="flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-2.5">
        {/* Preset Segmented Tabs */}
        <div className="flex items-center gap-1 p-1 bg-slate-100/80 rounded-lg text-xs overflow-x-auto scrollbar-none">
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
                type="button"
                onClick={() => handlePresetChange(item.id)}
                className={`px-3 py-1.5 rounded-md font-medium whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                  active
                    ? 'bg-white text-slate-900 font-semibold shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>

        {/* Right Controls: Search + Advanced Filter Drawer Toggle + Reset */}
        <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 shrink-0">
          <div className="relative flex-1 sm:w-56">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
            <input
              type="text"
              placeholder="ค้นหาร้านค้า หรือ เลขที่..."
              value={filters.vendor}
              onChange={(e) => setFilters((prev) => ({ ...prev, vendor: e.target.value }))}
              className="w-full h-8.5 pl-8 pr-3 border border-slate-200 rounded-lg bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 text-xs"
            />
          </div>

          <button
            type="button"
            onClick={() => setShowAdvanced((v) => !v)}
            className={`inline-flex items-center gap-1.5 h-8.5 px-3 rounded-lg text-xs font-semibold border transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
              showAdvanced || activeAdvancedCount > 0
                ? 'bg-teal-50/80 border-teal-200 text-teal-900'
                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-teal-700" />
            <span>ตัวกรอง</span>
            {activeAdvancedCount > 0 && (
              <span className="font-mono tabular-nums text-[11px] text-teal-800">
                ({activeAdvancedCount})
              </span>
            )}
            {showAdvanced ? (
              <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            )}
          </button>

          {hasAnyFilter && (
            <button
              type="button"
              onClick={resetFilters}
              className="inline-flex items-center gap-1 h-8.5 px-2.5 text-xs font-medium text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
              title="ล้างตัวกรองทั้งหมด"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>รีเซ็ต</span>
            </button>
          )}
        </div>
      </div>

      {/* Custom Date Pickers if 'custom' is active */}
      {filters.datePreset === 'custom' && (
        <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap items-center gap-3 text-xs">
          <span className="text-slate-500 font-medium">จากวันที่</span>
          <input
            type="date"
            value={filters.startDate}
            onChange={(e) => setFilters((prev) => ({ ...prev, startDate: e.target.value }))}
            className="h-8.5 px-3 border border-slate-200 rounded-lg bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 font-mono"
          />
          <span className="text-slate-500 font-medium">ถึงวันที่</span>
          <input
            type="date"
            value={filters.endDate}
            onChange={(e) => setFilters((prev) => ({ ...prev, endDate: e.target.value }))}
            className="h-8.5 px-3 border border-slate-200 rounded-lg bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 font-mono"
          />
        </div>
      )}

      {/* Collapsible Advanced Filters */}
      {showAdvanced && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 mt-3 pt-3 border-t border-slate-100 text-xs">
          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1">
              ลูกค้า / หน่วยงาน
            </label>
            <select
              value={filters.projectId}
              onChange={(e) => setFilters((prev) => ({ ...prev, projectId: e.target.value }))}
              className="w-full h-8.5 px-2.5 border border-slate-200 rounded-lg bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600"
            >
              <option value="all">ทุกลูกค้า/หน่วยงาน</option>
              {projects.map((p) => (
                <option key={p.projectId} value={p.projectId}>
                  {p.projectCode} - {p.clientName}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1">
              หมวดหมู่ค่าใช้จ่าย
            </label>
            <select
              value={filters.categoryId}
              onChange={(e) => setFilters((prev) => ({ ...prev, categoryId: e.target.value }))}
              className="w-full h-8.5 px-2.5 border border-slate-200 rounded-lg bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600"
            >
              <option value="all">ทุกหมวดหมู่</option>
              {mainCategories.map((main) => {
                const subs = getSubcategories(main.categoryId);
                return (
                  <optgroup key={main.categoryId} label={main.categoryName}>
                    <option value={main.categoryId}>{main.categoryName} (หมวดหลัก)</option>
                    {subs.map((sub) => (
                      <option key={sub.categoryId} value={sub.categoryId}>
                        ↳ {sub.categoryName}
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

          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1">
              สถานะอนุมัติ
            </label>
            <select
              value={filters.approvalStatus}
              onChange={(e) => setFilters((prev) => ({ ...prev, approvalStatus: e.target.value }))}
              className="w-full h-8.5 px-2.5 border border-slate-200 rounded-lg bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600"
            >
              <option value="all">ทุกสถานะอนุมัติ</option>
              <option value="pending">รอตรวจสอบ / รออนุมัติ</option>
              <option value="approved">อนุมัติแล้ว</option>
              <option value="rejected">ปฏิเสธ / ไม่อนุมัติ</option>
              <option value="draft">ฉบับร่าง</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1">
              สถานะการตรวจ
            </label>
            <select
              value={filters.verificationStatus}
              onChange={(e) => setFilters((prev) => ({ ...prev, verificationStatus: e.target.value }))}
              className="w-full h-8.5 px-2.5 border border-slate-200 rounded-lg bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600"
            >
              <option value="all">ทั้งหมด</option>
              <option value="verified">ตรวจแล้ว (สมบูรณ์)</option>
              <option value="needs_review">ต้องตรวจพิเศษ</option>
              <option value="draft">ฉบับร่าง</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1">
              อ้างอิงตามวันที่
            </label>
            <div className="flex items-center bg-slate-100/80 rounded-lg p-0.5 h-8.5 text-xs">
              <button
                type="button"
                onClick={() => setFilters((prev) => ({ ...prev, groupByDate: 'documentDate' }))}
                className={`flex-1 h-full rounded-md font-medium whitespace-nowrap transition-colors cursor-pointer ${
                  filters.groupByDate === 'documentDate'
                    ? 'bg-white text-slate-900 font-semibold shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                วันในบิล
              </button>
              <button
                type="button"
                onClick={() => setFilters((prev) => ({ ...prev, groupByDate: 'uploadDate' }))}
                className={`flex-1 h-full rounded-md font-medium whitespace-nowrap transition-colors cursor-pointer ${
                  filters.groupByDate === 'uploadDate'
                    ? 'bg-white text-slate-900 font-semibold shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                วันบันทึก
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
