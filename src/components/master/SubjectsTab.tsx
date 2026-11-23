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
import {
  EntityStatus,
  MASTER_FIELD_LIMITS,
  STATUS_LABELS,
  SUBJECT_CATEGORY_LABELS,
  SubjectCategory,
  type Subject,
} from '../../types/masterData';

interface SubjectsTabProps {
  subjects: Subject[];
  loading: boolean;
}

export function SubjectsTab({ subjects, loading }: SubjectsTabProps) {
  const { firebaseUser } = useAuth();
  const [editingItem, setEditingItem] = useState<Subject | null>(null);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [category, setCategory] = useState<SubjectCategory>(SubjectCategory.KEJURUAN);
  const [status, setStatus] = useState<EntityStatus>(EntityStatus.AKTIF);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<'ALL' | SubjectCategory>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const resetForm = () => {
    setEditingItem(null);
    setCode('');
    setName('');
    setCategory(SubjectCategory.KEJURUAN);
    setStatus(EntityStatus.AKTIF);
    setFormError(null);
  };

  const startEdit = (item: Subject) => {
    setEditingItem(item);
    setCode(item.code);
    setName(item.name);
    setCategory(item.category);
    setStatus(item.status);
    setFormError(null);
  };

  const filteredSubjects = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return subjects.filter((s) => {
      if (categoryFilter !== 'ALL' && s.category !== categoryFilter) return false;
      if (!q) return true;
      return s.code.toLowerCase().includes(q) || s.name.toLowerCase().includes(q);
    });
  }, [subjects, categoryFilter, searchTerm]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firebaseUser) return;

    const cleanCode = code.trim().toUpperCase().slice(0, MASTER_FIELD_LIMITS.subjectCodeMax);
    const cleanName = name.trim().slice(0, MASTER_FIELD_LIMITS.subjectNameMax);

    if (cleanCode.length < MASTER_FIELD_LIMITS.subjectCodeMin) {
      setFormError(`Kode mata pelajaran minimal ${MASTER_FIELD_LIMITS.subjectCodeMin} karakter.`);
      return;
    }
    if (cleanName.length < MASTER_FIELD_LIMITS.subjectNameMin) {
      setFormError(`Nama mata pelajaran minimal ${MASTER_FIELD_LIMITS.subjectNameMin} karakter.`);
      return;
    }

    setSaving(true);
    setFormError(null);

    const payload = {
      code: cleanCode,
      name: cleanName,
      category,
      status,
      updatedAt: serverTimestamp(),
    };

    try {
      if (editingItem) {
        await updateDoc(doc(db, 'subjects', editingItem.id), payload);
      } else {
        await addDoc(collection(db, 'subjects'), {
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
        editingItem ? `subjects/${editingItem.id}` : 'subjects',
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    setBusyId(id);
    try {
      await deleteDoc(doc(db, 'subjects', id));
      setConfirmDeleteId(null);
      if (editingItem?.id === id) resetForm();
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `subjects/${id}`);
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
            {editingItem ? 'Ubah Mata Pelajaran' : 'Tambah Mata Pelajaran'}
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

        <div className="space-y-1.5">
          <label htmlFor="s-code" className="block text-xs font-medium text-slate-700">
            Kode Mata Pelajaran <span className="text-red-600">*</span>
          </label>
          <input
            id="s-code"
            type="text"
            required
            minLength={MASTER_FIELD_LIMITS.subjectCodeMin}
            maxLength={MASTER_FIELD_LIMITS.subjectCodeMax}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Contoh: TJKT-AIJ-XI"
            className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm font-mono-tabular uppercase text-[#102D46] focus:outline-none focus:border-[#1C678A]"
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="s-name" className="block text-xs font-medium text-slate-700">
            Nama Mata Pelajaran <span className="text-red-600">*</span>
          </label>
          <input
            id="s-name"
            type="text"
            required
            minLength={MASTER_FIELD_LIMITS.subjectNameMin}
            maxLength={MASTER_FIELD_LIMITS.subjectNameMax}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Contoh: Administrasi Infrastruktur Jaringan"
            className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm text-[#102D46] focus:outline-none focus:border-[#1C678A]"
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="s-cat" className="block text-xs font-medium text-slate-700">
            Kelompok Mata Pelajaran
          </label>
          <select
            id="s-cat"
            value={category}
            onChange={(e) => setCategory(e.target.value as SubjectCategory)}
            className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm text-[#102D46] bg-white focus:outline-none focus:border-[#1C678A]"
          >
            <option value={SubjectCategory.UMUM}>Muatan Umum</option>
            <option value={SubjectCategory.KEJURUAN}>Konsentrasi Kejuruan</option>
            <option value={SubjectCategory.MUATAN_LOKAL}>Muatan Lokal</option>
            <option value={SubjectCategory.PROJEK_P5}>Projek Penguatan P5</option>
          </select>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="s-status" className="block text-xs font-medium text-slate-700">
            Status
          </label>
          <select
            id="s-status"
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
          <span>
            {saving ? 'Menyimpan...' : editingItem ? 'Simpan Perubahan' : 'Tambah Mata Pelajaran'}
          </span>
        </button>
      </form>

      <div className="lg:col-span-8 bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1 p-1 bg-[#F5F7FA] rounded-lg border border-slate-200 w-fit">
            {(
              [
                { key: 'ALL', label: 'Semua' },
                { key: SubjectCategory.UMUM, label: 'Umum' },
                { key: SubjectCategory.KEJURUAN, label: 'Kejuruan' },
                { key: SubjectCategory.MUATAN_LOKAL, label: 'Mulok' },
                { key: SubjectCategory.PROJEK_P5, label: 'P5' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setCategoryFilter(tab.key)}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                  categoryFilter === tab.key
                    ? 'bg-white text-[#102D46] border border-slate-200'
                    : 'text-slate-600 hover:text-[#102D46]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="relative w-full sm:w-60">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="search"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Cari kode atau nama mapel..."
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
        ) : filteredSubjects.length === 0 ? (
          <div className="py-10 text-center border border-dashed border-slate-200 rounded-lg space-y-1">
            <p className="text-sm font-medium text-[#102D46]">Belum ada mata pelajaran</p>
            <p className="text-xs text-slate-500">
              Tambahkan mata pelajaran umum maupun kejuruan melalui formulir di samping.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto border border-slate-200 rounded-lg">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-[#F5F7FA] border-b border-slate-200 text-xs font-semibold text-slate-600">
                  <th className="py-2.5 px-4">Kode</th>
                  <th className="py-2.5 px-4">Mata Pelajaran</th>
                  <th className="py-2.5 px-4">Kelompok</th>
                  <th className="py-2.5 px-4">Status</th>
                  <th className="py-2.5 px-4 text-right">Tindakan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredSubjects.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/70">
                    <td className="py-3 px-4 font-mono-tabular text-xs font-medium text-[#1C678A]">
                      {item.code}
                    </td>
                    <td className="py-3 px-4 font-medium text-[#102D46]">{item.name}</td>
                    <td className="py-3 px-4 text-xs text-slate-600">
                      {SUBJECT_CATEGORY_LABELS[item.category]}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`text-xs font-medium ${
                          item.status === EntityStatus.AKTIF ? 'text-emerald-700' : 'text-slate-500'
                        }`}
                      >
                        {STATUS_LABELS[item.status]}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
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
                            aria-label={`Ubah ${item.name}`}
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(item.id)}
                            className="p-1.5 rounded border border-slate-200 text-slate-600 hover:text-red-700 hover:border-red-200 cursor-pointer"
                            aria-label={`Hapus ${item.name}`}
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
