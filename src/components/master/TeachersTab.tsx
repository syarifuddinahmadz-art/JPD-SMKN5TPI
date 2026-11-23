import React, { useMemo, useState } from 'react';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import { Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { UID_PATTERN, type UserProfile } from '../../types/auth';
import {
  EntityStatus,
  MASTER_FIELD_LIMITS,
  STATUS_LABELS,
  type Teacher,
} from '../../types/masterData';

interface TeachersTabProps {
  teachers: Teacher[];
  approvedUsers: UserProfile[];
  loading: boolean;
}

export function TeachersTab({ teachers, approvedUsers, loading }: TeachersTabProps) {
  const { firebaseUser } = useAuth();
  const [editingItem, setEditingItem] = useState<Teacher | null>(null);
  const [userUid, setUserUid] = useState('');
  const [fullName, setFullName] = useState('');
  const [nip, setNip] = useState('');
  const [email, setEmail] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [status, setStatus] = useState<EntityStatus>(EntityStatus.AKTIF);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | EntityStatus>('ALL');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const resetForm = () => {
    setEditingItem(null);
    setUserUid('');
    setFullName('');
    setNip('');
    setEmail('');
    setSpecialty('');
    setStatus(EntityStatus.AKTIF);
    setFormError(null);
  };

  const startEdit = (item: Teacher) => {
    setEditingItem(item);
    setUserUid(item.userUid);
    setFullName(item.fullName);
    setNip(item.nip);
    setEmail(item.email);
    setSpecialty(item.specialty);
    setStatus(item.status);
    setFormError(null);
  };

  const handleLinkUserChange = (selectedUid: string) => {
    setUserUid(selectedUid);
    const matched = approvedUsers.find((u) => u.uid === selectedUid);
    if (matched) {
      if (!fullName.trim()) setFullName(matched.displayName);
      if (!nip.trim()) setNip(matched.nip);
      if (!email.trim()) setEmail(matched.email);
      if (!specialty.trim() && matched.jabatan) setSpecialty(matched.jabatan);
    }
  };

  const filteredTeachers = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return teachers.filter((t) => {
      if (statusFilter !== 'ALL' && t.status !== statusFilter) return false;
      if (!q) return true;
      return (
        t.fullName.toLowerCase().includes(q) ||
        t.nip.toLowerCase().includes(q) ||
        t.email.toLowerCase().includes(q) ||
        t.specialty.toLowerCase().includes(q)
      );
    });
  }, [teachers, searchTerm, statusFilter]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firebaseUser) return;

    const cleanName = fullName.trim().slice(0, MASTER_FIELD_LIMITS.teacherNameMax);
    if (cleanName.length < MASTER_FIELD_LIMITS.teacherNameMin) {
      setFormError(`Nama guru minimal ${MASTER_FIELD_LIMITS.teacherNameMin} karakter.`);
      return;
    }

    const cleanUid = userUid.trim();
    if (cleanUid && !UID_PATTERN.test(cleanUid)) {
      setFormError('UID akun tertaut tidak valid.');
      return;
    }

    setSaving(true);
    setFormError(null);

    const payload = {
      userUid: cleanUid,
      fullName: cleanName,
      nip: nip.trim().slice(0, MASTER_FIELD_LIMITS.nipMax),
      email: email.trim().slice(0, MASTER_FIELD_LIMITS.emailMax),
      specialty: specialty.trim().slice(0, MASTER_FIELD_LIMITS.specialtyMax),
      status,
      updatedAt: serverTimestamp(),
    };

    try {
      if (editingItem) {
        await updateDoc(doc(db, 'teachers', editingItem.id), payload);
      } else {
        await addDoc(collection(db, 'teachers'), {
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
        editingItem ? `teachers/${editingItem.id}` : 'teachers',
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    setBusyId(id);
    try {
      await deleteDoc(doc(db, 'teachers', id));
      setConfirmDeleteId(null);
      if (editingItem?.id === id) resetForm();
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `teachers/${id}`);
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
            {editingItem ? 'Ubah Data Guru' : 'Tambah Data Guru'}
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

        {formError && (
          <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg p-2.5">
            {formError}
          </p>
        )}

        {approvedUsers.length > 0 && (
          <div className="space-y-1.5">
            <label htmlFor="t-link-user" className="block text-xs font-medium text-slate-700">
              Tautkan Akun Google (Opsional)
            </label>
            <select
              id="t-link-user"
              value={userUid}
              onChange={(e) => handleLinkUserChange(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs text-[#102D46] bg-white focus:outline-none focus:border-[#1C678A]"
            >
              <option value="">Belum ditautkan ke akun login</option>
              {approvedUsers.map((u) => (
                <option key={u.uid} value={u.uid}>
                  {u.displayName} ({u.email})
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="space-y-1.5">
          <label htmlFor="t-fullname" className="block text-xs font-medium text-slate-700">
            Nama Lengkap dan Gelar <span className="text-red-600">*</span>
          </label>
          <input
            id="t-fullname"
            type="text"
            required
            minLength={MASTER_FIELD_LIMITS.teacherNameMin}
            maxLength={MASTER_FIELD_LIMITS.teacherNameMax}
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Contoh: Budi Santoso, S.Pd."
            className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm text-[#102D46] focus:outline-none focus:border-[#1C678A]"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-3">
          <div className="space-y-1.5">
            <label htmlFor="t-nip" className="block text-xs font-medium text-slate-700">
              NIP / NUPTK
            </label>
            <input
              id="t-nip"
              type="text"
              maxLength={MASTER_FIELD_LIMITS.nipMax}
              value={nip}
              onChange={(e) => setNip(e.target.value)}
              placeholder="198501012010011001"
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm font-mono-tabular text-[#102D46] focus:outline-none focus:border-[#1C678A]"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="t-email" className="block text-xs font-medium text-slate-700">
              Email Guru
            </label>
            <input
              id="t-email"
              type="email"
              maxLength={MASTER_FIELD_LIMITS.emailMax}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="guru@smkn5tanjungpinang.sch.id"
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm font-mono-tabular text-[#102D46] focus:outline-none focus:border-[#1C678A]"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="t-specialty" className="block text-xs font-medium text-slate-700">
            Bidang Keahlian / Mata Pelajaran
          </label>
          <input
            id="t-specialty"
            type="text"
            maxLength={MASTER_FIELD_LIMITS.specialtyMax}
            value={specialty}
            onChange={(e) => setSpecialty(e.target.value)}
            placeholder="Contoh: Teknik Jaringan Komputer"
            className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm text-[#102D46] focus:outline-none focus:border-[#1C678A]"
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="t-status" className="block text-xs font-medium text-slate-700">
            Status Guru
          </label>
          <select
            id="t-status"
            value={status}
            onChange={(e) => setStatus(e.target.value as EntityStatus)}
            className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm text-[#102D46] bg-white focus:outline-none focus:border-[#1C678A]"
          >
            <option value={EntityStatus.AKTIF}>Aktif</option>
            <option value={EntityStatus.NONAKTIF}>Nonaktif</option>
          </select>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="w-full min-h-[40px] px-4 py-2 rounded-lg bg-[#102D46] hover:bg-[#1C678A] disabled:opacity-65 text-white text-xs font-medium inline-flex items-center justify-center gap-2 transition-colors cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>{saving ? 'Menyimpan...' : editingItem ? 'Simpan Perubahan' : 'Tambah Guru'}</span>
        </button>
      </form>

      <div className="lg:col-span-8 bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-1 p-1 bg-[#F5F7FA] rounded-lg border border-slate-200 w-fit">
            {(
              [
                { key: 'ALL', label: `Semua (${teachers.length})` },
                {
                  key: EntityStatus.AKTIF,
                  label: `Aktif (${teachers.filter((t) => t.status === EntityStatus.AKTIF).length})`,
                },
                {
                  key: EntityStatus.NONAKTIF,
                  label: `Nonaktif (${teachers.filter((t) => t.status === EntityStatus.NONAKTIF).length})`,
                },
              ] as const
            ).map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setStatusFilter(tab.key)}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap font-mono-tabular cursor-pointer ${
                  statusFilter === tab.key
                    ? 'bg-white text-[#102D46] border border-slate-200'
                    : 'text-slate-600 hover:text-[#102D46]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="search"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Cari nama, NIP, bidang..."
              className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-slate-300 text-xs text-[#102D46] focus:outline-none focus:border-[#1C678A]"
            />
          </div>
        </div>

        {loading ? (
          <div className="space-y-2.5">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 bg-slate-100 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : filteredTeachers.length === 0 ? (
          <div className="py-10 text-center border border-dashed border-slate-200 rounded-lg space-y-1">
            <p className="text-sm font-medium text-[#102D46]">Belum ada data guru</p>
            <p className="text-xs text-slate-500">
              Tambahkan guru SMK Negeri 5 Tanjungpinang melalui formulir di samping.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto border border-slate-200 rounded-lg">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-[#F5F7FA] border-b border-slate-200 text-xs font-semibold text-slate-600">
                  <th className="py-2.5 px-4">Nama & Email</th>
                  <th className="py-2.5 px-4">NIP / Bidang</th>
                  <th className="py-2.5 px-4">Tautan Akun</th>
                  <th className="py-2.5 px-4">Status</th>
                  <th className="py-2.5 px-4 text-right">Tindakan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredTeachers.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/70">
                    <td className="py-3 px-4 align-top">
                      <p className="font-medium text-[#102D46]">{item.fullName}</p>
                      <p className="text-xs font-mono-tabular text-slate-500">
                        {item.email || '—'}
                      </p>
                    </td>
                    <td className="py-3 px-4 align-top">
                      <p className="font-mono-tabular text-xs text-slate-700">{item.nip || '—'}</p>
                      <p className="text-xs text-slate-500">{item.specialty || '—'}</p>
                    </td>
                    <td className="py-3 px-4 align-top">
                      <span
                        className={`text-xs font-medium ${
                          item.userUid ? 'text-[#16A6A0]' : 'text-slate-400'
                        }`}
                      >
                        {item.userUid ? 'Tertaut Google' : 'Belum Tertaut'}
                      </span>
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
                            aria-label={`Ubah ${item.fullName}`}
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(item.id)}
                            className="p-1.5 rounded border border-slate-200 text-slate-600 hover:text-red-700 hover:border-red-200 cursor-pointer"
                            aria-label={`Hapus ${item.fullName}`}
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
