import React, { useEffect, useMemo, useState } from 'react';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import { AlertTriangle, Pencil, Plus, Trash2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import {
  DAY_LABELS,
  DAY_ORDER,
  DayOfWeek,
  EntityStatus,
  MASTER_FIELD_LIMITS,
  SEMESTER_LABELS,
  STATUS_LABELS,
  TIME_HHMM_PATTERN,
  type AcademicYear,
  type SchoolClass,
  type Subject,
  type Teacher,
  type TeachingSchedule,
} from '../../types/masterData';

interface SchedulesTabProps {
  schedules: TeachingSchedule[];
  academicYears: AcademicYear[];
  teachers: Teacher[];
  classes: SchoolClass[];
  subjects: Subject[];
  loading: boolean;
}

export function SchedulesTab({
  schedules,
  academicYears,
  teachers,
  classes,
  subjects,
  loading,
}: SchedulesTabProps) {
  const { firebaseUser } = useAuth();
  const activeYear = useMemo(
    () => academicYears.find((y) => y.isActive) ?? academicYears[0] ?? null,
    [academicYears],
  );
  const activeTeachers = useMemo(
    () => teachers.filter((t) => t.status === EntityStatus.AKTIF),
    [teachers],
  );
  const activeClasses = useMemo(
    () => classes.filter((c) => c.status === EntityStatus.AKTIF),
    [classes],
  );
  const activeSubjects = useMemo(
    () => subjects.filter((s) => s.status === EntityStatus.AKTIF),
    [subjects],
  );

  const [editingItem, setEditingItem] = useState<TeachingSchedule | null>(null);
  const [academicYearId, setAcademicYearId] = useState('');
  const [teacherId, setTeacherId] = useState('');
  const [classId, setClassId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [dayOfWeek, setDayOfWeek] = useState<DayOfWeek>(DayOfWeek.SENIN);
  const [periodStart, setPeriodStart] = useState('1');
  const [periodEnd, setPeriodEnd] = useState('2');
  const [startTime, setStartTime] = useState('07:30');
  const [endTime, setEndTime] = useState('09:00');
  const [room, setRoom] = useState('');
  const [status, setStatus] = useState<EntityStatus>(EntityStatus.AKTIF);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [dayFilter, setDayFilter] = useState<'ALL' | DayOfWeek>('ALL');
  const [classFilter, setClassFilter] = useState<string>('ALL');
  const [teacherFilter, setTeacherFilter] = useState<string>('ALL');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (!academicYearId && activeYear) {
      setAcademicYearId(activeYear.id);
    }
  }, [academicYearId, activeYear]);

  const resetForm = () => {
    setEditingItem(null);
    setAcademicYearId(activeYear?.id ?? '');
    setTeacherId('');
    setClassId('');
    setSubjectId('');
    setDayOfWeek(DayOfWeek.SENIN);
    setPeriodStart('1');
    setPeriodEnd('2');
    setStartTime('07:30');
    setEndTime('09:00');
    setRoom('');
    setStatus(EntityStatus.AKTIF);
    setFormError(null);
  };

  const startEdit = (item: TeachingSchedule) => {
    setEditingItem(item);
    setAcademicYearId(item.academicYearId);
    setTeacherId(item.teacherId);
    setClassId(item.classId);
    setSubjectId(item.subjectId);
    setDayOfWeek(item.dayOfWeek);
    setPeriodStart(String(item.periodStart));
    setPeriodEnd(String(item.periodEnd));
    setStartTime(item.startTime);
    setEndTime(item.endTime);
    setRoom(item.room);
    setStatus(item.status);
    setFormError(null);
  };

  const conflictWarning = useMemo(() => {
    if (!academicYearId || (!teacherId && !classId)) return null;
    const pStart = Number.parseInt(periodStart, 10);
    const pEnd = Number.parseInt(periodEnd, 10);
    if (Number.isNaN(pStart) || Number.isNaN(pEnd)) return null;

    const overlapping = schedules.find((s) => {
      if (editingItem && s.id === editingItem.id) return false;
      if (s.status !== EntityStatus.AKTIF) return false;
      if (s.academicYearId !== academicYearId || s.dayOfWeek !== dayOfWeek) return false;
      const overlapsPeriod = pStart <= s.periodEnd && pEnd >= s.periodStart;
      if (!overlapsPeriod) return false;
      return (teacherId && s.teacherId === teacherId) || (classId && s.classId === classId);
    });

    if (!overlapping) return null;
    if (teacherId && overlapping.teacherId === teacherId) {
      return `Bentrok jadwal guru: ${overlapping.teacherName} sudah terjadwal di kelas ${overlapping.className} pada jam ke-${overlapping.periodStart}–${overlapping.periodEnd}.`;
    }
    return `Bentrok jadwal kelas: ${overlapping.className} sudah memiliki jadwal ${overlapping.subjectName} pada jam ke-${overlapping.periodStart}–${overlapping.periodEnd}.`;
  }, [schedules, editingItem, academicYearId, teacherId, classId, dayOfWeek, periodStart, periodEnd]);

  const filteredSchedules = useMemo(() => {
    return schedules
      .filter((s) => {
        if (dayFilter !== 'ALL' && s.dayOfWeek !== dayFilter) return false;
        if (classFilter !== 'ALL' && s.classId !== classFilter) return false;
        if (teacherFilter !== 'ALL' && s.teacherId !== teacherFilter) return false;
        return true;
      })
      .sort((a, b) => {
        const dayDiff = DAY_ORDER.indexOf(a.dayOfWeek) - DAY_ORDER.indexOf(b.dayOfWeek);
        if (dayDiff !== 0) return dayDiff;
        return a.periodStart - b.periodStart;
      });
  }, [schedules, dayFilter, classFilter, teacherFilter]);

  const prerequisitesMissing =
    academicYears.length === 0 ||
    activeTeachers.length === 0 ||
    activeClasses.length === 0 ||
    activeSubjects.length === 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firebaseUser) return;

    const selectedYear = academicYears.find((y) => y.id === academicYearId);
    const selectedTeacher = teachers.find((t) => t.id === teacherId);
    const selectedClass = classes.find((c) => c.id === classId);
    const selectedSubject = subjects.find((s) => s.id === subjectId);

    if (!selectedYear || !selectedTeacher || !selectedClass || !selectedSubject) {
      setFormError('Lengkapi pilihan Tahun Ajaran, Guru, Kelas, dan Mata Pelajaran.');
      return;
    }

    const pStart = Number.parseInt(periodStart, 10);
    const pEnd = Number.parseInt(periodEnd, 10);
    if (
      Number.isNaN(pStart) ||
      Number.isNaN(pEnd) ||
      pStart < MASTER_FIELD_LIMITS.periodMin ||
      pEnd > MASTER_FIELD_LIMITS.periodMax ||
      pEnd < pStart
    ) {
      setFormError('Rentang jam pelajaran (jam ke-) harus antara 1 sampai 16 dan Jam Selesai >= Jam Mulai.');
      return;
    }

    const cleanStart = startTime.trim();
    const cleanEnd = endTime.trim();
    if (!TIME_HHMM_PATTERN.test(cleanStart) || !TIME_HHMM_PATTERN.test(cleanEnd)) {
      setFormError('Format waktu harus HH:MM (contoh: 07:30).');
      return;
    }
    if (cleanEnd <= cleanStart) {
      setFormError('Waktu selesai harus lebih besar dari waktu mulai.');
      return;
    }

    setSaving(true);
    setFormError(null);

    const payload = {
      academicYearId: selectedYear.id,
      academicYearLabel: `${selectedYear.name} · ${SEMESTER_LABELS[selectedYear.semester]}`,
      teacherId: selectedTeacher.id,
      teacherName: selectedTeacher.fullName,
      teacherUid: selectedTeacher.userUid,
      classId: selectedClass.id,
      className: selectedClass.name,
      subjectId: selectedSubject.id,
      subjectName: selectedSubject.name,
      dayOfWeek,
      periodStart: pStart,
      periodEnd: pEnd,
      startTime: cleanStart,
      endTime: cleanEnd,
      room: room.trim().slice(0, MASTER_FIELD_LIMITS.roomMax),
      status,
      updatedAt: serverTimestamp(),
    };

    try {
      if (editingItem) {
        await updateDoc(doc(db, 'schedules', editingItem.id), payload);
      } else {
        await addDoc(collection(db, 'schedules'), {
          ...payload,
          createdBy: firebaseUser.uid,
          createdAt: serverTimestamp(),
        });
      }
      resetForm();
    } catch (error) {
      handleFirestoreError(
        error,
        editingItem ? OperationType.UPDATE : OperationType.CREATE,
        editingItem ? `schedules/${editingItem.id}` : 'schedules',
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    setBusyId(id);
    try {
      await deleteDoc(doc(db, 'schedules', id));
      setConfirmDeleteId(null);
      if (editingItem?.id === id) resetForm();
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `schedules/${id}`);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      <form
        onSubmit={(e) => void handleSubmit(e)}
        className="lg:col-span-4 bg-white border border-slate-200 rounded-xl p-5 space-y-4"
      >
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-[#102D46]">
            {editingItem ? 'Ubah Jadwal Mengajar' : 'Tambah Jadwal Mengajar'}
          </h3>
          {editingItem && (
            <button
              type="button"
              onClick={resetForm}
              className="text-xs text-slate-500 hover:text-[#102D46] cursor-pointer"
            >
              Batal
            </button>
          )}
        </div>

        {prerequisitesMissing && (
          <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900 leading-relaxed">
            Pastikan data <strong>Tahun Ajaran</strong>, <strong>Guru (Aktif)</strong>,{' '}
            <strong>Kelas (Aktif)</strong>, dan <strong>Mata Pelajaran (Aktif)</strong> sudah diisi
            sebelum membuat jadwal.
          </div>
        )}

        {formError && (
          <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg p-2.5">
            {formError}
          </p>
        )}

        {conflictWarning && (
          <div className="flex items-start gap-2 p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-700" />
            <span>{conflictWarning}</span>
          </div>
        )}

        <div className="space-y-1.5">
          <label htmlFor="sch-year" className="block text-xs font-medium text-slate-700">
            Tahun Ajaran & Semester <span className="text-red-600">*</span>
          </label>
          <select
            id="sch-year"
            required
            value={academicYearId}
            onChange={(e) => setAcademicYearId(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm text-[#102D46] bg-white focus:outline-none focus:border-[#1C678A]"
          >
            <option value="">Pilih periode semester</option>
            {academicYears.map((y) => (
              <option key={y.id} value={y.id}>
                {y.name} · {SEMESTER_LABELS[y.semester]} {y.isActive ? '(Aktif)' : ''}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="sch-teacher" className="block text-xs font-medium text-slate-700">
            Guru Pengampu <span className="text-red-600">*</span>
          </label>
          <select
            id="sch-teacher"
            required
            value={teacherId}
            onChange={(e) => setTeacherId(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm text-[#102D46] bg-white focus:outline-none focus:border-[#1C678A]"
          >
            <option value="">Pilih guru</option>
            {activeTeachers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.fullName}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="sch-class" className="block text-xs font-medium text-slate-700">
            Kelas <span className="text-red-600">*</span>
          </label>
          <select
            id="sch-class"
            required
            value={classId}
            onChange={(e) => setClassId(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm text-[#102D46] bg-white focus:outline-none focus:border-[#1C678A]"
          >
            <option value="">Pilih kelas</option>
            {activeClasses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} — {c.major}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="sch-subject" className="block text-xs font-medium text-slate-700">
            Mata Pelajaran <span className="text-red-600">*</span>
          </label>
          <select
            id="sch-subject"
            required
            value={subjectId}
            onChange={(e) => setSubjectId(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm text-[#102D46] bg-white focus:outline-none focus:border-[#1C678A]"
          >
            <option value="">Pilih mata pelajaran</option>
            {activeSubjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.code} · {s.name}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-3 gap-2.5">
          <div className="space-y-1.5">
            <label htmlFor="sch-day" className="block text-xs font-medium text-slate-700">
              Hari
            </label>
            <select
              id="sch-day"
              value={dayOfWeek}
              onChange={(e) => setDayOfWeek(e.target.value as DayOfWeek)}
              className="w-full px-2.5 py-2 rounded-lg border border-slate-300 text-sm text-[#102D46] bg-white focus:outline-none focus:border-[#1C678A]"
            >
              {DAY_ORDER.map((day) => (
                <option key={day} value={day}>
                  {DAY_LABELS[day]}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="sch-pstart" className="block text-xs font-medium text-slate-700">
              Jam Ke-
            </label>
            <input
              id="sch-pstart"
              type="number"
              min={1}
              max={16}
              value={periodStart}
              onChange={(e) => setPeriodStart(e.target.value)}
              className="w-full px-2.5 py-2 rounded-lg border border-slate-300 text-sm font-mono-tabular text-[#102D46]"
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="sch-pend" className="block text-xs font-medium text-slate-700">
              Sampai Ke-
            </label>
            <input
              id="sch-pend"
              type="number"
              min={1}
              max={16}
              value={periodEnd}
              onChange={(e) => setPeriodEnd(e.target.value)}
              className="w-full px-2.5 py-2 rounded-lg border border-slate-300 text-sm font-mono-tabular text-[#102D46]"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label htmlFor="sch-tstart" className="block text-xs font-medium text-slate-700">
              Waktu Mulai
            </label>
            <input
              id="sch-tstart"
              type="time"
              required
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm font-mono-tabular text-[#102D46]"
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="sch-tend" className="block text-xs font-medium text-slate-700">
              Waktu Selesai
            </label>
            <input
              id="sch-tend"
              type="time"
              required
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm font-mono-tabular text-[#102D46]"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label htmlFor="sch-room" className="block text-xs font-medium text-slate-700">
              Ruang / Lab / Bengkel
            </label>
            <input
              id="sch-room"
              type="text"
              maxLength={MASTER_FIELD_LIMITS.roomMax}
              value={room}
              onChange={(e) => setRoom(e.target.value)}
              placeholder="Lab TJKT 1"
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm text-[#102D46]"
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="sch-status" className="block text-xs font-medium text-slate-700">
              Status
            </label>
            <select
              id="sch-status"
              value={status}
              onChange={(e) => setStatus(e.target.value as EntityStatus)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm text-[#102D46] bg-white"
            >
              <option value={EntityStatus.AKTIF}>Aktif</option>
              <option value={EntityStatus.NONAKTIF}>Nonaktif</option>
            </select>
          </div>
        </div>

        <button
          type="submit"
          disabled={saving || prerequisitesMissing}
          className="w-full min-h-[40px] px-4 py-2 rounded-lg bg-[#102D46] hover:bg-[#1C678A] disabled:opacity-65 text-white text-xs font-medium inline-flex items-center justify-center gap-2 transition-colors cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>{saving ? 'Menyimpan...' : editingItem ? 'Simpan Perubahan' : 'Simpan Jadwal'}</span>
        </button>
      </form>

      <div className="lg:col-span-8 bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-1 p-1 bg-[#F5F7FA] rounded-lg border border-slate-200 w-fit">
            <button
              type="button"
              onClick={() => setDayFilter('ALL')}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                dayFilter === 'ALL'
                  ? 'bg-white text-[#102D46] border border-slate-200'
                  : 'text-slate-600 hover:text-[#102D46]'
              }`}
            >
              Semua Hari
            </button>
            {DAY_ORDER.map((day) => (
              <button
                key={day}
                type="button"
                onClick={() => setDayFilter(day)}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                  dayFilter === day
                    ? 'bg-white text-[#102D46] border border-slate-200'
                    : 'text-slate-600 hover:text-[#102D46]'
                }`}
              >
                {DAY_LABELS[day]}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <select
              aria-label="Filter berdasarkan kelas"
              value={classFilter}
              onChange={(e) => setClassFilter(e.target.value)}
              className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs text-[#102D46] bg-white"
            >
              <option value="ALL">Semua Kelas</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <select
              aria-label="Filter berdasarkan guru"
              value={teacherFilter}
              onChange={(e) => setTeacherFilter(e.target.value)}
              className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs text-[#102D46] bg-white"
            >
              <option value="ALL">Semua Guru</option>
              {teachers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.fullName}
                </option>
              ))}
            </select>
          </div>
        </div>

        {loading ? (
          <div className="space-y-2.5">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 bg-slate-100 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : filteredSchedules.length === 0 ? (
          <div className="py-10 text-center border border-dashed border-slate-200 rounded-lg space-y-1">
            <p className="text-sm font-medium text-[#102D46]">Belum ada jadwal mengajar</p>
            <p className="text-xs text-slate-500">
              Susun jadwal mengajar untuk guru dan kelas agar dapat dipilih otomatis saat pencatatan
              jurnal pembelajaran harian.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto border border-slate-200 rounded-lg">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-[#F5F7FA] border-b border-slate-200 text-xs font-semibold text-slate-600">
                  <th className="py-2.5 px-4">Hari & Jam</th>
                  <th className="py-2.5 px-4">Kelas & Ruang</th>
                  <th className="py-2.5 px-4">Mata Pelajaran & Guru</th>
                  <th className="py-2.5 px-4">Status</th>
                  <th className="py-2.5 px-4 text-right">Tindakan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredSchedules.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/70">
                    <td className="py-3 px-4 align-top whitespace-nowrap">
                      <p className="font-medium text-[#102D46]">{DAY_LABELS[item.dayOfWeek]}</p>
                      <p className="text-xs font-mono-tabular text-slate-500">
                        Jam {item.periodStart}–{item.periodEnd} · {item.startTime}–{item.endTime}
                      </p>
                    </td>
                    <td className="py-3 px-4 align-top">
                      <p className="font-medium text-[#102D46]">{item.className}</p>
                      <p className="text-xs text-slate-500">{item.room || 'Ruang belum diisi'}</p>
                    </td>
                    <td className="py-3 px-4 align-top">
                      <p className="font-medium text-[#102D46]">{item.subjectName}</p>
                      <p className="text-xs text-slate-500">{item.teacherName}</p>
                    </td>
                    <td className="py-3 px-4 align-top">
                      <span
                        className={`text-xs font-medium ${
                          item.status === EntityStatus.AKTIF ? 'text-emerald-700' : 'text-slate-500'
                        }`}
                      >
                        {STATUS_LABELS[item.status]}
                      </span>
                    </td>
                    <td className="py-3 px-4 align-top text-right">
                      {confirmDeleteId === item.id ? (
                        <div className="inline-flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(null)}
                            className="text-xs text-slate-600 cursor-pointer"
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
                        </div>
                      ) : (
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => startEdit(item)}
                            className="p-1.5 rounded border border-slate-200 text-slate-600 hover:text-[#102D46] hover:bg-slate-50 cursor-pointer"
                            aria-label={`Ubah jadwal ${item.className}`}
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(item.id)}
                            className="p-1.5 rounded border border-slate-200 text-slate-600 hover:text-red-700 hover:border-red-200 cursor-pointer"
                            aria-label={`Hapus jadwal ${item.className}`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
