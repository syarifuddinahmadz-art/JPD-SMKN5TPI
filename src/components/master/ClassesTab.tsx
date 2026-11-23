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
  GradeLevel,
  MASTER_FIELD_LIMITS,
  STATUS_LABELS,
  type SchoolClass,
  type Teacher,
} from '../../types/masterData';

interface ClassesTabProps {
  classes: SchoolClass[];
  teachers: Teacher[];
  loading: boolean;
}

export function ClassesTab({ classes, teachers, loading }: ClassesTabProps) {
  const { firebaseUser } = useAuth();
  const [editingItem, setEditingItem] = useState<SchoolClass | null>(null);
  const [name, setName] = useState('');
  const [gradeLevel, setGradeLevel] = useState<GradeLevel>(GradeLevel.X);
  const [major, setMajor] = useState('');
  const [homeroomTeacherId, setHomeroomTeacherId] = useState('');
  const [studentCount, setStudentCount] = useState('32');
  const [status, setStatus] = useState<EntityStatus>(EntityStatus.AKTIF);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [gradeFilter, setGradeFilter] = useState<'ALL' | GradeLevel>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const activeTeachers = useMemo(
    () => teachers.filter((t) => t.status === EntityStatus.AKTIF),
    [teachers],
  );

  const resetForm = () => {
    setEditingItem(null);
    setName('');
    setGradeLevel(GradeLevel.X);
    setMajor('');
    setHomeroomTeacherId('');
    setStudentCount('32');
    setStatus(EntityStatus.AKTIF);
    setFormError(null);
  };

  const startEdit = (item: SchoolClass) => {
    setEditingItem(item);
    setName(item.name);
    setGradeLevel(item.gradeLevel);
    setMajor(item.major);
    setHomeroomTeacherId(item.homeroomTeacherId);
    setStudentCount(String(item.studentCount));
    setStatus(item.status);
    setFormError(null);
  };

  const filteredClasses = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return classes.filter((c) => {
      if (gradeFilter !== 'ALL' && c.gradeLevel !== gradeFilter) return false;
      if (!q) return true;
      return (
        c.name.toLowerCase().includes(q) ||
        c.major.toLowerCase().includes(q) ||
        c.homeroomTeacherName.toLowerCase().includes(q)
      );
    });
  }, [classes, gradeFilter, searchTerm]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firebaseUser) return;

    const cleanName = name.trim().slice(0, MASTER_FIELD_LIMITS.classNameMax);
    const cleanMajor = major.trim().slice(0, MASTER_FIELD_LIMITS.majorMax);
    const parsedCount = Number.parseInt(studentCount, 10);

    if (cleanName.length < MASTER_FIELD_LIMITS.classNameMin) {
      setFormError(`Nama kelas minimal ${MASTER_FIELD_LIMITS.classNameMin} karakter.`);
      return;
    }
    if (cleanMajor.length < MASTER_FIELD_LIMITS.majorMin) {
      setFormError(`Nama jurusan/kompetensi minimal ${MASTER_FIELD_LIMITS.majorMin} karakter.`);
      return;
    }
    if (
      Number.isNaN(parsedCount) ||
      parsedCount < 0 ||
      parsedCount > MASTER_FIELD_LIMITS.studentCountMax
    ) {
      setFormError(`Jumlah siswa harus antara 0 hingga ${MASTER_FIELD_LIMITS.studentCountMax}.`);
      return;
    }

    const matchedTeacher = teachers.find((t) => t.id === homeroomTeacherId);

    setSaving(true);
    setFormError(null);

    const payload = {
      name: cleanName,
      gradeLevel,
      major: cleanMajor,
      homeroomTeacherId: matchedTeacher ? matchedTeacher.id : '',
      homeroomTeacherName: matchedTeacher ? matchedTeacher.fullName : '',
      studentCount: parsedCount,
      status,
      updatedAt: serverTimestamp(),
    };

    try {
      if (editingItem) {
        await updateDoc(doc(db, 'classes', editingItem.id), payload);
      } else {
        await addDoc(collection(db, 'classes'), {
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
        editingItem ? `classes/${editingItem.id}` : 'classes',
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    setBusyId(id);
    try {
      await deleteDoc(doc(db, 'classes', id));
      setConfirmDeleteId(null);
      if (editingItem?.id === id) resetForm();
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `classes/${id}`);
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
            {editingItem ? 'Ubah Data Kelas' : 'Tambah Kelas / Rombel'}
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

        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <label htmlFor="c-grade" className="block text-xs font-medium text-slate-700">
              Tingkat <span className="text-red-600">*</span>
            </label>
            <select
              id="c-grade"
              value={gradeLevel}
              onChange={(e) => setGradeLevel(e.target.value as GradeLevel)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm text-[#102D46] bg-white focus:outline-none focus:border-[#1C678A]"
            >
              <option value={GradeLevel.X}>X</option>
              <option value={GradeLevel.XI}>XI</option>
              <option value={GradeLevel.XII}>XII</option>
              <option value={GradeLevel.XIII}>XIII</option>
            </select>
          </div>
          <div className="col-span-2 space-y-1.5">
            <label htmlFor="c-name" className="block text-xs font-medium text-slate-700">
              Nama Kelas <span className="text-red-600">*</span>
            </label>
            <input
              id="c-name"
              type="text"
              required
              minLength={MASTER_FIELD_LIMITS.classNameMin}
              maxLength={MASTER_FIELD_LIMITS.classNameMax}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Contoh: XI TJKT 1"
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm text-[#102D46] focus:outline-none focus:border-[#1C678A]"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="c-major" className="block text-xs font-medium text-slate-700">
            Konsentrasi Keahlian / Jurusan <span className="text-red-600">*</span>
          </label>
          <input
            id="c-major"
            type="text"
            required
            minLength={MASTER_FIELD_LIMITS.majorMin}
            maxLength={MASTER_FIELD_LIMITS.majorMax}
            value={major}
            onChange={(e) => setMajor(e.target.value)}
            placeholder="Contoh: Teknik Jaringan Komputer dan Telekomunikasi"
            className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm text-[#102D46] focus:outline-none focus:border-[#1C678A]"
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="c-homeroom" className="block text-xs font-medium text-slate-700">
            Wali Kelas (Opsional)
          </label>
          <select
            id="c-homeroom"
            value={homeroomTeacherId}
            onChange={(e) => setHomeroomTeacherId(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm text-[#102D46] bg-white focus:outline-none focus:border-[#1C678A]"
          >
            <option value="">Belum ditetapkan</option>
            {activeTeachers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.fullName}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label htmlFor="c-count" className="block text-xs font-medium text-slate-700">
              Jumlah Siswa
            </label>
            <input
              id="c-count"
              type="number"
              min={0}
              max={MASTER_FIELD_LIMITS.studentCountMax}
              value={studentCount}
              onChange={(e) => setStudentCount(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm font-mono-tabular text-[#102D46] focus:outline-none focus:border-[#1C678A]"
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="c-status" className="block text-xs font-medium text-slate-700">
              Status
            </label>
            <select
              id="c-status"
              value={status}
              onChange={(e) => setStatus(e.target.value as EntityStatus)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm text-[#102D46] bg-white focus:outline-none focus:border-[#1C678A]"
            >
              <option value={EntityStatus.AKTIF}>Aktif</option>
              <option value={EntityStatus.NONAKTIF}>Nonaktif</option>
            </select>
          </div>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="w-full min-h-[40px] px-4 py-2 rounded-lg bg-[#102D46] hover:bg-[#1C678A] disabled:opacity-65 text-white text-xs font-medium inline-flex items-center justify-center gap-2 transition-colors cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>{saving ? 'Menyimpan...' : editingItem ? 'Simpan Perubahan' : 'Tambah Kelas'}</span>
        </button>
      </form>

      <div className="lg:col-span-8 bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-1 p-1 bg-[#F5F7FA] rounded-lg border border-slate-200 w-fit">
            {(['ALL', GradeLevel.X, GradeLevel.XI, GradeLevel.XII, GradeLevel.XIII] as const).map(
              (grade) => (
                <button
                  key={grade}
                  type="button"
                  onClick={() => setGradeFilter(grade)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                    gradeFilter === grade
                      ? 'bg-white text-[#102D46] border border-slate-200'
                      : 'text-slate-600 hover:text-[#102D46]'
                  }`}
                >
                  {grade === 'ALL' ? 'Semua' : `Kelas ${grade}`}
                </button>
              ),
            )}
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="search"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Cari kelas, jurusan, wali kelas..."
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
        ) : filteredClasses.length === 0 ? (
          <div className="py-10 text-center border border-dashed border-slate-200 rounded-lg space-y-1">
            <p className="text-sm font-medium text-[#102D46]">Belum ada data kelas</p>
            <p className="text-xs text-slate-500">
              Tambahkan kelas dan konsentrasi keahlian SMK Negeri 5 Tanjungpinang melalui formulir
              di samping.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto border border-slate-200 rounded-lg">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-[#F5F7FA] border-b border-slate-200 text-xs font-semibold text-slate-600">
                  <th className="py-2.5 px-4">Kelas & Jurusan</th>
                  <th className="py-2.5 px-4">Wali Kelas</th>
                  <th className="py-2.5 px-4 text-right">Siswa</th>
                  <th className="py-2.5 px-4">Status</th>
                  <th className="py-2.5 px-4 text-right">Tindakan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredClasses.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/70">
                    <td className="py-3 px-4 align-top">
                      <p className="font-medium text-[#102D46]">{item.name}</p>
                      <p className="text-xs text-slate-500">
                        Tingkat {item.gradeLevel} · {item.major}
                      </p>
                    </td>
                    <td className="py-3 px-4 align-top text-xs text-slate-700">
                      {item.homeroomTeacherName || '—'}
                    </td>
                    <td className="py-3 px-4 align-top text-right font-mono-tabular text-xs text-slate-700">
                      {item.studentCount}
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
