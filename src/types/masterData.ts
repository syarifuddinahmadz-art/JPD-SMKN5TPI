import type { Timestamp } from 'firebase/firestore';

export enum SemesterType {
  GANJIL = 'GANJIL',
  GENAP = 'GENAP',
}

export enum EntityStatus {
  AKTIF = 'AKTIF',
  NONAKTIF = 'NONAKTIF',
}

export enum GradeLevel {
  X = 'X',
  XI = 'XI',
  XII = 'XII',
  XIII = 'XIII',
}

export enum SubjectCategory {
  UMUM = 'UMUM',
  KEJURUAN = 'KEJURUAN',
  MUATAN_LOKAL = 'MUATAN_LOKAL',
  PROJEK_P5 = 'PROJEK_P5',
}

export enum DayOfWeek {
  SENIN = 'SENIN',
  SELASA = 'SELASA',
  RABU = 'RABU',
  KAMIS = 'KAMIS',
  JUMAT = 'JUMAT',
  SABTU = 'SABTU',
}

export const TIME_HHMM_PATTERN = /^([01][0-9]|2[0-3]):[0-5][0-9]$/;

export const MASTER_FIELD_LIMITS = {
  yearNameMin: 4,
  yearNameMax: 30,
  teacherNameMin: 2,
  teacherNameMax: 100,
  nipMax: 30,
  emailMax: 254,
  specialtyMax: 100,
  classNameMin: 2,
  classNameMax: 50,
  majorMin: 2,
  majorMax: 100,
  studentCountMax: 100,
  subjectCodeMin: 2,
  subjectCodeMax: 30,
  subjectNameMin: 2,
  subjectNameMax: 120,
  roomMax: 60,
  periodMin: 1,
  periodMax: 16,
} as const;

export interface AcademicYear {
  id: string;
  name: string;
  semester: SemesterType;
  isActive: boolean;
  createdBy: string;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

export interface Teacher {
  id: string;
  userUid: string;
  fullName: string;
  nip: string;
  email: string;
  specialty: string;
  status: EntityStatus;
  createdBy: string;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

export interface SchoolClass {
  id: string;
  name: string;
  gradeLevel: GradeLevel;
  major: string;
  homeroomTeacherId: string;
  homeroomTeacherName: string;
  studentCount: number;
  status: EntityStatus;
  createdBy: string;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

export interface Subject {
  id: string;
  code: string;
  name: string;
  category: SubjectCategory;
  status: EntityStatus;
  createdBy: string;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

export interface TeachingSchedule {
  id: string;
  academicYearId: string;
  academicYearLabel: string;
  teacherId: string;
  teacherName: string;
  teacherUid: string;
  classId: string;
  className: string;
  subjectId: string;
  subjectName: string;
  dayOfWeek: DayOfWeek;
  periodStart: number;
  periodEnd: number;
  startTime: string;
  endTime: string;
  room: string;
  status: EntityStatus;
  createdBy: string;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

export const SEMESTER_LABELS: Record<SemesterType, string> = {
  [SemesterType.GANJIL]: 'Ganjil',
  [SemesterType.GENAP]: 'Genap',
};

export const STATUS_LABELS: Record<EntityStatus, string> = {
  [EntityStatus.AKTIF]: 'Aktif',
  [EntityStatus.NONAKTIF]: 'Nonaktif',
};

export const SUBJECT_CATEGORY_LABELS: Record<SubjectCategory, string> = {
  [SubjectCategory.UMUM]: 'Muatan Umum',
  [SubjectCategory.KEJURUAN]: 'Konsentrasi Kejuruan',
  [SubjectCategory.MUATAN_LOKAL]: 'Muatan Lokal',
  [SubjectCategory.PROJEK_P5]: 'Projek Penguatan P5',
};

export const DAY_LABELS: Record<DayOfWeek, string> = {
  [DayOfWeek.SENIN]: 'Senin',
  [DayOfWeek.SELASA]: 'Selasa',
  [DayOfWeek.RABU]: 'Rabu',
  [DayOfWeek.KAMIS]: 'Kamis',
  [DayOfWeek.JUMAT]: 'Jumat',
  [DayOfWeek.SABTU]: 'Sabtu',
};

export const DAY_ORDER: DayOfWeek[] = [
  DayOfWeek.SENIN,
  DayOfWeek.SELASA,
  DayOfWeek.RABU,
  DayOfWeek.KAMIS,
  DayOfWeek.JUMAT,
  DayOfWeek.SABTU,
];
