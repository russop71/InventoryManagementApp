import { useEffect } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router';
import { LogOut, PackageCheck, Sparkles, ShoppingCart } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { apiRequest } from '../utils/api';

function navClass(active: boolean) {
  return `flex min-h-14 flex-1 items-center justify-center gap-2 rounded-2xl px-4 text-sm font-black transition ${active ? 'bg-[#F5C10E] text-[#0B1220]' : 'text-slate-500 hover:bg-slate-100 hover:text-[#0B1220]'}`;
}

export function OrdersAppLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { accountId, accountName, activeLocationId, locations, switchLocation, user, logout } = useAuth();

  useEffect(() => {
    const previousTitle = document.title;
    const manifest = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
    const previousManifest = manifest?.getAttribute('href') || '/zestiq.webmanifest';
    document.title = 'ZestOrders | Restaurant Purchasing';
    manifest?.setAttribute('href', '/zestorders.webmanifest');
    return () => {
      document.title = previousTitle;
      manifest?.setAttribute('href', previousManifest);
    };
  }, []);

  useEffect(() => {
    if (!accountId) return;
    void apiRequest(`/api/v1/accounts/${encodeURIComponent(accountId)}/usage`, {
      method: 'POST',
      body: JSON.stringify({ eventName: 'page_view', path: location.pathname, metadata: { locationId: activeLocationId, app: 'ZestOrders' } }),
    }).catch(() => {
      // Usage telemetry must not interrupt ordering.
    });
  }, [accountId, activeLocationId, location.pathname]);

  const signOut = () => {
    logout();
    navigate('/login?returnTo=/orders');
  };

  return (
    <div className="min-h-screen overflow-x-clip bg-[#F4F5F7] pb-24">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 shadow-sm backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3">
          <NavLink to="/orders" className="flex min-w-0 items-center gap-3 rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-[#F5C10E]">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#0B1220] text-[#F5C10E] shadow-md"><ShoppingCart className="h-6 w-6" /></span>
            <span className="min-w-0">
              <span className="block truncate text-xl font-black tracking-tight text-[#0B1220]">Zest<span className="text-[#D59F00]">Orders</span></span>
              <span className="block truncate text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">{accountName || 'Restaurant purchasing'}</span>
            </span>
          </NavLink>

          <div className="flex items-center gap-2">
            {locations.length > 1 && (
              <label className="hidden items-center gap-2 text-xs font-bold text-slate-500 sm:flex">
                Location
                <select value={activeLocationId || ''} onChange={event => switchLocation(event.target.value)} className="h-10 max-w-52 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800">
                  {locations.map(entry => <option key={entry.id} value={entry.id}>{entry.name}</option>)}
                </select>
              </label>
            )}
            <button type="button" onClick={signOut} aria-label="Sign out" className="grid h-11 w-11 place-items-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600">
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 border-t border-slate-100 px-4 py-2 sm:hidden">
          <span className="truncate text-xs font-semibold text-slate-500">{user?.name}</span>
          {locations.length > 1 ? (
            <select aria-label="Location" value={activeLocationId || ''} onChange={event => switchLocation(event.target.value)} className="h-9 max-w-48 rounded-xl border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-800">
              {locations.map(entry => <option key={entry.id} value={entry.id}>{entry.name}</option>)}
            </select>
          ) : <span className="truncate text-xs font-semibold text-slate-500">{locations[0]?.name}</span>}
        </div>
      </header>

      <main className="mx-auto max-w-7xl p-4 sm:p-6">
        <div className="mb-4 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
          <PackageCheck className="mt-0.5 h-5 w-5 shrink-0" />
          <div><p className="font-black">Ordering workspace</p><p className="mt-1 text-xs leading-5 text-amber-800">Orders, receiving and shared stock update the same restaurant account used by the management team.</p></div>
        </div>
        <Outlet />
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-200 bg-white/95 p-2 shadow-[0_-10px_30px_rgba(15,23,42,0.08)] backdrop-blur">
        <div className="mx-auto flex max-w-md gap-2">
          <NavLink end to="/orders" className={({ isActive }) => navClass(isActive)}><ShoppingCart className="h-5 w-5" />Orders</NavLink>
          <NavLink to="/orders/ai" className={({ isActive }) => navClass(isActive)}><Sparkles className="h-5 w-5" />Suggestions</NavLink>
        </div>
      </nav>
    </div>
  );
}
