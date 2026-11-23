import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend,
  BarChart,
} from 'recharts';
import { Receipt, Project, ExpenseCategory, AppUser } from '../types';
import { useData } from '../context/DataContext';
import { formatCurrency, formatThaiDate } from '../utils/formatters';
import {
  TrendingUp,
  PieChart as PieIcon,
  FolderKanban,
  UserCheck,
  Calendar,
  CreditCard,
  Layers,
  ArrowUpRight,
  ArrowDownLeft,
  Sparkles,
  BarChart3,
  CheckCircle2,
  AlertCircle,
  Coins,
  ChevronRight,
} from 'lucide-react';

interface ChartsSectionProps {
  receipts: Receipt[];
  projects: Project[];
  categories: ExpenseCategory[];
  users: AppUser[];
  isAdmin: boolean;
  groupByDateKey: 'documentDate' | 'uploadDate';
}

const CATEGORY_COLORS = [
  '#0D9488', // Teal
  '#0284C7', // Sky Blue
  '#6366F1', // Indigo
  '#8B5CF6', // Purple
  '#EC4899', // Pink
  '#F59E0B', // Amber
  '#10B981', // Emerald
  '#64748B', // Slate
  '#F43F5E', // Rose
  '#14B8A6', // Light Teal
];

// Custom sleek Recharts Tooltip
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-slate-900/95 backdrop-blur-sm border border-slate-700 text-white p-3 rounded-xl shadow-xl text-xs space-y-1.5 min-w-[180px]">
        <p className="font-semibold text-slate-300 border-b border-slate-700/80 pb-1 mb-1">
          {label}
        </p>
        {payload.map((entry: any, index: number) => {
          const isCount = entry.name.includes('จำนวน') || entry.dataKey === 'count';
          return (
            <div key={`item-${index}`} className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-1.5 text-slate-300">
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: entry.color || entry.fill }}
                />
                {entry.name}:
              </span>
              <span className="font-mono font-bold text-white tabular-nums">
                {isCount ? `${entry.value} รายการ` : formatCurrency(Number(entry.value))}
              </span>
            </div>
          );
        })}
      </div>
    );
  }
  return null;
};

