import React, { useEffect, useState } from 'react';
import {
  BarChart3,
  BookOpen,
  CalendarDays,
  Camera,
  CheckCircle2,
  ClipboardList,
  FileSpreadsheet,
  Home,
  LogOut,
  Menu,
  UserCog,
  Users,
  X,
} from 'lucide-react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import {
  ApprovalStatus,
  BOOTSTRAPPED_ADMIN_EMAIL,
  FIELD_LIMITS,
  ROLE_LABELS,
  UserRole,
} from '../types/auth';
import { EntityStatus, SEMESTER_LABELS, type AcademicYear } from '../types/masterData';
import { AdminApprovalPanel } from './AdminApprovalPanel';
import { BrandMark } from './BrandMark';
import { DailyJournalWorkspace } from './journal/DailyJournalWorkspace';
import { DocumentationGallery } from './journal/DocumentationGallery';
import { MasterDataHub } from './master/MasterDataHub';
import { PrincipalMonitoringDashboard } from './monitoring/PrincipalMonitoringDashboard';
import { ReportsRecapWorkspace } from './reports/ReportsRecapWorkspace';
import { TeacherScheduleView } from './TeacherScheduleView';

type NavSectionId =
  | 'ringkasan'
  | 'persetujuan'
  | 'jurnal'
  | 'jadwal'
  | 'dokumentasi'
  | 'monitoring'
  | 'master-data'
  | 'rekapitulasi'
  | 'profil';

interface NavItem {
  id: NavSectionId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  stageLabel: string;
  roles: UserRole[];
  plannedScope?: string;
}

const NAV_ITEMS: NavItem[] = [
  {
    id: 'ringkasan',
    label: 'Beranda Sistem',
    icon: Home,
    stageLabel: 'Utama',
    roles: [UserRole.ADMIN, UserRole.GURU, UserRole.KEPALA_SEKOLAH],
  },
  {
    id: 'persetujuan',
    label: 'Persetujuan Akun',
    icon: Users,
    stageLabel: 'Akses & Peran',
    roles: [UserRole.ADMIN],
    plannedScope:
      'Verifikasi pendaftar akun Google baru serta penetapan peran Guru, Kepala Sekolah, atau Administrator.',
  },
  {
    id: 'jurnal',
    label: 'Jurnal Harian',
    icon: BookOpen,
    stageLabel: 'Pembelajaran',
    roles: [UserRole.GURU, UserRole.ADMIN],
    plannedScope:
      'Pencatatan kegiatan pembelajaran harian per mata pelajaran, kelas, materi pokok, metode, dan catatan refleksi.',
  },
  {
    id: 'jadwal',
    label: 'Jadwal Mengajar',
    icon: CalendarDays,
    stageLabel: 'Akademik',
    roles: [UserRole.GURU],
    plannedScope:
      'Tampilan jadwal mengajar terintegrasi dengan data master kelas dan jam pelajaran SMK Negeri 5 Tanjungpinang.',
  },
  {
    id: 'dokumentasi',
    label: 'Dokumentasi Mengajar',
    icon: Camera,
    stageLabel: 'Arsip Visual',
    roles: [UserRole.GURU, UserRole.KEPALA_SEKOLAH, UserRole.ADMIN],
    plannedScope:
      'Pengarsipan bukti foto aktivitas kelas, praktik bengkel/lab, dan catatan pendamping pembelajaran.',
  },
  {
    id: 'monitoring',
    label: 'Monitoring Kepala Sekolah',
    icon: BarChart3,
    stageLabel: 'Supervisi',
    roles: [UserRole.KEPALA_SEKOLAH, UserRole.ADMIN],
    plannedScope:
      'Dashboard pemantauan kepatuhan pengisian jurnal harian guru, ringkasan kelas aktif, dan catatan supervisi.',
  },
  {
    id: 'master-data',
    label: 'Data Master Akademik',
    icon: ClipboardList,
    stageLabel: 'Data Induk',
    roles: [UserRole.ADMIN],
    plannedScope:
      'Pengelolaan tahun ajaran aktif, data guru, kelas, mata pelajaran, dan jadwal mengajar SMK Negeri 5 Tanjungpinang.',
  },
  {
    id: 'rekapitulasi',
    label: 'Rekapitulasi & Laporan',
    icon: FileSpreadsheet,
    stageLabel: 'Pelaporan',
    roles: [UserRole.KEPALA_SEKOLAH, UserRole.ADMIN, UserRole.GURU],
    plannedScope:
      'Ekspor laporan jurnal pembelajaran bulanan/semester ke format CSV dan dokumen PDF resmi sekolah.',
  },
  {
    id: 'profil',
    label: 'Profil Pengguna',
    icon: UserCog,
    stageLabel: 'Identitas',
    roles: [UserRole.ADMIN, UserRole.GURU, UserRole.KEPALA_SEKOLAH],
    plannedScope:
      'Pembaruan nama lengkap, NIP/NUPTK, dan jabatan kepegawaian pada akun pengguna aktif.',
  },
];

