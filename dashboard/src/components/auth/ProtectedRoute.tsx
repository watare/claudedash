import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { useEffect } from 'react';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

/**
 * ProtectedRoute component - wraps routes that require authentication
 * Redirects to /login if user is not authenticated
 * Shows loading spinner while checking auth state
 */
export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, checkAuth } = useAuthStore();
  const location = useLocation();

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#0B0E11]">
        <div className="animate-spin h-8 w-8 border-2 border-[#F0B90B] border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!isAuthenticated) {
    // Save the attempted URL for redirecting after login
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}
