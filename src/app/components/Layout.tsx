import { useEffect, useRef, useState } from 'react';
import { Outlet, Link, useLocation } from 'react-router';
import {
  LayoutDashboard, Package, ChefHat,
  Users, LogOut, CreditCard, HelpCircle, MessageSquare, Bell,
  FileText, Shield, User, Truck, AlarmClock, Settings, Receipt, ChevronDown, Building2, CalendarClock, Trash2,
} from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from './ui/dropdown-menu';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';
import { apiRequest } from '../utils/api';
import { AIChat } from './AIChat';
import { ZestIQBrand } from './ZestIQBrand';

export function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout, accountId, accountName, locations, activeLocationId, switchLocation, features } = useAuth();
  const [openTopMenu, setOpenTopMenu] = useState<string | null>(null);
  const closeTopMenuTimer = useRef<number | null>(null);
  // A partially migrated account must never make the app shell fail to render.
  // Until its feature settings are available, Labour is simply unavailable.
  const canManageLabor = features?.scheduling === true && ['Owner', 'Admin', 'Manager', 'BOH Manager', 'FOH Manager'].includes(user?.role || '');

  const navItems = [
    { path: '/app', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/app/inventory', label: 'Inventory', icon: Package },
    { path: '/app/recipes', label: 'Recipes', icon: ChefHat },
    { path: '/app/orders', label: 'Purchasing', icon: Truck },
    { path: '/app/invoices', label: 'Invoices', icon: Receipt },
    ...(canManageLabor ? [{ path: '/app/labor', label: 'Labour', icon: CalendarClock }] : []),
  ];

  const topMenuGroups = [
    {
      label: 'Items & Setup',
      items: [
        { label: 'Inventory', path: '/app/inventory' },
        { label: 'Recipes', path: '/app/recipes' },
        { label: 'Beverage Costing', path: '/app/beverages' },
        { label: 'Suppliers', path: '/app/suppliers' },
      ],
    },
    {
      label: 'Purchasing',
      items: [
        { label: 'Orders', path: '/app/orders' },
        { label: 'Invoices', path: '/app/invoices' },
        { label: 'AI Orders', path: '/app/ai-orders' },
      ],
    },
    {
      label: 'Reports',
      items: [
        { label: 'Forecasting', path: '/app/forecasting' },
        { label: 'Cost Breakdown', path: '/app/costs' },
        { label: 'COGS Breakdown', path: '/app/cogs' },
        { label: 'Waste Tracking', path: '/app/waste' },
      ],
    },
    {
      label: 'Team',
      items: [
        ...(canManageLabor ? [{ label: 'Labour & Scheduling', path: '/app/labor' }] : [{ label: 'My schedule', path: '/employee' }]),
        ...(user?.role === 'Owner' ? [{ label: 'Users & Usage', path: '/app/users' }] : []),
      ],
    },
  ];

  const handleLogout = () => {
    logout();
    toast.success('Logged out successfully');
    navigate('/login');
  };

  const clearTopMenuCloseTimer = () => {
    if (closeTopMenuTimer.current !== null) {
      window.clearTimeout(closeTopMenuTimer.current);
      closeTopMenuTimer.current = null;
    }
  };

  const openMenu = (label: string) => {
    clearTopMenuCloseTimer();
    setOpenTopMenu(label);
  };

  const scheduleMenuClose = () => {
    clearTopMenuCloseTimer();
    closeTopMenuTimer.current = window.setTimeout(() => {
      setOpenTopMenu(null);
      closeTopMenuTimer.current = null;
    }, 320);
  };

  useEffect(() => {
    return () => {
      if (closeTopMenuTimer.current !== null) {
        window.clearTimeout(closeTopMenuTimer.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!accountId) return;
    void apiRequest(`/api/v1/accounts/${encodeURIComponent(accountId)}/usage`, {
      method: 'POST',
      body: JSON.stringify({
        eventName: 'page_view',
        path: location.pathname,
        metadata: { locationId: activeLocationId },
      }),
    }).catch(() => {
      // Usage telemetry must never interrupt the user workflow.
    });
  }, [accountId, activeLocationId, location.pathname]);

  return (
    <div className="zestiq-app-shell min-h-screen overflow-x-clip bg-[#F4F5F7] pb-20">

      {/* ── White header ───────────────────────────────── */}
      <header className="sticky top-0 z-40 bg-white shadow-sm border-b border-gray-100">
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
                <p className="text-sm font-bold text-gray-900">{accountName || 'zestIQ Account'}</p>
                <p className="text-xs text-gray-400 mt-0.5">{user?.name || 'Team Member'}</p>
              </div>
              <div className="py-1">
                {user?.platformAdmin && (
                  <DropdownMenuItem onClick={() => navigate('/app/platform')} className="rounded-lg mx-1 bg-[#FEF9C3]/60 font-semibold"><Building2 className="w-4 h-4 mr-2.5 text-[#A16207]" />ZestIQ Admin</DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={() => navigate('/app/account')}      className="rounded-lg mx-1"><User     className="w-4 h-4 mr-2.5 text-gray-400" />Account</DropdownMenuItem>
                {user?.role === 'Owner' && (
                  <>
                    <DropdownMenuItem onClick={() => navigate('/app/users')} className="rounded-lg mx-1"><Users className="w-4 h-4 mr-2.5 text-gray-400" />Users & Usage</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate('/app/payment-method')} className="rounded-lg mx-1"><CreditCard className="w-4 h-4 mr-2.5 text-gray-400" />Subscription & Billing</DropdownMenuItem>
                  </>
                )}
              </div>
              <DropdownMenuSeparator />
              <div className="py-1">
                <DropdownMenuLabel className="text-[10px] text-gray-400 uppercase tracking-widest font-bold px-3 pb-1">Settings</DropdownMenuLabel>
                <DropdownMenuItem onClick={() => navigate('/app/suppliers')}    className="rounded-lg mx-1"><Truck     className="w-4 h-4 mr-2.5 text-gray-400" />Suppliers</DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate('/app/integrations')} className="rounded-lg mx-1"><Settings  className="w-4 h-4 mr-2.5 text-gray-400" />Integrations</DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate('/app/notifications')}className="rounded-lg mx-1"><Bell      className="w-4 h-4 mr-2.5 text-gray-400" />Notifications</DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate('/app/order-alarms')} className="rounded-lg mx-1"><AlarmClock className="w-4 h-4 mr-2.5 text-gray-400" />Order Alarms</DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate('/app/waste')} className="rounded-lg mx-1"><Trash2 className="w-4 h-4 mr-2.5 text-gray-400" />Waste Tracking</DropdownMenuItem>
              </div>
              <DropdownMenuSeparator />
              <div className="py-1">
                <DropdownMenuLabel className="text-[10px] text-gray-400 uppercase tracking-widest font-bold px-3 pb-1">Support</DropdownMenuLabel>
                <DropdownMenuItem onClick={() => navigate('/app/help')}    className="rounded-lg mx-1"><HelpCircle    className="w-4 h-4 mr-2.5 text-gray-400" />Help Center</DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate('/app/contact')} className="rounded-lg mx-1"><MessageSquare className="w-4 h-4 mr-2.5 text-gray-400" />Contact Us</DropdownMenuItem>
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
          <Link to="/app" aria-label="ZestIQ dashboard" className="rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-[#F5C10E]">
            <ZestIQBrand wordmarkClassName="text-[21px] text-[#0F172A]" />
          </Link>

          {/* RIGHT — bell */}
          <button
            onClick={() => navigate('/app/notifications')}
            className="relative w-10 h-10 flex items-center justify-center rounded-xl transition-colors focus:outline-none"
            aria-label="Notifications"
          >
            <Bell className="w-5 h-5" style={{ color: '#0F172A' }} />
            <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-red-500 border-2" style={{ borderColor: '#F5C10E' }} />
          </button>
        </div>

        <div className="flex min-w-0 items-center gap-2 overflow-x-auto px-4 pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="flex shrink-0 items-center gap-2 rounded-full border border-gray-200 bg-gray-50 px-2 py-1.5">
            {topMenuGroups.map(group => (
              <DropdownMenu
                key={group.label}
                open={openTopMenu === group.label}
                onOpenChange={open => {
                  clearTopMenuCloseTimer();
                  setOpenTopMenu(open ? group.label : null);
                }}
              >
                <div
                  onMouseEnter={() => openMenu(group.label)}
                  onMouseLeave={scheduleMenuClose}
                >
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      aria-expanded={openTopMenu === group.label}
                      className="flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-gray-600 transition hover:bg-white hover:text-[#0F172A]"
                    >
                      <span>{group.label}</span>
                      <ChevronDown className="h-3.5 w-3.5" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="start"
                    sideOffset={8}
                    onMouseEnter={clearTopMenuCloseTimer}
                    onMouseLeave={scheduleMenuClose}
                    className="z-[100] min-w-[190px] rounded-2xl border border-gray-200 bg-white p-2 shadow-2xl"
                  >
                    {group.items.map(item => {
                      const active = location.pathname === item.path || location.pathname.startsWith(`${item.path}/`);
                      return (
                        <DropdownMenuItem
                          key={item.path}
                          onSelect={() => {
                            setOpenTopMenu(null);
                            navigate(item.path);
                          }}
                          className={`flex w-full cursor-pointer items-center rounded-xl px-3 py-2 text-left text-sm transition ${active ? 'bg-[#FEF3C7] text-[#0F172A]' : 'text-gray-700 hover:bg-gray-50'}`}
                        >
                          {item.label}
                        </DropdownMenuItem>
                      );
                    })}
                  </DropdownMenuContent>
                </div>
              </DropdownMenu>
            ))}
          </div>
          <div className="ml-auto flex shrink-0 items-center gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Location</span>
            <select
              className="h-8 rounded-lg border border-gray-200 bg-white px-2.5 text-xs font-medium text-gray-700"
              value={activeLocationId ?? ''}
              onChange={(event) => switchLocation(event.target.value)}
            >
              {locations.map(site => (
                <option key={site.id} value={site.id}>
                  {site.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </header>

      {/* ── Content ──────────────────────────────────────── */}
      <main className="min-w-0 overflow-x-clip px-3 py-4 sm:px-4">
        <Outlet />
      </main>

      {/* ── Bottom nav ───────────────────────────────────── */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-gray-100 safe-area-inset-bottom z-20">
        <div className="flex items-center px-2 py-2">
          {navItems.map(({ path, label, icon: Icon }) => {
            const active = path === '/app'
              ? location.pathname === '/app' || location.pathname === '/app/dashboard'
              : location.pathname === path || location.pathname.startsWith(`${path}/`);
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
      <AIChat />
    </div>
  );
}
