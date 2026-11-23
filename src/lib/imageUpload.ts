import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { db, handleFirestoreError, OperationType, storage } from './firebase';

export const FIRESTORE_PHOTO_PREFIX = 'firestore-photo://';

const MAX_STORAGE_DIMENSION = 1280;
const MAX_FIRESTORE_DATAURL_CHARS = 230000;
const MAX_RAW_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB input limit before compression

export interface UploadDocumentationResult {
  url: string;
  previewUrl: string;
  source: 'storage' | 'firestore';
}

function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('File gambar tidak dapat diproses oleh browser.'));
      img.src = String(reader.result);
    };
    reader.onerror = () => reject(new Error('Gagal membaca file gambar dari perangkat.'));
    reader.readAsDataURL(file);
  });
}

function renderResizedJpeg(
  img: HTMLImageElement,
  maxDimension: number,
  quality: number,
): Promise<{ blob: Blob; dataUrl: string }> {
  let { width, height } = img;
  if (width > maxDimension || height > maxDimension) {
    if (width >= height) {
      height = Math.round((height * maxDimension) / width);
      width = maxDimension;
    } else {
      width = Math.round((width * maxDimension) / height);
      height = maxDimension;
    }
  }

  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, width);
  canvas.height = Math.max(1, height);
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return Promise.reject(new Error('Browser tidak mendukung pemrosesan kanvas gambar.'));
  }
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  const dataUrl = canvas.toDataURL('image/jpeg', quality);
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Gagal mengompresi gambar ke format JPEG.'));
          return;
        }
        resolve({ blob, dataUrl });
      },
      'image/jpeg',
      quality,
    );
  });
}

async function compressForFirestore(img: HTMLImageElement): Promise<{ dataUrl: string; sizeBytes: number }> {
  const attempts: Array<{ dim: number; quality: number }> = [
    { dim: 900, quality: 0.72 },
    { dim: 760, quality: 0.62 },
    { dim: 640, quality: 0.54 },
    { dim: 520, quality: 0.45 },
  ];

  for (const step of attempts) {
    const { blob, dataUrl } = await renderResizedJpeg(img, step.dim, step.quality);
    if (dataUrl.length <= MAX_FIRESTORE_DATAURL_CHARS && blob.size <= 175000) {
      return { dataUrl, sizeBytes: blob.size };
    }
  }

  throw new Error('Ukuran foto terlalu kompleks untuk dikompresi di bawah batas 175 KB.');
}

export async function uploadTeachingDocumentation(
  uid: string,
  file: File,
): Promise<UploadDocumentationResult> {
  const isImage =
    file.type.startsWith('image/') || /\.(jpe?g|png|webp|gif|bmp)$/i.test(file.name);
  if (!isImage) {
    throw new Error('Pilih file gambar dengan format JPG, PNG, atau WebP.');
  }
  if (file.size > MAX_RAW_UPLOAD_BYTES) {
    throw new Error('Ukuran file gambar maksimal 10 MB sebelum dikompresi.');
  }

  const img = await loadImageFromFile(file);
  const { blob, dataUrl: previewDataUrl } = await renderResizedJpeg(
    img,
    MAX_STORAGE_DIMENSION,
    0.8,
  );

  const safeBaseName = file.name
    .replace(/\.[^/.]+$/, '')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .slice(0, 40);

  // 1. Coba unggah ke Firebase Storage terlebih dahulu jika bucket aktif
  try {
    const storagePath = `teaching_docs/${uid}/${Date.now()}_${safeBaseName || 'doc'}.jpg`;
    const storageRef = ref(storage, storagePath);
    const snapshot = await uploadBytes(storageRef, blob, {
      contentType: 'image/jpeg',
    });
    const downloadUrl = await getDownloadURL(snapshot.ref);
    return {
      url: downloadUrl,
      previewUrl: downloadUrl,
      source: 'storage',
    };
  } catch {
    // Firebase Storage bucket belum aktif / CORS / belum terkonfigurasi -> fallback ke koleksi /journalPhotos
  }

  // 2. Fallback resmi: simpan gambar terkompresi ringan ke Cloud Firestore (/journalPhotos)
  const { dataUrl, sizeBytes } = await compressForFirestore(img);
  try {
    const photoDocRef = await addDoc(collection(db, 'journalPhotos'), {
      ownerUid: uid,
      fileName: (file.name || 'dokumentasi.jpg').slice(0, 120),
      mimeType: 'image/jpeg',
      sizeBytes,
      dataUrl,
      createdAt: serverTimestamp(),
    });
    return {
      url: `${FIRESTORE_PHOTO_PREFIX}${photoDocRef.id}`,
      previewUrl: dataUrl || previewDataUrl,
      source: 'firestore',
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, 'journalPhotos');
  }
}

export function extractFirestorePhotoId(url: string): string | null {
  if (!url.startsWith(FIRESTORE_PHOTO_PREFIX)) return null;
  const id = url.slice(FIRESTORE_PHOTO_PREFIX.length).trim();
  return id || null;
}
