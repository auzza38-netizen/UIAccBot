import React, { createContext, useContext, useState } from 'react';
import { useAuth } from './AuthContext';
import {
  Project,
  Receipt,
  ExpenseCategory,
  AppUser,
  AuditLog,
  DashboardFilters,
  BankAccount,
  StatementRecord,
} from '../types';
import {
  INITIAL_MOCK_PROJECTS,
  INITIAL_MOCK_RECEIPTS,
  INITIAL_MOCK_CATEGORIES,
  INITIAL_MOCK_USERS,
  INITIAL_MOCK_AUDIT_LOGS,
  INITIAL_MOCK_BANK_ACCOUNTS,
  INITIAL_MOCK_STATEMENT_RECORDS,
} from '../data/mockData';
import { normalizeDateISO, normalizeStatementTransactionsList } from '../utils/formatters';

interface DataContextType {
  projects: Project[];
  receipts: Receipt[];
  categories: ExpenseCategory[];
  users: AppUser[];
  auditLogs: AuditLog[];
  bankAccounts: BankAccount[];
  statementRecords: StatementRecord[];
  loadingData: boolean;
  isOfflineQuotaMode: boolean;
  filters: DashboardFilters;
  setFilters: React.Dispatch<React.SetStateAction<DashboardFilters>>;
  resetFilters: () => void;
  resetMockData: () => void;
  // Project operations
  saveProject: (projectData: Partial<Project>) => Promise<string>;
  updateProjectStatus: (projectId: string, status: Project['status']) => Promise<void>;
  deleteProject: (projectId: string) => Promise<void>;
  // Receipt operations
  saveReceipt: (receiptData: Partial<Receipt>) => Promise<string>;
  updateReceiptStatus: (receiptId: string, approvalStatus: Receipt['approvalStatus'], notes?: string) => Promise<void>;
  softDeleteReceipt: (receiptId: string) => Promise<void>;
  batchDeleteReceipts: (receiptIds: string[]) => Promise<void>;
  batchApproveReceipts: (receiptIds: string[], notes?: string) => Promise<void>;
  // User Management
  addUser: (userData: {
    displayName: string;
    email: string;
    role: AppUser['role'];
    status: AppUser['status'];
    assignedProjectIds: string[];
  }) => Promise<string>;
  updateUserRoleAndStatus: (
    uid: string,
    role: AppUser['role'],
    status: AppUser['status'],
    assignedProjectIds: string[]
  ) => Promise<void>;
  deleteUser: (uid: string) => Promise<void>;
  // Category Management
  saveCategory: (
    categoryName: string,
    id?: string,
    parentId?: string | null,
    level?: 'main' | 'sub'
  ) => Promise<void>;
  toggleCategoryStatus: (categoryId: string, isActive: boolean) => Promise<void>;
  deleteCategory: (categoryId: string) => Promise<void>;
  // Bank Account & Statement
  saveBankAccount: (accountData: Partial<BankAccount>) => Promise<string>;
  deleteBankAccount: (accountId: string) => Promise<void>;
  saveStatementRecord: (statementData: Partial<StatementRecord>, updateBalance?: boolean) => Promise<string>;
  deleteStatementRecord: (statementId: string) => Promise<void>;
  // Lookup maps
  projectsMap: Record<string, Project>;
  categoriesMap: Record<string, ExpenseCategory>;
  usersMap: Record<string, AppUser>;
  bankAccountsMap: Record<string, BankAccount>;
}

const defaultFilters: DashboardFilters = {
  datePreset: 'all',
  startDate: '',
  endDate: '',
  projectId: 'all',
  categoryId: 'all',
  uploadedBy: 'all',
  vendor: '',
  verificationStatus: 'all',
  approvalStatus: 'all',
  groupByDate: 'documentDate',
};

const DataContext = createContext<DataContextType | null>(null);

export const useData = () => {
  const context = useContext(DataContext);
  if (!context) throw new Error('useData must be used within DataProvider');
  return context;
};

