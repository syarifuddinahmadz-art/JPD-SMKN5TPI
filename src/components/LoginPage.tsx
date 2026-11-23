import { useState } from 'react';
import {
  AlertCircle,
  BookOpen,
  Building2,
  Camera,
  CheckCircle2,
  ClipboardCheck,
  ShieldCheck,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { FIREBASE_PROJECT_ID } from '../lib/firebase';
import { BrandMark } from './BrandMark';

const CAMPUS_IMAGE_SRC = '/src/assets/images/smk_pelayaran_campus_1795365717350.jpg';

const ROLE_DESCRIPTIONS = [
  {
    id: 'guru',
    title: 'Guru Mata Pelajaran & Produktif',
    summary:
      'Mencatat jurnal pembelajaran harian, capaian materi, kehadiran peserta didik, dan unggah dokumentasi aktivitas mengajar.',
  },
  {
    id: 'kepsek',
    title: 'Kepala Sekolah',
    summary:
      'Memantau keterlaksanaan pembelajaran secara menyeluruh, meninjau dokumentasi kegiatan kelas, dan mengunduh laporan periodik.',
  },
  {
    id: 'admin',
    title: 'Administrator Sekolah',
    summary:
      'Memverifikasi pendaftaran akun baru serta mengelola data master guru, kelas, mata pelajaran, dan jadwal pembelajaran.',
  },
] as const;

export function LoginPage() {
  const { signInWithGoogle, isSigningIn, authError, clearAuthError } = useAuth();
  const [imageError, setImageError] = useState(false);
  const [activeInfoTab, setActiveInfoTab] = useState<'roles' | 'workflow'>('roles');

  return (
    <div className="min-h-screen bg-[#F5F7FA] flex flex-col lg:grid lg:grid-cols-12">
      {/* Left Column: Institutional Showcase */}
      <aside className="relative lg:col-span-6 bg-[#102D46] text-white flex flex-col justify-between overflow-hidden min-h-[260px] lg:min-h-screen">
        {!imageError ? (
          <img
            src={CAMPUS_IMAGE_SRC}
            alt="Lingkungan Kampus SMK Pelayaran SMK Negeri 5 Tanjungpinang"
            referrerPolicy="no-referrer"
            onError={() => setImageError(true)}
            className="absolute inset-0 w-full h-full object-cover object-center opacity-65"
          />
        ) : (
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-gradient-to-br from-[#102D46] via-[#1C678A] to-[#102D46]"
          />
        )}

        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-t from-[#102D46]/95 via-[#102D46]/70 to-[#102D46]/45"
        />

        <div className="relative z-10 p-6 sm:p-10 lg:p-12 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <BrandMark variant="light" size={40} />
            <div>
              <p className="text-base font-semibold tracking-tight text-white">JPD-SMK</p>
              <p className="text-xs text-slate-200/90">SMK Negeri 5 Tanjungpinang</p>
            </div>
          </div>
          <span className="hidden sm:inline-block text-xs font-medium text-slate-200/90">
            Sistem Administrasi Akademik
          </span>
        </div>

        <div className="relative z-10 p-6 sm:p-10 lg:p-12 space-y-6">
          <div className="space-y-3 max-w-xl">
            <p className="text-xs font-semibold tracking-wider uppercase text-[#16A6A0]">
              Jurnal Pembelajaran Digital
            </p>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-white leading-tight [text-wrap:balance]">
              Dokumentasi Mengajar Terstruktur dan Monitoring Pembelajaran Terpadu
            </h1>
            <p className="text-sm sm:text-base text-slate-200 leading-relaxed max-w-lg">
              Platform administrasi pembelajaran resmi SMK Negeri 5 Tanjungpinang untuk
              pencatatan kegiatan harian guru, dokumentasi kelas, serta supervisi kepala
              sekolah.
            </p>
          </div>

          <div className="hidden sm:grid grid-cols-3 gap-4 pt-4 border-t border-white/15 max-w-xl">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-[#16A6A0]">
                <BookOpen className="w-4 h-4 shrink-0" />
                <span className="text-xs font-semibold text-white">Jurnal Harian</span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                Rekam materi ajar dan aktivitas kelas per jam pelajaran.
              </p>
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-[#16A6A0]">
                <Camera className="w-4 h-4 shrink-0" />
                <span className="text-xs font-semibold text-white">Dokumentasi</span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                Arsip bukti kegiatan praktik dan pembelajaran tatap muka.
              </p>
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-[#16A6A0]">
                <ClipboardCheck className="w-4 h-4 shrink-0" />
                <span className="text-xs font-semibold text-white">Monitoring</span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                Dasbor rekapitulasi dan pengawasan kepala sekolah.
              </p>
            </div>
          </div>
        </div>
      </aside>

      {/* Right Column: Authentication Workspace */}
      <main className="lg:col-span-6 flex flex-col justify-between p-6 sm:p-10 lg:p-14">
        <div className="max-w-md w-full mx-auto my-auto space-y-6">
          <div className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs font-medium text-[#1C678A]">
                <Building2 className="w-4 h-4 shrink-0" />
                <span>Portal Autentikasi Pengguna</span>
                <span aria-hidden="true">·</span>
                <span>SMKN 5 Tanjungpinang</span>
              </div>
              <h2 className="text-2xl font-bold tracking-tight text-[#102D46]">
                Masuk ke JPD-SMK
              </h2>
              <p className="text-sm text-slate-600 leading-relaxed">
                Gunakan akun Google resmi atau akun Google aktif Anda untuk masuk ke sistem
                atau mengajukan pendaftaran pengguna baru.
              </p>
            </div>

            {authError && (
              <div
                role="alert"
                className="flex items-start gap-3 p-3.5 rounded-lg bg-red-50 border border-red-200 text-red-800 text-sm"
              >
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-red-700" />
                <div className="flex-1 space-y-1">
                  <p className="font-medium">Autentikasi Belum Berhasil</p>
                  <p className="text-xs text-red-700 leading-relaxed">{authError}</p>
                </div>
                <button
                  type="button"
                  onClick={clearAuthError}
                  className="text-xs font-medium text-red-700 hover:text-red-900 cursor-pointer shrink-0"
                >
                  Tutup
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={() => void signInWithGoogle()}
              disabled={isSigningIn}
              className="w-full min-h-[46px] px-5 py-3 rounded-lg bg-[#102D46] hover:bg-[#1C678A] disabled:opacity-65 disabled:cursor-not-allowed text-white font-medium text-sm flex items-center justify-center gap-3 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#16A6A0] cursor-pointer"
            >
              {isSigningIn ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Menghubungkan ke Akun Google...</span>
                </>
              ) : (
                <>
                  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                    <path
                      fill="#FFFFFF"
                      d="M21.35 11.1h-9.17v2.73h6.51c-.33 3.81-3.5 5.44-6.5 5.44C8.36 19.27 5 16.25 5 12c0-4.1 3.2-7.27 7.2-7.27 3.09 0 4.9 1.97 4.9 1.97L19 4.72S16.56 2 12.1 2C6.42 2 2.03 6.8 2.03 12c0 5.05 4.13 10 10.22 10 5.35 0 9.25-3.67 9.25-9.09 0-1.15-.15-1.81-.15-1.81Z"
                    />
                  </svg>
                  <span className="whitespace-nowrap">Masuk dengan Google</span>
                </>
              )}
            </button>

            <div className="pt-4 border-t border-slate-200 space-y-4">
              <div className="flex items-center gap-1 p-1 bg-[#F5F7FA] rounded-lg border border-slate-200">
                <button
                  type="button"
                  onClick={() => setActiveInfoTab('roles')}
                  className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                    activeInfoTab === 'roles'
                      ? 'bg-white text-[#102D46] border border-slate-200'
                      : 'text-slate-600 hover:text-[#102D46]'
                  }`}
                >
                  Peran Pengguna
                </button>
                <button
                  type="button"
                  onClick={() => setActiveInfoTab('workflow')}
                  className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                    activeInfoTab === 'workflow'
                      ? 'bg-white text-[#102D46] border border-slate-200'
                      : 'text-slate-600 hover:text-[#102D46]'
                  }`}
                >
                  Alur Persetujuan
                </button>
              </div>

              {activeInfoTab === 'roles' ? (
                <div className="space-y-3">
                  {ROLE_DESCRIPTIONS.map((item) => (
                    <div key={item.id} className="space-y-0.5">
                      <p className="text-xs font-semibold text-[#102D46]">{item.title}</p>
                      <p className="text-xs text-slate-600 leading-relaxed">{item.summary}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <ol className="space-y-2.5 text-xs text-slate-600 leading-relaxed">
                  <li className="flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-[#16A6A0] shrink-0 mt-0.5" />
                    <span>
                      <strong className="text-[#102D46]">1. Autentikasi Google:</strong> Masuk
                      menggunakan akun Google terverifikasi tanpa kata sandi tambahan.
                    </span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-[#16A6A0] shrink-0 mt-0.5" />
                    <span>
                      <strong className="text-[#102D46]">2. Pengajuan Profil:</strong> Pengguna baru
                      mengisi data nama, NIP/NUPTK, dan peran yang diajukan.
                    </span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <ShieldCheck className="w-4 h-4 text-[#1C678A] shrink-0 mt-0.5" />
                    <span>
                      <strong className="text-[#102D46]">3. Persetujuan Administrator:</strong>{' '}
                      Akses penuh ke modul pembelajaran aktif setelah diverifikasi administrator.
                    </span>
                  </li>
                </ol>
              )}
            </div>
          </div>

          <footer className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 px-1">
            <span>SMK Negeri 5 Tanjungpinang · JPD-SMK</span>
            <span className="font-mono-tabular">Project: {FIREBASE_PROJECT_ID}</span>
          </footer>
        </div>
      </main>
    </div>
  );
}
