import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import {
  collection,
  doc,
  onSnapshot,
  setDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
  query,
  where,
  serverTimestamp,
} from 'firebase/firestore';
import {
  db,
  OperationType,
  handleFirestoreError,
  sanitizeForFirestore,
  normalizeTimestamp,
} from '../firebase';
import { useAuth, getInviteDocId } from './AuthContext';
import { isMasterAdminEmail } from '../services/dbService';
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
  DEFAULT_CATEGORIES,
  INITIAL_MOCK_PROJECTS,
  INITIAL_MOCK_RECEIPTS,
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
  isSavingData: boolean;
  savingLabel: string | null;
  isOfflineQuotaMode: boolean;
  filters: DashboardFilters;
  setFilters: React.Dispatch<React.SetStateAction<DashboardFilters>>;
  resetFilters: () => void;
  seedSampleDataToFirebase: () => Promise<void>;
  // Project operations
  saveProject: (projectData: Partial<Project>) => Promise<string>;
  updateProjectStatus: (projectId: string, status: Project['status']) => Promise<void>;
  deleteProject: (projectId: string) => Promise<void>;
  // Receipt operations
  saveReceipt: (receiptData: Partial<Receipt>) => Promise<string>;
  updateReceiptStatus: (
    receiptId: string,
    approvalStatus: Receipt['approvalStatus'],
    notes?: string
  ) => Promise<void>;
  softDeleteReceipt: (receiptId: string) => Promise<void>;
  batchDeleteReceipts: (receiptIds: string[]) => Promise<void>;
  batchApproveReceipts: (receiptIds: string[], notes?: string) => Promise<void>;
  // User Management
  addUser: (userData: {
    displayName: string;
    email: string;
    position?: string;
    department?: string;
    phone?: string;
    role: AppUser['role'];
    status: AppUser['status'];
    assignedProjectIds: string[];
  }) => Promise<string>;
  updateUser: (
    uid: string,
    updates: {
      displayName: string;
      email: string;
      position?: string;
      department?: string;
      phone?: string;
      role: AppUser['role'];
      status: AppUser['status'];
      assignedProjectIds: string[];
    }
  ) => Promise<void>;
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
  saveStatementRecord: (
    statementData: Partial<StatementRecord>,
    updateBalance?: boolean
  ) => Promise<string>;
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

function capString(val: unknown, maxLen: number): string {
  if (typeof val !== 'string') return '';
  return val.length > maxLen ? val.slice(0, maxLen) : val;
}

