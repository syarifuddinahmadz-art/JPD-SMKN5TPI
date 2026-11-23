import { ErrorBoundary } from './components/ErrorBoundary';
import { LoginPage } from './components/LoginPage';
import { RegistrationGate } from './components/RegistrationGate';
import { AppShell } from './components/AppShell';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ApprovalStatus, UserRole } from './types/auth';
import { BrandMark } from './components/BrandMark';

function AppContent() {
  const { firebaseUser, profile, authLoading, profileLoading } = useAuth();

  if (authLoading || (firebaseUser && profileLoading)) {
    return (
      <div className="min-h-screen bg-[#F5F7FA] flex flex-col items-center justify-center p-6 gap-4">
        <BrandMark size={44} />
        <div className="text-center space-y-1">
          <p className="text-sm font-semibold text-[#102D46]">Memuat JPD-SMK</p>
          <p className="text-xs text-slate-500">
            Menyiapkan sesi autentikasi dan koneksi Cloud Firestore...
          </p>
        </div>
      </div>
    );
  }

  if (!firebaseUser) {
    return <LoginPage />;
  }

  if (
    !profile ||
    profile.approvalStatus !== ApprovalStatus.APPROVED ||
    profile.role === UserRole.PENDING
  ) {
    return <RegistrationGate />;
  }

  return <AppShell />;
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ErrorBoundary>
  );
}
