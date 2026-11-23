import { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { Camera, ExternalLink, X } from 'lucide-react';
import { db } from '../../lib/firebase';
import { extractFirestorePhotoId } from '../../lib/imageUpload';

const photoCache = new Map<string, string>();

export function useResolvedPhotoSrc(url: string): {
  src: string;
  loading: boolean;
  isFirestorePhoto: boolean;
} {
  const photoId = extractFirestorePhotoId(url);
  const [src, setSrc] = useState<string>(() => {
    if (!photoId) return url;
    return photoCache.get(photoId) ?? '';
  });
  const [loading, setLoading] = useState<boolean>(() => {
    if (!photoId) return false;
    return !photoCache.has(photoId);
  });

  useEffect(() => {
    if (!photoId) {
      setSrc(url);
      setLoading(false);
      return;
    }

    const cached = photoCache.get(photoId);
    if (cached) {
      setSrc(cached);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    getDoc(doc(db, 'journalPhotos', photoId))
      .then((snap) => {
        if (cancelled) return;
        const data = snap.data() as { dataUrl?: string } | undefined;
        const resolved = data?.dataUrl ?? '';
        if (resolved) {
          photoCache.set(photoId, resolved);
        }
        setSrc(resolved);
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) {
          setSrc('');
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [url, photoId]);

  return { src, loading, isFirestorePhoto: Boolean(photoId) };
}

export function JournalPhotoThumbnail({
  url,
  caption,
  alt,
  className = '',
}: {
  url: string;
  caption?: string;
  alt: string;
  className?: string;
}) {
  const { src, loading, isFirestorePhoto } = useResolvedPhotoSrc(url);
  const [broken, setBroken] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  useEffect(() => {
    setBroken(false);
  }, [url, src]);

  if (loading) {
    return <div className={`bg-slate-100 animate-pulse ${className}`} />;
  }

  if (!src || broken) {
    return (
      <div
        className={`bg-gradient-to-br from-[#102D46]/10 via-[#1C678A]/10 to-[#16A6A0]/15 flex flex-col items-center justify-center p-4 text-center gap-2 ${className}`}
      >
        <Camera className="w-6 h-6 text-[#1C678A]" />
        <p className="text-xs font-medium text-[#102D46]">
          {isFirestorePhoto ? 'Foto Dokumentasi' : 'Tautan Dokumentasi Eksternal'}
        </p>
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setLightboxOpen(true)}
        className={`block w-full h-full overflow-hidden cursor-pointer focus-visible:outline-2 focus-visible:outline-[#16A6A0] ${className}`}
        aria-label={`Perbesar foto: ${alt}`}
      >
        <img
          src={src}
          alt={alt}
          referrerPolicy="no-referrer"
          onError={() => setBroken(true)}
          className="w-full h-full object-cover"
        />
      </button>

      {lightboxOpen && (
        <div
          className="fixed inset-0 z-50 bg-[#102D46]/80 flex items-center justify-center p-4 sm:p-6"
          onClick={() => setLightboxOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label={alt}
        >
          <div
            className="bg-white rounded-xl max-w-3xl w-full overflow-hidden border border-slate-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between gap-4">
              <p className="text-sm font-semibold text-[#102D46] truncate">
                {caption || alt}
              </p>
              <div className="flex items-center gap-2 shrink-0">
                {!isFirestorePhoto && !url.startsWith('data:') && (
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-medium text-[#1C678A] hover:underline"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    Buka Asli
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => setLightboxOpen(false)}
                  className="p-1.5 rounded-md text-slate-600 hover:bg-slate-100 cursor-pointer"
                  aria-label="Tutup pratinjau foto"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="bg-slate-950 flex items-center justify-center max-h-[75vh]">
              <img
                src={src}
                alt={alt}
                referrerPolicy="no-referrer"
                className="max-h-[75vh] w-auto object-contain"
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
