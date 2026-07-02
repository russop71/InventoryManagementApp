import { Outlet, Link, useLocation } from 'react-router';
import {
  LayoutDashboard, Package, TrendingUp, Sparkles, ChefHat,
  Users, LogOut, CreditCard, HelpCircle, MessageSquare, Bell,
  FileText, Shield, User, Truck, AlarmClock, Settings,
} from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from './ui/dropdown-menu';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';

// ZestIQ lemon logo — true lemon oval shape (wider mid, tapered ends) with
// speech-bubble tail at bottom-left, 3 ascending bar-chart bars, green leaf.
// Yellow lemon on white header background.
function ZestIQLogo({ size = 36 }: { size?: number }) {
  const h = Math.round(size * 1.22);
  return (
    <svg width={size} height={h} viewBox="0 0 100 122" fill="none">
      {/* ── Lemon body ─────────────────────────────────────────────────────
          Oval that tapers to a slight point at the top (stem end) and is
          rounder at the bottom, with a speech-bubble tail at bottom-left.
          Control points closer to centre at top → pointed; wider at mid.  */}
      <path
        d="M 50 10
           C 60 8, 88 26, 88 52
           C 88 78, 66 95, 50 95
           L 28 110 L 15 95
           C 10 87, 12 70, 12 52
           C 12 26, 40 8, 50 10 Z"
        stroke="#F5C10E"
        strokeWidth="7"
        fill="none"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {/* ── 3 ascending bars (short / medium / tall), same baseline y=83 ── */}
      <rect x="23" y="63" width="13" height="20" rx="3" fill="#F5C10E" />
      <rect x="40" y="50" width="13" height="33" rx="3" fill="#F5C10E" />
      <rect x="57" y="38" width="13" height="45" rx="3" fill="#F5C10E" />
      {/* ── Green leaf — top-right, overlapping the lemon body ───────────── */}
      <path d="M 56 18 C 63 2, 90 0, 92 17 C 79 25, 61 23, 56 18 Z" fill="#4CAF50" />
      <path d="M 56 18 C 70 12, 84 8, 92 17" stroke="#3D8B40" strokeWidth="1.5" strokeLinecap="round" fill="none" />
    </svg>
  );
}

