import { useEffect, useMemo, useState } from 'react';
import {
  collection,
  deleteField,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import { Check, Search, ShieldCheck, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import {
  ApprovalStatus,
  APPROVAL_STATUS_LABELS,
  BOOTSTRAPPED_ADMIN_EMAIL,
  FIELD_LIMITS,
  RequestedRole,
  ROLE_LABELS,
  UserRole,
  type UserProfile,
} from '../types/auth';

type FilterTab = 'ALL' | ApprovalStatus;

export function AdminApprovalPanel() {
  const { firebaseUser, profile } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterTab, setFilterTab] = useState<FilterTab>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [roleSelections, setRoleSelections] = useState<Record<string, RequestedRole>>({});
  const [rejectingUid, setRejectingUid] = useState<string | null>(null);
  const [rejectionInput, setRejectionInput] = useState('');
  const [busyUid, setBusyUid] = useState<string | null>(null);

  const canListAllUsers =
    firebaseUser?.email === BOOTSTRAPPED_ADMIN_EMAIL && firebaseUser.emailVerified;

  useEffect(() => {
    if (!canListAllUsers) {
      setLoading(false);
      return;
    }

    const usersQuery = query(collection(db, 'users'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(
      usersQuery,
      (snapshot) => {
        const list = snapshot.docs.map((d) => d.data() as UserProfile);
        setUsers(list);
        setLoading(false);
      },
      (error) => {
        setLoading(false);
        handleFirestoreError(error, OperationType.LIST, 'users');
      },
    );

    return () => unsubscribe();
  }, [canListAllUsers]);

  const counts = useMemo(() => {
    return {
      all: users.length,
      pending: users.filter((u) => u.approvalStatus === ApprovalStatus.PENDING).length,
      approved: users.filter((u) => u.approvalStatus === ApprovalStatus.APPROVED).length,
      rejected: users.filter((u) => u.approvalStatus === ApprovalStatus.REJECTED).length,
    };
  }, [users]);

  const filteredUsers = useMemo(() => {
    const keyword = searchTerm.trim().toLowerCase();
    return users.filter((item) => {
      const matchesTab = filterTab === 'ALL' || item.approvalStatus === filterTab;
      if (!matchesTab) return false;
      if (!keyword) return true;
      return (
        item.displayName.toLowerCase().includes(keyword) ||
        item.email.toLowerCase().includes(keyword) ||
        item.nip.toLowerCase().includes(keyword) ||
        item.jabatan.toLowerCase().includes(keyword)
      );
    });
  }, [users, filterTab, searchTerm]);

  const handleApprove = async (target: UserProfile) => {
    if (!firebaseUser) return;
    const assignedRole =
      roleSelections[target.uid] ?? target.requestedRole ?? RequestedRole.GURU;
    setBusyUid(target.uid);
    const path = `users/${target.uid}`;
    try {
      await updateDoc(doc(db, 'users', target.uid), {
        role: assignedRole as unknown as UserRole,
        approvalStatus: ApprovalStatus.APPROVED,
        approvedBy: firebaseUser.uid,
        rejectionReason: deleteField(),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    } finally {
      setBusyUid(null);
    }
  };

  const handleReject = async (target: UserProfile) => {
    if (!firebaseUser) return;
    setBusyUid(target.uid);
    const path = `users/${target.uid}`;
    const reason = rejectionInput.trim().slice(0, FIELD_LIMITS.rejectionReasonMax);
    try {
      await updateDoc(doc(db, 'users', target.uid), {
        role: UserRole.PENDING,
        approvalStatus: ApprovalStatus.REJECTED,
        approvedBy: firebaseUser.uid,
        rejectionReason: reason || 'Data kepegawaian belum sesuai. Silakan perbarui pengajuan.',
        updatedAt: serverTimestamp(),
      });
      setRejectingUid(null);
      setRejectionInput('');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    } finally {
      setBusyUid(null);
    }
  };

  if (!canListAllUsers) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-3">
        <div className="flex items-center gap-2.5 text-[#102D46]">
          <ShieldCheck className="w-5 h-5 text-[#1C678A]" />
          <h2 className="text-base font-semibold">Persetujuan Pengguna Terbatas</h2>
        </div>
        <p className="text-sm text-slate-600 leading-relaxed">
          Daftar seluruh pendaftar akun dikelola oleh Administrator Utama (
          <span className="font-mono-tabular">{BOOTSTRAPPED_ADMIN_EMAIL}</span>) sesuai kebijakan
          isolasi PII Firestore Security Rules.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-[#102D46]">
              Persetujuan Pendaftaran Pengguna
            </h2>
            <p className="text-sm text-slate-600">
              Verifikasi akun Google baru dan tetapkan peran akses untuk Guru, Kepala Sekolah,
              atau Administrator.
            </p>
          </div>
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="search"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Cari nama, email, NIP..."
              className="w-full pl-9 pr-3.5 py-2 rounded-lg border border-slate-300 text-sm text-[#102D46] focus:outline-none focus:border-[#1C678A]"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1 p-1 bg-[#F5F7FA] rounded-lg border border-slate-200 w-fit">
          {(
            [
              { key: 'ALL', label: `Semua (${counts.all})` },
              { key: ApprovalStatus.PENDING, label: `Menunggu (${counts.pending})` },
              { key: ApprovalStatus.APPROVED, label: `Disetujui (${counts.approved})` },
              { key: ApprovalStatus.REJECTED, label: `Ditolak (${counts.rejected})` },
            ] as const
          ).map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setFilterTab(tab.key)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer font-mono-tabular ${
                filterTab === tab.key
                  ? 'bg-white text-[#102D46] border border-slate-200'
                  : 'text-slate-600 hover:text-[#102D46]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="space-y-3 py-4">
            {[1, 2, 3].map((row) => (
              <div
                key={row}
                className="h-12 bg-slate-100 rounded-lg animate-pulse"
              />
            ))}
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="py-12 text-center border border-dashed border-slate-200 rounded-lg space-y-2">
            <p className="text-sm font-medium text-[#102D46]">Belum ada data pengguna</p>
            <p className="text-xs text-slate-500">
              Pengguna yang login menggunakan Google Sign-In dan mengajukan akses akan muncul di
              tabel ini.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto border border-slate-200 rounded-lg">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-[#F5F7FA] border-b border-slate-200 text-xs font-semibold text-slate-600">
                  <th className="py-3 px-4">Pengguna</th>
                  <th className="py-3 px-4">NIP / Jabatan</th>
                  <th className="py-3 px-4">Peran</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Tindakan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {filteredUsers.map((item) => {
                  const isSelf = item.uid === profile?.uid;
                  const selectedRole =
                    roleSelections[item.uid] ?? item.requestedRole ?? RequestedRole.GURU;
                  const isRejecting = rejectingUid === item.uid;
                  const isBusy = busyUid === item.uid;

                  return (
                    <tr key={item.uid} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4 align-top">
                        <p className="font-medium text-[#102D46]">{item.displayName}</p>
                        <p className="text-xs font-mono-tabular text-slate-500">{item.email}</p>
                      </td>
                      <td className="py-3 px-4 align-top">
                        <p className="font-mono-tabular text-xs text-slate-700">
                          {item.nip || '—'}
                        </p>
                        <p className="text-xs text-slate-500">{item.jabatan || '—'}</p>
                      </td>
                      <td className="py-3 px-4 align-top">
                        {item.approvalStatus === ApprovalStatus.PENDING ? (
                          <select
                            aria-label={`Tetapkan peran untuk ${item.displayName}`}
                            value={selectedRole}
                            onChange={(e) =>
                              setRoleSelections((prev) => ({
                                ...prev,
                                [item.uid]: e.target.value as RequestedRole,
                              }))
                            }
                            className="px-2.5 py-1.5 rounded-md border border-slate-300 text-xs text-[#102D46] bg-white"
                          >
                            <option value={RequestedRole.GURU}>Guru</option>
                            <option value={RequestedRole.KEPALA_SEKOLAH}>Kepala Sekolah</option>
                            <option value={RequestedRole.ADMIN}>Administrator</option>
                          </select>
                        ) : (
                          <span className="text-xs font-medium text-[#102D46]">
                            {ROLE_LABELS[item.role]}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 align-top">
                        <span
                          className={`text-xs font-medium ${
                            item.approvalStatus === ApprovalStatus.APPROVED
                              ? 'text-emerald-700'
                              : item.approvalStatus === ApprovalStatus.REJECTED
                                ? 'text-red-700'
                                : 'text-amber-700'
                          }`}
                        >
                          {APPROVAL_STATUS_LABELS[item.approvalStatus]}
                        </span>
                      </td>
                      <td className="py-3 px-4 align-top text-right">
                        {isSelf ? (
                          <span className="text-xs text-slate-400">Akun Aktif Anda</span>
                        ) : isRejecting ? (
                          <div className="flex flex-col items-end gap-2 min-w-[220px]">
                            <input
                              type="text"
                              maxLength={FIELD_LIMITS.rejectionReasonMax}
                              value={rejectionInput}
                              onChange={(e) => setRejectionInput(e.target.value)}
                              placeholder="Alasan penolakan (opsional)"
                              className="w-full px-2.5 py-1.5 rounded-md border border-slate-300 text-xs text-[#102D46]"
                            />
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  setRejectingUid(null);
                                  setRejectionInput('');
                                }}
                                className="px-2.5 py-1 text-xs text-slate-600 hover:text-slate-900 cursor-pointer"
                              >
                                Batal
                              </button>
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => void handleReject(item)}
                                className="px-3 py-1 rounded-md bg-red-700 hover:bg-red-800 text-white text-xs font-medium cursor-pointer"
                              >
                                Konfirmasi Tolak
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-2">
                            {item.approvalStatus !== ApprovalStatus.APPROVED && (
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => void handleApprove(item)}
                                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md bg-[#16A6A0] hover:bg-[#1C678A] text-white text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                              >
                                <Check className="w-3.5 h-3.5" />
                                Setujui
                              </button>
                            )}
                            {item.approvalStatus === ApprovalStatus.PENDING && (
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => {
                                  setRejectingUid(item.uid);
                                  setRejectionInput('');
                                }}
                                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                              >
                                <X className="w-3.5 h-3.5" />
                                Tolak
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
