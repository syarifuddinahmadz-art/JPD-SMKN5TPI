import { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { Download, Eye, FileDown, FileSpreadsheet, Printer, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { generateAcademicReportPdf } from '../../lib/reportPdf';
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
  type Subject,
} from '../../types/masterData';

type ReportPeriodMode = 'MONTH' | 'RANGE' | 'SEMESTER';
type ReportTab = 'BY_TEACHER_OR_SUBJECT' | 'BY_CLASS' | 'DETAIL';

function getTodayDateString(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getMonthStartString(monthStr: string): string {
  return `${monthStr}-01`;
}

function escapeCsvCell(value: string | number): string {
  const str = String(value ?? '');
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function formatDayNameIndonesian(dateStr: string): string {
  const parts = dateStr.split('-').map(Number);
  if (parts.length !== 3) return '-';
  const dt = new Date(parts[0], parts[1] - 1, parts[2]);
  const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  return days[dt.getDay()] ?? '-';
}

export function ReportsRecapWorkspace() {
  const { firebaseUser, profile } = useAuth();
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [journals, setJournals] = useState<TeachingJournal[]>([]);
  const [loading, setLoading] = useState(true);

  const today = getTodayDateString();
  const currentMonth = today.slice(0, 7);

  const [selectedYearId, setSelectedYearId] = useState<string>('ACTIVE');
  const [periodMode, setPeriodMode] = useState<ReportPeriodMode>('MONTH');
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonth);
  const [rangeStart, setRangeStart] = useState<string>(getMonthStartString(currentMonth));
  const [rangeEnd, setRangeEnd] = useState<string>(today);
  const [selectedTeacherUid, setSelectedTeacherUid] = useState<string>('ALL');
  const [selectedClassId, setSelectedClassId] = useState<string>('ALL');
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<'ALL' | TeachingStatus>('ALL');
  const [activeTab, setActiveTab] = useState<ReportTab>('BY_TEACHER_OR_SUBJECT');
  const [previewOpen, setPreviewOpen] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [pdfNotice, setPdfNotice] = useState<{ fileName: string; url: string } | null>(null);
  const [printFallbackHint, setPrintFallbackHint] = useState(false);

  useEffect(() => {
    return () => {
      if (pdfNotice?.url) {
        URL.revokeObjectURL(pdfNotice.url);
      }
    };
  }, [pdfNotice]);

  const isSchoolWideRole =
    profile?.role === UserRole.ADMIN || profile?.role === UserRole.KEPALA_SEKOLAH;

  useEffect(() => {
    if (!firebaseUser || !profile) {
      setLoading(false);
      return;
    }

    const yearsQuery = isSchoolWideRole
      ? collection(db, 'academicYears')
      : query(collection(db, 'academicYears'), where('isActive', '==', true));

    const unsubYears = onSnapshot(
      yearsQuery,
      (snap) => {
        const list = snap.docs
          .map((d) => ({ id: d.id, ...(d.data() as Omit<AcademicYear, 'id'>) }))
          .sort((a, b) => Number(b.isActive) - Number(a.isActive));
        setAcademicYears(list);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'academicYears'),
    );

    const classesQuery = isSchoolWideRole
      ? collection(db, 'classes')
      : query(collection(db, 'classes'), where('status', '==', EntityStatus.AKTIF));

    const unsubClasses = onSnapshot(
      classesQuery,
      (snap) => {
        const list = snap.docs
          .map((d) => ({ id: d.id, ...(d.data() as Omit<SchoolClass, 'id'>) }))
          .sort((a, b) => a.name.localeCompare(b.name));
        setClasses(list);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'classes'),
    );

    const subjectsQuery = isSchoolWideRole
      ? collection(db, 'subjects')
      : query(collection(db, 'subjects'), where('status', '==', EntityStatus.AKTIF));

    const unsubSubjects = onSnapshot(
      subjectsQuery,
      (snap) => {
        const list = snap.docs
          .map((d) => ({ id: d.id, ...(d.data() as Omit<Subject, 'id'>) }))
          .sort((a, b) => a.name.localeCompare(b.name));
        setSubjects(list);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'subjects'),
    );

    const journalsQuery = isSchoolWideRole
      ? collection(db, 'teachingJournals')
      : query(collection(db, 'teachingJournals'), where('teacherUid', '==', firebaseUser.uid));

    const unsubJournals = onSnapshot(
      journalsQuery,
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

    return () => {
      unsubYears();
      unsubClasses();
      unsubSubjects();
      unsubJournals();
    };
  }, [firebaseUser, profile, isSchoolWideRole]);

  const activeYear = useMemo(
    () => academicYears.find((y) => y.isActive) ?? academicYears[0] ?? null,
    [academicYears],
  );

  const resolvedYearId = useMemo(() => {
    if (selectedYearId === 'ACTIVE') return activeYear?.id ?? 'ALL';
    return selectedYearId;
  }, [selectedYearId, activeYear]);

  const teacherFilterOptions = useMemo(() => {
    const map = new Map<string, string>();
    journals.forEach((j) => {
      if (!map.has(j.teacherUid)) {
        map.set(j.teacherUid, j.teacherName);
      }
    });
    return Array.from(map.entries())
      .map(([uid, name]) => ({ uid, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [journals]);

  const filteredJournals = useMemo(() => {
    return journals.filter((j) => {
      if (resolvedYearId !== 'ALL' && j.academicYearId !== resolvedYearId) return false;
      if (periodMode === 'MONTH' && selectedMonth && !j.date.startsWith(selectedMonth)) {
        return false;
      }
      if (periodMode === 'RANGE') {
        if (rangeStart && j.date < rangeStart) return false;
        if (rangeEnd && j.date > rangeEnd) return false;
      }
      if (isSchoolWideRole && selectedTeacherUid !== 'ALL' && j.teacherUid !== selectedTeacherUid) {
        return false;
      }
      if (selectedClassId !== 'ALL' && j.classId !== selectedClassId) return false;
      if (selectedSubjectId !== 'ALL' && j.subjectId !== selectedSubjectId) return false;
      if (selectedStatus !== 'ALL' && j.teachingStatus !== selectedStatus) return false;
      return true;
    });
  }, [
    journals,
    resolvedYearId,
    periodMode,
    selectedMonth,
    rangeStart,
    rangeEnd,
    isSchoolWideRole,
    selectedTeacherUid,
    selectedClassId,
    selectedSubjectId,
    selectedStatus,
  ]);

  const summary = useMemo(() => {
    const totalMeetings = filteredJournals.length;
    const totalJp = filteredJournals.reduce(
      (acc, cur) => acc + Math.max(1, cur.periodEnd - cur.periodStart + 1),
      0,
    );
    const presentSum = filteredJournals.reduce((acc, cur) => acc + cur.presentCount, 0);
    const absentSum = filteredJournals.reduce((acc, cur) => acc + cur.absentCount, 0);
    const totalAttendance = presentSum + absentSum;
    const attendancePct =
      totalAttendance > 0 ? Math.round((presentSum / totalAttendance) * 100) : 0;
    const docsCount = filteredJournals.filter((j) => Boolean(j.documentationUrl)).length;
    return {
      totalMeetings,
      totalJp,
      presentSum,
      absentSum,
      attendancePct,
      docsCount,
    };
  }, [filteredJournals]);

  const primaryGroupingRows = useMemo(() => {
    const map = new Map<
      string,
      {
        key: string;
        title: string;
        subtitle: string;
        meetings: number;
        terlaksana: number;
        mandiri: number;
        pengganti: number;
        totalJp: number;
        docsCount: number;
        presentSum: number;
        absentSum: number;
      }
    >();

    filteredJournals.forEach((j) => {
      const key = isSchoolWideRole ? j.teacherUid : j.subjectId;
      const title = isSchoolWideRole ? j.teacherName : j.subjectName;
      const existing = map.get(key) ?? {
        key,
        title,
        subtitle: isSchoolWideRole ? j.academicYearLabel : j.className,
        meetings: 0,
        terlaksana: 0,
        mandiri: 0,
        pengganti: 0,
        totalJp: 0,
        docsCount: 0,
        presentSum: 0,
        absentSum: 0,
      };
      existing.meetings += 1;
      if (j.teachingStatus === TeachingStatus.TERLAKSANA) existing.terlaksana += 1;
      if (j.teachingStatus === TeachingStatus.TUGAS_MANDIRI) existing.mandiri += 1;
      if (j.teachingStatus === TeachingStatus.PENGGANTI) existing.pengganti += 1;
      existing.totalJp += Math.max(1, j.periodEnd - j.periodStart + 1);
      if (j.documentationUrl) existing.docsCount += 1;
      existing.presentSum += j.presentCount;
      existing.absentSum += j.absentCount;
      map.set(key, existing);
    });

    return Array.from(map.values()).sort((a, b) => b.meetings - a.meetings);
  }, [filteredJournals, isSchoolWideRole]);

  const classGroupingRows = useMemo(() => {
    const map = new Map<
      string,
      {
        classId: string;
        className: string;
        meetings: number;
        totalJp: number;
        docsCount: number;
        presentSum: number;
        absentSum: number;
        subjectsCount: number;
        subjectIds: Set<string>;
      }
    >();

    filteredJournals.forEach((j) => {
      const existing = map.get(j.classId) ?? {
        classId: j.classId,
        className: j.className,
        meetings: 0,
        totalJp: 0,
        docsCount: 0,
        presentSum: 0,
        absentSum: 0,
        subjectsCount: 0,
        subjectIds: new Set<string>(),
      };
      existing.meetings += 1;
      existing.totalJp += Math.max(1, j.periodEnd - j.periodStart + 1);
      if (j.documentationUrl) existing.docsCount += 1;
      existing.presentSum += j.presentCount;
      existing.absentSum += j.absentCount;
      existing.subjectIds.add(j.subjectId);
      existing.subjectsCount = existing.subjectIds.size;
      map.set(j.classId, existing);
    });

    return Array.from(map.values()).sort((a, b) => a.className.localeCompare(b.className));
  }, [filteredJournals]);

  const periodDescription = useMemo(() => {
    if (periodMode === 'MONTH') return `Bulan ${selectedMonth}`;
    if (periodMode === 'RANGE') return `${rangeStart} s/d ${rangeEnd}`;
    const yr = academicYears.find((y) => y.id === resolvedYearId) ?? activeYear;
    return yr ? `Semester ${yr.name} (${SEMESTER_LABELS[yr.semester]})` : 'Semua Periode';
  }, [periodMode, selectedMonth, rangeStart, rangeEnd, academicYears, resolvedYearId, activeYear]);

  const handleDownloadCsv = () => {
    const headers = [
      'No',
      'Tanggal',
      'Hari',
      'Jam Pelajaran',
      'Jumlah JP',
      'Nama Guru',
      'Kelas',
      'Mata Pelajaran',
      'Status Pelaksanaan',
      'Siswa Hadir',
      'Siswa Absen',
      'Materi Pokok',
      'Ringkasan Kegiatan',
      'Catatan Kendala',
      'Status Dokumentasi',
      'Keterangan Dokumentasi',
    ];

    const rows = filteredJournals.map((j, idx) => {
      const jpCount = Math.max(1, j.periodEnd - j.periodStart + 1);
      const docStatus = j.documentationUrl
        ? j.documentationUrl.startsWith('firestore-photo://')
          ? 'Terlampir (Foto Sistem)'
          : j.documentationUrl
        : 'Tidak Ada';
      return [
        idx + 1,
        j.date,
        formatDayNameIndonesian(j.date),
        `Jam ${j.periodStart}-${j.periodEnd}`,
        jpCount,
        j.teacherName,
        j.className,
        j.subjectName,
        TEACHING_STATUS_LABELS[j.teachingStatus],
        j.presentCount,
        j.absentCount,
        j.topic,
        j.activities,
        j.notes,
        docStatus,
        j.documentationCaption,
      ]
        .map(escapeCsvCell)
        .join(',');
    });

    const csvContent = `\uFEFF${[headers.map(escapeCsvCell).join(','), ...rows].join('\r\n')}`;
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const safePeriod = periodDescription.replace(/[^a-zA-Z0-9_-]+/g, '_');
    link.href = url;
    link.download = `Laporan_JPD_SMKN5_${safePeriod}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleDownloadPdf = () => {
    if (filteredJournals.length === 0) return;
    setGeneratingPdf(true);
    try {
      const preparerRoleLabel =
        profile?.role === UserRole.GURU
          ? 'Guru Mata Pelajaran'
          : profile?.role === UserRole.KEPALA_SEKOLAH
            ? 'Kepala Sekolah'
            : 'Administrator Akademik';

      const { fileName, blob } = generateAcademicReportPdf({
        isSchoolWideRole,
        periodDescription,
        printedDate: today,
        preparerName: profile?.displayName ?? 'Pengguna JPD-SMK',
        preparerNip: profile?.nip ?? '',
        preparerRoleLabel,
        summary,
        primaryRows: primaryGroupingRows.map((row) => {
          const totAtt = row.presentSum + row.absentSum;
          return {
            title: row.title,
            meetings: row.meetings,
            totalJp: row.totalJp,
            terlaksana: row.terlaksana,
            otherStatus: row.mandiri + row.pengganti,
            docsCount: row.docsCount,
            attendancePct: totAtt > 0 ? Math.round((row.presentSum / totAtt) * 100) : 0,
          };
        }),
        classRows: classGroupingRows.map((row) => {
          const totAtt = row.presentSum + row.absentSum;
          return {
            className: row.className,
            subjectsCount: row.subjectsCount,
            meetings: row.meetings,
            totalJp: row.totalJp,
            docsCount: row.docsCount,
            attendancePct: totAtt > 0 ? Math.round((row.presentSum / totAtt) * 100) : 0,
          };
        }),
        journals: filteredJournals,
      });

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setPdfNotice({ fileName, url });
    } finally {
      setGeneratingPdf(false);
    }
  };

  const handleBrowserPrint = () => {
    setPrintFallbackHint(true);
    try {
      window.print();
    } catch {
      // Sandboxed iframe fallback handled by visible PDF download hint
    }
  };

  return (
    <div className="space-y-6">
      {/* Official Print-Only School Letterhead */}
      <div className="hidden print:block border-b-2 border-[#102D46] pb-3 mb-4">
        <div className="text-center space-y-0.5">
          <p className="text-xs uppercase tracking-wider font-semibold text-slate-700">
            Pemerintah Provinsi Kepulauan Riau · Dinas Pendidikan
          </p>
          <h1 className="text-lg font-bold text-[#102D46]">
            SMK NEGERI 5 TANJUNGPINANG
          </h1>
          <p className="text-xs text-slate-600">
            Laporan Rekapitulasi Jurnal Pembelajaran Digital (JPD-SMK) · Periode: {periodDescription}
          </p>
        </div>
      </div>

      {/* Screen Controls & Header */}
      <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-5 print:border-0 print:p-0">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 print:hidden">
          <div className="space-y-1">
            <p className="text-xs font-semibold text-[#16A6A0] uppercase tracking-wider">
              SMK Negeri 5 Tanjungpinang · Rekapitulasi &amp; Laporan Akademik
            </p>
            <h1 className="text-xl font-bold tracking-tight text-[#102D46]">
              {isSchoolWideRole
                ? 'Laporan Pembelajaran Sekolah'
                : 'Rekapitulasi Jurnal Mengajar Pribadi'}
            </h1>
            <p className="text-sm text-slate-600">
              Susun rekap bulanan atau semester serta ekspor data ke format CSV atau dokumen PDF resmi SMK Negeri 5 Tanjungpinang.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              disabled={filteredJournals.length === 0}
              onClick={handleDownloadCsv}
              className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-50 text-xs font-medium text-[#102D46] transition-colors whitespace-nowrap cursor-pointer"
            >
              <Download className="w-4 h-4 text-[#1C678A]" />
              <span>Unduh CSV</span>
            </button>
            <button
              type="button"
              disabled={filteredJournals.length === 0}
              onClick={() => {
                setPrintFallbackHint(false);
                setPreviewOpen(true);
              }}
              className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-50 text-xs font-medium text-[#102D46] transition-colors whitespace-nowrap cursor-pointer"
            >
              <Eye className="w-4 h-4 text-[#1C678A]" />
              <span>Pratinjau Cetak</span>
            </button>
            <button
              type="button"
              disabled={filteredJournals.length === 0 || generatingPdf}
              onClick={handleDownloadPdf}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#102D46] hover:bg-[#1C678A] disabled:opacity-50 text-xs font-medium text-white transition-colors whitespace-nowrap cursor-pointer"
            >
              <FileDown className="w-4 h-4" />
              <span>{generatingPdf ? 'Menyiapkan PDF...' : 'Simpan PDF'}</span>
            </button>
          </div>
        </div>

        {pdfNotice && (
          <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 print:hidden">
            <span>
              Dokumen PDF siap: <strong className="font-mono-tabular">{pdfNotice.fileName}</strong>
            </span>
            <a
              href={pdfNotice.url}
              download={pdfNotice.fileName}
              className="font-semibold text-[#102D46] hover:underline"
            >
              Unduh Ulang File PDF
            </a>
          </div>
        )}

        {/* Filter Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-4 border-t border-slate-200 print:hidden">
          <div className="space-y-1">
            <label htmlFor="rep-year" className="block text-[11px] font-medium text-slate-600">
              Tahun Ajaran
            </label>
            <select
              id="rep-year"
              value={selectedYearId}
              onChange={(e) => setSelectedYearId(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs text-[#102D46]"
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
          </div>

          <div className="space-y-1">
            <label htmlFor="rep-mode" className="block text-[11px] font-medium text-slate-600">
              Jenis Periode
            </label>
            <select
              id="rep-mode"
              value={periodMode}
              onChange={(e) => setPeriodMode(e.target.value as ReportPeriodMode)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs text-[#102D46]"
            >
              <option value="MONTH">Rekap Bulanan</option>
              <option value="RANGE">Rentang Tanggal</option>
              <option value="SEMESTER">Seluruh Semester</option>
            </select>
          </div>

          {periodMode === 'MONTH' && (
            <div className="space-y-1">
              <label htmlFor="rep-month" className="block text-[11px] font-medium text-slate-600">
                Pilih Bulan
              </label>
              <input
                id="rep-month"
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs font-mono-tabular text-[#102D46]"
              />
            </div>
          )}

          {periodMode === 'RANGE' && (
            <>
              <div className="space-y-1">
                <label htmlFor="rep-start" className="block text-[11px] font-medium text-slate-600">
                  Dari Tanggal
                </label>
                <input
                  id="rep-start"
                  type="date"
                  value={rangeStart}
                  onChange={(e) => setRangeStart(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs font-mono-tabular text-[#102D46]"
                />
              </div>
              <div className="space-y-1">
                <label htmlFor="rep-end" className="block text-[11px] font-medium text-slate-600">
                  Sampai Tanggal
                </label>
                <input
                  id="rep-end"
                  type="date"
                  value={rangeEnd}
                  onChange={(e) => setRangeEnd(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs font-mono-tabular text-[#102D46]"
                />
              </div>
            </>
          )}

          {isSchoolWideRole && (
            <div className="space-y-1">
              <label htmlFor="rep-teacher" className="block text-[11px] font-medium text-slate-600">
                Filter Guru
              </label>
              <select
                id="rep-teacher"
                value={selectedTeacherUid}
                onChange={(e) => setSelectedTeacherUid(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs text-[#102D46]"
              >
                <option value="ALL">Semua Guru</option>
                {teacherFilterOptions.map((t) => (
                  <option key={t.uid} value={t.uid}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="space-y-1">
            <label htmlFor="rep-class" className="block text-[11px] font-medium text-slate-600">
              Filter Kelas
            </label>
            <select
              id="rep-class"
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs text-[#102D46]"
            >
              <option value="ALL">Semua Kelas</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label htmlFor="rep-subject" className="block text-[11px] font-medium text-slate-600">
              Filter Mata Pelajaran
            </label>
            <select
              id="rep-subject"
              value={selectedSubjectId}
              onChange={(e) => setSelectedSubjectId(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs text-[#102D46]"
            >
              <option value="ALL">Semua Mata Pelajaran</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label htmlFor="rep-status" className="block text-[11px] font-medium text-slate-600">
              Status Pelaksanaan
            </label>
            <select
              id="rep-status"
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value as 'ALL' | TeachingStatus)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs text-[#102D46]"
            >
              <option value="ALL">Semua Status</option>
              <option value={TeachingStatus.TERLAKSANA}>Terlaksana</option>
              <option value={TeachingStatus.TUGAS_MANDIRI}>Tugas Mandiri</option>
              <option value={TeachingStatus.PENGGANTI}>Kelas Pengganti</option>
            </select>
          </div>
        </div>

        {/* Summary KPI Strip */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 pt-3 border-t border-slate-200">
          <div className="p-3.5 rounded-lg bg-[#F5F7FA] border border-slate-200 space-y-1">
            <p className="text-xs text-slate-500">Total Pertemuan Tercatat</p>
            <p className="text-2xl font-bold font-mono-tabular text-[#102D46]">
              {summary.totalMeetings}
            </p>
          </div>
          <div className="p-3.5 rounded-lg bg-[#F5F7FA] border border-slate-200 space-y-1">
            <p className="text-xs text-slate-500">Total Jam Pelajaran (JP)</p>
            <p className="text-2xl font-bold font-mono-tabular text-[#1C678A]">
              {summary.totalJp} JP
            </p>
          </div>
          <div className="p-3.5 rounded-lg bg-[#F5F7FA] border border-slate-200 space-y-1">
            <p className="text-xs text-slate-500">Rata-Rata Kehadiran Siswa</p>
            <p className="text-2xl font-bold font-mono-tabular text-[#16A6A0]">
              {summary.attendancePct}%
            </p>
          </div>
          <div className="p-3.5 rounded-lg bg-[#F5F7FA] border border-slate-200 space-y-1">
            <p className="text-xs text-slate-500">Entri Dengan Dokumentasi</p>
            <p className="text-2xl font-bold font-mono-tabular text-[#102D46]">
              {summary.docsCount}
            </p>
          </div>
        </div>
      </section>

      {/* Report Tables */}
      <section className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6 space-y-4 print:border-0 print:p-0">
        <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
          <div className="flex flex-wrap items-center gap-1 p-1 bg-[#F5F7FA] border border-slate-200 rounded-lg">
            <button
              type="button"
              onClick={() => setActiveTab('BY_TEACHER_OR_SUBJECT')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                activeTab === 'BY_TEACHER_OR_SUBJECT'
                  ? 'bg-white text-[#102D46] border border-slate-200'
                  : 'text-slate-600 hover:text-[#102D46]'
              }`}
            >
              {isSchoolWideRole ? 'Rekap per Guru' : 'Rekap per Mata Pelajaran'}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('BY_CLASS')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                activeTab === 'BY_CLASS'
                  ? 'bg-white text-[#102D46] border border-slate-200'
                  : 'text-slate-600 hover:text-[#102D46]'
              }`}
            >
              Rekap per Kelas
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('DETAIL')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                activeTab === 'DETAIL'
                  ? 'bg-white text-[#102D46] border border-slate-200'
                  : 'text-slate-600 hover:text-[#102D46]'
              }`}
            >
              Rincian Jurnal ({filteredJournals.length})
            </button>
          </div>

          <span className="text-xs font-mono-tabular text-slate-500">
            Periode: {periodDescription}
          </span>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-14 bg-slate-100 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : filteredJournals.length === 0 ? (
          <div className="py-12 text-center border border-dashed border-slate-200 rounded-lg space-y-2">
            <FileSpreadsheet className="w-6 h-6 text-slate-400 mx-auto" />
            <p className="text-sm font-medium text-[#102D46]">
              Tidak ada data jurnal untuk periode ini
            </p>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Sesuaikan filter bulan, rentang tanggal, kelas, atau mata pelajaran di atas untuk menampilkan data laporan.
            </p>
          </div>
        ) : (
          <>
            {(activeTab === 'BY_TEACHER_OR_SUBJECT' || false) && (
              <div className="overflow-x-auto border border-slate-200 rounded-lg">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-[#F5F7FA] border-b border-slate-200 text-slate-600">
                      <th className="py-2.5 px-3 font-semibold">No</th>
                      <th className="py-2.5 px-3 font-semibold">
                        {isSchoolWideRole ? 'Nama Guru' : 'Mata Pelajaran'}
                      </th>
                      <th className="py-2.5 px-3 font-semibold text-right">Pertemuan</th>
                      <th className="py-2.5 px-3 font-semibold text-right">Total JP</th>
                      <th className="py-2.5 px-3 font-semibold text-right">Terlaksana</th>
                      <th className="py-2.5 px-3 font-semibold text-right">Mandiri/Pengganti</th>
                      <th className="py-2.5 px-3 font-semibold text-right">Dokumentasi</th>
                      <th className="py-2.5 px-3 font-semibold text-right">Kehadiran</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {primaryGroupingRows.map((row, idx) => {
                      const totAtt = row.presentSum + row.absentSum;
                      const pct = totAtt > 0 ? Math.round((row.presentSum / totAtt) * 100) : 0;
                      return (
                        <tr key={row.key} className="hover:bg-slate-50/60">
                          <td className="py-2.5 px-3 font-mono-tabular text-slate-500">
                            {idx + 1}
                          </td>
                          <td className="py-2.5 px-3 font-medium text-[#102D46]">{row.title}</td>
                          <td className="py-2.5 px-3 text-right font-mono-tabular font-semibold text-[#102D46]">
                            {row.meetings}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono-tabular text-slate-700">
                            {row.totalJp}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono-tabular text-emerald-700">
                            {row.terlaksana}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono-tabular text-slate-600">
                            {row.mandiri + row.pengganti}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono-tabular text-slate-700">
                            {row.docsCount}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono-tabular font-medium text-[#1C678A]">
                            {pct}%
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {activeTab === 'BY_CLASS' && (
              <div className="overflow-x-auto border border-slate-200 rounded-lg">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-[#F5F7FA] border-b border-slate-200 text-slate-600">
                      <th className="py-2.5 px-3 font-semibold">No</th>
                      <th className="py-2.5 px-3 font-semibold">Kelas</th>
                      <th className="py-2.5 px-3 font-semibold text-right">Mapel Tercatat</th>
                      <th className="py-2.5 px-3 font-semibold text-right">Total Pertemuan</th>
                      <th className="py-2.5 px-3 font-semibold text-right">Total JP</th>
                      <th className="py-2.5 px-3 font-semibold text-right">Dokumentasi</th>
                      <th className="py-2.5 px-3 font-semibold text-right">Kehadiran Siswa</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {classGroupingRows.map((row, idx) => {
                      const totAtt = row.presentSum + row.absentSum;
                      const pct = totAtt > 0 ? Math.round((row.presentSum / totAtt) * 100) : 0;
                      return (
                        <tr key={row.classId} className="hover:bg-slate-50/60">
                          <td className="py-2.5 px-3 font-mono-tabular text-slate-500">
                            {idx + 1}
                          </td>
                          <td className="py-2.5 px-3 font-medium text-[#102D46]">
                            {row.className}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono-tabular text-slate-700">
                            {row.subjectsCount}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono-tabular font-semibold text-[#102D46]">
                            {row.meetings}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono-tabular text-slate-700">
                            {row.totalJp}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono-tabular text-slate-700">
                            {row.docsCount}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono-tabular font-medium text-[#1C678A]">
                            {pct}%
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Detail Table (shown on DETAIL tab or always included in print if DETAIL tab is active; let's also render a compact print table when printing!) */}
            <div className={activeTab === 'DETAIL' ? 'block' : 'hidden print:block print:mt-6'}>
              <p className="hidden print:block text-xs font-semibold text-[#102D46] mb-2">
                Lampiran Rincian Jurnal Pembelajaran
              </p>
              <div className="overflow-x-auto border border-slate-200 rounded-lg">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-[#F5F7FA] border-b border-slate-200 text-slate-600">
                      <th className="py-2.5 px-3 font-semibold">Tanggal</th>
                      <th className="py-2.5 px-3 font-semibold">Jam</th>
                      {isSchoolWideRole && <th className="py-2.5 px-3 font-semibold">Guru</th>}
                      <th className="py-2.5 px-3 font-semibold">Kelas</th>
                      <th className="py-2.5 px-3 font-semibold">Mata Pelajaran &amp; Materi</th>
                      <th className="py-2.5 px-3 font-semibold">Status</th>
                      <th className="py-2.5 px-3 font-semibold text-right">Hadir/Absen</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {filteredJournals.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50/60">
                        <td className="py-2.5 px-3 font-mono-tabular whitespace-nowrap text-[#102D46]">
                          {item.date}
                        </td>
                        <td className="py-2.5 px-3 font-mono-tabular whitespace-nowrap text-slate-600">
                          {item.periodStart}–{item.periodEnd}
                        </td>
                        {isSchoolWideRole && (
                          <td className="py-2.5 px-3 text-[#102D46]">{item.teacherName}</td>
                        )}
                        <td className="py-2.5 px-3 font-medium text-[#102D46] whitespace-nowrap">
                          {item.className}
                        </td>
                        <td className="py-2.5 px-3">
                          <p className="font-medium text-[#102D46]">{item.subjectName}</p>
                          <p className="text-[11px] text-slate-600">{item.topic}</p>
                        </td>
                        <td className="py-2.5 px-3 text-slate-700 whitespace-nowrap">
                          {TEACHING_STATUS_LABELS[item.teachingStatus]}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono-tabular whitespace-nowrap text-slate-700">
                          {item.presentCount} / {item.absentCount}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </section>

      {/* Official Print Signature Footer */}
      <div className="hidden print:grid grid-cols-2 gap-12 pt-8 text-xs text-slate-800">
        <div className="space-y-14">
          <div>
            <p>Mengetahui,</p>
            <p className="font-semibold">Kepala SMK Negeri 5 Tanjungpinang</p>
          </div>
          <div className="border-t border-slate-400 pt-1 w-56">
            <p className="font-medium">NIP. ________________________</p>
          </div>
        </div>
        <div className="space-y-14 justify-self-end">
          <div>
            <p>Tanjungpinang, {today}</p>
            <p className="font-semibold">
              {profile?.role === UserRole.GURU ? 'Guru Mata Pelajaran' : 'Pengelola / Administrator'}
            </p>
          </div>
          <div className="border-t border-slate-400 pt-1 w-56">
            <p className="font-semibold">{profile?.displayName}</p>
            <p className="font-mono-tabular text-[11px]">
              NIP. {profile?.nip || '________________________'}
            </p>
          </div>
        </div>
      </div>

      {/* In-App A4 Print & PDF Preview Modal */}
      {previewOpen && (
        <div
          className="fixed inset-0 z-50 bg-[#102D46]/75 flex items-center justify-center p-3 sm:p-6 print:hidden"
          onClick={() => setPreviewOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Pratinjau Dokumen Laporan"
        >
          <div
            className="bg-white rounded-xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden border border-slate-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-3.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 bg-[#F5F7FA]">
              <div>
                <h2 className="text-sm font-semibold text-[#102D46]">
                  Pratinjau Dokumen Laporan Resmi (A4)
                </h2>
                <p className="text-xs text-slate-500">Periode: {periodDescription}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleBrowserPrint}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-medium text-[#102D46] cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Cetak Browser</span>
                </button>
                <button
                  type="button"
                  disabled={generatingPdf}
                  onClick={handleDownloadPdf}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#102D46] hover:bg-[#1C678A] text-xs font-medium text-white cursor-pointer"
                >
                  <FileDown className="w-3.5 h-3.5" />
                  <span>{generatingPdf ? 'Menyiapkan...' : 'Unduh File PDF (.pdf)'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewOpen(false)}
                  className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-200/70 cursor-pointer"
                  aria-label="Tutup pratinjau laporan"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {printFallbackHint && (
              <div className="px-5 py-2.5 bg-amber-50 border-b border-amber-200 text-xs text-amber-900">
                Jika dialog cetak browser tidak muncul (misalnya dibatasi oleh frame pratinjau), silakan klik{' '}
                <strong>Unduh File PDF (.pdf)</strong> untuk menyimpan dan mencetak dokumen langsung dari perangkat Anda.
              </div>
            )}

            <div className="flex-1 overflow-y-auto p-6 sm:p-10 bg-slate-100">
              <div className="bg-white border border-slate-200 p-6 sm:p-10 max-w-3xl mx-auto space-y-6 text-[#102D46]">
                <div className="text-center border-b-2 border-[#102D46] pb-3 space-y-0.5">
                  <p className="text-[11px] uppercase tracking-wider font-semibold text-slate-600">
                    Pemerintah Provinsi Kepulauan Riau · Dinas Pendidikan
                  </p>
                  <h3 className="text-base font-bold">SMK NEGERI 5 TANJUNGPINANG</h3>
                  <p className="text-xs text-slate-600">
                    Laporan Rekapitulasi Jurnal Pembelajaran Digital (JPD-SMK) · {periodDescription}
                  </p>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div className="p-2.5 bg-[#F5F7FA] border border-slate-200 rounded">
                    <p className="text-[11px] text-slate-500">Total Pertemuan</p>
                    <p className="text-base font-bold font-mono-tabular">{summary.totalMeetings}</p>
                  </div>
                  <div className="p-2.5 bg-[#F5F7FA] border border-slate-200 rounded">
                    <p className="text-[11px] text-slate-500">Total Jam (JP)</p>
                    <p className="text-base font-bold font-mono-tabular">{summary.totalJp} JP</p>
                  </div>
                  <div className="p-2.5 bg-[#F5F7FA] border border-slate-200 rounded">
                    <p className="text-[11px] text-slate-500">Kehadiran Siswa</p>
                    <p className="text-base font-bold font-mono-tabular">{summary.attendancePct}%</p>
                  </div>
                  <div className="p-2.5 bg-[#F5F7FA] border border-slate-200 rounded">
                    <p className="text-[11px] text-slate-500">Dokumentasi</p>
                    <p className="text-base font-bold font-mono-tabular">{summary.docsCount}</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-semibold">
                    {isSchoolWideRole ? '1. Rekapitulasi per Guru' : '1. Rekapitulasi per Mata Pelajaran'}
                  </p>
                  <table className="w-full text-left border-collapse text-[11px] border border-slate-300">
                    <thead>
                      <tr className="bg-[#102D46] text-white">
                        <th className="py-1.5 px-2 border border-slate-300">No</th>
                        <th className="py-1.5 px-2 border border-slate-300">
                          {isSchoolWideRole ? 'Nama Guru' : 'Mata Pelajaran'}
                        </th>
                        <th className="py-1.5 px-2 border border-slate-300 text-right">Pertemuan</th>
                        <th className="py-1.5 px-2 border border-slate-300 text-right">JP</th>
                        <th className="py-1.5 px-2 border border-slate-300 text-right">Dok.</th>
                        <th className="py-1.5 px-2 border border-slate-300 text-right">Hadir</th>
                      </tr>
                    </thead>
                    <tbody>
                      {primaryGroupingRows.map((row, idx) => {
                        const totAtt = row.presentSum + row.absentSum;
                        const pct = totAtt > 0 ? Math.round((row.presentSum / totAtt) * 100) : 0;
                        return (
                          <tr key={row.key}>
                            <td className="py-1.5 px-2 border border-slate-300 font-mono-tabular">
                              {idx + 1}
                            </td>
                            <td className="py-1.5 px-2 border border-slate-300 font-medium">
                              {row.title}
                            </td>
                            <td className="py-1.5 px-2 border border-slate-300 text-right font-mono-tabular">
                              {row.meetings}
                            </td>
                            <td className="py-1.5 px-2 border border-slate-300 text-right font-mono-tabular">
                              {row.totalJp}
                            </td>
                            <td className="py-1.5 px-2 border border-slate-300 text-right font-mono-tabular">
                              {row.docsCount}
                            </td>
                            <td className="py-1.5 px-2 border border-slate-300 text-right font-mono-tabular">
                              {pct}%
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-semibold">
                    2. Rincian Jurnal Pembelajaran ({filteredJournals.length} entri)
                  </p>
                  <table className="w-full text-left border-collapse text-[11px] border border-slate-300">
                    <thead>
                      <tr className="bg-[#1C678A] text-white">
                        <th className="py-1.5 px-2 border border-slate-300">Tanggal</th>
                        {isSchoolWideRole && (
                          <th className="py-1.5 px-2 border border-slate-300">Guru</th>
                        )}
                        <th className="py-1.5 px-2 border border-slate-300">Kelas</th>
                        <th className="py-1.5 px-2 border border-slate-300">Mapel &amp; Materi</th>
                        <th className="py-1.5 px-2 border border-slate-300 text-right">H/A</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredJournals.map((item) => (
                        <tr key={item.id}>
                          <td className="py-1.5 px-2 border border-slate-300 font-mono-tabular whitespace-nowrap">
                            {item.date} ({item.periodStart}–{item.periodEnd})
                          </td>
                          {isSchoolWideRole && (
                            <td className="py-1.5 px-2 border border-slate-300">
                              {item.teacherName}
                            </td>
                          )}
                          <td className="py-1.5 px-2 border border-slate-300 whitespace-nowrap">
                            {item.className}
                          </td>
                          <td className="py-1.5 px-2 border border-slate-300">
                            <span className="font-medium">{item.subjectName}</span> — {item.topic}
                          </td>
                          <td className="py-1.5 px-2 border border-slate-300 text-right font-mono-tabular whitespace-nowrap">
                            {item.presentCount}/{item.absentCount}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="grid grid-cols-2 gap-8 pt-6 text-xs">
                  <div className="space-y-12">
                    <div>
                      <p>Mengetahui,</p>
                      <p className="font-semibold">Kepala SMK Negeri 5 Tanjungpinang</p>
                    </div>
                    <div className="border-t border-slate-400 pt-1 w-52">
                      <p>NIP. ________________________</p>
                    </div>
                  </div>
                  <div className="space-y-12 justify-self-end">
                    <div>
                      <p>Tanjungpinang, {today}</p>
                      <p className="font-semibold">
                        {profile?.role === UserRole.GURU
                          ? 'Guru Mata Pelajaran'
                          : 'Pengelola / Administrator'}
                      </p>
                    </div>
                    <div className="border-t border-slate-400 pt-1 w-52">
                      <p className="font-semibold">{profile?.displayName}</p>
                      <p className="font-mono-tabular text-[11px]">
                        NIP. {profile?.nip || '________________________'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
