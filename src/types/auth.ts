import type { Timestamp } from 'firebase/firestore';

export enum UserRole {
  ADMIN = 'ADMIN',
  GURU = 'GURU',
  KEPALA_SEKOLAH = 'KEPALA_SEKOLAH',
  PENDING = 'PENDING',
}

export enum RequestedRole {
  ADMIN = 'ADMIN',
  GURU = 'GURU',
  KEPALA_SEKOLAH = 'KEPALA_SEKOLAH',
}

export enum ApprovalStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

export const BOOTSTRAPPED_ADMIN_EMAIL = 'syarifuddinahmadz@gmail.com';

// Synchronized verbatim with firebase-blueprint.json & firestore.rules
export const UID_PATTERN = /^[a-zA-Z0-9_-]+$/;

export const FIELD_LIMITS = {
  uidMax: 128,
  emailMax: 254,
  displayNameMin: 2,
  displayNameMax: 100,
  photoURLMax: 500,
  nipMax: 30,
  jabatanMax: 100,
  rejectionReasonMax: 300,
} as const;

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
  nip: string;
  jabatan: string;
  requestedRole: RequestedRole;
  role: UserRole;
  approvalStatus: ApprovalStatus;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
  approvedBy?: string;
  rejectionReason?: string;
}

export const ROLE_LABELS: Record<UserRole | RequestedRole, string> = {
  [UserRole.ADMIN]: 'Administrator',
  [UserRole.GURU]: 'Guru',
  [UserRole.KEPALA_SEKOLAH]: 'Kepala Sekolah',
  [UserRole.PENDING]: 'Menunggu Verifikasi',
};

export const APPROVAL_STATUS_LABELS: Record<ApprovalStatus, string> = {
  [ApprovalStatus.PENDING]: 'Menunggu Persetujuan',
  [ApprovalStatus.APPROVED]: 'Disetujui',
  [ApprovalStatus.REJECTED]: 'Ditolak',
};
