import React, { useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  LogOut,
  ShieldAlert,
  UserCheck,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  ApprovalStatus,
  BOOTSTRAPPED_ADMIN_EMAIL,
  FIELD_LIMITS,
  RequestedRole,
  ROLE_LABELS,
} from '../types/auth';
import { BrandMark } from './BrandMark';

export function RegistrationGate() {
  const {
    firebaseUser,
    profile,
    submitRegistration,
    resubmitRegistration,
    signOutUser,
  } = useAuth();

  const isBootstrappedAdmin =
    firebaseUser?.email === BOOTSTRAPPED_ADMIN_EMAIL && firebaseUser.emailVerified;

  const [displayName, setDisplayName] = useState(
    profile?.displayName ?? firebaseUser?.displayName ?? '',
  );
  const [nip, setNip] = useState(profile?.nip ?? '');
  const [jabatan, setJabatan] = useState(
    profile?.jabatan ?? (isBootstrappedAdmin ? 'Administrator Utama Sistem' : ''),
  );
  const [requestedRole, setRequestedRole] = useState<RequestedRole>(
    profile?.requestedRole ?? (isBootstrappedAdmin ? RequestedRole.ADMIN : RequestedRole.GURU),
  );
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);
    try {
      if (profile?.approvalStatus === ApprovalStatus.REJECTED) {
        await resubmitRegistration({ displayName, nip, jabatan, requestedRole });
      } else {
        await submitRegistration({ displayName, nip, jabatan, requestedRole });
      }
    } catch (error) {
      setFormError(
        error instanceof Error ? error.message : 'Gagal menyimpan pengajuan profil pengguna.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (profile && profile.approvalStatus === ApprovalStatus.PENDING) {
    return (
      <div className="min-h-screen bg-[#F5F7FA] flex flex-col justify-between p-6">
        <header className="max-w-2xl w-full mx-auto flex items-center justify-between py-2">
          <div className="flex items-center gap-3">
            <BrandMark size={36} />
            <div>
              <p className="text-sm font-bold text-[#102D46]">JPD-SMK</p>
              <p className="text-xs text-slate-500">SMK Negeri 5 Tanjungpinang</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void signOutUser()}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-medium text-slate-700 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            Keluar
          </button>
        </header>

        <main className="max-w-2xl w-full mx-auto my-auto py-8">
          <div className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-6">
            <div className="flex items-start gap-4">
              <div className="w-11 h-11 rounded-lg bg-[#1C678A]/10 border border-[#1C678A]/20 flex items-center justify-center shrink-0">
                <Clock className="w-5 h-5 text-[#1C678A]" />
              </div>
              <div className="space-y-1.5">
                <h1 className="text-xl font-bold text-[#102D46]">
                  Pengajuan Akun Menunggu Persetujuan
                </h1>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Data pendaftaran Anda telah tercatat di sistem JPD-SMK. Administrator SMK
                  Negeri 5 Tanjungpinang akan meninjau dan mengaktifkan peran Anda. Halaman ini
                  akan terbuka otomatis begitu akun disetujui.
                </p>
              </div>
            </div>

            <dl className="divide-y divide-slate-200 border border-slate-200 rounded-lg bg-[#F5F7FA]/60 text-sm">
              <div className="px-4 py-3 flex items-center justify-between gap-4">
                <dt className="text-slate-500">Nama Lengkap</dt>
                <dd className="font-medium text-[#102D46] text-right">{profile.displayName}</dd>
              </div>
              <div className="px-4 py-3 flex items-center justify-between gap-4">
                <dt className="text-slate-500">Email Google</dt>
                <dd className="font-mono-tabular text-xs text-slate-700 text-right">
                  {profile.email}
                </dd>
              </div>
              <div className="px-4 py-3 flex items-center justify-between gap-4">
                <dt className="text-slate-500">NIP / NUPTK</dt>
                <dd className="font-mono-tabular text-slate-700 text-right">
                  {profile.nip || '—'}
                </dd>
              </div>
              <div className="px-4 py-3 flex items-center justify-between gap-4">
                <dt className="text-slate-500">Jabatan / Bidang</dt>
                <dd className="text-slate-700 text-right">{profile.jabatan || '—'}</dd>
              </div>
              <div className="px-4 py-3 flex items-center justify-between gap-4">
                <dt className="text-slate-500">Peran Diajukan</dt>
                <dd className="font-medium text-[#1C678A] text-right">
                  {ROLE_LABELS[profile.requestedRole]}
                </dd>
              </div>
              <div className="px-4 py-3 flex items-center justify-between gap-4">
                <dt className="text-slate-500">Status</dt>
                <dd className="font-medium text-amber-700 text-right">
                  Menunggu Persetujuan Administrator
                </dd>
              </div>
            </dl>
          </div>
        </main>

        <footer className="max-w-2xl w-full mx-auto text-center text-xs text-slate-500 py-2">
          SMK Negeri 5 Tanjungpinang · Jurnal Pembelajaran Digital SMK
        </footer>
      </div>
    );
  }

  const isRejected = profile?.approvalStatus === ApprovalStatus.REJECTED;

  return (
    <div className="min-h-screen bg-[#F5F7FA] flex flex-col justify-between p-6">
      <header className="max-w-xl w-full mx-auto flex items-center justify-between py-2">
        <div className="flex items-center gap-3">
          <BrandMark size={36} />
          <div>
            <p className="text-sm font-bold text-[#102D46]">JPD-SMK</p>
            <p className="text-xs text-slate-500">SMK Negeri 5 Tanjungpinang</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void signOutUser()}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-medium text-slate-700 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <LogOut className="w-3.5 h-3.5" />
          Keluar
        </button>
      </header>

      <main className="max-w-xl w-full mx-auto my-auto py-8">
        <div className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-6">
          <div className="flex items-start gap-4">
            <div className="w-11 h-11 rounded-lg bg-[#102D46]/5 border border-slate-200 flex items-center justify-center shrink-0">
              {isRejected ? (
                <ShieldAlert className="w-5 h-5 text-red-700" />
              ) : (
                <UserCheck className="w-5 h-5 text-[#16A6A0]" />
              )}
            </div>
            <div className="space-y-1">
              <h1 className="text-xl font-bold text-[#102D46]">
                {isRejected
                  ? 'Perbarui Pengajuan Akses Akun'
                  : isBootstrappedAdmin
                    ? 'Aktivasi Profil Administrator Utama'
                    : 'Lengkapi Pendaftaran Pengguna JPD-SMK'}
              </h1>
              <p className="text-sm text-slate-600 leading-relaxed">
                {isRejected
                  ? 'Pengajuan akses Anda sebelumnya perlu diperbaiki. Perbarui data di bawah ini dan ajukan kembali ke administrator.'
                  : isBootstrappedAdmin
                    ? 'Akun Google Anda terdaftar sebagai Administrator Utama sistem. Lengkapi data profil untuk langsung masuk ke ruang kerja.'
                    : 'Akun Google Anda berhasil diautentikasi. Lengkapi identitas kepegawaian untuk diajukan kepada Administrator SMK Negeri 5 Tanjungpinang.'}
              </p>
            </div>
          </div>

          {isRejected && profile?.rejectionReason && (
            <div className="p-3.5 rounded-lg bg-red-50 border border-red-200 text-xs text-red-800 space-y-1">
              <p className="font-semibold">Catatan Penolakan Administrator:</p>
              <p>{profile.rejectionReason}</p>
            </div>
          )}

          {formError && (
            <div className="flex items-start gap-2.5 p-3.5 rounded-lg bg-red-50 border border-red-200 text-xs text-red-800">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{formError}</span>
            </div>
          )}

          <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-slate-700">Email Google</label>
              <input
                type="email"
                value={firebaseUser?.email ?? ''}
                disabled
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 bg-slate-50 text-sm font-mono-tabular text-slate-600"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="reg-displayName" className="block text-xs font-medium text-slate-700">
                Nama Lengkap dan Gelar <span className="text-red-600">*</span>
              </label>
              <input
                id="reg-displayName"
                type="text"
                required
                minLength={FIELD_LIMITS.displayNameMin}
                maxLength={FIELD_LIMITS.displayNameMax}
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Contoh: Ahmad Syarifuddin, S.Kom."
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 bg-white text-sm text-[#102D46] focus:outline-none focus:border-[#1C678A] focus:ring-2 focus:ring-[#1C678A]/15"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label htmlFor="reg-nip" className="block text-xs font-medium text-slate-700">
                  NIP / NUPTK (Opsional)
                </label>
                <input
                  id="reg-nip"
                  type="text"
                  maxLength={FIELD_LIMITS.nipMax}
                  value={nip}
                  onChange={(e) => setNip(e.target.value)}
                  placeholder="Contoh: 198905142019031004"
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 bg-white text-sm font-mono-tabular text-[#102D46] focus:outline-none focus:border-[#1C678A] focus:ring-2 focus:ring-[#1C678A]/15"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="reg-jabatan" className="block text-xs font-medium text-slate-700">
                  Jabatan / Mata Pelajaran
                </label>
                <input
                  id="reg-jabatan"
                  type="text"
                  maxLength={FIELD_LIMITS.jabatanMax}
                  value={jabatan}
                  onChange={(e) => setJabatan(e.target.value)}
                  placeholder="Contoh: Guru Produktif TKJ"
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 bg-white text-sm text-[#102D46] focus:outline-none focus:border-[#1C678A] focus:ring-2 focus:ring-[#1C678A]/15"
                />
              </div>
            </div>

            {!isBootstrappedAdmin && (
              <div className="space-y-1.5">
                <label htmlFor="reg-role" className="block text-xs font-medium text-slate-700">
                  Peran yang Diajukan <span className="text-red-600">*</span>
                </label>
                <select
                  id="reg-role"
                  value={requestedRole}
                  onChange={(e) => setRequestedRole(e.target.value as RequestedRole)}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 bg-white text-sm text-[#102D46] focus:outline-none focus:border-[#1C678A] focus:ring-2 focus:ring-[#1C678A]/15"
                >
                  <option value={RequestedRole.GURU}>Guru (Pencatatan Jurnal & Dokumentasi)</option>
                  <option value={RequestedRole.KEPALA_SEKOLAH}>
                    Kepala Sekolah (Monitoring & Laporan)
                  </option>
                  <option value={RequestedRole.ADMIN}>
                    Administrator (Pengelolaan Data Master & Akun)
                  </option>
                </select>
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full min-h-[44px] px-5 py-2.5 rounded-lg bg-[#102D46] hover:bg-[#1C678A] disabled:opacity-65 text-white text-sm font-medium flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              {submitting ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Menyimpan Data...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>
                    {isBootstrappedAdmin
                      ? 'Aktifkan Akun Administrator'
                      : isRejected
                        ? 'Ajukan Ulang Pendaftaran'
                        : 'Kirim Pengajuan Akun'}
                  </span>
                </>
              )}
            </button>
          </form>
        </div>
      </main>

      <footer className="max-w-xl w-full mx-auto text-center text-xs text-slate-500 py-2">
        SMK Negeri 5 Tanjungpinang · Jurnal Pembelajaran Digital SMK
      </footer>
    </div>
  );
}
