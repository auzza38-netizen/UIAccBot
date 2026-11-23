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
} from 'recharts';
import { Receipt, Project, ExpenseCategory, AppUser } from '../types';
import { formatCurrency, formatThaiDate } from '../utils/formatters';
import {
  TrendingUp,
  PieChart as PieIcon,
  FolderKanban,
  UserCheck,
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
  '#0F766E',
  '#0284C7',
  '#334155',
  '#4F46E5',
  '#0EA5E9',
  '#D97706',
  '#059669',
  '#64748B',
  '#E11D48',
  '#14B8A6',
];

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-slate-900 border border-slate-700 text-white p-3 rounded-lg shadow-lg text-xs space-y-1.5 min-w-[180px]">
        <p className="font-semibold text-slate-300 border-b border-slate-700/80 pb-1 mb-1">
          {label}
        </p>
        {payload.map((entry: any, index: number) => {
          const isCount = entry.name.includes('จำนวน') || entry.dataKey === 'count';
          return (
            <div key={`item-${index}`} className="flex items-center justify-between gap-3">
              <span className="text-slate-300">{entry.name}</span>
              <span className="font-mono font-semibold text-white tabular-nums">
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
  const [activeTab, setActiveTab] = useState<'trend' | 'category' | 'projects' | 'team'>('trend');
  const [trendMode, setTrendMode] = useState<'daily' | 'cumulative'>('daily');

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

  const { todayAmount, diffAmount, diffPercent } = useMemo(() => {
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
    return { todayAmount: t, diffAmount: diff, diffPercent: pct };
  }, [receipts, groupByDateKey]);

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

  const projectSummaries = useMemo(() => {
    return projects
      .map((p) => {
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
      })
      .sort((a, b) => b.totalSpent - a.totalSpent);
  }, [projects, receipts]);

  const userActivities = useMemo(() => {
    if (!isAdmin) return [];

    return users
      .map((u) => {
        const uEmail = (u.email || '').trim().toLowerCase();
        const uReceipts = receipts.filter((r) => {
          const rEmail = (r.uploadedByEmail || '').trim().toLowerCase();
          if (rEmail) {
            return rEmail === uEmail;
          }
          return r.uploadedBy === u.uid;
        });
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
      })
      .sort((a, b) => b.totalAmount - a.totalAmount);
  }, [users, receipts, isAdmin]);

  const topCategory = categoryData[0];
  const topProject = projectSummaries[0];
  const totalExpense = receipts.reduce((sum, r) => sum + (r.grandTotal || 0), 0);

  return (
    <div className="bg-white border border-slate-200/80 rounded-xl overflow-hidden">
      {/* Section Header & Segmented Tabs */}
      <div className="p-4 sm:p-5 border-b border-slate-200/80">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-base font-bold text-slate-900 tracking-tight">
              วิเคราะห์กระแสค่าใช้จ่ายและสัดส่วนบัญชี
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              ติดตามแนวโน้มรายวัน สัดส่วนตามหมวดหมู่ การใช้งบประมาณโครงการ และประสิทธิภาพทีมงาน
            </p>
          </div>

          <div className="flex items-center bg-slate-100/80 p-1 rounded-lg text-xs font-medium overflow-x-auto scrollbar-none shrink-0">
            <button
              onClick={() => setActiveTab('trend')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                activeTab === 'trend'
                  ? 'bg-white text-slate-900 font-semibold shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <TrendingUp className="w-3.5 h-3.5 text-teal-700" />
              <span>แนวโน้มค่าใช้จ่าย</span>
            </button>

            <button
              onClick={() => setActiveTab('category')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                activeTab === 'category'
                  ? 'bg-white text-slate-900 font-semibold shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <PieIcon className="w-3.5 h-3.5 text-sky-600" />
              <span>สัดส่วนหมวดหมู่</span>
            </button>

            <button
              onClick={() => setActiveTab('projects')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                activeTab === 'projects'
                  ? 'bg-white text-slate-900 font-semibold shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FolderKanban className="w-3.5 h-3.5 text-slate-700" />
              <span>งบโครงการ ({projects.length})</span>
            </button>

            {isAdmin && (
              <button
                onClick={() => setActiveTab('team')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  activeTab === 'team'
                    ? 'bg-white text-slate-900 font-semibold shadow-2xs'
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

      {/* Unboxed Highlight Summary Strip */}
      <div className="bg-slate-50/50 px-4 sm:px-5 py-2.5 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          {topCategory && (
            <span>
              หมวดหมู่สูงสุด:{' '}
              <strong className="font-semibold text-slate-900">{topCategory.name}</strong>{' '}
              <span className="font-mono tabular-nums text-teal-700 font-semibold">
                ({topCategory.percent}% · {formatCurrency(topCategory.value)})
              </span>
            </span>
          )}

          {topCategory && topProject && (
            <span aria-hidden="true" className="text-slate-300 hidden sm:inline">·</span>
          )}

          {topProject && (
            <span>
              โครงการยอดสูงสุด:{' '}
              <strong className="font-semibold text-slate-900">{topProject.projectCode}</strong>{' '}
              <span className="font-mono tabular-nums text-slate-700 font-semibold">
                ({formatCurrency(topProject.totalSpent)})
              </span>
            </span>
          )}
        </div>

        <div className="text-[11px] text-slate-500">
          อ้างอิงตาม:{' '}
          <span className="font-semibold text-slate-700">
            {groupByDateKey === 'uploadDate' ? 'วันที่บันทึกระบบ' : 'วันที่ในเอกสาร'}
          </span>
        </div>
      </div>

      {/* TAB 1: TREND ANALYTICS */}
      {activeTab === 'trend' && (
        <div className="p-4 sm:p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                แนวโน้มค่าใช้จ่ายและปริมาณเอกสาร
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                แกนซ้ายแสดงมูลค่า (บาท) และแกนขวาแสดงจำนวนใบเสร็จ
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center bg-slate-100/80 p-1 rounded-lg text-xs font-medium">
                <button
                  onClick={() => setTrendMode('daily')}
                  className={`px-3 py-1 rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                    trendMode === 'daily'
                      ? 'bg-white text-slate-900 font-semibold shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  รายวัน
                </button>
                <button
                  onClick={() => setTrendMode('cumulative')}
                  className={`px-3 py-1 rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                    trendMode === 'cumulative'
                      ? 'bg-white text-slate-900 font-semibold shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  ยอดสะสมรวม
                </button>
              </div>

              <div className="text-xs text-slate-600 flex items-center gap-1.5">
                <span className="text-slate-400">วันนี้</span>
                <span className="font-mono font-semibold text-slate-900 tabular-nums">
                  {formatCurrency(todayAmount, false)} ฿
                </span>
                <span
                  className={`font-mono font-semibold tabular-nums ${
                    diffAmount >= 0 ? 'text-amber-700' : 'text-emerald-700'
                  }`}
                >
                  ({diffAmount >= 0 ? '+' : ''}
                  {diffPercent.toFixed(0)}%)
                </span>
              </div>
            </div>
          </div>

          <div className="h-72 sm:h-80 w-full">
            {dailyData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={dailyData}
                  margin={{ top: 10, right: 10, left: 10, bottom: 20 }}
                >
                  <defs>
                    <linearGradient id="expenseAreaGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0F766E" stopOpacity={0.18} />
                      <stop offset="95%" stopColor="#0F766E" stopOpacity={0.0} />
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
                  <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} iconType="circle" />

                  {trendMode === 'daily' ? (
                    <>
                      <Area
                        yAxisId="amount"
                        type="monotone"
                        dataKey="amount"
                        name="ยอดเงิน (บาท)"
                        stroke="#0F766E"
                        strokeWidth={2.25}
                        fill="url(#expenseAreaGradient)"
                      />
                      <Bar
                        yAxisId="amount"
                        dataKey="approvedAmount"
                        name="อนุมัติแล้ว (บาท)"
                        fill="#0F172A"
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
                        stroke="#0F766E"
                        strokeWidth={2.5}
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

      {/* TAB 2: CATEGORY & PAYMENT BREAKDOWN (Whitespace & Hairline Dividers, Zero Nested Cards) */}
      {activeTab === 'category' && (
        <div>
          <div className="grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-slate-200/80">
            {/* Donut Chart (5 cols) */}
            <div className="lg:col-span-5 p-5 sm:p-6 flex flex-col items-center justify-between">
              <div className="w-full text-left">
                <h3 className="text-sm font-semibold text-slate-900">
                  สัดส่วนตามหมวดหมู่บัญชี
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  จำแนกตามโครงสร้างผังบัญชีค่าใช้จ่าย
                </p>
              </div>

              <div className="w-full h-64 relative flex items-center justify-center my-3">
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
                            borderRadius: '8px',
                            fontSize: '12px',
                            border: 'none',
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
                      <span className="text-[11px] text-slate-400 font-medium">ยอดรวม</span>
                      <span className="text-base font-bold font-mono tabular-nums text-slate-900">
                        {formatCurrency(totalExpense, false)}
                      </span>
                      <span className="text-[10px] text-slate-500">บาท</span>
                    </div>
                  </>
                ) : (
                  <div className="text-slate-400 text-xs">ไม่มีข้อมูลหมวดหมู่</div>
                )}
              </div>

              <div className="w-full text-center text-xs text-slate-500 pt-3 border-t border-slate-100">
                รวม {categoryData.length} หมวดหมู่ที่มีรายการ
              </div>
            </div>

            {/* Ranked List (7 cols) */}
            <div className="lg:col-span-7 p-5 sm:p-6 flex flex-col justify-between">
              <div>
                <h3 className="text-sm font-semibold text-slate-900 mb-0.5">
                  ลำดับหมวดหมู่ค่าใช้จ่ายสูงสุด
                </h3>
                <p className="text-xs text-slate-500 mb-3">
                  สัดส่วนและยอดค่าใช้จ่ายเรียงจากมากไปน้อย
                </p>

                <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto">
                  {categoryData.map((cat, i) => {
                    const color = CATEGORY_COLORS[i % CATEGORY_COLORS.length];
                    return (
                      <div key={cat.id} className="py-3 first:pt-1 last:pb-1">
                        <div className="flex items-center justify-between text-xs mb-1.5">
                          <div className="flex items-center gap-2 min-w-0">
                            <span
                              className="w-1 h-3.5 rounded-full shrink-0"
                              style={{ backgroundColor: color }}
                            />
                            <span className="font-semibold text-slate-900 truncate" title={cat.name}>
                              {cat.name}
                            </span>
                            <span className="text-[11px] text-slate-400 font-mono tabular-nums">
                              · {cat.count} ใบ
                            </span>
                          </div>
                          <span className="font-mono font-semibold text-slate-900 tabular-nums shrink-0">
                            {formatCurrency(cat.value)}
                          </span>
                        </div>

                        <div className="flex items-center gap-3">
                          <div className="flex-1 bg-slate-100 h-1.5 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-300"
                              style={{
                                width: `${Math.min(100, Math.max(cat.percent, 3))}%`,
                                backgroundColor: color,
                              }}
                            />
                          </div>
                          <span className="text-[11px] font-semibold text-slate-600 font-mono tabular-nums w-11 text-right">
                            {cat.percent}%
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Payment Method Strip (Divided Horizontal Band) */}
          {paymentMethodData.length > 0 && (
            <div className="border-t border-slate-200/80 bg-slate-50/40">
              <div className="px-5 py-2.5 border-b border-slate-100 text-[11px] font-semibold text-slate-500">
                แยกตามช่องทางการชำระเงิน
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-200/80 text-xs">
                {paymentMethodData.map((pm, i) => (
                  <div key={i} className="px-5 py-3.5">
                    <span className="text-[11px] text-slate-500 block truncate">{pm.name}</span>
                    <span className="font-mono font-semibold text-slate-900 tabular-nums text-sm block mt-0.5">
                      {formatCurrency(pm.amount, false)} ฿
                    </span>
                    <span className="text-[11px] text-slate-400 font-mono tabular-nums">
                      {pm.count} ใบ
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: PROJECT BUDGETS & UTILIZATION */}
      {activeTab === 'projects' && (
        <div className="p-4 sm:p-6 space-y-4">
          <div className="pb-2 border-b border-slate-100">
            <h3 className="text-sm font-semibold text-slate-900">
              การใช้งบประมาณรายโครงการ
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              เปรียบเทียบยอดค่าใช้จ่ายที่เกิดขึ้นจริงกับกรอบงบประมาณของแต่ละโครงการ
            </p>
          </div>

          <div className="divide-y divide-slate-100">
            {projectSummaries.length > 0 ? (
              projectSummaries.map((p) => {
                const projectBudget = p.budget || 0;
                const isOverBudget = projectBudget > 0 && p.totalSpent > projectBudget;
                const isNearBudget = projectBudget > 0 && p.percentUsed >= 80 && !isOverBudget;

                return (
                  <div key={p.projectId} className="py-4 first:pt-1 last:pb-1">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2 text-xs">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono font-semibold text-teal-800 text-sm">
                            {p.projectCode}
                          </span>
                          <span className="text-slate-800 font-medium">{p.clientName}</span>
                          {p.status === 'completed' && (
                            <span className="text-[11px] text-slate-500">· ปิดโครงการแล้ว</span>
                          )}
                        </div>
                        <span className="text-[11px] text-slate-500 mt-0.5 block">
                          บันทึกแล้ว {p.receiptsCount} ใบเสร็จ · อนุมัติแล้ว {formatCurrency(p.approvedSpent)}
                        </span>
                      </div>

                      <div className="sm:text-right sm:shrink-0 font-mono tabular-nums">
                        <span className="font-semibold text-slate-900 text-base block">
                          {formatCurrency(p.totalSpent)}
                        </span>
                        {projectBudget > 0 && (
                          <span className="text-[11px] text-slate-500 block">
                            จากงบ {formatCurrency(projectBudget)}
                          </span>
                        )}
                      </div>
                    </div>

                    {projectBudget > 0 ? (
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-slate-500">
                            คงเหลือ{' '}
                            <strong
                              className={`font-mono tabular-nums ${
                                isOverBudget ? 'text-rose-600' : 'text-emerald-700'
                              }`}
                            >
                              {formatCurrency(p.remaining)}
                            </strong>
                          </span>
                          <span
                            className={`font-mono font-semibold tabular-nums ${
                              isOverBudget
                                ? 'text-rose-700'
                                : isNearBudget
                                ? 'text-amber-700'
                                : 'text-teal-700'
                            }`}
                          >
                            ใช้ไป {p.percentUsed}%
                          </span>
                        </div>
                        <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-300 ${
                              isOverBudget
                                ? 'bg-rose-500'
                                : isNearBudget
                                ? 'bg-amber-500'
                                : 'bg-[#0F766E]'
                            }`}
                            style={{ width: `${Math.min(100, Math.max(p.percentUsed, 2))}%` }}
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="text-[11px] text-slate-400">
                        ไม่ได้กำหนดกรอบงบประมาณเริ่มต้น
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

      {/* TAB 4: TEAM PERFORMANCE (ADMIN) */}
      {isAdmin && activeTab === 'team' && (
        <div className="p-4 sm:p-6 space-y-4">
          <div className="pb-2 border-b border-slate-100">
            <h3 className="text-sm font-semibold text-slate-900">
              สถิติการบันทึกงานของทีมงาน
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              ติดตามจำนวนใบเสร็จ ยอดรวม และรายการรออนุมัติรายบุคคล
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 text-slate-500 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-4">ผู้ใช้งาน</th>
                  <th className="py-2.5 px-4">อีเมล</th>
                  <th className="py-2.5 px-4 text-right">จำนวนใบเสร็จ</th>
                  <th className="py-2.5 px-4 text-right">ยอดค่าใช้จ่าย</th>
                  <th className="py-2.5 px-4">บันทึกล่าสุด</th>
                  <th className="py-2.5 px-4 text-center">รออนุมัติ</th>
                  <th className="py-2.5 px-4 text-center">ต้องตรวจ OCR</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {userActivities.map((u) => (
                  <tr key={u.uid} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4 font-semibold text-slate-900">{u.name}</td>
                    <td className="py-3 px-4 text-slate-500 font-mono">{u.email}</td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums font-medium text-slate-800">
                      {u.receiptsCount} ใบ
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-teal-700">
                      {formatCurrency(u.totalAmount)}
                    </td>
                    <td className="py-3 px-4 text-slate-500">
                      {u.lastDate !== '-' ? formatThaiDate(u.lastDate) : '-'}
                    </td>
                    <td className="py-3 px-4 text-center font-mono tabular-nums">
                      {u.pendingCount > 0 ? (
                        <span className="font-semibold text-amber-700">{u.pendingCount}</span>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center font-mono tabular-nums">
                      {u.needsReviewCount > 0 ? (
                        <span className="font-semibold text-rose-700">{u.needsReviewCount}</span>
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
