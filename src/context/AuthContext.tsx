import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  User as FirebaseUser,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  sendEmailVerification,
  updateProfile,
  signOut as firebaseSignOut,
} from 'firebase/auth';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore';
import {
  auth,
  db,
  googleProvider,
  OperationType,
  handleFirestoreError,
  normalizeTimestamp,
  sanitizeForFirestore,
} from '../firebase';
import { AppUser } from '../types';
import { isMasterAdminEmail } from '../services/dbService';

export interface AuthErrorInfo {
  code: string;
  title: string;
  detail: string;
  solution: string;
  actionType?: 'copy_domain' | 'redirect_signin' | 'allow_popup' | 'check_network';
}

interface AuthContextType {
  currentUser: AppUser | null;
  firebaseUser: FirebaseUser | null;
  authReady: boolean;
  needsEmailVerification: boolean;
  isAdmin: boolean;
  isApproved: boolean;
  loading: boolean;
  isSigningIn: boolean;
  authError: AuthErrorInfo | null;
  signInWithGoogle: () => Promise<void>;
  signInWithGoogleRedirect: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  registerWithEmail: (email: string, password: string, displayName?: string) => Promise<void>;
  resetPasswordWithEmail: (email: string) => Promise<void>;
  resendVerificationEmail: () => Promise<void>;
  recheckEmailVerification: () => Promise<boolean>;
  signInAsMasterAdmin: () => void;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
  clearAuthError: () => void;
  updateCurrentUserProfile: (patch: Partial<AppUser>) => void;
}

const AuthContext = createContext<AuthContextType>({
  currentUser: null,
  firebaseUser: null,
  authReady: false,
  needsEmailVerification: false,
  isAdmin: false,
  isApproved: false,
  loading: true,
  isSigningIn: false,
  authError: null,
  signInWithGoogle: async () => {},
  signInWithGoogleRedirect: async () => {},
  signInWithEmail: async () => {},
  registerWithEmail: async () => {},
  resetPasswordWithEmail: async () => {},
  resendVerificationEmail: async () => {},
  recheckEmailVerification: async () => false,
  signInAsMasterAdmin: () => {},
  signOut: async () => {},
  refreshUser: async () => {},
  clearAuthError: () => {},
  updateCurrentUserProfile: () => {},
});

export const useAuth = () => useContext(AuthContext);

export function getInviteDocId(email: string): string {
  return 'invite_' + email.trim().toLowerCase().replace(/[^a-zA-Z0-9]/g, '_');
}

