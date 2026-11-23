import React, { useState } from 'react';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';
import { formatThaiDateTime } from '../utils/formatters';
import {
  activeFirebaseProjectId,
  activeFirestoreDatabaseId,
  isUsingEnvFirebaseConfig,
} from '../firebase';
import {
  ShieldCheck,
  History,
  Lock,
  Cpu,
  Database,
  CheckCircle2,
  Loader2,
  AlertTriangle,
  Sparkles,
} from 'lucide-react';
import { MASTER_ADMIN_EMAIL } from '../services/dbService';

export const SettingsPage: React.FC = () => {
  const {
    auditLogs,
    seedSampleDataToFirebase,
    receipts,
    projects,
    bankAccounts,
    statementRecords,
  } = useData();
  const { isAdmin } = useAuth();
  const [seedStatus, setSeedStatus] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  );
  const [isSeeding, setIsSeeding] = useState<boolean>(false);

  const handleSeedSamples = async () => {
    setIsSeeding(true);
    setSeedStatus(null);
    try {
      await seedSampleDataToFirebase();
      setSeedStatus({
        type: 'success',
        text: 'เพิ่มข้อมูลตัวอย่าง (โครงการ ใบเสร็จ หมวดหมู่ บัญชีธนาคาร และ Statement) เข้าสู่ Firebase Firestore เรียบร้อยแล้ว',
      });
      setTimeout(() => setSeedStatus(null), 5000);
    } catch (err: any) {
      setSeedStatus({
        type: 'error',
        text: err?.message || 'เกิดข้อผิดพลาดในการเพิ่มข้อมูลตัวอย่างเข้า Firebase',
      });
    } finally {
      setIsSeeding(false);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="pb-2 border-b border-slate-200/80">
        <h1 className="font-display text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
          ตั้งค่าระบบและประวัติการใช้งาน
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          สถานะการเชื่อมต่อฐานข้อมูล Firebase Firestore นโยบายความปลอดภัย และประวัติกิจกรรมทั้งหมด (Audit Logs)
        </p>
      </div>

      {/* Firebase Connection & Seed Card */}
      <div className="bg-white border border-slate-200/90 rounded-xl p-5 sm:p-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-lg bg-teal-50 text-teal-700 flex items-center justify-center shrink-0">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-display font-semibold text-base text-slate-900">
                เชื่อมต่อฐานข้อมูล Firebase Firestore (Real-Time Cloud Sync)
              </h2>
              <p className="text-xs text-slate-500 leading-relaxed max-w-2xl mt-1">
                ข้อมูลโครงการ ใบเสร็จรับเงิน ผังหมวดหมู่ บัญชีธนาคาร Statement และสิทธิ์ผู้ใช้งานทั้งหมดถูกจัดเก็บและซิงค์แบบเรียลไทม์บน Firebase Cloud
              </p>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-3 text-xs text-slate-600 font-mono tabular-nums">
                <span className="text-teal-800 font-semibold">
                  Project: {activeFirebaseProjectId || '-'}
                </span>
                <span aria-hidden="true" className="text-slate-300">·</span>
                <span>
                  Config: {isUsingEnvFirebaseConfig ? 'VITE_FIREBASE_* Env' : 'Firebase Applet Config'}
                </span>
                {activeFirestoreDatabaseId && (
                  <>
                    <span aria-hidden="true" className="text-slate-300">·</span>
                    <span className="truncate max-w-[260px]" title={activeFirestoreDatabaseId}>
                      DB: {activeFirestoreDatabaseId}
                    </span>
                  </>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-xs text-slate-600 font-mono tabular-nums">
                <span>{projects.length} โครงการ</span>
                <span aria-hidden="true" className="text-slate-300">·</span>
                <span>{receipts.length} ใบเสร็จ</span>
                <span aria-hidden="true" className="text-slate-300">·</span>
                <span>{bankAccounts.length} บัญชีธนาคาร</span>
                <span aria-hidden="true" className="text-slate-300">·</span>
                <span>{statementRecords.length} Statement</span>
              </div>

              {seedStatus && (
                <div
                  className={`mt-3 p-3 rounded-lg text-xs font-medium border flex items-center gap-2 ${
                    seedStatus.type === 'success'
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                      : 'bg-rose-50 text-rose-800 border-rose-200'
                  }`}
                >
                  {seedStatus.type === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  )}
                  <span>{seedStatus.text}</span>
                </div>
              )}
            </div>
          </div>

          {isAdmin && (
            <div className="shrink-0">
              <button
                onClick={handleSeedSamples}
                disabled={isSeeding}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#0F766E] hover:bg-[#115E59] disabled:opacity-60 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap"
              >
                {isSeeding ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>กำลังบันทึกเข้า Firebase...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>เพิ่มข้อมูลตัวอย่างเข้า Firebase</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* System Policy Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
        <div className="bg-white border border-slate-200/90 rounded-xl p-5">
          <div className="flex items-center gap-2 text-slate-900 font-semibold mb-2">
            <Cpu className="w-4 h-4 text-teal-700" />
            <span>ระบบอ่านเอกสาร OCR & คลาวด์</span>
          </div>
          <p className="text-slate-500 mb-3 leading-relaxed">
            สกัดข้อมูลจากภาพถ่ายใบเสร็จ PDF หลายหน้า และ Bank Statement แล้วบันทึกขึ้นฐานข้อมูล Firebase ทันที
          </p>
          <ul className="text-slate-600 space-y-1.5 list-disc list-inside text-[11px]">
            <li>แยกยอดก่อนภาษี, VAT 7% และรายการสินค้า</li>
            <li>รองรับการแยกใบเสร็จจาก PDF หลายหน้า</li>
            <li>ตรวจสอบเอกสารซ้ำจากเลขที่บิลและยอดรวม</li>
          </ul>
        </div>

        <div className="bg-white border border-slate-200/90 rounded-xl p-5">
          <div className="flex items-center gap-2 text-slate-900 font-semibold mb-2">
            <Lock className="w-4 h-4 text-teal-700" />
            <span>ความปลอดภัย Firestore Security Rules</span>
          </div>
          <p className="text-slate-500 mb-3 leading-relaxed">
            ป้องกันสิทธิ์การอ่าน-เขียนข้อมูลทุก Collection ตามบทบาทผู้ใช้และขอบเขตโครงการ
          </p>
          <ul className="text-slate-600 space-y-1.5 list-disc list-inside text-[11px]">
            <li>ยืนยันตัวตนผ่าน Google Account (Firebase Auth)</li>
            <li>ตรวจสอบความถูกต้องของโครงสร้างข้อมูลทุกครั้ง</li>
            <li>บันทึก Audit Log แบบ Append-only ไม่สามารถแก้ไขย้อนหลังได้</li>
          </ul>
        </div>

        <div className="bg-white border border-slate-200/90 rounded-xl p-5">
          <div className="flex items-center gap-2 text-slate-900 font-semibold mb-2">
            <ShieldCheck className="w-4 h-4 text-teal-700" />
            <span>บทบาทผู้ใช้และผู้ดูแลระบบ</span>
          </div>
          <p className="text-slate-500 mb-3 leading-relaxed">
            ผู้ดูแลหลัก: <span className="font-mono font-semibold text-slate-800">{MASTER_ADMIN_EMAIL}</span>
          </p>
          <ul className="text-slate-600 space-y-1.5 list-disc list-inside text-[11px]">
            <li>จัดการสิทธิ์ระดับ Master Admin และพนักงานบันทึกข้อมูล</li>
            <li>กำหนดขอบเขตโครงการให้ผู้ใช้งานแต่ละคนได้ล่วงหน้า</li>
            <li>บันทึกทุกการแก้ไขและการอนุมัติใน Audit Log</li>
          </ul>
        </div>
      </div>

      {/* Audit Logs Table (Admin Only) */}
      {isAdmin && (
        <div className="bg-white border border-slate-200/90 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200/80 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <History className="w-4 h-4 text-teal-700" />
              <h3 className="text-sm font-semibold text-slate-900">
                ประวัติการแก้ไขและบันทึกข้อมูล (Audit Logs)
              </h3>
            </div>
            <span className="text-xs text-slate-500 font-mono tabular-nums">
              {auditLogs.length} รายการล่าสุด
            </span>
          </div>

          <div className="overflow-x-auto max-h-96">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 sticky top-0 text-[11px]">
                <tr>
                  <th className="py-3 px-4">เวลา</th>
                  <th className="py-3 px-4">การกระทำ</th>
                  <th className="py-3 px-4">ประเภท</th>
                  <th className="py-3 px-4">ผู้ดำเนินการ</th>
                  <th className="py-3 px-4">รายละเอียด</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {auditLogs.length > 0 ? (
                  auditLogs.map((log) => (
                    <tr key={log.logId} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 text-slate-500 whitespace-nowrap font-mono tabular-nums text-[11px]">
                        {formatThaiDateTime(log.timestamp)}
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-900">
                        {log.action}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-600">{log.entityType}</td>
                      <td className="py-3 px-4 font-mono text-slate-600">{log.userEmail}</td>
                      <td className="py-3 px-4 text-slate-700 max-w-md truncate">
                        {log.changes}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="py-10 text-center text-slate-400 text-xs">
                      ยังไม่มีประวัติการบันทึกในระบบ
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
