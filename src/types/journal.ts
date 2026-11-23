import type { Timestamp } from 'firebase/firestore';

export enum TeachingStatus {
  TERLAKSANA = 'TERLAKSANA',
  TUGAS_MANDIRI = 'TUGAS_MANDIRI',
  PENGGANTI = 'PENGGANTI',
}

export const TEACHING_STATUS_LABELS: Record<TeachingStatus, string> = {
  [TeachingStatus.TERLAKSANA]: 'Terlaksana',
  [TeachingStatus.TUGAS_MANDIRI]: 'Tugas Mandiri',
  [TeachingStatus.PENGGANTI]: 'Kelas Pengganti',
};

export const DATE_YYYYMMDD_PATTERN = /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/;

// Synchronized verbatim with firebase-blueprint.json & firestore.rules
export const JOURNAL_FIELD_LIMITS = {
  topicMin: 3,
  topicMax: 300,
  activitiesMin: 5,
  activitiesMax: 1500,
  notesMax: 800,
  documentationUrlMax: 800,
  documentationCaptionMax: 200,
  attendanceMax: 100,
  periodMin: 1,
  periodMax: 16,
} as const;

export interface TeachingJournal {
  id: string;
  academicYearId: string;
  academicYearLabel: string;
  scheduleId: string;
  teacherUid: string;
  teacherName: string;
  classId: string;
  className: string;
  subjectId: string;
  subjectName: string;
  date: string;
  periodStart: number;
  periodEnd: number;
  topic: string;
  activities: string;
  presentCount: number;
  absentCount: number;
  notes: string;
  teachingStatus: TeachingStatus;
  documentationUrl: string;
  documentationCaption: string;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}
