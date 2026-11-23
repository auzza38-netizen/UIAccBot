import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
  isPermissionError: boolean;
  isQuotaError: boolean;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = {
      hasError: false,
      errorMessage: '',
      isPermissionError: false,
      isQuotaError: false,
    };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    const raw = error?.message || 'เกิดข้อผิดพลาดที่ไม่คาดคิด';
    let displayMsg = raw;
    let isPermissionError = false;
    let isQuotaError = false;

    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && 'error' in parsed) {
        displayMsg = `${parsed.error} (${parsed.operationType || 'unknown'}: ${parsed.path || '-'})`;
      }
    } catch {
      // Plain error message
    }

    if (/permission|insufficient/i.test(displayMsg)) {
      isPermissionError = true;
    }
    if (/quota exceeded/i.test(displayMsg)) {
      isQuotaError = true;
    }

    return {
      hasError: true,
      errorMessage: displayMsg,
      isPermissionError,
      isQuotaError,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Application ErrorBoundary caught:', error, errorInfo);
  }

  handleReload = () => {
    this.setState({
      hasError: false,
      errorMessage: '',
      isPermissionError: false,
      isQuotaError: false,
    });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#F6F8FB] flex items-center justify-center p-4 text-slate-900">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-lg max-w-lg w-full p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h2 className="font-display text-base font-bold text-slate-900">
                  {this.state.isQuotaError
                    ? 'ใช้งานเกินโควตาฐานข้อมูลรายวัน'
                    : this.state.isPermissionError
                    ? 'ไม่มีสิทธิ์เข้าถึงข้อมูลในฐานข้อมูล'
                    : 'เกิดข้อผิดพลาดในระบบ'}
                </h2>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  {this.state.isQuotaError
                    ? 'โควตาการใช้งาน Firestore ฟรีรายวันเต็มแล้ว กรุณารอรีเซ็ตในวันถัดไปหรืออัปเกรดแพ็กเกจใน Firebase Console'
                    : this.state.isPermissionError
                    ? 'กรุณาตรวจสอบสิทธิ์ผู้ใช้งานหรือบัญชี Google ที่เข้าสู่ระบบ แล้วลองใหม่อีกครั้ง'
                    : 'ระบบพบข้อขัดข้องในการประมวลผลข้อมูล กรุณารีเฟรชหน้าเว็บเพื่อดำเนินการต่อ'}
                </p>
              </div>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-[11px] font-mono text-slate-700 break-all max-h-32 overflow-y-auto">
              {this.state.errorMessage}
            </div>

            <div className="flex justify-end">
              <button
                onClick={this.handleReload}
                className="inline-flex items-center gap-2 px-4 py-2 bg-[#0F766E] hover:bg-[#0D645D] text-white rounded-lg text-xs font-semibold cursor-pointer transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>โหลดหน้าเว็บใหม่</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
