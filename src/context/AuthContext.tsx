import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import {
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import {
  auth,
  db,
  googleProvider,
  handleFirestoreError,
  OperationType,
  testConnection,
} from '../lib/firebase';
import {
  ApprovalStatus,
  BOOTSTRAPPED_ADMIN_EMAIL,
  FIELD_LIMITS,
  RequestedRole,
  UID_PATTERN,
  UserRole,
  type UserProfile,
} from '../types/auth';

interface RegistrationInput {
  displayName: string;
  nip: string;
  jabatan: string;
  requestedRole: RequestedRole;
}

interface ProfileUpdateInput {
  displayName: string;
  nip: string;
  jabatan: string;
}

interface AuthContextValue {
  firebaseUser: User | null;
  profile: UserProfile | null;
  authLoading: boolean;
  profileLoading: boolean;
  firestoreStatus: 'checking' | 'connected' | 'offline';
  authError: string | null;
  isSigningIn: boolean;
  clearAuthError: () => void;
  signInWithGoogle: () => Promise<void>;
  signOutUser: () => Promise<void>;
  submitRegistration: (input: RegistrationInput) => Promise<void>;
  resubmitRegistration: (input: RegistrationInput) => Promise<void>;
  updateOwnProfile: (input: ProfileUpdateInput) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function sanitizeText(value: string, maxLength: number): string {
  return value.trim().slice(0, maxLength);
}

function mapFirebaseAuthError(error: unknown): string {
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code: unknown }).code)
      : '';

  switch (code) {
    case 'auth/popup-closed-by-user':
      return 'Jendela masuk Google ditutup sebelum proses selesai. Silakan coba kembali.';
    case 'auth/popup-blocked':
      return 'Pop-up browser diblokir. Izinkan pop-up untuk melanjutkan masuk dengan Google.';
    case 'auth/unauthorized-domain':
      return 'Domain aplikasi belum terdaftar pada Authorized Domains di Firebase Authentication.';
    case 'auth/network-request-failed':
      return 'Koneksi jaringan bermasalah. Periksa sambungan internet Anda dan coba lagi.';
    case 'auth/cancelled-popup-request':
      return 'Permintaan masuk sebelumnya sedang diproses. Silakan tunggu sebentar.';
    default:
      return error instanceof Error
        ? `Gagal masuk dengan Google: ${error.message}`
        : 'Terjadi kesalahan saat melakukan autentikasi Google.';
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);
  const [firestoreStatus, setFirestoreStatus] = useState<'checking' | 'connected' | 'offline'>(
    'checking',
  );
  const [authError, setAuthError] = useState<string | null>(null);
  const [isSigningIn, setIsSigningIn] = useState(false);

  useEffect(() => {
    let active = true;
    testConnection().then((status) => {
      if (active) {
        setFirestoreStatus(status);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user);
      setAuthLoading(false);
      if (!user) {
        setProfile(null);
        setProfileLoading(false);
      }
    });
    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    if (!firebaseUser) {
      return;
    }

    setProfileLoading(true);
    const userDocPath = `users/${firebaseUser.uid}`;
    const userRef = doc(db, 'users', firebaseUser.uid);

    const unsubscribeProfile = onSnapshot(
      userRef,
      (snapshot) => {
        if (snapshot.exists()) {
          setProfile(snapshot.data() as UserProfile);
        } else {
          setProfile(null);
        }
        setProfileLoading(false);
      },
      (error) => {
        setProfileLoading(false);
        handleFirestoreError(error, OperationType.GET, userDocPath);
      },
    );

    return () => unsubscribeProfile();
  }, [firebaseUser]);

  const signInWithGoogle = async () => {
    setAuthError(null);
    setIsSigningIn(true);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      setAuthError(mapFirebaseAuthError(error));
    } finally {
      setIsSigningIn(false);
    }
  };

  const signOutUser = async () => {
    setAuthError(null);
    await signOut(auth);
  };

  const submitRegistration = async (input: RegistrationInput) => {
    if (!firebaseUser || !firebaseUser.email) {
      throw new Error('Sesi autentikasi Google tidak ditemukan.');
    }
    if (!firebaseUser.emailVerified) {
      throw new Error('Email Google Anda belum terverifikasi.');
    }
    if (!UID_PATTERN.test(firebaseUser.uid) || firebaseUser.uid.length > FIELD_LIMITS.uidMax) {
      throw new Error('Format UID akun tidak valid.');
    }

    const displayName = sanitizeText(input.displayName, FIELD_LIMITS.displayNameMax);
    if (displayName.length < FIELD_LIMITS.displayNameMin) {
      throw new Error(`Nama lengkap minimal ${FIELD_LIMITS.displayNameMin} karakter.`);
    }

    const email = sanitizeText(firebaseUser.email, FIELD_LIMITS.emailMax);
    const photoURL = sanitizeText(firebaseUser.photoURL ?? '', FIELD_LIMITS.photoURLMax);
    const nip = sanitizeText(input.nip, FIELD_LIMITS.nipMax);
    const jabatan = sanitizeText(input.jabatan, FIELD_LIMITS.jabatanMax);

    const isBootstrappedAdmin =
      email === BOOTSTRAPPED_ADMIN_EMAIL && firebaseUser.emailVerified;

    const payload = {
      uid: firebaseUser.uid,
      email,
      displayName,
      photoURL,
      nip,
      jabatan,
      requestedRole: isBootstrappedAdmin ? RequestedRole.ADMIN : input.requestedRole,
      role: isBootstrappedAdmin ? UserRole.ADMIN : UserRole.PENDING,
      approvalStatus: isBootstrappedAdmin ? ApprovalStatus.APPROVED : ApprovalStatus.PENDING,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    const path = `users/${firebaseUser.uid}`;
    try {
      await setDoc(doc(db, 'users', firebaseUser.uid), payload);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  };

  const resubmitRegistration = async (input: RegistrationInput) => {
    if (!firebaseUser) {
      throw new Error('Sesi autentikasi Google tidak ditemukan.');
    }

    const displayName = sanitizeText(input.displayName, FIELD_LIMITS.displayNameMax);
    if (displayName.length < FIELD_LIMITS.displayNameMin) {
      throw new Error(`Nama lengkap minimal ${FIELD_LIMITS.displayNameMin} karakter.`);
    }

    const nip = sanitizeText(input.nip, FIELD_LIMITS.nipMax);
    const jabatan = sanitizeText(input.jabatan, FIELD_LIMITS.jabatanMax);

    const path = `users/${firebaseUser.uid}`;
    try {
      await updateDoc(doc(db, 'users', firebaseUser.uid), {
        displayName,
        nip,
        jabatan,
        requestedRole: input.requestedRole,
        approvalStatus: ApprovalStatus.PENDING,
        role: UserRole.PENDING,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  };

  const updateOwnProfile = async (input: ProfileUpdateInput) => {
    if (!firebaseUser || !profile) {
      throw new Error('Profil pengguna tidak ditemukan.');
    }

    const displayName = sanitizeText(input.displayName, FIELD_LIMITS.displayNameMax);
    if (displayName.length < FIELD_LIMITS.displayNameMin) {
      throw new Error(`Nama lengkap minimal ${FIELD_LIMITS.displayNameMin} karakter.`);
    }

    const nip = sanitizeText(input.nip, FIELD_LIMITS.nipMax);
    const jabatan = sanitizeText(input.jabatan, FIELD_LIMITS.jabatanMax);
    const photoURL = sanitizeText(firebaseUser.photoURL ?? profile.photoURL, FIELD_LIMITS.photoURLMax);

    const path = `users/${firebaseUser.uid}`;
    try {
      await updateDoc(doc(db, 'users', firebaseUser.uid), {
        displayName,
        nip,
        jabatan,
        photoURL,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        firebaseUser,
        profile,
        authLoading,
        profileLoading,
        firestoreStatus,
        authError,
        isSigningIn,
        clearAuthError: () => setAuthError(null),
        signInWithGoogle,
        signOutUser,
        submitRegistration,
        resubmitRegistration,
        updateOwnProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth harus digunakan di dalam AuthProvider.');
  }
  return ctx;
}
