import React, { useState } from 'react';
import {
  collection,
  deleteDoc,
  doc,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { Check, Pencil, Plus, Trash2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import {
  MASTER_FIELD_LIMITS,
  SEMESTER_LABELS,
  SemesterType,
  type AcademicYear,
} from '../../types/masterData';

interface AcademicYearsTabProps {
  academicYears: AcademicYear[];
  loading: boolean;
}

export function AcademicYearsTab({ academicYears, loading }: AcademicYearsTabProps) {
  const { firebaseUser } = useAuth();
  const [editingItem, setEditingItem] = useState<AcademicYear | null>(null);
  const [name, setName] = useState('2026/2027');
  const [semester, setSemester] = useState<SemesterType>(SemesterType.GANJIL);
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const resetForm = () => {
    setEditingItem(null);
    setName('2026/2027');
    setSemester(SemesterType.GANJIL);
    setIsActive(academicYears.length === 0);
    setFormError(null);
  };

  const startEdit = (item: AcademicYear) => {
    setEditingItem(item);
    setName(item.name);
    setSemester(item.semester);
    setIsActive(item.isActive);
    setFormError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firebaseUser) return;
    const cleanName = name.trim().slice(0, MASTER_FIELD_LIMITS.yearNameMax);
    if (cleanName.length < MASTER_FIELD_LIMITS.yearNameMin) {
      setFormError(`Nama tahun ajaran minimal ${MASTER_FIELD_LIMITS.yearNameMin} karakter.`);
      return;
    }

    setSaving(true);
    setFormError(null);

    try {
      const batch = writeBatch(db);

      if (isActive) {
        for (const existing of academicYears) {
          if (existing.isActive && existing.id !== editingItem?.id) {
            batch.update(doc(db, 'academicYears', existing.id), {
              isActive: false,
              updatedAt: serverTimestamp(),
            });
          }
        }
      }

      if (editingItem) {
        batch.update(doc(db, 'academicYears', editingItem.id), {
          name: cleanName,
          semester,
          isActive,
          updatedAt: serverTimestamp(),
        });
      } else {
        const newRef = doc(collection(db, 'academicYears'));
        batch.set(newRef, {
          name: cleanName,
          semester,
          isActive,
          createdBy: firebaseUser.uid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }

      await batch.commit();
      resetForm();
    } catch (error) {
      handleFirestoreError(
        error,
        editingItem ? OperationType.UPDATE : OperationType.CREATE,
        editingItem ? `academicYears/${editingItem.id}` : 'academicYears',
      );
    } finally {
      setSaving(false);
    }
  };

  const handleActivate = async (target: AcademicYear) => {
    if (target.isActive) return;
    setBusyId(target.id);
    try {
      const batch = writeBatch(db);
      for (const item of academicYears) {
        if (item.isActive && item.id !== target.id) {
          batch.update(doc(db, 'academicYears', item.id), {
            isActive: false,
            updatedAt: serverTimestamp(),
          });
        }
      }
      batch.update(doc(db, 'academicYears', target.id), {
        isActive: true,
        updatedAt: serverTimestamp(),
      });
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `academicYears/${target.id}`);
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (id: string) => {
    setBusyId(id);
    try {
      await deleteDoc(doc(db, 'academicYears', id));
      setConfirmDeleteId(null);
      if (editingItem?.id === id) resetForm();
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `academicYears/${id}`);
    } finally {
      setBusyId(null);
    }
  };

  // Ensure unused imports aren't flagged if setDoc/updateDoc not called directly
  void setDoc;
  void updateDoc;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Form */}
      <form
        onSubmit={(e) => void handleSubmit(e)}
        className="lg:col-span-4 bg-white border border-slate-200 rounded-xl p-5 space-y-4"
      >
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-[#102D46]">
            {editingItem ? 'Ubah Tahun Ajaran' : 'Tambah Tahun Ajaran'}
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
          <label htmlFor="ay-name" className="block text-xs font-medium text-slate-700">
            Tahun Pelajaran <span className="text-red-600">*</span>
          </label>
          <input
            id="ay-name"
            type="text"
            required
            minLength={MASTER_FIELD_LIMITS.yearNameMin}
            maxLength={MASTER_FIELD_LIMITS.yearNameMax}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Contoh: 2026/2027"
            className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm font-mono-tabular text-[#102D46] focus:outline-none focus:border-[#1C678A]"
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="ay-semester" className="block text-xs font-medium text-slate-700">
            Semester <span className="text-red-600">*</span>
          </label>
          <select
            id="ay-semester"
            value={semester}
            onChange={(e) => setSemester(e.target.value as SemesterType)}
            className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm text-[#102D46] bg-white focus:outline-none focus:border-[#1C678A]"
          >
            <option value={SemesterType.GANJIL}>Ganjil</option>
            <option value={SemesterType.GENAP}>Genap</option>
          </select>
        </div>

        <label className="flex items-center gap-2.5 text-xs text-slate-700 cursor-pointer pt-1">
          <input
            type="checkbox"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
            className="w-4 h-4 rounded border-slate-300 text-[#102D46]"
          />
          <span>Tetapkan sebagai periode semester aktif</span>
        </label>

        <button
          type="submit"
          disabled={saving}
          className="w-full min-h-[40px] px-4 py-2 rounded-lg bg-[#102D46] hover:bg-[#1C678A] disabled:opacity-65 text-white text-xs font-medium inline-flex items-center justify-center gap-2 transition-colors cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>{saving ? 'Menyimpan...' : editingItem ? 'Simpan Perubahan' : 'Simpan Periode'}</span>
        </button>
      </form>

      {/* Table */}
      <div className="lg:col-span-8 bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-semibold text-[#102D46]">Daftar Tahun Ajaran & Semester</h3>
            <p className="text-xs text-slate-500">
              Hanya satu periode semester yang aktif dalam satu waktu untuk penyusunan jadwal.
            </p>
          </div>
          <span className="text-xs font-mono-tabular text-slate-500 whitespace-nowrap">
            {academicYears.length} periode
          </span>
        </div>

        {loading ? (
          <div className="space-y-2.5">
            {[1, 2].map((i) => (
              <div key={i} className="h-11 bg-slate-100 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : academicYears.length === 0 ? (
          <div className="py-10 text-center border border-dashed border-slate-200 rounded-lg space-y-1">
            <p className="text-sm font-medium text-[#102D46]">Belum ada tahun ajaran</p>
            <p className="text-xs text-slate-500">
              Tambahkan periode tahun ajaran dan semester aktif terlebih dahulu sebelum menyusun
              jadwal mengajar.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto border border-slate-200 rounded-lg">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-[#F5F7FA] border-b border-slate-200 text-xs font-semibold text-slate-600">
                  <th className="py-2.5 px-4">Tahun Pelajaran</th>
                  <th className="py-2.5 px-4">Semester</th>
                  <th className="py-2.5 px-4">Status</th>
                  <th className="py-2.5 px-4 text-right">Tindakan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {academicYears.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/70">
                    <td className="py-3 px-4 font-mono-tabular font-medium text-[#102D46]">
                      {item.name}
                    </td>
                    <td className="py-3 px-4 text-slate-700">{SEMESTER_LABELS[item.semester]}</td>
                    <td className="py-3 px-4">
                      {item.isActive ? (
                        <span className="text-xs font-semibold text-emerald-700">
                          Periode Aktif
                        </span>
                      ) : (
                        <span className="text-xs text-slate-500">Arsip</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      {confirmDeleteId === item.id ? (
                        <div className="inline-flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(null)}
                            className="text-xs text-slate-600 hover:text-[#102D46] cursor-pointer"
                          >
                            Batal
                          </button>
                          <button
                            type="button"
                            disabled={busyId === item.id}
                            onClick={() => void handleDelete(item.id)}
                            className="px-2.5 py-1 rounded bg-red-700 text-white text-xs font-medium cursor-pointer"
                          >
                            Konfirmasi Hapus
                          </button>
                        </div>
                      ) : (
                        <div className="inline-flex items-center gap-2">
                          {!item.isActive && (
                            <button
                              type="button"
                              disabled={busyId === item.id}
                              onClick={() => void handleActivate(item)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-[#16A6A0] text-[#16A6A0] hover:bg-[#16A6A0] hover:text-white text-xs font-medium transition-colors cursor-pointer"
                            >
                              <Check className="w-3.5 h-3.5" />
                              Aktifkan
                            </button>
                          )}
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
