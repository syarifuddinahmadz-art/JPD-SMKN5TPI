import { useEffect, useState } from 'react';
import { collection, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import {
  BookMarked,
  Calendar,
  CalendarDays,
  GraduationCap,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import {
  ApprovalStatus,
  BOOTSTRAPPED_ADMIN_EMAIL,
  type UserProfile,
} from '../../types/auth';
import type {
  AcademicYear,
  SchoolClass,
  Subject,
  Teacher,
  TeachingSchedule,
} from '../../types/masterData';
import { AcademicYearsTab } from './AcademicYearsTab';
import { ClassesTab } from './ClassesTab';
import { SchedulesTab } from './SchedulesTab';
import { SubjectsTab } from './SubjectsTab';
import { TeachersTab } from './TeachersTab';

type MasterTabKey = 'years' | 'teachers' | 'classes' | 'subjects' | 'schedules';

export function MasterDataHub() {
  const { firebaseUser } = useAuth();
  const [activeTab, setActiveTab] = useState<MasterTabKey>('years');

  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [schedules, setSchedules] = useState<TeachingSchedule[]>([]);
  const [approvedUsers, setApprovedUsers] = useState<UserProfile[]>([]);

  const [loadingYears, setLoadingYears] = useState(true);
  const [loadingTeachers, setLoadingTeachers] = useState(true);
  const [loadingClasses, setLoadingClasses] = useState(true);
  const [loadingSubjects, setLoadingSubjects] = useState(true);
  const [loadingSchedules, setLoadingSchedules] = useState(true);

  const isBootstrappedAdmin =
    firebaseUser?.email === BOOTSTRAPPED_ADMIN_EMAIL && firebaseUser.emailVerified;

  useEffect(() => {
    if (!isBootstrappedAdmin) {
      setLoadingYears(false);
      setLoadingTeachers(false);
      setLoadingClasses(false);
      setLoadingSubjects(false);
      setLoadingSchedules(false);
      return;
    }

    const unsubYears = onSnapshot(
      query(collection(db, 'academicYears'), orderBy('name', 'desc')),
      (snap) => {
        setAcademicYears(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<AcademicYear, 'id'>) })));
        setLoadingYears(false);
      },
      (error) => {
        setLoadingYears(false);
        handleFirestoreError(error, OperationType.LIST, 'academicYears');
      },
    );

    const unsubTeachers = onSnapshot(
      query(collection(db, 'teachers'), orderBy('fullName', 'asc')),
      (snap) => {
        setTeachers(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Teacher, 'id'>) })));
        setLoadingTeachers(false);
      },
      (error) => {
        setLoadingTeachers(false);
        handleFirestoreError(error, OperationType.LIST, 'teachers');
      },
    );

    const unsubClasses = onSnapshot(
      query(collection(db, 'classes'), orderBy('name', 'asc')),
      (snap) => {
        setClasses(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<SchoolClass, 'id'>) })));
        setLoadingClasses(false);
      },
      (error) => {
        setLoadingClasses(false);
        handleFirestoreError(error, OperationType.LIST, 'classes');
      },
    );

    const unsubSubjects = onSnapshot(
      query(collection(db, 'subjects'), orderBy('name', 'asc')),
      (snap) => {
        setSubjects(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Subject, 'id'>) })));
        setLoadingSubjects(false);
      },
      (error) => {
        setLoadingSubjects(false);
        handleFirestoreError(error, OperationType.LIST, 'subjects');
      },
    );

    const unsubSchedules = onSnapshot(
      query(collection(db, 'schedules'), orderBy('createdAt', 'desc')),
      (snap) => {
        setSchedules(
          snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<TeachingSchedule, 'id'>) })),
        );
        setLoadingSchedules(false);
      },
      (error) => {
        setLoadingSchedules(false);
        handleFirestoreError(error, OperationType.LIST, 'schedules');
      },
    );

    const unsubUsers = onSnapshot(
      query(collection(db, 'users'), where('approvalStatus', '==', ApprovalStatus.APPROVED)),
      (snap) => {
        setApprovedUsers(snap.docs.map((d) => d.data() as UserProfile));
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'users');
      },
    );

    return () => {
      unsubYears();
      unsubTeachers();
      unsubClasses();
      unsubSubjects();
      unsubSchedules();
      unsubUsers();
    };
  }, [isBootstrappedAdmin]);

  if (!isBootstrappedAdmin) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-3">
        <div className="flex items-center gap-2.5 text-[#102D46]">
          <ShieldCheck className="w-5 h-5 text-[#1C678A]" />
          <h2 className="text-base font-semibold">Akses Data Master Terbatas</h2>
        </div>
        <p className="text-sm text-slate-600 leading-relaxed">
          Untuk menjaga isolasi data PII dan kepatuhan Firestore Security Rules, pengelolaan
          daftar lengkap Data Master saat ini dibuka untuk Administrator Utama (
          <span className="font-mono-tabular">{BOOTSTRAPPED_ADMIN_EMAIL}</span>).
        </p>
      </div>
    );
  }

  const tabs = [
    {
      key: 'years' as const,
      label: 'Tahun Ajaran',
      count: academicYears.length,
      icon: Calendar,
    },
    {
      key: 'teachers' as const,
      label: 'Data Guru',
      count: teachers.length,
      icon: Users,
    },
    {
      key: 'classes' as const,
      label: 'Kelas & Jurusan',
      count: classes.length,
      icon: GraduationCap,
    },
    {
      key: 'subjects' as const,
      label: 'Mata Pelajaran',
      count: subjects.length,
      icon: BookMarked,
    },
    {
      key: 'schedules' as const,
      label: 'Jadwal Mengajar',
      count: schedules.length,
      icon: CalendarDays,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
        <div className="space-y-1">
          <p className="text-xs font-semibold text-[#16A6A0] uppercase tracking-wider">
            SMK Negeri 5 Tanjungpinang · Pengelolaan Data Master
          </p>
          <h1 className="text-xl font-bold tracking-tight text-[#102D46]">
            Data Master Akademik SMK Negeri 5 Tanjungpinang
          </h1>
          <p className="text-sm text-slate-600">
            Kelola tahun ajaran aktif, data induk guru, kelas, mata pelajaran, dan jadwal mengajar
            sebagai fondasi pencatatan jurnal pembelajaran harian.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 p-1 bg-[#F5F7FA] rounded-lg border border-slate-200 w-fit">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`inline-flex items-center gap-2 px-3 py-2 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  isActive
                    ? 'bg-white text-[#102D46] border border-slate-200'
                    : 'text-slate-600 hover:text-[#102D46]'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
                <span className="font-mono-tabular text-[11px] text-slate-400">({tab.count})</span>
              </button>
            );
          })}
        </div>
      </div>

      {activeTab === 'years' && (
        <AcademicYearsTab academicYears={academicYears} loading={loadingYears} />
      )}
      {activeTab === 'teachers' && (
        <TeachersTab
          teachers={teachers}
          approvedUsers={approvedUsers}
          loading={loadingTeachers}
        />
      )}
      {activeTab === 'classes' && (
        <ClassesTab classes={classes} teachers={teachers} loading={loadingClasses} />
      )}
      {activeTab === 'subjects' && (
        <SubjectsTab subjects={subjects} loading={loadingSubjects} />
      )}
      {activeTab === 'schedules' && (
        <SchedulesTab
          schedules={schedules}
          academicYears={academicYears}
          teachers={teachers}
          classes={classes}
          subjects={subjects}
          loading={loadingSchedules}
        />
      )}
    </div>
  );
}
