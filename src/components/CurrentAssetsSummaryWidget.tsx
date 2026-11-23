import React, { useState, useMemo } from 'react';
import { useData } from '../context/DataContext';
import {
  Landmark,
  ArrowUpRight,
  ArrowDownLeft,
  ChevronRight,
  Plus,
  FolderKanban,
  Search,
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

  // Group accounts and statements by Bank
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

    scopedStatements.forEach((st) => {
      for (const [, group] of map.entries()) {
        if (group.accountIds.includes(st.accountId)) {
          group.transactionsCount += st.transactions?.length || 0;
          group.statementsCount += 1;
          break;
        }
      }
    });

    return Array.from(map.values()).sort((a, b) => b.totalBalance - a.totalBalance);
  }, [scopedAccounts, scopedStatements]);

  // Map account-level statement stats
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

  // Filtered Accounts list
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
    <div className="bg-white border border-slate-200/90 rounded-xl overflow-hidden">
      {/* Clean Corporate Header */}
      <div className="p-4 sm:p-5 border-b border-slate-200/80 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <Landmark className="w-4 h-4 text-teal-700" />
            <span className="font-semibold text-teal-800">สินทรัพย์หมุนเวียนและบัญชีธนาคาร</span>
            <span aria-hidden="true" className="text-slate-300">·</span>
            <span className="font-mono tabular-nums">
              {scopedAccounts.length} บัญชี / {bankBreakdowns.length} สถาบันการเงิน
            </span>
          </div>
          <h2 className="font-display text-base font-bold text-slate-900">
            สรุปยอดเงินฝากธนาคารและรายการเดินบัญชี
          </h2>
          <p className="text-xs text-slate-500">
            รายงานสภาพคล่องรวม จำแนกตามสถาบันการเงิน และกรองดูยอดคงเหลือรายโครงการได้ทันที
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <div className="flex items-center gap-2 bg-slate-50 px-3 h-9 rounded-lg border border-slate-200 text-xs">
            <FolderKanban className="w-3.5 h-3.5 text-slate-500 shrink-0" />
            <select
              value={selectedProjectFilter}
              onChange={(e) => setSelectedProjectFilter(e.target.value)}
              className="bg-transparent text-slate-800 font-medium text-xs focus:outline-none cursor-pointer max-w-[180px] truncate"
            >
              <option value="all">ทุกโครงการ ({bankAccounts.length})</option>
              <option value="general">
                ส่วนกลาง / ไม่ระบุ ({bankAccounts.filter((b) => !b.projectId).length})
              </option>
              {projects.map((p) => {
                const count = bankAccounts.filter((b) => b.projectId === p.projectId).length;
                return (
                  <option key={p.projectId} value={p.projectId}>
                    {getProjectDisplayName(p)} ({count})
                  </option>
                );
              })}
            </select>
          </div>

          <button
            onClick={() => onNavigateToAssets()}
            className="inline-flex items-center gap-1.5 px-4 h-9 bg-[#0F766E] hover:bg-[#115E59] text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <span>จัดการสินทรัพย์ & Statement</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Hairline-Divided 4 Summary Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-200/80 border-b border-slate-200/80 bg-slate-50/50">
        <div className="p-4 sm:p-5">
          <span className="text-xs text-slate-500 font-medium block">ยอดสินทรัพย์หมุนเวียนสุทธิ</span>
          <div className="text-lg sm:text-xl font-bold font-mono tabular-nums text-slate-900 mt-1">
            {formatCurrency(totalBalance)}
          </div>
          <span className="text-[11px] text-slate-400 mt-0.5 block truncate">
            {selectedProjectFilter === 'all'
              ? 'จากทุกบัญชีและทุกโครงการ'
              : selectedProjectFilter === 'general'
              ? 'เฉพาะบัญชีส่วนกลาง'
              : getProjectDisplayName(projectsMap[selectedProjectFilter], 'โครงการ')}
          </span>
        </div>

        <div className="p-4 sm:p-5">
          <span className="text-xs text-slate-500 font-medium block">รายการเดินบัญชีที่บันทึก</span>
          <div className="text-lg sm:text-xl font-bold font-mono tabular-nums text-slate-900 mt-1">
            {totalTransactionsCount.toLocaleString()}{' '}
            <span className="text-xs font-sans font-medium text-slate-500">รายการ</span>
          </div>
          <span className="text-[11px] text-slate-400 mt-0.5 block">
            จาก {totalStatementsCount} ไฟล์ Statement
          </span>
        </div>

        <div className="p-4 sm:p-5">
          <span className="text-xs text-slate-500 font-medium flex items-center gap-1">
            <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-600" />
            <span>เงินเข้ารวม (Credit)</span>
          </span>
          <div className="text-lg sm:text-xl font-bold font-mono tabular-nums text-emerald-700 mt-1">
            +{formatCurrency(totalCreditInflow)}
          </div>
          <span className="text-[11px] text-slate-400 mt-0.5 block">ตามรายการใน Statement</span>
        </div>

        <div className="p-4 sm:p-5">
          <span className="text-xs text-slate-500 font-medium flex items-center gap-1">
            <ArrowUpRight className="w-3.5 h-3.5 text-rose-600" />
            <span>เงินออกรวม (Debit)</span>
          </span>
          <div className="text-lg sm:text-xl font-bold font-mono tabular-nums text-rose-700 mt-1">
            -{formatCurrency(totalDebitOutflow)}
          </div>
          <span className="text-[11px] text-slate-400 mt-0.5 block">ตามรายการใน Statement</span>
        </div>
      </div>

      {/* Main Content Body */}
      {bankAccounts.length === 0 ? (
        <div className="p-10 text-center space-y-4">
          <div className="w-12 h-12 bg-slate-100 text-slate-700 rounded-xl flex items-center justify-center mx-auto">
            <Landmark className="w-6 h-6" />
          </div>
          <div className="max-w-md mx-auto">
            <h3 className="text-sm font-semibold text-slate-900">
              ยังไม่มีการบันทึกบัญชีสินทรัพย์หมุนเวียน
            </h3>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              เริ่มต้นเพิ่มบัญชีเงินฝากธนาคารหรืออัปโหลดไฟล์ Statement เพื่อติดตามสภาพคล่องรายโครงการ
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
            <button
              onClick={() => onNavigateToAssets()}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#0F766E] hover:bg-[#115E59] text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>เพิ่มบัญชีสินทรัพย์หมุนเวียน</span>
            </button>
            <button
              onClick={handleCreateSampleAccounts}
              disabled={isCreatingSample}
              className="px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold transition-colors border border-slate-200 cursor-pointer disabled:opacity-50"
            >
              {isCreatingSample ? 'กำลังสร้างบัญชีตัวอย่าง...' : 'สร้าง 3 บัญชีตัวอย่าง'}
            </button>
          </div>
        </div>
      ) : scopedAccounts.length === 0 ? (
        <div className="p-10 text-center space-y-3">
          <FolderKanban className="w-9 h-9 text-slate-300 mx-auto" />
          <h4 className="text-sm font-semibold text-slate-800">
            ไม่พบบัญชีสินทรัพย์หมุนเวียนสำหรับโครงการนี้
          </h4>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            คุณสามารถเพิ่มบัญชีใหม่และผูกกับโครงการนี้ หรือเปลี่ยนตัวกรองกลับเป็นทุกโครงการ
          </p>
          <button
            onClick={() => setSelectedProjectFilter('all')}
            className="text-xs font-semibold text-teal-700 hover:underline cursor-pointer"
          >
            แสดงทุกโครงการ
          </button>
        </div>
      ) : (
        <div className="p-4 sm:p-6 space-y-6">
          {/* SECTION 1: Bank Breakdowns */}
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <h3 className="text-xs font-semibold text-slate-700">
                ยอดรวมตามสถาบันการเงิน ({bankBreakdowns.length} แห่ง)
                {selectedProjectFilter !== 'all' && (
                  <span className="ml-1.5 font-normal text-teal-700">
                    · {selectedProjectFilter === 'general' ? 'ส่วนกลาง' : getProjectDisplayName(projectsMap[selectedProjectFilter], 'โครงการ')}
                  </span>
                )}
              </h3>
              <span className="text-[11px] text-slate-400">
                คลิกที่ธนาคารเพื่อกรองรายการบัญชีด้านล่าง
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {bankBreakdowns.map((bank) => {
                const percentOfTotal = totalBalance > 0 ? (bank.totalBalance / totalBalance) * 100 : 0;
                const isSelected = selectedBankFilter === bank.bankCode;

                return (
                  <button
                    type="button"
                    key={bank.bankCode}
                    onClick={() => setSelectedBankFilter(isSelected ? 'all' : bank.bankCode)}
                    className={`text-left p-4 rounded-xl border transition-colors cursor-pointer ${
                      isSelected
                        ? 'border-teal-600 bg-teal-50/40 ring-1 ring-teal-600'
                        : 'border-slate-200/90 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-[10px] shrink-0"
                          style={{ backgroundColor: bank.color, color: bank.textColor }}
                        >
                          {bank.bankCode === 'CASH' ? 'CASH' : bank.bankCode.slice(0, 4)}
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-xs font-semibold text-slate-900 truncate" title={bank.bankName}>
                            {bank.bankName}
                          </h4>
                          <span className="text-[11px] text-slate-500">
                            {bank.accountsCount} บัญชี · {bank.transactionsCount} รายการ
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="text-base font-bold font-mono tabular-nums text-slate-900 mb-2.5">
                      {formatCurrency(bank.totalBalance)}
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[11px] text-slate-500">
                        <span>สัดส่วนพอร์ต</span>
                        <span className="font-mono font-semibold text-slate-700 tabular-nums">
                          {percentOfTotal.toFixed(1)}%
                        </span>
                      </div>
                      <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-300"
                          style={{
                            width: `${Math.min(100, Math.max(percentOfTotal, 4))}%`,
                            backgroundColor: bank.color || '#0F766E',
                          }}
                        />
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* SECTION 2: Per-Account Breakdown (Flat single-elevation cards) */}
          <div className="pt-5 border-t border-slate-200/80">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3.5">
              <h3 className="text-xs font-semibold text-slate-700">
                รายละเอียดรายบัญชี ({filteredAccounts.length} บัญชี)
              </h3>

              <div className="flex flex-wrap items-center gap-2.5">
                {selectedBankFilter !== 'all' && (
                  <button
                    onClick={() => setSelectedBankFilter('all')}
                    className="text-xs font-semibold text-teal-700 hover:underline cursor-pointer"
                  >
                    ล้างการกรองธนาคาร
                  </button>
                )}
                <div className="relative w-full sm:w-56">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="ค้นหาเลขบัญชี, ชื่อ, โครงการ..."
                    value={searchAccountQuery}
                    onChange={(e) => setSearchAccountQuery(e.target.value)}
                    className="w-full h-8.5 pl-8 pr-3 text-xs border border-slate-200 rounded-lg text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
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
                  ASSET_TYPES.find((t) => t.type === acc.assetType)?.label || 'บัญชีเงินฝาก';

                const projName = acc.projectId
                  ? getProjectDisplayName(projectsMap[acc.projectId], acc.projectName || 'โครงการ')
                  : null;

                return (
                  <div
                    key={acc.id}
                    className="bg-white border border-slate-200/80 hover:border-slate-300 rounded-xl p-4 transition-colors flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span
                              className="w-1 h-3.5 rounded-full shrink-0"
                              style={{ backgroundColor: bankMeta.color }}
                            />
                            <span className="text-xs font-semibold text-slate-900 truncate">
                              {acc.bankName || bankMeta.name}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 mt-0.5 truncate">
                            {assetTypeLabel} · {projName || 'ส่วนกลาง / ไม่ระบุโครงการ'}
                          </p>
                        </div>
                        <span className="font-mono text-xs font-semibold text-slate-700 tabular-nums shrink-0">
                          {acc.accountNumber}
                        </span>
                      </div>

                      <div className="text-xs text-slate-600 truncate mb-3">
                        {acc.accountName || 'ไม่ระบุชื่อบัญชี'}
                      </div>

                      <div className="py-3 border-y border-slate-100 flex items-baseline justify-between gap-2">
                        <span className="text-xs text-slate-500">ยอดคงเหลือ</span>
                        <span className="text-base font-bold font-mono tabular-nums text-slate-900">
                          {formatCurrency(acc.currentBalance)}
                        </span>
                      </div>

                      <div className="py-3 space-y-1.5 text-[11px]">
                        <div className="flex items-center justify-between text-slate-600">
                          <span>รายการเดินบัญชี</span>
                          <span className="font-mono font-semibold text-slate-900 tabular-nums">
                            {stats.txCount.toLocaleString()} รายการ ({stats.stmtCount} ฉบับ)
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-emerald-700 font-mono tabular-nums">
                            +{formatCurrency(stats.totalCredit, false)} ฿
                          </span>
                          <span className="text-rose-700 font-mono tabular-nums">
                            -{formatCurrency(stats.totalDebit, false)} ฿
                          </span>
                        </div>
                        {stats.lastDate && (
                          <div className="text-slate-400">
                            อัปเดตล่าสุด {formatThaiDate(stats.lastDate)}
                          </div>
                        )}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => onNavigateToAssets(acc.id)}
                      className="w-full inline-flex items-center justify-center gap-1.5 py-2 px-3 bg-slate-50 hover:bg-slate-100 text-slate-800 border border-slate-200 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                    >
                      <span>ดู Statement และรายการเดินบัญชี</span>
                      <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
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
