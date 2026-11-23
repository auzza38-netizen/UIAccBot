import React, { useState, useRef, useMemo, useEffect } from 'react';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';
import {
  Landmark,
  Plus,
  Upload,
  FileText,
  Search,
  Filter,
  ArrowUpRight,
  ArrowDownLeft,
  Calendar,
  CreditCard,
  Building2,
  Wallet,
  Sparkles,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Trash2,
  Edit2,
  Download,
  Eye,
  X,
  FileCheck2,
  Clock,
  Layers,
  FileSpreadsheet,
  FolderKanban,
  FolderUp,
  Folder,
  FolderPlus,
  Files,
  FileUp,
  Check,
  RotateCcw,
  Play,
  Images,
  HelpCircle,
  RefreshCw,
} from 'lucide-react';
import { BankAccount, StatementRecord, StatementTransaction, AssetType, Project } from '../types';
import {
  formatCurrency,
  formatThaiDate,
  normalizeDateISO,
  normalizeStatementTransaction,
  normalizeStatementTransactionsList,
  cleanNumericAmount,
  extractPageOrderFromFileName,
} from '../utils/formatters';
import { runMockStatementOcr } from '../services/mockOcrService';

export interface BatchStatementItem {
  id: string;
  file: File;
  fileName: string;
  filePath?: string;
  fileSize: number;
  mimeType: string;
  base64: string;
  status: 'pending' | 'scanning' | 'success' | 'error';
  errorMessage?: string;
  extractedData?: {
    bankName: string;
    bankCode?: string;
    accountNumber: string;
    accountName: string;
    branchName: string;
    projectId?: string;
    statementPeriodStart: string;
    statementPeriodEnd: string;
    openingBalance: number;
    closingBalance: number;
    totalDebit: number;
    totalCredit: number;
    transactions: StatementTransaction[];
    totalPagesRead?: number;
    ocrNotes?: string;
  };
}

// Bank metadata with corporate colors and logos
export const THAI_BANKS = [
  { code: 'KBANK', name: 'ธนาคารกสิกรไทย', color: '#138f2d', textColor: '#ffffff' },
  { code: 'SCB', name: 'ธนาคารไทยพาณิชย์', color: '#4e2e7f', textColor: '#ffffff' },
  { code: 'BBL', name: 'ธนาคารกรุงเทพ', color: '#1e3f8a', textColor: '#ffffff' },
  { code: 'KTB', name: 'ธนาคารกรุงไทย', color: '#00a5e5', textColor: '#ffffff' },
  { code: 'BAY', name: 'ธนาคารกรุงศรีอยุธยา', color: '#fec43b', textColor: '#453504' },
  { code: 'TTB', name: 'ธนาคารทหารไทยธนชาต', color: '#0050f0', textColor: '#ffffff' },
  { code: 'GSB', name: 'ธนาคารออมสิน', color: '#eb1985', textColor: '#ffffff' },
  { code: 'BAAC', name: 'ธ.ก.ส. (เพื่อการเกษตรฯ)', color: '#2b704c', textColor: '#ffffff' },
  { code: 'UOB', name: 'ธนาคารยูโอบี', color: '#002e6e', textColor: '#ffffff' },
  { code: 'KKP', name: 'ธนาคารเกียรตินาคินภัทร', color: '#2a225c', textColor: '#ffffff' },
  { code: 'CASH', name: 'เงินสดในมือ / เงินสดย่อย', color: '#0d9488', textColor: '#ffffff' },
  { code: 'OTHER', name: 'สถาบันการเงินอื่น ๆ', color: '#475569', textColor: '#ffffff' },
];

export const ASSET_TYPES: { type: AssetType; label: string }[] = [
  { type: 'savings', label: 'บัญชีเงินฝากออมทรัพย์' },
  { type: 'current', label: 'บัญชีเงินฝากกระแสรายวัน' },
  { type: 'fixed', label: 'บัญชีเงินฝากประจำ' },
  { type: 'petty_cash', label: 'เงินสดย่อย / เงินสดสำรองจ่าย' },
  { type: 'other', label: 'สินทรัพย์หมุนเวียนอื่น ๆ' },
];

export const getProjectDisplayName = (project?: Project, fallback?: string): string => {
  if (!project) return fallback || '';
  if (project.projectCode && project.clientName) {
    return `${project.projectCode} - ${project.clientName}`;
  }
  return project.clientName || project.projectCode || fallback || '';
};

export interface CurrentAssetsPageProps {
  initialAccountId?: string;
  initialSubTab?: 'accounts' | 'transactions' | 'statements';
}

