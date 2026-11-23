import React, { useState } from 'react';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';
import { formatThaiDateTime } from '../utils/formatters';
import {
  Settings,
  ShieldCheck,
  History,
  Lock,
  Cpu,
  Database,
  RefreshCw,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';
import { MASTER_ADMIN_EMAIL } from '../services/dbService';

export const SettingsPage: React.FC = () => {
  const { auditLogs, resetMockData, receipts, projects, bankAccounts, statementRecords } = useData();
  const { isAdmin } = useAuth();
  const [resetMessage, setResetMessage] = useState<string | null>(null);

  const handleResetDemo = () => {
    resetMockData();
    setResetMessage('รีเซ็ตข้อมูลจำลองทั้งหมดกลับเป็นค่าเริ่มต้นเรียบร้อยแล้ว');
    setTimeout(() => setResetMessage(null), 4000);
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
          <Settings className="w-5 h-5 text-teal-600" />
          การตั้งค่าระบบ & ประวัติการตรวจสอบ (Settings & Audit Logs)
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">
          ภาพรวมโหมด Frontend UI Template, โครงสร้างการทำงานจำลอง และประวัติการบันทึกกิจกรรมในเซสชัน
        </p>
      </div>

      {/* Banner: Frontend UI Template Mode & Reset Demo Data */}
      <div className="p-4 sm:p-5 bg-gradient-to-br from-[#12304A] via-[#173e60] to-slate-900 text-white rounded-2xl shadow-md border border-teal-500/30">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="p-2.5 bg-teal-500/20 border border-teal-400/30 rounded-xl text-teal-300 shrink-0 mt-0.5">
              <Database className="w-6 h-6" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <h3 className="font-bold text-sm sm:text-base text-white flex items-center gap-2">
                  โหมดเทมเพลตส่วนหน้า (Pure Frontend UI Template)
                </h3>
                <span className="text-[10px] bg-teal-400/20 text-teal-200 border border-teal-400/30 px-2 py-0.5 rounded-full font-bold">
                  Mock Data Interactive
                </span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed max-w-2xl">
                แอปพลิเคชันทำงานด้วยข้อมูลจำลอง (Hardcoded Mock Data) ในหน่วยความจำของเบราว์เซอร์ทั้งหมด โดยไม่เชื่อมต่อฐานข้อมูลหรือ API ภายนอก คุณสามารถทดลองเพิ่มใบเสร็จ อนุมัติรายการ แก้ไขโครงการ และส่งออกรายงาน Excel/PDF ได้ครบทุกปุ่ม
              </p>
              <div className="flex flex-wrap gap-2 mt-2.5 text-[11px] text-teal-100">
                <span className="bg-white/10 px-2.5 py-1 rounded-lg">📁 {projects.length} โครงการ</span>
                <span className="bg-white/10 px-2.5 py-1 rounded-lg">🧾 {receipts.length} ใบเสร็จ</span>
                <span className="bg-white/10 px-2.5 py-1 rounded-lg">🏦 {bankAccounts.length} บัญชี</span>
                <span className="bg-white/10 px-2.5 py-1 rounded-lg">📑 {statementRecords.length} Statement</span>
              </div>
              {resetMessage && (
                <div className="mt-3 p-2.5 rounded-lg text-xs font-semibold bg-emerald-950/80 text-emerald-200 border border-emerald-500/40 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>{resetMessage}</span>
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0 pl-12 lg:pl-0">
            <button
              onClick={handleResetDemo}
              className="flex items-center gap-2 px-4 py-2.5 bg-[#0D9488] hover:bg-teal-500 text-white text-xs font-bold rounded-xl shadow-sm transition cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
              รีเซ็ตข้อมูลจำลองเริ่มต้น
            </button>
          </div>
        </div>
      </div>

      {/* System Policy Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
        {/* Card 1: Mock OCR Engine */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
          <div className="flex items-center gap-2 text-teal-700 font-bold mb-2">
            <Cpu className="w-4 h-4" />
            <span>Interactive OCR Simulator</span>
          </div>
          <p className="text-slate-600 mb-2">
            จำลองการสแกนอ่านใบเสร็จ ภาพถ่าย PDF หลายหน้า และ Statement ภายในเบราว์เซอร์ทันที
          </p>
          <ul className="text-slate-500 space-y-1 list-disc list-inside text-[11px]">
            <li>สร้างรายการสินค้า ยอดก่อนภาษี และ VAT 7% อัตโนมัติ</li>
            <li>รองรับการแยกใบเสร็จจากไฟล์ PDF หลายหน้า</li>
            <li>รองรับการนำเข้าโฟลเดอร์ชุดใบเสร็จและ Statement</li>
            <li>ตรวจสอบข้อมูลซ้ำซ้อนจาก State ปัจจุบันทันที</li>
          </ul>
        </div>

        {/* Card 2: In-Memory State Architecture */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
          <div className="flex items-center gap-2 text-teal-700 font-bold mb-2">
            <Lock className="w-4 h-4" />
            <span>โครงสร้างข้อมูลจำลอง (In-Memory)</span>
          </div>
          <p className="text-slate-600 mb-2">
            ทำงานเป็น Frontend UI Template ล้วน ไม่มีการส่งข้อมูลหรือไฟล์ออกไปยังเซิร์ฟเวอร์ภายนอก
          </p>
          <ul className="text-slate-500 space-y-1 list-disc list-inside text-[11px]">
            <li>ข้อมูลทั้งหมดจัดการผ่าน React Context ภายในเซสชัน</li>
            <li>รองรับการคำนวณ KPI กราฟ Recharts และส่งออกไฟล์</li>
            <li>สามารถกด "รีเซ็ตข้อมูลจำลองเริ่มต้น" ได้ทุกเมื่อ</li>
          </ul>
        </div>

        {/* Card 3: RBAC & Master Admin */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
          <div className="flex items-center gap-2 text-blue-700 font-bold mb-2">
            <ShieldCheck className="w-4 h-4" />
            <span>Security & Master Admin</span>
          </div>
          <p className="text-slate-600 mb-2">
            Master Admin เริ่มต้น: <span className="font-mono font-bold text-slate-800">{MASTER_ADMIN_EMAIL}</span>
          </p>
          <ul className="text-slate-500 space-y-1 list-disc list-inside text-[11px]">
            <li>จำลองระบบสิทธิ์บทบาท Admin และ User ครบถ้วน</li>
            <li>รองรับการเพิ่มผู้ใช้งานและมอบหมายโครงการ</li>
            <li>บันทึก Audit Log ทุกการแก้ไขและการอนุมัติในเซสชัน</li>
          </ul>
        </div>
      </div>

      {/* Audit Logs Table (Admin Only) */}
      {isAdmin && (
        <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-200 bg-slate-50/50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <History className="w-4 h-4 text-teal-600" />
              <h3 className="text-sm font-bold text-slate-900">
                ประวัติการแก้ไขและบันทึกข้อมูล (Audit Log Compliance)
              </h3>
            </div>
            <span className="text-[11px] text-slate-400 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-teal-600" />
              บันทึก 100 รายการล่าสุด ({auditLogs.length})
            </span>
          </div>

          <div className="overflow-x-auto max-h-96">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 sticky top-0 uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-2.5 px-3">เวลา (Timestamp)</th>
                  <th className="py-2.5 px-3">การกระทำ (Action)</th>
                  <th className="py-2.5 px-3">ประเภท</th>
                  <th className="py-2.5 px-3">ผู้ดำเนินการ (User)</th>
                  <th className="py-2.5 px-3">รายละเอียด (Details)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                {auditLogs.length > 0 ? (
                  auditLogs.map((log) => (
                    <tr key={log.logId} className="hover:bg-slate-50">
                      <td className="py-2.5 px-3 text-slate-500 whitespace-nowrap font-sans">
                        {formatThaiDateTime(log.timestamp)}
                      </td>
                      <td className="py-2.5 px-3 font-bold text-slate-800 font-sans">
                        {log.action}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600">{log.entityType}</td>
                      <td className="py-2.5 px-3 text-slate-600">{log.userEmail}</td>
                      <td className="py-2.5 px-3 text-slate-700 font-sans max-w-md truncate">
                        {log.changes}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-400 font-sans text-xs">
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