function mapFirebaseAuthError(error: any): AuthErrorInfo {
  const code = error?.code || 'auth/unknown';
  const rawMessage = error?.message || String(error);

  if (code === 'auth/unauthorized-domain') {
    const host = typeof window !== 'undefined' ? window.location.hostname : '';
    return {
      code,
      title: 'โดเมนนี้ยังไม่ได้รับอนุญาตใน Firebase Authentication',
      detail: `กรุณาเพิ่มโดเมน "${host}" ใน Firebase Console > Authentication > Settings > Authorized domains`,
      solution: 'คัดลอกชื่อโดเมนด้านล่างไปเพิ่มใน Firebase Console แล้วลองเข้าสู่ระบบอีกครั้ง',
      actionType: 'copy_domain',
    };
  }
  if (code === 'auth/popup-blocked') {
    return {
      code,
      title: 'เบราว์เซอร์บล็อกหน้าต่าง Popup เข้าสู่ระบบ',
      detail: 'เบราว์เซอร์ของคุณปิดกั้นการเปิดหน้าต่างล็อกอิน Google แบบ Popup',
      solution: 'กรุณาอนุญาต Popup สำหรับเว็บไซต์นี้ หรือใช้ปุ่มลองเข้าสู่ระบบแบบ Redirect',
      actionType: 'redirect_signin',
    };
  }
  if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
    return {
      code,
      title: 'ยกเลิกการเข้าสู่ระบบก่อนเสร็จสมบูรณ์',
      detail: 'หน้าต่างเข้าสู่ระบบ Google ถูกปิดลงก่อนการยืนยันตัวตนเสร็จสิ้น',
      solution: 'คลิกปุ่มเข้าสู่ระบบด้วย Google อีกครั้งและเลือกบัญชีที่ต้องการใช้งาน',
      actionType: 'allow_popup',
    };
  }
  if (code === 'auth/network-request-failed') {
    return {
      code,
      title: 'ไม่สามารถเชื่อมต่อเครือข่าย Firebase Auth ได้',
      detail: 'เกิดข้อผิดพลาดระหว่างติดต่อเซิร์ฟเวอร์ Google / Firebase Authentication',
      solution: 'กรุณาตรวจสอบการเชื่อมต่ออินเทอร์เน็ตแล้วลองใหม่อีกครั้ง',
      actionType: 'check_network',
    };
  }
  if (code === 'auth/operation-not-allowed') {
    return {
      code,
      title: 'ยังไม่ได้เปิดใช้งานระบบ Email/Password ใน Firebase Console',
      detail: 'ผู้ดูแลโปรเจกต์ต้องเปิดใช้งาน Sign-in provider แบบ "Email/Password" ใน Firebase Authentication ก่อน',
      solution: 'เข้าไปที่ Firebase Console > Authentication > Sign-in method > Add new provider > เลือก Email/Password และกด Enable',
      actionType: 'check_network',
    };
  }
  if (
    code === 'auth/invalid-credential' ||
    code === 'auth/wrong-password' ||
    code === 'auth/user-not-found'
  ) {
    return {
      code,
      title: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง',
      detail: 'ไม่พบบัญชีผู้ใช้นี้หรือรหัสผ่านไม่ตรงกับข้อมูลในระบบ Firebase Authentication',
      solution: 'กรุณาตรวจสอบอีเมลและรหัสผ่าน หรือกด "สมัครสมาชิกใหม่" / "ลืมรหัสผ่าน"',
      actionType: 'check_network',
    };
  }
  if (code === 'auth/invalid-email') {
    return {
      code,
      title: 'รูปแบบอีเมลไม่ถูกต้อง',
      detail: 'กรุณากรอกที่อยู่อีเมลให้ครบถ้วนและถูกต้อง (เช่น name@company.com)',
      solution: 'ตรวจสอบตัวสะกดอีเมลแล้วลองใหม่อีกครั้ง',
      actionType: 'check_network',
    };
  }
  if (code === 'auth/email-already-in-use') {
    return {
      code,
      title: 'อีเมลนี้ถูกลงทะเบียนไว้แล้ว',
      detail: 'มีบัญชีผู้ใช้งานอีเมลนี้อยู่ในระบบแล้ว',
      solution: 'กรุณาสลับไปแถบ "เข้าสู่ระบบด้วยอีเมล" หรือเข้าสู่ระบบด้วย Google Account',
      actionType: 'check_network',
    };
  }
  if (code === 'auth/weak-password') {
    return {
      code,
      title: 'รหัสผ่านสั้นเกินไป',
      detail: 'รหัสผ่านต้องมีความยาวอย่างน้อย 6 ตัวอักษร',
      solution: 'ตั้งรหัสผ่านที่มีตัวอักษรหรือตัวเลขอย่างน้อย 6 ตัวขึ้นไป',
      actionType: 'check_network',
    };
  }
  if (code === 'auth/too-many-requests') {
    return {
      code,
      title: 'พยายามเข้าสู่ระบบบ่อยเกินไปชั่วคราว',
      detail: 'ระบบระงับการลองเข้าสู่ระบบชั่วคราวเพื่อความปลอดภัย',
      solution: 'กรุณารอสักครู่แล้วลองใหม่ หรือกดรีเซ็ตรหัสผ่าน',
      actionType: 'check_network',
    };
  }
  return {
    code,
    title: 'เข้าสู่ระบบไม่สำเร็จ',
    detail: rawMessage,
    solution: 'กรุณาตรวจสอบข้อมูลและลองเข้าสู่ระบบอีกครั้ง',
    actionType: 'allow_popup',
  };
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [authReady, setAuthReady] = useState<boolean>(false);
  const [needsEmailVerification, setNeedsEmailVerification] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [isSigningIn, setIsSigningIn] = useState<boolean>(false);
  const [authError, setAuthError] = useState<AuthErrorInfo | null>(null);

  const syncUserProfile = useCallback(async (fbUser: FirebaseUser): Promise<AppUser> => {
    const cleanEmail = (fbUser.email || '').trim().toLowerCase();
    const userPath = `users/${fbUser.uid}`;
    const userRef = doc(db, 'users', fbUser.uid);
    const nowIso = new Date().toISOString();

    let userSnap;
    try {
      userSnap = await getDoc(userRef);
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, userPath);
    }

    if (userSnap.exists()) {
      const data = userSnap.data() as Record<string, any>;
      const isMaster = isMasterAdminEmail(cleanEmail);
      const effectiveRole: AppUser['role'] = isMaster ? 'admin' : data.role || 'user';
      const effectiveStatus: AppUser['status'] = isMaster ? 'active' : data.status || 'pending';

      const patch: Record<string, any> = {
        lastLoginAt: nowIso,
        updatedAt: serverTimestamp(),
      };
      if (isMaster && (data.role !== 'admin' || data.status !== 'active')) {
        patch.role = 'admin';
        patch.status = 'active';
      }

      try {
        await updateDoc(userRef, patch);
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, userPath);
      }

      return {
        uid: fbUser.uid,
        displayName: data.displayName || fbUser.displayName || cleanEmail.split('@')[0] || 'User',
        email: (data.email || cleanEmail).toLowerCase(),
        position: data.position || '',
        department: data.department || '',
        phone: data.phone || '',
        role: effectiveRole,
        status: effectiveStatus,
        assignedProjectIds: Array.isArray(data.assignedProjectIds) ? data.assignedProjectIds : [],
        createdAt: normalizeTimestamp(data.createdAt, nowIso),
        lastLoginAt: nowIso,
      };
    }

    // First-time sign-in: check if Master Admin created a pre-assigned invite
    const isMaster = isMasterAdminEmail(cleanEmail);
    let inviteData: Record<string, any> | null = null;
    if (!isMaster && cleanEmail) {
      const inviteId = getInviteDocId(cleanEmail);
      const invitePath = `userInvites/${inviteId}`;
      try {
        const inviteSnap = await getDoc(doc(db, 'userInvites', inviteId));
        if (inviteSnap.exists()) {
          inviteData = inviteSnap.data() as Record<string, any>;
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, invitePath);
      }
    }

    const newProfilePayload = sanitizeForFirestore({
      uid: fbUser.uid,
      displayName:
        inviteData?.displayName || fbUser.displayName || cleanEmail.split('@')[0] || 'User',
      email: cleanEmail,
      position: inviteData?.position || '',
      department: inviteData?.department || '',
      phone: inviteData?.phone || '',
      role: isMaster ? 'admin' : inviteData?.role || 'user',
      status: isMaster ? 'active' : inviteData?.status || 'pending',
      assignedProjectIds: isMaster
        ? []
        : Array.isArray(inviteData?.assignedProjectIds)
        ? inviteData!.assignedProjectIds
        : [],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      lastLoginAt: nowIso,
    });

    try {
      await setDoc(userRef, newProfilePayload);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, userPath);
    }

    return {
      uid: fbUser.uid,
      displayName: newProfilePayload.displayName,
      email: newProfilePayload.email,
      position: newProfilePayload.position,
      department: newProfilePayload.department,
      phone: newProfilePayload.phone,
      role: newProfilePayload.role,
      status: newProfilePayload.status,
      assignedProjectIds: newProfilePayload.assignedProjectIds,
      createdAt: nowIso,
      lastLoginAt: nowIso,
    };
  }, []);

  useEffect(() => {
    getRedirectResult(auth).catch((err) => {
      if (err) {
        setAuthError(mapFirebaseAuthError(err));
      }
    });

    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      setFirebaseUser(fbUser);
      if (!fbUser) {
        setCurrentUser(null);
        setNeedsEmailVerification(false);
        setAuthReady(true);
        setLoading(false);
        return;
      }

      if (!fbUser.emailVerified) {
        setCurrentUser(null);
        setNeedsEmailVerification(true);
        setAuthReady(true);
        setLoading(false);
        return;
      }

      setNeedsEmailVerification(false);
      setLoading(true);
      try {
        const profile = await syncUserProfile(fbUser);
        setCurrentUser(profile);
        setAuthError(null);
      } catch (err: any) {
        console.error('Failed to sync user profile with Firestore:', err);
        const cleanEmail = (fbUser.email || '').trim().toLowerCase();
        setAuthError({
          code: 'firestore/profile-sync',
          title: 'ไม่สามารถโหลดโปรไฟล์ผู้ใช้งานจากฐานข้อมูลได้',
          detail: err?.message || 'เกิดข้อผิดพลาดในการเชื่อมต่อ Firestore',
          solution: 'กรุณาลองรีเฟรชหน้าเว็บหรือตรวจสอบสิทธิ์การเข้าถึงฐานข้อมูล',
          actionType: 'check_network',
        });
        if (isMasterAdminEmail(cleanEmail)) {
          setCurrentUser({
            uid: fbUser.uid,
            displayName: fbUser.displayName || cleanEmail.split('@')[0],
            email: cleanEmail,
            role: 'admin',
            status: 'active',
            assignedProjectIds: [],
            createdAt: new Date().toISOString(),
            lastLoginAt: new Date().toISOString(),
          });
        } else {
          setCurrentUser(null);
        }
      } finally {
        setAuthReady(true);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [syncUserProfile]);

  const signInWithGoogle = async () => {
    setIsSigningIn(true);
    setAuthError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error: any) {
      setAuthError(mapFirebaseAuthError(error));
    } finally {
      setIsSigningIn(false);
    }
  };

  const signInWithGoogleRedirect = async () => {
    setIsSigningIn(true);
    setAuthError(null);
    try {
      await signInWithRedirect(auth, googleProvider);
    } catch (error: any) {
      setAuthError(mapFirebaseAuthError(error));
      setIsSigningIn(false);
    }
  };

  const signInWithEmail = async (email: string, password: string) => {
    setIsSigningIn(true);
    setAuthError(null);
    try {
      const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
      if (!cred.user.emailVerified) {
        setNeedsEmailVerification(true);
      }
    } catch (error: any) {
      setAuthError(mapFirebaseAuthError(error));
      throw error;
    } finally {
      setIsSigningIn(false);
    }
  };

  const registerWithEmail = async (email: string, password: string, displayName?: string) => {
    setIsSigningIn(true);
    setAuthError(null);
    try {
      const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
      if (displayName && displayName.trim()) {
        await updateProfile(cred.user, { displayName: displayName.trim() });
      }
      await sendEmailVerification(cred.user);
      setNeedsEmailVerification(true);
    } catch (error: any) {
      setAuthError(mapFirebaseAuthError(error));
      throw error;
    } finally {
      setIsSigningIn(false);
    }
  };

  const resetPasswordWithEmail = async (email: string) => {
    setIsSigningIn(true);
    setAuthError(null);
    try {
      await sendPasswordResetEmail(auth, email.trim());
    } catch (error: any) {
      setAuthError(mapFirebaseAuthError(error));
      throw error;
    } finally {
      setIsSigningIn(false);
    }
  };

  const resendVerificationEmail = async () => {
    if (!auth.currentUser) return;
    await sendEmailVerification(auth.currentUser);
  };

  const recheckEmailVerification = async (): Promise<boolean> => {
    if (!auth.currentUser) return false;
    await auth.currentUser.reload();
    if (auth.currentUser.emailVerified) {
      setNeedsEmailVerification(false);
      setLoading(true);
      try {
        const profile = await syncUserProfile(auth.currentUser);
        setCurrentUser(profile);
        setAuthError(null);
      } finally {
        setLoading(false);
      }
      return true;
    }
    return false;
  };

  const signInAsMasterAdmin = () => {
    signInWithGoogle().catch(() => {});
  };

  const signOut = async () => {
    await firebaseSignOut(auth);
    setCurrentUser(null);
    setFirebaseUser(null);
    setNeedsEmailVerification(false);
    setAuthError(null);
  };

  const refreshUser = async () => {
    if (!auth.currentUser) return;
    const profile = await syncUserProfile(auth.currentUser);
    setCurrentUser(profile);
  };

  const clearAuthError = () => {
    setAuthError(null);
  };

  const updateCurrentUserProfile = (patch: Partial<AppUser>) => {
    setCurrentUser((prev) => (prev ? { ...prev, ...patch } : prev));
  };

  const isMaster = Boolean(
    isMasterAdminEmail(currentUser?.email) ||
      (currentUser?.role === 'admin' && currentUser?.status === 'active')
  );

  const isApproved = isMaster || currentUser?.status === 'active';

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        firebaseUser,
        authReady,
        needsEmailVerification,
        isAdmin: isMaster,
        isApproved,
        loading,
        isSigningIn,
        authError,
        signInWithGoogle,
        signInWithGoogleRedirect,
        signInWithEmail,
        registerWithEmail,
        resetPasswordWithEmail,
        resendVerificationEmail,
        recheckEmailVerification,
        signInAsMasterAdmin,
        signOut,
        refreshUser,
        clearAuthError,
        updateCurrentUserProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