export const CurrentAssetsPage: React.FC<CurrentAssetsPageProps> = ({
  initialAccountId,
  initialSubTab,
}) => {
  const {
    bankAccounts,
    statementRecords,
    projects,
    projectsMap,
    bankAccountsMap,
    saveBankAccount,
    deleteBankAccount,
    saveStatementRecord,
    deleteStatementRecord,
  } = useData();
  const { isAdmin } = useAuth();

  // Tab View: 'accounts' | 'statements' | 'transactions'
  const [activeSubTab, setActiveSubTab] = useState<'accounts' | 'transactions' | 'statements'>(
    initialSubTab || (initialAccountId ? 'transactions' : 'accounts')
  );
  const [selectedAccountId, setSelectedAccountId] = useState<string>(initialAccountId || 'all');
  const [selectedProjectFilter, setSelectedProjectFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [dateFilter, setDateFilter] = useState<'all' | 'this_month' | 'last_month'>('this_month');

  // Modals & In-App Alerts
  const [isAddAccountModalOpen, setIsAddAccountModalOpen] = useState<boolean>(false);
  const [editingAccount, setEditingAccount] = useState<BankAccount | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [accountToDelete, setAccountToDelete] = useState<BankAccount | null>(null);
  const [statementToDelete, setStatementToDelete] = useState<StatementRecord | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  // In-App Toast Notification
  const [notification, setNotification] = useState<{
    type: 'success' | 'error' | 'info';
    title: string;
    message: string;
  } | null>(null);

  useEffect(() => {
    if (!notification) return;
    const timer = setTimeout(() => setNotification(null), 4500);
    return () => clearTimeout(timer);
  }, [notification]);

  // Statement auto-repair state
  const [isRepairing, setIsRepairing] = useState<boolean>(false);

  // 1-Click repair and deduplicate all statements (with cross-page running balance chaining)
  const handleRepairAllStatements = async () => {
    if (isRepairing || statementRecords.length === 0) return;
    setIsRepairing(true);
    try {
      let repairedCount = 0;
      let deletedDuplicates = 0;
      const seenSignatures = new Set<string>();
      const uniqueStatements: StatementRecord[] = [];

      for (const stmt of statementRecords) {
        // Detect true exact duplicates by account + period + opening/closing balance + tx count + first/last balance
        const cleanAcc = (stmt.accountNumber || '').replace(/[^0-9]/g, '');
        const firstBal = cleanNumericAmount(stmt.transactions?.[0]?.balance);
        const lastBal = cleanNumericAmount(stmt.transactions?.[stmt.transactions.length - 1]?.balance);
        const sig = `${cleanAcc}_${stmt.statementPeriodStart}_${stmt.statementPeriodEnd}_${cleanNumericAmount(stmt.openingBalance)}_${cleanNumericAmount(stmt.closingBalance)}_${stmt.transactions?.length || 0}_${firstBal}_${lastBal}`;

        if (cleanAcc && (stmt.transactions?.length || 0) > 0 && seenSignatures.has(sig)) {
          await deleteStatementRecord(stmt.id);
          deletedDuplicates++;
          continue;
        }
        if (cleanAcc && (stmt.transactions?.length || 0) > 0) {
          seenSignatures.add(sig);
        }
        uniqueStatements.push(stmt);
      }

      // Sort statements per account by page order / chronological order to chain balances across pages
      const sortedForChaining = [...uniqueStatements].sort((a, b) => {
        const pageA = extractPageOrderFromFileName(a.fileName);
        const pageB = extractPageOrderFromFileName(b.fileName);
        if (pageA !== pageB && pageA < 999999 && pageB < 999999) {
          return pageA - pageB;
        }
        const dateA = a.transactions?.[0]?.date || a.statementPeriodStart || '';
        const dateB = b.transactions?.[0]?.date || b.statementPeriodStart || '';
        return dateA.localeCompare(dateB);
      });

      const lastClosingByAccount: Record<string, number> = {};

      for (const stmt of sortedForChaining) {
        const accKey = (stmt.accountNumber || stmt.accountId || 'default').replace(/[^0-9a-zA-Z]/g, '');
        const prevClosing = lastClosingByAccount[accKey];
        const rawOpening = cleanNumericAmount(stmt.openingBalance);
        const firstRowBal = cleanNumericAmount(stmt.transactions?.[0]?.balance);
        const firstRowDesc = stmt.transactions?.[0]?.description || '';
        const firstIsBf = firstRowDesc.includes('ยอดยกมา') || firstRowDesc.includes('Brought Forward');

        const effectiveOpening =
          !firstIsBf &&
          (rawOpening === 0 || (firstRowBal !== 0 && Math.abs(rawOpening - firstRowBal) < 0.01)) &&
          prevClosing !== undefined &&
          prevClosing !== 0
            ? prevClosing
            : rawOpening;

        const repairedTxs = normalizeStatementTransactionsList(
          stmt.transactions || [],
          effectiveOpening
        );

        const lastTxBal = cleanNumericAmount(repairedTxs[repairedTxs.length - 1]?.balance);
        const closingVal = cleanNumericAmount(stmt.closingBalance) || lastTxBal;
        if (closingVal !== 0) {
          lastClosingByAccount[accKey] = closingVal;
        }

        const totalDebitVal =
          Math.round(repairedTxs.reduce((s, tx) => s + (Number(tx.debitAmount) || 0), 0) * 100) / 100;
        const totalCreditVal =
          Math.round(repairedTxs.reduce((s, tx) => s + (Number(tx.creditAmount) || 0), 0) * 100) / 100;

        await saveStatementRecord(
          {
            ...stmt,
            openingBalance: effectiveOpening || rawOpening,
            closingBalance: closingVal,
            totalDebit: totalDebitVal || stmt.totalDebit,
            totalCredit: totalCreditVal || stmt.totalCredit,
            transactions: repairedTxs,
          },
          false
        );
        repairedCount++;
      }

      setNotification({
        type: 'success',
        title: 'ซ่อมแซมและจัดระเบียบ Statement สำเร็จ',
        message: `คำนวณยอดเงินเข้า-ออกต่อเนื่องครบ ${repairedCount} ฉบับ ${
          deletedDuplicates > 0 ? `(ลบ Statement ฉบับซ้ำออก ${deletedDuplicates} ฉบับ)` : ''
        }`,
      });
    } catch (err: any) {
      setNotification({
        type: 'error',
        title: 'ไม่สามารถซ่อมแซมได้',
        message: err.message || 'เกิดข้อผิดพลาดในการซ่อมแซม',
      });
    } finally {
      setIsRepairing(false);
    }
  };

  // Statement Reader / AI Scan Modal
  const [isStatementScanModalOpen, setIsStatementScanModalOpen] = useState<boolean>(false);
  const [scanTargetAccountId, setScanTargetAccountId] = useState<string>('');
  const [statementFile, setStatementFile] = useState<File | null>(null);
  const [statementBase64, setStatementBase64] = useState<string>('');
  const [isScanningStatement, setIsScanningStatement] = useState<boolean>(false);
  const [scanError, setScanError] = useState<string | null>(null);

  // Extracted Statement Data Review State
  const [extractedStatement, setExtractedStatement] = useState<{
    bankName: string;
    bankCode?: string;
    accountNumber: string;
    accountName: string;
    branchName: string;
    projectId?: string;
    statementPeriodStart: string;
    statementPeriodEnd: string;
    openingBalance: number;
    closingBalance: number;
    totalDebit: number;
    totalCredit: number;
    transactions: StatementTransaction[];
    totalPagesRead?: number;
    ocrNotes?: string;
  } | null>(null);

  // Batch & Folder Upload States
  const [isBatchMode, setIsBatchMode] = useState<boolean>(false);
  const [batchItems, setBatchItems] = useState<BatchStatementItem[]>([]);
  const [isBatchScanning, setIsBatchScanning] = useState<boolean>(false);
  const [currentBatchIndex, setCurrentBatchIndex] = useState<number>(-1);
  const [isSavingBatch, setIsSavingBatch] = useState<boolean>(false);
  const [isDraggingFolder, setIsDraggingFolder] = useState<boolean>(false);
  const [previewBatchItemId, setPreviewBatchItemId] = useState<string | null>(null);
  const [statementPreviewZoomUrl, setStatementPreviewZoomUrl] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const folderInputRef = useRef<HTMLInputElement | null>(null);

  // Account Form fields
  const [accountForm, setAccountForm] = useState<{
    accountNumber: string;
    bankName: string;
    bankCode: string;
    accountName: string;
    branchName: string;
    assetType: AssetType;
    currentBalance: number | '';
    projectId: string;
    notes: string;
  }>({
    accountNumber: '',
    bankName: 'ธนาคารกสิกรไทย',
    bankCode: 'KBANK',
    accountName: '',
    branchName: '',
    assetType: 'savings',
    currentBalance: '',
    projectId: '',
    notes: '',
  });

  // Calculate totals
  const totalAssetsBalance = useMemo(() => {
    return bankAccounts.reduce((sum, acc) => sum + (Number(acc.currentBalance) || 0), 0);
  }, [bankAccounts]);

  // Filtered bank accounts by project and search
  const filteredBankAccounts = useMemo(() => {
    return bankAccounts.filter((acc) => {
      if (selectedProjectFilter !== 'all') {
        if (selectedProjectFilter === 'general' && acc.projectId) return false;
        if (selectedProjectFilter !== 'general' && acc.projectId !== selectedProjectFilter) return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          acc.accountNumber.toLowerCase().includes(q) ||
          acc.bankName.toLowerCase().includes(q) ||
          acc.accountName.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [bankAccounts, selectedProjectFilter, searchQuery]);

  // Total balance for filtered project accounts
  const filteredTotalBalance = useMemo(() => {
    return filteredBankAccounts.reduce((sum, acc) => sum + (Number(acc.currentBalance) || 0), 0);
  }, [filteredBankAccounts]);

  const allTransactions = useMemo(() => {
    const list: (StatementTransaction & {
      accountId: string;
      accountNumber: string;
      bankName: string;
      statementId: string;
      projectId?: string;
      projectName?: string;
    })[] = [];

    // Sort statements chronologically / by page number so continuation pages chain their opening balance
    const orderedStatements = [...statementRecords].sort((a, b) => {
      const pageA = extractPageOrderFromFileName(a.fileName);
      const pageB = extractPageOrderFromFileName(b.fileName);
      if (pageA !== pageB && pageA < 999999 && pageB < 999999) {
        return pageA - pageB;
      }
      const dateA = a.transactions?.[0]?.date || a.statementPeriodStart || '';
      const dateB = b.transactions?.[0]?.date || b.statementPeriodStart || '';
      return dateA.localeCompare(dateB);
    });

    const lastClosingByAccount: Record<string, number> = {};

    orderedStatements.forEach((stmt) => {
      const accKey = (stmt.accountNumber || stmt.accountId || 'default').replace(/[^0-9a-zA-Z]/g, '');
      const prevClosing = lastClosingByAccount[accKey];
      const rawOpening = cleanNumericAmount(stmt.openingBalance);
      const firstRowBal = cleanNumericAmount(stmt.transactions?.[0]?.balance);
      const firstRowDesc = stmt.transactions?.[0]?.description || '';
      const firstIsBf = firstRowDesc.includes('ยอดยกมา') || firstRowDesc.includes('Brought Forward');

      const effectiveOpening =
        !firstIsBf &&
        (rawOpening === 0 || (firstRowBal !== 0 && Math.abs(rawOpening - firstRowBal) < 0.01)) &&
        prevClosing !== undefined &&
        prevClosing !== 0
          ? prevClosing
          : rawOpening;

      const normalizedList = normalizeStatementTransactionsList(
        stmt.transactions || [],
        effectiveOpening
      );

      const lastTxBal = cleanNumericAmount(normalizedList[normalizedList.length - 1]?.balance);
      const closingVal = cleanNumericAmount(stmt.closingBalance) || lastTxBal;
      if (closingVal !== 0) {
        lastClosingByAccount[accKey] = closingVal;
      }

      normalizedList.forEach((norm) => {
        const txPid = norm.projectId || stmt.projectId || '';
        list.push({
          ...norm,
          accountId: stmt.accountId,
          accountNumber: stmt.accountNumber,
          bankName: stmt.bankName,
          statementId: stmt.id,
          projectId: txPid || undefined,
          projectName: txPid ? (getProjectDisplayName(projectsMap[txPid]) || norm.projectName || stmt.projectName || '') : 'ส่วนกลาง',
        });
      });
    });

    return list.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  }, [statementRecords, projectsMap]);

  // Background auto-repair: Ensure statementRecords in Firestore have standardized field names and populated amounts
  useEffect(() => {
    if (!statementRecords || statementRecords.length === 0) return;
    const ordered = [...statementRecords].sort((a, b) => {
      const pageA = extractPageOrderFromFileName(a.fileName);
      const pageB = extractPageOrderFromFileName(b.fileName);
      if (pageA !== pageB && pageA < 999999 && pageB < 999999) {
        return pageA - pageB;
      }
      const dateA = a.transactions?.[0]?.date || a.statementPeriodStart || '';
      const dateB = b.transactions?.[0]?.date || b.statementPeriodStart || '';
      return dateA.localeCompare(dateB);
    });

    const lastClosingByAccount: Record<string, number> = {};

    ordered.forEach(async (stmt) => {
      const accKey = (stmt.accountNumber || stmt.accountId || 'default').replace(/[^0-9a-zA-Z]/g, '');
      const prevClosing = lastClosingByAccount[accKey];
      const rawOpening = cleanNumericAmount(stmt.openingBalance);
      const firstRowBal = cleanNumericAmount(stmt.transactions?.[0]?.balance);
      const firstRowDesc = stmt.transactions?.[0]?.description || '';
      const firstIsBf = firstRowDesc.includes('ยอดยกมา') || firstRowDesc.includes('Brought Forward');

      const effectiveOpening =
        !firstIsBf &&
        (rawOpening === 0 || (firstRowBal !== 0 && Math.abs(rawOpening - firstRowBal) < 0.01)) &&
        prevClosing !== undefined &&
        prevClosing !== 0
          ? prevClosing
          : rawOpening;

      const repairedTxs = normalizeStatementTransactionsList(
        stmt.transactions || [],
        effectiveOpening
      );

      const lastTxBal = cleanNumericAmount(repairedTxs[repairedTxs.length - 1]?.balance);
      const closingVal = cleanNumericAmount(stmt.closingBalance) || lastTxBal;
      if (closingVal !== 0) {
        lastClosingByAccount[accKey] = closingVal;
      }

      let needsFix = false;
      const currentTxs = stmt.transactions || [];
      if (repairedTxs.length !== currentTxs.length) {
        needsFix = true;
      } else {
        for (let i = 0; i < repairedTxs.length; i++) {
          const rep = repairedTxs[i];
          const cur = currentTxs[i] as any;
          if (
            (rep.debitAmount && !cur.debitAmount) ||
            (rep.creditAmount && !cur.creditAmount) ||
            rep.description !== cur.description ||
            rep.channel !== cur.channel
          ) {
            needsFix = true;
            break;
          }
        }
      }

      if (needsFix) {
        try {
          await saveStatementRecord(
            {
              ...stmt,
              openingBalance: effectiveOpening || rawOpening,
              transactions: repairedTxs,
            },
            false
          );
        } catch (e) {
          console.warn('Auto-repair statement record notice:', e);
        }
      }
    });
  }, [statementRecords, saveStatementRecord]);

  // Filtered transactions
  const filteredTransactions = useMemo(() => {
    return allTransactions.filter((tx) => {
      if (selectedAccountId !== 'all' && tx.accountId !== selectedAccountId) {
        return false;
      }
      if (selectedProjectFilter !== 'all') {
        if (selectedProjectFilter === 'general' && tx.projectId) return false;
        if (selectedProjectFilter !== 'general' && tx.projectId !== selectedProjectFilter) return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchDesc = (tx.description || '').toLowerCase().includes(q);
        const matchRef = (tx.referenceNo || '').toLowerCase().includes(q);
        const matchAcc = (tx.accountNumber || '').includes(q);
        const matchProj = (tx.projectName || '').toLowerCase().includes(q);
        if (!matchDesc && !matchRef && !matchAcc && !matchProj) return false;
      }
      return true;
    });
  }, [allTransactions, selectedAccountId, selectedProjectFilter, searchQuery]);

  const [isSavingAccount, setIsSavingAccount] = useState<boolean>(false);

  // Handle open Account Modal
  const handleOpenAccountModal = (acc?: BankAccount) => {
    setFormError(null);
    if (acc) {
      setEditingAccount(acc);
      setAccountForm({
        accountNumber: acc.accountNumber,
        bankName: acc.bankName,
        bankCode: acc.bankCode || 'KBANK',
        accountName: acc.accountName,
        branchName: acc.branchName || '',
        assetType: acc.assetType,
        currentBalance: acc.currentBalance,
        projectId: acc.projectId || '',
        notes: acc.notes || '',
      });
    } else {
      setEditingAccount(null);
      setAccountForm({
        accountNumber: '',
        bankName: 'ธนาคารกสิกรไทย',
        bankCode: 'KBANK',
        accountName: '',
        branchName: '',
        assetType: 'savings',
        currentBalance: '',
        projectId: selectedProjectFilter !== 'all' && selectedProjectFilter !== 'general' ? selectedProjectFilter : '',
        notes: '',
      });
    }
    setIsAddAccountModalOpen(true);
  };

  const handleSaveAccountSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!accountForm.accountNumber.trim()) {
      setFormError('กรุณาระบุเลขที่บัญชี');
      return;
    }
    if (!accountForm.accountName.trim()) {
      setFormError('กรุณาระบุชื่อบัญชี');
      return;
    }

    setIsSavingAccount(true);
    try {
      const selectedProj = accountForm.projectId ? projectsMap[accountForm.projectId] : undefined;
      const selectedProjName = selectedProj ? getProjectDisplayName(selectedProj) : '';
      await saveBankAccount({
        id: editingAccount?.id,
        accountNumber: accountForm.accountNumber.trim(),
        bankName: accountForm.bankName,
        bankCode: accountForm.bankCode,
        accountName: accountForm.accountName.trim(),
        branchName: accountForm.branchName.trim(),
        assetType: accountForm.assetType,
        currentBalance: Number(accountForm.currentBalance) || 0,
        availableBalance: Number(accountForm.currentBalance) || 0,
        projectId: accountForm.projectId ? accountForm.projectId : undefined,
        projectName: selectedProjName || undefined,
        notes: accountForm.notes.trim(),
      });
      setIsAddAccountModalOpen(false);
      setNotification({
        type: 'success',
        title: editingAccount ? 'อัปเดตบัญชีสำเร็จ' : 'เพิ่มบัญชีสำเร็จ',
        message: `บันทึกข้อมูล ${accountForm.bankName} (${accountForm.accountNumber}) เรียบร้อยแล้ว`,
      });
    } catch (err: any) {
      setNotification({
        type: 'error',
        title: 'บันทึกบัญชีไม่สำเร็จ',
        message: err.message || 'เกิดข้อผิดพลาดในการบันทึกบัญชี',
      });
    } finally {
      setIsSavingAccount(false);
    }
  };

  const confirmDeleteAccount = async () => {
    if (!accountToDelete) return;
    setIsDeleting(true);
    try {
      await deleteBankAccount(accountToDelete.id);
      setNotification({
        type: 'success',
        title: 'ลบบัญชีสำเร็จ',
        message: `ลบบัญชี ${accountToDelete.bankName} เลขที่ ${accountToDelete.accountNumber} เรียบร้อยแล้ว`,
      });
    } catch (err: any) {
      setNotification({
        type: 'error',
        title: 'ลบบัญชีไม่สำเร็จ',
        message: err.message || 'เกิดข้อผิดพลาดในการลบบัญชี',
      });
    } finally {
      setIsDeleting(false);
      setAccountToDelete(null);
    }
  };

  const confirmDeleteStatement = async () => {
    if (!statementToDelete) return;
    setIsDeleting(true);
    try {
      await deleteStatementRecord(statementToDelete.id);
      setNotification({
        type: 'success',
        title: 'ลบ Statement สำเร็จ',
        message: `ลบประวัติ Statement ของ ${statementToDelete.bankName} เรียบร้อยแล้ว`,
      });
    } catch (err: any) {
      setNotification({
        type: 'error',
        title: 'ลบ Statement ไม่สำเร็จ',
        message: err.message || 'เกิดข้อผิดพลาดในการลบ Statement',
      });
    } finally {
      setIsDeleting(false);
      setStatementToDelete(null);
    }
  };

  // Convert File to base64 helper
  const readFileAsBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (err) => reject(err);
      reader.readAsDataURL(file);
    });
  };

  // Filter valid statement files (PDF & Images, excluding OS junk)
  const filterValidStatementFiles = (files: File[]): File[] => {
    return files.filter((f) => {
      const type = (f.type || '').toLowerCase();
      const name = (f.name || '').toLowerCase();
      if (name.startsWith('.') || name.startsWith('desktop.ini') || name.startsWith('thumbs.db')) return false;
      return (
        type === 'application/pdf' ||
        type.startsWith('image/') ||
        name.endsWith('.pdf') ||
        name.endsWith('.png') ||
        name.endsWith('.jpg') ||
        name.endsWith('.jpeg') ||
        name.endsWith('.webp')
      );
    });
  };

  // Traverse DataTransfer entries recursively for folder drop
  const getFilesFromDataTransfer = async (dataTransfer: DataTransfer): Promise<File[]> => {
    const files: File[] = [];
    const items = dataTransfer.items;

    if (items && items.length > 0 && typeof items[0].webkitGetAsEntry === 'function') {
      const traverse = async (entry: any) => {
        if (!entry) return;
        if (entry.isFile) {
          try {
            const file: File = await new Promise((res, rej) => entry.file(res, rej));
            files.push(file);
          } catch {}
        } else if (entry.isDirectory) {
          const dirReader = entry.createReader();
          const readEntries = async (): Promise<any[]> => {
            return new Promise((res, rej) => dirReader.readEntries(res, rej));
          };
          try {
            let entries = await readEntries();
            while (entries.length > 0) {
              for (const child of entries) {
                await traverse(child);
              }
              entries = await readEntries();
            }
          } catch {}
        }
      };

      for (let i = 0; i < items.length; i++) {
        const entry = items[i].webkitGetAsEntry();
        if (entry) {
          await traverse(entry);
        }
      }
    } else if (dataTransfer.files) {
      for (let i = 0; i < dataTransfer.files.length; i++) {
        files.push(dataTransfer.files[i]);
      }
    }
    return files;
  };

  // Open Statement Scan
  const handleOpenStatementScan = (targetAccId?: string, isFolderOpen = false) => {
    setScanTargetAccountId(targetAccId || (bankAccounts.length > 0 ? bankAccounts[0].id : ''));
    setStatementFile(null);
    setStatementBase64('');
    setExtractedStatement(null);
    setScanError(null);
    setIsBatchMode(false);
    setBatchItems([]);
    setIsBatchScanning(false);
    setCurrentBatchIndex(-1);
    setPreviewBatchItemId(null);
    setIsStatementScanModalOpen(true);

    if (isFolderOpen) {
      setTimeout(() => {
        folderInputRef.current?.click();
      }, 250);
    }
  };

  // Quick 1-click folder upload from header
  const handleOpenFolderUpload = () => {
    handleOpenStatementScan('', true);
  };

  // Process a list of files (from file picker, folder picker, or drop)
  const handleProcessFiles = async (files: File[]) => {
    const valid = filterValidStatementFiles(files);
    if (valid.length === 0) {
      setScanError('ไม่พบไฟล์เอกสาร Statement (PDF หรือรูปภาพ) ในสิ่งที่เลือก');
      return;
    }

    setScanError(null);

    // If only 1 file and not in batch mode yet: set as single file
    if (valid.length === 1 && batchItems.length === 0 && !isBatchMode) {
      const f = valid[0];
      setStatementFile(f);
      setExtractedStatement(null);
      try {
        const b64 = await readFileAsBase64(f);
        setStatementBase64(b64);
      } catch (err: any) {
        setScanError('ไม่สามารถอ่านไฟล์ได้: ' + err.message);
      }
      return;
    }

    // Multiple files or folder mode: activate Batch
    setIsBatchMode(true);
    setStatementFile(null);
    setStatementBase64('');
    setExtractedStatement(null);

    const newItems: BatchStatementItem[] = [];
    for (let i = 0; i < valid.length; i++) {
      const f = valid[i];
      try {
        const b64 = await readFileAsBase64(f);
        newItems.push({
          id: 'batch_' + Date.now() + '_' + i + '_' + Math.random().toString(36).substring(2, 6),
          file: f,
          fileName: f.name,
          filePath: (f as any).webkitRelativePath || f.name,
          fileSize: f.size,
          mimeType: f.type || (f.name.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg'),
          base64: b64,
          status: 'pending',
        });
      } catch (err) {
        console.error('Failed reading file in batch:', f.name, err);
      }
    }

    setBatchItems((prev) => {
      const combined = [...prev, ...newItems];
      return combined.sort((a, b) => {
        const pA = extractPageOrderFromFileName(a.fileName);
        const pB = extractPageOrderFromFileName(b.fileName);
        if (pA !== pB) return pA - pB;
        return a.fileName.localeCompare(b.fileName, undefined, { numeric: true });
      });
    });
  };

  // Handle Statement File Selection
  const handleStatementFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;
    const files = Array.from(fileList);
    await handleProcessFiles(files);
    e.target.value = '';
  };

  // Handle Folder Selection
  const handleFolderInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;
    const files = Array.from(fileList);
    setIsBatchMode(true);
    await handleProcessFiles(files);
    e.target.value = '';
  };

  // Drag and Drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingFolder(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingFolder(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingFolder(false);

    const dt = e.dataTransfer;
    if (!dt) return;

    const files = await getFilesFromDataTransfer(dt);
    if (files.length > 0) {
      await handleProcessFiles(files);
    }
  };

  // Simulated Statement OCR runner for Frontend UI Template
  const safeFetchStatementOcr = async (bodyObj: any): Promise<any> => {
    return runMockStatementOcr({ fileName: bodyObj.fileName });
  };

  // Helper to run OCR on a single batch item (with optional chained openingBalance from previous page)
  const scanSingleBatchItemData = async (item: BatchStatementItem, chainedOpeningBalance?: number) => {
    let json = await safeFetchStatementOcr({
      fileName: item.fileName,
      imageBase64: item.base64,
      mimeType: item.mimeType,
      isConfidential: false,
    });

    // If first attempt returned 0 transactions on a page, retry once automatically
    if (!Array.isArray(json?.data?.transactions) || json.data.transactions.length === 0) {
      await new Promise((r) => setTimeout(r, 800));
      try {
        const retryJson = await safeFetchStatementOcr({
          imageBase64: item.base64,
          mimeType: item.mimeType,
          isConfidential: false,
        });
        if (Array.isArray(retryJson?.data?.transactions) && retryJson.data.transactions.length > 0) {
          json = retryJson;
        }
      } catch {}
    }

    const d = json.data;
    const targetAcc = bankAccounts.find((b) => b.id === scanTargetAccountId);
    const initialProjId = targetAcc?.projectId || (selectedProjectFilter !== 'all' && selectedProjectFilter !== 'general' ? selectedProjectFilter : '');
    const initialProj = initialProjId ? projectsMap[initialProjId] : undefined;
    const initialProjName = initialProj ? getProjectDisplayName(initialProj) : '';

    const rawTxs = Array.isArray(d.transactions) ? d.transactions : [];
    const rawOpening = cleanNumericAmount(d.openingBalance);
    const firstRowBal = cleanNumericAmount(rawTxs[0]?.balance ?? rawTxs[0]?.ยอดคงเหลือ);
    const firstRowDesc = String(rawTxs[0]?.description || rawTxs[0]?.รายการ || '');
    const firstIsBf = firstRowDesc.includes('ยอดยกมา') || firstRowDesc.includes('Brought Forward');

    const effectiveOpening =
      !firstIsBf &&
      (rawOpening === 0 || (firstRowBal !== 0 && Math.abs(rawOpening - firstRowBal) < 0.01)) &&
      chainedOpeningBalance !== undefined &&
      chainedOpeningBalance !== 0
        ? chainedOpeningBalance
        : rawOpening;

    const normalizedTxs = normalizeStatementTransactionsList(
      rawTxs,
      effectiveOpening
    ).map((norm) => ({
      ...norm,
      date: normalizeDateISO(norm.date) || norm.date || '',
      projectId: initialProjId || '',
      projectName: initialProjName || '',
    }));

    const totalDebitVal =
      Math.round(normalizedTxs.reduce((s, tx) => s + (Number(tx.debitAmount) || 0), 0) * 100) / 100 ||
      cleanNumericAmount(d.totalDebit);
    const totalCreditVal =
      Math.round(normalizedTxs.reduce((s, tx) => s + (Number(tx.creditAmount) || 0), 0) * 100) / 100 ||
      cleanNumericAmount(d.totalCredit);

    const lastTxBal = cleanNumericAmount(normalizedTxs[normalizedTxs.length - 1]?.balance);
    const closingBalVal = cleanNumericAmount(d.closingBalance) || lastTxBal;

    return {
      bankName: d.bankName || 'ธนาคารทั่วไป',
      bankCode: d.bankCode || 'KBANK',
      accountNumber: d.accountNumber || '',
      accountName: d.accountName || '',
      branchName: d.branchName || '',
      projectId: initialProjId,
      statementPeriodStart: normalizeDateISO(d.statementPeriodStart) || '',
      statementPeriodEnd: normalizeDateISO(d.statementPeriodEnd) || '',
      openingBalance: effectiveOpening || rawOpening,
      closingBalance: closingBalVal,
      totalDebit: totalDebitVal,
      totalCredit: totalCreditVal,
      transactions: normalizedTxs,
      totalPagesRead: d.totalPagesRead || 1,
      ocrNotes: d.ocrNotes || '',
    };
  };

  // Batch Scan All Items sequentially (with cross-page running balance chaining)
  const handleBatchScanAll = async () => {
    if (isBatchScanning || batchItems.length === 0) return;
    setIsBatchScanning(true);
    setScanError(null);

    let runningPrevClosingBalance: number | undefined = undefined;

    for (let i = 0; i < batchItems.length; i++) {
      const it = batchItems[i];
      if (it.status === 'success' && it.extractedData) {
        if (it.extractedData.closingBalance !== 0) {
          runningPrevClosingBalance = it.extractedData.closingBalance;
        }
        continue;
      }

      setCurrentBatchIndex(i);
      setBatchItems((prev) =>
        prev.map((item, idx) => (idx === i ? { ...item, status: 'scanning', errorMessage: undefined } : item))
      );

      try {
        const extracted = await scanSingleBatchItemData(it, runningPrevClosingBalance);
        if (extracted.closingBalance !== 0) {
          runningPrevClosingBalance = extracted.closingBalance;
        }
        setBatchItems((prev) =>
          prev.map((item, idx) =>
            idx === i ? { ...item, status: 'success', extractedData: extracted } : item
          )
        );
      } catch (err: any) {
        console.error(`Batch scan error for ${it.fileName}:`, err);
        setBatchItems((prev) =>
          prev.map((item, idx) =>
            idx === i ? { ...item, status: 'error', errorMessage: err.message || 'อ่านข้อมูลไม่สำเร็จ' } : item
          )
        );
      }
    }

    setIsBatchScanning(false);
    setCurrentBatchIndex(-1);
  };

  // Re-scan a single item in batch
  const handleScanSingleBatchItem = async (itemId: string) => {
    const idx = batchItems.findIndex((b) => b.id === itemId);
    if (idx === -1) return;

    const prevClosing = idx > 0 ? batchItems[idx - 1]?.extractedData?.closingBalance : undefined;

    setBatchItems((prev) =>
      prev.map((it) => (it.id === itemId ? { ...it, status: 'scanning', errorMessage: undefined } : it))
    );

    try {
      const extracted = await scanSingleBatchItemData(batchItems[idx], prevClosing);
      setBatchItems((prev) =>
        prev.map((it) => (it.id === itemId ? { ...it, status: 'success', extractedData: extracted } : it))
      );
    } catch (err: any) {
      setBatchItems((prev) =>
        prev.map((it) =>
          it.id === itemId ? { ...it, status: 'error', errorMessage: err.message || 'อ่านไม่สำเร็จ' } : it
        )
      );
    }
  };

  // Remove single item from batch
  const handleRemoveBatchItem = (itemId: string) => {
    setBatchItems((prev) => {
      const next = prev.filter((it) => it.id !== itemId);
      if (next.length === 0) {
        setIsBatchMode(false);
      }
      return next;
    });
    if (previewBatchItemId === itemId) {
      setPreviewBatchItemId(null);
    }
  };

  // Confirm and save all successful batch items
  const handleConfirmSaveBatch = async () => {
    const readyItems = batchItems.filter((it) => it.status === 'success' && it.extractedData);
    if (readyItems.length === 0) {
      setNotification({
        type: 'info',
        title: 'ไม่มีรายการที่พร้อมบันทึก',
        message: 'กรุณารอ AI อ่านเอกสาร Statement หรือตรวจสอบไฟล์ที่อ่านสำเร็จก่อนบันทึก',
      });
      return;
    }

    setIsSavingBatch(true);
    let savedCount = 0;
    let totalTxCount = 0;
    let chainedPrevClosing: number | undefined = undefined;

    try {
      for (const item of readyItems) {
        const extracted = item.extractedData!;
        let targetId = scanTargetAccountId;
        const stmtProjId = extracted.projectId || '';
        const stmtProj = stmtProjId ? projectsMap[stmtProjId] : undefined;
        const stmtProjName = stmtProj ? getProjectDisplayName(stmtProj) : '';

        // Auto match or create account if targetId is empty or 'new'
        if (!targetId || targetId === 'new') {
          const cleanExt = (extracted.accountNumber || '').replace(/[^0-9]/g, '');
          const matched = bankAccounts.find(
            (b) => cleanExt && b.accountNumber.replace(/[^0-9]/g, '') === cleanExt
          );
          if (matched) {
            targetId = matched.id;
          } else {
            try {
              targetId = await saveBankAccount({
                accountNumber: extracted.accountNumber || '000-0-00000-0',
                bankName: extracted.bankName || 'ธนาคารทั่วไป',
                bankCode: extracted.bankCode || 'OTHER',
                accountName: extracted.accountName || 'บัญชีเงินฝากจาก Statement',
                branchName: extracted.branchName || '',
                assetType: 'savings',
                currentBalance: extracted.closingBalance,
                availableBalance: extracted.closingBalance,
                projectId: stmtProjId,
                projectName: stmtProjName,
                lastUpdatedDate: extracted.statementPeriodEnd || new Date().toISOString().slice(0, 10),
                notes: `สร้างอัตโนมัติจากการนำเข้า Statement โฟลเดอร์ (${item.fileName})`,
              });
            } catch (accErr) {
              console.warn('Auto create account in batch error:', accErr);
            }
          }
        }

        const rawOpening = cleanNumericAmount(extracted.openingBalance);
        const firstRowBal = cleanNumericAmount(extracted.transactions?.[0]?.balance);
        const firstRowDesc = extracted.transactions?.[0]?.description || '';
        const firstIsBf = firstRowDesc.includes('ยอดยกมา') || firstRowDesc.includes('Brought Forward');

        const effectiveOpening =
          !firstIsBf &&
          (rawOpening === 0 || (firstRowBal !== 0 && Math.abs(rawOpening - firstRowBal) < 0.01)) &&
          chainedPrevClosing !== undefined &&
          chainedPrevClosing !== 0
            ? chainedPrevClosing
            : rawOpening;

        const normalizedList = normalizeStatementTransactionsList(
          extracted.transactions,
          effectiveOpening
        );
        const finalTransactions = normalizedList.map((norm) => {
          const txPid = norm.projectId || stmtProjId || '';
          const txProj = txPid ? projectsMap[txPid] : undefined;
          return {
            ...norm,
            projectId: txPid,
            projectName: txProj ? getProjectDisplayName(txProj) : '',
          };
        });

        const lastTxBal = cleanNumericAmount(finalTransactions[finalTransactions.length - 1]?.balance);
        const closingBalVal = cleanNumericAmount(extracted.closingBalance) || lastTxBal;
        if (closingBalVal !== 0) {
          chainedPrevClosing = closingBalVal;
        }

        // Only overwrite if it's the EXACT same filename or exact same page (same account, period, opening/closing balance & tx count)
        const existingMatch = statementRecords.find((s) => {
          const sameFile = Boolean(
            item.fileName && s.fileName && s.fileName.trim().toLowerCase() === item.fileName.trim().toLowerCase()
          );
          const cleanSAcc = (s.accountNumber || '').replace(/[^0-9]/g, '');
          const cleanExtAcc = (extracted.accountNumber || '').replace(/[^0-9]/g, '');
          const sameAcc = Boolean(cleanSAcc && cleanExtAcc && cleanSAcc === cleanExtAcc);
          const samePeriod = Boolean(
            s.statementPeriodStart &&
            extracted.statementPeriodStart &&
            s.statementPeriodStart === extracted.statementPeriodStart &&
            s.statementPeriodEnd === extracted.statementPeriodEnd
          );
          const sameBalances =
            Math.abs(cleanNumericAmount(s.openingBalance) - (effectiveOpening || rawOpening)) < 0.01 &&
            Math.abs(cleanNumericAmount(s.closingBalance) - closingBalVal) < 0.01 &&
            (s.transactions?.length || 0) === finalTransactions.length;

          return sameFile || (sameAcc && samePeriod && sameBalances);
        });

        const totalDebitVal =
          Math.round(finalTransactions.reduce((s, tx) => s + (Number(tx.debitAmount) || 0), 0) * 100) / 100 ||
          extracted.totalDebit;
        const totalCreditVal =
          Math.round(finalTransactions.reduce((s, tx) => s + (Number(tx.creditAmount) || 0), 0) * 100) / 100 ||
          extracted.totalCredit;

        await saveStatementRecord(
          {
            id: existingMatch?.id,
            accountId: targetId,
            accountNumber: extracted.accountNumber,
            bankName: extracted.bankName,
            accountName: extracted.accountName,
            projectId: stmtProjId,
            projectName: stmtProjName,
            statementPeriodStart: extracted.statementPeriodStart,
            statementPeriodEnd: extracted.statementPeriodEnd,
            openingBalance: effectiveOpening || rawOpening,
            closingBalance: closingBalVal,
            totalDebit: totalDebitVal,
            totalCredit: totalCreditVal,
            transactions: finalTransactions,
            fileName: item.fileName,
            rawOcrSummary: extracted.ocrNotes,
          },
          true
        );

        savedCount++;
        totalTxCount += finalTransactions.length;
      }

      setNotification({
        type: 'success',
        title: 'บันทึก Statement สำเร็จ',
        message: `นำเข้า Statement จากโฟลเดอร์สำเร็จ ${savedCount} ไฟล์ (${totalTxCount} รายการเดินบัญชี)`,
      });

      setIsStatementScanModalOpen(false);
      setActiveSubTab('transactions');
    } catch (err: any) {
      setNotification({
        type: 'error',
        title: 'บันทึก Statement ไม่สำเร็จ',
        message: err.message || 'เกิดข้อผิดพลาดในการบันทึก Statement',
      });
    } finally {
      setIsSavingBatch(false);
    }
  };

  // Run AI Statement OCR
  const handleScanStatementAI = async () => {
    if (!statementBase64 || !statementFile) {
      setScanError('กรุณาเลือกไฟล์รายงานสินทรัพย์หมุนเวียน (Statement) ก่อน');
      return;
    }

    setIsScanningStatement(true);
    setScanError(null);

    try {
      const json = await safeFetchStatementOcr({
        fileName: statementFile.name,
        imageBase64: statementBase64,
        mimeType: statementFile.type || (statementFile.name.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg'),
        isConfidential: false,
      });

      const d = json.data;
      const targetAcc = bankAccounts.find((b) => b.id === scanTargetAccountId);
      const initialProjId = targetAcc?.projectId || (selectedProjectFilter !== 'all' && selectedProjectFilter !== 'general' ? selectedProjectFilter : '');
      const initialProj = initialProjId ? projectsMap[initialProjId] : undefined;
      const initialProjName = initialProj ? getProjectDisplayName(initialProj) : undefined;

      const normalizedTxs = normalizeStatementTransactionsList(
        Array.isArray(d.transactions) ? d.transactions : [],
        cleanNumericAmount(d.openingBalance)
      ).map((norm) => ({
        ...norm,
        date: normalizeDateISO(norm.date) || norm.date,
        projectId: initialProjId || undefined,
        projectName: initialProjName,
      }));

      const totalDebitVal =
        cleanNumericAmount(d.totalDebit) ||
        Math.round(normalizedTxs.reduce((s, tx) => s + (tx.debitAmount || 0), 0) * 100) / 100;
      const totalCreditVal =
        cleanNumericAmount(d.totalCredit) ||
        Math.round(normalizedTxs.reduce((s, tx) => s + (tx.creditAmount || 0), 0) * 100) / 100;

      setExtractedStatement({
        bankName: d.bankName || 'ธนาคารกสิกรไทย',
        bankCode: d.bankCode || 'KBANK',
        accountNumber: d.accountNumber || '',
        accountName: d.accountName || '',
        branchName: d.branchName || '',
        projectId: initialProjId,
        statementPeriodStart: normalizeDateISO(d.statementPeriodStart) || '',
        statementPeriodEnd: normalizeDateISO(d.statementPeriodEnd) || '',
        openingBalance: cleanNumericAmount(d.openingBalance),
        closingBalance: cleanNumericAmount(d.closingBalance),
        totalDebit: totalDebitVal,
        totalCredit: totalCreditVal,
        transactions: normalizedTxs,
        totalPagesRead: d.totalPagesRead || 1,
        ocrNotes: d.ocrNotes || '',
      });

      // Try auto-matching target account
      if (d.accountNumber) {
        const cleanExtracted = d.accountNumber.replace(/[^0-9]/g, '');
        const matched = bankAccounts.find(
          (b) => b.accountNumber.replace(/[^0-9]/g, '') === cleanExtracted
        );
        if (matched) {
          setScanTargetAccountId(matched.id);
          if (matched.projectId) {
            const matchedProj = projectsMap[matched.projectId || ''];
            const matchedProjName = matchedProj ? getProjectDisplayName(matchedProj) : undefined;
            setExtractedStatement((prev) => prev ? {
              ...prev,
              projectId: matched.projectId,
              transactions: prev.transactions.map((t) => ({
                ...t,
                projectId: t.projectId || matched.projectId,
                projectName: matchedProjName,
              })),
            } : null);
          }
        }
      }
    } catch (err: any) {
      console.error('Statement OCR error:', err);
      setScanError(err.message || 'ไม่สามารถอ่านไฟล์ Statement ได้');
    } finally {
      setIsScanningStatement(false);
    }
  };

  // Confirm and Save Statement
  const handleConfirmSaveStatement = async () => {
    if (!extractedStatement) return;

    let targetId = scanTargetAccountId;
    const stmtProjId = extractedStatement.projectId || undefined;
    const stmtProj = stmtProjId ? projectsMap[stmtProjId] : undefined;
    const stmtProjName = stmtProj ? getProjectDisplayName(stmtProj) : undefined;

    // If no existing account selected, prompt to create one automatically
    if (!targetId || targetId === 'new') {
      try {
        targetId = await saveBankAccount({
          accountNumber: extractedStatement.accountNumber || '000-0-00000-0',
          bankName: extractedStatement.bankName || 'ธนาคารทั่วไป',
          bankCode: extractedStatement.bankCode || 'OTHER',
          accountName: extractedStatement.accountName || 'บัญชีเงินฝากจาก Statement',
          branchName: extractedStatement.branchName || '',
          assetType: 'savings',
          currentBalance: extractedStatement.closingBalance,
          availableBalance: extractedStatement.closingBalance,
          projectId: stmtProjId,
          projectName: stmtProjName,
          lastUpdatedDate: extractedStatement.statementPeriodEnd || new Date().toISOString().slice(0, 10),
          notes: `สร้างอัตโนมัติจากการนำเข้า Statement (${statementFile?.name || ''})`,
        });
      } catch (err: any) {
        console.warn('Auto create account notice:', err);
      }
    }

    try {
      const normalizedList = normalizeStatementTransactionsList(
        extractedStatement.transactions,
        extractedStatement.openingBalance
      );
      const finalTransactions = normalizedList.map((norm) => {
        const txPid = norm.projectId || stmtProjId;
        const txProj = txPid ? projectsMap[txPid] : undefined;
        return {
          ...norm,
          projectId: txPid || undefined,
          projectName: txProj ? getProjectDisplayName(txProj) : undefined,
        };
      });

      // Check if statement already exists (match exact filename or exact page balances)
      const existingMatch = statementRecords.find((s) => {
        const sameFile = Boolean(
          statementFile?.name && s.fileName && s.fileName.trim().toLowerCase() === statementFile.name.trim().toLowerCase()
        );
        const cleanSAcc = (s.accountNumber || '').replace(/[^0-9]/g, '');
        const cleanExtAcc = (extractedStatement.accountNumber || '').replace(/[^0-9]/g, '');
        const sameAcc = Boolean(cleanSAcc && cleanExtAcc && cleanSAcc === cleanExtAcc);
        const samePeriod = Boolean(
          s.statementPeriodStart &&
          extractedStatement.statementPeriodStart &&
          s.statementPeriodStart === extractedStatement.statementPeriodStart &&
          s.statementPeriodEnd === extractedStatement.statementPeriodEnd
        );
        const sameBalances =
          Math.abs(cleanNumericAmount(s.openingBalance) - cleanNumericAmount(extractedStatement.openingBalance)) < 0.01 &&
          Math.abs(cleanNumericAmount(s.closingBalance) - cleanNumericAmount(extractedStatement.closingBalance)) < 0.01 &&
          (s.transactions?.length || 0) === finalTransactions.length;

        return sameFile || (sameAcc && samePeriod && sameBalances);
      });

      await saveStatementRecord(
        {
          id: existingMatch?.id, // Overwrite existing duplicate if found
          accountId: targetId,
          accountNumber: extractedStatement.accountNumber,
          bankName: extractedStatement.bankName,
          accountName: extractedStatement.accountName,
          projectId: stmtProjId,
          projectName: stmtProjName,
          statementPeriodStart: extractedStatement.statementPeriodStart,
          statementPeriodEnd: extractedStatement.statementPeriodEnd,
          openingBalance: extractedStatement.openingBalance,
          closingBalance: extractedStatement.closingBalance,
          totalDebit: extractedStatement.totalDebit,
          totalCredit: extractedStatement.totalCredit,
          transactions: finalTransactions,
          fileName: statementFile?.name || 'statement.pdf',
          rawOcrSummary: extractedStatement.ocrNotes,
        },
        true // Update bank account balance
      );

      setNotification({
        type: 'success',
        title: existingMatch ? 'อัปเดตและคำนวณข้อมูลทับฉบับเดิมสำเร็จ' : 'บันทึกรายงาน Statement สำเร็จ',
        message: existingMatch
          ? `อัปเดตและคำนวณยอดเงินเข้า-ออกทับ Statement เดิม ${extractedStatement.transactions.length} รายการเรียบร้อยแล้ว (ไม่เกิดรายการซ้ำ)`
          : `นำเข้า ${extractedStatement.transactions.length} รายการเดินบัญชี ยอดคงเหลือล่าสุดปรับเป็น ${formatCurrency(extractedStatement.closingBalance)} เรียบร้อยแล้ว`,
      });
      setIsStatementScanModalOpen(false);
      setActiveSubTab('transactions');
    } catch (err: any) {
      setNotification({
        type: 'error',
        title: 'บันทึก Statement ไม่สำเร็จ',
        message: err.message || 'เกิดข้อผิดพลาดในการบันทึก Statement',
      });
    }
  };

  // Export CSV
  const handleExportCSV = () => {
    if (filteredTransactions.length === 0) {
      setNotification({
        type: 'info',
        title: 'ไม่มีรายการ',
        message: 'ไม่มีรายการเดินบัญชีตรงตามเงื่อนไขเพื่อส่งออก',
      });
      return;
    }

    const headers = ['วันที่', 'เวลา', 'โครงการ', 'ธนาคาร', 'เลขที่บัญชี', 'รายการ', 'ช่องทาง', 'เงินออก (ถอน)', 'เงินเข้า (ฝาก)', 'ยอดคงเหลือ', 'เลขอ้างอิง'];
    const rows = filteredTransactions.map((t) => [
      t.date || '',
      t.time || '',
      `"${t.projectName || 'ส่วนกลาง'}"`,
      `"${t.bankName || ''}"`,
      `"${t.accountNumber || ''}"`,
      `"${(t.description || '').replace(/"/g, '""')}"`,
      `"${t.channel || ''}"`,
      t.debitAmount || 0,
      t.creditAmount || 0,
      t.balance || 0,
      `"${t.referenceNo || ''}"`,
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `statement_transactions_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 max-w-7xl">
      {/* Header & Quick Action Buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-xl sm:text-2xl font-semibold text-slate-900 tracking-tight">
            สินทรัพย์หมุนเวียน & รายการเดินบัญชี
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            จัดการบัญชีเงินฝากธนาคาร สินทรัพย์สภาพคล่อง และสกัดข้อมูล Statement อัตโนมัติ
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleOpenFolderUpload}
            className="flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-lg text-xs font-medium transition-colors cursor-pointer"
            title="อัปโหลดไฟล์ Statement ทั้งโฟลเดอร์"
          >
            <FolderUp className="w-3.5 h-3.5 text-slate-500" />
            อัปโหลดโฟลเดอร์
          </button>

          <button
            onClick={() => handleOpenStatementScan()}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-[#0F766E] hover:bg-[#0D645D] text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5" />
            อ่าน Statement ด้วย AI
          </button>

          <button
            onClick={() => handleOpenAccountModal()}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 text-teal-700" />
            เพิ่มบัญชีธนาคาร
          </button>
        </div>
      </div>

      {/* Unified 4-Column Financial Ledger Strip */}
      <div className="bg-white border border-slate-200/80 rounded-xl overflow-hidden grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 lg:divide-x divide-slate-200/80">
        {/* Cell 1: Total Current Assets */}
        <div className="p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[12px] font-medium text-slate-500">
                {selectedProjectFilter === 'all'
                  ? 'สินทรัพย์หมุนเวียนรวม'
                  : selectedProjectFilter === 'general'
                  ? 'สินทรัพย์หมุนเวียน (ส่วนกลาง)'
                  : `สินทรัพย์ (${getProjectDisplayName(projectsMap[selectedProjectFilter], 'โครงการ')})`}
              </span>
              <span className="text-[11px] font-mono text-emerald-700 font-medium">THB</span>
            </div>
            <div className="mt-2.5 text-[28px] leading-none font-bold text-slate-900 font-mono tabular-nums tracking-tight">
              {formatCurrency(selectedProjectFilter === 'all' ? totalAssetsBalance : filteredTotalBalance)}
            </div>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-100 text-[11px] text-slate-500">
            {selectedProjectFilter === 'all'
              ? `จากทั้งหมด ${bankAccounts.length} บัญชีสภาพคล่อง`
              : `${filteredBankAccounts.length} บัญชีในโครงการ · รวม ${formatCurrency(totalAssetsBalance)}`}
          </div>
        </div>

        {/* Cell 2: Total Bank Accounts */}
        <div className="p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[12px] font-medium text-slate-500">บัญชีธนาคารที่ลงทะเบียน</span>
              <Building2 className="w-3.5 h-3.5 text-slate-400" />
            </div>
            <div className="mt-2.5 text-[28px] leading-none font-bold text-slate-900 font-mono tabular-nums tracking-tight">
              {bankAccounts.length} <span className="text-xs font-normal text-slate-500">บัญชี</span>
            </div>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-100 text-[11px] text-slate-500">
            อัปเดตยอดคงเหลือตาม Statement ล่าสุด
          </div>
        </div>

        {/* Cell 3: Transactions & Statements */}
        <div className="p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[12px] font-medium text-slate-500">รายการเดินบัญชีทั้งหมด</span>
              <FileSpreadsheet className="w-3.5 h-3.5 text-slate-400" />
            </div>
            <div className="mt-2.5 text-[28px] leading-none font-bold text-slate-900 font-mono tabular-nums tracking-tight">
              {allTransactions.length} <span className="text-xs font-normal text-slate-500">รายการ</span>
            </div>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-100 text-[11px] text-slate-500 flex items-center justify-between gap-2">
            <span>จาก Statement {statementRecords.length} ฉบับ</span>
            {statementRecords.length > 0 && (
              <button
                onClick={handleRepairAllStatements}
                disabled={isRepairing}
                className="inline-flex items-center gap-1 text-teal-700 hover:text-teal-800 font-semibold text-[11px] transition cursor-pointer disabled:opacity-50"
                title="คำนวณยอดเดินบัญชีทั้งหมดและจัดระเบียบรายการ"
              >
                <RefreshCw className={`w-3 h-3 ${isRepairing ? 'animate-spin' : ''}`} />
                {isRepairing ? 'กำลังจัดระเบียบ...' : 'จัดระเบียบยอด'}
              </button>
            )}
          </div>
        </div>

        {/* Cell 4: AI Statement OCR Capabilities */}
        <div className="p-5 flex flex-col justify-between bg-slate-50/40">
          <div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[12px] font-medium text-teal-800">AI Statement OCR</span>
              <Sparkles className="w-3.5 h-3.5 text-teal-600" />
            </div>
            <p className="mt-2.5 text-xs text-slate-600 leading-relaxed">
              รองรับไฟล์ Statement PDF หลายหน้าและสลิป สกัดเลขบัญชี ธนาคาร และยอดเงินคงเหลืออัตโนมัติ
            </p>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-100 text-[11px]">
            <button
              onClick={() => handleOpenStatementScan()}
              className="text-teal-700 hover:text-teal-800 font-semibold cursor-pointer"
            >
              สแกนไฟล์ Statement →
            </button>
          </div>
        </div>
      </div>

      {/* Tabs navigation */}
      <div className="flex border-b border-slate-200 gap-6 text-xs sm:text-sm font-medium text-slate-500">
        <button
          onClick={() => setActiveSubTab('accounts')}
          className={`pb-3 border-b-2 transition-colors cursor-pointer flex items-center gap-2 ${
            activeSubTab === 'accounts'
              ? 'border-[#0F766E] text-slate-900 font-semibold'
              : 'border-transparent hover:text-slate-900'
          }`}
        >
          <Building2 className="w-4 h-4" />
          <span>บัญชีธนาคาร & สินทรัพย์</span>
          <span className="font-mono text-xs text-slate-400 tabular-nums">({bankAccounts.length})</span>
        </button>
        <button
          onClick={() => setActiveSubTab('transactions')}
          className={`pb-3 border-b-2 transition-colors cursor-pointer flex items-center gap-2 ${
            activeSubTab === 'transactions'
              ? 'border-[#0F766E] text-slate-900 font-semibold'
              : 'border-transparent hover:text-slate-900'
          }`}
        >
          <CreditCard className="w-4 h-4" />
          <span>รายการเดินบัญชี Statement</span>
          <span className="font-mono text-xs text-slate-400 tabular-nums">({allTransactions.length})</span>
        </button>
        <button
          onClick={() => setActiveSubTab('statements')}
          className={`pb-3 border-b-2 transition-colors cursor-pointer flex items-center gap-2 ${
            activeSubTab === 'statements'
              ? 'border-[#0F766E] text-slate-900 font-semibold'
              : 'border-transparent hover:text-slate-900'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>ไฟล์รายงาน Statement</span>
          <span className="font-mono text-xs text-slate-400 tabular-nums">({statementRecords.length})</span>
        </button>
      </div>

      {/* SUB-TAB 1: BANK ACCOUNTS CARDS */}
      {activeSubTab === 'accounts' && (
        <div className="space-y-4">
          {/* Project & Search Filter Bar for Accounts */}
          <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-[280px]">
              {/* Project Filter */}
              <div className="flex items-center gap-1.5">
                <span className="font-medium text-slate-500 flex items-center gap-1">
                  <FolderKanban className="w-3.5 h-3.5 text-teal-600" />
                  โครงการ:
                </span>
                <select
                  value={selectedProjectFilter}
                  onChange={(e) => setSelectedProjectFilter(e.target.value)}
                  className="px-3 py-1.5 border border-slate-200 rounded-lg bg-white text-slate-900 font-medium"
                >
                  <option value="all">-- ทุกโครงการ ({bankAccounts.length}) --</option>
                  <option value="general">ส่วนกลาง / ไม่ระบุโครงการ ({bankAccounts.filter((b) => !b.projectId).length})</option>
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

              {/* Search Bar */}
              <div className="relative flex-1 min-w-[180px]">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="ค้นหาชื่อบัญชี, เลขที่บัญชี, ธนาคาร..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-teal-600"
                />
              </div>
            </div>

            <div className="text-[11px] text-slate-500 font-mono tabular-nums">
              แสดง {filteredBankAccounts.length} / {bankAccounts.length} บัญชี
            </div>
          </div>

          {filteredBankAccounts.length === 0 ? (
            <div className="p-12 text-center bg-white rounded-xl border border-slate-200/80">
              <Landmark className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              {bankAccounts.length > 0 ? (
                <>
                  <h3 className="text-sm font-bold text-slate-800">
                    พบทั้งหมด {bankAccounts.length} บัญชี แต่ไม่มีบัญชีที่ตรงกับตัวกรองที่เลือก
                  </h3>
                  <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                    บัญชีของคุณถูกซ่อนเนื่องจากตัวกรองโครงการ{' '}
                    <span className="font-semibold text-slate-700">
                      ({selectedProjectFilter === 'general' ? 'ส่วนกลาง' : getProjectDisplayName(projectsMap[selectedProjectFilter]) || selectedProjectFilter})
                    </span>{' '}
                    หรือคำค้นหา "{searchQuery}"
                  </p>
                  <div className="flex items-center justify-center gap-3 mt-4">
                    <button
                      onClick={() => {
                        setSelectedProjectFilter('all');
                        setSearchQuery('');
                      }}
                      className="px-4 py-2 bg-[#0F766E] hover:bg-[#0D645D] text-white text-xs font-semibold rounded-lg cursor-pointer transition-colors"
                    >
                      ล้างตัวกรองทั้งหมด (แสดงทั้ง {bankAccounts.length} บัญชี)
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <h3 className="font-display text-sm font-semibold text-slate-800">ยังไม่พบบัญชีสินทรัพย์หมุนเวียนในระบบ</h3>
                  <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto leading-relaxed">
                    สามารถกดเพิ่มบัญชีธนาคารใหม่ หรือนำเข้าไฟล์ Statement เพื่อสร้างรายการเดินบัญชีอัตโนมัติได้ทันที
                  </p>
                  <div className="flex flex-wrap items-center justify-center gap-2.5 mt-4">
                    <button
                      onClick={() => handleOpenAccountModal()}
                      className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-800 text-xs font-semibold rounded-lg cursor-pointer transition-colors"
                    >
                      + เพิ่มบัญชีธนาคาร
                    </button>
                    <button
                      onClick={() => handleOpenStatementScan()}
                      className="px-4 py-2 bg-[#0D9488] hover:bg-teal-700 text-white text-xs font-bold rounded-xl cursor-pointer"
                    >
                      นำเข้า Statement ด้วย AI
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredBankAccounts.map((acc) => {
                const bankMeta = THAI_BANKS.find((b) => b.code === acc.bankCode) || {
                  color: '#475569',
                  textColor: '#ffffff',
                };

                const projName = acc.projectId
                  ? (getProjectDisplayName(projectsMap[acc.projectId], acc.projectName || 'โครงการ'))
                  : null;

                return (
                  <div
                    key={acc.id}
                    className="bg-white border border-slate-200/80 rounded-xl p-5 hover:border-slate-300 transition-colors flex flex-col justify-between"
                  >
                    <div>
                      {/* Bank Tag, Project Tag, and Action */}
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <div className="flex flex-wrap items-center gap-2 min-w-0">
                          <span
                            className="px-2 py-0.5 rounded-md text-[11px] font-semibold inline-flex items-center gap-1.5"
                            style={{ backgroundColor: bankMeta.color, color: bankMeta.textColor }}
                          >
                            <Building2 className="w-3 h-3" />
                            {acc.bankName}
                          </span>

                          {/* Project Label */}
                          <span className="text-[11px] text-slate-500 truncate max-w-[140px]">
                            · {projName || 'ส่วนกลาง'}
                          </span>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => handleOpenAccountModal(acc)}
                            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                            title="แก้ไขข้อมูลบัญชี"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setAccountToDelete(acc)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                            title="ลบบัญชี"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Account Number & Name */}
                      <div className="mb-3.5">
                        <div className="text-[11px] font-medium text-slate-400">
                          เลขที่บัญชี
                        </div>
                        <div className="text-base font-bold font-mono tabular-nums text-slate-900 tracking-wide mt-0.5">
                          {acc.accountNumber}
                        </div>
                        <div className="text-xs text-slate-600 font-medium mt-0.5 truncate">
                          {acc.accountName} {acc.branchName ? `(สาขา ${acc.branchName})` : ''}
                        </div>
                      </div>

                      {/* Hairline Current Balance Strip */}
                      <div className="py-3 border-y border-slate-100 mb-3">
                        <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1">
                          <span>ยอดเงินคงเหลือปัจจุบัน</span>
                          <span className="text-slate-400 font-mono tabular-nums text-[10px]">
                            {acc.lastUpdatedDate ? formatThaiDate(acc.lastUpdatedDate) : '-'}
                          </span>
                        </div>
                        <div className="text-xl font-bold font-mono tabular-nums text-slate-900">
                          {formatCurrency(acc.currentBalance)}
                        </div>
                      </div>
                    </div>

                    {/* Bottom Action Buttons */}
                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                      <button
                        onClick={() => {
                          setSelectedAccountId(acc.id);
                          setActiveSubTab('transactions');
                        }}
                        className="text-xs font-semibold text-slate-600 hover:text-teal-700 flex items-center gap-1 cursor-pointer"
                      >
                        <Clock className="w-3.5 h-3.5" />
                        ดูรายการเดินบัญชี ({allTransactions.filter((t) => t.accountId === acc.id).length})
                      </button>

                      <button
                        onClick={() => handleOpenStatementScan(acc.id)}
                        className="flex items-center gap-1 px-2.5 py-1 bg-teal-50 hover:bg-teal-100 text-teal-800 rounded-lg text-xs font-bold transition cursor-pointer"
                        title="สแกนอ่านไฟล์ Statement สำหรับบัญชีนี้"
                      >
                        <Upload className="w-3 h-3" />
                        อ่าน Statement
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* SUB-TAB 2: TRANSACTIONS LIST */}
      {activeSubTab === 'transactions' && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[280px]">
              {/* Project Filter */}
              <div className="flex items-center gap-1.5">
                <span className="font-medium text-slate-500 flex items-center gap-1">
                  <FolderKanban className="w-3.5 h-3.5 text-teal-600" />
                  โครงการ:
                </span>
                <select
                  value={selectedProjectFilter}
                  onChange={(e) => setSelectedProjectFilter(e.target.value)}
                  className="px-3 py-1.5 border border-slate-200 rounded-lg bg-white text-slate-900 font-medium"
                >
                  <option value="all">-- ทุกโครงการ --</option>
                  <option value="general">ส่วนกลาง / ไม่ระบุโครงการ</option>
                  {projects.map((p) => (
                    <option key={p.projectId} value={p.projectId}>
                      {getProjectDisplayName(p)}
                    </option>
                  ))}
                </select>
              </div>

              {/* Account Selector */}
              <div className="flex items-center gap-1.5">
                <span className="font-medium text-slate-500">บัญชี:</span>
                <select
                  value={selectedAccountId}
                  onChange={(e) => setSelectedAccountId(e.target.value)}
                  className="px-3 py-1.5 border border-slate-200 rounded-lg bg-white text-slate-900 font-medium"
                >
                  <option value="all">-- ทุกบัญชีธนาคาร --</option>
                  {bankAccounts.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.bankName} - {b.accountNumber} ({b.accountName})
                    </option>
                  ))}
                </select>
              </div>

              {/* Search Bar */}
              <div className="relative flex-1 min-w-[180px]">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="ค้นหารายการ, เลขอ้างอิง, คำอธิบาย, โครงการ..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-teal-600"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleRepairAllStatements}
                disabled={isRepairing || statementRecords.length === 0}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 disabled:opacity-50 text-teal-800 border border-slate-200 rounded-lg font-medium transition-colors cursor-pointer"
                title="คำนวณยอดเงินเข้า-ออกและลบ Statement ฉบับซ้ำอัตโนมัติ"
              >
                {isRepairing ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-teal-600" />
                ) : (
                  <RefreshCw className="w-3.5 h-3.5 text-teal-600" />
                )}
                <span>{isRepairing ? 'กำลังซ่อมแซม...' : 'คำนวณและซ่อมแซมยอดเงิน'}</span>
              </button>

              <button
                onClick={handleExportCSV}
                disabled={filteredTransactions.length === 0}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 disabled:opacity-50 text-slate-700 border border-slate-200 rounded-lg font-medium transition-colors cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                ส่งออก CSV
              </button>
            </div>
          </div>

          {/* Transactions Table */}
          <div className="bg-white border border-slate-200/80 rounded-xl overflow-hidden">
            <div className="overflow-x-auto max-h-[550px]">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50/80 text-slate-500 font-semibold border-b border-slate-200 sticky top-0 text-[11px] z-10">
                  <tr>
                    <th className="py-3 px-3.5">วันที่ & เวลา</th>
                    <th className="py-3 px-3.5">โครงการ</th>
                    <th className="py-3 px-3.5">ธนาคาร / บัญชี</th>
                    <th className="py-3 px-3.5">รายการ (Description)</th>
                    <th className="py-3 px-3.5">ช่องทาง</th>
                    <th className="py-3 px-3.5 text-right text-rose-600">เงินออก (ถอน)</th>
                    <th className="py-3 px-3.5 text-right text-emerald-600">เงินเข้า (ฝาก)</th>
                    <th className="py-3 px-3.5 text-right">ยอดคงเหลือ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredTransactions.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-500">
                        {allTransactions.length > 0 ? (
                          <div className="max-w-md mx-auto space-y-2">
                            <p className="font-bold text-slate-700 text-xs">
                              มีรายการเดินบัญชีทั้งหมด {allTransactions.length} รายการ แต่ไม่พบตามเงื่อนไขตัวกรอง
                            </p>
                            <p className="text-[11px] text-slate-400">
                              ตัวกรองปัจจุบัน: บัญชี{' '}
                              <span className="font-semibold text-slate-600">
                                ({selectedAccountId === 'all' ? 'ทุกบัญชี' : bankAccountsMap[selectedAccountId]?.accountName || selectedAccountId})
                              </span>
                              , โครงการ{' '}
                              <span className="font-semibold text-slate-600">
                                ({selectedProjectFilter === 'all' ? 'ทุกโครงการ' : selectedProjectFilter === 'general' ? 'ส่วนกลาง' : getProjectDisplayName(projectsMap[selectedProjectFilter]) || selectedProjectFilter})
                              </span>
                              {searchQuery && `, คำค้น: "${searchQuery}"`}
                            </p>
                            <button
                              onClick={() => {
                                setSelectedAccountId('all');
                                setSelectedProjectFilter('all');
                                setSearchQuery('');
                              }}
                              className="px-3.5 py-1.5 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-lg text-xs cursor-pointer inline-flex items-center gap-1 shadow-xs"
                            >
                              ล้างตัวกรองทั้งหมด (แสดงทั้ง {allTransactions.length} รายการ)
                            </button>
                          </div>
                        ) : (
                          <div className="max-w-md mx-auto space-y-2.5">
                            <p className="font-bold text-slate-700 text-xs">
                              ยังไม่มีรายการเดินบัญชี Statement ในระบบ
                            </p>
                            <p className="text-[11px] text-slate-400 leading-relaxed">
                              คลิก "อ่าน Statement ด้วย AI" เพื่อนำเข้าและแสดงผลรายการเดินบัญชีในระบบ
                            </p>
                            <div className="flex items-center justify-center gap-2 pt-1">
                              <button
                                onClick={() => handleOpenStatementScan()}
                                className="px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-lg text-xs cursor-pointer inline-flex items-center gap-1 shadow-xs"
                              >
                                <Upload className="w-3.5 h-3.5" />
                                อ่าน Statement ด้วย AI
                              </button>
                            </div>
                          </div>
                        )}
                      </td>
                    </tr>
                  ) : (
                    filteredTransactions.map((tx, idx) => {
                      const debitVal = cleanNumericAmount(tx.debitAmount);
                      const creditVal = cleanNumericAmount(tx.creditAmount);
                      const balanceVal = cleanNumericAmount(tx.balance);
                      const isDebit = debitVal > 0;
                      const isCredit = creditVal > 0;

                      return (
                        <tr key={tx.id || idx} className="hover:bg-slate-50/70 transition">
                          <td className="py-2.5 px-3.5 whitespace-nowrap">
                            <div className="font-medium text-slate-900">{formatThaiDate(tx.date)}</div>
                            {tx.time && <div className="text-[10px] text-slate-400 font-mono">{tx.time}</div>}
                          </td>
                          <td className="py-2.5 px-3.5 whitespace-nowrap">
                            {tx.projectId ? (
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-teal-50 text-teal-800 border border-teal-200 inline-flex items-center gap-1 max-w-[130px] truncate">
                                <FolderKanban className="w-3 h-3 text-teal-600 shrink-0" />
                                <span className="truncate">{getProjectDisplayName(projectsMap[tx.projectId], tx.projectName || 'โครงการ')}</span>
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-slate-100 text-slate-600">
                                ส่วนกลาง
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3.5 whitespace-nowrap">
                            <span className="font-semibold text-slate-800 block">{tx.bankName}</span>
                            <span className="font-mono text-[11px] text-slate-400">{tx.accountNumber}</span>
                          </td>
                          <td className="py-2.5 px-3.5 max-w-xs">
                            <div className="font-medium text-slate-900 line-clamp-2">{tx.description}</div>
                            {tx.referenceNo && (
                              <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                                Ref: {tx.referenceNo}
                              </div>
                            )}
                          </td>
                          <td className="py-2.5 px-3.5 whitespace-nowrap text-slate-500 font-mono text-[11px]">
                            {tx.channel || '-'}
                          </td>
                          <td className="py-2.5 px-3.5 text-right font-mono font-bold text-rose-600 whitespace-nowrap">
                            {isDebit ? `-${formatCurrency(debitVal)}` : '-'}
                          </td>
                          <td className="py-2.5 px-3.5 text-right font-mono font-bold text-emerald-600 whitespace-nowrap">
                            {isCredit ? `+${formatCurrency(creditVal)}` : '-'}
                          </td>
                          <td className="py-2.5 px-3.5 text-right font-mono font-bold text-slate-900 whitespace-nowrap">
                            {formatCurrency(balanceVal)}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 3: STATEMENTS LIST */}
      {activeSubTab === 'statements' && (
        <div className="space-y-4">
          {/* Project Filter for Statements */}
          <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-slate-600 flex items-center gap-1">
                <FolderKanban className="w-3.5 h-3.5 text-teal-600" />
                โครงการ:
              </span>
              <select
                value={selectedProjectFilter}
                onChange={(e) => setSelectedProjectFilter(e.target.value)}
                className="px-3 py-1.5 border border-slate-300 rounded-lg bg-white text-slate-900 font-medium"
              >
                <option value="all">-- ทุกโครงการ ({statementRecords.length}) --</option>
                <option value="general">ส่วนกลาง / ไม่ระบุโครงการ ({statementRecords.filter((s) => !s.projectId).length})</option>
                {projects.map((p) => {
                  const count = statementRecords.filter((s) => s.projectId === p.projectId).length;
                  return (
                    <option key={p.projectId} value={p.projectId}>
                      {getProjectDisplayName(p)} ({count})
                    </option>
                  );
                })}
              </select>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-[11px] text-slate-500 font-medium">
                แสดง {statementRecords.filter((s) => {
                  if (selectedProjectFilter === 'all') return true;
                  if (selectedProjectFilter === 'general') return !s.projectId;
                  return s.projectId === selectedProjectFilter;
                }).length} จาก {statementRecords.length} ฉบับ
              </span>

              <button
                onClick={handleRepairAllStatements}
                disabled={isRepairing || statementRecords.length === 0}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 hover:bg-amber-100 disabled:opacity-50 text-amber-800 border border-amber-200 rounded-lg text-xs font-semibold transition cursor-pointer"
                title="คำนวณยอดเงินเข้า-ออกใหม่และลบ Statement ที่ซ้ำ"
              >
                {isRepairing ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-600" />
                ) : (
                  <RotateCcw className="w-3.5 h-3.5 text-amber-600" />
                )}
                <span>{isRepairing ? 'กำลังจัดระเบียบ...' : 'ล้างฉบับซ้ำ & คำนวณยอดใหม่'}</span>
              </button>
            </div>
          </div>

          {statementRecords.filter((s) => {
            if (selectedProjectFilter === 'all') return true;
            if (selectedProjectFilter === 'general') return !s.projectId;
            return s.projectId === selectedProjectFilter;
          }).length === 0 ? (
            <div className="p-12 text-center bg-white rounded-2xl border border-slate-200">
              <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              {statementRecords.length > 0 ? (
                <>
                  <h3 className="text-sm font-bold text-slate-800">
                    พบทั้งหมด {statementRecords.length} ฉบับ แต่ไม่มีฉบับที่ตรงกับตัวกรองโครงการที่เลือก
                  </h3>
                  <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                    ตัวกรองปัจจุบัน: โครงการ{' '}
                    <span className="font-semibold text-slate-700">
                      ({selectedProjectFilter === 'general' ? 'ส่วนกลาง' : getProjectDisplayName(projectsMap[selectedProjectFilter]) || selectedProjectFilter})
                    </span>
                  </p>
                  <div className="flex items-center justify-center gap-3 mt-4">
                    <button
                      onClick={() => setSelectedProjectFilter('all')}
                      className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-xl cursor-pointer shadow-xs"
                    >
                      ล้างตัวกรองโครงการ (แสดงทั้ง {statementRecords.length} ฉบับ)
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <h3 className="text-sm font-bold text-slate-700">ยังไม่มีรายงาน Statement ในระบบ</h3>
                  <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto leading-relaxed">
                    นำเข้าไฟล์ Statement (PDF หรือภาพ) เพื่อจัดเก็บและแสดงรายการเดินบัญชีอัตโนมัติ
                  </p>
                  <div className="flex flex-wrap items-center justify-center gap-3 mt-4">
                    <button
                      onClick={() => handleOpenStatementScan()}
                      className="px-4 py-2 bg-[#0D9488] hover:bg-teal-700 text-white text-xs font-bold rounded-xl cursor-pointer shadow-xs"
                    >
                      + นำเข้า Statement ด้วย AI
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {statementRecords
                .filter((s) => {
                  if (selectedProjectFilter === 'all') return true;
                  if (selectedProjectFilter === 'general') return !s.projectId;
                  return s.projectId === selectedProjectFilter;
                })
                .map((stmt) => (
                  <div
                    key={stmt.id}
                    className="bg-white border border-slate-200/80 rounded-xl p-5 flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-3 pb-2.5 border-b border-slate-100">
                        <div className="flex items-center gap-2 min-w-0">
                          <FileText className="w-4 h-4 text-teal-600 shrink-0" />
                          <span className="font-semibold text-xs text-slate-900 truncate">{stmt.fileName || 'รายงาน Statement'}</span>
                          <span className="text-[11px] text-slate-400 shrink-0 truncate">
                            · {stmt.projectId ? getProjectDisplayName(projectsMap[stmt.projectId], stmt.projectName || 'โครงการ') : 'ส่วนกลาง'}
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-400 font-mono tabular-nums shrink-0">
                          {stmt.uploadedAt ? formatThaiDate(stmt.uploadedAt) : ''}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2.5 text-xs mb-3">
                        <div>
                          <span className="text-slate-400 block text-[11px]">ธนาคาร</span>
                          <span className="font-semibold text-slate-800">{stmt.bankName}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[11px]">เลขที่บัญชี</span>
                          <span className="font-semibold font-mono tabular-nums text-slate-800">{stmt.accountNumber}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[11px]">ยอดยกมา</span>
                          <span className="font-mono tabular-nums text-slate-700">{formatCurrency(stmt.openingBalance)}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[11px]">ยอดคงเหลือยกไป</span>
                          <span className="font-mono tabular-nums font-bold text-slate-900">{formatCurrency(stmt.closingBalance)}</span>
                        </div>
                      </div>

                      <div className="py-2.5 border-t border-slate-100 text-xs flex items-center justify-between text-slate-500 font-mono tabular-nums">
                        <span className="font-sans">จำนวน {stmt.transactions?.length || 0} รายการ</span>
                        <span className="text-emerald-700 font-semibold">+{formatCurrency(stmt.totalCredit || 0)}</span>
                        <span className="text-rose-700 font-semibold">-{formatCurrency(stmt.totalDebit || 0)}</span>
                      </div>
                    </div>

                    <div className="pt-3 mt-3 border-t border-slate-100 flex items-center justify-between">
                      <button
                        onClick={() => {
                          setSelectedAccountId(stmt.accountId);
                          setActiveSubTab('transactions');
                        }}
                        className="text-xs font-semibold text-teal-700 hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        เปิดดูรายการ ({stmt.transactions?.length || 0})
                      </button>
                      {isAdmin && (
                        <button
                          onClick={() => setStatementToDelete(stmt)}
                          className="p-1 text-slate-400 hover:text-rose-600 rounded transition cursor-pointer"
                          title="ลบ Statement"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      )}

      {/* MODAL 1: ADD / EDIT BANK ACCOUNT */}
      {isAddAccountModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2">
                <Landmark className="w-5 h-5 text-teal-600" />
                <h3 className="text-base font-bold text-slate-900">
                  {editingAccount ? 'แก้ไขบัญชีสินทรัพย์หมุนเวียน' : 'เพิ่มบัญชีธนาคาร / สินทรัพย์หมุนเวียนใหม่'}
                </h3>
              </div>
              <button
                onClick={() => setIsAddAccountModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveAccountSubmit} className="space-y-4 text-xs">
              {formError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
                  <span className="font-medium">{formError}</span>
                </div>
              )}

              {/* Bank Name Selector */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  ชื่อธนาคาร / สถาบันการเงิน: <span className="text-rose-500">*</span>
                </label>
                <select
                  value={accountForm.bankCode}
                  onChange={(e) => {
                    const found = THAI_BANKS.find((b) => b.code === e.target.value);
                    setAccountForm({
                      ...accountForm,
                      bankCode: e.target.value,
                      bankName: found ? found.name : 'ธนาคารทั่วไป',
                    });
                  }}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 bg-white"
                  required
                >
                  {THAI_BANKS.map((b) => (
                    <option key={b.code} value={b.code}>
                      {b.name} ({b.code})
                    </option>
                  ))}
                </select>
                {accountForm.bankCode === 'OTHER' && (
                  <input
                    type="text"
                    placeholder="ระบุชื่อธนาคาร / สถาบันการเงินที่ต้องการ..."
                    value={accountForm.bankName}
                    onChange={(e) => setAccountForm({ ...accountForm, bankName: e.target.value })}
                    className="w-full mt-2 px-3 py-2 border border-slate-300 rounded-lg text-slate-900 bg-white"
                    required
                  />
                )}
              </div>

              {/* Account Number */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  เลขที่บัญชี: <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="เช่น 123-4-56789-0 หรือ 045-2-12345-6"
                  value={accountForm.accountNumber}
                  onChange={(e) => setAccountForm({ ...accountForm, accountNumber: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 font-mono text-sm"
                  required
                />
              </div>

              {/* Account Name */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  ชื่อบัญชี / ชื่อเจ้าของบัญชี: <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="เช่น บจก. โปรเกรสซีฟ แอคเคาท์ติ้ง (บัญชีดำเนินงาน)"
                  value={accountForm.accountName}
                  onChange={(e) => setAccountForm({ ...accountForm, accountName: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900"
                  required
                />
              </div>

              {/* Branch Name & Asset Type */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">สาขา:</label>
                  <input
                    type="text"
                    placeholder="เช่น สำนักงานใหญ่, สยามสแควร์"
                    value={accountForm.branchName}
                    onChange={(e) => setAccountForm({ ...accountForm, branchName: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    ประเภทสินทรัพย์:
                  </label>
                  <select
                    value={accountForm.assetType}
                    onChange={(e) => setAccountForm({ ...accountForm, assetType: e.target.value as AssetType })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 bg-white"
                  >
                    {ASSET_TYPES.map((t) => (
                      <option key={t.type} value={t.type}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Project Association */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  โครงการที่ผูกกับบัญชีนี้ (Project):
                </label>
                <select
                  value={accountForm.projectId}
                  onChange={(e) => setAccountForm({ ...accountForm, projectId: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 bg-white"
                >
                  <option value="">ส่วนกลาง / ไม่ระบุโครงการ (General / Corporate)</option>
                  {projects.map((p) => (
                    <option key={p.projectId} value={p.projectId}>
                      {getProjectDisplayName(p)}
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-slate-400 mt-1">
                  * เลือกระบุโครงการหากต้องการบันทึกและแยกสินทรัพย์หมุนเวียนเฉพาะโครงการ หรือเลือก "ส่วนกลาง"
                </p>
              </div>

              {/* Current Balance */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  ยอดเงินคงเหลือปัจจุบัน (บาท): <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={accountForm.currentBalance}
                  onChange={(e) =>
                    setAccountForm({
                      ...accountForm,
                      currentBalance: e.target.value === '' ? '' : parseFloat(e.target.value),
                    })
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 font-mono text-sm"
                  required
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  * เมื่อนำเข้า Statement ยอดนี้จะถูกปรับปรุงตามยอดคงเหลือยกไปอัตโนมัติ
                </p>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">บันทึกเพิ่มเติม:</label>
                <textarea
                  rows={2}
                  placeholder="หมายเหตุหรือวัตถุประสงค์ของบัญชี..."
                  value={accountForm.notes}
                  onChange={(e) => setAccountForm({ ...accountForm, notes: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900"
                />
              </div>

              {/* Modal Buttons */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  disabled={isSavingAccount}
                  onClick={() => setIsAddAccountModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 rounded-xl hover:bg-slate-50 transition cursor-pointer disabled:opacity-50"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={isSavingAccount}
                  className="inline-flex items-center gap-1.5 px-5 py-2 bg-[#0D9488] hover:bg-teal-700 disabled:opacity-60 text-white font-bold rounded-xl shadow-xs transition cursor-pointer"
                >
                  {isSavingAccount ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>กำลังบันทึก...</span>
                    </>
                  ) : (
                    <span>บันทึกบัญชี</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: STATEMENT SCAN & AI READER */}
      {isStatementScanModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-4xl w-full p-6 shadow-2xl border border-slate-200 my-8">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-teal-50 text-teal-700 rounded-xl">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    อ่านข้อมูลจากไฟล์รายงานสินทรัพย์หมุนเวียน (Bank Statement OCR)
                  </h3>
                  <p className="text-xs text-slate-500">
                    อัปโหลดไฟล์ Statement (PDF หลายหน้า หรือภาพสลิป/รายการ) เพื่อสกัดข้อมูลและรายการเดินบัญชีอัตโนมัติ
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsStatementScanModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Hidden Inputs */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,image/png,image/jpeg,image/webp"
              multiple
              onChange={handleStatementFileChange}
              className="hidden"
            />
            <input
              ref={folderInputRef}
              type="file"
              {...({ webkitdirectory: '', directory: '' } as React.InputHTMLAttributes<HTMLInputElement>)}
              multiple
              onChange={handleFolderInputChange}
              className="hidden"
            />

            {/* Step 1: Upload & Scan */}
            {!extractedStatement ? (
              isBatchMode && batchItems.length > 0 ? (
                /* BATCH / FOLDER UPLOAD QUEUE DASHBOARD */
                <div className="space-y-4">
                  {/* Batch Summary Header */}
                  <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-teal-100 text-teal-800 flex items-center justify-center font-bold">
                        <FolderUp className="w-5 h-5 text-teal-700" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-bold text-slate-900">
                            คิวประมวลผล Statement (โฟลเดอร์ / หลายไฟล์)
                          </h4>
                          <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-teal-100 text-teal-800">
                            {batchItems.length} ไฟล์
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                          ระบบจะอ่านและวิเคราะห์รายการเดินบัญชีด้วย AI ทุกไฟล์ในโฟลเดอร์
                        </p>
                      </div>
                    </div>

                    {/* Progress Stats Pills */}
                    <div className="flex flex-wrap items-center gap-2 text-[11px]">
                      <span className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-slate-600 font-medium">
                        ⏳ รออ่าน:{' '}
                        <strong className="text-slate-800 font-mono">
                          {batchItems.filter((b) => b.status === 'pending').length}
                        </strong>
                      </span>
                      {batchItems.some((b) => b.status === 'scanning') && (
                        <span className="px-2.5 py-1 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 font-medium flex items-center gap-1">
                          <Loader2 className="w-3 h-3 animate-spin text-amber-600" />
                          กำลังอ่าน:{' '}
                          <strong className="font-mono">
                            {batchItems.filter((b) => b.status === 'scanning').length}
                          </strong>
                        </span>
                      )}
                      <span className="px-2.5 py-1 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 font-medium">
                        ✓ สำเร็จ:{' '}
                        <strong className="font-mono">
                          {batchItems.filter((b) => b.status === 'success').length}
                        </strong>
                      </span>
                      {batchItems.some((b) => b.status === 'error') && (
                        <span className="px-2.5 py-1 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 font-medium">
                          ✕ ผิดพลาด:{' '}
                          <strong className="font-mono">
                            {batchItems.filter((b) => b.status === 'error').length}
                          </strong>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Progress Bar when scanning */}
                  {isBatchScanning && (
                    <div className="p-3 bg-teal-50/70 border border-teal-200 rounded-xl space-y-1.5 animate-pulse">
                      <div className="flex justify-between text-xs text-teal-900 font-semibold">
                        <span className="flex items-center gap-1.5">
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-teal-600" />
                          กำลังอ่านไฟล์ที่ {currentBatchIndex + 1} จาก {batchItems.length}:{' '}
                          <span className="font-mono text-teal-700 truncate max-w-xs">
                            {batchItems[currentBatchIndex]?.fileName || ''}
                          </span>
                        </span>
                        <span className="font-mono">
                          {Math.round(
                            (batchItems.filter((b) => b.status === 'success' || b.status === 'error').length /
                              batchItems.length) *
                              100
                          )}
                          %
                        </span>
                      </div>
                      <div className="w-full bg-teal-100 rounded-full h-2 overflow-hidden">
                        <div
                          className="bg-teal-600 h-2 rounded-full transition-all duration-300"
                          style={{
                            width: `${Math.round(
                              (batchItems.filter((b) => b.status === 'success' || b.status === 'error').length /
                                batchItems.length) *
                                100
                            )}%`,
                          }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Account Target Selector */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200 text-xs">
                    <div className="flex-1">
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        เป้าหมายการเชื่อมโยงบัญชีธนาคาร:
                      </label>
                      <select
                        value={scanTargetAccountId}
                        onChange={(e) => setScanTargetAccountId(e.target.value)}
                        className="w-full px-3 py-1.5 border border-slate-300 rounded-lg bg-white text-slate-900 font-medium"
                      >
                        <option value="">-- ตรวจสอบและสร้าง/จับคู่บัญชีอัตโนมัติตาม Statement แต่ละไฟล์ --</option>
                        {bankAccounts.map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.bankName} - เลขที่ {b.accountNumber} ({b.accountName})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="flex items-center gap-2 pt-4 sm:pt-0">
                      <button
                        type="button"
                        onClick={() => folderInputRef.current?.click()}
                        disabled={isBatchScanning || isSavingBatch}
                        className="px-3 py-1.5 border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold rounded-lg text-xs flex items-center gap-1.5 transition cursor-pointer"
                        title="เลือกโฟลเดอร์เพิ่ม"
                      >
                        <FolderPlus className="w-3.5 h-3.5 text-teal-600" />
                        + โฟลเดอร์
                      </button>
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isBatchScanning || isSavingBatch}
                        className="px-3 py-1.5 border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold rounded-lg text-xs flex items-center gap-1.5 transition cursor-pointer"
                        title="เลือกไฟล์เพิ่ม"
                      >
                        <FileUp className="w-3.5 h-3.5 text-teal-600" />
                        + ไฟล์
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setBatchItems([]);
                          setIsBatchMode(false);
                        }}
                        disabled={isBatchScanning || isSavingBatch}
                        className="px-3 py-1.5 text-slate-400 hover:text-rose-600 rounded-lg text-xs transition cursor-pointer"
                        title="ล้างคิวทั้งหมด"
                      >
                        ล้างคิว
                      </button>
                    </div>
                  </div>

                  {/* Batch Items List */}
                  <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
                    {batchItems.map((item, idx) => (
                      <div
                        key={item.id}
                        className={`p-3 rounded-xl border transition-all ${
                          item.status === 'scanning'
                            ? 'bg-amber-50/70 border-amber-300 ring-2 ring-amber-400/20'
                            : item.status === 'success'
                            ? 'bg-emerald-50/50 border-emerald-200'
                            : item.status === 'error'
                            ? 'bg-rose-50/50 border-rose-200'
                            : 'bg-white border-slate-200'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            <span className="w-5 h-5 rounded-md bg-slate-100 text-slate-500 font-mono text-[10px] font-bold flex items-center justify-center shrink-0">
                              {idx + 1}
                            </span>

                            {/* Visual Thumbnail Preview */}
                            {item.base64 && !item.fileName.toLowerCase().endsWith('.pdf') && !item.mimeType.includes('pdf') ? (
                              <div
                                onClick={() => setStatementPreviewZoomUrl(item.base64)}
                                className="relative group w-12 h-12 rounded-lg overflow-hidden border border-slate-200 shrink-0 cursor-pointer shadow-2xs hover:opacity-90 transition bg-slate-100"
                                title="คลิกเพื่อขยายดูรูปตัวอย่าง"
                              >
                                <img
                                  src={item.base64}
                                  alt={item.fileName}
                                  className="w-full h-full object-cover"
                                />
                                <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition">
                                  <Eye className="w-3.5 h-3.5 text-white" />
                                </div>
                              </div>
                            ) : (
                              <div
                                onClick={() => item.base64 && setStatementPreviewZoomUrl(item.base64)}
                                className="w-12 h-12 rounded-lg bg-red-50 border border-red-200 text-red-600 flex flex-col items-center justify-center shrink-0 cursor-pointer hover:bg-red-100 transition shadow-2xs"
                                title="คลิกเพื่อดูตัวอย่างไฟล์ PDF"
                              >
                                <FileText className="w-5 h-5 text-red-500" />
                                <span className="text-[8px] font-bold">PDF</span>
                              </div>
                            )}

                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-xs text-slate-900 truncate">
                                  {item.fileName}
                                </span>
                                {item.filePath && item.filePath !== item.fileName && (
                                  <span className="text-[10px] text-slate-400 font-mono truncate max-w-[150px]">
                                    ({item.filePath})
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-slate-400 mt-0.5">
                                {(item.fileSize / 1024 / 1024).toFixed(2)} MB · {item.mimeType}
                              </div>
                            </div>
                          </div>

                          {/* Status Badge & Actions */}
                          <div className="flex items-center gap-2 shrink-0">
                            {item.status === 'pending' && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600">
                                รอประมวลผล
                              </span>
                            )}
                            {item.status === 'scanning' && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-800 flex items-center gap-1">
                                <Loader2 className="w-3 h-3 animate-spin text-amber-600" />
                                กำลังอ่าน...
                              </span>
                            )}
                            {item.status === 'success' && item.extractedData && (
                              <div className="flex items-center gap-2 text-right">
                                <div className="text-[11px] hidden sm:block">
                                  <span className="font-bold text-slate-800">
                                    {item.extractedData.bankName}
                                  </span>
                                  <span className="text-slate-400 ml-1.5 font-mono">
                                    {item.extractedData.transactions.length} รายการ
                                  </span>
                                  <span className="font-bold text-teal-800 ml-2 font-mono">
                                    {formatCurrency(item.extractedData.closingBalance)}
                                  </span>
                                </div>
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                  ✓ อ่านสำเร็จ
                                </span>
                              </div>
                            )}
                            {item.status === 'error' && (
                              <div className="flex items-center gap-1.5">
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-100 text-rose-800">
                                  ✕ ไม่สำเร็จ
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleScanSingleBatchItem(item.id)}
                                  className="p-1 text-slate-500 hover:text-slate-800 rounded transition"
                                  title="ลองอ่านซ้ำ"
                                >
                                  <RotateCcw className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            )}

                            {/* View / Detail toggle */}
                            {item.status === 'success' && item.extractedData && (
                              <button
                                type="button"
                                onClick={() =>
                                  setPreviewBatchItemId(
                                    previewBatchItemId === item.id ? null : item.id
                                  )
                                }
                                className="p-1.5 text-teal-700 hover:bg-teal-100/70 rounded-lg text-xs font-semibold transition"
                                title="ดูรายละเอียดรายการที่อ่านได้"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                            )}

                            {/* Delete single item from batch */}
                            {!isBatchScanning && (
                              <button
                                type="button"
                                onClick={() => handleRemoveBatchItem(item.id)}
                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                                title="ลบไฟล์นี้ออกจากคิว"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Error detail */}
                        {item.status === 'error' && item.errorMessage && (
                          <div className="mt-2 text-[11px] text-rose-700 bg-rose-50/80 p-2 rounded-lg border border-rose-200">
                            {item.errorMessage}
                          </div>
                        )}

                        {/* Drill-in Detail Preview */}
                        {previewBatchItemId === item.id && item.extractedData && (
                          <div className="mt-3 pt-3 border-t border-emerald-100 bg-white p-3 rounded-lg text-xs space-y-2">
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                              <div>
                                <span className="text-slate-400 block">ธนาคาร:</span>
                                <strong className="text-slate-800">{item.extractedData.bankName}</strong>
                              </div>
                              <div>
                                <span className="text-slate-400 block">เลขที่บัญชี:</span>
                                <strong className="font-mono text-slate-800">
                                  {item.extractedData.accountNumber || 'ไม่พบในไฟล์'}
                                </strong>
                              </div>
                              <div>
                                <span className="text-slate-400 block">ยอดยกมา:</span>
                                <strong className="font-mono text-slate-700">
                                  {formatCurrency(item.extractedData.openingBalance)}
                                </strong>
                              </div>
                              <div>
                                <span className="text-slate-400 block">ยอดคงเหลือยกไป:</span>
                                <strong className="font-mono text-teal-800">
                                  {formatCurrency(item.extractedData.closingBalance)}
                                </strong>
                              </div>
                            </div>

                            {/* Transactions preview table */}
                            <div className="mt-2 max-h-36 overflow-y-auto border border-slate-100 rounded-lg">
                              <table className="w-full text-[10px] text-left">
                                <thead className="bg-slate-50 text-slate-500 font-semibold sticky top-0">
                                  <tr>
                                    <th className="py-1 px-2">วันที่</th>
                                    <th className="py-1 px-2">รายการ</th>
                                    <th className="py-1 px-2 text-right">เงินออก</th>
                                    <th className="py-1 px-2 text-right">เงินเข้า</th>
                                    <th className="py-1 px-2 text-right">ยอดคงเหลือ</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 font-mono">
                                  {item.extractedData.transactions.map((tx, ti) => (
                                    <tr key={ti} className="hover:bg-slate-50">
                                      <td className="py-1 px-2 whitespace-nowrap text-slate-600 font-sans">
                                        {tx.date}
                                      </td>
                                      <td className="py-1 px-2 font-sans truncate max-w-xs text-slate-800">
                                        {tx.description}
                                      </td>
                                      <td className="py-1 px-2 text-right text-rose-600 font-bold">
                                        {cleanNumericAmount(tx.debitAmount) > 0 ? `-${formatCurrency(tx.debitAmount)}` : '-'}
                                      </td>
                                      <td className="py-1 px-2 text-right text-emerald-600 font-bold">
                                        {cleanNumericAmount(tx.creditAmount) > 0 ? `+${formatCurrency(tx.creditAmount)}` : '-'}
                                      </td>
                                      <td className="py-1 px-2 text-right text-slate-800">
                                        {formatCurrency(tx.balance)}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Batch Actions Footer */}
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setIsStatementScanModalOpen(false)}
                      disabled={isBatchScanning || isSavingBatch}
                      className="px-4 py-2 border border-slate-300 text-slate-700 text-xs font-semibold rounded-xl hover:bg-slate-50 w-full sm:w-auto"
                    >
                      ยกเลิก
                    </button>

                    <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end">
                      {/* Scan All Button */}
                      {batchItems.some((b) => b.status === 'pending' || b.status === 'error') && (
                        <button
                          type="button"
                          onClick={handleBatchScanAll}
                          disabled={isBatchScanning || isSavingBatch}
                          className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-teal-700 to-teal-800 hover:from-teal-800 hover:to-teal-900 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-xs transition cursor-pointer"
                        >
                          {isBatchScanning ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              กำลังอ่าน Statement ทีละไฟล์ ({currentBatchIndex + 1}/{batchItems.length})...
                            </>
                          ) : (
                            <>
                              <Play className="w-4 h-4" />
                              เริ่มอ่าน Statement ทุกไฟล์ด้วย AI ({batchItems.length} ไฟล์)
                            </>
                          )}
                        </button>
                      )}

                      {/* Confirm and Save Batch Button */}
                      <button
                        type="button"
                        onClick={handleConfirmSaveBatch}
                        disabled={
                          isBatchScanning ||
                          isSavingBatch ||
                          batchItems.filter((b) => b.status === 'success').length === 0
                        }
                        className="flex items-center gap-2 px-6 py-2.5 bg-[#0D9488] hover:bg-teal-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-xs transition cursor-pointer"
                      >
                        {isSavingBatch ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            กำลังบันทึกข้อมูลทั้งหมดลงระบบ...
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="w-4 h-4" />
                            ยืนยันและบันทึกทั้งหมด (
                            {batchItems.filter((b) => b.status === 'success').length} ไฟล์)
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                /* INITIAL SELECTION & DROPZONE (FOLDER OR FILES) */
                <div className="space-y-4">
                  {/* Account Link Selection */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      เชื่อมโยงกับบัญชีธนาคาร:
                    </label>
                    <select
                      value={scanTargetAccountId}
                      onChange={(e) => setScanTargetAccountId(e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white text-slate-900"
                    >
                      <option value="">-- ตรวจสอบและสร้างบัญชีใหม่อัตโนมัติตาม Statement --</option>
                      {bankAccounts.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.bankName} - เลขที่ {b.accountNumber} ({b.accountName})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Dual Upload Options: Folder & Files */}
                  <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    className={`border-2 border-dashed rounded-2xl p-5 sm:p-7 text-center transition-all ${
                      isDraggingFolder
                        ? 'border-teal-500 bg-teal-50/90 ring-4 ring-teal-500/20 scale-[0.99]'
                        : 'border-teal-300 hover:border-teal-500 bg-teal-50/40 hover:bg-teal-50/60'
                    }`}
                  >
                    {/* Guidance on viewing thumbnails in OS folder */}
                    <div className="mb-4 p-3.5 bg-amber-50/90 border border-amber-200/90 rounded-xl text-left text-xs text-amber-950 shadow-2xs">
                      <div className="flex items-start gap-2.5">
                        <HelpCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                        <div className="space-y-1.5 flex-1">
                          <p className="font-bold text-amber-950 flex items-center gap-1.5 text-xs">
                            💡 ทำไมเปิดโฟลเดอร์ในคอมแล้วมองไม่เห็นรูปตัวอย่างไฟล์ Statement?
                          </p>
                          <p className="text-[11px] text-amber-800 leading-relaxed">
                            หน้าต่างเลือกโฟลเดอร์ของระบบ <strong>Windows และ Mac</strong> ถูกออกแบบมาสำหรับ <strong>คลิกเลือกชื่อโฟลเดอร์จากภายนอก</strong> แล้วกดปุ่ม Upload (หากดับเบิ้ลคลิกเข้าไปข้างใน หน้าต่างคอมฯ จะไม่แสดงไฟล์ใดๆ)
                          </p>
                          <div className="pt-1.5 border-t border-amber-200/60 text-[11px] text-teal-950 space-y-1 font-medium">
                            <div className="flex items-start gap-1.5">
                              <span className="text-emerald-700 font-bold shrink-0">👉 วิธีที่ 1 (แนะนำ - เห็นรูปตัวอย่างในคอมชัดเจน):</span>
                              <span>
                                กดปุ่ม <strong>"เลือกไฟล์ทั้งหมดในโฟลเดอร์"</strong> ด้านล่าง หน้าต่างคอมจะเปิดโหมดไฟล์ปกติ สามารถปรับเป็น Large Icons เพื่อดูรูปตัวอย่าง แล้วกด <kbd className="px-1 py-0.5 bg-white border border-slate-300 rounded text-[10px] font-mono">Ctrl + A</kbd> เพื่อเลือกทุกไฟล์ได้ทันที!
                              </span>
                            </div>
                            <div className="flex items-start gap-1.5">
                              <span className="text-teal-700 font-bold shrink-0">👉 วิธีที่ 2 (ลากมาวาง):</span>
                              <span>
                                เปิดโฟลเดอร์ในคอมที่คุณเห็นรูปตัวอย่าง แล้วลากทั้งโฟลเดอร์หรือลากไฟล์ทั้งหมดมาปล่อยลงในกรอบนี้ได้เลย
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-xl mx-auto my-2">
                      {/* Option 1: Multi-File Picker with visible previews in OS */}
                      <div
                        onClick={() => fileInputRef.current?.click()}
                        className="p-5 bg-gradient-to-br from-teal-50 to-emerald-50 border-2 border-teal-500 hover:border-teal-600 rounded-2xl shadow-xs hover:shadow-md transition text-center cursor-pointer group flex flex-col items-center justify-between"
                      >
                        <div className="w-14 h-14 rounded-2xl bg-teal-600 text-white flex items-center justify-center mb-3 group-hover:scale-105 transition-transform shadow-xs">
                          <Images className="w-7 h-7" />
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-teal-950 mb-1 flex items-center justify-center gap-1.5">
                            เลือกไฟล์ทั้งหมดในโฟลเดอร์
                            <span className="px-2 py-0.5 text-[10px] font-bold bg-emerald-100 text-emerald-800 rounded-full">
                              ⭐ แนะนำ - เห็นรูปในคอม
                            </span>
                          </h4>
                          <p className="text-xs text-teal-800/90 leading-relaxed">
                            หน้าต่างคอมจะแสดงรูปตัวอย่างขนาดใหญ่ของ Statement (PDF, รูปภาพ) สามารถกด <strong>Ctrl + A</strong> เพื่อเลือกทั้งหมดได้ทันที
                          </p>
                        </div>
                        <button
                          type="button"
                          className="mt-4 px-4 py-2 bg-teal-700 group-hover:bg-teal-800 text-white rounded-xl text-xs font-bold shadow-2xs transition pointer-events-none"
                        >
                          เลือกไฟล์ (เห็นรูปตัวอย่าง)...
                        </button>
                      </div>

                      {/* Option 2: Upload Entire Folder */}
                      <div
                        onClick={() => folderInputRef.current?.click()}
                        className="p-5 bg-white border border-slate-200 hover:border-teal-400 rounded-2xl shadow-xs hover:shadow-md transition text-center cursor-pointer group flex flex-col items-center justify-between"
                      >
                        <div className="w-14 h-14 rounded-2xl bg-slate-100 text-[#0F172A] group-hover:text-teal-700 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                          <FolderUp className="w-7 h-7" />
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-slate-900 mb-1 flex items-center justify-center gap-1.5">
                            เลือกแบบทั้งโฟลเดอร์
                            <span className="px-2 py-0.5 text-[10px] font-medium bg-slate-100 text-slate-600 rounded-full">
                              Folder Mode
                            </span>
                          </h4>
                          <p className="text-xs text-slate-500 leading-relaxed">
                            คลิกเลือกชื่อโฟลเดอร์จากภายนอก แล้วกด Select Folder ระบบจะดึงทุกไฟล์ในโฟลเดอร์ให้อัตโนมัติ
                          </p>
                        </div>
                        <button
                          type="button"
                          className="mt-4 px-4 py-2 bg-slate-800 group-hover:bg-slate-900 text-white rounded-xl text-xs font-bold shadow-2xs transition pointer-events-none"
                        >
                          เลือกโฟลเดอร์...
                        </button>
                      </div>
                    </div>

                    {/* Drag-and-drop indicator */}
                    <div className="mt-4 pt-3 border-t border-teal-200/60 text-xs text-slate-500 flex items-center justify-center gap-2">
                      <Upload className="w-4 h-4 text-teal-600 animate-bounce" />
                      <span>หรือเปิดโฟลเดอร์ในคอม แล้ว<strong>ลากทั้งโฟลเดอร์หรือไฟล์ทั้งหมด</strong>มาวางในกรอบนี้ได้ทันที</span>
                    </div>

                    {/* Single File preview if one selected */}
                    {statementFile && (
                      <div className="mt-4 p-3 bg-white border border-emerald-200 rounded-xl max-w-md mx-auto flex items-center justify-between text-xs text-left shadow-2xs">
                        <div className="flex items-center gap-3 truncate">
                          {statementBase64 && !statementFile.name.toLowerCase().endsWith('.pdf') ? (
                            <img
                              src={statementBase64}
                              alt="Thumbnail"
                              className="w-11 h-11 object-cover rounded-lg border border-slate-200 shrink-0 cursor-pointer hover:opacity-90 transition"
                              onClick={() => setStatementPreviewZoomUrl(statementBase64)}
                              title="คลิกเพื่อดูภาพขยาย"
                            />
                          ) : (
                            <div className="w-11 h-11 rounded-lg bg-red-50 text-red-600 border border-red-200 flex flex-col items-center justify-center shrink-0">
                              <FileText className="w-5 h-5 text-red-500" />
                              <span className="text-[8px] font-bold">PDF</span>
                            </div>
                          )}
                          <div className="truncate">
                            <span className="font-bold text-slate-800 block truncate">
                              {statementFile.name}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              {(statementFile.size / 1024 / 1024).toFixed(2)} MB
                            </span>
                          </div>
                        </div>
                        <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 font-bold rounded-lg text-[11px] shrink-0">
                          ✓ พร้อมอ่าน
                        </span>
                      </div>
                    )}
                  </div>

                  {scanError && (
                    <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
                      <span>{scanError}</span>
                    </div>
                  )}

                  <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setIsStatementScanModalOpen(false)}
                      className="px-4 py-2 border border-slate-300 text-slate-700 text-xs font-semibold rounded-xl hover:bg-slate-50 cursor-pointer"
                    >
                      ยกเลิก
                    </button>
                    {statementFile && (
                      <button
                        type="button"
                        onClick={handleScanStatementAI}
                        disabled={isScanningStatement || !statementFile}
                        className="flex items-center gap-2 px-5 py-2.5 bg-[#0D9488] hover:bg-teal-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-sm transition cursor-pointer"
                      >
                        {isScanningStatement ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            AI กำลังอ่านและวิเคราะห์ Statement ทุกหน้า...
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-4 h-4" />
                            เริ่มอ่าน Statement ด้วย AI
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              )
            ) : (
              /* Step 2: Review Extracted Statement Data */
              <div className="space-y-5">
                {/* Summary Banner */}
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-xs">
                  <div className="flex items-center gap-2 text-emerald-900 font-bold mb-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>อ่านข้อมูลสำเร็จ! ตรวจพบ {extractedStatement.transactions.length} รายการเดินบัญชี (จำนวน {extractedStatement.totalPagesRead || 1} หน้า)</span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-white p-3 rounded-lg border border-emerald-100">
                    <div>
                      <span className="text-[10px] text-slate-400 block font-semibold">ธนาคาร:</span>
                      <span className="font-bold text-slate-800">{extractedStatement.bankName}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block font-semibold">เลขที่บัญชี:</span>
                      <span className="font-bold font-mono text-slate-800">{extractedStatement.accountNumber}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block font-semibold">ยอดยกมา:</span>
                      <span className="font-mono text-slate-700">{formatCurrency(extractedStatement.openingBalance)}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block font-semibold">ยอดคงเหลือยกไป:</span>
                      <span className="font-mono font-bold text-teal-800">{formatCurrency(extractedStatement.closingBalance)}</span>
                    </div>
                  </div>
                </div>

                {/* Editable Fields */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 text-xs">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      โครงการ (Project):
                    </label>
                    <select
                      value={extractedStatement.projectId || ''}
                      onChange={(e) => {
                        const pid = e.target.value;
                        const proj = pid ? projectsMap[pid] : undefined;
                        const pName = proj ? getProjectDisplayName(proj) : undefined;
                        setExtractedStatement({
                          ...extractedStatement,
                          projectId: pid,
                          transactions: extractedStatement.transactions.map((t) => ({
                            ...t,
                            projectId: pid || undefined,
                            projectName: pName,
                          })),
                        });
                      }}
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-slate-900 bg-white"
                    >
                      <option value="">ส่วนกลาง / ไม่ระบุโครงการ</option>
                      {projects.map((p) => (
                        <option key={p.projectId} value={p.projectId}>
                          {getProjectDisplayName(p)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      ระบุชื่อธนาคาร: <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={extractedStatement.bankName}
                      onChange={(e) =>
                        setExtractedStatement({ ...extractedStatement, bankName: e.target.value })
                      }
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-slate-900 font-medium"
                      placeholder="เช่น ธนาคารกสิกรไทย"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      ระบุเลขที่บัญชี: <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={extractedStatement.accountNumber}
                      onChange={(e) =>
                        setExtractedStatement({ ...extractedStatement, accountNumber: e.target.value })
                      }
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-slate-900 font-mono font-medium"
                      placeholder="เช่น 123-4-56789-0"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">ชื่อบัญชี:</label>
                    <input
                      type="text"
                      value={extractedStatement.accountName}
                      onChange={(e) =>
                        setExtractedStatement({ ...extractedStatement, accountName: e.target.value })
                      }
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">วันที่เริ่มต้น Statement:</label>
                    <input
                      type="date"
                      value={extractedStatement.statementPeriodStart}
                      onChange={(e) =>
                        setExtractedStatement({ ...extractedStatement, statementPeriodStart: e.target.value })
                      }
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">วันที่สิ้นสุด Statement:</label>
                    <input
                      type="date"
                      value={extractedStatement.statementPeriodEnd}
                      onChange={(e) =>
                        setExtractedStatement({ ...extractedStatement, statementPeriodEnd: e.target.value })
                      }
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-slate-900"
                    />
                  </div>
                </div>

                {/* Transactions Table Preview */}
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs font-semibold text-slate-700">
                    <span>ตารางรายการเดินบัญชีที่อ่านได้ ({extractedStatement.transactions.length} รายการ)</span>
                    <span className="text-[11px] text-slate-500 font-normal">
                      สามารถเลือกโครงการแยกตามแต่ละรายการ หรือใช้โครงการหลักด้านบน
                    </span>
                  </div>

                  <div className="overflow-x-auto max-h-64">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-100 text-slate-500 text-[11px] font-semibold sticky top-0">
                        <tr>
                          <th className="py-2 px-3">วันที่</th>
                          <th className="py-2 px-3">โครงการ</th>
                          <th className="py-2 px-3">รายละเอียด</th>
                          <th className="py-2 px-3">ช่องทาง</th>
                          <th className="py-2 px-3 text-right text-rose-600">เงินออก (ถอน)</th>
                          <th className="py-2 px-3 text-right text-emerald-600">เงินเข้า (ฝาก)</th>
                          <th className="py-2 px-3 text-right">ยอดคงเหลือ</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {extractedStatement.transactions.map((tx, i) => (
                          <tr key={i} className="hover:bg-slate-50 font-mono text-[11px]">
                            <td className="py-2 px-3 whitespace-nowrap text-slate-700 font-sans">{tx.date}</td>
                            <td className="py-2 px-3 whitespace-nowrap">
                              <select
                                value={tx.projectId || extractedStatement.projectId || ''}
                                onChange={(e) => {
                                  const newPid = e.target.value;
                                  const updatedTx = [...extractedStatement.transactions];
                                  const newProj = newPid ? projectsMap[newPid] : undefined;
                                  updatedTx[i] = {
                                    ...updatedTx[i],
                                    projectId: newPid || undefined,
                                    projectName: newProj ? getProjectDisplayName(newProj) : undefined,
                                  };
                                  setExtractedStatement({ ...extractedStatement, transactions: updatedTx });
                                }}
                                className="px-2 py-0.5 text-[10px] border border-slate-300 rounded bg-white text-slate-800"
                              >
                                <option value="">ส่วนกลาง</option>
                                {projects.map((p) => (
                                  <option key={p.projectId} value={p.projectId}>
                                    {getProjectDisplayName(p)}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="py-2 px-3 font-sans text-slate-900 max-w-xs truncate">{tx.description}</td>
                            <td className="py-2 px-3 text-slate-500">{tx.channel || '-'}</td>
                            <td className="py-2 px-3 text-right font-bold text-rose-600">
                              {cleanNumericAmount(tx.debitAmount) > 0 ? `-${formatCurrency(tx.debitAmount)}` : '-'}
                            </td>
                            <td className="py-2 px-3 text-right font-bold text-emerald-600">
                              {cleanNumericAmount(tx.creditAmount) > 0 ? `+${formatCurrency(tx.creditAmount)}` : '-'}
                            </td>
                            <td className="py-2 px-3 text-right font-bold text-slate-800">
                              {formatCurrency(tx.balance)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Modal Actions */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                  <button
                    onClick={() => setExtractedStatement(null)}
                    className="px-4 py-2 border border-slate-300 text-slate-700 text-xs font-semibold rounded-xl hover:bg-slate-50"
                  >
                    ← เลือกไฟล์ใหม่
                  </button>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setIsStatementScanModalOpen(false)}
                      className="px-4 py-2 text-slate-500 hover:text-slate-800 text-xs font-semibold"
                    >
                      ยกเลิก
                    </button>
                    <button
                      onClick={handleConfirmSaveStatement}
                      className="flex items-center gap-1.5 px-6 py-2.5 bg-[#0D9488] hover:bg-teal-700 text-white text-xs font-bold rounded-xl shadow-xs transition cursor-pointer"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      ยืนยันและบันทึกข้อมูลสินทรัพย์หมุนเวียน
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Delete Bank Account Confirmation Modal */}
      {accountToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-100 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 text-rose-600 mb-4">
              <div className="p-3 bg-rose-100 rounded-xl">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">ยืนยันการลบบัญชีธนาคาร</h3>
                <p className="text-xs text-slate-500">สินทรัพย์หมุนเวียน</p>
              </div>
            </div>

            <p className="text-sm text-slate-600 mb-4">
              คุณต้องการลบบัญชี <span className="font-bold text-slate-900">{accountToDelete.bankName}</span> เลขที่{' '}
              <span className="font-mono font-bold text-slate-900">{accountToDelete.accountNumber}</span>{' '}
              ({accountToDelete.accountName}) หรือไม่?
            </p>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600 space-y-1 mb-6">
              <div className="flex justify-between">
                <span className="text-slate-500">ยอดคงเหลือปัจจุบัน:</span>
                <span className="font-bold font-mono text-slate-900">{formatCurrency(accountToDelete.currentBalance)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">โครงการ:</span>
                <span className="font-medium text-slate-900">{accountToDelete.projectName || 'ส่วนกลาง'}</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setAccountToDelete(null)}
                disabled={isDeleting}
                className="px-4 py-2 border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold rounded-xl transition cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={confirmDeleteAccount}
                disabled={isDeleting}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                ยืนยันการลบบัญชี
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Statement Confirmation Modal */}
      {statementToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-100 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 text-rose-600 mb-4">
              <div className="p-3 bg-rose-100 rounded-xl">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">ยืนยันการลบประวัติ Statement</h3>
                <p className="text-xs text-slate-500">รายการเดินบัญชี</p>
              </div>
            </div>

            <p className="text-sm text-slate-600 mb-4">
              คุณต้องการลบประวัติรายงาน Statement ของ{' '}
              <span className="font-bold text-slate-900">{statementToDelete.bankName}</span> เลขที่{' '}
              <span className="font-mono font-bold text-slate-900">{statementToDelete.accountNumber}</span>{' '}
              ({statementToDelete.transactions?.length || 0} รายการ) หรือไม่?
            </p>

            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setStatementToDelete(null)}
                disabled={isDeleting}
                className="px-4 py-2 border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold rounded-xl transition cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={confirmDeleteStatement}
                disabled={isDeleting}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                ยืนยันการลบ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating In-App Toast Notification */}
      {notification && (
        <div className="fixed top-5 right-5 z-50 max-w-md w-full animate-in fade-in slide-in-from-top-4 duration-300">
          <div
            className={`p-4 rounded-2xl shadow-xl border flex items-start gap-3 backdrop-blur-md ${
              notification.type === 'success'
                ? 'bg-emerald-50/95 border-emerald-200 text-emerald-900'
                : notification.type === 'error'
                ? 'bg-rose-50/95 border-rose-200 text-rose-900'
                : 'bg-blue-50/95 border-blue-200 text-blue-900'
            }`}
          >
            {notification.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            ) : notification.type === 'error' ? (
              <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            ) : (
              <Clock className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
            )}
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-bold">{notification.title}</h4>
              <p className="text-xs mt-0.5 opacity-90 break-words">{notification.message}</p>
            </div>
            <button
              onClick={() => setNotification(null)}
              className="text-slate-400 hover:text-slate-600 p-1 rounded-lg transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* High-Resolution Zoom Modal for Statement Documents */}
      {statementPreviewZoomUrl && (
        <div
          className="fixed inset-0 z-70 flex items-center justify-center p-3 sm:p-5 bg-slate-950/60 backdrop-blur-xs"
          onClick={() => setStatementPreviewZoomUrl(null)}
        >
          <div
            className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[92vh] overflow-hidden flex flex-col border border-slate-200/90"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-3.5 bg-white border-b border-slate-200/80 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-teal-50 text-teal-700 flex items-center justify-center">
                  <Eye className="w-4 h-4" />
                </div>
                <span className="font-display font-semibold text-sm text-slate-900">ภาพตัวอย่างเอกสาร Statement</span>
              </div>
              <button
                type="button"
                onClick={() => setStatementPreviewZoomUrl(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-3 bg-slate-100 flex-1 overflow-auto flex items-center justify-center max-h-[calc(92vh-60px)]">
              {statementPreviewZoomUrl.startsWith('data:application/pdf') || statementPreviewZoomUrl.includes('.pdf') ? (
                <iframe
                  src={statementPreviewZoomUrl}
                  title="PDF Statement Document"
                  className="w-full h-[75vh] bg-white rounded-xl shadow-xs border border-slate-200"
                />
              ) : (
                <img
                  src={statementPreviewZoomUrl}
                  alt="Statement Preview"
                  className="max-h-[78vh] w-auto max-w-full object-contain rounded-xl shadow-md border border-slate-200"
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