export function Layout() {
  const location = useLocation();
  const navigate = useNavigate();

  const navItems = [
    { path: '/',           label: 'Dashboard', icon: LayoutDashboard },
    { path: '/inventory',  label: 'Inventory',  icon: Package },
    { path: '/recipes',    label: 'Recipes',    icon: ChefHat },
    { path: '/ai-orders',  label: 'AI Orders',  icon: Sparkles },
    { path: '/forecasting',label: 'Forecast',   icon: TrendingUp },
  ];

  const handleLogout = () => {
    localStorage.removeItem('isAuthenticated');
    localStorage.removeItem('userEmail');
    toast.success('Logged out successfully');
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-[#F4F5F7] pb-20">

      {/* ── White header ───────────────────────────────── */}
      <header className="sticky top-0 z-10 bg-white shadow-sm border-b border-gray-100">
        <div className="flex items-center justify-between px-4 py-3">

          {/* LEFT — hamburger (3 dark lines) */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="w-10 h-10 flex items-center justify-center rounded-xl transition-colors focus:outline-none"
                style={{ background: 'transparent' }}
                aria-label="Menu"
              >
                <div className="flex flex-col gap-[5px]">
                  <span className="block w-5   h-[2.5px] rounded-full" style={{ background: '#0F172A' }} />
                  <span className="block w-5   h-[2.5px] rounded-full" style={{ background: '#0F172A' }} />
                  <span className="block w-3.5 h-[2.5px] rounded-full" style={{ background: '#0F172A' }} />
                </div>
              </button>
            </DropdownMenuTrigger>

            <DropdownMenuContent align="start" className="w-56 bg-white shadow-2xl rounded-2xl border-0 mt-1">
              <div className="px-3 py-3 border-b border-gray-100">
                <p className="text-sm font-bold text-gray-900">Gusto 501</p>
                <p className="text-xs text-gray-400 mt-0.5">Pasquale Russo</p>
              </div>
              <div className="py-1">
                <DropdownMenuItem onClick={() => navigate('/account')}      className="rounded-lg mx-1"><User     className="w-4 h-4 mr-2.5 text-gray-400" />Account</DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate('/users')}        className="rounded-lg mx-1"><Users    className="w-4 h-4 mr-2.5 text-gray-400" />Users</DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate('/payment-method')} className="rounded-lg mx-1"><CreditCard className="w-4 h-4 mr-2.5 text-gray-400" />Payment Method</DropdownMenuItem>
              </div>
              <DropdownMenuSeparator />
              <div className="py-1">
                <DropdownMenuLabel className="text-[10px] text-gray-400 uppercase tracking-widest font-bold px-3 pb-1">Settings</DropdownMenuLabel>
                <DropdownMenuItem onClick={() => navigate('/suppliers')}    className="rounded-lg mx-1"><Truck     className="w-4 h-4 mr-2.5 text-gray-400" />Suppliers</DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate('/integrations')} className="rounded-lg mx-1"><Settings  className="w-4 h-4 mr-2.5 text-gray-400" />Integrations</DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate('/notifications')}className="rounded-lg mx-1"><Bell      className="w-4 h-4 mr-2.5 text-gray-400" />Notifications</DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate('/order-alarms')} className="rounded-lg mx-1"><AlarmClock className="w-4 h-4 mr-2.5 text-gray-400" />Order Alarms</DropdownMenuItem>
              </div>
              <DropdownMenuSeparator />
              <div className="py-1">
                <DropdownMenuLabel className="text-[10px] text-gray-400 uppercase tracking-widest font-bold px-3 pb-1">Support</DropdownMenuLabel>
                <DropdownMenuItem onClick={() => navigate('/help')}    className="rounded-lg mx-1"><HelpCircle    className="w-4 h-4 mr-2.5 text-gray-400" />Help Center</DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate('/contact')} className="rounded-lg mx-1"><MessageSquare className="w-4 h-4 mr-2.5 text-gray-400" />Contact Us</DropdownMenuItem>
              </div>
              <DropdownMenuSeparator />
              <div className="py-1">
                <DropdownMenuItem onClick={() => navigate('/terms')}   className="rounded-lg mx-1"><FileText className="w-4 h-4 mr-2.5 text-gray-400" />Terms of Service</DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate('/privacy')} className="rounded-lg mx-1"><Shield   className="w-4 h-4 mr-2.5 text-gray-400" />Privacy Policy</DropdownMenuItem>
              </div>
              <DropdownMenuSeparator />
              <div className="py-1">
                <DropdownMenuItem onClick={handleLogout} className="rounded-lg mx-1 text-red-600 focus:text-red-600 focus:bg-red-50">
                  <LogOut className="w-4 h-4 mr-2.5" />Logout
                </DropdownMenuItem>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* CENTER — ZestIQ logo + wordmark */}
          <div className="flex items-center gap-2">
            <ZestIQLogo size={36} />
            <div className="flex items-baseline">
              <span className="font-black text-[21px] leading-none tracking-tight text-[#0F172A]"
                    style={{ fontFamily: 'var(--font-sans)' }}>zest</span>
              <span className="font-black text-[21px] leading-none tracking-tight text-[#F5C10E]"
                    style={{ fontFamily: 'var(--font-sans)' }}>IQ</span>
            </div>
          </div>

          {/* RIGHT — bell */}
          <button
            onClick={() => navigate('/notifications')}
            className="relative w-10 h-10 flex items-center justify-center rounded-xl transition-colors focus:outline-none"
            aria-label="Notifications"
          >
            <Bell className="w-5 h-5" style={{ color: '#0F172A' }} />
            <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-red-500 border-2" style={{ borderColor: '#F5C10E' }} />
          </button>
        </div>
      </header>

      {/* ── Content ──────────────────────────────────────── */}
      <main className="px-4 py-4">
        <Outlet />
      </main>

      {/* ── Bottom nav ───────────────────────────────────── */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-gray-100 safe-area-inset-bottom z-20">
        <div className="flex items-center px-2 py-2">
          {navItems.map(({ path, label, icon: Icon }) => {
            const active = location.pathname === path;
            return (
              <Link
                key={path}
                to={path}
                className={`relative flex flex-col items-center justify-center flex-1 py-1.5 px-1 rounded-xl transition-all duration-150 ${active ? 'text-[#0F172A]' : 'text-gray-400'}`}
              >
                {active && <div className="absolute inset-0 rounded-xl" style={{ background: 'rgba(245,193,14,0.18)' }} />}
                {active && <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-5 h-[3px] rounded-full" style={{ background: '#F5C10E' }} />}
                <Icon className={`relative z-10 w-5 h-5 mb-0.5 ${active ? 'stroke-[2.5]' : ''}`} />
                <span className={`relative z-10 text-[10px] leading-tight ${active ? 'font-bold' : 'font-medium'}`}>{label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
