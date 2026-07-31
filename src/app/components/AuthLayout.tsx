import { Navigate, Outlet } from 'react-router';
import { useAuth } from '../contexts/AuthContext';

export function AuthLayout() {
  const { isAuthenticated } = useAuth();

  // Loading state
  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#F5C10E]"></div>
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Render protected routes
  return <Outlet />;
}