export const DataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser, authReady, isAdmin, isApproved, updateCurrentUserProfile } = useAuth();

  const [projects, setProjects] = useState<Project[]>([]);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [userDocs, setUserDocs] = useState<AppUser[]>([]);
  const [inviteDocs, setInviteDocs] = useState<AppUser[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [statementRecords, setStatementRecords] = useState<StatementRecord[]>([]);

  const [loadingData, setLoadingData] = useState<boolean>(false);
  const [pendingWrites, setPendingWrites] = useState<number>(0);
  const [savingLabel, setSavingLabel] = useState<string | null>(null);
  const [isOfflineQuotaMode, setIsOfflineQuotaMode] = useState<boolean>(false);
  const [fatalListenerError, setFatalListenerError] = useState<Error | null>(null);
  const [filters, setFilters] = useState<DashboardFilters>(defaultFilters);

  const seededDefaultCategoriesRef = useRef<boolean>(false);

  if (fatalListenerError) {
    throw fatalListenerError;
  }

  const resetFilters = () => setFilters(defaultFilters);

  const runWithSaving = useCallback(async <T,>(label: string, fn: () => Promise<T>): Promise<T> => {
    setPendingWrites((c) => c + 1);
    setSavingLabel(label);
    try {
      return await fn();
    } finally {
      setPendingWrites((c) => {
        const next = Math.max(0, c - 1);
        if (next === 0) setSavingLabel(null);
        return next;
      });
    }
  }, []);

  const appendAuditLog = useCallback(
    async (
      action: string,
      entityType: AuditLog['entityType'],
      entityId: string,
      changes: string
    ) => {
      if (!currentUser) return;
      const logId = 'log_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
      const logPath = `auditLogs/${logId}`;
      try {
        await setDoc(
          doc(db, 'auditLogs', logId),
          sanitizeForFirestore({
            logId,
            userId: currentUser.uid,
            userEmail: capString(currentUser.email, 200),
            action: capString(action, 120),
            entityType,
            entityId: capString(entityId, 128),
            changes: capString(changes, 1000),
            timestamp: serverTimestamp(),
          })
        );
      } catch (error) {
        console.warn('Audit log write failed:', error);
      }
    },
    [currentUser]
  );

  // Real-time Firestore Subscriptions
  useEffect(() => {
    if (!authReady || !currentUser || !isApproved) {
      setProjects([]);
      setReceipts([]);
      setCategories([]);
      setUserDocs([]);
      setInviteDocs([]);
      setAuditLogs([]);
      setBankAccounts([]);
      setStatementRecords([]);
      setLoadingData(false);
      return;
    }

    const canListAll = isMasterAdminEmail(currentUser.email);
    const cleanEmail = currentUser.email.trim().toLowerCase();

    setLoadingData(true);
    const loadedCollections = new Set<string>();
    const expectedCollections = canListAll
      ? ['projects', 'categories', 'receipts', 'bankAccounts', 'statements', 'auditLogs', 'users', 'userInvites']
      : ['projects', 'categories', 'receipts', 'bankAccounts', 'statements', 'auditLogs'];

    const markLoaded = (name: string) => {
      loadedCollections.add(name);
      if (expectedCollections.every((c) => loadedCollections.has(c))) {
        setLoadingData(false);
      }
    };

    const handleListenerError = (path: string) => (error: any) => {
      const msg = error?.message || String(error);
      if (/quota exceeded/i.test(msg)) {
        setIsOfflineQuotaMode(true);
      }
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (wrappedErr: any) {
        setFatalListenerError(wrappedErr instanceof Error ? wrappedErr : new Error(String(wrappedErr)));
      }
    };

    const unsubscribers: (() => void)[] = [];

    // 1. Projects
    const projectsQ = canListAll
      ? collection(db, 'projects')
      : query(collection(db, 'projects'), where('assignedUsers', 'array-contains', cleanEmail));

    unsubscribers.push(
      onSnapshot(
        projectsQ,
        (snap) => {
          const list: Project[] = snap.docs.map((d) => {
            const data = d.data() as Record<string, any>;
            return {
              projectId: data.projectId || d.id,
              projectCode: data.projectCode || '',
              clientName: data.clientName || '',
              budget: Number(data.budget) || 0,
              assignedUsers: Array.isArray(data.assignedUsers) ? data.assignedUsers : [],
              status: data.status || 'active',
              notes: data.notes || '',
              createdBy: data.createdBy || '',
              createdAt: normalizeTimestamp(data.createdAt),
              updatedAt: normalizeTimestamp(data.updatedAt),
            };
          });
          list.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
          setProjects(list);
          markLoaded('projects');
        },
        handleListenerError('projects')
      )
    );

    // 2. Categories
    const categoriesQ = canListAll
      ? collection(db, 'categories')
      : query(collection(db, 'categories'), where('isActive', '==', true));

    unsubscribers.push(
      onSnapshot(
        categoriesQ,
        async (snap) => {
          if (snap.empty && canListAll && !seededDefaultCategoriesRef.current) {
            seededDefaultCategoriesRef.current = true;
            try {
              const batch = writeBatch(db);
              DEFAULT_CATEGORIES.forEach((cat) => {
                batch.set(
                  doc(db, 'categories', cat.id),
                  sanitizeForFirestore({
                    categoryId: cat.id,
                    categoryName: cat.name,
                    level: cat.level,
                    parentId: cat.parentId ?? null,
                    parentName: cat.parentName ?? null,
                    isActive: true,
                    createdBy: currentUser.uid,
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp(),
                  })
                );
              });
              await batch.commit();
            } catch (err) {
              console.warn('Default category seeding skipped/failed:', err);
            }
          }

          const list: ExpenseCategory[] = snap.docs.map((d) => {
            const data = d.data() as Record<string, any>;
            return {
              categoryId: data.categoryId || d.id,
              categoryName: data.categoryName || '',
              parentId: data.parentId ?? null,
              parentName: data.parentName ?? null,
              level: data.level || (data.parentId ? 'sub' : 'main'),
              isActive: data.isActive !== false,
              createdAt: normalizeTimestamp(data.createdAt),
            };
          });
          list.sort((a, b) => a.categoryName.localeCompare(b.categoryName));
          setCategories(list);
          markLoaded('categories');
        },
        handleListenerError('categories')
      )
    );

    // 3. Receipts
    const receiptsQ = canListAll
      ? collection(db, 'receipts')
      : query(collection(db, 'receipts'), where('uploadedBy', '==', currentUser.uid));

    unsubscribers.push(
      onSnapshot(
        receiptsQ,
        (snap) => {
          const list: Receipt[] = snap.docs
            .map((d) => {
              const data = d.data() as Record<string, any>;
              return {
                receiptId: data.receiptId || d.id,
                projectId: data.projectId || '',
                uploadedBy: data.uploadedBy || '',
                uploadedByEmail: data.uploadedByEmail || '',
                documentType: data.documentType || 'receipt',
                documentDate: data.documentDate || '',
                uploadDate: data.uploadDate || '',
                receiptNumber: data.receiptNumber || '',
                vendorName: data.vendorName || '',
                vendorTaxId: data.vendorTaxId || '',
                vendorAddress: data.vendorAddress || '',
                customerName: data.customerName || '',
                customerTaxId: data.customerTaxId || '',
                customerAddress: data.customerAddress || '',
                categoryId: data.categoryId || 'cat-other',
                subtotal: Number(data.subtotal) || 0,
                vatAmount: Number(data.vatAmount) || 0,
                withholdingTax: Number(data.withholdingTax) || 0,
                discount: Number(data.discount) || 0,
                grandTotal: Number(data.grandTotal) || 0,
                currency: data.currency || 'THB',
                paymentMethod: data.paymentMethod || 'เงินสด',
                receiptImagePath: data.receiptImagePath || '',
                receiptImageUrl: data.receiptImageUrl || '',
                imageHash: data.imageHash || '',
                ocrStatus: data.ocrStatus || 'completed',
                verificationStatus: data.verificationStatus || 'verified',
                approvalStatus: data.approvalStatus || 'pending',
                isConfidential: Boolean(data.isConfidential),
                notes: data.notes || '',
                items: Array.isArray(data.items) ? data.items : [],
                totalPages: Number(data.totalPages) || 1,
                pdfPages: Array.isArray(data.pdfPages) ? data.pdfPages : undefined,
                createdAt: normalizeTimestamp(data.createdAt),
                updatedAt: normalizeTimestamp(data.updatedAt),
                approvedBy: data.approvedBy,
                approvedAt: data.approvedAt,
                isDeleted: Boolean(data.isDeleted),
              } as Receipt;
            })
            .filter((r) => !r.isDeleted);
          list.sort((a, b) => (b.documentDate || '').localeCompare(a.documentDate || ''));
          setReceipts(list);
          markLoaded('receipts');
        },
        handleListenerError('receipts')
      )
    );

    // 4. Bank Accounts
    const bankAccountsQ = canListAll
      ? collection(db, 'bankAccounts')
      : query(collection(db, 'bankAccounts'), where('createdBy', '==', currentUser.uid));

    unsubscribers.push(
      onSnapshot(
        bankAccountsQ,
        (snap) => {
          const list: BankAccount[] = snap.docs.map((d) => {
            const data = d.data() as Record<string, any>;
            return {
              id: data.id || d.id,
              accountNumber: data.accountNumber || '',
              bankName: data.bankName || '',
              bankCode: data.bankCode || 'KBANK',
              accountName: data.accountName || '',
              branchName: data.branchName || '',
              assetType: data.assetType || 'savings',
              currentBalance: Number(data.currentBalance) || 0,
              availableBalance: Number(data.availableBalance ?? data.currentBalance) || 0,
              currency: data.currency || 'THB',
              projectId: data.projectId || '',
              projectName: data.projectName || '',
              lastUpdatedDate: data.lastUpdatedDate || '',
              notes: data.notes || '',
              statementCount: Number(data.statementCount) || 0,
              createdAt: normalizeTimestamp(data.createdAt),
              updatedAt: normalizeTimestamp(data.updatedAt),
              createdBy: data.createdBy || '',
            };
          });
          list.sort((a, b) => (b.currentBalance || 0) - (a.currentBalance || 0));
          setBankAccounts(list);
          markLoaded('bankAccounts');
        },
        handleListenerError('bankAccounts')
      )
    );

    // 5. Statements
    const statementsQ = canListAll
      ? collection(db, 'statements')
      : query(collection(db, 'statements'), where('uploadedBy', '==', currentUser.uid));

    unsubscribers.push(
      onSnapshot(
        statementsQ,
        (snap) => {
          const list: StatementRecord[] = snap.docs.map((d) => {
            const data = d.data() as Record<string, any>;
            return {
              id: data.id || d.id,
              accountId: data.accountId || '',
              accountNumber: data.accountNumber || '',
              bankName: data.bankName || '',
              accountName: data.accountName || '',
              projectId: data.projectId || '',
              projectName: data.projectName || '',
              statementPeriodStart: data.statementPeriodStart || '',
              statementPeriodEnd: data.statementPeriodEnd || '',
              openingBalance: Number(data.openingBalance) || 0,
              closingBalance: Number(data.closingBalance) || 0,
              totalDebit: Number(data.totalDebit) || 0,
              totalCredit: Number(data.totalCredit) || 0,
              transactions: Array.isArray(data.transactions) ? data.transactions : [],
              fileName: data.fileName || '',
              uploadedAt: data.uploadedAt || normalizeTimestamp(data.createdAt),
              uploadedBy: data.uploadedBy || '',
              uploadedByEmail: data.uploadedByEmail || '',
              rawOcrSummary: data.rawOcrSummary || '',
              notes: data.notes || '',
            };
          });
          list.sort((a, b) => (b.uploadedAt || '').localeCompare(a.uploadedAt || ''));
          setStatementRecords(list);
          markLoaded('statements');
        },
        handleListenerError('statements')
      )
    );

    // 6. Audit Logs
    const auditLogsQ = canListAll
      ? collection(db, 'auditLogs')
      : query(collection(db, 'auditLogs'), where('userId', '==', currentUser.uid));

    unsubscribers.push(
      onSnapshot(
        auditLogsQ,
        (snap) => {
          const list: AuditLog[] = snap.docs.map((d) => {
            const data = d.data() as Record<string, any>;
            return {
              logId: data.logId || d.id,
              userId: data.userId || '',
              userEmail: data.userEmail || '',
              action: data.action || '',
              entityType: data.entityType || 'auth',
              entityId: data.entityId || '',
              changes: data.changes || '',
              timestamp: normalizeTimestamp(data.timestamp),
            };
          });
          list.sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''));
          setAuditLogs(list.slice(0, 100));
          markLoaded('auditLogs');
        },
        handleListenerError('auditLogs')
      )
    );

    // 7 & 8. Users & UserInvites (Master Admin list only; non-admin keeps own profile)
    if (canListAll) {
      unsubscribers.push(
        onSnapshot(
          collection(db, 'users'),
          (snap) => {
            const list: AppUser[] = snap.docs.map((d) => {
              const data = d.data() as Record<string, any>;
              return {
                uid: data.uid || d.id,
                displayName: data.displayName || 'User',
                email: (data.email || '').toLowerCase(),
                position: data.position || '',
                department: data.department || '',
                phone: data.phone || '',
                role: data.role || 'user',
                status: data.status || 'pending',
                assignedProjectIds: Array.isArray(data.assignedProjectIds)
                  ? data.assignedProjectIds
                  : [],
                createdAt: normalizeTimestamp(data.createdAt),
                lastLoginAt: data.lastLoginAt || '',
              };
            });
            setUserDocs(list);
            markLoaded('users');
          },
          handleListenerError('users')
        )
      );

      unsubscribers.push(
        onSnapshot(
          collection(db, 'userInvites'),
          (snap) => {
            const list: AppUser[] = snap.docs.map((d) => {
              const data = d.data() as Record<string, any>;
              return {
                uid: data.inviteId || d.id,
                displayName: data.displayName || 'Invited User',
                email: (data.email || '').toLowerCase(),
                position: data.position || '',
                department: data.department || '',
                phone: data.phone || '',
                role: data.role || 'user',
                status: data.status || 'active',
                assignedProjectIds: Array.isArray(data.assignedProjectIds)
                  ? data.assignedProjectIds
                  : [],
                createdAt: normalizeTimestamp(data.createdAt),
                lastLoginAt: '',
              };
            });
            setInviteDocs(list);
            markLoaded('userInvites');
          },
          handleListenerError('userInvites')
        )
      );
    } else {
      setUserDocs([currentUser]);
      setInviteDocs([]);
    }

    return () => {
      unsubscribers.forEach((unsub) => unsub());
    };
  }, [authReady, currentUser, isApproved]);

  // Merge active registered users + pre-assigned invites (deduped by email)
  const users = React.useMemo(() => {
    const emailSet = new Set(userDocs.map((u) => u.email.trim().toLowerCase()));
    const merged = [...userDocs];
    inviteDocs.forEach((inv) => {
      if (!emailSet.has(inv.email.trim().toLowerCase())) {
        merged.push(inv);
      }
    });
    return merged.sort((a, b) => (a.displayName || '').localeCompare(b.displayName || ''));
  }, [userDocs, inviteDocs]);

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
          lastUpdatedDate: s.statementPeriodEnd || s.uploadedAt?.slice(0, 10) || '',
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

  // Seed sample business data to Firebase (Admin utility in Settings)
  const seedSampleDataToFirebase = async () => {
    if (!currentUser || !isAdmin) {
      throw new Error('เฉพาะ Master Admin เท่านั้นที่สามารถเพิ่มข้อมูลตัวอย่างได้');
    }

    await runWithSaving('กำลังเพิ่มข้อมูลตัวอย่างเข้า Firebase...', async () => {
      const batch1 = writeBatch(db);

      DEFAULT_CATEGORIES.forEach((cat) => {
        batch1.set(
          doc(db, 'categories', cat.id),
          sanitizeForFirestore({
            categoryId: cat.id,
            categoryName: cat.name,
            level: cat.level,
            parentId: cat.parentId ?? null,
            parentName: cat.parentName ?? null,
            isActive: true,
            createdBy: currentUser.uid,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          })
        );
      });

      INITIAL_MOCK_PROJECTS.forEach((p) => {
        const assigned = Array.from(
          new Set([...(p.assignedUsers || []).map((e) => e.toLowerCase()), currentUser.email.toLowerCase()])
        );
        batch1.set(
          doc(db, 'projects', p.projectId),
          sanitizeForFirestore({
            projectId: p.projectId,
            projectCode: capString(p.projectCode, 40),
            clientName: capString(p.clientName, 200),
            budget: Number(p.budget) || 0,
            assignedUsers: assigned,
            status: p.status,
            notes: capString(p.notes || '', 1000),
            createdBy: currentUser.uid,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          })
        );
      });

      try {
        await batch1.commit();
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, 'seed_sample_data_base');
      }

      const batch = writeBatch(db);

      INITIAL_MOCK_RECEIPTS.forEach((r) => {
        const imgUrl =
          r.receiptImageUrl && r.receiptImageUrl.length <= 350000 ? r.receiptImageUrl : '';
        batch.set(
          doc(db, 'receipts', r.receiptId),
          sanitizeForFirestore({
            receiptId: r.receiptId,
            projectId: r.projectId || '',
            uploadedBy: currentUser.uid,
            uploadedByEmail: currentUser.email,
            documentType: r.documentType,
            documentDate: r.documentDate,
            uploadDate: r.uploadDate,
            receiptNumber: capString(r.receiptNumber, 100),
            vendorName: capString(r.vendorName, 200),
            vendorTaxId: capString(r.vendorTaxId || '', 40),
            vendorAddress: capString(r.vendorAddress || '', 500),
            customerName: capString(r.customerName || '', 200),
            customerTaxId: capString(r.customerTaxId || '', 40),
            customerAddress: capString(r.customerAddress || '', 500),
            categoryId: r.categoryId,
            subtotal: Number(r.subtotal) || 0,
            vatAmount: Number(r.vatAmount) || 0,
            withholdingTax: Number(r.withholdingTax) || 0,
            discount: Number(r.discount) || 0,
            grandTotal: Number(r.grandTotal) || 0,
            currency: r.currency || 'THB',
            paymentMethod: capString(r.paymentMethod || 'เงินสด', 60),
            receiptImageUrl: imgUrl,
            ocrStatus: r.ocrStatus,
            verificationStatus: r.verificationStatus,
            approvalStatus: r.approvalStatus,
            isConfidential: Boolean(r.isConfidential),
            notes: capString(r.notes || '', 1500),
            items: (r.items || []).slice(0, 200),
            totalPages: Number(r.totalPages) || 1,
            approvedBy: r.approvedBy,
            approvedAt: r.approvedAt,
            isDeleted: false,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          })
        );
      });

      INITIAL_MOCK_BANK_ACCOUNTS.forEach((acc) => {
        batch.set(
          doc(db, 'bankAccounts', acc.id),
          sanitizeForFirestore({
            id: acc.id,
            accountNumber: capString(acc.accountNumber, 60),
            bankName: capString(acc.bankName, 120),
            bankCode: capString(acc.bankCode || 'KBANK', 20),
            accountName: capString(acc.accountName, 200),
            branchName: capString(acc.branchName || '', 120),
            assetType: acc.assetType,
            currentBalance: Number(acc.currentBalance) || 0,
            availableBalance: Number(acc.availableBalance ?? acc.currentBalance) || 0,
            currency: acc.currency || 'THB',
            projectId: acc.projectId || '',
            projectName: capString(acc.projectName || '', 200),
            lastUpdatedDate: acc.lastUpdatedDate || new Date().toISOString().slice(0, 10),
            notes: capString(acc.notes || '', 1000),
            statementCount: Number(acc.statementCount) || 0,
            createdBy: currentUser.uid,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          })
        );
      });

      INITIAL_MOCK_STATEMENT_RECORDS.forEach((stmt) => {
        batch.set(
          doc(db, 'statements', stmt.id),
          sanitizeForFirestore({
            id: stmt.id,
            accountId: stmt.accountId,
            accountNumber: capString(stmt.accountNumber, 60),
            bankName: capString(stmt.bankName, 120),
            accountName: capString(stmt.accountName || '', 200),
            projectId: stmt.projectId || '',
            projectName: capString(stmt.projectName || '', 200),
            statementPeriodStart: stmt.statementPeriodStart || '',
            statementPeriodEnd: stmt.statementPeriodEnd || '',
            openingBalance: Number(stmt.openingBalance) || 0,
            closingBalance: Number(stmt.closingBalance) || 0,
            totalDebit: Number(stmt.totalDebit) || 0,
            totalCredit: Number(stmt.totalCredit) || 0,
            transactions: (stmt.transactions || []).slice(0, 500),
            fileName: capString(stmt.fileName || '', 255),
            uploadedAt: stmt.uploadedAt || new Date().toISOString(),
            uploadedBy: currentUser.uid,
            uploadedByEmail: currentUser.email,
            rawOcrSummary: capString(stmt.rawOcrSummary || '', 5000),
            notes: capString(stmt.notes || '', 1000),
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          })
        );
      });

      try {
        await batch.commit();
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, 'seed_sample_data');
      }

      await appendAuditLog(
        'Seed Sample Data',
        'auth',
        'firebase_seed',
        `Master Admin ${currentUser.email} seeded starter projects, receipts, bank accounts & statements`
      );
    });
  };

  // ==================== PROJECT OPERATIONS ====================
  const saveProject = async (projectData: Partial<Project>): Promise<string> => {
    if (!currentUser) throw new Error('Unauthorized');
    const isUpdate = Boolean(projectData.projectId && projectsMap[projectData.projectId]);
    const projectId = projectData.projectId || 'proj_' + Date.now();
    const path = `projects/${projectId}`;

    await runWithSaving(isUpdate ? 'กำลังอัปเดตโครงการ...' : 'กำลังสร้างโครงการ...', async () => {
      const normalizedAssigned = Array.from(
        new Set((projectData.assignedUsers || []).map((e) => e.trim().toLowerCase()).filter(Boolean))
      ).slice(0, 100);

      try {
        if (isUpdate) {
          await updateDoc(
            doc(db, 'projects', projectId),
            sanitizeForFirestore({
              projectCode: capString(projectData.projectCode || projectsMap[projectId].projectCode, 40),
              clientName: capString(projectData.clientName || projectsMap[projectId].clientName, 200),
              budget: Math.max(0, Number(projectData.budget ?? projectsMap[projectId].budget ?? 0) || 0),
              assignedUsers: normalizedAssigned,
              status: projectData.status || projectsMap[projectId].status || 'active',
              notes: capString(projectData.notes ?? projectsMap[projectId].notes ?? '', 1000),
              updatedAt: serverTimestamp(),
            })
          );
        } else {
          await setDoc(
            doc(db, 'projects', projectId),
            sanitizeForFirestore({
              projectId,
              projectCode: capString(
                projectData.projectCode || 'PRJ-' + Math.floor(100 + Math.random() * 900),
                40
              ),
              clientName: capString(projectData.clientName || 'หน่วยงานทั่วไป', 200),
              budget: Math.max(0, Number(projectData.budget) || 0),
              assignedUsers: normalizedAssigned,
              status: projectData.status || 'active',
              notes: capString(projectData.notes || '', 1000),
              createdBy: currentUser.uid,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            })
          );
        }
      } catch (error) {
        handleFirestoreError(error, isUpdate ? OperationType.UPDATE : OperationType.CREATE, path);
      }

      await appendAuditLog(
        isUpdate ? 'Update Project' : 'Create Project',
        'project',
        projectId,
        `Project ${projectData.projectCode || projectId}: ${projectData.clientName || ''}`
      );
    });

    return projectId;
  };

  const updateProjectStatus = async (projectId: string, status: Project['status']) => {
    if (!currentUser) throw new Error('Unauthorized');
    const path = `projects/${projectId}`;
    await runWithSaving('กำลังอัปเดตสถานะโครงการ...', async () => {
      try {
        await updateDoc(doc(db, 'projects', projectId), {
          status,
          updatedAt: serverTimestamp(),
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, path);
      }
      await appendAuditLog('Update Project Status', 'project', projectId, `Status changed to ${status}`);
    });
  };

  const deleteProject = async (projectId: string): Promise<void> => {
    if (!currentUser) throw new Error('Unauthorized');
    if (!isAdmin) throw new Error('เฉพาะ Master Admin เท่านั้นที่สามารถลบโครงการได้');
    const projectToDelete = projects.find((p) => p.projectId === projectId);
    const path = `projects/${projectId}`;

    await runWithSaving('กำลังลบโครงการ...', async () => {
      try {
        // Unlink existing receipts referencing this project so data isn't lost
        const linkedReceipts = receipts.filter((r) => r.projectId === projectId);
        if (linkedReceipts.length > 0) {
          const batch = writeBatch(db);
          linkedReceipts.forEach((r) => {
            batch.update(doc(db, 'receipts', r.receiptId), {
              projectId: '',
              updatedAt: serverTimestamp(),
            });
          });
          batch.delete(doc(db, 'projects', projectId));
          await batch.commit();
        } else {
          await deleteDoc(doc(db, 'projects', projectId));
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, path);
      }

      await appendAuditLog(
        'Delete Project',
        'project',
        projectId,
        `Deleted project ${projectToDelete?.projectCode || projectId}: ${projectToDelete?.clientName || ''} by ${currentUser.email}`
      );
    });
  };

  // ==================== RECEIPT OPERATIONS ====================
  const saveReceipt = async (receiptData: Partial<Receipt>): Promise<string> => {
    if (!currentUser) throw new Error('Unauthorized');
    const now = new Date().toISOString();
    const existing = receiptData.receiptId
      ? receipts.find((r) => r.receiptId === receiptData.receiptId)
      : undefined;
    const isUpdate = Boolean(existing);
    const receiptId =
      receiptData.receiptId || 'rcpt_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
    const path = `receipts/${receiptId}`;

    const rawImg = receiptData.receiptImageUrl ?? existing?.receiptImageUrl ?? '';
    const safeImageUrl = typeof rawImg === 'string' && rawImg.length <= 350000 ? rawImg : '';

    await runWithSaving(isUpdate ? 'กำลังบันทึกการแก้ไขใบเสร็จ...' : 'กำลังบันทึกใบเสร็จเข้าฐานข้อมูล...', async () => {
      const itemsList = (receiptData.items ?? existing?.items ?? []).slice(0, 200).map((it) =>
        sanitizeForFirestore({
          itemName: capString(it.itemName || '', 300),
          quantity: Number(it.quantity) || 0,
          unitPrice: Number(it.unitPrice) || 0,
          amount: Number(it.amount) || 0,
          pageNumber: it.pageNumber,
        })
      );

      const safePdfPages = (receiptData.pdfPages ?? existing?.pdfPages)?.slice(0, 50);

      try {
        if (isUpdate && existing) {
          const updatePayload: Record<string, any> = sanitizeForFirestore({
            projectId: capString(receiptData.projectId ?? existing.projectId ?? '', 128),
            documentType: receiptData.documentType || existing.documentType || 'receipt',
            documentDate: capString(receiptData.documentDate || existing.documentDate || now.slice(0, 10), 20),
            receiptNumber: capString(receiptData.receiptNumber ?? existing.receiptNumber ?? '', 100),
            vendorName: capString(receiptData.vendorName ?? existing.vendorName ?? '', 200),
            vendorTaxId: capString(receiptData.vendorTaxId ?? existing.vendorTaxId ?? '', 40),
            vendorAddress: capString(receiptData.vendorAddress ?? existing.vendorAddress ?? '', 500),
            customerName: capString(receiptData.customerName ?? existing.customerName ?? '', 200),
            customerTaxId: capString(receiptData.customerTaxId ?? existing.customerTaxId ?? '', 40),
            customerAddress: capString(receiptData.customerAddress ?? existing.customerAddress ?? '', 500),
            categoryId: capString(receiptData.categoryId || existing.categoryId || 'cat-other', 128),
            subtotal: Number(receiptData.subtotal ?? existing.subtotal ?? 0) || 0,
            vatAmount: Number(receiptData.vatAmount ?? existing.vatAmount ?? 0) || 0,
            withholdingTax: Number(receiptData.withholdingTax ?? existing.withholdingTax ?? 0) || 0,
            discount: Number(receiptData.discount ?? existing.discount ?? 0) || 0,
            grandTotal: Math.max(0, Number(receiptData.grandTotal ?? existing.grandTotal ?? 0) || 0),
            paymentMethod: capString(receiptData.paymentMethod || existing.paymentMethod || 'เงินสด', 60),
            notes: capString(receiptData.notes ?? existing.notes ?? '', 1500),
            isConfidential: Boolean(receiptData.isConfidential ?? existing.isConfidential),
            items: itemsList,
            approvalStatus: receiptData.approvalStatus || existing.approvalStatus || 'pending',
            verificationStatus: receiptData.verificationStatus || existing.verificationStatus || 'verified',
            updatedAt: serverTimestamp(),
          });

          if (isAdmin) {
            updatePayload.currency = capString(receiptData.currency || existing.currency || 'THB', 10);
            updatePayload.ocrStatus = receiptData.ocrStatus || existing.ocrStatus || 'completed';
            updatePayload.receiptImageUrl = safeImageUrl;
            updatePayload.totalPages = Number(receiptData.totalPages ?? existing.totalPages ?? 1) || 1;
            if (safePdfPages) updatePayload.pdfPages = safePdfPages;
          }

          await updateDoc(doc(db, 'receipts', receiptId), updatePayload);
        } else {
          const createPayload = sanitizeForFirestore({
            receiptId,
            projectId: capString(receiptData.projectId ?? '', 128),
            uploadedBy: currentUser.uid,
            uploadedByEmail: capString(currentUser.email, 200),
            documentType: receiptData.documentType || 'receipt',
            documentDate: capString(receiptData.documentDate || now.slice(0, 10), 20),
            uploadDate: capString(receiptData.uploadDate || now.slice(0, 10), 20),
            receiptNumber: capString(receiptData.receiptNumber || '', 100),
            vendorName: capString(receiptData.vendorName || '', 200),
            vendorTaxId: capString(receiptData.vendorTaxId || '', 40),
            vendorAddress: capString(receiptData.vendorAddress || '', 500),
            customerName: capString(receiptData.customerName || '', 200),
            customerTaxId: capString(receiptData.customerTaxId || '', 40),
            customerAddress: capString(receiptData.customerAddress || '', 500),
            categoryId: capString(receiptData.categoryId || 'cat-other', 128),
            subtotal: Number(receiptData.subtotal ?? 0) || 0,
            vatAmount: Number(receiptData.vatAmount ?? 0) || 0,
            withholdingTax: Number(receiptData.withholdingTax ?? 0) || 0,
            discount: Number(receiptData.discount ?? 0) || 0,
            grandTotal: Math.max(0, Number(receiptData.grandTotal ?? 0) || 0),
            currency: capString(receiptData.currency || 'THB', 10),
            paymentMethod: capString(receiptData.paymentMethod || 'เงินสด', 60),
            receiptImagePath: capString(receiptData.receiptImagePath || '', 500),
            receiptImageUrl: safeImageUrl,
            imageHash: capString(receiptData.imageHash || '', 128),
            ocrStatus: receiptData.ocrStatus || 'completed',
            verificationStatus: receiptData.verificationStatus || 'verified',
            approvalStatus: isAdmin
              ? receiptData.approvalStatus || 'pending'
              : receiptData.approvalStatus === 'draft'
              ? 'draft'
              : 'pending',
            isConfidential: Boolean(receiptData.isConfidential),
            notes: capString(receiptData.notes || '', 1500),
            items: itemsList,
            totalPages: Number(receiptData.totalPages ?? 1) || 1,
            pdfPages: safePdfPages,
            isDeleted: false,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });

          await setDoc(doc(db, 'receipts', receiptId), createPayload);
        }
      } catch (error) {
        handleFirestoreError(error, isUpdate ? OperationType.UPDATE : OperationType.CREATE, path);
      }

      await appendAuditLog(
        isUpdate ? 'Update Receipt' : 'Create Receipt',
        'receipt',
        receiptId,
        `Receipt ${receiptData.receiptNumber || existing?.receiptNumber || 'No-Number'} for vendor ${
          receiptData.vendorName || existing?.vendorName || ''
        }, Total: ${receiptData.grandTotal ?? existing?.grandTotal ?? 0} THB`
      );
    });

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
    const path = `receipts/${receiptId}`;
    const now = new Date().toISOString();

    await runWithSaving('กำลังอัปเดตสถานะอนุมัติ...', async () => {
      const updateFields: Record<string, any> = {
        approvalStatus,
        approvedBy: capString(currentUser.email, 200),
        approvedAt: now,
        updatedAt: serverTimestamp(),
      };
      if (notes !== undefined) {
        updateFields.notes = capString(notes, 1500);
      }

      try {
        await updateDoc(doc(db, 'receipts', receiptId), updateFields);
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, path);
      }

      await appendAuditLog(
        `Receipt ${approvalStatus.toUpperCase()}`,
        'receipt',
        receiptId,
        `Master Admin ${currentUser.email} set status to ${approvalStatus}${notes ? ` (Note: ${notes})` : ''}`
      );
    });
  };

  const softDeleteReceipt = async (receiptId: string) => {
    if (!currentUser) throw new Error('Unauthorized');
    const target = receipts.find((r) => r.receiptId === receiptId);
    const canDelete = isAdmin || (target && target.uploadedBy === currentUser.uid);
    if (!canDelete) throw new Error('เฉพาะ Master Admin หรือผู้บันทึกเท่านั้นที่สามารถลบใบเสร็จได้');
    const path = `receipts/${receiptId}`;

    await runWithSaving('กำลังลบใบเสร็จ...', async () => {
      try {
        await deleteDoc(doc(db, 'receipts', receiptId));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, path);
      }
      await appendAuditLog('Delete Receipt', 'receipt', receiptId, `Deleted by ${currentUser.email}`);
    });
  };

  const batchDeleteReceipts = async (receiptIds: string[]): Promise<void> => {
    if (!currentUser) throw new Error('Unauthorized');
    if (!receiptIds || receiptIds.length === 0) return;

    await runWithSaving(`กำลังลบใบเสร็จ ${receiptIds.length} รายการ...`, async () => {
      try {
        const batch = writeBatch(db);
        receiptIds.forEach((id) => {
          batch.delete(doc(db, 'receipts', id));
        });
        await batch.commit();
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, 'receipts/batch');
      }

      await appendAuditLog(
        'Batch Delete Receipts',
        'receipt',
        'batch',
        `Deleted ${receiptIds.length} receipts by ${currentUser.email}`
      );
    });
  };

  const batchApproveReceipts = async (receiptIds: string[], notes?: string): Promise<void> => {
    if (!currentUser || !isAdmin) throw new Error('Unauthorized');
    if (!receiptIds || receiptIds.length === 0) return;

    const now = new Date().toISOString();
    const approver = currentUser.email || 'Master Admin';

    await runWithSaving(`กำลังอนุมัติใบเสร็จ ${receiptIds.length} รายการ...`, async () => {
      try {
        const batch = writeBatch(db);
        receiptIds.forEach((id) => {
          const existing = receipts.find((r) => r.receiptId === id);
          const mergedNote = notes?.trim()
            ? existing?.notes
              ? `${existing.notes}\n[อนุมัติ]: ${notes.trim()}`
              : notes.trim()
            : existing?.notes;

          const patch: Record<string, any> = {
            approvalStatus: 'approved',
            approvedBy: capString(approver, 200),
            approvedAt: now,
            updatedAt: serverTimestamp(),
          };
          if (mergedNote !== undefined) {
            patch.notes = capString(mergedNote, 1500);
          }
          batch.update(doc(db, 'receipts', id), patch);
        });
        await batch.commit();
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, 'receipts/batch');
      }

      await appendAuditLog(
        'Batch Approve Receipts',
        'receipt',
        'batch',
        `Approved ${receiptIds.length} receipts by ${approver}${notes ? ` (Note: ${notes})` : ''}`
      );
    });
  };

  // ==================== USER MANAGEMENT ====================
  const addUser = async (userData: {
    displayName: string;
    email: string;
    position?: string;
    department?: string;
    phone?: string;
    role: AppUser['role'];
    status: AppUser['status'];
    assignedProjectIds: string[];
  }): Promise<string> => {
    if (!currentUser || !isAdmin) {
      throw new Error('เฉพาะ Master Admin เท่านั้นที่สามารถเพิ่มผู้ใช้งานได้');
    }

    const cleanEmail = userData.email.trim().toLowerCase();
    if (!cleanEmail) throw new Error('กรุณากรอกอีเมล');

    const existingActiveUser = userDocs.find((u) => u.email.toLowerCase() === cleanEmail);

    return runWithSaving('กำลังบันทึกข้อมูลผู้ใช้งาน...', async () => {
      if (existingActiveUser) {
        const path = `users/${existingActiveUser.uid}`;
        try {
          await updateDoc(
            doc(db, 'users', existingActiveUser.uid),
            sanitizeForFirestore({
              displayName: capString(userData.displayName.trim() || cleanEmail.split('@')[0], 120),
              position: capString(userData.position?.trim() || '', 120),
              department: capString(userData.department?.trim() || '', 120),
              phone: capString(userData.phone?.trim() || '', 40),
              role: userData.role,
              status: userData.status,
              assignedProjectIds: (userData.assignedProjectIds || []).slice(0, 100),
              updatedAt: serverTimestamp(),
            })
          );
        } catch (error) {
          handleFirestoreError(error, OperationType.UPDATE, path);
        }

        await appendAuditLog(
          'Update Existing User Permissions',
          'user',
          existingActiveUser.uid,
          `Updated ${cleanEmail} as ${userData.role} [${userData.status}]`
        );
        return existingActiveUser.uid;
      }

      const inviteId = getInviteDocId(cleanEmail);
      const path = `userInvites/${inviteId}`;
      const existingInvite = inviteDocs.find((i) => i.uid === inviteId);

      try {
        if (existingInvite) {
          await updateDoc(
            doc(db, 'userInvites', inviteId),
            sanitizeForFirestore({
              displayName: capString(userData.displayName.trim() || cleanEmail.split('@')[0], 120),
              email: capString(cleanEmail, 200),
              position: capString(userData.position?.trim() || '', 120),
              department: capString(userData.department?.trim() || '', 120),
              phone: capString(userData.phone?.trim() || '', 40),
              role: userData.role,
              status: userData.status,
              assignedProjectIds: (userData.assignedProjectIds || []).slice(0, 100),
              updatedAt: serverTimestamp(),
            })
          );
        } else {
          await setDoc(
            doc(db, 'userInvites', inviteId),
            sanitizeForFirestore({
              inviteId,
              displayName: capString(userData.displayName.trim() || cleanEmail.split('@')[0], 120),
              email: capString(cleanEmail, 200),
              position: capString(userData.position?.trim() || '', 120),
              department: capString(userData.department?.trim() || '', 120),
              phone: capString(userData.phone?.trim() || '', 40),
              role: userData.role,
              status: userData.status,
              assignedProjectIds: (userData.assignedProjectIds || []).slice(0, 100),
              createdBy: currentUser.uid,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            })
          );
        }
      } catch (error) {
        handleFirestoreError(
          error,
          existingInvite ? OperationType.UPDATE : OperationType.CREATE,
          path
        );
      }

      await appendAuditLog(
        'Add User / Pre-assign Account',
        'user',
        inviteId,
        `Master Admin added user invite: ${userData.displayName} (${cleanEmail}) as ${userData.role} [${userData.status}]`
      );

      return inviteId;
    });
  };

  const updateUser = async (
    uid: string,
    updates: {
      displayName: string;
      email: string;
      position?: string;
      department?: string;
      phone?: string;
      role: AppUser['role'];
      status: AppUser['status'];
      assignedProjectIds: string[];
    }
  ): Promise<void> => {
    if (!currentUser || !isAdmin) {
      throw new Error('เฉพาะ Master Admin เท่านั้นที่สามารถแก้ไขข้อมูลผู้ใช้งานได้');
    }

    const cleanName = updates.displayName.trim();
    const cleanEmail = updates.email.trim().toLowerCase();

    if (!cleanName) throw new Error('กรุณากรอกชื่อผู้ใช้งาน');
    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      throw new Error('กรุณากรอกรูปแบบอีเมลให้ถูกต้อง');
    }

    const duplicate = users.find(
      (u) => u.uid !== uid && u.email.trim().toLowerCase() === cleanEmail
    );
    if (duplicate) {
      throw new Error(`อีเมล "${cleanEmail}" ถูกใช้งานโดยบัญชี "${duplicate.displayName}" แล้ว`);
    }

    const isInvite = uid.startsWith('invite_');
    const collectionName = isInvite ? 'userInvites' : 'users';
    const path = `${collectionName}/${uid}`;

    await runWithSaving('กำลังบันทึกข้อมูลผู้ใช้งาน...', async () => {
      try {
        await updateDoc(
          doc(db, collectionName, uid),
          sanitizeForFirestore({
            displayName: capString(cleanName, 120),
            email: capString(cleanEmail, 200),
            position: capString(updates.position?.trim() || '', 120),
            department: capString(updates.department?.trim() || '', 120),
            phone: capString(updates.phone?.trim() || '', 40),
            role: updates.role,
            status: updates.status,
            assignedProjectIds: (updates.assignedProjectIds || []).slice(0, 100),
            updatedAt: serverTimestamp(),
          })
        );
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, path);
      }

      if (currentUser.uid === uid) {
        updateCurrentUserProfile({
          displayName: cleanName,
          email: cleanEmail,
          position: updates.position?.trim() || '',
          department: updates.department?.trim() || '',
          phone: updates.phone?.trim() || '',
          role: updates.role,
          status: updates.status,
          assignedProjectIds: updates.assignedProjectIds,
        });
      }

      await appendAuditLog(
        'Update User Profile & Permissions',
        'user',
        uid,
        `Updated ${cleanName} (${cleanEmail}), Role: ${updates.role}, Status: ${updates.status}, Projects: ${updates.assignedProjectIds.length}`
      );
    });
  };

  const updateUserRoleAndStatus = async (
    uid: string,
    role: AppUser['role'],
    status: AppUser['status'],
    assignedProjectIds: string[]
  ) => {
    if (!currentUser || !isAdmin) throw new Error('Admin only');
    const isInvite = uid.startsWith('invite_');
    const collectionName = isInvite ? 'userInvites' : 'users';
    const path = `${collectionName}/${uid}`;

    await runWithSaving('กำลังอัปเดตสิทธิ์ผู้ใช้งาน...', async () => {
      try {
        await updateDoc(doc(db, collectionName, uid), {
          role,
          status,
          assignedProjectIds: assignedProjectIds.slice(0, 100),
          updatedAt: serverTimestamp(),
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, path);
      }

      if (currentUser.uid === uid) {
        updateCurrentUserProfile({ role, status, assignedProjectIds });
      }

      await appendAuditLog(
        'Update User Permissions',
        'user',
        uid,
        `Role: ${role}, Status: ${status}, Projects: ${assignedProjectIds.join(', ')}`
      );
    });
  };

  const deleteUser = async (uid: string): Promise<void> => {
    if (!currentUser || !isAdmin) {
      throw new Error('เฉพาะ Master Admin เท่านั้นที่สามารถลบผู้ใช้งานได้');
    }
    if (uid === currentUser.uid) {
      throw new Error('ไม่สามารถลบบัญชีของตนเองที่กำลังเข้าสู่ระบบอยู่ได้');
    }

    const targetUser = users.find((u) => u.uid === uid);
    const isInvite = uid.startsWith('invite_');
    const collectionName = isInvite ? 'userInvites' : 'users';
    const path = `${collectionName}/${uid}`;

    await runWithSaving('กำลังลบผู้ใช้งาน...', async () => {
      try {
        await deleteDoc(doc(db, collectionName, uid));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, path);
      }

      await appendAuditLog(
        'Delete User',
        'user',
        uid,
        `Master Admin (${currentUser.email}) deleted user: ${targetUser?.displayName || uid} (${targetUser?.email || ''})`
      );
    });
  };

  // ==================== CATEGORY MANAGEMENT ====================
  const saveCategory = async (
    categoryName: string,
    id?: string,
    parentId?: string | null,
    level?: 'main' | 'sub'
  ) => {
    if (!currentUser || !isAdmin) throw new Error('Admin only');
    const isUpdate = Boolean(id && categoriesMap[id]);
    const catId = id || 'cat-' + Date.now();
    const path = `categories/${catId}`;
    const parentCategory = parentId ? categories.find((c) => c.categoryId === parentId) : null;
    const computedLevel = level || (parentId ? 'sub' : 'main');

    await runWithSaving(isUpdate ? 'กำลังบันทึกหมวดหมู่...' : 'กำลังเพิ่มหมวดหมู่...', async () => {
      try {
        if (isUpdate) {
          await updateDoc(
            doc(db, 'categories', catId),
            sanitizeForFirestore({
              categoryName: capString(categoryName, 120),
              level: computedLevel,
              parentId: parentId || null,
              parentName: parentCategory ? capString(parentCategory.categoryName, 120) : null,
              updatedAt: serverTimestamp(),
            })
          );
        } else {
          await setDoc(
            doc(db, 'categories', catId),
            sanitizeForFirestore({
              categoryId: catId,
              categoryName: capString(categoryName, 120),
              level: computedLevel,
              parentId: parentId || null,
              parentName: parentCategory ? capString(parentCategory.categoryName, 120) : null,
              isActive: true,
              createdBy: currentUser.uid,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            })
          );
        }
      } catch (error) {
        handleFirestoreError(error, isUpdate ? OperationType.UPDATE : OperationType.CREATE, path);
      }

      await appendAuditLog(
        'Save Expense Category',
        'category',
        catId,
        `Category: ${categoryName} (${computedLevel})`
      );
    });
  };

  const deleteCategory = async (categoryId: string) => {
    if (!currentUser || !isAdmin) throw new Error('Admin only');
    const targetCat = categories.find((c) => c.categoryId === categoryId);
    const subCategories = categories.filter((c) => c.parentId === categoryId);
    const idsToDelete = [categoryId, ...subCategories.map((s) => s.categoryId)];
    const path = `categories/${categoryId}`;

    await runWithSaving('กำลังลบหมวดหมู่...', async () => {
      try {
        const batch = writeBatch(db);
        idsToDelete.forEach((cid) => {
          batch.delete(doc(db, 'categories', cid));
        });
        await batch.commit();
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, path);
      }

      await appendAuditLog(
        'Delete Expense Category',
        'category',
        categoryId,
        `Category ID: ${categoryId} (${targetCat?.categoryName || ''}) and ${subCategories.length} subcategories`
      );
    });
  };

  const toggleCategoryStatus = async (categoryId: string, isActive: boolean) => {
    if (!currentUser || !isAdmin) throw new Error('Admin only');
    const path = `categories/${categoryId}`;

    await runWithSaving('กำลังอัปเดตสถานะหมวดหมู่...', async () => {
      try {
        await updateDoc(doc(db, 'categories', categoryId), {
          isActive,
          updatedAt: serverTimestamp(),
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, path);
      }

      await appendAuditLog('Toggle Category Status', 'category', categoryId, `Active: ${isActive}`);
    });
  };

  // ==================== BANK ACCOUNT OPERATIONS ====================
  const saveBankAccount = async (accountData: Partial<BankAccount>): Promise<string> => {
    if (!currentUser) throw new Error('Unauthorized');
    const now = new Date().toISOString();
    const existing = accountData.id
      ? bankAccounts.find((b) => b.id === accountData.id)
      : undefined;
    const isUpdate = Boolean(existing);
    const accountId =
      accountData.id || 'acc_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
    const path = `bankAccounts/${accountId}`;

    await runWithSaving(isUpdate ? 'กำลังอัปเดตบัญชีธนาคาร...' : 'กำลังบันทึกบัญชีธนาคาร...', async () => {
      try {
        if (isUpdate && existing) {
          await updateDoc(
            doc(db, 'bankAccounts', accountId),
            sanitizeForFirestore({
              accountNumber: capString(accountData.accountNumber ?? existing.accountNumber, 60),
              bankName: capString(accountData.bankName ?? existing.bankName, 120),
              bankCode: capString(accountData.bankCode ?? existing.bankCode ?? 'KBANK', 20),
              accountName: capString(accountData.accountName ?? existing.accountName, 200),
              branchName: capString(accountData.branchName ?? existing.branchName ?? '', 120),
              assetType: accountData.assetType || existing.assetType || 'savings',
              currentBalance: Number(accountData.currentBalance ?? existing.currentBalance) || 0,
              availableBalance:
                accountData.availableBalance !== undefined
                  ? Number(accountData.availableBalance) || 0
                  : Number(accountData.currentBalance ?? existing.currentBalance) || 0,
              currency: capString(accountData.currency || existing.currency || 'THB', 10),
              projectId: capString(accountData.projectId ?? existing.projectId ?? '', 128),
              projectName: capString(accountData.projectName ?? existing.projectName ?? '', 200),
              lastUpdatedDate: capString(accountData.lastUpdatedDate || now.slice(0, 10), 30),
              notes: capString(accountData.notes ?? existing.notes ?? '', 1000),
              statementCount: Number(accountData.statementCount ?? existing.statementCount ?? 0) || 0,
              updatedAt: serverTimestamp(),
            })
          );
        } else {
          await setDoc(
            doc(db, 'bankAccounts', accountId),
            sanitizeForFirestore({
              id: accountId,
              accountNumber: capString(accountData.accountNumber || '', 60),
              bankName: capString(accountData.bankName || 'ธนาคารกสิกรไทย', 120),
              bankCode: capString(accountData.bankCode || 'KBANK', 20),
              accountName: capString(accountData.accountName || 'บัญชีเงินฝากดำเนินงาน', 200),
              branchName: capString(accountData.branchName || '', 120),
              assetType: accountData.assetType || 'savings',
              currentBalance: Number(accountData.currentBalance) || 0,
              availableBalance:
                accountData.availableBalance !== undefined
                  ? Number(accountData.availableBalance) || 0
                  : Number(accountData.currentBalance) || 0,
              currency: capString(accountData.currency || 'THB', 10),
              projectId: capString(accountData.projectId || '', 128),
              projectName: capString(accountData.projectName || '', 200),
              lastUpdatedDate: capString(accountData.lastUpdatedDate || now.slice(0, 10), 30),
              notes: capString(accountData.notes || '', 1000),
              statementCount: Number(accountData.statementCount || 0) || 0,
              createdBy: currentUser.uid,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            })
          );
        }
      } catch (error) {
        handleFirestoreError(error, isUpdate ? OperationType.UPDATE : OperationType.CREATE, path);
      }

      await appendAuditLog(
        isUpdate ? 'Update Bank Account' : 'Create Bank Account',
        'bankAccount',
        accountId,
        `Saved bank account ${accountData.bankName || ''} (${accountData.accountNumber || ''})`
      );
    });

    return accountId;
  };

  const deleteBankAccount = async (accountId: string): Promise<void> => {
    if (!currentUser) throw new Error('Unauthorized');
    const path = `bankAccounts/${accountId}`;

    await runWithSaving('กำลังลบบัญชีธนาคาร...', async () => {
      try {
        await deleteDoc(doc(db, 'bankAccounts', accountId));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, path);
      }
      await appendAuditLog('Delete Bank Account', 'bankAccount', accountId, `Deleted bank account ${accountId}`);
    });
  };

  // ==================== STATEMENT OPERATIONS ====================
  const saveStatementRecord = async (
    statementData: Partial<StatementRecord>,
    updateBalance: boolean = true
  ): Promise<string> => {
    if (!currentUser) throw new Error('Unauthorized');
    const existingStmt = statementData.id
      ? statementRecords.find((s) => s.id === statementData.id)
      : undefined;
    const isUpdate = Boolean(existingStmt);
    const statementId =
      statementData.id || 'stmt_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
    const now = new Date().toISOString();
    const path = `statements/${statementId}`;

    const normalizedTxs = normalizeStatementTransactionsList(
      statementData.transactions || [],
      Number(statementData.openingBalance) || 0
    )
      .slice(0, 500)
      .map((t) =>
        sanitizeForFirestore({
          ...t,
          date: normalizeDateISO(t.date) || t.date || '',
          debitAmount: Number(t.debitAmount) || 0,
          creditAmount: Number(t.creditAmount) || 0,
          balance: Number(t.balance) || 0,
          projectId: t.projectId || statementData.projectId || '',
          projectName: t.projectName || statementData.projectName || '',
        })
      );

    const totalDebit =
      Number(statementData.totalDebit) ||
      Math.round(normalizedTxs.reduce((s, tx) => s + (tx.debitAmount || 0), 0) * 100) / 100;
    const totalCredit =
      Number(statementData.totalCredit) ||
      Math.round(normalizedTxs.reduce((s, tx) => s + (tx.creditAmount || 0), 0) * 100) / 100;

    await runWithSaving('กำลังบันทึก Statement เข้าฐานข้อมูล...', async () => {
      try {
        if (isUpdate) {
          await updateDoc(
            doc(db, 'statements', statementId),
            sanitizeForFirestore({
              accountId: capString(statementData.accountId || existingStmt?.accountId || '', 128),
              accountNumber: capString(
                statementData.accountNumber ?? existingStmt?.accountNumber ?? '',
                60
              ),
              bankName: capString(
                statementData.bankName || existingStmt?.bankName || 'ธนาคารทั่วไป',
                120
              ),
              accountName: capString(statementData.accountName ?? existingStmt?.accountName ?? '', 200),
              projectId: capString(statementData.projectId ?? existingStmt?.projectId ?? '', 128),
              projectName: capString(statementData.projectName ?? existingStmt?.projectName ?? '', 200),
              statementPeriodStart: capString(
                normalizeDateISO(statementData.statementPeriodStart) ||
                  existingStmt?.statementPeriodStart ||
                  '',
                30
              ),
              statementPeriodEnd: capString(
                normalizeDateISO(statementData.statementPeriodEnd) ||
                  existingStmt?.statementPeriodEnd ||
                  '',
                30
              ),
              openingBalance: Number(statementData.openingBalance ?? existingStmt?.openingBalance) || 0,
              closingBalance: Number(statementData.closingBalance ?? existingStmt?.closingBalance) || 0,
              totalDebit,
              totalCredit,
              transactions: normalizedTxs,
              fileName: capString(statementData.fileName ?? existingStmt?.fileName ?? '', 255),
              rawOcrSummary: capString(
                statementData.rawOcrSummary ?? existingStmt?.rawOcrSummary ?? '',
                5000
              ),
              notes: capString(statementData.notes ?? existingStmt?.notes ?? '', 1000),
              updatedAt: serverTimestamp(),
            })
          );
        } else {
          await setDoc(
            doc(db, 'statements', statementId),
            sanitizeForFirestore({
              id: statementId,
              accountId: capString(statementData.accountId || '', 128),
              accountNumber: capString(statementData.accountNumber || '', 60),
              bankName: capString(statementData.bankName || 'ธนาคารทั่วไป', 120),
              accountName: capString(statementData.accountName || '', 200),
              projectId: capString(statementData.projectId || '', 128),
              projectName: capString(statementData.projectName || '', 200),
              statementPeriodStart: capString(normalizeDateISO(statementData.statementPeriodStart) || '', 30),
              statementPeriodEnd: capString(normalizeDateISO(statementData.statementPeriodEnd) || '', 30),
              openingBalance: Number(statementData.openingBalance) || 0,
              closingBalance: Number(statementData.closingBalance) || 0,
              totalDebit,
              totalCredit,
              transactions: normalizedTxs,
              fileName: capString(statementData.fileName || '', 255),
              uploadedAt: capString(statementData.uploadedAt || now, 64),
              uploadedBy: currentUser.uid,
              uploadedByEmail: capString(currentUser.email, 200),
              rawOcrSummary: capString(statementData.rawOcrSummary || '', 5000),
              notes: capString(statementData.notes || '', 1000),
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            })
          );
        }

        if (updateBalance && (statementData.accountId || statementData.accountNumber)) {
          const accId =
            statementData.accountId ||
            'acc_' + (statementData.accountNumber || '').replace(/[^0-9]/g, '');
          const matchedAcc = bankAccounts.find(
            (b) =>
              b.id === accId ||
              (b.accountNumber &&
                statementData.accountNumber &&
                b.accountNumber === statementData.accountNumber)
          );

          if (matchedAcc) {
            await updateDoc(
              doc(db, 'bankAccounts', matchedAcc.id),
              sanitizeForFirestore({
                currentBalance: Number(statementData.closingBalance) || 0,
                availableBalance: Number(statementData.closingBalance) || 0,
                lastUpdatedDate: capString(
                  normalizeDateISO(statementData.statementPeriodEnd) || now.slice(0, 10),
                  30
                ),
                statementCount: (matchedAcc.statementCount || 0) + (isUpdate ? 0 : 1),
                updatedAt: serverTimestamp(),
              })
            );
          } else if (accId) {
            await setDoc(
              doc(db, 'bankAccounts', accId),
              sanitizeForFirestore({
                id: accId,
                accountNumber: capString(statementData.accountNumber || '000-0-00000-0', 60),
                bankName: capString(statementData.bankName || 'ธนาคารทั่วไป', 120),
                bankCode: 'KBANK',
                accountName: capString(
                  statementData.accountName || `บัญชี ${statementData.bankName || ''}`,
                  200
                ),
                assetType: 'savings',
                currentBalance: Number(statementData.closingBalance) || 0,
                availableBalance: Number(statementData.closingBalance) || 0,
                currency: 'THB',
                projectId: capString(statementData.projectId || '', 128),
                projectName: capString(statementData.projectName || '', 200),
                lastUpdatedDate: capString(
                  normalizeDateISO(statementData.statementPeriodEnd) || now.slice(0, 10),
                  30
                ),
                statementCount: 1,
                createdBy: currentUser.uid,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
              })
            );
          }
        }
      } catch (error) {
        handleFirestoreError(error, isUpdate ? OperationType.UPDATE : OperationType.CREATE, path);
      }

      await appendAuditLog(
        'Upload Bank Statement',
        'statement',
        statementId,
        `Imported statement for ${statementData.bankName || ''} (${statementData.accountNumber || ''}) with ${
          normalizedTxs.length
        } transactions`
      );
    });

    return statementId;
  };

  const deleteStatementRecord = async (statementId: string): Promise<void> => {
    if (!currentUser) throw new Error('Unauthorized');
    const path = `statements/${statementId}`;

    await runWithSaving('กำลังลบ Statement...', async () => {
      try {
        await deleteDoc(doc(db, 'statements', statementId));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, path);
      }
      await appendAuditLog(
        'Delete Statement Record',
        'statement',
        statementId,
        `Deleted statement record ${statementId}`
      );
    });
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
        isSavingData: pendingWrites > 0,
        savingLabel,
        isOfflineQuotaMode,
        filters,
        setFilters,
        resetFilters,
        seedSampleDataToFirebase,
        saveProject,
        updateProjectStatus,
        deleteProject,
        saveReceipt,
        updateReceiptStatus,
        softDeleteReceipt,
        batchDeleteReceipts,
        batchApproveReceipts,
        addUser,
        updateUser,
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
