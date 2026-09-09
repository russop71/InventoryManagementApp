import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Label } from '../components/ui/label';
import { Bell, Mail, MessageSquare, AlertTriangle, TrendingUp, Package, CalendarClock, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';
import { useInventory } from '../contexts/InventoryContext';
import { locationScopedStorageKey } from '../utils/storageScope';

interface NotificationSetting {
  id: string;
  label: string;
  description: string;
  icon: any;
  email: boolean;
  push: boolean;
  sms: boolean;
}

const DEFAULT_NOTIFICATION_SETTINGS: NotificationSetting[] = [
  { id: 'stockouts', label: 'Stockout Alerts', description: 'Get notified when items are 86\'d', icon: AlertTriangle, email: true, push: true, sms: false },
  { id: 'low-inventory', label: 'Low Inventory', description: 'Alert when items fall below par levels', icon: Package, email: true, push: true, sms: true },
  { id: 'ai-orders', label: 'Order Suggestions', description: 'Updates about forecast-based order suggestions', icon: TrendingUp, email: true, push: false, sms: false },
  { id: 'forecast', label: 'Forecast Alerts', description: 'Daily forecast summaries', icon: TrendingUp, email: true, push: false, sms: false },
  { id: 'integrations', label: 'Integration Updates', description: 'POS sync notifications', icon: Bell, email: false, push: true, sms: false },
];

export function Notifications() {
  const { accountId, activeLocationId, user } = useAuth();
  const { inventory } = useInventory();
  const canReceiveManagerDigest = ['Owner', 'Admin', 'Manager', 'BOH Manager', 'FOH Manager'].includes(user?.role || '');
  const priceChanges = useMemo(() => {
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    return inventory.flatMap(item => (item.priceHistory || []).map(change => ({ item, change })))
      .filter(({ change }) => new Date(change.date).getTime() >= cutoff && change.oldPrice !== change.newPrice)
      .sort((left, right) => new Date(right.change.date).getTime() - new Date(left.change.date).getTime());
  }, [inventory]);
  const [settings, setSettings] = useState<NotificationSetting[]>(DEFAULT_NOTIFICATION_SETTINGS);
  const storageKey = accountId && activeLocationId ? locationScopedStorageKey(accountId, activeLocationId, 'notificationPreferences') : null;

  useEffect(() => {
    if (!storageKey) return;
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || 'null');
      if (Array.isArray(saved)) setSettings(DEFAULT_NOTIFICATION_SETTINGS.map(setting => ({ ...setting, ...(saved.find(item => item?.id === setting.id) || {}) })));
    } catch { setSettings(DEFAULT_NOTIFICATION_SETTINGS); }
  }, [storageKey]);

  const updateSettings = (updater: (current: NotificationSetting[]) => NotificationSetting[]) => {
    setSettings(current => {
      const next = updater(current);
      if (storageKey) localStorage.setItem(storageKey, JSON.stringify(next.map(({ icon: _icon, ...setting }) => setting)));
      return next;
    });
  };

  const handleToggle = (id: string, type: 'email' | 'push' | 'sms') => {
    updateSettings(current => current.map(setting => {
      if (setting.id === id) {
        return { ...setting, [type]: !setting[type] };
      }
      return setting;
    }));
    toast.success('Notification preferences updated');
  };

  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-xl font-semibold text-gray-900 sm:text-2xl">Notification Settings</h2>
        <p className="mt-0.5 text-sm text-gray-600">Manage how you receive alerts and updates</p>
      </div>

      {canReceiveManagerDigest && (
        <Card className="overflow-hidden border-amber-200 bg-gradient-to-r from-[#303A43] to-[#202A33] text-white">
          <CardContent className="flex items-center gap-3 p-3 sm:px-4 sm:py-3.5">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-[#F5D62E] text-[#303A43]"><CalendarClock className="h-5 w-5" /></div>
            <div className="flex-1">
              <p className="text-sm font-black sm:text-base">Weekly manager attention update</p>
              <p className="mt-0.5 text-xs leading-5 text-white/65 sm:text-sm">Every Monday: price changes, low stock, overdue counts, open invoices and pending orders.</p>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="p-4 pb-2">
          <CardTitle className="flex items-center justify-between gap-3 text-lg"><span>Recent price changes</span><span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-black text-amber-800">{priceChanges.length}</span></CardTitle>
          <CardDescription className="text-sm leading-5">Last 30 days. Recipe and margin calculations use the current item cost.</CardDescription>
        </CardHeader>
        <CardContent className="px-4 pb-4 pt-0">
          {priceChanges.length ? <div className="divide-y divide-slate-100">{priceChanges.slice(0, 20).map(({ item, change }) => {
            const percent = change.oldPrice > 0 ? ((change.newPrice - change.oldPrice) / change.oldPrice) * 100 : null;
            const increased = change.newPrice > change.oldPrice;
            return <Link key={`${item.id}:${change.date}:${change.newPrice}`} to={`/app/inventory/${item.id}`} className="flex flex-col gap-2 py-3 transition hover:bg-slate-50 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1"><p className="font-bold text-slate-900">{item.name}</p><p className="mt-0.5 text-xs text-slate-500">{item.supplier || 'Supplier not set'} · {new Date(change.date).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' })}{change.reason ? ` · ${change.reason}` : ''}</p></div>
              <div className="flex items-center gap-3"><span className="text-sm text-slate-500">${change.oldPrice.toFixed(2)} → <strong className={increased ? 'text-red-600' : 'text-emerald-700'}>${change.newPrice.toFixed(2)}</strong></span>{percent !== null && <span className={`rounded-full px-2.5 py-1 text-xs font-black ${increased ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}>{percent >= 0 ? '+' : ''}{percent.toFixed(1)}%</span>}<ArrowRight className="h-4 w-4 text-slate-400" /></div>
            </Link>;
          })}</div> : <div className="rounded-lg bg-emerald-50 px-3 py-2.5 text-sm font-semibold text-emerald-800">No ingredient price changes in the last 30 days.</div>}
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-2">
        <Card role="button" tabIndex={0} aria-label="Enable all notifications" className="cursor-pointer hover:bg-gray-50" onKeyDown={event => {
          if (event.key !== 'Enter' && event.key !== ' ') return;
          event.preventDefault();
          updateSettings(current => current.map(s => ({ ...s, email: true, push: true })));
          toast.success('All notifications enabled');
        }} onClick={() => {
          updateSettings(current => current.map(s => ({ ...s, email: true, push: true })));
          toast.success('All notifications enabled');
        }}>
          <CardContent className="flex items-center justify-center gap-2 p-3 text-center">
            <Bell className="h-5 w-5 text-[#303A43]" />
            <p className="text-sm font-medium">Enable All</p>
          </CardContent>
        </Card>
        <Card role="button" tabIndex={0} aria-label="Disable all notifications" className="cursor-pointer hover:bg-gray-50" onKeyDown={event => {
          if (event.key !== 'Enter' && event.key !== ' ') return;
          event.preventDefault();
          updateSettings(current => current.map(s => ({ ...s, email: false, push: false, sms: false })));
          toast.success('All notifications disabled');
        }} onClick={() => {
          updateSettings(current => current.map(s => ({ ...s, email: false, push: false, sms: false })));
          toast.success('All notifications disabled');
        }}>
          <CardContent className="flex items-center justify-center gap-2 p-3 text-center">
            <Bell className="h-5 w-5 text-gray-400" />
            <p className="text-sm font-medium">Disable All</p>
          </CardContent>
        </Card>
      </div>

      {/* Notification Settings */}
      <div className="space-y-2">
        {settings.map(setting => {
          const Icon = setting.icon;
          return (
            <Card key={setting.id}>
              <CardContent className="p-3 sm:p-4">
                <div className="mb-3 flex items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#FEF9C3]">
                    <Icon className="w-5 h-5 text-[#303A43]" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900">{setting.label}</h3>
                    <p className="text-xs text-gray-600 sm:text-sm">{setting.description}</p>
                  </div>
                </div>

                <div className="grid gap-2 border-t border-gray-100 pt-3 sm:grid-cols-3 sm:gap-4">
                  {/* Email Toggle */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center space-x-2">
                      <Mail className="w-4 h-4 text-gray-500" />
                      <Label className="text-sm font-normal">Email</Label>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={setting.email}
                      aria-label={`${setting.label} email notifications`}
                      onClick={() => handleToggle(setting.id, 'email')}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        setting.email ? 'bg-[#303A43]' : 'bg-gray-200'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          setting.email ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>

                  {/* Push Toggle */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center space-x-2">
                      <Bell className="w-4 h-4 text-gray-500" />
                      <Label className="text-sm font-normal">Push Notifications</Label>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={setting.push}
                      aria-label={`${setting.label} push notifications`}
                      onClick={() => handleToggle(setting.id, 'push')}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        setting.push ? 'bg-[#303A43]' : 'bg-gray-200'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          setting.push ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>

                  {/* SMS Toggle */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center space-x-2">
                      <MessageSquare className="w-4 h-4 text-gray-500" />
                      <Label className="text-sm font-normal">SMS</Label>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={setting.sms}
                      aria-label={`${setting.label} SMS notifications`}
                      onClick={() => handleToggle(setting.id, 'sms')}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        setting.sms ? 'bg-[#303A43]' : 'bg-gray-200'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          setting.sms ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Quiet Hours */}
      <Card>
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-lg">Quiet Hours</CardTitle>
          <CardDescription>Pause non-critical notifications during specific hours</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 px-4 pb-4 pt-0">
          <div className="flex items-center justify-between">
            <Label>Enable Quiet Hours</Label>
            <button
              type="button"
              disabled
              aria-label="Quiet hours are not available yet"
              className="relative inline-flex h-6 w-11 cursor-not-allowed items-center rounded-full bg-gray-200 opacity-70"
            >
              <span className="inline-block h-4 w-4 transform rounded-full bg-white translate-x-1" />
            </button>
          </div>
          <p className="text-sm text-gray-500">Not available yet. This control will be enabled after background notification delivery is connected.</p>
        </CardContent>
      </Card>
    </div>
  );
}