export function AppShell() {
  const { firebaseUser, profile, signOutUser, updateOwnProfile } = useAuth();
  const [activeNav, setActiveNav] = useState<NavSectionId>('ringkasan');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [editName, setEditName] = useState(profile?.displayName ?? '');
  const [editNip, setEditNip] = useState(profile?.nip ?? '');
  const [editJabatan, setEditJabatan] = useState(profile?.jabatan ?? '');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSavedMessage, setProfileSavedMessage] = useState<string | null>(null);

  const [activeYear, setActiveYear] = useState<AcademicYear | null>(null);
  const [journalCount, setJournalCount] = useState<number>(0);
  const [journalWithDocCount, setJournalWithDocCount] = useState<number>(0);
  const [activeScheduleCount, setActiveScheduleCount] = useState<number>(0);
  const [pendingUsersCount, setPendingUsersCount] = useState<number>(0);

  const isBootstrappedAdmin =
    firebaseUser?.email === BOOTSTRAPPED_ADMIN_EMAIL && firebaseUser.emailVerified;

  useEffect(() => {
    if (!firebaseUser || !profile) return;

    const isSchoolWide =
      profile.role === UserRole.ADMIN || profile.role === UserRole.KEPALA_SEKOLAH;

    const unsubYear = onSnapshot(
      query(collection(db, 'academicYears'), where('isActive', '==', true)),
      (snap) => {
        const first = snap.docs[0];
        setActiveYear(
          first ? { id: first.id, ...(first.data() as Omit<AcademicYear, 'id'>) } : null,
        );
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'academicYears');
      },
    );

    const journalsQuery = isSchoolWide
      ? collection(db, 'teachingJournals')
      : query(collection(db, 'teachingJournals'), where('teacherUid', '==', firebaseUser.uid));

    const unsubJournals = onSnapshot(
      journalsQuery,
      (snap) => {
        setJournalCount(snap.size);
        let withDoc = 0;
        snap.docs.forEach((docSnap) => {
          const data = docSnap.data() as { documentationUrl?: string };
          if (data.documentationUrl) {
            withDoc += 1;
          }
        });
        setJournalWithDocCount(withDoc);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'teachingJournals');
      },
    );

    let unsubSchedules: (() => void) | undefined;
    if (profile.role === UserRole.GURU) {
      unsubSchedules = onSnapshot(
        query(collection(db, 'schedules'), where('teacherUid', '==', firebaseUser.uid)),
        (snap) => {
          let activeCount = 0;
          snap.docs.forEach((docSnap) => {
            const data = docSnap.data() as { status?: string };
            if (data.status === EntityStatus.AKTIF) {
              activeCount += 1;
            }
          });
          setActiveScheduleCount(activeCount);
        },
        (error) => {
          handleFirestoreError(error, OperationType.LIST, 'schedules');
        },
      );
    }

    let unsubPendingUsers: (() => void) | undefined;
    if (isBootstrappedAdmin) {
      unsubPendingUsers = onSnapshot(
        query(collection(db, 'users'), where('approvalStatus', '==', ApprovalStatus.PENDING)),
        (snap) => {
          setPendingUsersCount(snap.size);
        },
        (error) => {
          handleFirestoreError(error, OperationType.LIST, 'users');
        },
      );
    }

    return () => {
      unsubYear();
      unsubJournals();
      unsubSchedules?.();
      unsubPendingUsers?.();
    };
  }, [firebaseUser, profile, isBootstrappedAdmin]);

  if (!profile) {
    return null;
  }

  const availableNav = NAV_ITEMS.filter((item) => item.roles.includes(profile.role));
  const currentItem = availableNav.find((item) => item.id === activeNav) ?? availableNav[0];

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    setProfileSavedMessage(null);
    try {
      await updateOwnProfile({
        displayName: editName,
        nip: editNip,
        jabatan: editJabatan,
      });
      setProfileSavedMessage('Perubahan profil berhasil disimpan ke Cloud Firestore.');
    } finally {
      setSavingProfile(false);
    }
  };

  const renderSidebarContent = () => (
    <div className="flex flex-col h-full bg-[#102D46] text-white">
      <div className="h-16 px-5 flex items-center justify-between border-b border-white/10 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <BrandMark variant="light" size={34} />
          <div className="min-w-0">
            <p className="text-sm font-bold tracking-tight text-white truncate">JPD-SMK</p>
            <p className="text-[11px] text-slate-300 truncate">SMKN 5 Tanjungpinang</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setMobileMenuOpen(false)}
          className="lg:hidden p-1.5 rounded-md text-slate-300 hover:text-white hover:bg-white/10 cursor-pointer"
          aria-label="Tutup menu navigasi"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1" aria-label="Menu Utama">
        {availableNav.map((item) => {
          const Icon = item.icon;
          const isActive = currentItem.id === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setActiveNav(item.id);
                setMobileMenuOpen(false);
                if (item.id === 'profil') {
                  setEditName(profile.displayName);
                  setEditNip(profile.nip);
                  setEditJabatan(profile.jabatan);
                  setProfileSavedMessage(null);
                }
              }}
              className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg text-sm transition-colors cursor-pointer ${
                isActive
                  ? 'bg-[#1C678A] text-white font-medium'
                  : 'text-slate-300 hover:text-white hover:bg-white/8'
              }`}
            >
              <span className="flex items-center gap-2.5 min-w-0">
                <Icon className="w-4 h-4 shrink-0" />
                <span className="truncate">{item.label}</span>
              </span>
              {item.id === 'persetujuan' && pendingUsersCount > 0 && (
                <span className="text-[11px] font-mono-tabular font-semibold px-1.5 py-0.5 rounded bg-[#16A6A0] text-white shrink-0">
                  {pendingUsersCount}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      <div className="p-4 border-t border-white/10 space-y-1 text-xs">
        <p className="font-medium text-white truncate">{profile.displayName}</p>
        <p className="text-slate-300 truncate">{ROLE_LABELS[profile.role]}</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F5F7FA] flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:block w-[264px] shrink-0 border-r border-slate-200 sticky top-0 h-screen print:hidden">
        {renderSidebarContent()}
      </aside>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex print:hidden">
          <div
            className="fixed inset-0 bg-[#102D46]/50"
            onClick={() => setMobileMenuOpen(false)}
            aria-hidden="true"
          />
          <aside className="relative w-72 max-w-[82vw] h-full z-10">
            {renderSidebarContent()}
          </aside>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between gap-4 sticky top-0 z-30 print:hidden">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 -ml-2 rounded-lg text-slate-700 hover:bg-slate-100 cursor-pointer"
              aria-label="Buka menu navigasi"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 text-sm min-w-0">
              <span className="font-semibold text-[#102D46] whitespace-nowrap">JPD-SMK</span>
              <span className="text-slate-400" aria-hidden="true">
                /
              </span>
              <span className="text-slate-600 truncate">{currentItem.label}</span>
            </div>
          </div>

          <div className="flex items-center gap-4 shrink-0">
            <div className="hidden sm:block text-right">
              <p className="text-xs font-semibold text-[#102D46] whitespace-nowrap">
                {profile.displayName}
              </p>
              <p className="text-[11px] text-slate-500 whitespace-nowrap">
                {ROLE_LABELS[profile.role]}
                {profile.jabatan ? ` · ${profile.jabatan}` : ''}
              </p>
            </div>
            <button
              type="button"
              onClick={() => void signOutUser()}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-medium text-[#102D46] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Keluar</span>
            </button>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-6xl w-full mx-auto space-y-6 print:p-0 print:max-w-none">
          {currentItem.id === 'ringkasan' && (
            <div className="space-y-6">
              {/* Welcome Surface */}
              <section className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div className="space-y-1.5">
                    <p className="text-xs font-semibold text-[#16A6A0] uppercase tracking-wider">
                      SMK Negeri 5 Tanjungpinang · Sistem Administrasi Pembelajaran
                    </p>
                    <h1 className="text-2xl font-bold tracking-tight text-[#102D46]">
                      Selamat Datang, {profile.displayName}
                    </h1>
                    <p className="text-sm text-slate-600 max-w-2xl leading-relaxed">
                      Anda masuk ke sistem <strong>JPD-SMK</strong> SMK Negeri 5 Tanjungpinang
                      dengan peran <strong>{ROLE_LABELS[profile.role]}</strong>. Seluruh modul
                      mulai dari Data Master, Jurnal Harian, Dokumentasi Mengajar, Monitoring Kepala
                      Sekolah, hingga Rekapitulasi Laporan kini telah aktif.
                    </p>
                  </div>

                  {profile.role === UserRole.ADMIN && (
                    <div className="flex flex-wrap items-center gap-2.5 self-start shrink-0">
                      <button
                        type="button"
                        onClick={() => setActiveNav('monitoring')}
                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#102D46] hover:bg-[#1C678A] text-white text-sm font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        <BarChart3 className="w-4 h-4" />
                        Monitoring Sekolah
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveNav('rekapitulasi')}
                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-[#102D46] text-sm font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        <FileSpreadsheet className="w-4 h-4" />
                        Rekap &amp; Laporan
                      </button>
                    </div>
                  )}

                  {profile.role === UserRole.KEPALA_SEKOLAH && (
                    <div className="flex flex-wrap items-center gap-2.5 self-start shrink-0">
                      <button
                        type="button"
                        onClick={() => setActiveNav('monitoring')}
                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#102D46] hover:bg-[#1C678A] text-white text-sm font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        <BarChart3 className="w-4 h-4" />
                        Buka Monitoring
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveNav('rekapitulasi')}
                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-[#102D46] text-sm font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        <FileSpreadsheet className="w-4 h-4" />
                        Rekapitulasi &amp; Laporan
                      </button>
                    </div>
                  )}

                  {profile.role === UserRole.GURU && (
                    <div className="flex flex-wrap items-center gap-2.5 self-start shrink-0">
                      <button
                        type="button"
                        onClick={() => setActiveNav('jurnal')}
                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#102D46] hover:bg-[#1C678A] text-white text-sm font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        <BookOpen className="w-4 h-4" />
                        Catat Jurnal Harian
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveNav('rekapitulasi')}
                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-[#102D46] text-sm font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        <FileSpreadsheet className="w-4 h-4" />
                        Rekap &amp; Laporan
                      </button>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-slate-200">
                  <div className="p-4 rounded-lg bg-[#F5F7FA] border border-slate-200 space-y-1.5">
                    <div className="flex items-center gap-2 text-xs font-semibold text-[#102D46]">
                      <CalendarDays className="w-4 h-4 text-[#16A6A0]" />
                      <span>Tahun Ajaran Aktif</span>
                    </div>
                    <p className="text-sm font-semibold text-[#102D46] font-mono-tabular">
                      {activeYear ? activeYear.name : 'Belum ditetapkan'}
                    </p>
                    <p className="text-xs text-slate-500 truncate">
                      {activeYear
                        ? `Semester ${SEMESTER_LABELS[activeYear.semester]}`
                        : 'Atur melalui Data Master Akademik'}
                    </p>
                  </div>

                  <div className="p-4 rounded-lg bg-[#F5F7FA] border border-slate-200 space-y-1.5">
                    <div className="flex items-center gap-2 text-xs font-semibold text-[#102D46]">
                      <BookOpen className="w-4 h-4 text-[#1C678A]" />
                      <span>
                        {profile.role === UserRole.GURU
                          ? 'Jurnal Mengajar Anda'
                          : 'Total Jurnal Sekolah'}
                      </span>
                    </div>
                    <p className="text-sm font-semibold text-[#102D46] font-mono-tabular">
                      {journalCount} Jurnal Tercatat
                    </p>
                    <p className="text-xs font-mono-tabular text-slate-500 truncate">
                      {profile.role === UserRole.GURU
                        ? `${activeScheduleCount} jadwal aktif · ${journalWithDocCount} terdokumentasi`
                        : `${journalWithDocCount} disertai dokumentasi kegiatan`}
                    </p>
                  </div>

                  <div className="p-4 rounded-lg bg-[#F5F7FA] border border-slate-200 space-y-1.5">
                    <div className="flex items-center gap-2 text-xs font-semibold text-[#102D46]">
                      <CheckCircle2 className="w-4 h-4 text-[#16A6A0]" />
                      <span>
                        {isBootstrappedAdmin && pendingUsersCount > 0
                          ? 'Antrean Persetujuan Akun'
                          : 'Identitas & Peran'}
                      </span>
                    </div>
                    {isBootstrappedAdmin && pendingUsersCount > 0 ? (
                      <>
                        <p className="text-sm font-semibold text-[#102D46] font-mono-tabular">
                          {pendingUsersCount} Akun Menunggu
                        </p>
                        <button
                          type="button"
                          onClick={() => setActiveNav('persetujuan')}
                          className="text-xs font-medium text-[#1C678A] hover:underline cursor-pointer"
                        >
                          Tinjau di Persetujuan Akun →
                        </button>
                      </>
                    ) : (
                      <>
                        <p className="text-sm font-semibold text-[#102D46]">
                          {ROLE_LABELS[profile.role]}
                        </p>
                        <p className="text-xs font-mono-tabular text-slate-500 truncate">
                          NIP: {profile.nip || 'Belum diisi'}
                        </p>
                      </>
                    )}
                  </div>
                </div>
              </section>

              {/* Active Modules Directory */}
              <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
                <div className="space-y-1">
                  <h2 className="text-base font-semibold text-[#102D46]">
                    Direktori Modul JPD-SMK
                  </h2>
                  <p className="text-sm text-slate-600">
                    Pilih modul operasional sesuai peran Anda di SMK Negeri 5 Tanjungpinang.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {availableNav
                    .filter((item) => item.id !== 'ringkasan')
                    .map((item) => {
                      const Icon = item.icon;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => setActiveNav(item.id)}
                          className="text-left p-4 rounded-lg border border-slate-200 hover:border-[#1C678A] bg-white hover:bg-[#F5F7FA]/60 transition-colors flex items-start gap-3.5 cursor-pointer"
                        >
                          <div className="w-9 h-9 rounded-lg bg-[#102D46]/5 flex items-center justify-center shrink-0 mt-0.5">
                            <Icon className="w-4 h-4 text-[#1C678A]" />
                          </div>
                          <div className="min-w-0 space-y-1">
                            <div className="flex items-center gap-2 text-xs text-slate-500">
                              <span className="font-semibold text-[#102D46] text-sm">
                                {item.label}
                              </span>
                              <span aria-hidden="true">·</span>
                              <span>{item.stageLabel}</span>
                            </div>
                            <p className="text-xs text-slate-600 leading-relaxed">
                              {item.plannedScope ??
                                'Pengelolaan akses dan profil pengguna sistem JPD-SMK.'}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                </div>
              </section>
            </div>
          )}

          {currentItem.id === 'persetujuan' && profile.role === UserRole.ADMIN && (
            <AdminApprovalPanel />
          )}

          {currentItem.id === 'master-data' && profile.role === UserRole.ADMIN && (
            <MasterDataHub />
          )}

          {currentItem.id === 'jadwal' && profile.role === UserRole.GURU && (
            <TeacherScheduleView />
          )}

          {currentItem.id === 'jurnal' &&
            (profile.role === UserRole.GURU || profile.role === UserRole.ADMIN) && (
              <DailyJournalWorkspace />
            )}

          {currentItem.id === 'dokumentasi' && <DocumentationGallery />}

          {currentItem.id === 'monitoring' &&
            (profile.role === UserRole.KEPALA_SEKOLAH || profile.role === UserRole.ADMIN) && (
              <PrincipalMonitoringDashboard />
            )}

          {currentItem.id === 'rekapitulasi' && <ReportsRecapWorkspace />}

          {currentItem.id === 'profil' && (
            <section className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 max-w-2xl space-y-6">
              <div className="space-y-1">
                <h1 className="text-lg font-semibold text-[#102D46]">Profil Akun Pengguna</h1>
                <p className="text-sm text-slate-600">
                  Perbarui data identitas kepegawaian Anda. Perubahan disimpan langsung ke Cloud
                  Firestore.
                </p>
              </div>

              {profileSavedMessage && (
                <div className="p-3.5 rounded-lg bg-emerald-50 border border-emerald-200 text-xs font-medium text-emerald-800">
                  {profileSavedMessage}
                </div>
              )}

              <form onSubmit={(e) => void handleSaveProfile(e)} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-medium text-slate-700">Email Google</label>
                    <input
                      type="email"
                      value={profile.email}
                      disabled
                      className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 bg-slate-50 text-sm font-mono-tabular text-slate-600"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-xs font-medium text-slate-700">Peran Aktif</label>
                    <input
                      type="text"
                      value={ROLE_LABELS[profile.role]}
                      disabled
                      className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 bg-slate-50 text-sm text-slate-600"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="prof-name" className="block text-xs font-medium text-slate-700">
                    Nama Lengkap dan Gelar
                  </label>
                  <input
                    id="prof-name"
                    type="text"
                    required
                    minLength={FIELD_LIMITS.displayNameMin}
                    maxLength={FIELD_LIMITS.displayNameMax}
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm text-[#102D46] focus:outline-none focus:border-[#1C678A]"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label htmlFor="prof-nip" className="block text-xs font-medium text-slate-700">
                      NIP / NUPTK
                    </label>
                    <input
                      id="prof-nip"
                      type="text"
                      maxLength={FIELD_LIMITS.nipMax}
                      value={editNip}
                      onChange={(e) => setEditNip(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm font-mono-tabular text-[#102D46] focus:outline-none focus:border-[#1C678A]"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label
                      htmlFor="prof-jabatan"
                      className="block text-xs font-medium text-slate-700"
                    >
                      Jabatan / Bidang Keahlian
                    </label>
                    <input
                      id="prof-jabatan"
                      type="text"
                      maxLength={FIELD_LIMITS.jabatanMax}
                      value={editJabatan}
                      onChange={(e) => setEditJabatan(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm text-[#102D46] focus:outline-none focus:border-[#1C678A]"
                    />
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={savingProfile}
                    className="px-5 py-2.5 rounded-lg bg-[#102D46] hover:bg-[#1C678A] disabled:opacity-65 text-white text-sm font-medium transition-colors cursor-pointer"
                  >
                    {savingProfile ? 'Menyimpan...' : 'Simpan Perubahan Profil'}
                  </button>
                </div>
              </form>
            </section>
          )}
        </main>
      </div>
    </div>
  );
}
