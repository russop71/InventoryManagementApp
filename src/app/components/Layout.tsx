import { useEffect, useRef, useState } from 'react';
import { Outlet, Link, useLocation } from 'react-router';
import {
  LayoutDashboard, Package, ChefHat,
  Users, LogOut, CreditCard, HelpCircle, MessageSquare, Bell,
  FileText, Shield, User, Truck, AlarmClock, Settings, Receipt, ChevronDown, Building2, CalendarClock, Trash2, TrendingUp, Wine, Sparkles,
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
        { label: 'Inventory', path: '/app/inventory', icon: Package },
        { label: 'Recipes', path: '/app/recipes', icon: ChefHat },
        { label: 'Beverage Costing', path: '/app/beverages', icon: Wine },
        { label: 'Suppliers', path: '/app/suppliers', icon: Building2 },
      ],
    },
    {
      label: 'Purchasing',
      items: [
        { label: 'Orders', path: '/app/orders', icon: Truck },
        { label: 'Invoices', path: '/app/invoices', icon: Receipt },
        { label: 'AI Orders', path: '/app/ai-orders', icon: Sparkles },
      ],
    },
    {
      label: 'Reports',
      items: [
        { label: 'Forecasting', path: '/app/forecasting', icon: TrendingUp },
        { label: 'Cost & COGS', path: '/app/costs', icon: FileText },
        { label: 'Waste Tracking', path: '/app/waste', icon: Trash2 },
      ],
    },
    {
      label: 'Team',
      items: [
        ...(canManageLabor ? [{ label: 'Labour & Scheduling', path: '/app/labor', icon: CalendarClock }] : [{ label: 'My schedule', path: '/employee', icon: CalendarClock }]),
        ...(user?.role === 'Owner' ? [{ label: 'Users & Usage', path: '/app/users', icon: Users }] : []),
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
    if (!accountId || user?.email?.trim().toLowerCase() === 'demo@zestiq.com') return;
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
  }, [accountId, activeLocationId, location.pathname, user?.email]);

  return (
    <div className="zestiq-app-shell min-h-screen overflow-x-clip bg-[#F7F3E8] pb-20 md:pb-0">

      {/* ── Desktop navigation ───────────────────────────── */}
      <aside className="fixed inset-y-0 left-0 z-50 hidden w-[264px] flex-col overflow-y-auto bg-[#303A43] text-white shadow-2xl md:flex">
        <Link
          to="/app"
          aria-label="ZestIQ dashboard"
          className="flex min-h-[88px] items-center border-b border-white/10 px-6 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#F5D62E]"
        >
          <ZestIQBrand
            markClassName="h-12 w-12 rounded-2xl"
            wordmarkClassName="text-[26px] text-white"
          />
        </Link>

        <div className="flex flex-1 flex-col px-4 py-5">
          <p className="mb-2 px-3 text-[10px] font-extrabold uppercase tracking-[0.22em] text-white/40">Workspace</p>
          <nav className="space-y-1">
            <Link to="/app" className={`group flex min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${location.pathname === '/app' || location.pathname === '/app/dashboard' ? 'bg-[#F5D62E] text-[#303A43] shadow-lg shadow-black/10' : 'text-white/70 hover:bg-white/8 hover:text-white'}`}><LayoutDashboard className="h-[18px] w-[18px] shrink-0" /><span>Dashboard</span></Link>
          </nav>

          {topMenuGroups.map(group => <div key={`desktop-group-${group.label}`} className="mt-5"><div className="mb-2 h-px bg-white/10" /><p className="mb-2 px-3 text-[10px] font-extrabold uppercase tracking-[0.22em] text-white/40">{group.label}</p><nav className="space-y-1">{group.items.map(({ label, path, icon: Icon }) => {
              const active = location.pathname === path || location.pathname.startsWith(`${path}/`);
              return (
                <Link
                  key={`desktop-${path}`}
                  to={path}
                  className={`flex min-h-10 items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition ${active ? 'bg-[#F5D62E] text-[#303A43]' : 'text-white/65 hover:bg-white/8 hover:text-white'}`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span>{label}</span>
                </Link>
              );
            })}</nav></div>)}

          <div className="mt-auto pt-6">
            <button
              type="button"
              onClick={() => navigate('/app/account')}
              className="flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-3 py-3 text-left transition hover:bg-white/10"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#F5D62E] text-sm font-black text-[#303A43]">
                {(user?.name || 'Z').trim().charAt(0).toUpperCase()}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-bold text-white">{user?.name || 'Team Member'}</span>
                <span className="block truncate text-[11px] text-white/45">{accountName || 'ZestIQ account'}</span>
              </span>
              <Settings className="h-4 w-4 text-white/40" />
            </button>
          </div>
        </div>
      </aside>

      {/* ── Desktop top bar ──────────────────────────────── */}
      <header className="fixed left-[264px] right-0 top-0 z-40 hidden h-[72px] items-center justify-between border-b border-[#DDD6C6] bg-[#FCFBF7]/95 px-7 backdrop-blur md:flex">
        <div className="flex items-center gap-4">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button type="button" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#DDD6C6] bg-white shadow-sm transition hover:border-[#F5D62E] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#F5D62E]" aria-label="Menu">
                <span className="flex flex-col gap-[5px]">
                  <span className="block h-[2.5px] w-5 rounded-full bg-[#303A43]" />
                  <span className="block h-[2.5px] w-5 rounded-full bg-[#303A43]" />
                  <span className="block h-[2.5px] w-3.5 rounded-full bg-[#303A43]" />
                </span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="mt-1 w-56 rounded-2xl border-0 bg-white shadow-2xl">
              <div className="border-b border-gray-100 px-3 py-3"><p className="text-sm font-bold text-gray-900">{accountName || 'zestIQ Account'}</p><p className="mt-0.5 text-xs text-gray-400">{user?.name || 'Team Member'}</p></div>
              <div className="py-1">
                {user?.platformAdmin && <DropdownMenuItem onClick={() => navigate('/app/platform')} className="mx-1 rounded-lg bg-[#FEF9C3]/60 font-semibold"><Building2 className="mr-2.5 h-4 w-4 text-[#A16207]" />ZestIQ Admin</DropdownMenuItem>}
                <DropdownMenuItem onClick={() => navigate('/app/account')} className="mx-1 rounded-lg"><User className="mr-2.5 h-4 w-4 text-gray-400" />Account</DropdownMenuItem>
                {user?.role === 'Owner' && <><DropdownMenuItem onClick={() => navigate('/app/users')} className="mx-1 rounded-lg"><Users className="mr-2.5 h-4 w-4 text-gray-400" />Users & Usage</DropdownMenuItem><DropdownMenuItem onClick={() => navigate('/app/payment-method')} className="mx-1 rounded-lg"><CreditCard className="mr-2.5 h-4 w-4 text-gray-400" />Subscription & Billing</DropdownMenuItem></>}
              </div>
              <DropdownMenuSeparator />
              <div className="py-1">
                <DropdownMenuLabel className="px-3 pb-1 text-[10px] font-bold uppercase tracking-widest text-gray-400">Settings</DropdownMenuLabel>
                <DropdownMenuItem onClick={() => navigate('/app/suppliers')} className="mx-1 rounded-lg"><Truck className="mr-2.5 h-4 w-4 text-gray-400" />Suppliers</DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate('/app/integrations')} className="mx-1 rounded-lg"><Settings className="mr-2.5 h-4 w-4 text-gray-400" />Integrations</DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate('/app/notifications')} className="mx-1 rounded-lg"><Bell className="mr-2.5 h-4 w-4 text-gray-400" />Notifications</DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate('/app/order-alarms')} className="mx-1 rounded-lg"><AlarmClock className="mr-2.5 h-4 w-4 text-gray-400" />Order Alarms</DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate('/app/waste')} className="mx-1 rounded-lg"><Trash2 className="mr-2.5 h-4 w-4 text-gray-400" />Waste Tracking</DropdownMenuItem>
              </div>
              <DropdownMenuSeparator />
              <div className="py-1"><DropdownMenuLabel className="px-3 pb-1 text-[10px] font-bold uppercase tracking-widest text-gray-400">Support</DropdownMenuLabel><DropdownMenuItem onClick={() => navigate('/app/help')} className="mx-1 rounded-lg"><HelpCircle className="mr-2.5 h-4 w-4 text-gray-400" />Help Center</DropdownMenuItem><DropdownMenuItem onClick={() => navigate('/app/contact')} className="mx-1 rounded-lg"><MessageSquare className="mr-2.5 h-4 w-4 text-gray-400" />Contact Us</DropdownMenuItem></div>
              <DropdownMenuSeparator />
              <div className="py-1"><DropdownMenuItem onClick={() => navigate('/terms')} className="mx-1 rounded-lg"><FileText className="mr-2.5 h-4 w-4 text-gray-400" />Terms of Service</DropdownMenuItem><DropdownMenuItem onClick={() => navigate('/privacy')} className="mx-1 rounded-lg"><Shield className="mr-2.5 h-4 w-4 text-gray-400" />Privacy Policy</DropdownMenuItem></div>
              <DropdownMenuSeparator />
              <div className="py-1"><DropdownMenuItem onClick={handleLogout} className="mx-1 rounded-lg text-red-600 focus:bg-red-50 focus:text-red-600"><LogOut className="mr-2.5 h-4 w-4" />Logout</DropdownMenuItem></div>
            </DropdownMenuContent>
          </DropdownMenu>
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-[#9A8B65]">Restaurant operations</p>
            <p className="mt-0.5 text-sm font-bold text-[#303A43]">{accountName || 'ZestIQ'} <span className="font-medium text-[#8A9298]">· {locations.find(site => site.id === activeLocationId)?.name || 'All locations'}</span></p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <select
            className="h-10 rounded-xl border border-[#DDD6C6] bg-white px-3 text-sm font-semibold text-[#303A43] shadow-sm outline-none focus:border-[#F5D62E] focus:ring-2 focus:ring-[#F5D62E]/20"
            value={activeLocationId ?? ''}
            onChange={(event) => switchLocation(event.target.value)}
            aria-label="Active location"
          >
            {locations.map(site => <option key={site.id} value={site.id}>{site.name}</option>)}
          </select>
          <button
            onClick={() => navigate('/app/notifications')}
            className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-[#DDD6C6] bg-white text-[#303A43] shadow-sm transition hover:border-[#F5D62E]"
            aria-label="Notifications"
          >
            <Bell className="h-[18px] w-[18px]" />
            <span className="absolute right-2 top-2 h-2 w-2 rounded-full border-2 border-white bg-[#F5D62E]" />
          </button>
        </div>
      </header>

      {/* ── White header ───────────────────────────────── */}
      <header className="sticky top-0 z-40 border-b border-gray-100 bg-white shadow-sm md:hidden">
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
                  <span className="block w-5   h-[2.5px] rounded-full" style={{ background: '#303A43' }} />
                  <span className="block w-5   h-[2.5px] rounded-full" style={{ background: '#303A43' }} />
                  <span className="block w-3.5 h-[2.5px] rounded-full" style={{ background: '#303A43' }} />
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
          <Link to="/app" aria-label="ZestIQ dashboard" className="rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-[#F5D62E]">
            <ZestIQBrand wordmarkClassName="text-[21px] text-[#303A43]" />
          </Link>

          {/* RIGHT — bell */}
          <button
            onClick={() => navigate('/app/notifications')}
            className="relative w-10 h-10 flex items-center justify-center rounded-xl transition-colors focus:outline-none"
            aria-label="Notifications"
          >
            <Bell className="w-5 h-5" style={{ color: '#303A43' }} />
            <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-red-500 border-2" style={{ borderColor: '#F5D62E' }} />
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
                      className="flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-gray-600 transition hover:bg-white hover:text-[#303A43]"
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
                          className={`flex w-full cursor-pointer items-center rounded-xl px-3 py-2 text-left text-sm transition ${active ? 'bg-[#FEF3C7] text-[#303A43]' : 'text-gray-700 hover:bg-gray-50'}`}
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
      <main className="min-w-0 overflow-x-clip px-3 py-4 sm:px-4 md:ml-[264px] md:px-7 md:pb-8 md:pt-[96px]">
        <div className="mx-auto w-full max-w-[1500px]">
          <Outlet />
        </div>
      </main>

      {/* ── Bottom nav ───────────────────────────────────── */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-gray-100 safe-area-inset-bottom z-20 md:hidden">
        <div className="flex items-center px-2 py-2">
          {navItems.map(({ path, label, icon: Icon }) => {
            const active = path === '/app'
              ? location.pathname === '/app' || location.pathname === '/app/dashboard'
              : location.pathname === path || location.pathname.startsWith(`${path}/`);
            return (
              <Link
                key={path}
                to={path}
                className={`relative flex flex-col items-center justify-center flex-1 py-1.5 px-1 rounded-xl transition-all duration-150 ${active ? 'text-[#303A43]' : 'text-gray-400'}`}
              >
                {active && <div className="absolute inset-0 rounded-xl" style={{ background: 'rgba(245,193,14,0.18)' }} />}
                {active && <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-5 h-[3px] rounded-full" style={{ background: '#F5D62E' }} />}
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
