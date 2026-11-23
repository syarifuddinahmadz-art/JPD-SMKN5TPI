import type { Timestamp } from 'firebase/firestore';

export enum SupervisionStatus {
  BAIK = 'BAIK',
  PERLU_PEMBINAAN = 'PERLU_PEMBINAAN',
  TINDAK_LANJUT = 'TINDAK_LANJUT',
}

export const SUPERVISION_STATUS_LABELS: Record<SupervisionStatus, string> = {
  [SupervisionStatus.BAIK]: 'Baik / Sesuai Standar',
  [SupervisionStatus.PERLU_PEMBINAAN]: 'Perlu Pembinaan',
  [SupervisionStatus.TINDAK_LANJUT]: 'Tindak Lanjut Segera',
};

export const MONTH_YYYYMM_PATTERN = /^[0-9]{4}-(0[1-9]|1[0-2])$/;

// Synchronized verbatim with firebase-blueprint.json & firestore.rules
export const SUPERVISION_FIELD_LIMITS = {
  academicYearLabelMax: 50,
  teacherNameMin: 2,
  teacherNameMax: 100,
  supervisorNameMin: 2,
  supervisorNameMax: 100,
  notesMin: 5,
  notesMax: 1000,
} as const;

export interface PrincipalSupervision {
  id: string;
  academicYearId: string;
  academicYearLabel: string;
  journalId: string;
  teacherUid: string;
  teacherName: string;
  periodMonth: string;
  supervisionStatus: SupervisionStatus;
  notes: string;
  supervisorUid: string;
  supervisorName: string;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}
