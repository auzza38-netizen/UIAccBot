import React, { useState, useMemo } from 'react';
import { useData } from '../context/DataContext';
import {
  Landmark,
  Building2,
  Wallet,
  FileSpreadsheet,
  ArrowUpRight,
  ArrowDownLeft,
  ChevronRight,
  Plus,
  Coins,
  TrendingUp,
  Layers,
  Sparkles,
  CreditCard,
  CheckCircle2,
  Filter,
  FolderKanban,
} from 'lucide-react';
import { formatCurrency, formatThaiDate } from '../utils/formatters';
import { THAI_BANKS, ASSET_TYPES, getProjectDisplayName } from './CurrentAssetsPage';
import { BankAccount } from '../types';

interface CurrentAssetsSummaryWidgetProps {
  onNavigateToAssets: (accountId?: string) => void;
}

export const CurrentAssetsSummaryWidget: React.FC<CurrentAssetsSummaryWidgetProps> = ({
  onNavigateToAssets,
}) => {
  const { bankAccounts, statementRecords, projects, projectsMap, saveBankAccount } = useData();

  const [selectedProjectFilter, setSelectedProjectFilter] = useState<string>('all');
  const [selectedBankFilter, setSelectedBankFilter] = useState<string>('all');
  const [searchAccountQuery, setSearchAccountQuery] = useState<string>('');
  const [isCreatingSample, setIsCreatingSample] = useState<boolean>(false);

  // Filter accounts by project scope
  const scopedAccounts = useMemo(() => {
    return bankAccounts.filter((acc) => {
      if (selectedProjectFilter === 'all') return true;
      if (selectedProjectFilter === 'general') return !acc.projectId;
      return acc.projectId === selectedProjectFilter;
    });
  }, [bankAccounts, selectedProjectFilter]);

  const scopedAccountIds = useMemo(() => new Set(scopedAccounts.map((a) => a.id)), [scopedAccounts]);

  // Filter statements by project scope
  const scopedStatements = useMemo(() => {
    return statementRecords.filter((st) => {
      if (selectedProjectFilter === 'all') return true;
      if (selectedProjectFilter === 'general') {
        return !st.projectId && (!st.accountId || scopedAccountIds.has(st.accountId));
      }
      return st.projectId === selectedProjectFilter || (st.accountId && scopedAccountIds.has(st.accountId));
    });
  }, [statementRecords, selectedProjectFilter, scopedAccountIds]);

  // 1. Calculate overall metrics for scoped project
  const totalBalance = useMemo(() => {
    return scopedAccounts.reduce((sum, acc) => sum + (Number(acc.currentBalance) || 0), 0);
  }, [scopedAccounts]);

  const totalTransactionsCount = useMemo(() => {
    return scopedStatements.reduce((sum, s) => {
      const txs = s.transactions || [];
      if (selectedProjectFilter === 'all') return sum + txs.length;
      if (selectedProjectFilter === 'general') {
        return sum + txs.filter((t) => !t.projectId && (!s.projectId || s.projectId === '')).length;
      }
      return sum + txs.filter((t) => t.projectId === selectedProjectFilter || s.projectId === selectedProjectFilter).length;
    }, 0);
  }, [scopedStatements, selectedProjectFilter]);

  const totalStatementsCount = scopedStatements.length;

  const totalCreditInflow = useMemo(() => {
    return scopedStatements.reduce((sum, s) => sum + (Number(s.totalCredit) || 0), 0);
  }, [scopedStatements]);

  const totalDebitOutflow = useMemo(() => {
    return scopedStatements.reduce((sum, s) => sum + (Number(s.totalDebit) || 0), 0);
  }, [scopedStatements]);

  // 2. Group accounts and statements by Bank
  const bankBreakdowns = useMemo(() => {
    const map = new Map<
      string,
      {
        bankCode: string;
        bankName: string;
        color: string;
        textColor: string;
        accountsCount: number;
        totalBalance: number;
        transactionsCount: number;
        statementsCount: number;
        accountIds: string[];
      }
    >();

    scopedAccounts.forEach((acc) => {
      const code = acc.bankCode || 'OTHER';
      const meta = THAI_BANKS.find((b) => b.code === code) || {
        code: 'OTHER',
        name: acc.bankName || 'สถาบันการเงินอื่น ๆ',
        color: '#475569',
        textColor: '#ffffff',
      };

      const existing = map.get(code) || {
        bankCode: code,
        bankName: acc.bankName || meta.name,
        color: meta.color,
        textColor: meta.textColor,
        accountsCount: 0,
        totalBalance: 0,
        transactionsCount: 0,
        statementsCount: 0,
        accountIds: [],
      };

      existing.accountsCount += 1;
      existing.totalBalance += Number(acc.currentBalance) || 0;
      existing.accountIds.push(acc.id);
      map.set(code, existing);
    });

    // Add transaction and statement counts to the bank groups
    scopedStatements.forEach((st) => {
      for (const [code, group] of map.entries()) {
        if (group.accountIds.includes(st.accountId)) {
          group.transactionsCount += st.transactions?.length || 0;
          group.statementsCount += 1;
          break;
        }
      }
    });

    return Array.from(map.values()).sort((a, b) => b.totalBalance - a.totalBalance);
  }, [scopedAccounts, scopedStatements]);

  // 3. Map account-level statement stats
  const accountStatsMap = useMemo(() => {
    const map = new Map<
      string,
      {
        txCount: number;
        stmtCount: number;
        totalCredit: number;
        totalDebit: number;
        lastDate?: string;
      }
    >();

    scopedStatements.forEach((st) => {
      const existing = map.get(st.accountId) || {
        txCount: 0,
        stmtCount: 0,
        totalCredit: 0,
        totalDebit: 0,
        lastDate: undefined,
      };

      existing.txCount += st.transactions?.length || 0;
      existing.stmtCount += 1;
      existing.totalCredit += Number(st.totalCredit) || 0;
      existing.totalDebit += Number(st.totalDebit) || 0;

      if (st.statementPeriodEnd && (!existing.lastDate || st.statementPeriodEnd > existing.lastDate)) {
        existing.lastDate = st.statementPeriodEnd;
      }

      map.set(st.accountId, existing);
    });

    return map;
  }, [scopedStatements]);

  // 4. Filtered Accounts list
  const filteredAccounts = useMemo(() => {
    return scopedAccounts.filter((acc) => {
      if (selectedBankFilter !== 'all' && (acc.bankCode || 'OTHER') !== selectedBankFilter) {
        return false;
      }
      if (searchAccountQuery.trim()) {
        const q = searchAccountQuery.toLowerCase();
        const matchNum = acc.accountNumber?.toLowerCase().includes(q);
        const matchBank = acc.bankName?.toLowerCase().includes(q);
        const matchName = acc.accountName?.toLowerCase().includes(q);
        const projNameStr = acc.projectId
          ? getProjectDisplayName(projectsMap[acc.projectId], acc.projectName)
          : (acc.projectName || '');
        const matchProj = projNameStr.toLowerCase().includes(q);
        return matchNum || matchBank || matchName || matchProj;
      }
      return true;
    });
  }, [scopedAccounts, selectedBankFilter, searchAccountQuery, projectsMap]);

  // Sample data seeder with Project assignment
  const handleCreateSampleAccounts = async () => {
    if (isCreatingSample) return;
    setIsCreatingSample(true);
    try {
      const proj1 = projects[0];
      const proj2 = projects[1] || projects[0];
      const proj1Name = proj1 ? getProjectDisplayName(proj1) : '';
      const proj2Name = proj2 ? getProjectDisplayName(proj2) : '';

      const sample1: Partial<BankAccount> = {
        accountNumber: '089-2-34567-8',
        bankName: 'ธนาคารกสิกรไทย',
        bankCode: 'KBANK',
        accountName: `บจก. โปรเกรสซีฟ แอคเคาท์ติ้ง ${proj1 ? `(${proj1Name})` : '(บัญชีดำเนินงาน)'}`,
        branchName: 'สาขาสยามพารากอน',
        assetType: 'current',
        currentBalance: 750000,
        availableBalance: 750000,
        projectId: proj1 ? proj1.projectId : undefined,
        projectName: proj1 ? proj1Name : undefined,
        currency: 'THB',
        lastUpdatedDate: new Date().toISOString().slice(0, 10),
        notes: proj1 ? `บัญชีประจำโครงการ: ${proj1Name}` : 'บัญชีหลักสำหรับดำเนินงาน',
      };

      const sample2: Partial<BankAccount> = {
        accountNumber: '142-3-88990-1',
        bankName: 'ธนาคารไทยพาณิชย์',
        bankCode: 'SCB',
        accountName: `บจก. โปรเกรสซีฟ แอคเคาท์ติ้ง ${proj2 ? `(${proj2Name})` : '(สำรองจ่าย)'}`,
        branchName: 'สาขาอโศก',
        assetType: 'savings',
        currentBalance: 420000,
        availableBalance: 420000,
        projectId: proj2 ? proj2.projectId : undefined,
        projectName: proj2 ? proj2Name : undefined,
        currency: 'THB',
        lastUpdatedDate: new Date().toISOString().slice(0, 10),
        notes: proj2 ? `บัญชีประจำโครงการ: ${proj2Name}` : 'บัญชีสำรองจ่ายค่าวัสดุและอุปกรณ์',
      };

      const sample3: Partial<BankAccount> = {
        accountNumber: 'CASH-001',
        bankName: 'เงินสดในมือ / เงินสดย่อย',
        bankCode: 'CASH',
        accountName: 'เงินสดย่อยสำนักงานใหญ่ (ส่วนกลาง)',
        branchName: 'สำนักงานใหญ่',
        assetType: 'petty_cash',
        currentBalance: 35000,
        availableBalance: 35000,
        currency: 'THB',
        lastUpdatedDate: new Date().toISOString().slice(0, 10),
        notes: 'วงเงินสดย่อยส่วนกลางสำหรับค่าใช้จ่ายเบ็ดเตล็ดประจำวัน',
      };

      await saveBankAccount(sample1);
      await saveBankAccount(sample2);
      await saveBankAccount(sample3);
    } catch (err) {
      console.error('Error seeding sample accounts:', err);
    } finally {
      setIsCreatingSample(false);
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
      {/* Top Banner / Widget Header */}
      <div className="p-4 sm:p-5 border-b border-slate-100 bg-gradient-to-r from-slate-900 via-[#12304A] to-slate-800 text-white">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="p-1.5 bg-teal-500/20 text-teal-300 rounded-lg">
                <Landmark className="w-4 h-4" />
              </span>
              <span className="text-[11px] font-bold text-teal-300 uppercase tracking-wider">
                ภาพรวมสินทรัพย์หมุนเวียน (Current Assets)
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-slate-200 font-mono">
                {scopedAccounts.length} บัญชี · {bankBreakdowns.length} ธนาคาร
              </span>
            </div>
            <h2 className="text-base sm:text-lg font-bold text-white">
              สรุปยอดเงินฝากธนาคาร & รายการเดินบัญชี (แยกตามโครงการ)
            </h2>
            <p className="text-xs text-slate-300 max-w-2xl">
              รายงานสภาพคล่องรวม จำแนกตามสถาบันการเงิน และสามารถเลือกกรองดูสินทรัพย์และรายการเดินบัญชีของแต่ละโครงการแยกกันได้
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            {/* Project Filter Dropdown in Header */}
            <div className="flex items-center gap-1.5 bg-white/10 px-3 py-1.5 rounded-xl border border-white/20 text-xs shadow-2xs">
              <FolderKanban className="w-3.5 h-3.5 text-teal-300 shrink-0" />
              <span className="text-[11px] text-teal-200 font-semibold shrink-0">โครงการ:</span>
              <select
                value={selectedProjectFilter}
                onChange={(e) => setSelectedProjectFilter(e.target.value)}
                className="bg-transparent text-white font-semibold text-xs focus:outline-none cursor-pointer max-w-[160px] truncate"
              >
                <option value="all" className="bg-slate-900 text-white">
                  ทุกโครงการ ({bankAccounts.length})
                </option>
                <option value="general" className="bg-slate-900 text-white">
                  ส่วนกลาง / ไม่ระบุ ({bankAccounts.filter((b) => !b.projectId).length})
                </option>
                {projects.map((p) => {
                  const count = bankAccounts.filter((b) => b.projectId === p.projectId).length;
                  return (
                    <option key={p.projectId} value={p.projectId} className="bg-slate-900 text-white">
                      {getProjectDisplayName(p)} ({count})
                    </option>
                  );
                })}
              </select>
            </div>

            <button
              onClick={() => onNavigateToAssets()}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-[#0D9488] hover:bg-teal-500 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer active:scale-95"
            >
              <span>จัดการสินทรัพย์ & Statement</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 4 Summary KPIs in Header */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-4 pt-4 border-t border-white/10">
          <div className="bg-white/5 border border-white/10 rounded-xl p-3">
            <span className="text-[11px] text-slate-300 block">ยอดสินทรัพย์หมุนเวียนสุทธิ</span>
            <div className="text-lg sm:text-xl font-bold font-mono text-teal-300 mt-0.5">
              {formatCurrency(totalBalance)}
            </div>
            <span className="text-[10px] text-slate-400">
              {selectedProjectFilter === 'all'
                ? 'จากทุกบัญชีและทุกโครงการ'
                : selectedProjectFilter === 'general'
                ? 'เฉพาะบัญชีส่วนกลาง'
                : `ของโครงการ: ${getProjectDisplayName(projectsMap[selectedProjectFilter], 'โครงการ')}`}
            </span>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-xl p-3">
            <span className="text-[11px] text-slate-300 block">รายการเดินบัญชีที่บันทึกไว้</span>
            <div className="text-lg sm:text-xl font-bold font-mono text-white mt-0.5 flex items-center gap-1.5">
              <span>{totalTransactionsCount.toLocaleString()}</span>
              <span className="text-xs font-sans text-slate-300 font-normal">รายการ</span>
            </div>
            <span className="text-[10px] text-slate-400">
              นำเข้าจาก {totalStatementsCount} ไฟล์ Statement
            </span>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-xl p-3">
            <span className="text-[11px] text-emerald-300 block flex items-center gap-1">
              <ArrowDownLeft className="w-3.5 h-3.5" /> เงินเข้ารวม (Credit)
            </span>
            <div className="text-base sm:text-lg font-bold font-mono text-emerald-300 mt-0.5">
              +{formatCurrency(totalCreditInflow)}
            </div>
            <span className="text-[10px] text-slate-400">ตามรายการใน Statement</span>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-xl p-3">
            <span className="text-[11px] text-rose-300 block flex items-center gap-1">
              <ArrowUpRight className="w-3.5 h-3.5" /> เงินออกรวม (Debit)
            </span>
            <div className="text-base sm:text-lg font-bold font-mono text-rose-300 mt-0.5">
              -{formatCurrency(totalDebitOutflow)}
            </div>
            <span className="text-[10px] text-slate-400">ตามรายการใน Statement</span>
          </div>
        </div>
      </div>

      {/* Main Content Body */}
      {bankAccounts.length === 0 ? (
        /* Empty State */
        <div className="p-8 text-center space-y-4">
          <div className="w-14 h-14 bg-teal-50 text-teal-700 rounded-2xl flex items-center justify-center mx-auto border border-teal-100">
            <Landmark className="w-7 h-7" />
          </div>
          <div className="max-w-md mx-auto">
            <h3 className="text-sm font-bold text-slate-900">
              ยังไม่มีการบันทึกบัญชีสินทรัพย์หมุนเวียน
            </h3>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              เริ่มต้นบันทึกบัญชีเงินฝากธนาคาร เลือกผูกกับโครงการ ระบุเลขบัญชี และอัปโหลดไฟล์ Statement
              เพื่อให้ระบบประมวลผลสรุปยอดและกระทบยอดเงินแยกตามโครงการอัตโนมัติ
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <button
              onClick={() => onNavigateToAssets()}
              className="px-4 py-2 bg-[#0D9488] hover:bg-teal-700 text-white rounded-xl text-xs font-bold transition shadow-xs flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              ไปที่หน้าบันทึกสินทรัพย์หมุนเวียน
            </button>
            <button
              onClick={handleCreateSampleAccounts}
              disabled={isCreatingSample}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition border border-slate-200 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Sparkles className="w-4 h-4 text-amber-500" />
              {isCreatingSample ? 'กำลังสร้างบัญชีตัวอย่าง...' : 'สร้าง 3 บัญชีตัวอย่างเพื่อทดสอบ'}
            </button>
          </div>
        </div>
      ) : scopedAccounts.length === 0 ? (
        <div className="p-8 text-center space-y-3">
          <FolderKanban className="w-10 h-10 text-slate-300 mx-auto" />
          <h4 className="text-xs font-bold text-slate-700">
            ไม่พบบัญชีสินทรัพย์หมุนเวียนสำหรับโครงการนี้
          </h4>
          <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
            คุณสามารถเพิ่มบัญชีใหม่และเลือกสังกัดโครงการนี้ หรือคลิกเปลี่ยนตัวกรองโครงการเป็น "ทุกโครงการ"
          </p>
          <button
            onClick={() => setSelectedProjectFilter('all')}
            className="text-xs font-bold text-teal-700 hover:underline"
          >
            แสดงทุกโครงการ
          </button>
        </div>
      ) : (
        <div className="p-4 sm:p-5 space-y-6">
          {/* SECTION 1: ยอดรวมตามธนาคาร (Bank-wise Totals) */}
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-teal-700" />
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  ยอดรวมตามธนาคาร / สถาบันการเงิน ({bankBreakdowns.length} แห่ง)
                  {selectedProjectFilter !== 'all' && (
                    <span className="ml-1 text-[11px] text-teal-700 font-normal">
                      · กรองเฉพาะ: {selectedProjectFilter === 'general' ? 'ส่วนกลาง' : getProjectDisplayName(projectsMap[selectedProjectFilter], 'โครงการ')}
                    </span>
                  )}
                </h3>
              </div>
              <span className="text-[11px] text-slate-500">
                คลิกที่การ์ดธนาคารเพื่อกรองดูเฉพาะบัญชีของธนาคารนั้น
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {bankBreakdowns.map((bank) => {
                const percentOfTotal = totalBalance > 0 ? (bank.totalBalance / totalBalance) * 100 : 0;
                const isSelected = selectedBankFilter === bank.bankCode;

                return (
                  <div
                    key={bank.bankCode}
                    onClick={() =>
                      setSelectedBankFilter(isSelected ? 'all' : bank.bankCode)
                    }
                    className={`relative p-3.5 rounded-xl border transition cursor-pointer select-none ${
                      isSelected
                        ? 'border-teal-600 bg-teal-50/40 shadow-xs ring-1 ring-teal-600'
                        : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-2xs'
                    }`}
                  >
                    {/* Bank Header */}
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div
                          className="w-7 h-7 rounded-lg flex items-center justify-center font-bold text-[10px] shrink-0 shadow-2xs"
                          style={{ backgroundColor: bank.color, color: bank.textColor }}
                        >
                          {bank.bankCode === 'CASH' ? 'CASH' : bank.bankCode.slice(0, 4)}
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-xs font-bold text-slate-900 truncate" title={bank.bankName}>
                            {bank.bankName}
                          </h4>
                          <span className="text-[10px] text-slate-500">
                            {bank.accountsCount} บัญชี
                          </span>
                        </div>
                      </div>

                      {isSelected && (
                        <span className="text-[10px] font-bold text-teal-700 bg-teal-100 px-1.5 py-0.5 rounded">
                          เลือกอยู่
                        </span>
                      )}
                    </div>

                    {/* Bank Balance */}
                    <div className="mb-2">
                      <span className="text-[10px] text-slate-400 block font-semibold">ยอดรวมสุทธิ:</span>
                      <div className="text-sm font-bold font-mono text-slate-900">
                        {formatCurrency(bank.totalBalance)}
                      </div>
                    </div>

                    {/* Progress Bar & Percentage */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[10px] text-slate-500">
                        <span>สัดส่วนในพอร์ต</span>
                        <span className="font-mono font-bold text-slate-700">
                          {percentOfTotal.toFixed(1)}%
                        </span>
                      </div>
                      <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-300"
                          style={{
                            width: `${Math.min(100, Math.max(percentOfTotal, 4))}%`,
                            backgroundColor: bank.color || '#0d9488',
                          }}
                        />
                      </div>
                    </div>

                    {/* Statement transactions recorded under this bank */}
                    <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-500">
                      <span>รายการเดินบัญชีที่บันทึก:</span>
                      <span className="font-mono font-semibold text-slate-800">
                        {bank.transactionsCount} รายการ
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* SECTION 2: จำนวนรายการที่บันทึกไว้ในแต่ละบัญชี (Per-Account Breakdown) */}
          <div className="pt-2 border-t border-slate-100">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
              <div className="flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-teal-700" />
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  รายละเอียดบัญชีและจำนวนรายการที่บันทึกไว้ ({filteredAccounts.length} บัญชี)
                </h3>
              </div>

              {/* Filter controls */}
              <div className="flex flex-wrap items-center gap-2">
                {selectedBankFilter !== 'all' && (
                  <button
                    onClick={() => setSelectedBankFilter('all')}
                    className="text-[11px] font-semibold text-teal-700 hover:text-teal-900 underline cursor-pointer"
                  >
                    ล้างการกรองธนาคาร
                  </button>
                )}
                <div className="w-full sm:w-48">
                  <input
                    type="text"
                    placeholder="ค้นหาเลขบัญชี, ชื่อ, โครงการ..."
                    value={searchAccountQuery}
                    onChange={(e) => setSearchAccountQuery(e.target.value)}
                    className="w-full px-2.5 py-1 text-xs border border-slate-200 rounded-lg text-slate-800 bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-teal-600"
                  />
                </div>
              </div>
            </div>

            {/* Accounts Table / Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredAccounts.map((acc) => {
                const stats = accountStatsMap.get(acc.id) || {
                  txCount: 0,
                  stmtCount: 0,
                  totalCredit: 0,
                  totalDebit: 0,
                  lastDate: undefined,
                };

                const bankMeta = THAI_BANKS.find((b) => b.code === acc.bankCode) || {
                  code: 'OTHER',
                  name: acc.bankName,
                  color: '#475569',
                  textColor: '#ffffff',
                };

                const assetTypeLabel =
                  ASSET_TYPES.find((t) => t.type === acc.assetType)?.label ||
                  'บัญชีเงินฝาก';

                const projName = acc.projectId
                  ? (getProjectDisplayName(projectsMap[acc.projectId], acc.projectName || 'โครงการ'))
                  : null;

                return (
                  <div
                    key={acc.id}
                    className="bg-slate-50/70 hover:bg-white border border-slate-200 rounded-xl p-3.5 transition shadow-2xs hover:shadow-xs hover:border-slate-300 flex flex-col justify-between"
                  >
                    <div>
                      {/* Top Row: Bank Badge, Project Badge & Asset Type */}
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: bankMeta.color }}
                          />
                          <span className="text-xs font-bold text-slate-800 truncate">
                            {acc.bankName || bankMeta.name}
                          </span>
                        </div>
                        <span className="text-[10px] px-2 py-0.5 rounded-md bg-slate-200/80 text-slate-700 font-medium shrink-0">
                          {assetTypeLabel}
                        </span>
                      </div>

                      {/* Project Tag */}
                      <div className="mb-2">
                        {projName ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-teal-800 bg-teal-50 border border-teal-200 px-2 py-0.5 rounded-md truncate max-w-full">
                            <FolderKanban className="w-3 h-3 text-teal-600 shrink-0" />
                            <span className="truncate">โครงการ: {projName}</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                            ส่วนกลาง / ไม่ระบุโครงการ
                          </span>
                        )}
                      </div>

                      {/* Account Number & Name */}
                      <div className="bg-white border border-slate-200/80 rounded-lg p-2.5 mb-2.5">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="text-[10px] text-slate-400 font-semibold">เลขที่บัญชี:</span>
                          <span className="text-xs font-mono font-bold text-slate-900 tracking-wide">
                            {acc.accountNumber}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-600 truncate mt-0.5 font-medium">
                          {acc.accountName || 'ไม่ระบุชื่อบัญชี'}
                        </div>
                      </div>

                      {/* Current Balance */}
                      <div className="flex items-baseline justify-between gap-2 mb-2.5 px-0.5">
                        <span className="text-[11px] text-slate-500 font-medium">ยอดคงเหลือ:</span>
                        <span className="text-sm font-bold font-mono text-teal-800">
                          {formatCurrency(acc.currentBalance)}
                        </span>
                      </div>

                      {/* STATEMENT & TRANSACTION COUNTS */}
                      <div className="bg-blue-50/70 border border-blue-100 rounded-lg p-2.5 space-y-1.5 mb-2.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-[11px] font-semibold text-blue-900 flex items-center gap-1">
                            <FileSpreadsheet className="w-3.5 h-3.5 text-blue-700" />
                            จำนวนรายการที่บันทึก:
                          </span>
                          <span className="font-mono font-bold text-blue-800 bg-white px-2 py-0.5 rounded border border-blue-200 text-xs shadow-2xs">
                            {stats.txCount.toLocaleString()} รายการ
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-[10px] pt-1 border-t border-blue-200/50">
                          <div>
                            <span className="text-slate-500 block">เงินเข้ารวม (Credit):</span>
                            <span className="font-mono font-bold text-emerald-700">
                              +{formatCurrency(stats.totalCredit, false)} ฿
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-500 block">เงินออกรวม (Debit):</span>
                            <span className="font-mono font-bold text-rose-700">
                              -{formatCurrency(stats.totalDebit, false)} ฿
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-[10px] text-slate-500 pt-0.5">
                          <span>ไฟล์ Statement:</span>
                          <span className="font-medium text-slate-700">
                            {stats.stmtCount} ฉบับ
                            {stats.lastDate && ` · ล่าสุด ${formatThaiDate(stats.lastDate)}`}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Bottom Action Button */}
                    <button
                      type="button"
                      onClick={() => onNavigateToAssets(acc.id)}
                      className="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 bg-white hover:bg-teal-50 text-teal-700 border border-slate-200 hover:border-teal-300 rounded-lg text-xs font-semibold transition cursor-pointer"
                    >
                      <span>เปิดดู Statement & รายการเดินบัญชี</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
