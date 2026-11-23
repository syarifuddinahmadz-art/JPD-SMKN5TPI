import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    let readableMessage = error.message;
    try {
      const parsed = JSON.parse(error.message) as {
        error?: string;
        operationType?: string;
        path?: string;
      };
      if (parsed && parsed.error) {
        readableMessage = `Akses database ditolak atau gagal (${parsed.operationType ?? 'operasi'} pada ${parsed.path ?? 'dokumen'}): ${parsed.error}`;
      }
    } catch {
      // Bukan JSON FirestoreErrorInfo, tampilkan pesan asli
    }
    return { hasError: true, message: readableMessage };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#F5F7FA] flex items-center justify-center p-6">
          <div className="w-full max-w-lg bg-white border border-slate-200 rounded-xl p-8">
            <div className="flex items-start gap-4">
              <div className="w-11 h-11 rounded-lg bg-red-50 border border-red-200 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-red-700" />
              </div>
              <div className="space-y-2">
                <h1 className="text-lg font-semibold text-[#102D46]">
                  Terjadi Gangguan Sistem
                </h1>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Aplikasi mengalami kendala saat memproses permintaan data. Silakan muat ulang
                  halaman atau hubungi administrator SMK Negeri 5 Tanjungpinang.
                </p>
                <p className="text-xs font-mono-tabular text-slate-500 bg-slate-50 border border-slate-200 rounded-md p-3 break-words">
                  {this.state.message}
                </p>
              </div>
            </div>
            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#102D46] hover:bg-[#1C678A] text-white text-sm font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                Muat Ulang Aplikasi
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
