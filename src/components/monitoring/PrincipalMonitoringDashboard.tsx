import React, { useEffect, useMemo, useState } from 'react';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import {
  AlertCircle,
  BarChart3,
  BookOpen,
  CheckCircle2,
  ClipboardCheck,
  Pencil,
  Search,
  Trash2,
  Users,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { UserRole } from '../../types/auth';
import {
  TEACHING_STATUS_LABELS,
  TeachingStatus,
  type TeachingJournal,
} from '../../types/journal';
import {
  EntityStatus,
  SEMESTER_LABELS,
  type AcademicYear,
  type SchoolClass,
  type Teacher,
  type TeachingSchedule,
} from '../../types/masterData';
import {
  MONTH_YYYYMM_PATTERN,
  SUPERVISION_FIELD_LIMITS,
  SUPERVISION_STATUS_LABELS,
  SupervisionStatus,
  type PrincipalSupervision,
} from '../../types/monitoring';
import { JournalPhotoThumbnail } from '../journal/JournalPhotoPreview';

type PeriodPreset = 'TODAY' | 'LAST_7_DAYS' | 'MONTH' | 'ALL';

function formatDateYMD(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getTodayDateString(): string {
  return formatDateYMD(new Date());
}

function getCurrentMonthString(): string {
  return getTodayDateString().slice(0, 7);
}

function getLastNDaysDates(days: number): string[] {
  const result: string[] = [];
  const base = new Date();
  for (let i = days - 1; i >= 0; i -= 1) {
    const dt = new Date(base);
    dt.setDate(base.getDate() - i);
    result.push(formatDateYMD(dt));
  }
  return result;
}

export function PrincipalMonitoringDashboard() {
  const { firebaseUser, profile } = useAuth();
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [schedules, setSchedules] = useState<TeachingSchedule[]>([]);
  const [journals, setJournals] = useState<TeachingJournal[]>([]);
  const [supervisions, setSupervisions] = useState<PrincipalSupervision[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedYearId, setSelectedYearId] = useState<string>('ACTIVE');
  const [periodPreset, setPeriodPreset] = useState<PeriodPreset>('MONTH');
  const [selectedMonth, setSelectedMonth] = useState<string>(getCurrentMonthString);
  const [statusFilter, setStatusFilter] = useState<'ALL' | TeachingStatus>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [visibleJournalCount, setVisibleJournalCount] = useState(12);

  // Supervision form state
  const [editingSupervision, setEditingSupervision] = useState<PrincipalSupervision | null>(null);
  const [supTeacherKey, setSupTeacherKey] = useState('');
  const [supJournalId, setSupJournalId] = useState('');
  const [supPeriodMonth, setSupPeriodMonth] = useState(getCurrentMonthString);
  const [supStatus, setSupStatus] = useState<SupervisionStatus>(SupervisionStatus.BAIK);
  const [supNotes, setSupNotes] = useState('');
  const [savingSup, setSavingSup] = useState(false);
  const [supError, setSupError] = useState<string | null>(null);
  const [supNotice, setSupNotice] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [busyDeleteId, setBusyDeleteId] = useState<string | null>(null);

  const canAccess =
    profile?.role === UserRole.KEPALA_SEKOLAH || profile?.role === UserRole.ADMIN;

  useEffect(() => {
    if (!firebaseUser || !canAccess) {
      setLoading(false);
      return;
    }

    const unsubYears = onSnapshot(
      collection(db, 'academicYears'),
      (snap) => {
        const list = snap.docs
          .map((d) => ({ id: d.id, ...(d.data() as Omit<AcademicYear, 'id'>) }))
          .sort((a, b) => Number(b.isActive) - Number(a.isActive));
        setAcademicYears(list);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'academicYears'),
    );

    const unsubTeachers = onSnapshot(
      collection(db, 'teachers'),
      (snap) => {
        const list = snap.docs
          .map((d) => ({ id: d.id, ...(d.data() as Omit<Teacher, 'id'>) }))
          .sort((a, b) => a.fullName.localeCompare(b.fullName));
        setTeachers(list);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'teachers'),
    );

    const unsubClasses = onSnapshot(
      collection(db, 'classes'),
      (snap) => {
        const list = snap.docs
          .map((d) => ({ id: d.id, ...(d.data() as Omit<SchoolClass, 'id'>) }))
          .filter((c) => c.status === EntityStatus.AKTIF)
          .sort((a, b) => a.name.localeCompare(b.name));
        setClasses(list);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'classes'),
    );

    const unsubSchedules = onSnapshot(
      collection(db, 'schedules'),
      (snap) => {
        const list = snap.docs
          .map((d) => ({ id: d.id, ...(d.data() as Omit<TeachingSchedule, 'id'>) }))
          .filter((s) => s.status === EntityStatus.AKTIF);
        setSchedules(list);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'schedules'),
    );

    const unsubJournals = onSnapshot(
      collection(db, 'teachingJournals'),
      (snap) => {
        const list = snap.docs
          .map((d) => ({ id: d.id, ...(d.data() as Omit<TeachingJournal, 'id'>) }))
          .sort((a, b) => {
            const cmp = b.date.localeCompare(a.date);
            if (cmp !== 0) return cmp;
            return b.periodStart - a.periodStart;
          });
        setJournals(list);
        setLoading(false);
      },
      (error) => {
        setLoading(false);
        handleFirestoreError(error, OperationType.LIST, 'teachingJournals');
      },
    );

    const unsubSupervisions = onSnapshot(
      collection(db, 'supervisions'),
      (snap) => {
        const list = snap.docs
          .map((d) => ({ id: d.id, ...(d.data() as Omit<PrincipalSupervision, 'id'>) }))
          .sort((a, b) => {
            const aSec = a.createdAt?.seconds ?? 0;
            const bSec = b.createdAt?.seconds ?? 0;
            return bSec - aSec;
          });
        setSupervisions(list);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'supervisions'),
    );

    return () => {
      unsubYears();
      unsubTeachers();
      unsubClasses();
      unsubSchedules();
      unsubJournals();
      unsubSupervisions();
    };
  }, [firebaseUser, canAccess]);

  const activeYear = useMemo(
    () => academicYears.find((y) => y.isActive) ?? academicYears[0] ?? null,
    [academicYears],
  );

  const resolvedYearId = useMemo(() => {
    if (selectedYearId === 'ACTIVE') return activeYear?.id ?? 'ALL';
    return selectedYearId;
  }, [selectedYearId, activeYear]);

  const todayStr = getTodayDateString();
  const last7Days = useMemo(() => getLastNDaysDates(7), []);

  const periodJournals = useMemo(() => {
    return journals.filter((j) => {
      if (resolvedYearId !== 'ALL' && j.academicYearId !== resolvedYearId) return false;
      if (periodPreset === 'TODAY') return j.date === todayStr;
      if (periodPreset === 'LAST_7_DAYS') {
        const start = last7Days[0];
        return j.date >= start && j.date <= todayStr;
      }
      if (periodPreset === 'MONTH' && selectedMonth) {
        return j.date.startsWith(selectedMonth);
      }
      return true;
    });
  }, [journals, resolvedYearId, periodPreset, selectedMonth, todayStr, last7Days]);

  const filteredJournals = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return periodJournals.filter((j) => {
      if (statusFilter !== 'ALL' && j.teachingStatus !== statusFilter) return false;
      if (!q) return true;
      return (
        j.teacherName.toLowerCase().includes(q) ||
        j.className.toLowerCase().includes(q) ||
        j.subjectName.toLowerCase().includes(q) ||
        j.topic.toLowerCase().includes(q)
      );
    });
  }, [periodJournals, statusFilter, searchTerm]);

  // Build teacher roster combining master teachers (AKTIF) and journal submitters
  const teacherOptions = useMemo(() => {
    const map = new Map<string, { uid: string; name: string; specialty: string; hasSchedule: boolean }>();

    const relevantSchedules = schedules.filter(
      (s) => resolvedYearId === 'ALL' || s.academicYearId === resolvedYearId,
    );
    const scheduledUids = new Set(relevantSchedules.map((s) => s.teacherUid).filter(Boolean));
    const scheduledTeacherIds = new Set(relevantSchedules.map((s) => s.teacherId).filter(Boolean));

    teachers
      .filter((t) => t.status === EntityStatus.AKTIF)
      .forEach((t) => {
        const key = t.userUid || `teacher:${t.id}`;
        map.set(key, {
          uid: t.userUid,
          name: t.fullName,
          specialty: t.specialty || 'Guru Mata Pelajaran',
          hasSchedule: scheduledUids.has(t.userUid) || scheduledTeacherIds.has(t.id),
        });
      });

    periodJournals.forEach((j) => {
      if (!map.has(j.teacherUid)) {
        map.set(j.teacherUid, {
          uid: j.teacherUid,
          name: j.teacherName,
          specialty: 'Pengajar Tercatat',
          hasSchedule: scheduledUids.has(j.teacherUid),
        });
      }
    });

    return Array.from(map.entries()).map(([key, info]) => ({ key, ...info }));
  }, [teachers, schedules, periodJournals, resolvedYearId]);

  const teacherComplianceRows = useMemo(() => {
    return teacherOptions
      .map((t) => {
        const items = periodJournals.filter((j) =>
          t.uid ? j.teacherUid === t.uid : j.teacherName.toLowerCase() === t.name.toLowerCase(),
        );
        const totalJp = items.reduce(
          (acc, cur) => acc + Math.max(1, cur.periodEnd - cur.periodStart + 1),
          0,
        );
        const docsCount = items.filter((j) => Boolean(j.documentationUrl)).length;
        const presentSum = items.reduce((acc, cur) => acc + cur.presentCount, 0);
        const absentSum = items.reduce((acc, cur) => acc + cur.absentCount, 0);
        const totalStudents = presentSum + absentSum;
        const attendancePct =
          totalStudents > 0 ? Math.round((presentSum / totalStudents) * 100) : null;

        return {
          ...t,
          journalCount: items.length,
          totalJp,
          docsCount,
          attendancePct,
          lastDate: items[0]?.date ?? null,
        };
      })
      .sort((a, b) => {
        if (b.journalCount !== a.journalCount) return b.journalCount - a.journalCount;
        return a.name.localeCompare(b.name);
      });
  }, [teacherOptions, periodJournals]);

  const kpis = useMemo(() => {
    const total = periodJournals.length;
    const terlaksana = periodJournals.filter(
      (j) => j.teachingStatus === TeachingStatus.TERLAKSANA,
    ).length;
    const withDocs = periodJournals.filter((j) => Boolean(j.documentationUrl)).length;
    const docsPct = total > 0 ? Math.round((withDocs / total) * 100) : 0;

    const presentSum = periodJournals.reduce((acc, j) => acc + j.presentCount, 0);
    const absentSum = periodJournals.reduce((acc, j) => acc + j.absentCount, 0);
    const totalAttendance = presentSum + absentSum;
    const attendancePct =
      totalAttendance > 0 ? Math.round((presentSum / totalAttendance) * 100) : 0;

    const activeTeachersTotal = teacherComplianceRows.length;
    const activeTeachersReporting = teacherComplianceRows.filter((t) => t.journalCount > 0).length;
    const teacherCompliancePct =
      activeTeachersTotal > 0
        ? Math.round((activeTeachersReporting / activeTeachersTotal) * 100)
        : 0;

    const coveredClassIds = new Set(periodJournals.map((j) => j.classId));

    return {
      total,
      terlaksana,
      withDocs,
      docsPct,
      presentSum,
      absentSum,
      attendancePct,
      activeTeachersTotal,
      activeTeachersReporting,
      teacherCompliancePct,
      coveredClasses: coveredClassIds.size,
      totalClasses: classes.length,
    };
  }, [periodJournals, teacherComplianceRows, classes]);

  const dailySeries = useMemo(() => {
    const counts = last7Days.map((d) => ({
      date: d,
      label: d.slice(5),
      count: journals.filter(
        (j) =>
          j.date === d &&
          (resolvedYearId === 'ALL' || j.academicYearId === resolvedYearId),
      ).length,
    }));
    const maxCount = Math.max(1, ...counts.map((c) => c.count));
    return { counts, maxCount };
  }, [last7Days, journals, resolvedYearId]);

  const statusBreakdown = useMemo(() => {
    const total = Math.max(1, periodJournals.length);
    const terlaksana = periodJournals.filter(
      (j) => j.teachingStatus === TeachingStatus.TERLAKSANA,
    ).length;
    const mandiri = periodJournals.filter(
      (j) => j.teachingStatus === TeachingStatus.TUGAS_MANDIRI,
    ).length;
    const pengganti = periodJournals.filter(
      (j) => j.teachingStatus === TeachingStatus.PENGGANTI,
    ).length;
    return [
      {
        label: 'Terlaksana',
        count: terlaksana,
        pct: Math.round((terlaksana / total) * 100),
        barClass: 'bg-[#16A6A0]',
      },
      {
        label: 'Tugas Mandiri',
        count: mandiri,
        pct: Math.round((mandiri / total) * 100),
        barClass: 'bg-[#1C678A]',
      },
      {
        label: 'Kelas Pengganti',
        count: pengganti,
        pct: Math.round((pengganti / total) * 100),
        barClass: 'bg-[#102D46]',
      },
    ];
  }, [periodJournals]);

  const selectTeacherForSupervision = (
    teacherUid: string,
    teacherName: string,
    journalId = '',
  ) => {
    setEditingSupervision(null);
    setSupTeacherKey(teacherUid ? `uid:${teacherUid}` : `name:${teacherName}`);
    setSupJournalId(journalId);
    setSupError(null);
    setSupNotice(null);
    const target = document.getElementById('form-supervisi-kepsek');
    target?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const resetSupervisionForm = () => {
    setEditingSupervision(null);
    setSupTeacherKey('');
    setSupJournalId('');
    setSupPeriodMonth(getCurrentMonthString());
    setSupStatus(SupervisionStatus.BAIK);
    setSupNotes('');
    setSupError(null);
  };

  const startEditSupervision = (item: PrincipalSupervision) => {
    setEditingSupervision(item);
    setSupTeacherKey(item.teacherUid ? `uid:${item.teacherUid}` : `name:${item.teacherName}`);
    setSupJournalId(item.journalId);
    setSupPeriodMonth(item.periodMonth);
    setSupStatus(item.supervisionStatus);
    setSupNotes(item.notes);
    setSupError(null);
    setSupNotice(null);
  };

  const handleSaveSupervision = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firebaseUser || !profile) return;

    const chosenYear =
      academicYears.find((y) => y.id === resolvedYearId) ?? activeYear ?? academicYears[0];
    if (!chosenYear) {
      setSupError('Belum ada data Tahun Ajaran. Tambahkan Tahun Ajaran terlebih dahulu.');
      return;
    }

    let resolvedTeacherUid = '';
    let resolvedTeacherName = 'Umum / Lintas Guru';
    if (supTeacherKey.startsWith('uid:')) {
      resolvedTeacherUid = supTeacherKey.slice(4);
      const matched = teacherOptions.find((t) => t.uid === resolvedTeacherUid);
      resolvedTeacherName = matched?.name ?? 'Guru SMKN 5 Tanjungpinang';
    } else if (supTeacherKey.startsWith('name:')) {
      resolvedTeacherName = supTeacherKey.slice(5);
    }

    const cleanTeacherName = resolvedTeacherName
      .trim()
      .slice(0, SUPERVISION_FIELD_LIMITS.teacherNameMax);
    const cleanNotes = supNotes.trim().slice(0, SUPERVISION_FIELD_LIMITS.notesMax);
    const cleanSupervisorName = profile.displayName
      .trim()
      .slice(0, SUPERVISION_FIELD_LIMITS.supervisorNameMax);

    if (!MONTH_YYYYMM_PATTERN.test(supPeriodMonth)) {
      setSupError('Format bulan periode harus YYYY-MM (contoh: 2026-11).');
      return;
    }
    if (cleanTeacherName.length < SUPERVISION_FIELD_LIMITS.teacherNameMin) {
      setSupError('Nama sasaran guru minimal 2 karakter.');
      return;
    }
    if (cleanNotes.length < SUPERVISION_FIELD_LIMITS.notesMin) {
      setSupError(
        `Catatan supervisi minimal ${SUPERVISION_FIELD_LIMITS.notesMin} karakter.`,
      );
      return;
    }

    setSavingSup(true);
    setSupError(null);
    setSupNotice(null);

    const yearLabel = `${chosenYear.name} · ${SEMESTER_LABELS[chosenYear.semester]}`.slice(
      0,
      SUPERVISION_FIELD_LIMITS.academicYearLabelMax,
    );

    try {
      if (editingSupervision) {
        await updateDoc(doc(db, 'supervisions', editingSupervision.id), {
          academicYearLabel: yearLabel,
          teacherName: cleanTeacherName,
          periodMonth: supPeriodMonth,
          supervisionStatus: supStatus,
          notes: cleanNotes,
          supervisorName: cleanSupervisorName,
          updatedAt: serverTimestamp(),
        });
        setSupNotice('Catatan supervisi berhasil diperbarui.');
      } else {
        await addDoc(collection(db, 'supervisions'), {
          academicYearId: chosenYear.id,
          academicYearLabel: yearLabel,
          journalId: supJournalId,
          teacherUid: resolvedTeacherUid,
          teacherName: cleanTeacherName,
          periodMonth: supPeriodMonth,
          supervisionStatus: supStatus,
          notes: cleanNotes,
          supervisorUid: firebaseUser.uid,
          supervisorName: cleanSupervisorName,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        setSupNotice('Catatan supervisi Kepala Sekolah berhasil disimpan.');
      }
      resetSupervisionForm();
    } catch (error) {
      handleFirestoreError(
        error,
        editingSupervision ? OperationType.UPDATE : OperationType.CREATE,
        editingSupervision ? `supervisions/${editingSupervision.id}` : 'supervisions',
      );
    } finally {
      setSavingSup(false);
    }
  };

  const handleDeleteSupervision = async (id: string) => {
    setBusyDeleteId(id);
    try {
      await deleteDoc(doc(db, 'supervisions', id));
      setConfirmDeleteId(null);
      if (editingSupervision?.id === id) resetSupervisionForm();
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `supervisions/${id}`);
    } finally {
      setBusyDeleteId(null);
    }
  };

  if (!canAccess) {
    return (
      <section className="bg-white border border-slate-200 rounded-xl p-6 text-sm text-slate-600">
        Halaman Monitoring Kepala Sekolah hanya dapat diakses oleh Kepala Sekolah atau Administrator.
      </section>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header & Filter Bar */}
      <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <p className="text-xs font-semibold text-[#16A6A0] uppercase tracking-wider">
              SMK Negeri 5 Tanjungpinang · Monitoring Kepala Sekolah
            </p>
            <h1 className="text-xl font-bold tracking-tight text-[#102D46]">
              Dashboard Pemantauan Pembelajaran
            </h1>
            <p className="text-sm text-slate-600">
              Evaluasi kepatuhan jurnal harian guru, kehadiran siswa, dokumentasi mengajar, dan catatan supervisi SMK Negeri 5 Tanjungpinang.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <select
              aria-label="Filter Tahun Ajaran"
              value={selectedYearId}
              onChange={(e) => setSelectedYearId(e.target.value)}
              className="px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs font-medium text-[#102D46]"
            >
              {activeYear && (
                <option value="ACTIVE">
                  Aktif: {activeYear.name} ({SEMESTER_LABELS[activeYear.semester]})
                </option>
              )}
              <option value="ALL">Semua Tahun Ajaran</option>
              {academicYears.map((y) => (
                <option key={y.id} value={y.id}>
                  {y.name} · {SEMESTER_LABELS[y.semester]}
                </option>
              ))}
            </select>

            <div className="flex items-center gap-1 p-1 bg-[#F5F7FA] border border-slate-200 rounded-lg">
              {(
                [
                  { key: 'TODAY', label: 'Hari Ini' },
                  { key: 'LAST_7_DAYS', label: '7 Hari' },
                  { key: 'MONTH', label: 'Bulanan' },
                  { key: 'ALL', label: 'Semester' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setPeriodPreset(tab.key)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    periodPreset === tab.key
                      ? 'bg-white text-[#102D46] border border-slate-200'
                      : 'text-slate-600 hover:text-[#102D46]'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {periodPreset === 'MONTH' && (
              <input
                type="month"
                aria-label="Pilih bulan pemantauan"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-mono-tabular text-[#102D46]"
              />
            )}
          </div>
        </div>

        {/* 4-Column KPI Strip */}
        {loading ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 pt-3 border-t border-slate-200">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-24 bg-slate-100 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 pt-3 border-t border-slate-200">
            <div className="p-4 rounded-lg bg-[#F5F7FA] border border-slate-200 space-y-1">
              <p className="text-xs text-slate-500">Jurnal Pada Periode</p>
              <p className="text-2xl font-bold font-mono-tabular text-[#102D46]">{kpis.total}</p>
              <p className="text-[11px] font-mono-tabular text-slate-600">
                {kpis.terlaksana} terlaksana · {kpis.coveredClasses}/{kpis.totalClasses || 0} kelas
              </p>
            </div>

            <div className="p-4 rounded-lg bg-[#F5F7FA] border border-slate-200 space-y-1">
              <p className="text-xs text-slate-500">Kepatuhan Pengisian Guru</p>
              <p className="text-2xl font-bold font-mono-tabular text-[#1C678A]">
                {kpis.teacherCompliancePct}%
              </p>
              <p className="text-[11px] font-mono-tabular text-slate-600">
                {kpis.activeTeachersReporting} dari {kpis.activeTeachersTotal} guru aktif
              </p>
            </div>

            <div className="p-4 rounded-lg bg-[#F5F7FA] border border-slate-200 space-y-1">
              <p className="text-xs text-slate-500">Rata-Rata Kehadiran Siswa</p>
              <p className="text-2xl font-bold font-mono-tabular text-[#16A6A0]">
                {kpis.attendancePct}%
              </p>
              <p className="text-[11px] font-mono-tabular text-slate-600">
                {kpis.presentSum} hadir · {kpis.absentSum} absen
              </p>
            </div>

            <div className="p-4 rounded-lg bg-[#F5F7FA] border border-slate-200 space-y-1">
              <p className="text-xs text-slate-500">Kelengkapan Dokumentasi</p>
              <p className="text-2xl font-bold font-mono-tabular text-[#102D46]">{kpis.docsPct}%</p>
              <p className="text-[11px] font-mono-tabular text-slate-600">
                {kpis.withDocs} entri melampirkan bukti
              </p>
            </div>
          </div>
        )}
      </section>

      {/* Two-Column Analytics & Compliance */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Daily Activity + Execution Breakdown */}
        <section className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-5 sm:p-6 space-y-5">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-semibold text-[#102D46]">
                Tren Aktivitas 7 Hari Terakhir
              </h2>
              <p className="text-xs text-slate-500">Jumlah jurnal masuk harian lintas guru</p>
            </div>
            <BarChart3 className="w-4 h-4 text-[#1C678A]" />
          </div>

          <div className="grid grid-cols-7 gap-2 items-end h-36 pt-4 border-b border-slate-200 pb-2">
            {dailySeries.counts.map((bar) => {
              const heightPct = Math.max(8, Math.round((bar.count / dailySeries.maxCount) * 100));
              return (
                <div key={bar.date} className="flex flex-col items-center gap-1.5 h-full justify-end">
                  <span className="text-[11px] font-mono-tabular font-semibold text-[#102D46]">
                    {bar.count}
                  </span>
                  <div className="w-full max-w-[32px] bg-[#F5F7FA] rounded-t flex items-end h-20 overflow-hidden">
                    <div
                      className={`w-full rounded-t transition-all ${
                        bar.count > 0 ? 'bg-[#1C678A]' : 'bg-slate-200'
                      }`}
                      style={{ height: `${heightPct}%` }}
                    />
                  </div>
                  <span className="text-[10px] font-mono-tabular text-slate-500">{bar.label}</span>
                </div>
              );
            })}
          </div>

          <div className="space-y-3">
            <h3 className="text-xs font-semibold text-[#102D46] uppercase tracking-wider">
              Distribusi Status Pelaksanaan
            </h3>
            <div className="space-y-2.5">
              {statusBreakdown.map((item) => (
                <div key={item.label} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-700 font-medium">{item.label}</span>
                    <span className="font-mono-tabular text-slate-600">
                      {item.count} ({item.pct}%)
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${item.barClass}`}
                      style={{ width: `${item.pct}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Teacher Compliance Table */}
        <section className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-5 sm:p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-semibold text-[#102D46]">
                Kepatuhan Pengisian Jurnal per Guru
              </h2>
              <p className="text-xs text-slate-500">
                Pemantauan keaktifan pengajar berdasarkan periode filter yang dipilih
              </p>
            </div>
            <div className="flex items-center gap-1.5 text-xs font-mono-tabular text-slate-600">
              <Users className="w-4 h-4 text-[#1C678A]" />
              <span>{teacherComplianceRows.length} Guru</span>
            </div>
          </div>

          {teacherComplianceRows.length === 0 ? (
            <div className="py-10 text-center border border-dashed border-slate-200 rounded-lg space-y-1.5">
              <p className="text-sm font-medium text-[#102D46]">Belum ada data guru terdaftar</p>
              <p className="text-xs text-slate-500">
                Data guru akan muncul setelah Administrator mengisi Data Master Guru atau guru mencatat jurnal.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto border border-slate-200 rounded-lg">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-[#F5F7FA] border-b border-slate-200 text-slate-600">
                    <th className="py-2.5 px-3 font-semibold">Nama Guru</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Jurnal</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Total JP</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Dok.</th>
                    <th className="py-2.5 px-3 font-semibold">Status</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {teacherComplianceRows.map((row) => (
                    <tr key={row.key} className="hover:bg-slate-50/70">
                      <td className="py-2.5 px-3">
                        <p className="font-medium text-[#102D46]">{row.name}</p>
                        <p className="text-[11px] text-slate-500">
                          {row.specialty}
                          {row.lastDate ? ` · Terakhir ${row.lastDate}` : ''}
                        </p>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono-tabular font-semibold text-[#102D46]">
                        {row.journalCount}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono-tabular text-slate-700">
                        {row.totalJp}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono-tabular text-slate-700">
                        {row.docsCount}
                      </td>
                      <td className="py-2.5 px-3">
                        {row.journalCount > 0 ? (
                          <span className="inline-flex items-center gap-1 text-emerald-700 font-medium whitespace-nowrap">
                            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                            <span>Aktif Mengisi</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-amber-700 font-medium whitespace-nowrap">
                            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                            <span>Belum Ada Entri</span>
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <button
                          type="button"
                          onClick={() => selectTeacherForSupervision(row.uid, row.name)}
                          className="text-xs font-medium text-[#1C678A] hover:underline whitespace-nowrap cursor-pointer"
                        >
                          Supervisi
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      {/* Cross-Teacher Journal Inspection */}
      <section className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-[#102D46]">
              Pemantauan Jurnal Pembelajaran Lintas Guru
            </h2>
            <p className="text-xs text-slate-500">
              Menampilkan {filteredJournals.length} catatan sesuai filter periode dan status
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <select
              aria-label="Filter status pelaksanaan"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as 'ALL' | TeachingStatus)}
              className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs text-[#102D46]"
            >
              <option value="ALL">Semua Status</option>
              <option value={TeachingStatus.TERLAKSANA}>Terlaksana</option>
              <option value={TeachingStatus.TUGAS_MANDIRI}>Tugas Mandiri</option>
              <option value={TeachingStatus.PENGGANTI}>Kelas Pengganti</option>
            </select>

            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="search"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Cari guru, kelas, mapel, materi..."
                className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-slate-300 text-xs text-[#102D46]"
              />
            </div>
          </div>
        </div>

        {filteredJournals.length === 0 ? (
          <div className="py-10 text-center border border-dashed border-slate-200 rounded-lg space-y-1.5">
            <BookOpen className="w-6 h-6 text-slate-400 mx-auto" />
            <p className="text-sm font-medium text-[#102D46]">
              Tidak ada jurnal pada filter periode ini
            </p>
            <p className="text-xs text-slate-500">
              Coba ubah rentang waktu ke &ldquo;Semester&rdquo; atau hapus kata kunci pencarian.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="divide-y divide-slate-200 border border-slate-200 rounded-lg">
              {filteredJournals.slice(0, visibleJournalCount).map((item) => (
                <article
                  key={item.id}
                  className="p-4 flex flex-col sm:flex-row sm:items-start justify-between gap-4 hover:bg-slate-50/60"
                >
                  <div className="space-y-1.5 min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 font-mono-tabular">
                      <span className="font-semibold text-[#1C678A]">{item.date}</span>
                      <span aria-hidden="true">·</span>
                      <span>
                        Jam {item.periodStart}–{item.periodEnd}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="font-sans font-semibold text-[#102D46]">
                        {item.teacherName}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="font-sans font-medium text-[#102D46]">
                        {item.className}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="font-sans text-[#16A6A0] font-medium">
                        {TEACHING_STATUS_LABELS[item.teachingStatus]}
                      </span>
                    </div>

                    <p className="text-sm font-semibold text-[#102D46]">
                      {item.subjectName} — {item.topic}
                    </p>
                    <p className="text-xs text-slate-600 leading-relaxed line-clamp-2">
                      {item.activities}
                    </p>
                    <div className="flex flex-wrap items-center gap-3 text-[11px] font-mono-tabular text-slate-500">
                      <span>
                        Hadir: {item.presentCount} · Absen: {item.absentCount}
                      </span>
                      {item.notes && (
                        <span className="font-sans text-slate-600">Catatan: {item.notes}</span>
                      )}
                    </div>
                  </div>

                  <div className="flex sm:flex-col items-center sm:items-end justify-between gap-2.5 shrink-0">
                    {item.documentationUrl && (
                      <div className="w-16 h-12 rounded-md overflow-hidden border border-slate-200 bg-slate-100 shrink-0">
                        <JournalPhotoThumbnail
                          url={item.documentationUrl}
                          caption={item.documentationCaption || item.topic}
                          alt={item.documentationCaption || item.topic}
                          className="w-full h-full"
                        />
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() =>
                        selectTeacherForSupervision(item.teacherUid, item.teacherName, item.id)
                      }
                      className="text-xs font-medium text-[#1C678A] hover:underline whitespace-nowrap cursor-pointer"
                    >
                      Beri Catatan Supervisi
                    </button>
                  </div>
                </article>
              ))}
            </div>

            {filteredJournals.length > visibleJournalCount && (
              <div className="text-center">
                <button
                  type="button"
                  onClick={() => setVisibleJournalCount((prev) => prev + 12)}
                  className="px-4 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-medium text-[#102D46] cursor-pointer"
                >
                  Tampilkan Lebih Banyak ({filteredJournals.length - visibleJournalCount} tersisa)
                </button>
              </div>
            )}
          </div>
        )}
      </section>

      {/* Principal Supervision Notes (Persisted in /supervisions) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <form
          id="form-supervisi-kepsek"
          onSubmit={(e) => void handleSaveSupervision(e)}
          className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-5 sm:p-6 space-y-4"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <ClipboardCheck className="w-4 h-4 text-[#16A6A0]" />
              <h2 className="text-base font-semibold text-[#102D46]">
                {editingSupervision ? 'Ubah Catatan Supervisi' : 'Catat Supervisi Pembelajaran'}
              </h2>
            </div>
            {editingSupervision && (
              <button
                type="button"
                onClick={resetSupervisionForm}
                className="text-xs text-slate-500 hover:text-[#102D46] cursor-pointer"
              >
                Batal
              </button>
            )}
          </div>

          {supNotice && (
            <p className="text-xs font-medium text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg p-3">
              {supNotice}
            </p>
          )}

          {supError && (
            <p className="text-xs text-red-800 bg-red-50 border border-red-200 rounded-lg p-3">
              {supError}
            </p>
          )}

          <div className="space-y-1.5">
            <label htmlFor="sup-teacher" className="block text-xs font-medium text-slate-700">
              Sasaran Guru / Lingkup Supervisi
            </label>
            <select
              id="sup-teacher"
              value={supTeacherKey}
              onChange={(e) => {
                setSupTeacherKey(e.target.value);
                if (!e.target.value) setSupJournalId('');
              }}
              disabled={Boolean(editingSupervision)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm text-[#102D46] disabled:bg-slate-50"
            >
              <option value="">Umum / Lintas Guru SMKN 5</option>
              {teacherOptions.map((t) => {
                const value = t.uid ? `uid:${t.uid}` : `name:${t.name}`;
                return (
                  <option key={t.key} value={value}>
                    {t.name} ({t.specialty})
                  </option>
                );
              })}
            </select>
            {supJournalId && (
              <p className="text-[11px] font-mono-tabular text-[#1C678A]">
                Terhubung langsung ke ID Jurnal: {supJournalId.slice(0, 12)}...
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label htmlFor="sup-month" className="block text-xs font-medium text-slate-700">
                Bulan Periode
              </label>
              <input
                id="sup-month"
                type="month"
                required
                value={supPeriodMonth}
                onChange={(e) => setSupPeriodMonth(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm font-mono-tabular text-[#102D46]"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="sup-status" className="block text-xs font-medium text-slate-700">
                Hasil / Status Pembinaan
              </label>
              <select
                id="sup-status"
                value={supStatus}
                onChange={(e) => setSupStatus(e.target.value as SupervisionStatus)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm text-[#102D46]"
              >
                <option value={SupervisionStatus.BAIK}>Baik / Sesuai Standar</option>
                <option value={SupervisionStatus.PERLU_PEMBINAAN}>Perlu Pembinaan</option>
                <option value={SupervisionStatus.TINDAK_LANJUT}>Tindak Lanjut Segera</option>
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="sup-notes" className="block text-xs font-medium text-slate-700">
              Catatan Supervisi & Rekomendasi <span className="text-red-600">*</span>
            </label>
            <textarea
              id="sup-notes"
              rows={4}
              required
              minLength={SUPERVISION_FIELD_LIMITS.notesMin}
              maxLength={SUPERVISION_FIELD_LIMITS.notesMax}
              value={supNotes}
              onChange={(e) => setSupNotes(e.target.value)}
              placeholder="Tuliskan umpan balik pelaksanaan pembelajaran, ketertiban dokumentasi, atau arahan tindak lanjut..."
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm text-[#102D46]"
            />
          </div>

          <button
            type="submit"
            disabled={savingSup}
            className="w-full px-4 py-2.5 rounded-lg bg-[#102D46] hover:bg-[#1C678A] disabled:opacity-65 text-white text-sm font-medium transition-colors cursor-pointer"
          >
            {savingSup
              ? 'Menyimpan Catatan...'
              : editingSupervision
                ? 'Simpan Perubahan Supervisi'
                : 'Simpan Catatan Supervisi'}
          </button>
        </form>

        <section className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-semibold text-[#102D46]">
                Riwayat Catatan Supervisi Kepala Sekolah
              </h2>
              <p className="text-xs text-slate-500">
                Tersimpan di Cloud Firestore dan dapat dilihat oleh guru sasaran terkait
              </p>
            </div>
            <span className="text-xs font-mono-tabular text-slate-500">
              {supervisions.length} catatan
            </span>
          </div>

          {supervisions.length === 0 ? (
            <div className="py-10 text-center border border-dashed border-slate-200 rounded-lg space-y-1.5">
              <ClipboardCheck className="w-6 h-6 text-slate-400 mx-auto" />
              <p className="text-sm font-medium text-[#102D46]">Belum ada catatan supervisi</p>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Tambahkan catatan evaluasi atau pembinaan pembelajaran melalui formulir di samping.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-200 border border-slate-200 rounded-lg">
              {supervisions.map((sup) => (
                <article key={sup.id} className="p-4 space-y-2 hover:bg-slate-50/50">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-0.5">
                      <div className="flex flex-wrap items-center gap-2 text-xs font-mono-tabular text-slate-500">
                        <span className="font-semibold text-[#1C678A]">{sup.periodMonth}</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-sans font-semibold text-[#102D46]">
                          {sup.teacherName}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span
                          className={`font-sans font-medium ${
                            sup.supervisionStatus === SupervisionStatus.BAIK
                              ? 'text-emerald-700'
                              : sup.supervisionStatus === SupervisionStatus.PERLU_PEMBINAAN
                                ? 'text-amber-700'
                                : 'text-red-700'
                          }`}
                        >
                          {SUPERVISION_STATUS_LABELS[sup.supervisionStatus]}
                        </span>
                      </div>
                      <p className="text-xs text-slate-700 leading-relaxed pt-1">{sup.notes}</p>
                      <p className="text-[11px] text-slate-500">
                        Supervisor: {sup.supervisorName} · {sup.academicYearLabel}
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {confirmDeleteId === sup.id ? (
                        <>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(null)}
                            className="text-xs text-slate-600 px-2 py-1 cursor-pointer"
                          >
                            Batal
                          </button>
                          <button
                            type="button"
                            disabled={busyDeleteId === sup.id}
                            onClick={() => void handleDeleteSupervision(sup.id)}
                            className="px-2.5 py-1 rounded bg-red-700 text-white text-xs font-medium cursor-pointer"
                          >
                            Hapus
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => startEditSupervision(sup)}
                            className="p-1.5 rounded border border-slate-200 text-slate-600 hover:text-[#102D46] hover:bg-white cursor-pointer"
                            aria-label={`Ubah supervisi ${sup.teacherName}`}
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(sup.id)}
                            className="p-1.5 rounded border border-slate-200 text-slate-600 hover:text-red-700 hover:border-red-200 cursor-pointer"
                            aria-label={`Hapus supervisi ${sup.teacherName}`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
