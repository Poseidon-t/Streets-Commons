import { useUser, SignIn } from '@clerk/clerk-react';

const ADMIN_USER_ID = import.meta.env.VITE_ADMIN_USER_ID;

export default function AdminGuard({ children }: { children: React.ReactNode }) {
  const { user, isLoaded, isSignedIn } = useUser();

  if (!isLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-lg text-gray-500">Loading...</div>
      </div>
    );
  }

  if (!isSignedIn) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full px-4">
          <h1 className="text-2xl font-bold text-center mb-6" style={{ color: '#2a3a2a' }}>
            Admin Sign In
          </h1>
          <SignIn routing="hash" />
        </div>
      </div>
    );
  }

  if (ADMIN_USER_ID && user.id !== ADMIN_USER_ID) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center px-6">
          <h1 className="text-3xl font-bold mb-2" style={{ color: '#2a3a2a' }}>Access Denied</h1>
          <p className="text-gray-600">You do not have admin access.</p>
          <a href="/" className="inline-block mt-4 text-sm font-medium" style={{ color: '#e07850' }}>
            Back to SafeStreets
          </a>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
