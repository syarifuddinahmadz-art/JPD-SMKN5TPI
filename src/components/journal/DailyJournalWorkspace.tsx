import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import {
  AlertCircle,
  BookOpen,
  Calendar,
  ExternalLink,
  ImagePlus,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import {
  extractFirestorePhotoId,
  uploadTeachingDocumentation,
} from '../../lib/imageUpload';
import { JournalPhotoThumbnail } from './JournalPhotoPreview';
import { BOOTSTRAPPED_ADMIN_EMAIL, UserRole } from '../../types/auth';
import {
  DATE_YYYYMMDD_PATTERN,
  JOURNAL_FIELD_LIMITS,
  TEACHING_STATUS_LABELS,
  TeachingStatus,
  type TeachingJournal,
} from '../../types/journal';
import {
  DAY_LABELS,
  DayOfWeek,
  EntityStatus,
  SEMESTER_LABELS,
  type AcademicYear,
  type SchoolClass,
  type Subject,
  type TeachingSchedule,
} from '../../types/masterData';
import {
  SUPERVISION_STATUS_LABELS,
  SupervisionStatus,
  type PrincipalSupervision,
} from '../../types/monitoring';

function getTodayDateString(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getDayOfWeekFromDate(dateStr: string): DayOfWeek | null {
  if (!DATE_YYYYMMDD_PATTERN.test(dateStr)) return null;
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  const map: Record<number, DayOfWeek> = {
    1: DayOfWeek.SENIN,
    2: DayOfWeek.SELASA,
    3: DayOfWeek.RABU,
    4: DayOfWeek.KAMIS,
    5: DayOfWeek.JUMAT,
    6: DayOfWeek.SABTU,
  };
  return map[dt.getDay()] ?? null;
}

export function DailyJournalWorkspace() {
  const { firebaseUser, profile } = useAuth();
  const isBootstrappedAdmin =
    profile?.role === UserRole.ADMIN ||
    (firebaseUser?.email === BOOTSTRAPPED_ADMIN_EMAIL && firebaseUser.emailVerified);

  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [schedules, setSchedules] = useState<TeachingSchedule[]>([]);
  const [journals, setJournals] = useState<TeachingJournal[]>([]);
  const [supervisions, setSupervisions] = useState<PrincipalSupervision[]>([]);
  const [loading, setLoading] = useState(true);

  const [editingJournal, setEditingJournal] = useState<TeachingJournal | null>(null);
  const [selectedScheduleId, setSelectedScheduleId] = useState('');
  const [academicYearId, setAcademicYearId] = useState('');
  const [classId, setClassId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [date, setDate] = useState(getTodayDateString);
  const [periodStart, setPeriodStart] = useState('1');
  const [periodEnd, setPeriodEnd] = useState('2');
  const [teachingStatus, setTeachingStatus] = useState<TeachingStatus>(TeachingStatus.TERLAKSANA);
  const [presentCount, setPresentCount] = useState('30');
  const [absentCount, setAbsentCount] = useState('0');
  const [topic, setTopic] = useState('');
  const [activities, setActivities] = useState('');
  const [notes, setNotes] = useState('');
  const [documentationUrl, setDocumentationUrl] = useState('');
  const [documentationCaption, setDocumentationCaption] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState('');
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [uploadNotice, setUploadNotice] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState<'ALL' | TeachingStatus>('ALL');
  const [dateFilter, setDateFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (!firebaseUser) return;

    const unsubYears = onSnapshot(
      query(collection(db, 'academicYears'), where('isActive', '==', true)),
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<AcademicYear, 'id'>) }));
        setAcademicYears(list);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'academicYears'),
    );

    const unsubClasses = onSnapshot(
      query(collection(db, 'classes'), where('status', '==', EntityStatus.AKTIF)),
      (snap) => {
        const list = snap.docs
          .map((d) => ({ id: d.id, ...(d.data() as Omit<SchoolClass, 'id'>) }))
          .sort((a, b) => a.name.localeCompare(b.name));
        setClasses(list);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'classes'),
    );

    const unsubSubjects = onSnapshot(
      query(collection(db, 'subjects'), where('status', '==', EntityStatus.AKTIF)),
      (snap) => {
        const list = snap.docs
          .map((d) => ({ id: d.id, ...(d.data() as Omit<Subject, 'id'>) }))
          .sort((a, b) => a.name.localeCompare(b.name));
        setSubjects(list);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'subjects'),
    );

    const schedulesQuery = isBootstrappedAdmin
      ? query(collection(db, 'schedules'), where('status', '==', EntityStatus.AKTIF))
      : query(collection(db, 'schedules'), where('teacherUid', '==', firebaseUser.uid));

    const unsubSchedules = onSnapshot(
      schedulesQuery,
      (snap) => {
        const list = snap.docs
          .map((d) => ({ id: d.id, ...(d.data() as Omit<TeachingSchedule, 'id'>) }))
          .filter((item) => item.status === EntityStatus.AKTIF);
        setSchedules(list);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'schedules'),
    );

    const journalsQuery = isBootstrappedAdmin
      ? query(collection(db, 'teachingJournals'), orderBy('date', 'desc'))
      : query(collection(db, 'teachingJournals'), where('teacherUid', '==', firebaseUser.uid));

    const unsubJournals = onSnapshot(
      journalsQuery,
      (snap) => {
        const list = snap.docs
          .map((d) => ({ id: d.id, ...(d.data() as Omit<TeachingJournal, 'id'>) }))
          .sort((a, b) => {
            const dateCmp = b.date.localeCompare(a.date);
            if (dateCmp !== 0) return dateCmp;
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
      query(collection(db, 'supervisions'), where('teacherUid', '==', firebaseUser.uid)),
      (snap) => {
        const list = snap.docs
          .map((d) => ({ id: d.id, ...(d.data() as Omit<PrincipalSupervision, 'id'>) }))
          .sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0));
        setSupervisions(list);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'supervisions'),
    );

    return () => {
      unsubYears();
      unsubClasses();
      unsubSubjects();
      unsubSchedules();
      unsubJournals();
      unsubSupervisions();
    };
  }, [firebaseUser, isBootstrappedAdmin]);

  const activeYear = academicYears[0] ?? null;

  useEffect(() => {
    if (!academicYearId && activeYear) {
      setAcademicYearId(activeYear.id);
    }
  }, [academicYearId, activeYear]);

  const selectedDayOfWeek = useMemo(() => getDayOfWeekFromDate(date), [date]);

  const sortedSchedules = useMemo(() => {
    return [...schedules].sort((a, b) => {
      const aToday = a.dayOfWeek === selectedDayOfWeek ? 0 : 1;
      const bToday = b.dayOfWeek === selectedDayOfWeek ? 0 : 1;
      if (aToday !== bToday) return aToday - bToday;
      return a.periodStart - b.periodStart;
    });
  }, [schedules, selectedDayOfWeek]);

  const handleScheduleSelect = (scheduleIdValue: string) => {
    setSelectedScheduleId(scheduleIdValue);
    const matched = schedules.find((s) => s.id === scheduleIdValue);
    if (!matched) return;
    setAcademicYearId(matched.academicYearId);
    setClassId(matched.classId);
    setSubjectId(matched.subjectId);
    setPeriodStart(String(matched.periodStart));
    setPeriodEnd(String(matched.periodEnd));
    const cls = classes.find((c) => c.id === matched.classId);
    if (cls && cls.studentCount > 0) {
      setPresentCount(String(cls.studentCount));
      setAbsentCount('0');
    }
  };

  const resetForm = () => {
    setEditingJournal(null);
    setSelectedScheduleId('');
    setAcademicYearId(activeYear?.id ?? '');
    setClassId('');
    setSubjectId('');
    setDate(getTodayDateString());
    setPeriodStart('1');
    setPeriodEnd('2');
    setTeachingStatus(TeachingStatus.TERLAKSANA);
    setPresentCount('30');
    setAbsentCount('0');
    setTopic('');
    setActivities('');
    setNotes('');
    setDocumentationUrl('');
    setDocumentationCaption('');
    setPhotoPreviewUrl('');
    setFormError(null);
    setUploadNotice(null);
    setUploadError(null);
  };

  const startEdit = (item: TeachingJournal) => {
    setEditingJournal(item);
    setSelectedScheduleId(item.scheduleId);
    setAcademicYearId(item.academicYearId);
    setClassId(item.classId);
    setSubjectId(item.subjectId);
    setDate(item.date);
    setPeriodStart(String(item.periodStart));
    setPeriodEnd(String(item.periodEnd));
    setTeachingStatus(item.teachingStatus);
    setPresentCount(String(item.presentCount));
    setAbsentCount(String(item.absentCount));
    setTopic(item.topic);
    setActivities(item.activities);
    setNotes(item.notes);
    setDocumentationUrl(item.documentationUrl);
    setDocumentationCaption(item.documentationCaption);
    setPhotoPreviewUrl('');
    setFormError(null);
    setUploadNotice(null);
    setUploadError(null);
    setSuccessNotice(null);
  };

  const handlePhotoFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !firebaseUser) return;

    setUploadingPhoto(true);
    setUploadError(null);
    setUploadNotice(null);
    try {
      const result = await uploadTeachingDocumentation(firebaseUser.uid, file);
      setDocumentationUrl(result.url);
      setPhotoPreviewUrl(result.previewUrl);
      setUploadNotice(
        result.source === 'storage'
          ? 'Foto berhasil diunggah ke Firebase Storage.'
          : 'Foto berhasil dikompresi & disimpan ke Cloud Firestore.',
      );
    } catch (error) {
      setUploadError(
        error instanceof Error ? error.message : 'Gagal mengunggah foto dokumentasi.',
      );
    } finally {
      setUploadingPhoto(false);
    }
  };

  const clearDocumentationPhoto = () => {
    setDocumentationUrl('');
    setDocumentationCaption('');
    setPhotoPreviewUrl('');
    setUploadNotice(null);
    setUploadError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firebaseUser || !profile) return;

    const chosenYear = academicYears.find((y) => y.id === academicYearId) ?? activeYear;
    const chosenClass = classes.find((c) => c.id === classId);
    const chosenSubject = subjects.find((s) => s.id === subjectId);

    if (!chosenYear) {
      setFormError('Belum ada Tahun Ajaran aktif. Minta Administrator mengaktifkan periode semester terlebih dahulu.');
      return;
    }
    if (!chosenClass || !chosenSubject) {
      setFormError('Silakan pilih Kelas dan Mata Pelajaran.');
      return;
    }
    if (!DATE_YYYYMMDD_PATTERN.test(date)) {
      setFormError('Format tanggal harus YYYY-MM-DD.');
      return;
    }

    const pStart = Number.parseInt(periodStart, 10);
    const pEnd = Number.parseInt(periodEnd, 10);
    if (
      Number.isNaN(pStart) ||
      Number.isNaN(pEnd) ||
      pStart < JOURNAL_FIELD_LIMITS.periodMin ||
      pEnd > JOURNAL_FIELD_LIMITS.periodMax ||
      pEnd < pStart
    ) {
      setFormError('Jam pelajaran (jam ke-) harus antara 1 sampai 16 dan Jam Selesai >= Jam Mulai.');
      return;
    }

    const pCount = Number.parseInt(presentCount, 10);
    const aCount = Number.parseInt(absentCount, 10);
    if (
      Number.isNaN(pCount) ||
      Number.isNaN(aCount) ||
      pCount < 0 ||
      pCount > JOURNAL_FIELD_LIMITS.attendanceMax ||
      aCount < 0 ||
      aCount > JOURNAL_FIELD_LIMITS.attendanceMax
    ) {
      setFormError(`Jumlah hadir dan tidak hadir harus antara 0 hingga ${JOURNAL_FIELD_LIMITS.attendanceMax}.`);
      return;
    }

    const cleanTopic = topic.trim().slice(0, JOURNAL_FIELD_LIMITS.topicMax);
    const cleanActivities = activities.trim().slice(0, JOURNAL_FIELD_LIMITS.activitiesMax);
    const cleanNotes = notes.trim().slice(0, JOURNAL_FIELD_LIMITS.notesMax);
    const cleanDocUrl = documentationUrl.trim().slice(0, JOURNAL_FIELD_LIMITS.documentationUrlMax);
    const cleanDocCaption = documentationCaption
      .trim()
      .slice(0, JOURNAL_FIELD_LIMITS.documentationCaptionMax);

    if (cleanTopic.length < JOURNAL_FIELD_LIMITS.topicMin) {
      setFormError(`Materi pokok minimal ${JOURNAL_FIELD_LIMITS.topicMin} karakter.`);
      return;
    }
    if (cleanActivities.length < JOURNAL_FIELD_LIMITS.activitiesMin) {
      setFormError(`Ringkasan kegiatan minimal ${JOURNAL_FIELD_LIMITS.activitiesMin} karakter.`);
      return;
    }
    if (
      cleanDocUrl &&
      !/^(https?:\/\/|firestore-photo:\/\/)/i.test(cleanDocUrl)
    ) {
      setFormError(
        'Tautan dokumentasi harus diawali https://, http://, atau diunggah langsung melalui tombol Unggah Foto.',
      );
      return;
    }

    setSaving(true);
    setFormError(null);
    setSuccessNotice(null);

    const payload = {
      academicYearId: chosenYear.id,
      academicYearLabel: `${chosenYear.name} · ${SEMESTER_LABELS[chosenYear.semester]}`,
      scheduleId: selectedScheduleId,
      teacherName: profile.displayName,
      classId: chosenClass.id,
      className: chosenClass.name,
      subjectId: chosenSubject.id,
      subjectName: chosenSubject.name,
      date,
      periodStart: pStart,
      periodEnd: pEnd,
      topic: cleanTopic,
      activities: cleanActivities,
      presentCount: pCount,
      absentCount: aCount,
      notes: cleanNotes,
      teachingStatus,
      documentationUrl: cleanDocUrl,
      documentationCaption: cleanDocCaption,
      updatedAt: serverTimestamp(),
    };

    try {
      if (editingJournal) {
        await updateDoc(doc(db, 'teachingJournals', editingJournal.id), payload);
        setSuccessNotice('Jurnal pembelajaran berhasil diperbarui.');
      } else {
        await addDoc(collection(db, 'teachingJournals'), {
          ...payload,
          teacherUid: firebaseUser.uid,
          createdAt: serverTimestamp(),
        });
        setSuccessNotice('Jurnal pembelajaran harian berhasil disimpan ke Cloud Firestore.');
      }
      resetForm();
    } catch (error) {
      handleFirestoreError(
        error,
        editingJournal ? OperationType.UPDATE : OperationType.CREATE,
        editingJournal ? `teachingJournals/${editingJournal.id}` : 'teachingJournals',
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    setBusyId(id);
    try {
      await deleteDoc(doc(db, 'teachingJournals', id));
      setConfirmDeleteId(null);
      if (editingJournal?.id === id) resetForm();
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `teachingJournals/${id}`);
    } finally {
      setBusyId(null);
    }
  };

  const stats = useMemo(() => {
    const today = getTodayDateString();
    const monthPrefix = today.slice(0, 7);
    return {
      total: journals.length,
      month: journals.filter((j) => j.date.startsWith(monthPrefix)).length,
      today: journals.filter((j) => j.date === today).length,
      withDocs: journals.filter((j) => Boolean(j.documentationUrl)).length,
    };
  }, [journals]);

  const filteredJournals = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return journals.filter((item) => {
      if (statusFilter !== 'ALL' && item.teachingStatus !== statusFilter) return false;
      if (dateFilter && item.date !== dateFilter) return false;
      if (!q) return true;
      return (
        item.topic.toLowerCase().includes(q) ||
        item.className.toLowerCase().includes(q) ||
        item.subjectName.toLowerCase().includes(q) ||
        item.teacherName.toLowerCase().includes(q)
      );
    });
  }, [journals, statusFilter, dateFilter, searchTerm]);

  const missingMasterData = !activeYear || classes.length === 0 || subjects.length === 0;

  return (
    <div className="space-y-6">
      {/* KPI Strip */}
      <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <p className="text-xs font-semibold text-[#16A6A0] uppercase tracking-wider">
              SMK Negeri 5 Tanjungpinang · Jurnal Pembelajaran Harian
            </p>
            <h1 className="text-xl font-bold tracking-tight text-[#102D46]">
              Pencatatan Aktivitas Mengajar Guru
            </h1>
          </div>
          {activeYear && (
            <div className="text-xs font-mono-tabular text-slate-600 bg-[#F5F7FA] border border-slate-200 rounded-lg px-3 py-2">
              Semester Aktif: {activeYear.name} · {SEMESTER_LABELS[activeYear.semester]}
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 pt-2 border-t border-slate-200">
          <div className="p-3.5 rounded-lg bg-[#F5F7FA] border border-slate-200 space-y-1">
            <p className="text-xs text-slate-500">Total Jurnal Tercatat</p>
            <p className="text-2xl font-bold font-mono-tabular text-[#102D46]">{stats.total}</p>
          </div>
          <div className="p-3.5 rounded-lg bg-[#F5F7FA] border border-slate-200 space-y-1">
            <p className="text-xs text-slate-500">Bulan Berjalan</p>
            <p className="text-2xl font-bold font-mono-tabular text-[#1C678A]">{stats.month}</p>
          </div>
          <div className="p-3.5 rounded-lg bg-[#F5F7FA] border border-slate-200 space-y-1">
            <p className="text-xs text-slate-500">Entri Hari Ini</p>
            <p className="text-2xl font-bold font-mono-tabular text-[#16A6A0]">{stats.today}</p>
          </div>
          <div className="p-3.5 rounded-lg bg-[#F5F7FA] border border-slate-200 space-y-1">
            <p className="text-xs text-slate-500">Dengan Dokumentasi</p>
            <p className="text-2xl font-bold font-mono-tabular text-[#102D46]">{stats.withDocs}</p>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Form Catat Jurnal */}
        <form
          onSubmit={(e) => void handleSubmit(e)}
          className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-5 sm:p-6 space-y-4"
        >
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-base font-semibold text-[#102D46]">
              {editingJournal ? 'Ubah Jurnal Pembelajaran' : 'Catat Jurnal Harian'}
            </h2>
            {editingJournal && (
              <button
                type="button"
                onClick={resetForm}
                className="text-xs text-slate-500 hover:text-[#102D46] cursor-pointer"
              >
                Batal Ubah
              </button>
            )}
          </div>

          {missingMasterData && (
            <div className="flex items-start gap-2.5 p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-700" />
              <span>
                Tahun Ajaran aktif, Kelas, atau Mata Pelajaran belum tersedia. Pastikan
                Administrator telah melengkapinya di menu Data Master Akademik.
              </span>
            </div>
          )}

          {successNotice && (
            <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs font-medium text-emerald-800">
              {successNotice}
            </div>
          )}

          {formError && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-800">
              {formError}
            </div>
          )}

          {sortedSchedules.length > 0 && (
            <div className="space-y-1.5">
              <label htmlFor="j-schedule" className="block text-xs font-medium text-slate-700">
                Isi Cepat dari Jadwal Mengajar (Opsional)
              </label>
              <select
                id="j-schedule"
                value={selectedScheduleId}
                onChange={(e) => handleScheduleSelect(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs text-[#102D46] bg-white focus:outline-none focus:border-[#1C678A]"
              >
                <option value="">Input manual atau pilih dari jadwal...</option>
                {sortedSchedules.map((sch) => (
                  <option key={sch.id} value={sch.id}>
                    {DAY_LABELS[sch.dayOfWeek]} (Jam {sch.periodStart}–{sch.periodEnd}) ·{' '}
                    {sch.className} — {sch.subjectName}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label htmlFor="j-date" className="block text-xs font-medium text-slate-700">
                Tanggal Mengajar <span className="text-red-600">*</span>
              </label>
              <input
                id="j-date"
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm font-mono-tabular text-[#102D46]"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="j-status" className="block text-xs font-medium text-slate-700">
                Status Pelaksanaan
              </label>
              <select
                id="j-status"
                value={teachingStatus}
                onChange={(e) => setTeachingStatus(e.target.value as TeachingStatus)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm text-[#102D46] bg-white"
              >
                <option value={TeachingStatus.TERLAKSANA}>Terlaksana</option>
                <option value={TeachingStatus.TUGAS_MANDIRI}>Tugas Mandiri</option>
                <option value={TeachingStatus.PENGGANTI}>Kelas Pengganti</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label htmlFor="j-class" className="block text-xs font-medium text-slate-700">
                Kelas <span className="text-red-600">*</span>
              </label>
              <select
                id="j-class"
                required
                value={classId}
                onChange={(e) => {
                  setClassId(e.target.value);
                  const cls = classes.find((c) => c.id === e.target.value);
                  if (cls && cls.studentCount > 0) {
                    setPresentCount(String(cls.studentCount));
                  }
                }}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm text-[#102D46] bg-white"
              >
                <option value="">Pilih kelas</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="j-subject" className="block text-xs font-medium text-slate-700">
                Mata Pelajaran <span className="text-red-600">*</span>
              </label>
              <select
                id="j-subject"
                required
                value={subjectId}
                onChange={(e) => setSubjectId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm text-[#102D46] bg-white"
              >
                <option value="">Pilih mata pelajaran</option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-2.5">
            <div className="space-y-1.5">
              <label htmlFor="j-pstart" className="block text-xs font-medium text-slate-700">
                Jam Ke-
              </label>
              <input
                id="j-pstart"
                type="number"
                min={1}
                max={16}
                value={periodStart}
                onChange={(e) => setPeriodStart(e.target.value)}
                className="w-full px-2.5 py-2 rounded-lg border border-slate-300 text-sm font-mono-tabular text-[#102D46]"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="j-pend" className="block text-xs font-medium text-slate-700">
                S/d Ke-
              </label>
              <input
                id="j-pend"
                type="number"
                min={1}
                max={16}
                value={periodEnd}
                onChange={(e) => setPeriodEnd(e.target.value)}
                className="w-full px-2.5 py-2 rounded-lg border border-slate-300 text-sm font-mono-tabular text-[#102D46]"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="j-present" className="block text-xs font-medium text-slate-700">
                Hadir
              </label>
              <input
                id="j-present"
                type="number"
                min={0}
                max={100}
                value={presentCount}
                onChange={(e) => setPresentCount(e.target.value)}
                className="w-full px-2.5 py-2 rounded-lg border border-slate-300 text-sm font-mono-tabular text-[#102D46]"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="j-absent" className="block text-xs font-medium text-slate-700">
                Absen
              </label>
              <input
                id="j-absent"
                type="number"
                min={0}
                max={100}
                value={absentCount}
                onChange={(e) => setAbsentCount(e.target.value)}
                className="w-full px-2.5 py-2 rounded-lg border border-slate-300 text-sm font-mono-tabular text-[#102D46]"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="j-topic" className="block text-xs font-medium text-slate-700">
              Materi Pokok / Tujuan Pembelajaran <span className="text-red-600">*</span>
            </label>
            <input
              id="j-topic"
              type="text"
              required
              minLength={JOURNAL_FIELD_LIMITS.topicMin}
              maxLength={JOURNAL_FIELD_LIMITS.topicMax}
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="Contoh: Konfigurasi Routing Statis pada Mikrotik"
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm text-[#102D46]"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="j-activities" className="block text-xs font-medium text-slate-700">
              Ringkasan Kegiatan Pembelajaran <span className="text-red-600">*</span>
            </label>
            <textarea
              id="j-activities"
              required
              rows={3}
              minLength={JOURNAL_FIELD_LIMITS.activitiesMin}
              maxLength={JOURNAL_FIELD_LIMITS.activitiesMax}
              value={activities}
              onChange={(e) => setActivities(e.target.value)}
              placeholder="Jelaskan metode, aktivitas praktik siswa, dan asesmen yang dilakukan..."
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm text-[#102D46]"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="j-notes" className="block text-xs font-medium text-slate-700">
              Catatan / Kendala Pembelajaran (Opsional)
            </label>
            <textarea
              id="j-notes"
              rows={2}
              maxLength={JOURNAL_FIELD_LIMITS.notesMax}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Contoh: Siswa perlu pendalaman lanjutan pada konfigurasi subnetting."
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm text-[#102D46]"
            />
          </div>

          {/* Dokumentasi Foto / Tautan */}
          <div className="p-3.5 rounded-lg bg-[#F5F7FA] border border-slate-200 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-[#102D46]">
                Dokumentasi Kegiatan (Opsional)
              </span>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/*"
                disabled={uploadingPhoto}
                onChange={(e) => void handlePhotoFileChange(e)}
                className="sr-only"
              />
              <button
                type="button"
                disabled={uploadingPhoto}
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-[#1C678A] bg-white hover:bg-[#1C678A] disabled:opacity-60 text-[#1C678A] hover:text-white text-xs font-medium transition-colors cursor-pointer whitespace-nowrap"
              >
                <ImagePlus className="w-3.5 h-3.5" />
                <span>
                  {uploadingPhoto
                    ? 'Mengunggah...'
                    : documentationUrl
                      ? 'Ganti Foto'
                      : 'Unggah Foto'}
                </span>
              </button>
            </div>

            {uploadNotice && (
              <p className="text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-md p-2.5 leading-relaxed">
                {uploadNotice}
              </p>
            )}

            {uploadError && (
              <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-md p-2.5 leading-relaxed">
                {uploadError}
              </p>
            )}

            {documentationUrl && (
              <div className="flex items-center gap-3 p-2.5 rounded-md bg-white border border-slate-200">
                <div className="w-16 h-12 rounded overflow-hidden border border-slate-200 shrink-0 bg-slate-100">
                  <JournalPhotoThumbnail
                    url={photoPreviewUrl || documentationUrl}
                    caption={documentationCaption || topic || 'Pratinjau Dokumentasi'}
                    alt={documentationCaption || topic || 'Pratinjau Dokumentasi'}
                    className="w-full h-full"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-[#102D46] truncate">
                    {extractFirestorePhotoId(documentationUrl)
                      ? 'Foto terlampir siap disimpan'
                      : 'Tautan dokumentasi terpasang'}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Klik gambar untuk memperbesar pratinjau.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={clearDocumentationPhoto}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs text-red-700 hover:bg-red-50 cursor-pointer shrink-0"
                  aria-label="Hapus foto dokumentasi"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Hapus Foto</span>
                </button>
              </div>
            )}

            {!extractFirestorePhotoId(documentationUrl) && (
              <div className="space-y-1.5">
                <label htmlFor="j-docurl" className="block text-[11px] font-medium text-slate-600">
                  Atau Tempel Tautan Foto / Google Drive
                </label>
                <input
                  id="j-docurl"
                  type="text"
                  maxLength={JOURNAL_FIELD_LIMITS.documentationUrlMax}
                  value={documentationUrl}
                  onChange={(e) => {
                    setDocumentationUrl(e.target.value);
                    setPhotoPreviewUrl('');
                    setUploadNotice(null);
                  }}
                  placeholder="https://..."
                  className="w-full px-3 py-1.5 rounded-md border border-slate-300 bg-white text-xs font-mono-tabular text-[#102D46]"
                />
              </div>
            )}

            {documentationUrl && (
              <div className="space-y-1.5">
                <label
                  htmlFor="j-doccap"
                  className="block text-[11px] font-medium text-slate-600"
                >
                  Keterangan Dokumentasi
                </label>
                <input
                  id="j-doccap"
                  type="text"
                  maxLength={JOURNAL_FIELD_LIMITS.documentationCaptionMax}
                  value={documentationCaption}
                  onChange={(e) => setDocumentationCaption(e.target.value)}
                  placeholder="Contoh: Praktik instalasi jaringan lokal di Lab TJKT 1"
                  className="w-full px-3 py-1.5 rounded-md border border-slate-300 bg-white text-xs text-[#102D46]"
                />
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={saving || missingMasterData || uploadingPhoto}
            className="w-full min-h-[42px] px-4 py-2.5 rounded-lg bg-[#102D46] hover:bg-[#1C678A] disabled:opacity-65 text-white text-sm font-medium inline-flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>
              {saving
                ? 'Menyimpan Jurnal...'
                : editingJournal
                  ? 'Simpan Perubahan Jurnal'
                  : 'Simpan Jurnal Harian'}
            </span>
          </button>
        </form>

        {/* Riwayat Jurnal */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-5 sm:p-6 space-y-4">
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-base font-semibold text-[#102D46]">
                Riwayat Jurnal Pembelajaran
              </h2>
              <span className="text-xs font-mono-tabular text-slate-500">
                {filteredJournals.length} entri
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-1 p-1 bg-[#F5F7FA] rounded-lg border border-slate-200 w-fit">
              {(
                [
                  { key: 'ALL', label: 'Semua' },
                  { key: TeachingStatus.TERLAKSANA, label: 'Terlaksana' },
                  { key: TeachingStatus.TUGAS_MANDIRI, label: 'Tugas Mandiri' },
                  { key: TeachingStatus.PENGGANTI, label: 'Pengganti' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setStatusFilter(tab.key)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                    statusFilter === tab.key
                      ? 'bg-white text-[#102D46] border border-slate-200'
                      : 'text-slate-600 hover:text-[#102D46]'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="search"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Cari materi, kelas, mapel..."
                  className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-slate-300 text-xs text-[#102D46]"
                />
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
                <input
                  type="date"
                  aria-label="Filter tanggal jurnal"
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-mono-tabular text-[#102D46]"
                />
                {dateFilter && (
                  <button
                    type="button"
                    onClick={() => setDateFilter('')}
                    className="text-xs text-slate-500 hover:text-[#102D46] whitespace-nowrap cursor-pointer"
                  >
                    Reset
                  </button>
                )}
              </div>
            </div>
          </div>

          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-24 bg-slate-100 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : filteredJournals.length === 0 ? (
            <div className="py-12 text-center border border-dashed border-slate-200 rounded-lg space-y-2">
              <BookOpen className="w-6 h-6 text-slate-400 mx-auto" />
              <p className="text-sm font-medium text-[#102D46]">Belum ada catatan jurnal</p>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Mulai catat kegiatan pembelajaran harian Anda melalui formulir di samping.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-200 border border-slate-200 rounded-lg">
              {filteredJournals.map((item) => (
                <article key={item.id} className="p-4 space-y-2.5 hover:bg-slate-50/50">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="space-y-0.5">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 font-mono-tabular">
                        <span className="font-semibold text-[#1C678A]">{item.date}</span>
                        <span aria-hidden="true">·</span>
                        <span>
                          Jam {item.periodStart}–{item.periodEnd}
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
                      <h3 className="text-sm font-semibold text-[#102D46]">{item.subjectName}</h3>
                      {isBootstrappedAdmin && (
                        <p className="text-xs text-slate-500">Guru: {item.teacherName}</p>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {confirmDeleteId === item.id ? (
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
                            disabled={busyId === item.id}
                            onClick={() => void handleDelete(item.id)}
                            className="px-2.5 py-1 rounded bg-red-700 text-white text-xs font-medium cursor-pointer"
                          >
                            Hapus
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => startEdit(item)}
                            className="p-1.5 rounded border border-slate-200 text-slate-600 hover:text-[#102D46] hover:bg-white cursor-pointer"
                            aria-label={`Ubah jurnal ${item.topic}`}
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(item.id)}
                            className="p-1.5 rounded border border-slate-200 text-slate-600 hover:text-red-700 hover:border-red-200 cursor-pointer"
                            aria-label={`Hapus jurnal ${item.topic}`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="space-y-1 text-xs text-slate-700 leading-relaxed">
                    <p>
                      <strong className="text-[#102D46]">Materi:</strong> {item.topic}
                    </p>
                    <p>{item.activities}</p>
                    {item.notes && (
                      <p className="text-slate-500">
                        <strong>Catatan:</strong> {item.notes}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs text-slate-500">
                    <span className="font-mono-tabular">
                      Kehadiran: {item.presentCount} hadir · {item.absentCount} tidak hadir
                    </span>

                    {item.documentationUrl && (
                      <div className="flex items-center gap-2.5">
                        <div className="w-12 h-9 rounded overflow-hidden border border-slate-200 bg-slate-100 shrink-0">
                          <JournalPhotoThumbnail
                            url={item.documentationUrl}
                            caption={item.documentationCaption || item.topic}
                            alt={item.documentationCaption || item.topic}
                            className="w-full h-full"
                          />
                        </div>
                        {!extractFirestorePhotoId(item.documentationUrl) && (
                          <a
                            href={item.documentationUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[#1C678A] hover:underline font-medium"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            <span>Buka Tautan</span>
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </div>

      {supervisions.length > 0 && (
        <section className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-semibold text-[#102D46]">
                Catatan Supervisi Kepala Sekolah
              </h2>
              <p className="text-xs text-slate-500">
                Umpan balik dan arahan pembinaan pembelajaran yang ditujukan kepada Anda
              </p>
            </div>
            <span className="text-xs font-mono-tabular text-slate-500">
              {supervisions.length} catatan
            </span>
          </div>
          <div className="divide-y divide-slate-200 border border-slate-200 rounded-lg">
            {supervisions.map((sup) => (
              <article key={sup.id} className="p-4 space-y-1.5">
                <div className="flex flex-wrap items-center gap-2 text-xs font-mono-tabular text-slate-500">
                  <span className="font-semibold text-[#1C678A]">{sup.periodMonth}</span>
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
                  <span aria-hidden="true">·</span>
                  <span className="font-sans text-slate-600">Oleh: {sup.supervisorName}</span>
                </div>
                <p className="text-xs text-slate-700 leading-relaxed">{sup.notes}</p>
              </article>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
