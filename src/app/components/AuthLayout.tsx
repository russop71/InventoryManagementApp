import { Navigate, Outlet, useLocation } from 'react-router';
import { useAuth } from '../contexts/AuthContext';
import { ShieldAlert } from 'lucide-react';

export function AuthLayout() {
  const location = useLocation();
  const { isAuthenticated, user, productAccess, onboarding, mfaRequired } = useAuth();

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

  if (mfaRequired) return <Navigate to="/mfa" replace />;

  if (user?.role === 'Staff' && location.pathname.startsWith('/app')) {
    return <Navigate to="/employee" replace />;
  }

  if (!productAccess) {
    const ownerBillingRoute = user?.role === 'Owner' && ['/app/payment-method', '/app/account'].includes(location.pathname);
    if (user?.role === 'Owner' && !ownerBillingRoute) return <Navigate to="/app/payment-method" replace />;
    if (user?.role !== 'Owner') {
      return (
        <main className="flex min-h-screen items-center justify-center bg-[#F8FAFC] p-6">
          <section className="w-full max-w-lg rounded-[28px] border border-slate-200 bg-white p-8 text-center shadow-xl shadow-slate-200/50">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100 text-amber-800"><ShieldAlert className="h-7 w-7" /></span>
            <h1 className="mt-5 text-2xl font-black text-[#0B1220]">Company subscription inactive</h1>
            <p className="mt-3 text-sm leading-6 text-slate-600">Your restaurant data remains protected. Ask your company owner to activate or update ZestIQ billing before continuing.</p>
          </section>
        </main>
      );
    }
  }

  const onboardingNeeded = ['Owner', 'Admin'].includes(user?.role || '') && ['not_started', 'in_progress'].includes(onboarding.status);
  const onboardingExempt = ['/app/onboarding', '/app/payment-method', '/app/account'].includes(location.pathname);
  if (productAccess && onboardingNeeded && !onboardingExempt) return <Navigate to="/app/onboarding" replace />;

  // Render protected routes
  return <Outlet />;
}
