import { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { CalendarDays } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import {
  DAY_LABELS,
  DAY_ORDER,
  DayOfWeek,
  EntityStatus,
  type TeachingSchedule,
} from '../types/masterData';

export function TeacherScheduleView() {
  const { firebaseUser } = useAuth();
  const [schedules, setSchedules] = useState<TeachingSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [dayFilter, setDayFilter] = useState<'ALL' | DayOfWeek>('ALL');

  useEffect(() => {
    if (!firebaseUser) return;

    const q = query(
      collection(db, 'schedules'),
      where('teacherUid', '==', firebaseUser.uid),
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs
          .map((d) => ({ id: d.id, ...(d.data() as Omit<TeachingSchedule, 'id'>) }))
          .filter((item) => item.status === EntityStatus.AKTIF);
        setSchedules(list);
        setLoading(false);
      },
      (error) => {
        setLoading(false);
        handleFirestoreError(error, OperationType.LIST, 'schedules');
      },
    );

    return () => unsub();
  }, [firebaseUser]);

  const filtered = useMemo(() => {
    return schedules
      .filter((s) => dayFilter === 'ALL' || s.dayOfWeek === dayFilter)
      .sort((a, b) => {
        const dayDiff = DAY_ORDER.indexOf(a.dayOfWeek) - DAY_ORDER.indexOf(b.dayOfWeek);
        if (dayDiff !== 0) return dayDiff;
        return a.periodStart - b.periodStart;
      });
  }, [schedules, dayFilter]);

  return (
    <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className="w-10 h-10 rounded-lg bg-[#102D46]/5 border border-slate-200 flex items-center justify-center shrink-0">
            <CalendarDays className="w-5 h-5 text-[#1C678A]" />
          </div>
          <div className="space-y-1">
            <h1 className="text-lg font-bold text-[#102D46]">Jadwal Mengajar Anda</h1>
            <p className="text-sm text-slate-600">
              Jadwal resmi yang ditetapkan Administrator untuk akun Anda.
            </p>
          </div>
        </div>
        <span className="text-xs font-mono-tabular text-slate-500">
          {filtered.length} sesi aktif
        </span>
      </div>

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

      {loading ? (
        <div className="space-y-2.5">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-12 bg-slate-100 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-10 text-center border border-dashed border-slate-200 rounded-lg space-y-1.5">
          <p className="text-sm font-medium text-[#102D46]">Belum ada jadwal tertaut</p>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Pastikan Administrator telah menautkan data guru dengan akun Google Anda dan
            menambahkan jadwal mengajar pada menu Data Master.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto border border-slate-200 rounded-lg">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-[#F5F7FA] border-b border-slate-200 text-xs font-semibold text-slate-600">
                <th className="py-2.5 px-4">Hari & Jam</th>
                <th className="py-2.5 px-4">Kelas</th>
                <th className="py-2.5 px-4">Mata Pelajaran</th>
                <th className="py-2.5 px-4">Ruang</th>
                <th className="py-2.5 px-4">Periode</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filtered.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50/70">
                  <td className="py-3 px-4 whitespace-nowrap">
                    <p className="font-medium text-[#102D46]">{DAY_LABELS[item.dayOfWeek]}</p>
                    <p className="text-xs font-mono-tabular text-slate-500">
                      Jam {item.periodStart}–{item.periodEnd} · {item.startTime}–{item.endTime}
                    </p>
                  </td>
                  <td className="py-3 px-4 font-medium text-[#102D46]">{item.className}</td>
                  <td className="py-3 px-4 text-slate-700">{item.subjectName}</td>
                  <td className="py-3 px-4 text-xs text-slate-600">{item.room || '—'}</td>
                  <td className="py-3 px-4 text-xs font-mono-tabular text-slate-500">
                    {item.academicYearLabel}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