export const DataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser, isAdmin } = useAuth();

  const [projects, setProjects] = useState<Project[]>(() => [...INITIAL_MOCK_PROJECTS]);
  const [receipts, setReceipts] = useState<Receipt[]>(() => [...INITIAL_MOCK_RECEIPTS]);
  const [categories, setCategories] = useState<ExpenseCategory[]>(() => [...INITIAL_MOCK_CATEGORIES]);
  const [users, setUsers] = useState<AppUser[]>(() => [...INITIAL_MOCK_USERS]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(() => [...INITIAL_MOCK_AUDIT_LOGS]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>(() => [...INITIAL_MOCK_BANK_ACCOUNTS]);
  const [statementRecords, setStatementRecords] = useState<StatementRecord[]>(() => [...INITIAL_MOCK_STATEMENT_RECORDS]);

  const [loadingData] = useState<boolean>(false);
  const [isOfflineQuotaMode] = useState<boolean>(false);
  const [filters, setFilters] = useState<DashboardFilters>(defaultFilters);

  const resetFilters = () => setFilters(defaultFilters);

  const appendAuditLog = (
    action: string,
    entityType: AuditLog['entityType'],
    entityId: string,
    changes: string
  ) => {
    const newLog: AuditLog = {
      logId: 'log_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      userId: currentUser?.uid || 'system',
      userEmail: currentUser?.email || 'system',
      action,
      entityType,
      entityId,
      changes,
      timestamp: new Date().toISOString(),
    };
    setAuditLogs((prev) => [newLog, ...prev].slice(0, 100));
  };

  const resetMockData = () => {
    setProjects([...INITIAL_MOCK_PROJECTS]);
    setReceipts([...INITIAL_MOCK_RECEIPTS]);
    setCategories([...INITIAL_MOCK_CATEGORIES]);
    setUsers([...INITIAL_MOCK_USERS]);
    setBankAccounts([...INITIAL_MOCK_BANK_ACCOUNTS]);
    setStatementRecords([...INITIAL_MOCK_STATEMENT_RECORDS]);
    setAuditLogs([
      {
        logId: 'log_reset_' + Date.now(),
        userId: currentUser?.uid || 'system',
        userEmail: currentUser?.email || 'system',
        action: 'Reset Mock Data',
        entityType: 'auth',
        entityId: 'template',
        changes: 'รีเซ็ตข้อมูลจำลองทั้งหมดกลับสู่ค่าเริ่มต้นของ Frontend UI Template',
        timestamp: new Date().toISOString(),
      },
      ...INITIAL_MOCK_AUDIT_LOGS,
    ]);
    setFilters(defaultFilters);
  };

  // Lookup maps
  const projectsMap = React.useMemo(() => {
    const map: Record<string, Project> = {};
    projects.forEach((p) => {
      map[p.projectId] = p;
    });
    return map;
  }, [projects]);

  const effectiveBankAccounts = React.useMemo(() => {
    const existingIds = new Set(bankAccounts.map((b) => b.id));
    const existingNumbers = new Set(
      bankAccounts.map((b) => (b.accountNumber || '').replace(/[^0-9]/g, ''))
    );
    const synthesized: BankAccount[] = [];

    statementRecords.forEach((s) => {
      const cleanNum = (s.accountNumber || '').replace(/[^0-9]/g, '');
      const hasId = s.accountId && existingIds.has(s.accountId);
      const hasNum = cleanNum && existingNumbers.has(cleanNum);

      if (!hasId && !hasNum && (s.accountId || s.accountNumber)) {
        if (cleanNum) existingNumbers.add(cleanNum);
        if (s.accountId) existingIds.add(s.accountId);
        synthesized.push({
          id: s.accountId || 'acc_stmt_' + (cleanNum || s.id),
          accountNumber: s.accountNumber || '000-0-00000-0',
          bankName: s.bankName || 'ธนาคารทั่วไป',
          bankCode: 'KBANK',
          accountName: s.accountName || `บัญชี ${s.bankName || ''}`,
          assetType: 'savings',
          currentBalance: s.closingBalance || 0,
          availableBalance: s.closingBalance || 0,
          currency: 'THB',
          projectId: s.projectId || '',
          projectName: s.projectName || '',
          lastUpdatedDate: s.statementPeriodEnd || s.uploadedAt?.slice(0, 10),
          statementCount: 1,
          createdAt: s.uploadedAt || new Date().toISOString(),
          updatedAt: s.uploadedAt || new Date().toISOString(),
          createdBy: s.uploadedBy || 'system',
        });
      }
    });

    if (synthesized.length > 0) {
      return [...bankAccounts, ...synthesized].sort(
        (a, b) => (b.currentBalance || 0) - (a.currentBalance || 0)
      );
    }
    return bankAccounts;
  }, [bankAccounts, statementRecords]);

  const bankAccountsMap = React.useMemo(() => {
    const map: Record<string, BankAccount> = {};
    effectiveBankAccounts.forEach((b) => {
      map[b.id] = b;
    });
    return map;
  }, [effectiveBankAccounts]);

  const categoriesMap = React.useMemo(() => {
    const map: Record<string, ExpenseCategory> = {};
    categories.forEach((c) => {
      map[c.categoryId] = c;
    });
    return map;
  }, [categories]);

  const usersMap = React.useMemo(() => {
    const map: Record<string, AppUser> = {};
    users.forEach((u) => {
      map[u.uid] = u;
    });
    return map;
  }, [users]);

  // Project operations
  const saveProject = async (projectData: Partial<Project>): Promise<string> => {
    if (!currentUser) throw new Error('Unauthorized');
    const now = new Date().toISOString();
    const projectId = projectData.projectId || 'proj_' + Date.now();

    const fullProject: Project = {
      projectId,
      projectCode: projectData.projectCode || 'PRJ-' + Math.floor(100 + Math.random() * 900),
      clientName: projectData.clientName || 'หน่วยงานทั่วไป',
      budget: Number(projectData.budget) || 0,
      assignedUsers: projectData.assignedUsers || [],
      status: projectData.status || 'active',
      notes: projectData.notes || '',
      createdBy: projectData.createdBy || currentUser.uid,
      createdAt: projectData.createdAt || now,
      updatedAt: now,
    };

    setProjects((prev) => {
      const idx = prev.findIndex((p) => p.projectId === projectId);
      return idx >= 0
        ? prev.map((p) => (p.projectId === projectId ? fullProject : p))
        : [fullProject, ...prev];
    });

    appendAuditLog(
      projectData.projectId ? 'Update Project' : 'Create Project',
      'project',
      projectId,
      `Project ${fullProject.projectCode}: ${fullProject.clientName}`
    );

    return projectId;
  };

  const updateProjectStatus = async (projectId: string, status: Project['status']) => {
    const now = new Date().toISOString();
    setProjects((prev) =>
      prev.map((p) => (p.projectId === projectId ? { ...p, status, updatedAt: now } : p))
    );
    appendAuditLog('Update Project Status', 'project', projectId, `Status changed to ${status}`);
  };

  const deleteProject = async (projectId: string): Promise<void> => {
    if (!currentUser) throw new Error('Unauthorized');
    if (!isAdmin) throw new Error('เฉพาะ Master Admin เท่านั้นที่สามารถลบโครงการได้');

    const projectToDelete = projects.find((p) => p.projectId === projectId);
    setProjects((prev) => prev.filter((p) => p.projectId !== projectId));

    appendAuditLog(
      'Delete Project',
      'project',
      projectId,
      `Deleted project ${projectToDelete?.projectCode || projectId}: ${projectToDelete?.clientName || ''} by ${currentUser.email}`
    );
  };

  // Receipt operations
  const saveReceipt = async (receiptData: Partial<Receipt>): Promise<string> => {
    if (!currentUser) throw new Error('Unauthorized');
    const now = new Date().toISOString();
    const receiptId =
      receiptData.receiptId || 'rcpt_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);

    const existing = receipts.find((r) => r.receiptId === receiptId);

    const fullReceipt: Receipt = {
      receiptId,
      projectId: receiptData.projectId ?? existing?.projectId ?? '',
      uploadedBy: receiptData.uploadedBy || existing?.uploadedBy || currentUser.uid,
      uploadedByEmail: receiptData.uploadedByEmail || existing?.uploadedByEmail || currentUser.email,
      documentType: receiptData.documentType || existing?.documentType || 'receipt',
      documentDate: receiptData.documentDate || existing?.documentDate || now.slice(0, 10),
      uploadDate: receiptData.uploadDate || existing?.uploadDate || now.slice(0, 10),
      receiptNumber: receiptData.receiptNumber ?? existing?.receiptNumber ?? '',
      vendorName: receiptData.vendorName ?? existing?.vendorName ?? '',
      vendorTaxId: receiptData.vendorTaxId ?? existing?.vendorTaxId ?? '',
      vendorAddress: receiptData.vendorAddress ?? existing?.vendorAddress ?? '',
      customerName: receiptData.customerName ?? existing?.customerName ?? '',
      customerTaxId: receiptData.customerTaxId ?? existing?.customerTaxId ?? '',
      customerAddress: receiptData.customerAddress ?? existing?.customerAddress ?? '',
      categoryId: receiptData.categoryId || existing?.categoryId || 'cat-other',
      subtotal: Number(receiptData.subtotal ?? existing?.subtotal ?? 0) || 0,
      vatAmount: Number(receiptData.vatAmount ?? existing?.vatAmount ?? 0) || 0,
      withholdingTax: Number(receiptData.withholdingTax ?? existing?.withholdingTax ?? 0) || 0,
      discount: Number(receiptData.discount ?? existing?.discount ?? 0) || 0,
      grandTotal: Number(receiptData.grandTotal ?? existing?.grandTotal ?? 0) || 0,
      currency: receiptData.currency || existing?.currency || 'THB',
      paymentMethod: receiptData.paymentMethod || existing?.paymentMethod || 'เงินสด',
      receiptImagePath: receiptData.receiptImagePath ?? existing?.receiptImagePath ?? '',
      receiptImageUrl: receiptData.receiptImageUrl ?? existing?.receiptImageUrl ?? '',
      imageHash: receiptData.imageHash ?? existing?.imageHash ?? '',
      ocrStatus: receiptData.ocrStatus || existing?.ocrStatus || 'completed',
      verificationStatus: receiptData.verificationStatus || existing?.verificationStatus || 'verified',
      approvalStatus: receiptData.approvalStatus || existing?.approvalStatus || 'pending',
      isConfidential: Boolean(receiptData.isConfidential ?? existing?.isConfidential),
      notes: receiptData.notes ?? existing?.notes ?? '',
      items: receiptData.items ?? existing?.items ?? [],
      totalPages: Number(receiptData.totalPages ?? existing?.totalPages ?? 1) || 1,
      pdfPages: receiptData.pdfPages ?? existing?.pdfPages,
      createdAt: receiptData.createdAt || existing?.createdAt || now,
      updatedAt: now,
      approvedBy: receiptData.approvedBy ?? existing?.approvedBy,
      approvedAt: receiptData.approvedAt ?? existing?.approvedAt,
      isDeleted: false,
    };

    setReceipts((prev) => {
      const idx = prev.findIndex((r) => r.receiptId === receiptId);
      return idx >= 0
        ? prev.map((r) => (r.receiptId === receiptId ? fullReceipt : r))
        : [fullReceipt, ...prev];
    });

    appendAuditLog(
      receiptData.receiptId ? 'Update Receipt' : 'Create Receipt',
      'receipt',
      receiptId,
      `Receipt ${fullReceipt.receiptNumber || 'No-Number'} for vendor ${fullReceipt.vendorName}, Total: ${fullReceipt.grandTotal} THB`
    );

    return receiptId;
  };

  const updateReceiptStatus = async (
    receiptId: string,
    approvalStatus: Receipt['approvalStatus'],
    notes?: string
  ) => {
    if (!currentUser || !isAdmin) {
      throw new Error('Only Master Admin can approve or reject receipts');
    }
    const now = new Date().toISOString();

    setReceipts((prev) =>
      prev.map((r) =>
        r.receiptId === receiptId
          ? {
              ...r,
              approvalStatus,
              approvedBy: currentUser.email,
              approvedAt: now,
              notes: notes !== undefined ? notes : r.notes,
              updatedAt: now,
            }
          : r
      )
    );

    appendAuditLog(
      `Receipt ${approvalStatus.toUpperCase()}`,
      'receipt',
      receiptId,
      `Master Admin ${currentUser.email} set status to ${approvalStatus}${notes ? ` (Note: ${notes})` : ''}`
    );
  };

  const softDeleteReceipt = async (receiptId: string) => {
    if (!currentUser) throw new Error('Unauthorized');
    const target = receipts.find((r) => r.receiptId === receiptId);
    const canDelete = isAdmin || (target && target.uploadedBy === currentUser.uid);
    if (!canDelete) throw new Error('เฉพาะ Master Admin หรือผู้บันทึกเท่านั้นที่สามารถลบใบเสร็จได้');

    setReceipts((prev) => prev.filter((r) => r.receiptId !== receiptId));
    appendAuditLog('Soft Delete Receipt', 'receipt', receiptId, `Deleted by ${currentUser.email}`);
  };

  const batchDeleteReceipts = async (receiptIds: string[]): Promise<void> => {
    if (!currentUser) throw new Error('Unauthorized');
    if (!receiptIds || receiptIds.length === 0) return;

    const idSet = new Set(receiptIds);
    setReceipts((prev) => prev.filter((r) => !idSet.has(r.receiptId)));

    appendAuditLog(
      'Batch Delete Receipts',
      'receipt',
      'batch',
      `Deleted ${receiptIds.length} receipts by ${currentUser.email}`
    );
  };

  const batchApproveReceipts = async (receiptIds: string[], notes?: string): Promise<void> => {
    if (!currentUser) throw new Error('Unauthorized');
    if (!receiptIds || receiptIds.length === 0) return;

    const idSet = new Set(receiptIds);
    const now = new Date().toISOString();
    const approver = currentUser.email || 'Master Admin';

    setReceipts((prev) =>
      prev.map((r) =>
        idSet.has(r.receiptId)
          ? {
              ...r,
              approvalStatus: 'approved' as const,
              approvedBy: approver,
              approvedAt: now,
              notes: notes?.trim()
                ? r.notes
                  ? `${r.notes}\n[อนุมัติ]: ${notes.trim()}`
                  : notes.trim()
                : r.notes,
              updatedAt: now,
            }
          : r
      )
    );

    appendAuditLog(
      'Batch Approve Receipts',
      'receipt',
      'batch',
      `Approved ${receiptIds.length} receipts by ${approver}${notes ? ` (Note: ${notes})` : ''}`
    );
  };

  // User Management
  const addUser = async (userData: {
    displayName: string;
    email: string;
    role: AppUser['role'];
    status: AppUser['status'];
    assignedProjectIds: string[];
  }): Promise<string> => {
    if (!currentUser || !isAdmin) throw new Error('เฉพาะ Master Admin เท่านั้นที่สามารถเพิ่มผู้ใช้งานได้');

    const cleanEmail = userData.email.trim().toLowerCase();
    if (!cleanEmail) throw new Error('กรุณากรอกอีเมล');

    const existing = users.find((u) => u.email.toLowerCase() === cleanEmail);
    const userId = existing ? existing.uid : 'usr_' + cleanEmail.replace(/[^a-zA-Z0-9]/g, '_');
    const now = new Date().toISOString();

    const newUserData: AppUser = {
      uid: userId,
      displayName: userData.displayName.trim() || cleanEmail.split('@')[0],
      email: cleanEmail,
      role: userData.role,
      status: userData.status,
      assignedProjectIds: userData.assignedProjectIds || [],
      createdAt: existing?.createdAt || now,
      lastLoginAt: existing?.lastLoginAt || '',
    };

    setUsers((prev) => {
      const idx = prev.findIndex((u) => u.uid === userId);
      const next =
        idx >= 0 ? prev.map((u) => (u.uid === userId ? newUserData : u)) : [...prev, newUserData];
      return next.sort((a, b) => a.displayName.localeCompare(b.displayName));
    });

    appendAuditLog(
      'Add User / Pre-assign Account',
      'user',
      userId,
      `Master Admin added user: ${newUserData.displayName} (${cleanEmail}) as ${userData.role} [${userData.status}]`
    );

    return userId;
  };

  const updateUserRoleAndStatus = async (
    uid: string,
    role: AppUser['role'],
    status: AppUser['status'],
    assignedProjectIds: string[]
  ) => {
    if (!currentUser || !isAdmin) throw new Error('Admin only');

    setUsers((prev) =>
      prev.map((u) => (u.uid === uid ? { ...u, role, status, assignedProjectIds } : u))
    );

    appendAuditLog(
      'Update User Permissions',
      'user',
      uid,
      `Role: ${role}, Status: ${status}, Projects: ${assignedProjectIds.join(', ')}`
    );
  };

  const deleteUser = async (uid: string): Promise<void> => {
    if (!currentUser || !isAdmin) {
      throw new Error('เฉพาะ Master Admin เท่านั้นที่สามารถลบผู้ใช้งานได้');
    }
    if (uid === currentUser.uid) {
      throw new Error('ไม่สามารถลบบัญชีของตนเองที่กำลังเข้าสู่ระบบอยู่ได้');
    }

    const targetUser = users.find((u) => u.uid === uid);
    setUsers((prev) => prev.filter((u) => u.uid !== uid));

    appendAuditLog(
      'Delete User',
      'user',
      uid,
      `Master Admin (${currentUser.email}) deleted user: ${targetUser?.displayName || uid} (${targetUser?.email || ''})`
    );
  };

  // Category Management
  const saveCategory = async (
    categoryName: string,
    id?: string,
    parentId?: string | null,
    level?: 'main' | 'sub'
  ) => {
    if (!currentUser || !isAdmin) throw new Error('Admin only');
    const catId = id || 'cat-' + Date.now();
    const parentCategory = parentId ? categories.find((c) => c.categoryId === parentId) : null;
    const computedLevel = level || (parentId ? 'sub' : 'main');

    const catData: ExpenseCategory = {
      categoryId: catId,
      categoryName,
      level: computedLevel,
      parentId: parentId || null,
      parentName: parentCategory ? parentCategory.categoryName : null,
      isActive: true,
      createdAt: new Date().toISOString(),
    };

    setCategories((prev) => {
      const idx = prev.findIndex((c) => c.categoryId === catId);
      let updated: ExpenseCategory[];
      if (idx >= 0) {
        updated = [...prev];
        updated[idx] = { ...updated[idx], ...catData };
      } else {
        updated = [...prev, catData];
      }
      return updated.sort((a, b) => a.categoryName.localeCompare(b.categoryName));
    });

    appendAuditLog('Save Expense Category', 'category', catId, `Category: ${categoryName} (${computedLevel})`);
  };

  const deleteCategory = async (categoryId: string) => {
    if (!currentUser || !isAdmin) throw new Error('Admin only');
    const targetCat = categories.find((c) => c.categoryId === categoryId);
    const subCategories = categories.filter((c) => c.parentId === categoryId);
    const idsToDelete = new Set([categoryId, ...subCategories.map((s) => s.categoryId)]);

    setCategories((prev) => prev.filter((c) => !idsToDelete.has(c.categoryId)));
    appendAuditLog(
      'Delete Expense Category',
      'category',
      categoryId,
      `Category ID: ${categoryId} (${targetCat?.categoryName || ''}) and ${subCategories.length} subcategories`
    );
  };

  const toggleCategoryStatus = async (categoryId: string, isActive: boolean) => {
    if (!currentUser || !isAdmin) throw new Error('Admin only');
    setCategories((prev) =>
      prev.map((c) => (c.categoryId === categoryId ? { ...c, isActive } : c))
    );
    appendAuditLog('Toggle Category Status', 'category', categoryId, `Active: ${isActive}`);
  };

  // Bank Account operations
  const saveBankAccount = async (accountData: Partial<BankAccount>): Promise<string> => {
    const accountId =
      accountData.id || 'acc_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
    const now = new Date().toISOString();
    const existing = bankAccounts.find((b) => b.id === accountId);

    const fullAccount: BankAccount = {
      id: accountId,
      accountNumber: accountData.accountNumber || '',
      bankName: accountData.bankName || 'ธนาคารกสิกรไทย',
      bankCode: accountData.bankCode || 'KBANK',
      accountName: accountData.accountName || 'บัญชีเงินฝากดำเนินงาน',
      branchName: accountData.branchName || '',
      assetType: accountData.assetType || 'savings',
      currentBalance: Number(accountData.currentBalance) || 0,
      availableBalance:
        accountData.availableBalance !== undefined
          ? Number(accountData.availableBalance)
          : Number(accountData.currentBalance) || 0,
      currency: accountData.currency || 'THB',
      projectId: accountData.projectId || '',
      projectName: accountData.projectName || '',
      lastUpdatedDate: accountData.lastUpdatedDate || now.slice(0, 10),
      notes: accountData.notes || '',
      statementCount: accountData.statementCount || existing?.statementCount || 0,
      createdAt: accountData.createdAt || existing?.createdAt || now,
      updatedAt: now,
      createdBy: accountData.createdBy || currentUser?.uid || 'system',
    };

    setBankAccounts((prev) => {
      const idx = prev.findIndex((b) => b.id === accountId);
      const next =
        idx >= 0
          ? prev.map((b) => (b.id === accountId ? fullAccount : b))
          : [fullAccount, ...prev];
      return next.sort((a, b) => (b.currentBalance || 0) - (a.currentBalance || 0));
    });

    appendAuditLog(
      accountData.id ? 'Update Bank Account' : 'Create Bank Account',
      'auth',
      accountId,
      `Saved bank account ${fullAccount.bankName} (${fullAccount.accountNumber}) balance ${fullAccount.currentBalance}`
    );

    return accountId;
  };

  const deleteBankAccount = async (accountId: string): Promise<void> => {
    setBankAccounts((prev) => prev.filter((b) => b.id !== accountId));
    appendAuditLog('Delete Bank Account', 'auth', accountId, `Deleted bank account ${accountId}`);
  };

  // Statement Record operations
  const saveStatementRecord = async (
    statementData: Partial<StatementRecord>,
    updateBalance: boolean = true
  ): Promise<string> => {
    const statementId =
      statementData.id || 'stmt_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
    const now = new Date().toISOString();

    const normalizedTxs = normalizeStatementTransactionsList(
      statementData.transactions || [],
      Number(statementData.openingBalance) || 0
    ).map((t) => ({
      ...t,
      date: normalizeDateISO(t.date) || t.date || '',
      debitAmount: Number(t.debitAmount) || 0,
      creditAmount: Number(t.creditAmount) || 0,
      balance: Number(t.balance) || 0,
      projectId: t.projectId || statementData.projectId || '',
      projectName: t.projectName || statementData.projectName || '',
    }));

    const fullStatement: StatementRecord = {
      id: statementId,
      accountId: statementData.accountId || '',
      accountNumber: statementData.accountNumber || '',
      bankName: statementData.bankName || '',
      accountName: statementData.accountName || '',
      projectId: statementData.projectId || '',
      projectName: statementData.projectName || '',
      statementPeriodStart: normalizeDateISO(statementData.statementPeriodStart) || '',
      statementPeriodEnd: normalizeDateISO(statementData.statementPeriodEnd) || '',
      openingBalance: Number(statementData.openingBalance) || 0,
      closingBalance: Number(statementData.closingBalance) || 0,
      totalDebit:
        Number(statementData.totalDebit) ||
        Math.round(normalizedTxs.reduce((s, tx) => s + (tx.debitAmount || 0), 0) * 100) / 100,
      totalCredit:
        Number(statementData.totalCredit) ||
        Math.round(normalizedTxs.reduce((s, tx) => s + (tx.creditAmount || 0), 0) * 100) / 100,
      transactions: normalizedTxs,
      fileName: statementData.fileName || '',
      uploadedAt: statementData.uploadedAt || now,
      uploadedBy: statementData.uploadedBy || currentUser?.uid || 'system',
      uploadedByEmail: statementData.uploadedByEmail || currentUser?.email || '',
      rawOcrSummary: statementData.rawOcrSummary || '',
      notes: statementData.notes || '',
    };

    setStatementRecords((prev) => {
      const idx = prev.findIndex((s) => s.id === statementId);
      const next =
        idx >= 0
          ? prev.map((s) => (s.id === statementId ? fullStatement : s))
          : [fullStatement, ...prev];
      return next.sort((a, b) => (b.uploadedAt || '').localeCompare(a.uploadedAt || ''));
    });

    if (updateBalance && (fullStatement.accountId || fullStatement.accountNumber)) {
      setBankAccounts((prev) => {
        const accId =
          fullStatement.accountId ||
          'acc_' + (fullStatement.accountNumber || '').replace(/[^0-9]/g, '');
        const exists = prev.some(
          (b) =>
            b.id === accId ||
            (b.accountNumber && b.accountNumber === fullStatement.accountNumber)
        );
        let next: BankAccount[];
        if (exists) {
          next = prev.map((b) => {
            if (
              b.id === accId ||
              (b.accountNumber && b.accountNumber === fullStatement.accountNumber)
            ) {
              return {
                ...b,
                currentBalance: fullStatement.closingBalance,
                availableBalance: fullStatement.closingBalance,
                lastUpdatedDate: fullStatement.statementPeriodEnd || now.slice(0, 10),
                statementCount: (b.statementCount || 0) + 1,
                updatedAt: now,
              };
            }
            return b;
          });
        } else {
          const newAcc: BankAccount = {
            id: accId,
            accountNumber: fullStatement.accountNumber || '000-0-00000-0',
            bankName: fullStatement.bankName || 'ธนาคารทั่วไป',
            bankCode: 'KBANK',
            accountName: fullStatement.accountName || `บัญชี ${fullStatement.bankName || ''}`,
            assetType: 'savings',
            currentBalance: fullStatement.closingBalance,
            availableBalance: fullStatement.closingBalance,
            currency: 'THB',
            projectId: fullStatement.projectId || '',
            projectName: fullStatement.projectName || '',
            lastUpdatedDate: fullStatement.statementPeriodEnd || now.slice(0, 10),
            statementCount: 1,
            createdAt: now,
            updatedAt: now,
            createdBy: currentUser?.uid || 'system',
          };
          next = [newAcc, ...prev];
        }
        return next.sort((a, b) => (b.currentBalance || 0) - (a.currentBalance || 0));
      });
    }

    appendAuditLog(
      'Upload Bank Statement',
      'auth',
      statementId,
      `Imported statement for ${fullStatement.bankName} (${fullStatement.accountNumber}) with ${fullStatement.transactions.length} transactions`
    );

    return statementId;
  };

  const deleteStatementRecord = async (statementId: string): Promise<void> => {
    setStatementRecords((prev) => prev.filter((s) => s.id !== statementId));
    appendAuditLog(
      'Delete Statement Record',
      'auth',
      statementId,
      `Deleted statement record ${statementId}`
    );
  };

  return (
    <DataContext.Provider
      value={{
        projects,
        receipts,
        categories,
        users,
        auditLogs,
        bankAccounts: effectiveBankAccounts,
        statementRecords,
        loadingData,
        isOfflineQuotaMode,
        filters,
        setFilters,
        resetFilters,
        resetMockData,
        saveProject,
        updateProjectStatus,
        deleteProject,
        saveReceipt,
        updateReceiptStatus,
        softDeleteReceipt,
        batchDeleteReceipts,
        batchApproveReceipts,
        addUser,
        updateUserRoleAndStatus,
        deleteUser,
        saveCategory,
        toggleCategoryStatus,
        deleteCategory,
        saveBankAccount,
        deleteBankAccount,
        saveStatementRecord,
        deleteStatementRecord,
        projectsMap,
        categoriesMap,
        usersMap,
        bankAccountsMap,
      }}
    >
      {children}
    </DataContext.Provider>
  );
};