export const ChartsSection: React.FC<ChartsSectionProps> = ({
  receipts,
  projects,
  categories,
  users,
  isAdmin,
  groupByDateKey,
}) => {
  const { statementRecords, bankAccounts } = useData();

  // Active sub-tab inside Charts Section
  const [activeTab, setActiveTab] = useState<'trend' | 'category' | 'projects' | 'team'>('trend');
  const [trendMode, setTrendMode] = useState<'daily' | 'cumulative'>('daily');

  // 1. Daily Aggregation for Expenses
  const dailyData = useMemo(() => {
    const map: Record<string, { date: string; amount: number; count: number; approvedAmount: number }> = {};

    receipts.forEach((r) => {
      const d = (groupByDateKey === 'uploadDate' ? r.uploadDate : r.documentDate) || 'ไม่ระบุ';
      if (!map[d]) {
        map[d] = { date: d, amount: 0, count: 0, approvedAmount: 0 };
      }
      map[d].amount += r.grandTotal || 0;
      map[d].count += 1;
      if (r.approvalStatus === 'approved') {
        map[d].approvedAmount += r.grandTotal || 0;
      }
    });

    const sortedDates = Object.keys(map).sort();

    // Calculate cumulative if needed
    let runningTotal = 0;
    return sortedDates.map((d) => {
      runningTotal += map[d].amount;
      return {
        ...map[d],
        cumulativeAmount: runningTotal,
        formattedDate: d.length === 10 ? formatThaiDate(d) : d,
      };
    });
  }, [receipts, groupByDateKey]);

  // 2. Today vs Yesterday comparison
  const { todayAmount, yesterdayAmount, diffAmount, diffPercent } = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const yesterdayDate = new Date();
    yesterdayDate.setDate(yesterdayDate.getDate() - 1);
    const yesterday = yesterdayDate.toISOString().slice(0, 10);

    const t = receipts
      .filter((r) => (groupByDateKey === 'uploadDate' ? r.uploadDate : r.documentDate) === today)
      .reduce((sum, r) => sum + (r.grandTotal || 0), 0);
    const y = receipts
      .filter((r) => (groupByDateKey === 'uploadDate' ? r.uploadDate : r.documentDate) === yesterday)
      .reduce((sum, r) => sum + (r.grandTotal || 0), 0);

    const diff = t - y;
    const pct = y > 0 ? (diff / y) * 100 : t > 0 ? 100 : 0;
    return { todayAmount: t, yesterdayAmount: y, diffAmount: diff, diffPercent: pct };
  }, [receipts, groupByDateKey]);

  // 3. Category Aggregation
  const categoryData = useMemo(() => {
    const map: Record<string, { amount: number; count: number }> = {};
    const catNameMap: Record<string, string> = {};
    categories.forEach((c) => {
      catNameMap[c.categoryId] = c.categoryName;
    });

    receipts.forEach((r) => {
      const catId = r.categoryId || 'cat-other';
      if (!map[catId]) {
        map[catId] = { amount: 0, count: 0 };
      }
      map[catId].amount += r.grandTotal || 0;
      map[catId].count += 1;
    });

    const totalExp = receipts.reduce((sum, r) => sum + (r.grandTotal || 0), 0);

    const entries = Object.entries(map).map(([id, item]) => {
      const name = catNameMap[id] || 'อื่นๆ / ไม่ระบุ';
      const pct = totalExp > 0 ? (item.amount / totalExp) * 100 : 0;
      return {
        id,
        name,
        value: Math.round(item.amount * 100) / 100,
        count: item.count,
        percent: Math.round(pct * 10) / 10,
      };
    });

    return entries.filter((e) => e.value > 0).sort((a, b) => b.value - a.value);
  }, [receipts, categories]);

  // 4. Payment Method Aggregation
  const paymentMethodData = useMemo(() => {
    const map: Record<string, { amount: number; count: number }> = {};
    const methodNames: Record<string, string> = {
      cash: 'เงินสด',
      transfer: 'โอนผ่านธนาคาร',
      credit_card: 'บัตรเครดิต',
      promptpay: 'พร้อมเพย์',
      other: 'อื่นๆ',
    };

    receipts.forEach((r) => {
      const pm = r.paymentMethod || 'other';
      const label = methodNames[pm] || pm;
      if (!map[label]) {
        map[label] = { amount: 0, count: 0 };
      }
      map[label].amount += r.grandTotal || 0;
      map[label].count += 1;
    });

    return Object.entries(map)
      .map(([name, data]) => ({
        name,
        amount: data.amount,
        count: data.count,
      }))
      .sort((a, b) => b.amount - a.amount);
  }, [receipts]);

  // 5. Project Aggregation
  const projectSummaries = useMemo(() => {
    return projects.map((p) => {
      const pReceipts = receipts.filter((r) => r.projectId === p.projectId);
      const totalSpent = pReceipts.reduce((sum, r) => sum + (r.grandTotal || 0), 0);
      const approvedSpent = pReceipts
        .filter((r) => r.approvalStatus === 'approved')
        .reduce((sum, r) => sum + (r.grandTotal || 0), 0);
      const pendingCount = pReceipts.filter((r) => r.approvalStatus === 'pending').length;
      const budget = p.budget || 0;
      const remaining = budget > 0 ? budget - totalSpent : 0;
      const percentUsed = budget > 0 ? Math.min(Math.round((totalSpent / budget) * 100), 200) : 0;

      return {
        ...p,
        totalSpent,
        approvedSpent,
        receiptsCount: pReceipts.length,
        pendingCount,
        remaining,
        percentUsed,
      };
    }).sort((a, b) => b.totalSpent - a.totalSpent);
  }, [projects, receipts]);

  // 6. User Activity Aggregation (Master Admin)
  const userActivities = useMemo(() => {
    if (!isAdmin) return [];

    return users.map((u) => {
      const uReceipts = receipts.filter((r) => r.uploadedBy === u.uid || r.uploadedByEmail === u.email);
      const totalAmount = uReceipts.reduce((sum, r) => sum + (r.grandTotal || 0), 0);
      const pendingCount = uReceipts.filter((r) => r.approvalStatus === 'pending').length;
      const needsReviewCount = uReceipts.filter((r) => r.verificationStatus === 'needs_review').length;

      const dates = uReceipts.map((r) => r.uploadDate || r.documentDate).filter(Boolean);
      dates.sort();
      const lastDate = dates.length > 0 ? dates[dates.length - 1] : '-';

      return {
        uid: u.uid,
        name: u.displayName || u.email,
        email: u.email,
        receiptsCount: uReceipts.length,
        totalAmount,
        lastDate,
        pendingCount,
        needsReviewCount,
      };
    }).sort((a, b) => b.totalAmount - a.totalAmount);
  }, [users, receipts, isAdmin]);

  // Key Insight Summary
  const topCategory = categoryData[0];
  const topProject = projectSummaries[0];
  const totalExpense = receipts.reduce((sum, r) => sum + (r.grandTotal || 0), 0);

  return (
    <div className="bg-white border border-slate-200/90 rounded-2xl shadow-xs overflow-hidden">
      
      {/* SECTION HEADER & INTERACTIVE TABS */}
      <div className="p-4 sm:p-5 border-b border-slate-100 bg-slate-50/50">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1 rounded-md bg-teal-50 text-teal-700 border border-teal-100">
                <BarChart3 className="w-4 h-4" />
              </span>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                ศูนย์วิเคราะห์ข้อมูล & แผนภูมิการเงิน (Financial Analytics & Charts)
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              ติดตามแนวโน้มค่าใช้จ่าย สัดส่วนหมวดหมู่ และการใช้งบประมาณแบบกราฟและแผนภูมิที่อ่านเข้าใจง่าย
            </p>
          </div>

          {/* Interactive Navigation Tabs */}
          <div className="flex items-center bg-slate-200/70 p-1 rounded-xl text-xs font-semibold overflow-x-auto scrollbar-none">
            <button
              onClick={() => setActiveTab('trend')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition cursor-pointer whitespace-nowrap ${
                activeTab === 'trend'
                  ? 'bg-white text-slate-900 shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <TrendingUp className="w-3.5 h-3.5 text-teal-600" />
              <span>แนวโน้มค่าใช้จ่าย</span>
            </button>

            <button
              onClick={() => setActiveTab('category')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition cursor-pointer whitespace-nowrap ${
                activeTab === 'category'
                  ? 'bg-white text-slate-900 shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <PieIcon className="w-3.5 h-3.5 text-blue-600" />
              <span>สัดส่วนหมวดหมู่</span>
            </button>

            <button
              onClick={() => setActiveTab('projects')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition cursor-pointer whitespace-nowrap ${
                activeTab === 'projects'
                  ? 'bg-white text-slate-900 shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FolderKanban className="w-3.5 h-3.5 text-indigo-600" />
              <span>งบโครงการ ({projects.length})</span>
            </button>

            {isAdmin && (
              <button
                onClick={() => setActiveTab('team')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition cursor-pointer whitespace-nowrap ${
                  activeTab === 'team'
                    ? 'bg-white text-slate-900 shadow-2xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <UserCheck className="w-3.5 h-3.5 text-amber-600" />
                <span>ประสิทธิภาพทีมงาน</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* QUICK HIGHLIGHT STRIP */}
      <div className="bg-gradient-to-r from-teal-50/70 via-slate-50 to-blue-50/50 px-4 sm:px-5 py-2.5 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-3 sm:gap-6">
          {topCategory && (
            <div className="flex items-center gap-1.5 text-slate-700">
              <span className="text-slate-400">หมวดหมู่ใช้จ่ายสูงสุด:</span>
              <span className="font-bold text-teal-800 bg-white/80 px-2 py-0.5 rounded-md border border-teal-200/60 shadow-2xs">
                {topCategory.name} ({topCategory.percent}% · {formatCurrency(topCategory.value)})
              </span>
            </div>
          )}

          {topProject && (
            <div className="flex items-center gap-1.5 text-slate-700">
              <span className="text-slate-400">โครงการที่มีรายการมากสุด:</span>
              <span className="font-bold text-indigo-800 bg-white/80 px-2 py-0.5 rounded-md border border-indigo-200/60 shadow-2xs">
                {topProject.projectCode} ({formatCurrency(topProject.totalSpent)})
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-slate-400">คำนวณตาม:</span>
          <span className="font-semibold text-slate-700 bg-white px-2 py-0.5 rounded border border-slate-200 text-[11px]">
            {groupByDateKey === 'uploadDate' ? 'วันที่บันทึกระบบ' : 'วันที่ในเอกสาร'}
          </span>
        </div>
      </div>

      {/* TAB CONTENT 1: TREND ANALYTICS */}
      {activeTab === 'trend' && (
        <div className="p-4 sm:p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-teal-600" />
                กราฟเส้นและแท่งแสดงแนวโน้มค่าใช้จ่าย (Expense Trend & Daily Volume)
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                แกนซ้าย: มูลค่าเงิน (บาท) · แกนขวา: จำนวนใบเสร็จที่บันทึก
              </p>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex items-center bg-slate-100 p-0.5 rounded-lg text-xs font-semibold">
                <button
                  onClick={() => setTrendMode('daily')}
                  className={`px-2.5 py-1 rounded-md transition cursor-pointer ${
                    trendMode === 'daily'
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  รายวัน
                </button>
                <button
                  onClick={() => setTrendMode('cumulative')}
                  className={`px-2.5 py-1 rounded-md transition cursor-pointer ${
                    trendMode === 'cumulative'
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  ยอดสะสมรวม
                </button>
              </div>

              {/* Today vs Yesterday Box */}
              <div className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-[11px] flex items-center gap-2">
                <span className="text-slate-400">วันนี้:</span>
                <span className="font-mono font-bold text-slate-800">
                  {formatCurrency(todayAmount, false)} ฿
                </span>
                <span
                  className={`font-mono font-semibold ${
                    diffAmount >= 0 ? 'text-amber-600' : 'text-emerald-600'
                  }`}
                >
                  ({diffAmount >= 0 ? '+' : ''}{diffPercent.toFixed(0)}%)
                </span>
              </div>
            </div>
          </div>

          {/* Recharts Area + Composed Chart */}
          <div className="h-72 sm:h-80 w-full">
            {dailyData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={dailyData}
                  margin={{ top: 10, right: 10, left: 10, bottom: 20 }}
                >
                  <defs>
                    <linearGradient id="expenseAreaGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0D9488" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#0D9488" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                  <XAxis
                    dataKey="formattedDate"
                    tick={{ fontSize: 11, fill: '#64748B' }}
                    angle={-20}
                    textAnchor="end"
                    tickLine={false}
                    axisLine={{ stroke: '#E2E8F0' }}
                  />
                  <YAxis
                    yAxisId="amount"
                    tick={{ fontSize: 11, fill: '#64748B' }}
                    tickFormatter={(val) => (val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val)}
                    tickLine={false}
                    axisLine={{ stroke: '#E2E8F0' }}
                  />
                  <YAxis
                    yAxisId="count"
                    orientation="right"
                    tick={{ fontSize: 11, fill: '#0284C7' }}
                    allowDecimals={false}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend
                    wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }}
                    iconType="circle"
                  />
                  
                  {trendMode === 'daily' ? (
                    <>
                      <Area
                        yAxisId="amount"
                        type="monotone"
                        dataKey="amount"
                        name="ยอดเงิน (บาท)"
                        stroke="#0D9488"
                        strokeWidth={2.5}
                        fill="url(#expenseAreaGradient)"
                      />
                      <Bar
                        yAxisId="amount"
                        dataKey="approvedAmount"
                        name="อนุมัติแล้ว (บาท)"
                        fill="#12304A"
                        radius={[4, 4, 0, 0]}
                        barSize={18}
                        opacity={0.85}
                      />
                      <Line
                        yAxisId="count"
                        type="monotone"
                        dataKey="count"
                        name="จำนวนใบเสร็จ"
                        stroke="#0284C7"
                        strokeWidth={2}
                        dot={{ r: 3, fill: '#0284C7' }}
                      />
                    </>
                  ) : (
                    <>
                      <Area
                        yAxisId="amount"
                        type="monotone"
                        dataKey="cumulativeAmount"
                        name="ยอดสะสมทั้งหมด (บาท)"
                        stroke="#0D9488"
                        strokeWidth={3}
                        fill="url(#expenseAreaGradient)"
                      />
                      <Line
                        yAxisId="count"
                        type="monotone"
                        dataKey="count"
                        name="จำนวนใบเสร็จ"
                        stroke="#0284C7"
                        strokeWidth={2}
                        dot={{ r: 3, fill: '#0284C7' }}
                      />
                    </>
                  )}
                </ComposedChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-400 text-xs">
                ไม่มีข้อมูลค่าใช้จ่ายตามช่วงเวลาที่ระบุ
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB CONTENT 2: CATEGORY & PAYMENT BREAKDOWN */}
      {activeTab === 'category' && (
        <div className="p-4 sm:p-6 space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* Donut Chart (5 cols) */}
            <div className="lg:col-span-5 bg-slate-50/70 border border-slate-200/80 rounded-2xl p-5 flex flex-col items-center justify-between">
              <div className="w-full text-left mb-2">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <PieIcon className="w-4 h-4 text-teal-600" />
                  สัดส่วนตามหมวดหมู่ (Expense Categories)
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  จำแนกตามโครงสร้างหมวดหมู่บัญชี
                </p>
              </div>

              <div className="w-full h-64 relative flex items-center justify-center my-2">
                {categoryData.length > 0 ? (
                  <>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={categoryData}
                          cx="50%"
                          cy="50%"
                          innerRadius={65}
                          outerRadius={95}
                          paddingAngle={3}
                          dataKey="value"
                        >
                          {categoryData.map((_, index) => (
                            <Cell
                              key={`cell-${index}`}
                              fill={CATEGORY_COLORS[index % CATEGORY_COLORS.length]}
                              stroke="#ffffff"
                              strokeWidth={2}
                            />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(value: any) => [formatCurrency(Number(value)), 'มูลค่า']}
                          contentStyle={{
                            backgroundColor: '#0F172A',
                            color: '#fff',
                            borderRadius: '12px',
                            fontSize: '12px',
                            border: 'none',
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    {/* Centered Total Readout */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
                      <span className="text-[10px] text-slate-400 uppercase font-semibold">
                        ยอดรวม
                      </span>
                      <span className="text-sm sm:text-base font-extrabold font-mono text-slate-900">
                        {formatCurrency(totalExpense, false)}
                      </span>
                      <span className="text-[10px] text-slate-500">฿</span>
                    </div>
                  </>
                ) : (
                  <div className="text-slate-400 text-xs">ไม่มีข้อมูลหมวดหมู่</div>
                )}
              </div>

              <div className="w-full text-center text-[11px] text-slate-400 pt-2 border-t border-slate-200">
                รวมทั้งหมด {categoryData.length} หมวดหมู่ที่มีรายการ
              </div>
            </div>

            {/* Category Ranking List with Progress Bars (7 cols) */}
            <div className="lg:col-span-7 flex flex-col justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 mb-1">
                  ลำดับหมวดหมู่ค่าใช้จ่ายสูงสุด (Ranked Breakdown)
                </h3>
                <p className="text-xs text-slate-500 mb-3">
                  สัดส่วนและยอดค่าใช้จ่ายเรียงจากมากไปน้อย
                </p>

                <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                  {categoryData.map((cat, i) => {
                    const color = CATEGORY_COLORS[i % CATEGORY_COLORS.length];
                    return (
                      <div
                        key={cat.id}
                        className="bg-white border border-slate-200/80 hover:border-slate-300 rounded-xl p-3 transition shadow-2xs"
                      >
                        <div className="flex items-center justify-between text-xs mb-1.5">
                          <div className="flex items-center gap-2 min-w-0">
                            <span
                              className="w-3 h-3 rounded-full shrink-0 shadow-2xs"
                              style={{ backgroundColor: color }}
                            />
                            <span className="font-bold text-slate-800 truncate" title={cat.name}>
                              {cat.name}
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono">
                              ({cat.count} ใบ)
                            </span>
                          </div>
                          <div className="text-right shrink-0 font-mono">
                            <span className="font-bold text-slate-900 text-sm">
                              {formatCurrency(cat.value)}
                            </span>
                          </div>
                        </div>

                        {/* Progress Bar */}
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-slate-100 h-1.5 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-300"
                              style={{
                                width: `${Math.min(100, Math.max(cat.percent, 3))}%`,
                                backgroundColor: color,
                              }}
                            />
                          </div>
                          <span className="text-[10px] font-bold text-slate-600 font-mono w-10 text-right">
                            {cat.percent}%
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Payment Methods Breakdown mini-strip */}
              <div className="mt-4 pt-3 border-t border-slate-100">
                <span className="text-[11px] font-bold text-slate-600 block mb-2">
                  ช่องทางการชำระเงิน (Payment Methods):
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  {paymentMethodData.map((pm, i) => (
                    <div key={i} className="bg-slate-50 p-2 rounded-lg border border-slate-200">
                      <span className="text-[10px] text-slate-400 block truncate">{pm.name}</span>
                      <span className="font-mono font-bold text-slate-800 text-xs block mt-0.5">
                        {formatCurrency(pm.amount, false)} ฿
                      </span>
                      <span className="text-[10px] text-slate-500">{pm.count} ใบ</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* TAB CONTENT 3: PROJECT BUDGETS & UTILIZATION */}
      {activeTab === 'projects' && (
        <div className="p-4 sm:p-6 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <FolderKanban className="w-4 h-4 text-teal-600" />
                การใช้งบประมาณรายโครงการ (Project Budget vs Actual Spent)
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                เปรียบเทียบยอดค่าใช้จ่ายที่เกิดขึ้นจริงกับกรอบงบประมาณที่ตั้งไว้ของแต่ละโครงการ
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {projectSummaries.length > 0 ? (
              projectSummaries.map((p) => {
                const projectBudget = p.budget || 0;
                const isOverBudget = projectBudget > 0 && p.totalSpent > projectBudget;
                const isNearBudget = projectBudget > 0 && p.percentUsed >= 80 && !isOverBudget;

                return (
                  <div
                    key={p.projectId}
                    className="bg-white border border-slate-200/90 hover:border-slate-300 rounded-xl p-4 transition shadow-2xs hover:shadow-xs"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2 text-xs">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900 text-sm">{p.projectCode}</span>
                          <span className="text-slate-600 font-medium">{p.clientName}</span>
                          {p.status === 'completed' && (
                            <span className="text-[10px] px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-semibold">
                              ปิดโครงการแล้ว
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] text-slate-400 mt-0.5 block">
                          บันทึกแล้ว {p.receiptsCount} ใบเสร็จ · อนุมัติแล้ว {formatCurrency(p.approvedSpent)}
                        </span>
                      </div>

                      <div className="text-right sm:shrink-0 font-mono">
                        <span className="text-[11px] text-slate-400 block font-sans">
                          ยอดค่าใช้จ่ายจริง:
                        </span>
                        <span className="font-bold text-slate-900 text-base">
                          {formatCurrency(p.totalSpent)}
                        </span>
                        {projectBudget > 0 && (
                          <span className="text-[11px] text-slate-400 block">
                            จากงบ {formatCurrency(projectBudget)}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Budget Progress Bar */}
                    {projectBudget > 0 ? (
                      <div className="space-y-1.5 pt-1">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-slate-500">
                            คงเหลือ:{' '}
                            <strong className={isOverBudget ? 'text-rose-600' : 'text-emerald-700'}>
                              {formatCurrency(p.remaining)}
                            </strong>
                          </span>
                          <span
                            className={`font-mono font-bold ${
                              isOverBudget
                                ? 'text-rose-700'
                                : isNearBudget
                                ? 'text-amber-700'
                                : 'text-teal-700'
                            }`}
                          >
                            ใช้น้ำหนักงบไปแล้ว {p.percentUsed}%
                          </span>
                        </div>
                        <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${
                              isOverBudget
                                ? 'bg-rose-500'
                                : isNearBudget
                                ? 'bg-amber-500'
                                : 'bg-gradient-to-r from-teal-500 to-teal-600'
                            }`}
                            style={{ width: `${Math.min(100, Math.max(p.percentUsed, 2))}%` }}
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="text-[11px] text-slate-400 pt-1">
                        * ไม่ได้กำหนดกรอบงบประมาณเริ่มต้นไว้
                      </div>
                    )}
                  </div>
                );
              })
            ) : (
              <div className="text-center py-8 text-slate-400 text-xs">
                ไม่มีข้อมูลโครงการในระบบ
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB CONTENT 4: TEAM PERFORMANCE (ADMIN) */}
      {isAdmin && activeTab === 'team' && (
        <div className="p-4 sm:p-6 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-teal-600" />
                ประสิทธิภาพและการบันทึกงานของทีมงาน (Team Activity & Performance)
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                เฉพาะ Master Admin · ติดตามยอดการบันทึกเอกสารและรายการรออนุมัติรายบุคคล
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3">ผู้ใช้งาน</th>
                  <th className="py-2.5 px-3">อีเมล</th>
                  <th className="py-2.5 px-3 text-right">จำนวนใบเสร็จ</th>
                  <th className="py-2.5 px-3 text-right">ยอดค่าใช้จ่ายที่บันทึก</th>
                  <th className="py-2.5 px-3">บันทึกล่าสุด</th>
                  <th className="py-2.5 px-3 text-center">รอตรวจสอบ</th>
                  <th className="py-2.5 px-3 text-center">ต้องแก้ไข OCR</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {userActivities.map((u) => (
                  <tr key={u.uid} className="hover:bg-slate-50/70 transition">
                    <td className="py-3 px-3 font-bold text-slate-900">{u.name}</td>
                    <td className="py-3 px-3 text-slate-500 font-mono">{u.email}</td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums font-semibold text-slate-800">
                      {u.receiptsCount} ใบ
                    </td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums font-bold text-teal-700">
                      {formatCurrency(u.totalAmount)}
                    </td>
                    <td className="py-3 px-3 text-slate-500">
                      {u.lastDate !== '-' ? formatThaiDate(u.lastDate) : '-'}
                    </td>
                    <td className="py-3 px-3 text-center">
                      {u.pendingCount > 0 ? (
                        <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-mono font-bold text-[10px]">
                          {u.pendingCount}
                        </span>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-center">
                      {u.needsReviewCount > 0 ? (
                        <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 font-mono font-bold text-[10px]">
                          {u.needsReviewCount}
                        </span>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  );
};
