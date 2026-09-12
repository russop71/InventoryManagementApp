import { Link, useLocation } from 'react-router';
import { CalendarClock, Users } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export function TeamPageTabs() {
  const { pathname } = useLocation();
  const { user, features } = useAuth();
  const manager = ['Owner', 'Admin', 'Manager', 'BOH Manager', 'FOH Manager'].includes(user?.role || '');
  if (!manager || !['/app/users', '/app/labor'].includes(pathname)) return null;
  const schedulerEnabled = features?.scheduling === true;
  const tabClass = (active: boolean) => `flex min-h-11 min-w-0 flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-bold ${active ? 'bg-[#303A43] text-white' : 'text-[#303A43] hover:bg-slate-100'}`;
  return <div className="mb-4">
    <nav aria-label="Users and scheduling" className="flex w-full max-w-md gap-1 rounded-2xl border border-slate-200 bg-white p-1">
      <Link to="/app/users" aria-current={pathname === '/app/users' ? 'page' : undefined} className={tabClass(pathname === '/app/users')}><Users className="h-4 w-4 shrink-0" />Users</Link>
      {schedulerEnabled
        ? <Link to="/app/labor" aria-current={pathname === '/app/labor' ? 'page' : undefined} className={tabClass(pathname === '/app/labor')}><CalendarClock className="h-4 w-4 shrink-0" />Scheduler</Link>
        : <button type="button" disabled className={`${tabClass(false)} cursor-not-allowed opacity-50`}><CalendarClock className="h-4 w-4 shrink-0" />Scheduler</button>}
    </nav>
    {!schedulerEnabled && <p className="mt-2 text-xs text-slate-600">Scheduling is not enabled for this account.</p>}
  </div>;
}
