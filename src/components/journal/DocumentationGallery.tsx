import { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { Camera, ExternalLink, Search } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { extractFirestorePhotoId } from '../../lib/imageUpload';
import { UserRole } from '../../types/auth';
import type { TeachingJournal } from '../../types/journal';
import { JournalPhotoThumbnail } from './JournalPhotoPreview';

export function DocumentationGallery() {
  const { firebaseUser, profile } = useAuth();
  const [journals, setJournals] = useState<TeachingJournal[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const isSchoolWideRole =
    profile?.role === UserRole.ADMIN || profile?.role === UserRole.KEPALA_SEKOLAH;

  useEffect(() => {
    if (!firebaseUser || !profile) {
      setLoading(false);
      return;
    }

    const journalsQuery = isSchoolWideRole
      ? collection(db, 'teachingJournals')
      : query(collection(db, 'teachingJournals'), where('teacherUid', '==', firebaseUser.uid));

    const unsub = onSnapshot(
      journalsQuery,
      (snap) => {
        const list = snap.docs
          .map((d) => ({ id: d.id, ...(d.data() as Omit<TeachingJournal, 'id'>) }))
          .filter((item) => Boolean(item.documentationUrl))
          .sort((a, b) => b.date.localeCompare(a.date));
        setJournals(list);
        setLoading(false);
      },
      (error) => {
        setLoading(false);
        handleFirestoreError(error, OperationType.LIST, 'teachingJournals');
      },
    );

    return () => unsub();
  }, [firebaseUser, profile, isSchoolWideRole]);

  const filtered = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return journals;
    return journals.filter(
      (j) =>
        j.className.toLowerCase().includes(q) ||
        j.subjectName.toLowerCase().includes(q) ||
        j.topic.toLowerCase().includes(q) ||
        j.documentationCaption.toLowerCase().includes(q) ||
        j.teacherName.toLowerCase().includes(q),
    );
  }, [journals, searchTerm]);

  return (
    <div className="space-y-6">
      <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <p className="text-xs font-semibold text-[#16A6A0] uppercase tracking-wider">
              SMK Negeri 5 Tanjungpinang · Arsip Visual KBM
            </p>
            <h1 className="text-xl font-bold text-[#102D46]">
              Dokumentasi Kegiatan Pembelajaran
            </h1>
            <p className="text-sm text-slate-600">
              Kumpulan foto dan tautan bukti kegiatan mengajar yang tercatat pada jurnal harian.
            </p>
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="search"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Cari kelas, mapel, keterangan..."
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-300 text-xs text-[#102D46]"
            />
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-64 bg-slate-100 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center border border-dashed border-slate-200 rounded-lg space-y-2">
            <Camera className="w-6 h-6 text-slate-400 mx-auto" />
            <p className="text-sm font-medium text-[#102D46]">Belum ada dokumentasi kegiatan</p>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Tambahkan foto atau tautan dokumentasi saat mengisi Jurnal Harian agar tampil di
              galeri arsip ini.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {filtered.map((item) => {
              const isFirestorePhoto = Boolean(extractFirestorePhotoId(item.documentationUrl));
              return (
                <article
                  key={item.id}
                  className="border border-slate-200 rounded-xl overflow-hidden bg-white flex flex-col"
                >
                  <div className="aspect-[4/3] bg-[#F5F7FA] relative overflow-hidden border-b border-slate-200">
                    <JournalPhotoThumbnail
                      url={item.documentationUrl}
                      caption={item.documentationCaption || item.topic}
                      alt={item.documentationCaption || item.topic}
                      className="w-full h-full"
                    />
                  </div>

                  <div className="p-4 flex-1 flex flex-col justify-between gap-3">
                    <div className="space-y-1.5">
                      <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500 font-mono-tabular">
                        <span className="font-medium text-[#1C678A]">{item.date}</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-sans font-medium text-[#102D46]">
                          {item.className}
                        </span>
                      </div>
                      <h2 className="text-sm font-semibold text-[#102D46] line-clamp-2">
                        {item.subjectName}
                      </h2>
                      <p className="text-xs text-slate-600 line-clamp-2">
                        {item.documentationCaption || item.topic}
                      </p>
                      {isSchoolWideRole && (
                        <p className="text-[11px] text-slate-500">Oleh: {item.teacherName}</p>
                      )}
                    </div>

                    {isFirestorePhoto ? (
                      <p className="text-xs font-medium text-[#1C678A]">
                        Klik foto untuk memperbesar
                      </p>
                    ) : (
                      <a
                        href={item.documentationUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs font-medium text-[#1C678A] hover:underline w-fit"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>Buka Dokumentasi Asli</span>
                      </a>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
